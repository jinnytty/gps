import { ArgumentConfig, parse } from 'ts-command-line-args';
import {
  KafkaConfig,
  FileConfig,
  KafkaConfigOpt,
  FileConfigOpt,
  RedisConfig,
  RedisConfigOpt,
} from '@jinnytty-gps/config';
import { env2arg, initLogger, sendData } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import { AccessToken, PrismaClient } from '@jinnytty-gps/prisma';
import { PointMsg, Topics } from '@jinnytty-gps/message';
import { Consumer, Kafka, Partitioners, Producer } from 'kafkajs';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { Client } from './Client.js';
import { Message } from '@jinnytty-gps/api-model';
import { RedisClient, getTextPoints, redisClient } from '@jinnytty-gps/redis';
import { Point } from '@jinnytty-gps/model';

interface ServiceConfig {
  name: string;
  port: number;
  inputTopic: string;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  name: { type: String },
  port: { type: Number, defaultValue: 3000 },
  inputTopic: { type: String, defaultValue: Topics.gpsFilterOutput },
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

const logger: Logger = initLogger('gps-points-server');

const kafka: Kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBroker,
});

const redis = await redisClient(config);
const client = new PrismaClient();

const consumer: Consumer = kafka.consumer({
  groupId: 'points-ws-' + config.name,
});
await consumer.connect();
await consumer.subscribe({ topic: config.inputTopic });

const wss = new WebSocketServer({ port: config.port });

const clients: Client[] = [];
const clientsPerTracking: Map<string, Client[]> = new Map();
const trackingInit: Map<string, InitClient[]> = new Map();

class InitClient {
  private queue: Point[] = [];

  constructor(private client: Client) {}

  public getClient(): Client {
    return this.client;
  }

  public queuePoint(p: Point) {
    this.queue.push(p);
  }
  public async init() {
    const tracking = await client.gpsTracking.findFirst({
      where: {
        key: this.client.getTracking(),
      },
    });
    if (!tracking) {
      logger.error(
        { id: this.client.getId(), tracking: this.client.getTracking() },
        'tracking not found'
      );
      this.client.close();
      return;
    }
    const logs = await client.gpsLog.findMany({
      where: {
        trackingId: tracking.id,
        started: {
          gte: new Date(this.client.getLastLog() * 1000),
        },
      },
      orderBy: {
        started: 'asc',
      },
    });

    for (let i = 0; i < logs.length; ++i) {
      const l = logs[i];
      const time = Math.floor(l.started.getTime() / 1000);
      if (time < this.client.getLastTimestamp()) {
        await this.client.sendLog(l);
      }
      const points = await getTextPoints(l);
      const lines = points.split('\n');
      for (let ii = 0; ii < lines.length; ++ii) {
        const parts = lines[ii].split(',');
        if (parts.length !== 3) continue;
        try {
          const pt = Number(parts[0]);
          const lat = Number(parts[1]);
          const lng = Number(parts[2]);
          await this.client.sendPointData(time, pt, lat, lng);
        } catch (e) {}
      }
    }

    for (let i = 0; i < this.queue.length; ++i) {
      await this.client.sendPoint(this.queue[i]);
    }
    const a = trackingInit.get(this.client.getTracking());
    if (a) {
      a.splice(a.indexOf(this), 1);
    }
    let b = clientsPerTracking.get(this.client.getTracking());
    if (!b) {
      b = [];
      clientsPerTracking.set(this.client.getTracking(), b);
    }
    b.push(this.client);
  }
}

wss.on('connection', function connection(ws: WebSocket) {
  logger.debug({ url: ws.url }, 'client connected');

  const url = ws.url;

  ws.on('error', (error: Error) => {
    logger.error({ error }, 'socket error');
    ws.close();
  });

  const c = new Client(ws);
  c.on('close', () => {
    const idx = clients.indexOf(c);
    if (idx > -1) {
      clients.splice(idx, 1);
    }
    const init = trackingInit.get(c.getTracking());
    if (init) {
      for (let i = 0; i < init.length; ++i) {
        if (init[i].getClient() === c) {
          init.splice(i, 1);
          break;
        }
      }
    }

    const cpt = clientsPerTracking.get(c.getTracking());
    if (cpt) {
      const idx = cpt.indexOf(c);
      if (idx > -1) {
        cpt.splice(idx, 1);
      }
    }
  });
  c.on('subscribe', () => {
    let inits = trackingInit.get(c.getTracking());
    if (!inits) {
      inits = [];
      trackingInit.set(c.getTracking(), inits);
    }
    const ic = new InitClient(c);
    inits.push(ic);
    ic.init();
  });
});

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.key) return;
    if (!message.value) return;

    const trackingId = message.key.toString();
    const msg: PointMsg = JSON.parse(message.value.toString());
    const cl = clientsPerTracking.get(trackingId);
    if (cl) {
      cl.forEach((c) => {
        c.sendPoint(msg.point);
      });
    }
    const ci = trackingInit.get(trackingId);
    if (ci) {
      ci.forEach((c) => c.queuePoint(msg.point));
    }
  },
});
