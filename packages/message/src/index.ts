import { Point, RawPoint } from '@jinnytty-gps/model';

export const Topics = {
  gpsTrackingOutput: 'gps-trackingpoints-raw',
  gpsFilterOutput: 'gps-filteredpoints',
};

export interface RawPointMsg {
  key: string;
  point: RawPoint;
}

export interface PointMsg {
  key: string;
  point: Point;
}
