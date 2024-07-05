import type { FileInfo } from '../../isomorphic/FileInfo';
import { screenshotReceived } from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';
import { ScreenshotReceiver } from './internal/ScreenshotReceiver';
import { fileInfoToBlobUrl } from './internal/fileInfoToBlobUrl';

let appDispatch: AppDispatch;

/**
 * WebSocket経由でスクリーンショット画像を受け取ったらdispatchする。
 * localhostでのみ有効。
 */
export const dispatchWhenScreenshotReceivedViaWebSocket = (
  dispatch: AppDispatch
) => {
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
