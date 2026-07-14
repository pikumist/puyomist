import type {
  BoardMessage,
  BridgeMessage
} from '../../../isomorphic/BridgeMessage';
import type { FileInfo } from '../../../isomorphic/FileInfo';

interface ReceiveHandlers {
  onFileInfo(fileInfo: FileInfo): void;
  onBoardMessage(msg: BoardMessage): void;
}

/** 再接続までの待機時間(ms) */
const RECONNECT_DELAY_MS = 2000;

/** WebSocketを使ったスクリーンショットのレシーバー */
export class ScreenshotReceiver {
  private socket?: WebSocket;
  private handlers: ReceiveHandlers;
  private wsEndpointUrl: string;
  private reconnectTimerId?: ReturnType<typeof setTimeout>;
  private stopped = false;

  constructor(
    handlers: ReceiveHandlers,
    wsEndpointUrl = 'ws://localhost:3000'
  ) {
    this.handlers = handlers;
    this.wsEndpointUrl = wsEndpointUrl;
  }

  /** ファイル通知受け取りを開始する。 */
  start() {
    this.stopped = false;

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
    this.stopped = true;
    if (this.reconnectTimerId !== undefined) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = undefined;
    }
    this.socket?.close();
    this.socket = undefined;
  }

  private onSockeOpen() {
    console.log('Connection opened');
  }

  private onSocketClose() {
    console.log('Connection closed');

    if (this.stopped) {
      return;
    }

    // 意図的な停止でない限り、自動再接続を試みる
    this.reconnectTimerId = setTimeout(() => {
      this.reconnectTimerId = undefined;
      this.start();
    }, RECONNECT_DELAY_MS);
  }

  private onFileInfoMessage(ev: MessageEvent<string>) {
    const data = JSON.parse(ev.data) as BridgeMessage | FileInfo;

    if ((data as BridgeMessage).type === 'board') {
      this.handlers.onBoardMessage(data as BoardMessage);
      return;
    }

    this.handlers.onFileInfo(data as FileInfo);
  }
}
