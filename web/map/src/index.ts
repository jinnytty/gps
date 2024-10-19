import { LatLng, Map } from 'leaflet';
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
  key: string;
  accessToken: string;
  location: string;
  tile: string;
  color: string;
}

export async function app(config: Config) {
  console.log('starting app', config);
  const [lat, lng, zoom] = config.location.split(',').map((v) => Number(v));
  const map = L.map('map', {}).setView([lat, lng], zoom);
  const tileData = getTileData(config.tile);
  L.tileLayer(tileData.url, {
    attribution: tileData.attribution,
  }).addTo(map);

  const gpsConfig: GpsClientConfig = {
    apiEndpoint: process.env.API_ENDPOINT!,
    wsEndpoint: process.env.WS_ENDPOINT!,
    name: config.key,
    accessKey: config.accessToken,
  };
  const gps = new GpsClient(gpsConfig);
  console.log('init gps client');
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
  console.log('point count for line', points.length);

  const polyline = new L.Polyline(points, {
    color: '#' + config.color,
    smoothFactor: 0,
  });
  polyline.addTo(map);
  gps.on('point', (p: Point) => {
    polyline.addLatLng(new LatLng(p.lat, p.lng));
  });

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

  layerControl.addTo(map);
}
