import { LatLng } from 'leaflet';
import * as L from 'leaflet';
import { GpsClient, GpsClientConfig } from '@jinnytty-gps/gps-client';
import { Log, Point } from '@jinnytty-gps/api-model';

export interface TileData {
  name: string;
  url: string;
  attribution: string;
}

console.log('leaflet', L);

const DefaultTiles: TileData[] = [
  {
    name: 'openstreetmap',
    url: 'https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  /*{
    name: 'terrain',
    url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}{r}.png',
    attribution:
      'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },*/
  {
    name: 'photo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
  },
];

function getTileData(tile: string): TileData {
  for (let i = 0; i < DefaultTiles.length; ++i) {
    if (DefaultTiles[i].name === tile) {
      return DefaultTiles[i];
    }
  }
  return DefaultTiles[0];
}

export interface Config {
  lat: number;
  lng: number;
  zoom: number;
  tile?: string;
  gps: GpsConfig[];
}

export interface GpsConfig {
  key: string;
  accessToken: string;
  color: string;
  icon?: string;
  iconWidth?: number;
  iconHeight?: number;
  iconAnchorX?: number;
  iconAnchorY?: number;
  zIndex?: number;
}

export async function app(config: Config) {
  console.log('starting app', config);

  const map = L.map('map', {
    zoomControl: false,
    attributionControl: false,
  }).setView([config.lat, config.lng], config.zoom);
  const tileData = getTileData(config.tile ? config.tile : '');
  L.tileLayer(tileData.url, {
    attribution: tileData.attribution,
  }).addTo(map);

  let padding = 0;
  const lastPoint: Map<string, LatLng> = new Map();
  const center = () => {
    const points = Array.from(lastPoint.values());
    map.fitBounds(L.latLngBounds(points), {
      padding: [padding, padding],
    });
  };

  for (let i = 0; i < config.gps.length; ++i) {
    const gpsc = config.gps[i];
    const gpsConfig: GpsClientConfig = {
      apiEndpoint: process.env.API_ENDPOINT!,
      wsEndpoint: process.env.WS_ENDPOINT!,
      name: gpsc.key,
      accessKey: gpsc.accessToken,
    };
    const gps = new GpsClient(gpsConfig);
    console.log('init gps client', gpsConfig);
    await gps.init();
    console.log(gps.tracking);

    let points: LatLng[] = [];
    if (gps.tracking) {
      gps.tracking.logs.forEach((log) => {
        const p = gps.points.get(log.started);
        if (p) {
          points = points.concat(p.map((v) => new LatLng(v.lat, v.lng)));
        }
      });
    }

    const polyline = new L.Polyline(points, {
      color: '#' + gpsc.color,
      smoothFactor: 0,
    });
    polyline.addTo(map);
    let mLat = config.lat;
    let mLng = config.lng;
    if (points.length > 0) {
      const p = points[points.length - 1];

      mLat = p.lat;
      mLng = p.lng;
      lastPoint.set(gpsc.key, p);
      center();
    }

    let marker: L.Marker | undefined = undefined;

    if (gpsc.icon) {
      const w = gpsc.iconWidth ? gpsc.iconWidth : 32;
      const h = gpsc.iconHeight ? gpsc.iconHeight : 32;
      const x = gpsc.iconAnchorX ? gpsc.iconAnchorX : Math.min(w / 2);
      const y = gpsc.iconAnchorY ? gpsc.iconAnchorY : h;
      const icon = L.icon({
        iconUrl: gpsc.icon,
        iconSize: [w, h],
        iconAnchor: [x, y],
      });
      if (w > padding) padding = w;
      if (h > padding) padding = h;
      const mopt: L.MarkerOptions = { icon };
      if (gpsc.zIndex) {
        mopt.zIndexOffset = gpsc.zIndex;
      }
      marker = L.marker([mLat, mLng], mopt).addTo(map);
    }

    gps.on('point', (p: Point) => {
      const newPoint = new LatLng(p.lat, p.lng);
      polyline.addLatLng(newPoint);

      lastPoint.set(gpsc.key, newPoint);
      center();
      if (marker) {
        marker.setLatLng(newPoint);
      }
    });
  }
}
