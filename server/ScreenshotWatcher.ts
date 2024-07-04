import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import chokidar from 'chokidar';
import type { FileInfo } from '../isomorphic/FileInfo';

/** 監視ハンドラー */
export interface WatchHandlers {
  /**
   * ファイル追加のコールバック
   * @param fileInfo
   */
  onFileAdd(fileInfo: FileInfo): void;
}

/** ファイル(スクリーンショット画像)の追加を監視するクラス */
export class ScreenShotWatcher {
  private static readonly WELLKNOWN_MIME_MAP: ReadonlyMap<string, string> =
    new Map<string, string>([
      ['.heic', 'image/heic'],
      ['.heif', 'image/heif'],
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.mov', 'video/quicktime'],
      ['.png', 'image/png']
    ]);
  private static readonly DEFAULT_MIME = 'application/octet-stream';

  private directoryToWatch: string;
  private handlers: WatchHandlers;
  private watcher: chokidar.FSWatcher | undefined;

  /**
   * @param directoryToWatch 監視ディレクトリ
   * @param handlers 各種監視ハンドラー
   */
  constructor(directoryToWatch: string, handlers: WatchHandlers) {
    this.directoryToWatch = directoryToWatch;
    this.handlers = handlers;
  }

  /** ディレクトリの監視を開始する。 */
  start() {
    this.watcher = chokidar.watch(this.directoryToWatch, {
      usePolling: true
    });

    this.watcher.on('ready', () => {
      this.onReady();
    });
  }

  /** ディレクトリの監視を終了する。 */
  stop() {
    this.watcher?.close();
    this.watcher = undefined;
  }

  private onReady() {
    const watcher = this.watcher!;

    watcher.on('add', (path, stats) => {
      console.log(`added ${path}`);
      this.onAdd(path, stats);
    });

    watcher.on('change', (path, stats) => {
      this.onChange(path, stats);
    });

    watcher.on('unlink', (path) => {
      this.onUnlink(path);
    });

    watcher.on('addDir', (path) => {
      this.onAddDir(path);
    });

    watcher.on('unlinkDir', (path) => {
      this.onUnlinkDir(path);
    });

    watcher.on('error', (error) => {
      this.onError(error);
    });
  }

  private async onAdd(path: string, stats?: import('fs').Stats | undefined) {
    const fileName = basename(path);
    const ext = extname(fileName).toLowerCase();
    const mime =
      ScreenShotWatcher.WELLKNOWN_MIME_MAP.get(ext) ??
      ScreenShotWatcher.DEFAULT_MIME;

    const contentAsBase64 = await readFile(path, 'base64');

    const fileInfo: FileInfo = {
      filePath: path,
      fileName,
      mime,
      contentAsBase64,
      size: stats?.size
    };

    this.handlers.onFileAdd(fileInfo);
  }

  private onChange(path: string, stats?: import('fs').Stats | undefined) {}

  private onUnlink(path: string) {}

  private onAddDir(path: string) {}

  private onUnlinkDir(path: string) {}

  private onError(error: Error) {
    console.log(`Watcher error: ${error}`);
  }
}
