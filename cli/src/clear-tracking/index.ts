import { ArgumentConfig, parse } from 'ts-command-line-args';
import {
  FileConfig,
  FileConfigOpt,
  RedisConfig,
  RedisConfigOpt,
} from '@jinnytty-gps/config';
import { env2arg, initLogger } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import { Prisma, PrismaClient } from '@jinnytty-gps/prisma';
import {
  logKey,
  pointJsonKey,
  pointRawKey,
  pointTextKey,
  redisClient,
} from '@jinnytty-gps/redis';

interface ServiceConfig {
  key: string[];
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  key: { type: String, defaultOption: true, multiple: true },
};

interface Config extends ServiceConfig, RedisConfig, FileConfig {}

const argConf: ArgumentConfig<Config> = {
  ...ServiceConfigOpt,
  ...RedisConfigOpt,
  ...FileConfigOpt,
};

export default async function main(args: string[]) {
  const eargs = env2arg<Config>(argConf);
  const config: Config = parse<Config>(argConf, {
    loadFromFileArg: 'config',
    argv: [...eargs, ...args],
  });

  const logger: Logger = initLogger('gps-cli-clear-tracking');

  const redis = await redisClient(config);
  const client = new PrismaClient();

  logger.trace({ keys: config.key }, 'keys to clear');
  for (let i = 0; i < config.key.length; ++i) {
    const key = config.key[i];
    const tracking = await client.gpsTracking.findFirst({
      where: {
        key: key,
      },
    });
    if (!tracking) {
      throw new Error('tracking not found:' + key);
    }

    logger.trace({ tracking }, 'tracking');

    const logs = await client.gpsLog.findMany({
      where: {
        trackingId: tracking.id,
      },
    });
    for (let ii = 0; ii < logs.length; ++ii) {
      const l = logs[ii];
      logger.trace({ log: l }, 'clear redis');
      await redis.DEL(logKey(l));
      await redis.DEL(pointRawKey(l));
      await redis.DEL(pointJsonKey(l));
      await redis.DEL(pointTextKey(l));
    }

    logger.trace({}, 'delete logs');
    await client.gpsLog.deleteMany({
      where: {
        trackingId: tracking.id,
      },
    });
  }

  redis.disconnect();
}
