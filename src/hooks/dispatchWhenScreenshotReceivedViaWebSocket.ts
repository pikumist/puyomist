import type { BoardMessage } from '../../isomorphic/BridgeMessage';
import type { FileInfo } from '../../isomorphic/FileInfo';
import { parseBoardCsv } from '../logics/board-csv';
import { boardDetectedAndSolve } from '../store/actions';
import { bridgePreviewReceived, screenshotReceived } from '../store/puyoAppStore';
import { bridgeImageToBlobUrl } from './internal/bridgeImageToBlobUrl';
import { fileInfoToBlobUrl } from './internal/fileInfoToBlobUrl';
import { ScreenshotReceiver } from './internal/ScreenshotReceiver';

/**
 * WebSocket経由でスクリーンショット画像・盤面を受け取ったらストアへ反映する。
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
    },
    onBoardMessage: (msg: BoardMessage) => {
      const errorOrBoard = parseBoardCsv(msg.csv);
      if (typeof errorOrBoard === 'string') {
        boardDetectedAndSolve(errorOrBoard);
        return;
      }
      errorOrBoard.isChanceMode = msg.mode === 'CHANCE';
      boardDetectedAndSolve(undefined, errorOrBoard);
      if (msg.image) {
        bridgePreviewReceived({
          fileName: 'bridge',
          filePath: '',
          mime: msg.image.mime,
          blobUrl: bridgeImageToBlobUrl(msg.image)
        });
      } else {
        // 画像なしの盤面が来たら、前の盤面のプレビューが残らないよう消す。
        bridgePreviewReceived(undefined);
      }
    }
  });
  receiver.start();
}
