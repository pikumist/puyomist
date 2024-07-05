import type { FileInfo } from '../../isomorphic/FileInfo';
import { screenshotReceived } from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';
import type { ScreenshotInfo } from './internal/ScreenshotInfo';
import { ScreenshotReceiver } from './internal/ScreenshotReceiver';
import { fileInfoToBlobUrl } from './internal/fileInfoToBlobUrl';

let screenshotInfo: ScreenshotInfo | undefined;
let appDispatch: AppDispatch;

/**
 * WebSocket経由でスクリーンショット画像を受け取ったらdispatchする。
 * localhostでのみ有効。
 */
export const dispatchWhenScreenshotReceivedViaWebSocket = (
  currentScreenshotInfo: ScreenshotInfo | undefined,
  dispatch: AppDispatch
) => {
  screenshotInfo = currentScreenshotInfo;
  appDispatch = dispatch;
};

if (window.location.hostname === 'localhost') {
  const receiver = new ScreenshotReceiver({
    onFileInfo: (fileInfo: FileInfo) => {
      const blobUrl = fileInfoToBlobUrl(fileInfo);
      const screenshotInfo = {
        ...fileInfo,
        blobUrl
      };
      appDispatch?.(screenshotReceived(screenshotInfo));
    }
  });
  receiver.start();
}
