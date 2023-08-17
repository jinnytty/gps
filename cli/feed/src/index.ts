import { ArgumentConfig, parse } from 'ts-command-line-args';
import { FileConfig, FileConfigOpt } from '@jinnytty-gps/config';
import { env2arg, initLogger, sleep } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import fetch from 'node-fetch';
import fs from 'fs';
import readline from 'readline';

interface ServiceConfig {
  url: string;
  accessToken: string;
  file: string[];
  wait: number;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  url: { type: String },
  accessToken: { type: String },
  file: { type: String, multiple: true },
  wait: { type: Number, defaultValue: 0 },
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

const logger: Logger = initLogger('gps-cli-feed');

for (let i = 0; i < config.file.length; ++i) {
  const fileStream = fs.createReadStream(config.file[i]);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.length === 0) continue;
    const data = JSON.parse(line);
    const q = Object.keys(data)
      .map((key) => {
        return `${key}=${data[key]}`;
      })
      .join('&');

    await fetch(config.url + '?' + q, {
      headers: {
        Authorization: config.accessToken,
      },
    });
    if (config.wait > 0) {
      await sleep(config.wait);
    }
  }
}
