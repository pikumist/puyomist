import type { FileInfo } from '../../isomorphic/FileInfo';
import { screenshotReceived } from '../store/puyoAppStore';
import { ScreenshotReceiver } from './internal/ScreenshotReceiver';
import { fileInfoToBlobUrl } from './internal/fileInfoToBlobUrl';

/**
 * WebSocket経由でスクリーンショット画像を受け取ったらストアへ反映する。
 * localhostでのみ有効。
 */
if (window.location.hostname === 'localhost') {
  const receiver = new ScreenshotReceiver({
    onFileInfo: (fileInfo: FileInfo) => {
      const blobUrl = fileInfoToBlobUrl(fileInfo);
      const screenshotInfo = {
        ...fileInfo,
        blobUrl
      };
      screenshotReceived(screenshotInfo);
    }
  });
  receiver.start();
}
