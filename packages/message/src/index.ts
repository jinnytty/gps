import { Point, RawPoint } from '@jinnytty-gps/model';

export const Topics = {
  gpsTrackingOutput: 'gps-trackingpoints-raw',
  gpsFilterOutput: 'gps-filteredpoints',
  gpsFilterLogUpdate: 'gps-logupdate',
};

export interface RawPointMsg {
  key: string;
  point: RawPoint;
}

export interface PointMsg {
  key: string;
  point: Point;
}

export interface LogUpdateMsg {
  key: string;
  logId: number;
  started: number;
  distance: number;
  last: number;
}
