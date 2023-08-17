import { Point } from '@jinnytty-gps/model';
import { initLogger } from '@jinnytty-gps/utils';

const MAX_AGE = 11;

const logger = initLogger('geo-provider-filter');

export class ProviderFilter {
  currentStartTimestamp = 0;
  provider = '';
  gpsLast: Point | null = null;
  networkLast: Point | null = null;

  filter(point: Point) {
    const start = point.startTimestamp;
    if (start !== this.currentStartTimestamp) {
      this.currentStartTimestamp = start;
      this.gpsLast = null;
      this.networkLast = null;
    }

    const timestamp = point.timestamp;
    let lastA = this.gpsLast;
    let lastB = this.networkLast;

    if (point.provider === 'gps') {
      this.gpsLast = point;
    }
    if (point.provider === 'network') {
      lastA = this.networkLast;
      lastB = this.gpsLast;
      this.networkLast = point;
    }

    if (lastB === null) {
      logger.trace(
        { provider: point.provider, reason: 'no data' },
        'use provider'
      );
      this.provider = point.provider;
      return point;
    }

    if (timestamp > lastB.timestamp + MAX_AGE) {
      if (point.provider !== this.provider) {
        logger.trace(
          { provider: point.provider, reason: 'outdated' },
          'use provider'
        );
      }
      this.provider = point.provider;
      return point;
    }

    const nProvider =
      point.accuracy < lastB.accuracy ? point.provider : lastB.provider;

    if (nProvider !== this.provider) {
      logger.trace(
        {
          provider: point.provider,
          reason: 'accuracy',
          newAccuracy: point.accuracy,
          oldAccuracy: lastB.accuracy,
        },
        'use provider'
      );

      this.provider = nProvider;
    }

    if (point.provider === this.provider) {
      return point;
    }

    return null;
  }
}
