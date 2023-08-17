export interface RawPoint {
  lat: string;
  lon: string;
  sat: string;
  alt: string;
  acc: string;
  dir: string;
  prov: string;
  spd: string;
  timestamp: string;
  timeoffset: string;
  time: string;
  starttimestamp: string;
  date: string;
  batt: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Point extends LatLng {
  accuracy: number;
  alt: number;
  timestamp: number;
  startTimestamp: number;
  provider: string;
}
