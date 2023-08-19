import {
  DistanceMessage,
  Log,
  LogMessage,
  Message,
  MessageType,
  Point,
  PointMessage,
  Tracking,
} from '@jinnytty-gps/api-model';
import { WebSocketClient } from './WebSocketClient.js';
import EventEmitter from 'events';
import TypedEventEmitter from 'typed-emitter';

export interface GpsClientConfig {
  apiEndpoint: string;
  wsEndpoint: string;
  name: string;
  accessKey: string;
}

export enum GpsClientStatus {
  NOT_READY,
  READY,
}

export type GpsClientEvents = {
  point: (p: Point, started: number) => void;
  log: (l: Log) => void;
  distance: (l: Log) => void;
};

export class GpsClient extends (EventEmitter as new () => TypedEventEmitter<GpsClientEvents>) {
  private status: GpsClientStatus = GpsClientStatus.NOT_READY;
  private ws: WebSocketClient;
  public tracking: Tracking | null = null;
  public points: Map<number, Point[]> = new Map();

  constructor(private config: GpsClientConfig) {
    super();
    console.log('gps client config', config);

    this.ws = new WebSocketClient({
      endpoint: config.wsEndpoint,
      accessKey: config.accessKey,
      name: config.name,
      listener: (msg: Message) => {
        this.onMessage(msg);
      },
    });
  }

  async init(): Promise<void> {
    const resp = await fetch(this.config.apiEndpoint + '/' + this.config.name, {
      headers: {
        authorization: this.config.accessKey,
      },
    });
    this.tracking = (await resp.json()) as Tracking;

    const sliceSize = 20;
    const logWait: Promise<void>[] = [];
    for (let i = 0; i < this.tracking.logs.length; i += sliceSize) {
      const logs = this.tracking.logs.slice(i, i + sliceSize);
      logWait.push(this.updateLogs(logs));
    }
    await Promise.all(logWait);

    let llog = 0;
    let ltime = 0;
    if (this.tracking.logs.length > 0) {
      llog = this.tracking.logs[this.tracking.logs.length - 1].started;
      console.log('llog', llog);
      const p = this.points.get(llog);
      console.log('p', p);
      if (p) {
        if (p.length > 0) {
          ltime = p[p.length - 1].timestamp;
        }
      }
    }
    await this.ws.open(llog, ltime);

    this.status = GpsClientStatus.READY;
  }

  private async updateLogs(logs: Log[]): Promise<void> {
    console.log('update logs', logs);
    const url = new URLSearchParams();
    logs.forEach((l) => url.append('started', l.started.toString()));
    console.log('searchparams', url.toString());
    const resp = await fetch(
      this.config.apiEndpoint +
        '/' +
        this.config.name +
        '/log?' +
        url.toString(),
      {
        headers: {
          authorization: this.config.accessKey,
        },
        mode: 'cors',
      }
    );
    console.log('response', resp);
    const data = await resp.text();

    let idx = -1;
    let currentPoints: Point[] | null = null;
    while (true) {
      const nextIdx = data.indexOf('\n', idx + 1);
      if (nextIdx === -1) break;
      const line = data.substring(idx + 1, nextIdx);
      idx = nextIdx;
      if (line.startsWith('#log')) {
        const started = Number(line.substring(5).trim());
        currentPoints = [];
        console.log('set points logs', started);
        this.points.set(started, currentPoints);
      } else {
        const parts = line.split(',');
        const p: Point = {
          timestamp: Number(parts[0]),
          lat: Number(parts[1]),
          lng: Number(parts[2]),
        };
        if (currentPoints) {
          currentPoints.push(p);
        }
      }
    }
  }

  private onMessage(msg: Message) {
    if (msg.type === MessageType.LOG) {
      const m: LogMessage = msg as any;
      this.points.set(m.log, []);
      if (this.tracking) {
        const l: Log = {
          started: m.log,
          last: 0,
          distance: 0,
        };
        this.tracking.logs.push(l);
        this.emit('log', l);
      }
    }
    if (msg.type === MessageType.POINT) {
      const m: PointMessage = msg as any;
      const p = this.points.get(m.log);
      if (p) {
        p.push(m.point);
        this.emit('point', m.point, m.log);
      }
    }
    if (msg.type === MessageType.DISTANCE) {
      const m: DistanceMessage = msg as any;
      if (this.tracking) {
        const l = this.tracking.logs.filter((v) => v.started === m.log);
        if (l.length > 0) {
          l[0].distance = m.distance;
          this.emit('distance', l[0]);
        }
      }
    }
  }
}
