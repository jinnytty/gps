import * as crypto from 'crypto';
import { Message, Producer, TopicMessages } from 'kafkajs';
import { Logger } from 'pino';
import { initLogger } from './logger.js';

export * from './env2arg.js';
export * from './file.js';
export * from './logger.js';

export function randomStr(): string {
  return crypto.randomBytes(20).toString('hex');
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const logger: Logger = initLogger('twgifs-utils-send-kafka');

export async function sendData(
  producer: Producer,
  topic: string,
  msg: Message
): Promise<void> {
  const messages: TopicMessages[] = [];
  const topicMessage: TopicMessages = {
    topic,
    messages: [msg],
  };
  messages.push(topicMessage);
  logger.debug({ topic: topic, size: messages.length }, 'sending batch');
  await producer.sendBatch({ topicMessages: messages });
}
