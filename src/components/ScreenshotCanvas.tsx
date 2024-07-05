import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import { detectBoard } from '../logics/board-detection';
import {
  boardDetectedAndSolve,
  screenshotReceived
} from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';
import styles from './ScreenshotCanvas.module.css';

interface ScreenshotCanvasProps {
  /** スクリーンショット画像の情報 */
  screenshotInfo: ScreenshotInfo | undefined;

  /** 盤面判定失敗時のエラーメッセージ */
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
  const [isDragOver, setIsDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) {
        return;
      }

      const file = files[0];
      if (!file || file.type.indexOf('image/') < 0) {
        return;
      }

      const {
        webkitRelativePath: filePath,
        name: fileName,
        type: mime,
        size
      } = file;

      const screenshotInfo: ScreenshotInfo = {
        filePath,
        fileName,
        mime,
        size,
        blobUrl: URL.createObjectURL(file)
      };

      dispatch(screenshotReceived(screenshotInfo));
    },
    [dispatch]
  );

  const onInputChanged = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    },
    [handleFiles]
  );

  const onCanvasClicked = useCallback(() => {
    const input = inputRef.current!;
    input.click();
  }, []);

  const onCanvasDragOver = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOver(true);
    },
    []
  );

  const onCanvasDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onCanvasDrop = useCallback(
    (e: React.DragEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const conditionalDragOverClass = isDragOver ? styles.dragover : '';

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
          dispatch(boardDetectedAndSolve(errorOrBoard));
        } else {
          dispatch(boardDetectedAndSolve(undefined, errorOrBoard));
        }
      };
    }

    img.src = blobURl;
  }, [screenshotInfo, dispatch]);

  return (
    <div>
      <div>
        <input
          ref={inputRef}
          id="fileInput"
          type="file"
          accept="image/*"
          onChange={onInputChanged}
        />
      </div>
      <canvas
        className={`${styles.screenshot} ${conditionalDragOverClass}`}
        ref={canvasRef}
        onClick={onCanvasClicked}
        onKeyDown={onCanvasClicked}
        onDragOver={onCanvasDragOver}
        onDragLeave={onCanvasDragLeave}
        onDrop={onCanvasDrop}
      />
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
