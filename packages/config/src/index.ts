import type { ArgumentConfig } from 'ts-command-line-args';

export interface KafkaConfig {
  kafkaClientId: string;
  kafkaBroker: string[];
}

export const KafkaConfigOpt: ArgumentConfig<KafkaConfig> = {
  kafkaClientId: {
    type: String,
    defaultValue: 'gps-tracker',
  },
  kafkaBroker: {
    type: String,
    multiple: true,
  },
};

export interface RedisConfig {
  redisUrl: string;
}

export const RedisConfigOpt: ArgumentConfig<RedisConfig> = {
  redisUrl: { type: String, defaultValue: 'redis://localhost:6379' },
};

export interface FileConfig {
  config?: string;
}

export const FileConfigOpt: ArgumentConfig<FileConfig> = {
  config: { type: String, optional: true },
};
