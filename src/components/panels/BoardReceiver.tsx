import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Accept } from 'react-dropzone';

import type { ScreenshotInfo } from '@/hooks/internal/ScreenshotInfo';
import { cn } from '@/lib/utils';
import { parseBoardJson, parsePuyomistJson } from '@/logics/app-json';
import { parseBoardCsv } from '@/logics/board-csv';
import { detectBoard } from '@/logics/board-detection';
import {
  boardDetectedAndSolve,
  puyomistJsonDetectedAndSolve
} from '@/store/actions';
import { screenshotReceived } from '@/store/puyoAppStore';
import DropZone from './DropZone';

interface BoardReceiverProps {
  /** Max preview canvas width. */
  canvasMaxWidth: number;
  /** Current screenshot info. */
  screenshotInfo: ScreenshotInfo | undefined;
  /** Board-detection error message. */
  errorMessage: string | undefined;
  className?: string;
}

const white1x1Png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=';

const accept: Accept = {
  'image/*': ['.png', '.gif', '.jpeg', '.jpg'],
  'text/*': ['.csv'],
  'application/*': ['.json']
};

/**
 * Receives board data from a file (screenshot image, CSV, or JSON) and renders
 * a small preview for images.
 */
const BoardReceiver: React.FC<BoardReceiverProps> = (props) => {
  const { screenshotInfo, errorMessage, canvasMaxWidth, className } = props;

  const [naturalWidth, setNaturalWidth] = useState<number | undefined>();
  const [naturalHeight, setNaturalHeight] = useState<number | undefined>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) {
      return;
    }

    const fileType = file.type;

    if (fileType.startsWith('image/')) {
      const {
        webkitRelativePath: filePath,
        name: fileName,
        type: mime,
        size
      } = file;

      screenshotReceived({
        filePath,
        fileName,
        mime,
        size,
        blobUrl: URL.createObjectURL(file)
      });
    } else {
      switch (fileType) {
        case 'text/csv': {
          const errorOrBoard = parseBoardCsv(await file.text());
          if (typeof errorOrBoard === 'string') {
            boardDetectedAndSolve(errorOrBoard);
          } else {
            boardDetectedAndSolve(undefined, errorOrBoard);
          }
          break;
        }
        case 'application/json': {
          try {
            const text = await file.text();
            const json = JSON.parse(text);
            if (json.type === 'board') {
              const errorOrBoard = parseBoardJson(text);
              if (typeof errorOrBoard === 'string') {
                boardDetectedAndSolve(errorOrBoard);
              } else {
                boardDetectedAndSolve(undefined, errorOrBoard);
              }
            } else if (json.type === 'puyomist') {
              const errorOrPuyomist = parsePuyomistJson(text);
              if (typeof errorOrPuyomist === 'string') {
                boardDetectedAndSolve(errorOrPuyomist);
              } else {
                puyomistJsonDetectedAndSolve(errorOrPuyomist);
              }
            }
          } catch {
            boardDetectedAndSolve('JSONが不正');
          }
          break;
        }
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const blobUrl = screenshotInfo?.blobUrl ?? white1x1Png;
    const img = new Image();

    if (blobUrl !== white1x1Png) {
      img.onload = () => {
        const { naturalWidth: sw, naturalHeight: sh } = img;
        setNaturalWidth(sw);
        setNaturalHeight(sh);

        canvas!.width = sw;
        canvas!.height = sh;

        const ratio = canvasMaxWidth / sw;
        canvas!.style.width = `${Math.floor(sw * ratio)}px`;
        canvas!.style.height = `${Math.floor(sh * ratio)}px`;

        const ctx = canvas!.getContext('2d') as CanvasRenderingContext2D;
        ctx.drawImage(img, 0, 0, sw, sh, 0, 0, sw, sh);

        const errorOrBoard = detectBoard(ctx, sw, sh);
        if (typeof errorOrBoard === 'string') {
          boardDetectedAndSolve(errorOrBoard);
        } else {
          boardDetectedAndSolve(undefined, errorOrBoard);
        }
      };
    }

    img.src = blobUrl;
  }, [canvasMaxWidth, screenshotInfo]);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <DropZone accept={accept} onFileAccepted={handleFile} />

      <div className="text-center text-sm">
        <span className="mr-1">{screenshotInfo?.fileName}</span>
        {screenshotInfo ? (
          <span>
            ({naturalWidth}px, {naturalHeight}px)
          </span>
        ) : null}
        {errorMessage ? (
          <div className="text-destructive">{errorMessage}</div>
        ) : null}
      </div>

      <canvas
        hidden={!screenshotInfo}
        className="h-0 w-0 border border-border"
        ref={canvasRef}
      />
    </div>
  );
};

export default BoardReceiver;
