import { PrismaClient } from '@jinnytty-gps/prisma';

import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaService {
  private client: PrismaClient;

  constructor() {
    this.client = new PrismaClient();
  }

  getClient(): PrismaClient {
    return this.client;
  }
}
