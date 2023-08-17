import { Kalman } from './Kalman.js';
import { ProviderFilter } from './ProviderFilter.js';
import { Point } from '@jinnytty-gps/model';

export class GPS {
  providerFilter = new ProviderFilter();
  kalman = new Kalman();
  lastTimestampValue = 0;

  process(point: Point): Point | null {
    const timestamp = point.timestamp;
    if (this.lastTimestampValue >= timestamp) return null;

    const filtered = this.providerFilter.filter(point);
    if (filtered === null) return null;

    this.lastTimestampValue = timestamp;
    this.kalman.process(filtered);
    return {
      ...point,
      lat: this.kalman.filter!.getLat(),
      lng: this.kalman.filter!.getLng(),
    };
  }

  get lastTimestamp() {
    return this.lastTimestampValue;
  }

  get count() {
    return this.kalman.count;
  }

  get distance() {
    return this.kalman.distance;
  }

  get lastCalcDistance() {
    return this.kalman.lastCalcDistance;
  }
}
