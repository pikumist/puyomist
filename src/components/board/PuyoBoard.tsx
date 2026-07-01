import type React from 'react';
import { useRef, useState } from 'react';

import { HowToEditBoard } from '@/logics/BoardEditMode';
import { tracingFinished } from '@/store/actions';
import {
  puyoEdited,
  tracingCanceled,
  tracingCoordAdded,
  usePuyoAppState
} from '@/store/puyoAppStore';
import { selectActiveFieldAndNextPuyos } from '@/store/selectors';
import styles from '../PuyoBoard.module.css';
import BoardBackground from '../board-parts/BoardBackground';
import BoardFrame from '../board-parts/BoardFrame';
import BoostAreaView from '../board-parts/BooastAreaView';
import GridLines from '../board-parts/GridLines';
import OptimalTrace from '../board-parts/OptimalTrace';
import PuyoMatrix from '../board-parts/PuyoMatrix';
import Trace from '../board-parts/Trace';
import TracePath from '../board-parts/TracePath';
import { getCursorClass } from '../board-parts/cursors';
import {
  detectHitInField,
  detectHitInNext
} from '../board-parts/logics/hit-detector';
import { H, W, fw } from '../board-parts/logics/measurements';

interface PuyoBoardProps {
  className?: string;
}

/**
 * SVG puyo board (new UI). The SVG drawing logic and `board-parts/*` are
 * reused verbatim from the Chakra version; only the Chakra-specific
 * responsive width hook is removed in favour of a plain numeric `width`.
 *
 * Pointer events (trace / edit) are preserved so touch dragging keeps working.
 */
const PuyoBoard: React.FC<PuyoBoardProps> = (props) => {
  const { className } = props;
  const state = usePuyoAppState();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const {
    isBoardEditing,
    boardEditMode,
    simulationData,
    solveResult,
    optimalSolutionIndex
  } = state;
  const { field, nextPuyos } = selectActiveFieldAndNextPuyos(state);
  const { boostAreaCoordList, traceCoords } = simulationData;
  const editing = isBoardEditing;
  const optimalTraceCoords =
    solveResult?.optimal_solutions[optimalSolutionIndex]?.trace_coords;
  const [touching, setTouching] = useState(false);
  const hasAnimation = state.animationSteps.length > 0;

  // The board scales fluidly via CSS, so the ratio is derived from the actual
  // rendered rect rather than a fixed width prop. This keeps pointer→cell
  // mapping correct at any size.
  const getPosition = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const rect = svg!.getBoundingClientRect();
    const ratio = (rect.width || W) / W;
    const px = ~~((e.clientX - rect.left) / ratio);
    const py = ~~((e.clientY - rect.top) / ratio);

    return { px, py };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || hasAnimation) {
      return;
    }

    if (!editing && !touching) {
      setTouching(true);
    }

    const { px, py } = getPosition(e);
    const coord = detectHitInField(px, py);

    if (!editing) {
      if (coord) {
        tracingCoordAdded(coord);
      }
    } else {
      if (coord) {
        puyoEdited({ fieldCoord: coord });
      } else {
        const nextX = detectHitInNext(px, py) ?? undefined;
        if (Number.isInteger(nextX)) {
          puyoEdited({ nextX });
        }
      }
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 || hasAnimation || editing) {
      return;
    }

    const { px, py } = getPosition(e);
    const coord = detectHitInField(px, py);

    if (coord) {
      tracingCoordAdded(coord);
    }
  };

  const onPointerUp = () => {
    if (hasAnimation || editing || !touching) {
      return;
    }
    tracingFinished();
  };

  const onPointerOut = (e: React.PointerEvent<SVGSVGElement>) => {
    if (hasAnimation || editing || !touching) {
      return;
    }

    const { px, py } = getPosition(e);

    if (px > 0 && px < W && py > 0 && py < H) {
      return;
    }

    setTouching(false);
    tracingCanceled();
  };

  const { howToEdit, customType } = boardEditMode ?? {};

  let cursor = '';

  if (hasAnimation) {
    cursor = styles.cursorNotAllowed;
  } else if (editing) {
    switch (howToEdit) {
      case HowToEditBoard.ClearEnhance:
        cursor = styles.cursorCrosshair;
        break;
      case HowToEditBoard.AddChance:
        cursor = styles.cursorChance;
        break;
      case HowToEditBoard.AddPlus:
        cursor = styles.cursorPlus;
        break;
      case HowToEditBoard.ToRed:
        cursor = styles.cursorRed;
        break;
      case HowToEditBoard.ToBlue:
        cursor = styles.cursorBlue;
        break;
      case HowToEditBoard.ToGreen:
        cursor = styles.cursorGreen;
        break;
      case HowToEditBoard.ToYellow:
        cursor = styles.cursorYellow;
        break;
      case HowToEditBoard.ToPurple:
        cursor = styles.cursorPurple;
        break;
      case HowToEditBoard.ToCustomType:
        cursor = styles[getCursorClass(customType)];
        break;
    }
  } else {
    cursor = styles.cursorPointer;
  }

  const viewBox = `0 0 ${W} ${H}`;

  return (
    <svg
      ref={svgRef}
      className={`board ${styles.svg} ${cursor} ${className ?? ''}`}
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
          <TracePath coords={traceCoords} />
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
};

export default PuyoBoard;
