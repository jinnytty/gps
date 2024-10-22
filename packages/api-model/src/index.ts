export interface Tracking {
  name: string;
  started: number;
  logs: Log[];
}

export interface Log {
  started: number;
  distance: number;
  last: number;
}

export interface MapIcon {
  url: string;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
}

export interface MapMarker {
  name: string;
  lat: number;
  lng: number;
  bounce: boolean;
  icon?: MapIcon;
  innerIcon?: MapIcon;
}

export interface MapTracking {
  name: string;
  icon: MapIcon;
  color: string;
  trackingIds: string[];
}

export interface MapDisplayConfig {
  accessToken: string;
  lat: number;
  lng: number;
  zoom: number;
  tracking: MapTracking[];
  marker?: MapMarker[];
  markerId?: string[];
}

export type LogPoints = Log & { points: Point[] };

export interface Point {
  lat: number;
  lng: number;
  timestamp: number;
}

export enum MessageType {
  PING = 0,
  PONG = 1,
  SUBSCRIBE = 2,
  POINT = 3,
  LOG = 4,
  DISTANCE = 5,
}

export interface Message {
  type: MessageType;
}

export interface SubscribeMessage extends Message {
  name: string;
  log: number;
  timestamp: number;
}

export interface PointMessage extends Message {
  log: number;
  point: Point;
}

export interface LogMessage extends Message {
  log: number;
}

export interface DistanceMessage extends Message {
  log: number;
  distance: number;
}
