import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { HowToEditBoard } from '../logics/BoardEditMode';
import { PuyoCoord } from '../logics/PuyoCoord';
import { screenshotBoardId } from '../logics/boards';
import {
  PuyoAttribute,
  getPuyoAttribute,
  getPuyoRgb,
  isChancePuyo,
  isPlusPuyo
} from '../logics/puyo';
import {
  puyoEdited,
  tracingCanceled,
  tracingCoordAdded,
  tracingFinished
} from '../reducers/puyoAppSlice';
import type { AppDispatch, RootState } from '../reducers/store';
import styles from './PuyoCanvas.module.css';

export interface PuyoCanvasProps {
  /** キャンバスの幅 */
  width: number;

  /** キャンバスの高さ */
  height: number;
}

/** ぷよフィールドを描画するキャンバス */
const Canvas: React.FC<PuyoCanvasProps> = (props) => {
  const { width, height } = props;
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const dispatch = useDispatch<AppDispatch>();
  const { boardId, boardEditMode, simulator, animating, solvedResult } = state;
  const optimalTraceCoords = solvedResult?.optimalSolution?.traceCoords;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [touching, setTouching] = useState(false);
  const isEdit = Boolean(
    boardEditMode && boardEditMode.howToEdit !== HowToEditBoard.None
  );
  const editable = boardId === screenshotBoardId;
  const cellUnitPixels = width / PuyoCoord.XNum;

  const getContext = useCallback((): CanvasRenderingContext2D => {
    const canvas = canvasRef.current;
    return canvas!.getContext('2d') as CanvasRenderingContext2D;
  }, []);

  const detectHitInNext = useCallback(
    (px: number, py: number) => {
      const rawXi = px / cellUnitPixels;
      const rawYi = (py / cellUnitPixels) * 2;
      const xi = Math.floor(rawXi);
      const yi = Math.floor(rawYi);

      if (yi === 0 && xi >= 0 && xi < PuyoCoord.XNum) {
        return xi;
      }
      return null;
    },
    [cellUnitPixels]
  );

  const detectHitInField = useCallback(
    (px: number, py: number) => {
      const rawXi = px / cellUnitPixels;
      const rawYi = (py - cellUnitPixels / 2) / cellUnitPixels;
      const xi = Math.floor(rawXi);
      const yi = Math.floor(rawYi);
      const diffCenterX = Math.abs(rawXi - xi - 0.5);
      const diffCenterY = Math.abs(rawYi - yi - 0.5);

      if (PuyoCoord.isValidXy(xi, yi)) {
        if (diffCenterX > 0.3 || diffCenterY > 0.3) {
          return null;
        }
        return PuyoCoord.xyToCoord(xi, yi);
      }
      return null;
    },
    [cellUnitPixels]
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) {
      return;
    }

    if (animating) {
      return;
    }

    if (isEdit) {
      if (editable) {
        const canvas = canvasRef.current;
        const rect = canvas!.getBoundingClientRect();
        const px = ~~(e.clientX - rect.left);
        const py = ~~(e.clientY - rect.top);

        const coord = detectHitInField(px, py);
        if (coord) {
          dispatch(puyoEdited({ fieldCoord: coord }));
        } else {
          const nextX = detectHitInNext(px, py) ?? undefined;
          if (Number.isInteger(nextX)) {
            dispatch(puyoEdited({ nextX }));
          }
        }
      }
    } else {
      if (!touching) {
        setTouching(true);
      }

      const canvas = canvasRef.current;
      const rect = canvas!.getBoundingClientRect();
      const px = ~~(e.clientX - rect.left);
      const py = ~~(e.clientY - rect.top);

      const coord = detectHitInField(px, py);
      if (coord) {
        dispatch(tracingCoordAdded(coord));
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1) {
      return;
    }
    if (animating) {
      return;
    }
    if (isEdit) {
      return;
    }

    const canvas = canvasRef.current;
    const rect = canvas!.getBoundingClientRect();
    const px = ~~(e.clientX - rect.left);
    const py = ~~(e.clientY - rect.top);

    const coord = detectHitInField(px, py);
    if (coord) {
      dispatch(tracingCoordAdded(coord));
    }
  };

  const onPointerOut = () => {
    if (animating) {
      return;
    }
    if (isEdit) {
      return;
    }

    if (touching) {
      setTouching(false);
      dispatch(tracingCanceled());
    }
  };

  const DrawGrid = useCallback(() => {
    const ctx = getContext();
    const strokeStyle = '#eee';
    const lineWidth = 1;

    // Y軸グリッド線
    for (let xi = 1; xi < PuyoCoord.XNum; xi++) {
      ctx.beginPath();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      const px = xi * cellUnitPixels;
      ctx.moveTo(px, 0.5);
      ctx.lineTo(px, cellUnitPixels * (PuyoCoord.YNum + 0.5) - 0.5);
      ctx.stroke();
    }

    // X軸ネクストぷよグリッド線
    ctx.beginPath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    const py = cellUnitPixels / 2;
    ctx.moveTo(0.5, py);
    ctx.lineTo(cellUnitPixels * PuyoCoord.XNum - 0.5, py);
    ctx.stroke();

    // X軸グリッド線
    for (let yi = 1; yi < PuyoCoord.YNum; yi++) {
      ctx.beginPath();
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      const py = (yi + 0.5) * cellUnitPixels;
      ctx.moveTo(0.5, py);
      ctx.lineTo(cellUnitPixels * PuyoCoord.XNum - 0.5, py);
      ctx.stroke();
    }
  }, [getContext, cellUnitPixels]);

  const DrawBoostAreas = useCallback(() => {
    const ctx = getContext();
    ctx.setLineDash([8, 2]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';

    for (const boostArea of simulator.getBoostAreaCoordSetList()) {
      for (const coord of boostArea) {
        ctx.strokeRect(
          Math.round(coord.x * cellUnitPixels) + 5,
          Math.round((coord.y + 0.5) * cellUnitPixels) + 5,
          Math.round(cellUnitPixels) - 10,
          Math.round(cellUnitPixels) - 10
        );
      }
    }

    ctx.setLineDash([]);
  }, [getContext, cellUnitPixels, simulator]);

  const DrawScene = () => {
    const ctx = getContext();

    ctx.clearRect(0, 0, width, height);

    DrawGrid();
    DrawBoostAreas();

    const nextPuyos = simulator.getNextPuyos();
    for (const [x, puyoType] of nextPuyos.entries()) {
      if (!puyoType) {
        continue;
      }

      ctx.fillStyle = getPuyoRgb(puyoType);
      ctx.fillRect(
        x * cellUnitPixels + 0.1 * cellUnitPixels,
        0,
        cellUnitPixels * 0.8,
        (cellUnitPixels / 2) * 0.8
      );

      if (isChancePuyo(puyoType)) {
        const attr = getPuyoAttribute(puyoType);
        const strokeStyle =
          attr === PuyoAttribute.Yellow || attr === PuyoAttribute.Green
            ? '#000'
            : '#fff';
        ctx.strokeStyle = strokeStyle;
        ctx.strokeText('ch', x * cellUnitPixels + 0.1 * cellUnitPixels, 10);
      }

      if (isPlusPuyo(puyoType)) {
        const attr = getPuyoAttribute(puyoType);
        const fillStyle =
          attr === PuyoAttribute.Yellow || attr === PuyoAttribute.Green
            ? '#000'
            : '#fff';
        ctx.fillStyle = fillStyle;
        ctx.fillRect(
          x * cellUnitPixels + 0.3 * cellUnitPixels,
          0.15 * cellUnitPixels,
          cellUnitPixels * 0.4,
          cellUnitPixels * 0.1
        );
        ctx.fillRect(
          x * cellUnitPixels + 0.45 * cellUnitPixels,
          0,
          cellUnitPixels * 0.1,
          cellUnitPixels * 0.4
        );
      }
    }

    const field = simulator.getField();

    for (let y = 0; y < PuyoCoord.YNum; y++) {
      for (let x = 0; x < PuyoCoord.XNum; x++) {
        const puyoType = field[y][x];
        const coord = PuyoCoord.xyToCoord(x, y)!;

        if (!puyoType) {
          continue;
        }

        ctx.fillStyle = getPuyoRgb(puyoType);
        ctx.fillRect(
          x * cellUnitPixels + 0.1 * cellUnitPixels,
          y * cellUnitPixels + 0.6 * cellUnitPixels,
          cellUnitPixels * 0.8,
          cellUnitPixels * 0.8
        );

        if (isChancePuyo(puyoType)) {
          const attr = getPuyoAttribute(puyoType);
          const strokeStyle =
            attr === PuyoAttribute.Yellow || attr === PuyoAttribute.Green
              ? '#000'
              : '#fff';
          ctx.strokeStyle = strokeStyle;
          ctx.strokeText(
            'ch',
            x * cellUnitPixels + 0.1 * cellUnitPixels,
            y * cellUnitPixels + 0.6 * cellUnitPixels + 10
          );
        }

        if (isPlusPuyo(puyoType)) {
          const attr = getPuyoAttribute(puyoType);
          const fillStyle =
            attr === PuyoAttribute.Yellow || attr === PuyoAttribute.Green
              ? '#000'
              : '#fff';
          ctx.fillStyle = fillStyle;

          ctx.fillRect(
            x * cellUnitPixels + 0.3 * cellUnitPixels,
            y * cellUnitPixels + 0.95 * cellUnitPixels,
            cellUnitPixels * 0.4,
            cellUnitPixels * 0.1
          );
          ctx.fillRect(
            x * cellUnitPixels + 0.45 * cellUnitPixels,
            y * cellUnitPixels + 0.8 * cellUnitPixels,
            cellUnitPixels * 0.1,
            cellUnitPixels * 0.4
          );
        }

        if (animating) {
          continue;
        }

        if (optimalTraceCoords?.includes(coord)) {
          ctx.fillStyle = '#fff8';
          ctx.fillRect(
            x * cellUnitPixels + 0.25 * cellUnitPixels,
            y * cellUnitPixels + 0.75 * cellUnitPixels,
            cellUnitPixels * 0.5,
            cellUnitPixels * 0.5
          );
          ctx.strokeStyle = '#888';
          ctx.strokeRect(
            x * cellUnitPixels + 0.25 * cellUnitPixels,
            y * cellUnitPixels + 0.75 * cellUnitPixels,
            cellUnitPixels * 0.5,
            cellUnitPixels * 0.5
          );
        }

        if (simulator.getCurrentTracingCoords().includes(coord)) {
          ctx.fillStyle = '#0008';
          ctx.fillRect(
            x * cellUnitPixels + 0.25 * cellUnitPixels,
            y * cellUnitPixels + 0.75 * cellUnitPixels,
            cellUnitPixels * 0.5,
            cellUnitPixels * 0.5
          );
        }
      }
    }
  };

  const onPointerUp = () => {
    if (animating) {
      return;
    }

    if (touching) {
      dispatch(tracingFinished());
    }
  };

  useEffect(() => {
    DrawScene();
  });

  const board = styles.board;
  const cursor =
    isEdit && editable
      ? styles.crosshair
      : isEdit
        ? styles.notAllowed
        : styles.pointer;

  return (
    <canvas
      className={`${board} ${cursor}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerOut}
      ref={canvasRef}
      width={`${width}px`}
      height={`${height}px`}
    />
  );
};

export default Canvas;
