import { PrismaClient } from '@jinnytty-gps/prisma';

const trackingCache: Map<string, number> = new Map();

export async function getTrackingId(
  client: PrismaClient,
  key: string
): Promise<number> {
  if (trackingCache.has(key)) {
    return trackingCache.get(key)!;
  }

  const db = await client.gpsTracking.findFirst({
    where: {
      key,
    },
  });
  if (!db) throw new Error('no tracking for ' + key);

  trackingCache.set(key, db.id);
  return db.id;
}
