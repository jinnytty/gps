import { getDistanceFromLatLonInKm } from './utils.js';
import { LatLng, Point } from '@jinnytty-gps/model';

// https://stackoverflow.com/a/15657798/19956502
export class KalmanFilter {
  Q_metres_per_second = 1;
  lat;
  lng;
  variance;
  TimeStamp_milliseconds;
  MinAccuracy = 1;

  constructor(point: Point) {
    this.lat = point.lat;
    this.lng = point.lng;
    this.variance = point.accuracy * point.accuracy;
    this.TimeStamp_milliseconds = point.timestamp * 1000;
  }

  getLat(): number {
    return this.lat;
  }

  getLng(): number {
    return this.lng;
  }

  process(point: Point) {
    let lat_measurement = point.lat,
      lng_measurement = point.lng,
      accuracy = point.accuracy,
      TimeStamp_milliseconds = point.timestamp * 1000;
    if (accuracy < this.MinAccuracy) accuracy = this.MinAccuracy;
    if (this.variance < 0) {
      // if variance < 0, object is unitialised, so initialise with current values
      this.TimeStamp_milliseconds = TimeStamp_milliseconds;
      this.lat = lat_measurement;
      this.lng = lng_measurement;
      this.variance = accuracy * accuracy;
    } else {
      // else apply Kalman filter methodology

      let TimeInc_milliseconds =
        TimeStamp_milliseconds - this.TimeStamp_milliseconds;
      if (TimeInc_milliseconds > 0) {
        // time has moved on, so the uncertainty in the current position increases
        this.variance +=
          (TimeInc_milliseconds *
            this.Q_metres_per_second *
            this.Q_metres_per_second) /
          1000;
        this.TimeStamp_milliseconds = TimeStamp_milliseconds;
        // TO DO: USE VELOCITY INFORMATION HERE TO GET A BETTER ESTIMATE OF CURRENT POSITION
      }

      // Kalman gain matrix K = Covarariance * Inverse(Covariance + MeasurementVariance)
      // NB: because K is dimensionless, it doesn't matter that variance has different units to lat and lng
      const K = this.variance / (this.variance + accuracy * accuracy);
      // apply K
      this.lat += K * (lat_measurement - this.lat);
      this.lng += K * (lng_measurement - this.lng);
      // new Covarariance  matrix is (IdentityMatrix - K) * Covarariance
      this.variance = (1 - K) * this.variance;
    }
  }
}

export class Kalman {
  currentStartTimestamp = 0;
  distance = 0;
  lastCalcDistance = 0;
  filter: KalmanFilter | null = null;
  count = 0;

  process(point: Point) {
    this.count++;

    if (
      this.filter === null ||
      this.currentStartTimestamp !== point.startTimestamp
    ) {
      this.filter = new KalmanFilter(point);
      this.currentStartTimestamp = point.startTimestamp;
      this.lastCalcDistance = 0;
    } else {
      if (this.filter !== null) {
        const oldLat = this.filter.lat;
        const oldLng = this.filter.lng;
        this.filter.process(point);
        this.lastCalcDistance = getDistanceFromLatLonInKm(
          oldLat,
          oldLng,
          this.filter.getLat(),
          this.filter.getLng()
        );
        this.distance += this.lastCalcDistance;
      }
    }
  }
}
