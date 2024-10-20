import {
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import {
  Log,
  LogPoints,
  MapDisplayConfig,
  Tracking,
} from '@jinnytty-gps/api-model';
import { AccessToken } from '../AccessToken.js';
import { MapConfig, logToApi, trackingToApi } from '@jinnytty-gps/prisma';
import type { Request, Response } from 'express';
import { RedisService } from '../common/redis.service.js';
import { pointTextKey } from '@jinnytty-gps/redis';

interface LogQuery {
  started: null | string | string[];
}

@Controller()
export default class GpsController {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async checkToken(id: string, accessToken: string): Promise<void> {
    const token = await this.prisma.getClient().accessToken.findFirst({
      where: {
        token: accessToken,
        key: id,
      },
    });
    console.log('token', id, accessToken, token);
    if (!token) {
      throw new ForbiddenException();
    }
  }

  @Get('/config/:id')
  async mapConfig(@Param('id') id: string): Promise<MapDisplayConfig> {
    const config = await this.prisma.getClient().mapConfig.findFirst({
      where: {
        name: id,
      },
    });
    if (!config) {
      throw new NotFoundException();
    }
    return config.data as any;
  }

  @Get('/:id')
  async tracking(
    @Param('id') id: string,
    @AccessToken() accessToken: string
  ): Promise<Tracking> {
    await this.checkToken(id, accessToken);

    const dbTracking = await this.prisma.getClient().gpsTracking.findFirst({
      where: {
        key: id,
      },
    });
    if (!dbTracking) {
      throw new NotFoundException();
    }

    const dbLogs = await this.prisma.getClient().gpsLog.findMany({
      where: {
        trackingId: dbTracking.id,
      },
      orderBy: {
        started: 'asc',
      },
    });

    const tracking = trackingToApi(dbTracking, dbLogs);
    return tracking;
  }

  @Get('/:id/log')
  async logs(
    @Param('id') id: string,
    @AccessToken() accessToken: string,
    @Query() query: LogQuery,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    await this.checkToken(id, accessToken);

    const dbTracking = await this.prisma.getClient().gpsTracking.findFirst({
      where: {
        key: id,
      },
    });
    if (!dbTracking) {
      throw new NotFoundException();
    }

    const ids: number[] = [];
    if (query.started) {
      if (Array.isArray(query.started)) {
        (query.started as string[]).forEach((i) => ids.push(Number(i)));
      } else {
        ids.push(Number(query.started));
      }
    }

    const dates = ids.map((id) => new Date(id * 1000));
    console.log(ids);
    console.log(dates);

    const dbLogs = await this.prisma.getClient().gpsLog.findMany({
      where: {
        trackingId: dbTracking.id,
        started: {
          in: dates,
        },
      },
      orderBy: {
        started: 'asc',
      },
    });
    console.log('logs', dbLogs);

    let last = 0;
    dbLogs.forEach((l) => {
      const t = l.last.getTime();
      if (t > last) {
        last = t;
      }
    });
    console.log('oldest time', last);

    if (req.header('ETag') === last.toString()) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }
    res.header('ETag', last.toString());

    const redis = await this.redis.getClient();
    let data = '';
    for (let i = 0; i < dbLogs.length; ++i) {
      data += `#log ${Math.floor(dbLogs[i].started.getTime() / 1000)}\n`;
      const points = await redis.GET(pointTextKey(dbLogs[i]));
      if (points) {
        data += points;
      }
    }
    console.log('data', data.length);

    res.send(data);
    res.end();
  }
}
