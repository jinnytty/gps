import WebSocketAsPromised from 'websocket-as-promised';
import { WebSocket } from 'ws';

export default function transport(
  endpoint: string,
  accessKey: string
): WebSocketAsPromised {
  return new WebSocketAsPromised(endpoint + '?key=' + accessKey, {
    packMessage: (data) => JSON.stringify(data),
    unpackMessage: (data) => JSON.parse(data.toString()),
    createWebSocket: (url) => new WebSocket(url),
    extractMessageData: (event) => event,
  });
}
