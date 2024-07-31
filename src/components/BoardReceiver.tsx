import { Box, Stack, type StackProps, Text } from '@chakra-ui/react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Accept } from 'react-dropzone';
import { useDispatch } from 'react-redux';
import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import { parseBoardCsv } from '../logics/board-csv';
import { detectBoard } from '../logics/board-detection';
import { parseBoardJson } from '../logics/board-json';
import {
  boardDetectedAndSolve,
  screenshotReceived
} from '../reducers/puyoAppSlice';
import type { AppDispatch } from '../reducers/store';
import styles from './BoardReceiver.module.css';
import DropZone from './settings/DropZone';

interface BoardReceiverProps extends StackProps {
  /** キャンバスの最大幅 */
  canvasMaxWidth: number;

  /** スクリーンショット画像の情報 */
  screenshotInfo: ScreenshotInfo | undefined;

  /** 盤面判定失敗時のエラーメッセージ */
  errorMessage: string | undefined;
}

const white1x1Png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAA1JREFUGFdj+P///38ACfsD/QVDRcoAAAAASUVORK5CYII=';

const accept: Accept = {
  'image/*': ['.png', '.gif', '.jpeg', '.jpg'],
  'text/*': ['.csv'],
  'application/*': ['.json']
};

/**
 * ファイルからボード情報を受け取る。
 * 受け取り可能なファイルはスクリーンショット画像かCSV。
 * 画像であればさらにプレビュー画像を描画する。
 */
const BoardReceiver: React.FC<BoardReceiverProps> = (props) => {
  const { screenshotInfo, errorMessage, canvasMaxWidth, ...rest } = props;
  const dispatch = useDispatch<AppDispatch>();

  const [naturalWidth, setNaturalWidth] = useState(
    undefined as number | undefined
  );
  const [naturalHeight, setNaturalHeight] = useState(
    undefined as number | undefined
  );
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFile = useCallback(
    async (file: File | null) => {
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

        const screenshotInfo: ScreenshotInfo = {
          filePath,
          fileName,
          mime,
          size,
          blobUrl: URL.createObjectURL(file)
        };

        dispatch(screenshotReceived(screenshotInfo));
      } else {
        switch (fileType) {
          case 'text/csv': {
            const errorOrBoard = parseBoardCsv(await file.text());
            if (typeof errorOrBoard === 'string') {
              dispatch(boardDetectedAndSolve(errorOrBoard));
            } else {
              dispatch(boardDetectedAndSolve(undefined, errorOrBoard));
            }
            break;
          }
          case 'application/json': {
            const errorOrBoard = parseBoardJson(await file.text());
            if (typeof errorOrBoard === 'string') {
              dispatch(boardDetectedAndSolve(errorOrBoard));
            } else {
              dispatch(boardDetectedAndSolve(undefined, errorOrBoard));
            }
            break;
          }
        }
      }
    },
    [dispatch]
  );

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

        const ratio = canvasMaxWidth / sw;

        canvas!.style.width = `${Math.floor(sw * ratio)}px`;
        canvas!.style.height = `${Math.floor(sh * ratio)}px`;

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
  }, [canvasMaxWidth, screenshotInfo, dispatch]);

  return (
    <Stack align="center" {...rest}>
      <DropZone accept={accept} onFileAccepted={handleFile} />

      <Box>
        <Text>
          <Text as="span" mr="1">
            {screenshotInfo?.fileName}
          </Text>
          {screenshotInfo ? (
            <Text as="span">
              ({naturalWidth}px, {naturalHeight}px)
            </Text>
          ) : null}
        </Text>
        <Text color="red.400">{errorMessage}</Text>
      </Box>

      <canvas
        hidden={!screenshotInfo}
        className={styles.screenshot}
        ref={canvasRef}
      />
    </Stack>
  );
};

export default BoardReceiver;
