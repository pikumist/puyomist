import React from 'react';
import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { HowToEditBoard } from '../logics/BoardEditMode';
import {
  puyoEdited,
  tracingCanceled,
  tracingCoordAdded,
  tracingFinished
} from '../reducers/puyoAppSlice';
import type { AppDispatch, RootState } from '../reducers/store';
import styles from './PuyoBoard.module.css';
import BoardBackground from './board-parts/BoardBackground';
import BoardFrame from './board-parts/BoardFrame';
import BoostAreaView from './board-parts/BooastAreaView';
import GridLines from './board-parts/GridLines';
import OptimalTrace from './board-parts/OptimalTrace';
import PuyoMatrix from './board-parts/PuyoMatrix';
import Trace from './board-parts/Trace';
import { getCursorClass } from './board-parts/cursors';
import {
  detectHitInField,
  detectHitInNext
} from './board-parts/logics/hit-detector';
import { H, W, fw } from './board-parts/logics/measurements';

/** ぷよの盤面を描画するSVG */
const PuyoBoard: React.FC = React.memo(() => {
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const dispatch = useDispatch<AppDispatch>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const {
    isBoardEditing,
    boardEditMode,
    simulationData,
    animating,
    explorationResult
  } = state;
  const { nextPuyos, field, boostAreaCoordList, traceCoords } = simulationData;
  const editing = isBoardEditing;
  const optimalTraceCoords = explorationResult?.optimalSolution?.traceCoords;
  const [touching, setTouching] = useState(false);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || animating) {
      return;
    }

    if (!editing) {
      if (!touching) {
        setTouching(true);
      }

      const svg = svgRef.current;
      const rect = svg!.getBoundingClientRect();
      const px = ~~(e.clientX - rect.left);
      const py = ~~(e.clientY - rect.top);

      const coord = detectHitInField(px, py);
      if (coord) {
        dispatch(tracingCoordAdded(coord));
      }
    }
    {
      const svg = svgRef.current;
      const rect = svg!.getBoundingClientRect();
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
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 || animating || editing) {
      return;
    }

    const svg = svgRef.current;
    const rect = svg!.getBoundingClientRect();
    const px = ~~(e.clientX - rect.left);
    const py = ~~(e.clientY - rect.top);

    const coord = detectHitInField(px, py);
    if (coord) {
      dispatch(tracingCoordAdded(coord));
    }
  };

  const onPointerUp = () => {
    if (animating || !touching) {
      return;
    }
    dispatch(tracingFinished());
  };

  const onPointerOut = (e: React.PointerEvent<SVGSVGElement>) => {
    if (animating || editing || !touching) {
      return;
    }

    const svg = svgRef.current;
    const rect = svg!.getBoundingClientRect();
    const px = ~~(e.clientX - rect.left);
    const py = ~~(e.clientY - rect.top);

    if (px > 0 && px < W && py > 0 && py < H) {
      return;
    }

    setTouching(false);
    dispatch(tracingCanceled());
  };

  const { howToEdit, customType } = boardEditMode ?? {};

  const cursor = editing
    ? howToEdit === HowToEditBoard.ToCustomType
      ? styles[getCursorClass(customType)]
      : howToEdit === HowToEditBoard.AddChance
        ? styles.cursorChance
        : howToEdit === HowToEditBoard.AddPlus
          ? styles.cursorPlus
          : styles.cursorCrosshair
    : styles.cursorPointer;

  const viewBox = `0 0 ${W} ${H}`;

  return (
    <svg
      ref={svgRef}
      className={`board ${styles.svg} ${cursor}`}
      viewBox={viewBox}
      width={W}
      height={H}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerOut}
    >
      <title>&nbsp;</title>
      <BoardBackground />
      <BoardFrame />
      <GridLines />
      <BoostAreaView coordList={boostAreaCoordList} />
      <g key="innerFrame" transform={`translate(${fw} ${fw})`}>
        <PuyoMatrix nextPuyos={nextPuyos} field={field} />
        <g key="coords">
          {optimalTraceCoords?.map((coord, i) => (
            <OptimalTrace key={String(i)} x={coord.x} y={coord.y} />
          ))}
          {traceCoords.map((coord, i) => (
            <Trace key={String(i)} x={coord.x} y={coord.y} />
          ))}
        </g>
      </g>
    </svg>
  );
});

export default PuyoBoard;
