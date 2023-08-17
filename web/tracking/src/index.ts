import http from 'http';
import { ArgumentConfig, parse } from 'ts-command-line-args';
import {
  KafkaConfig,
  FileConfig,
  KafkaConfigOpt,
  FileConfigOpt,
} from '@jinnytty-gps/config';
import { env2arg, initLogger, sendData } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import { AccessToken, PrismaClient } from '@jinnytty-gps/prisma';
import { RawPointMsg, Topics } from '@jinnytty-gps/message';
import { Kafka, Producer } from 'kafkajs';

function paramsToObject(entries: IterableIterator<[string, string]>): any {
  const result: any = {};
  for (const [key, value] of entries) {
    // each 'entry' is a [key, value] tupple
    result[key] = value;
  }
  return result;
}

interface ServiceConfig {
  port: number;
  outputTopic: string;
  maxTokenCacheTime: number;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  port: { type: Number, defaultValue: 3000 },
  outputTopic: { type: String, defaultValue: Topics.gpsTrackingOutput },
  maxTokenCacheTime: { type: Number, defaultValue: 60 },
};

interface Config extends ServiceConfig, KafkaConfig, FileConfig {}

const argConf: ArgumentConfig<Config> = {
  ...ServiceConfigOpt,
  ...KafkaConfigOpt,
  ...FileConfigOpt,
};

const args = env2arg<Config>(argConf);
const config: Config = parse<Config>(argConf, {
  loadFromFileArg: 'config',
  argv: [...args, ...process.argv.splice(2)],
});

const logger: Logger = initLogger('gps-tracking');

const kafka: Kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBroker,
});

const producer: Producer = kafka.producer();
await producer.connect();

const client = new PrismaClient();

interface TokenCache {
  token: AccessToken;
  timestamp: number;
}

const tokenCache: Map<string, TokenCache> = new Map();

async function checkToken(token?: string): Promise<string> {
  if (!token) return '';
  // clear token cache
  const t = new Date().getTime() / 1000 - config.maxTokenCacheTime;
  for (let [key, value] of tokenCache) {
    if (value.timestamp < t) {
      tokenCache.delete(key);
    }
  }

  const ct = tokenCache.get(token);
  if (ct) {
    if (ct.token.readonly) {
      return '';
    }
    return ct.token.key;
  }

  const dt = await client.accessToken.findFirst({
    where: {
      token,
    },
  });
  if (!dt) return '';
  tokenCache.set(token, {
    token: dt,
    timestamp: Math.floor(new Date().getTime() / 1000),
  });
  if (dt.readonly) return '';
  return dt.key;
}

http
  .createServer(async function (req, res) {
    try {
      const key = await checkToken(req.headers['authorization']);
      if (key.length === 0) {
        res.writeHead(401, { 'Content-Type': 'text/html' });
        res.end();
        return;
      }

      const url = new URL('http://localhost' + req.url);
      console.log(url);
      if (!url.searchParams.has('lat')) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end();
        return;
      }
      const obj = paramsToObject(url.searchParams.entries());
      const msg: RawPointMsg = {
        key,
        point: obj,
      };

      await sendData(producer, config.outputTopic, {
        key,
        value: JSON.stringify(msg),
      });
    } catch (e) {
      console.log('unable to handle request', req.url, e);
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end();
  })
  .listen(config.port);
