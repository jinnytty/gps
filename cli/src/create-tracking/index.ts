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
  key: string;
  name: string;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  key: { type: String, defaultOption: true },
  name: { type: String, defaultValue: '' },
};

interface Config extends ServiceConfig, FileConfig {}

const argConf: ArgumentConfig<Config> = {
  ...ServiceConfigOpt,
  ...RedisConfigOpt,
  ...FileConfigOpt,
};

function generateRandomString(length: number): string {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    result += characters[randomIndex];
  }

  return result;
}

export default async function main(args: string[]) {
  const eargs = env2arg<Config>(argConf);
  const config: Config = parse<Config>(argConf, {
    loadFromFileArg: 'config',
    argv: [...eargs, ...args],
  });

  const logger: Logger = initLogger('gps-cli-create-tracking');

  let name = config.name;
  const key = config.key;
  if (name.length === 0) name = config.key;

  logger.trace({ key, name }, 'key name');

  if (key.length === 0) {
    throw new Error('no key');
  }

  const client = new PrismaClient();

  const etracking = await client.gpsTracking.findFirst({
    where: {
      key: key,
    },
  });
  if (etracking) {
    throw new Error('tracking with key does already exist:' + key);
  }

  const tracking = await client.gpsTracking.create({
    data: {
      key,
      name,
      started: new Date(),
    },
  });

  const rtoken = generateRandomString(20);
  await client.accessToken.create({
    data: {
      created: new Date(),
      token: rtoken,
      readonly: true,
      key: tracking.key,
    },
  });

  const rwtoken = generateRandomString(20);
  await client.accessToken.create({
    data: {
      created: new Date(),
      token: rwtoken,
      readonly: false,
      key: tracking.key,
    },
  });

  console.log(`created tracking ${name} with key ${key}`);
  console.log(`read write authentication token ${rwtoken}`);
  console.log(`read only authentication token ${rtoken}`);
}
