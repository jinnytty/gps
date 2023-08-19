import { ArgumentConfig, parse } from 'ts-command-line-args';
import { FileConfig, FileConfigOpt } from '@jinnytty-gps/config';
import { env2arg, initLogger, sleep } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { GpsClient } from '@jinnytty-gps/gps-client';
import {
  DistanceMessage,
  Log,
  Message,
  MessageType,
  Point,
  PointMessage,
} from '@jinnytty-gps/api-model';
import transport from '@jinnytty-gps/gps-client-node-transport';

interface ServiceConfig {
  apiEndpoint: string;
  wsEndpoint: string;
  accessToken: string;
  name: string;
  outputFolder: string;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  apiEndpoint: { type: String },
  wsEndpoint: { type: String },
  accessToken: { type: String },
  name: { type: String },
  outputFolder: { type: String },
};

interface Config extends ServiceConfig, FileConfig {}

const argConf: ArgumentConfig<Config> = {
  ...ServiceConfigOpt,
  ...FileConfigOpt,
};

const args = env2arg<Config>(argConf);
const config: Config = parse<Config>(argConf, {
  loadFromFileArg: 'config',
  argv: [...args, ...process.argv.splice(2)],
});

const logger: Logger = initLogger('gps-cli-ws-dump');

const client = new GpsClient({
  apiEndpoint: config.apiEndpoint,
  wsEndpoint: config.wsEndpoint,
  accessKey: config.accessToken,
  name: config.name,
  transport: transport(config.wsEndpoint, config.accessToken),
});

function logToFilename(started: number): string {
  const date = new Date(started * 1000);
  const time = date.toISOString().replaceAll(/:/g, '-');
  return time;
}

async function writeLog(l: Log): Promise<void> {
  await fs.promises.writeFile(
    path.join(
      config.outputFolder,
      config.name,
      logToFilename(l.started) + '-log.json'
    ),
    JSON.stringify(l)
  );
}

async function writePoints(l: Log, points: Point[]): Promise<void> {
  const data = points.map<string>((p) => JSON.stringify(p) + '\n');
  await fs.promises.writeFile(
    path.join(
      config.outputFolder,
      config.name,
      logToFilename(l.started) + '-points.jsonl'
    ),
    data
  );
}

let queueLock = true;
const queue: Message[] = [];
async function workQueue() {
  if (queueLock) return;
  queueLock = true;
  let msg: Message | undefined;
  while ((msg = queue.shift())) {
    if (msg.type === MessageType.POINT) {
      const m: PointMessage = msg as any;
      await fs.promises.appendFile(
        path.join(
          config.outputFolder,
          config.name,
          logToFilename(m.log) + '-points.jsonl'
        ),
        JSON.stringify(m.point) + '\n'
      );
    }
    if (msg.type === MessageType.DISTANCE) {
      const m: DistanceMessage = msg as any;
      if (client.tracking) {
        let d = 0;
        for (let i = 0; i < client.tracking.logs.length; ++i) {
          const l = client.tracking.logs[i];
          d += l.distance;
          if (l.started === m.log) {
            await writeLog(l);
          }
        }
        await fs.promises.writeFile(
          path.join(config.outputFolder, config.name, 'distance.txt'),
          d.toFixed(2).toString()
        );
      }
    }
  }
  queueLock = false;
}

client.addListener('message', (message: Message) => {
  queue.push(message);
  workQueue();
});

await client.init();
if (client.tracking === null) {
  throw new Error('could not get tracking');
}
await fs.promises.mkdir(path.join(config.outputFolder, config.name), {
  recursive: true,
});
for (let i = 0; i < client.tracking.logs.length; ++i) {
  const l = client.tracking.logs[i];
  await writeLog(l);
  const p = client.points.get(l.started);
  if (p) await writePoints(l, p);
}
let d = 0;
for (let i = 0; i < client.tracking.logs.length; ++i) {
  const l = client.tracking.logs[i];
  d += l.distance;
}
await fs.promises.writeFile(
  path.join(config.outputFolder, config.name, 'distance.txt'),
  d.toFixed(2).toString()
);
queueLock = false;
workQueue();
