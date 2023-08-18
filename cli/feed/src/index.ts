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
  accessTokenInUrl: boolean;
}

const ServiceConfigOpt: ArgumentConfig<ServiceConfig> = {
  url: { type: String },
  accessToken: { type: String },
  file: { type: String, multiple: true },
  wait: { type: Number, defaultValue: 0 },
  accessTokenInUrl: { type: Boolean, defaultValue: false },
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
    const param = new URLSearchParams();
    Object.keys(data).forEach((key) => {
      param.set(key, data[key]);
    });
    if (config.accessTokenInUrl) {
      param.set('accessToken', config.accessToken);
    }

    await fetch(config.url + '?' + param.toString(), {
      headers: !config.accessTokenInUrl
        ? {
            Authorization: config.accessToken,
          }
        : {},
    });
    if (config.wait > 0) {
      await sleep(config.wait);
    }
  }
}
