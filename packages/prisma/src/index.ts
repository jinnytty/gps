//export { PrismaClient, Prisma } from '@prisma/client';

import { Log, Tracking } from '@jinnytty-gps/api-model';
import { GpsLog, GpsTracking } from '../prisma/generated/gps-client/index.js';

//export * from '.prisma/client/index.d';
//export * from '@prisma/client';

// see https://github.com/prisma/prisma/issues/2443#issuecomment-630679118
export * from '../prisma/generated/gps-client/index.js';

export function trackingToApi(tracking: GpsTracking, log?: GpsLog[]): Tracking {
  const result: Tracking = {
    name: tracking.name,
    started: Math.floor(tracking.started.getTime() / 1000),
    logs: [],
  };
  if (log) {
    log.forEach((l) => result.logs.push(logToApi(l)));
  }
  return result;
}

export function logToApi(log: GpsLog): Log {
  const result: Log = {
    distance: log.distance.toNumber(),
    started: Math.floor(log.started.getTime() / 1000),
    last: Math.floor(log.last.getTime() / 1000),
  };
  return result;
}
