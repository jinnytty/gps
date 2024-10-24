import { PrismaClient } from '@jinnytty-gps/prisma';

export interface Tracking {
  id: number;
  startedTimestamp: number;
  ended: boolean;
}
const trackingCache: Map<string, Tracking> = new Map();

export async function getTrackingId(
  client: PrismaClient,
  key: string
): Promise<Tracking> {
  if (trackingCache.has(key)) {
    return trackingCache.get(key)!;
  }

  const db = await client.gpsTracking.findFirst({
    where: {
      key,
    },
  });
  if (!db) throw new Error('no tracking for ' + key);

  const tracking: Tracking = {
    id: db.id,
    startedTimestamp: Math.round(db.started.getTime() / 1000),
    ended: db.ended !== null,
  };

  trackingCache.set(key, tracking);
  return tracking;
}
