import { RedisConfig } from '@jinnytty-gps/config';
import { createClient } from 'redis';
import { GpsLog } from '@jinnytty-gps/prisma';

export type RedisClient = ReturnType<typeof createClient>;

let redis: RedisClient | undefined = undefined;

export async function redisClient(config: RedisConfig): Promise<RedisClient> {
  if (!redis) {
    redis = createClient({
      url: config.redisUrl,
    });
    await redis.connect();
  }

  return redis;
}

export function logKey(log: GpsLog): string {
  return `log-${log.id}`;
}

export function pointRawKey(log: GpsLog): string {
  return `${logKey(log)}-point-raw`;
}

export function pointJsonKey(log: GpsLog): string {
  return `${logKey(log)}-point-json`;
}

export function pointTextKey(log: GpsLog): string {
  return `${logKey(log)}-point-text`;
}

export async function getTextPoints(log: GpsLog): Promise<string> {
  if (!redis) throw new Error('redis not initialized');

  const result = await redis.GET(pointTextKey(log));
  if (!result) {
    throw new Error('no data');
  }
  return result;
}
