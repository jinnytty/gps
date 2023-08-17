import { PrismaClient } from '@jinnytty-gps/prisma';

import { Injectable } from '@nestjs/common';
import { RedisClient, redisClient } from '@jinnytty-gps/redis';
import { RedisConfig } from '@jinnytty-gps/config';

@Injectable()
export class RedisService {
  constructor() {}

  async getClient(): Promise<RedisClient> {
    const url = process.env['REDIS_URL'];
    if (!url) {
      throw new Error('redis url not set');
    }
    const config: RedisConfig = {
      redisUrl: url,
    };
    return await redisClient(config);
  }
}
