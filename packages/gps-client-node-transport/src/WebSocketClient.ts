import WebSocketAsPromised from 'websocket-as-promised';
import {
  LogMessage,
  Message,
  MessageType,
  PointMessage,
  SubscribeMessage,
} from '@jinnytty-gps/api-model';
import Options from 'websocket-as-promised/types/options';

export interface WebSocketClientConfig {
  endpoint: string;
  accessKey: string;
  name: string;
  listener: (msg: Message) => void;
  transport?: WebSocketAsPromised;
}

export class WebSocketClient {
  private ws: WebSocketAsPromised;
  private log: number = 0;
  private timestamp: number = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private config: WebSocketClientConfig) {
    if (config.transport) {
      this.ws = config.transport;
    } else {
      let c: Options = {
        packMessage: (data) => JSON.stringify(data),
        unpackMessage: (data) => JSON.parse(data.toString()),
      };
      /*if (!isBrowser()) {
      c = {
        ...c,
        createWebSocket: (url) => new WebSocket(url),
        extractMessageData: (event) => event,
      };
    }*/
      console.log('ws config', c);
      this.ws = new WebSocketAsPromised(
        this.config.endpoint + '?key=' + this.config.accessKey,
        c
      );
    }
    this.initListeners();
  }

  private initListeners() {
    this.ws.onUnpackedMessage.addListener((msg: Message) => {
      if (msg.type === MessageType.POINT) {
        this.timestamp = (msg as any as PointMessage).point.timestamp;
        console.log('point message', msg);
      }
      if (msg.type === MessageType.LOG) {
        this.log = (msg as any as LogMessage).log;
        console.log('log message', msg);
        this.timestamp = 0;
      }
      if (msg.type === MessageType.PONG) {
        console.log('pong message', msg);
        if (this.pingTimeout) {
          clearTimeout(this.pingTimeout);
          this.pingTimeout = null;
        }
      }
      this.config.listener(msg);
    });
    this.ws.onError.addListener((e: any) => {
      console.log('error', e);
      this.ws.close();
    });
    this.ws.onClose.addListener(() => {
      console.log('websocket closed');
      if (this.pingInterval !== null) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      if (this.pingTimeout !== null) {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = null;
      }
      setTimeout(() => {
        this.open(this.log, this.timestamp);
      }, 2000);
    });
  }

  public async open(log: number, timestamp: number) {
    console.log('open websocket', log, timestamp);
    this.log = log;
    this.timestamp = timestamp;
    await this.ws.open();

    // @ts-ignore
    this.pingInterval = setInterval(() => {
      this.ws.sendPacked({
        type: MessageType.PING,
      });
      if (this.pingTimeout !== null) {
        clearTimeout(this.pingTimeout);
      }
      this.pingTimeout = setTimeout(() => {
        console.log('pong timewout');
        this.ws.close();
      }, 1000);
    }, 3000);

    this.ws.sendPacked({
      type: MessageType.SUBSCRIBE,
      name: this.config.name,
      log,
      timestamp,
    } as SubscribeMessage);
  }
}
