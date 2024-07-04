import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { detectBoard } from '../logics/board-detection';
import { boardDetected } from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';
import styles from './ScreenshotCanvas.module.css';

interface ScreenshotCanvasProps {
  /** スクリーンショット画像の情報 */
  screenshotInfo:
    | {
        fileName: string;
        blobUrl: string;
      }
    | undefined;

  errorMessage: string | undefined;
}

const white1x1Png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=';

/** スクリーンショット画像を描画するキャンバス */
const ScreenshotCanvas: React.FC<ScreenshotCanvasProps> = (props) => {
  const { screenshotInfo, errorMessage } = props;
  const dispatch = useDispatch<AppDispatch>();

  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: onBoardDetectionを指定すると無限ループする
  useEffect(() => {
    const canvas = canvasRef.current;
    const blobURl = screenshotInfo?.blobUrl ?? white1x1Png;
    const img = new Image();

    if (blobURl !== white1x1Png) {
      img.onload = () => {
        const { naturalWidth: sw, naturalHeight: sh } = img;
        setNaturalWidth(sw);
        setNaturalHeight(sh);

        canvas!.width = sw;
        canvas!.height = sh;
        canvas!.style.width = `${Math.round(sw / 4)}px`;
        canvas!.style.height = `${Math.round(sh / 4)}px`;

        const ctx = canvas!.getContext('2d') as CanvasRenderingContext2D;
        const width = sw;
        const height = sh;

        ctx.drawImage(img, 0, 0, sw, sh, 0, 0, width, height);

        const errorOrBoard = detectBoard(ctx, width, height);

        if (typeof errorOrBoard === 'string') {
          dispatch(boardDetected({ error: errorOrBoard }));
        } else {
          dispatch(boardDetected({ board: errorOrBoard }));
        }
      };
    }

    img.src = blobURl;
  }, [screenshotInfo]);

  return (
    <div>
      <canvas className={styles.screenshot} ref={canvasRef} />
      <div>
        <div>{screenshotInfo?.fileName}</div>
        <div>
          ({naturalWidth}px, {naturalHeight}px)
        </div>
        <div>{errorMessage}</div>
      </div>
    </div>
  );
};

export default ScreenshotCanvas;
