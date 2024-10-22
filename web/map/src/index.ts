import { LatLng, Map } from 'leaflet';
import * as L from 'leaflet';
import { GpsClient, GpsClientConfig } from '@jinnytty-gps/gps-client';
import {
  Log,
  MapDisplayConfig,
  MapMarker,
  Point,
} from '@jinnytty-gps/api-model';
import { addMarker } from './marker';

export interface TileData {
  name: string;
  url: string;
  attribution: string;
}

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

export async function app(tile: string) {
  console.log('starting app', tile);

  const apiEndpoint = process.env.API_ENDPOINT!;
  const configName = process.env.CONFIG_NAME!;

  const req = await fetch(`${apiEndpoint}/config/${configName}`);
  const config: MapDisplayConfig = await req.json();
  console.log('config', config);

  const map = L.map('map', {}).setView([config.lat, config.lng], config.zoom);
  const tileData = getTileData(tile);
  L.tileLayer(tileData.url, {
    attribution: tileData.attribution,
  }).addTo(map);

  const hasPoints: boolean[] = [];
  const iconMarker: L.Marker[] = [];

  // do the last tracking as live first
  for (let i = 0; i < config.tracking.length; ++i) {
    const t = config.tracking[i];
    if (t.trackingIds.length === 0) continue;
    const name = t.trackingIds[t.trackingIds.length - 1];
    const gpsConfig: GpsClientConfig = {
      apiEndpoint: process.env.API_ENDPOINT!,
      wsEndpoint: process.env.WS_ENDPOINT!,
      name: name,
      accessKey: config.accessToken,
    };
    const gps = new GpsClient(gpsConfig);
    console.log('init gps client', gpsConfig);
    await gps.init();
    console.log(gps.tracking);
    await gps.connect();

    let points: LatLng[] = [];
    if (gps.tracking) {
      gps.tracking.logs.forEach((log) => {
        const p = gps.points.get(log.started);
        if (p) {
          points = points.concat(p.map((v) => new LatLng(v.lat, v.lng)));
        }
      });
    }
    let mLat = config.lat;
    let mLng = config.lng;
    if (points.length > 0) {
      hasPoints.push(true);
      const p = points[points.length - 1];

      mLat = p.lat;
      mLng = p.lng;
    } else {
      hasPoints.push(false);
    }

    const polyline = new L.Polyline(points, {
      color: t.color,
      smoothFactor: 0,
    });
    polyline.addTo(map);
    const icon = L.icon({
      iconUrl: t.icon.url,
      iconSize: [t.icon.width, t.icon.height],
      iconAnchor: [t.icon.anchorX, t.icon.anchorY],
    });
    const marker = L.marker([mLat, mLng], { icon, zIndexOffset: 1001 });
    if (points.length > 0) {
      marker.addTo(map);
    }
    iconMarker.push(marker);
    gps.on('point', (p: Point) => {
      const newPoint = new LatLng(p.lat, p.lng);
      polyline.addLatLng(newPoint);

      if (marker) {
        marker.setLatLng(newPoint);
      }
    });
  }

  // draw the remaining as static line
  for (let i = 0; i < config.tracking.length; ++i) {
    const t = config.tracking[i];
    let lastLat = config.lat;
    let lastLng = config.lng;

    for (let ii = 0; ii < t.trackingIds.length - 1; ++ii) {
      const name = t.trackingIds[ii];
      const gpsConfig: GpsClientConfig = {
        apiEndpoint: process.env.API_ENDPOINT!,
        wsEndpoint: process.env.WS_ENDPOINT!,
        name: name,
        accessKey: config.accessToken,
      };
      const gps = new GpsClient(gpsConfig);
      console.log('init gps client', gpsConfig);
      await gps.init();

      let points: LatLng[] = [];
      if (gps.tracking) {
        gps.tracking.logs.forEach((log) => {
          const p = gps.points.get(log.started);
          if (p) {
            points = points.concat(p.map((v) => new LatLng(v.lat, v.lng)));
          }
        });
      }

      if (points.length > 0) {
        lastLng = points[points.length - 1].lng;
        lastLat = points[points.length - 1].lat;
      }

      const polyline = new L.Polyline(points, {
        color: t.color,
        smoothFactor: 0,
      });
      polyline.addTo(map);
    }

    if (hasPoints.length >= i && !hasPoints[i]) {
      if (iconMarker.length >= i) {
        const newPoint = new LatLng(lastLat, lastLng);
        iconMarker[i].setLatLng(newPoint);
      }
    }
  }
  iconMarker.forEach((m) => m.addTo(map));

  if (config.marker) {
    config.marker.forEach((m) => {
      addMarker(map, m);
    });
  }
  if (Array.isArray(config.markerId)) {
    for (let i = 0; i < config.markerId.length; ++i) {
      if (config.markerId[i].length === 0) continue;
      try {
        const req = await fetch(`${apiEndpoint}/config/${config.markerId[i]}`);
        const mConfig: MapMarker[] = await req.json();
        mConfig.forEach((m) => {
          addMarker(map, m);
        });
      } catch (e) {
        console.log('unabel to display marker ', config.markerId[i]);
      }
    }
  }

  /*
  const LayerControl = L.Control.extend({
    onAdd: function () {
      const div = L.DomUtil.create('div');

      div.innerHTML =
        '<svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeMedium css-vubbuv" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="LayersIcon"><path d="m11.99 18.54-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"></path></svg>';
    },
  });
  const layerControl = new LayerControl({
    position: 'bottomleft',
  });

  layerControl.addTo(map);*/
}
