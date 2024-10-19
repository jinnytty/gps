import { ArgumentConfig, parse } from 'ts-command-line-args';
import { default as clearTracking } from './clear-tracking/index.js';
import { default as feed } from './feed/index.js';
import { default as wsDump } from './ws-dump/index.js';
import { default as createTracking } from './create-tracking/index.js';

interface CommandConfig {
  command: string;
}

const commandConfigOpt: ArgumentConfig<CommandConfig> = {
  command: { type: String, defaultOption: true },
};

const command: CommandConfig = parse<CommandConfig>(commandConfigOpt, {
  argv: process.argv.slice(2),
  stopAtFirstUnknown: true,
});

// @ts-ignore
const args: string[] = command._unknown ? command._unknown : [];

console.log('command', command);
console.log('args', args);
switch (command.command) {
  case 'clear-tracking':
    clearTracking(args);
    break;
  case 'feed':
    feed(args);
    break;
  case 'ws-dump':
    wsDump(args);
    break;
  case 'create-tracking':
    createTracking(args);
    break;
}
