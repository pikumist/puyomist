import type { FileInfo } from '../../../isomorphic/FileInfo';

interface ReceiveHandlers {
  onFileInfo(fileInfo: FileInfo): void;
}

/** WebSocketを使ったスクリーンショットのレシーバー */
export class ScreenshotReceiver {
  private socket?: WebSocket;
  private handlers: ReceiveHandlers;
  private wsEndpointUrl: string;

  constructor(
    handlers: ReceiveHandlers,
    wsEndpointUrl = 'ws://localhost:3000'
  ) {
    this.handlers = handlers;
    this.wsEndpointUrl = wsEndpointUrl;
  }

  /** ファイル通知受け取りを開始する。 */
  start() {
    this.socket = new WebSocket(this.wsEndpointUrl);

    this.socket.onopen = () => {
      this.onSockeOpen();
    };

    this.socket.onmessage = (ev) => {
      this.onFileInfoMessage(ev);
    };

    this.socket.onclose = () => {
      this.onSocketClose();
    };
  }

  /** ファイル通知受け取りを終了する。 */
  stop() {
    this.socket?.close();
    this.socket = undefined;
  }

  private onSockeOpen() {
    console.log('Connection opened');
  }

  private onSocketClose() {
    console.log('Connection closed');
  }

  private onFileInfoMessage(ev: MessageEvent<string>) {
    const fileInfo = JSON.parse(ev.data) as FileInfo;
    this.handlers.onFileInfo(fileInfo);
  }
}
