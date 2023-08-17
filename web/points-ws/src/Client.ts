import { initLogger, randomStr } from '@jinnytty-gps/utils';
import { Logger } from 'pino';
import { serializeError } from 'serialize-error';
import { RawData, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';
import {
  DistanceMessage,
  LogMessage,
  Message,
  MessageType,
  PointMessage,
  SubscribeMessage,
} from '@jinnytty-gps/api-model';
import { Point } from '@jinnytty-gps/model';
import { GpsLog } from '@jinnytty-gps/prisma';

const logger: Logger = initLogger('gps-points-server-client');

type ClientEvents = {
  close: () => void;
  subscribe: () => void;
};

export class Client extends (EventEmitter as new () => TypedEmitter<ClientEvents>) {
  private tracking: string = '';
  private id: string;
  private pingTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastLog: number = 0;
  private lastTimestamp: number = 0;

  constructor(private ws: WebSocket) {
    super();
    this.id = randomStr();
    ws.on('message', (data: RawData) => {
      try {
        const message: Message = JSON.parse(data.toString());
        logger.trace({ message, id: this.id }, 'message received');
        this.message(message);
      } catch (e: any) {
        logger.error(
          { id: this.id, error: serializeError(e) },
          'unable to parse message'
        );
        this.ws.close();
      }
    });
    ws.on('close', (code: number, reason: Buffer) => {
      if (this.pingTimeout !== null) {
        clearTimeout(this.pingTimeout);
      }
      this.emit('close');
    });

    this.setPingTimeout();
  }

  private setPingTimeout() {
    if (this.pingTimeout !== null) {
      clearTimeout(this.pingTimeout);
    }
    this.pingTimeout = setTimeout(() => {
      logger.error(
        { id: this.id, pingTimeout: this.pingTimeout },
        'ping timeout'
      );
      this.ws.close();
    }, 30000);
    logger.trace({ pingTimeout: this.pingTimeout }, 'setting ping timeout');
  }

  public async send(msg: Message) {
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.log('socket not open');
      this.ws.close();
      return;
    }
    return new Promise<void>((resolve, reject) => {
      this.ws.send(JSON.stringify(msg), (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private message(msg: Message) {
    switch (msg.type) {
      case MessageType.PING: {
        this.send({ type: MessageType.PONG });
        this.setPingTimeout();
        break;
      }
      case MessageType.SUBSCRIBE: {
        const m: SubscribeMessage = msg as any;
        this.tracking = m.name;
        this.lastLog = m.log;
        this.lastTimestamp = m.timestamp;
        this.emit('subscribe');
        break;
      }
    }
  }

  public async sendPoint(p: Point) {
    if (p.timestamp <= this.lastTimestamp) return;

    if (this.lastLog !== p.startTimestamp) {
      await this.sendLogData(p.startTimestamp);
    }

    this.lastTimestamp = p.timestamp;
    await this.send({
      type: MessageType.POINT,
      log: p.startTimestamp,
      point: {
        lat: p.lat,
        lng: p.lng,
        timestamp: p.timestamp,
      },
    } as PointMessage);
  }

  public async sendPointData(
    log: number,
    timestamp: number,
    lat: number,
    lng: number
  ) {
    if (timestamp <= this.lastTimestamp) return;

    this.lastTimestamp = timestamp;
    await this.send({
      type: MessageType.POINT,
      log: log,
      point: {
        lat: lat,
        lng: lng,
        timestamp: timestamp,
      },
    } as PointMessage);
  }

  public async sendLog(log: GpsLog) {
    const time = Math.floor(log.started.getTime() / 1000);
    if (time <= this.lastTimestamp) return;

    this.lastLog = time;
    this.lastTimestamp = time;
    await this.send({
      type: MessageType.LOG,
      log: time,
    } as LogMessage);
  }

  public async sendLogData(started: number) {
    if (started <= this.lastTimestamp) return;

    this.lastLog = started;
    this.lastTimestamp = started;
    await this.send({
      type: MessageType.LOG,
      log: started,
    } as LogMessage);
  }

  public async sendDistance(log: number, d: number) {
    return this.send({
      type: MessageType.DISTANCE,
      log,
      distance: d,
    } as DistanceMessage);
  }

  public close() {
    this.ws.close();
  }

  public getId(): string {
    return this.id;
  }

  public getTracking(): string {
    return this.tracking;
  }

  public getLastLog(): number {
    return this.lastLog;
  }

  public getLastTimestamp(): number {
    return this.lastTimestamp;
  }
}
