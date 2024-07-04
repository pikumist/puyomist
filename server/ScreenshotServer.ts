import { WebSocketServer } from 'ws';
import type { FileInfo } from '../isomorphic/FileInfo';
import { ScreenShotWatcher } from './ScreenshotWatcher';

export interface ScreenShotProviderOptions {
  port?: number;
}

/** 監視ディレクトリに追加されたファイルをクライアントにWebSockerで送るためのサーバー */
export class ScreenShotServer {
  private static readonly DEFAULT_PORT = 3000;

  private wsServer: WebSocketServer;
  private ssWatcher: ScreenShotWatcher;
  private connectedSockets: Set<import('ws').WebSocket>;

  /**
   * サーバーを立ち上げる。
   * @param directoryToWatch 監視ディレクトリ
   */
  constructor(
    directoryToWatch: string,
    options: ScreenShotProviderOptions = {}
  ) {
    this.ssWatcher = new ScreenShotWatcher(directoryToWatch, {
      onFileAdd: (fileInfo) => this.onFileAdd(fileInfo)
    });
    this.wsServer = new WebSocketServer({
      port: options.port ?? ScreenShotServer.DEFAULT_PORT
    });
    this.connectedSockets = new Set();

    this.wsServer.on('connection', (socket) => {
      this.connectedSockets.add(socket);

      console.log('Client connected');

      socket.on('close', () => {
        console.log('Client disconnected');

        this.connectedSockets.delete(socket);
      });
    });
  }

  /** 監視を開始する。 */
  startWatching() {
    this.ssWatcher.start();
  }

  /** 監視を終了する。 */
  stopWatching() {
    this.ssWatcher.stop();
  }

  /** サーバーを閉じる。接続されたソケットも全てクリアする。 */
  close() {
    this.stopWatching();
    this.wsServer.close();
    this.connectedSockets.clear();
  }

  private onFileAdd(fileInfo: FileInfo) {
    const json = JSON.stringify(fileInfo);

    for (const socket of this.connectedSockets) {
      socket.send(json);
    }
  }
}
