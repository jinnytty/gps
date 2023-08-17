import { ArgumentConfig, parse } from 'ts-command-line-args';
import {
  KafkaConfig,
  FileConfig,
  KafkaConfigOpt,
  FileConfigOpt,
  RedisConfigOpt,
  RedisConfig,
} from '@jinnytty-gps/config';
import { env2arg, initLogger, sendData } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import { PointMsg, RawPointMsg, Topics } from '@jinnytty-gps/message';
import { GpsLog, PrismaClient } from '@jinnytty-gps/prisma';
import { Kafka, Consumer, Producer } from 'kafkajs';
import { Point, RawPoint } from '@jinnytty-gps/model';
import { GPS } from '@jinnytty-gps/geo';
import { getTrackingId } from './trackingCache.js';
import {
  pointJsonKey,
  pointRawKey,
  pointTextKey,
  redisClient,
} from '@jinnytty-gps/redis';
import readline from 'readline';
import { Readable } from 'stream';

interface ServiceConfig {
  inputTopic: string;
  outputTopic: string;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  inputTopic: { type: String, defaultValue: Topics.gpsTrackingOutput },
  outputTopic: { type: String, defaultValue: Topics.gpsFilterOutput },
};

interface Config extends ServiceConfig, KafkaConfig, RedisConfig, FileConfig {}

const argConf: ArgumentConfig<Config> = {
  ...ServiceConfigOpt,
  ...KafkaConfigOpt,
  ...RedisConfigOpt,
  ...FileConfigOpt,
};

const args = env2arg<Config>(argConf);
const config: Config = parse<Config>(argConf, {
  loadFromFileArg: 'config',
  argv: [...args, ...process.argv.splice(2)],
});

const logger: Logger = initLogger('gps-filter');

const kafka: Kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBroker,
});

const redis = await redisClient(config);

const producer: Producer = kafka.producer();
await producer.connect();

const consumer: Consumer = kafka.consumer({ groupId: 'filter' });
await consumer.connect();
await consumer.subscribe({ topic: config.inputTopic });

const client = new PrismaClient();

interface GpsCache {
  log: GpsLog;
  gps: GPS;
  timestamp: number;
}
const gpsCache: Map<string, GpsCache> = new Map();

async function getLog(
  trackingId: number,
  point: Point
): Promise<{ log: GpsLog; gps: GPS }> {
  const hash = trackingId.toString() + '-' + point.startTimestamp.toString();

  if (gpsCache.has(hash)) {
    const data = gpsCache.get(hash);
    data!.timestamp = new Date().getTime() / 1000;
    return {
      gps: data!.gps,
      log: data!.log,
    };
  }

  // delete cache entries older than 1h
  const t = new Date().getTime() / 1000 - 60 * 60;
  for (let [key, value] of gpsCache) {
    if (value.timestamp < t) {
      gpsCache.delete(key);
    }
  }

  let log = await client.gpsLog.findFirst({
    where: {
      trackingId,
      started: new Date(point.startTimestamp * 1000),
    },
  });
  if (!log) {
    log = await client.gpsLog.create({
      data: {
        trackingId,
        distance: 0,
        started: new Date(point.startTimestamp * 1000),
        last: new Date(point.timestamp * 1000),
        active: true,
      },
    });
  }

  const gps = new GPS();

  const data = await redis.GET(pointRawKey(log));

  if (data) {
    const readable = new Readable();
    readable.push(data);
    const rl = readline.createInterface({
      input: readable,
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (line.length === 0) continue;
      const p = JSON.parse(line) as RawPoint;
      gps.process(point);
    }
  }

  gpsCache.set(hash, {
    gps,
    log,
    timestamp: new Date().getTime() / 1000,
  });
  return {
    gps,
    log,
  };
}

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.key) return;
    if (!message.value) return;

    const msg: RawPointMsg = JSON.parse(message.value.toString());

    logger.trace({ msg }, 'received');

    const point: Point = {
      lat: Number(msg.point.lat),
      lng: Number(msg.point.lon),
      accuracy: Number(msg.point.acc),
      alt: Number(msg.point.alt),
      provider: msg.point.prov,
      startTimestamp: Number(msg.point.starttimestamp),
      timestamp: Number(msg.point.timestamp),
    };

    let trackingId = 0;
    try {
      trackingId = await getTrackingId(client, msg.key);
    } catch (e) {
      logger.error({ error: e }, 'unable to get trackingId');
      return;
    }
    logger.trace({ trackingId }, 'trackingId');

    const { log, gps } = await getLog(trackingId, point);
    logger.trace({ log }, 'log');

    if (point.timestamp <= gps.lastTimestamp) {
      logger.trace(
        { point: point, lastTimestamp: gps.lastTimestamp },
        'timestamp already processed'
      );
      return;
    }

    const newPoint = gps.process(point);

    // insert raw point
    logger.trace({ trackingId, point }, 'insert raw point');
    await redis.APPEND(pointRawKey(log), JSON.stringify(msg.point) + '\n');

    if (newPoint) {
      // insert point
      logger.trace({ trackingId, point: newPoint }, 'insert calculated point');
      await redis.APPEND(pointJsonKey(log), JSON.stringify(newPoint) + '\n');
      const text = newPoint.timestamp + ',' + newPoint.lat + ',' + newPoint.lng;
      await redis.APPEND(pointTextKey(log), text + '\n');

      // update log
      await client.gpsLog.update({
        data: {
          distance: gps.distance,
          last: new Date(point.timestamp * 1000),
          active: true,
        },
        where: {
          id: log.id,
        },
      });

      // send
      const outMsg: PointMsg = {
        key: msg.key,
        point: newPoint,
      };
      await sendData(producer, config.outputTopic, {
        key: msg.key,
        value: JSON.stringify(outMsg),
      });
    }
  },
});
