import { ArgumentConfig, parse } from 'ts-command-line-args';
import {
  KafkaConfig,
  FileConfig,
  KafkaConfigOpt,
  FileConfigOpt,
} from '@jinnytty-gps/config';
import { env2arg, initLogger } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import { RawPointMsg, Topics } from '@jinnytty-gps/message';
import { Kafka, Consumer } from 'kafkajs';
import fs from 'fs';
import path from 'path';

interface ServiceConfig {
  inputTopic: string;
  outputPath: string;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  inputTopic: { type: String, defaultValue: Topics.gpsTrackingOutput },
  outputPath: { type: String },
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

const logger: Logger = initLogger('gps-raw-point-file-dump');

const kafka: Kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBroker,
});

const consumer: Consumer = kafka.consumer({ groupId: 'raw-point-file-dump' });
await consumer.connect();
await consumer.subscribe({ topic: config.inputTopic, fromBeginning: true });

interface OutCache {
  out: fs.WriteStream;
  timestamp: number;
}
const outCache: Map<string, OutCache> = new Map();

async function outStream(key: string, name: string): Promise<fs.WriteStream> {
  if (outCache.has(key + '-' + name)) {
    return outCache.get(key + '-' + name)!.out;
  }
  const outPath = path.join(config.outputPath, key);
  await fs.promises.mkdir(outPath, { recursive: true });

  const out = fs.createWriteStream(path.join(outPath, name + '.jsonl'), {
    flags: 'a',
  });
  outCache.set(key + '-' + name, {
    out,
    timestamp: new Date().getTime() / 1000,
  });

  // delete cache entries older than 1h
  const t = new Date().getTime() / 1000 - 60 * 60;
  for (let [key, value] of outCache) {
    if (value.timestamp < t) {
      outCache.delete(key);
    }
  }

  return out;
}

await consumer.run({
  eachMessage: async ({ message }) => {
    if (!message.key) return;
    if (!message.value) return;

    const msg: RawPointMsg = JSON.parse(message.value.toString());

    logger.trace({ msg }, 'received');
    try {
      const timestamp = parseInt(msg.point.starttimestamp);
      const date = new Date(timestamp * 1000);
      const name = date.toISOString().replaceAll(/:/g, '-');

      const out = await outStream(msg.key, name);
      out.write(JSON.stringify(msg.point) + '\n');
    } catch (e) {
      logger.error({ error: e }, 'unable to save to file');
    }
  },
});
