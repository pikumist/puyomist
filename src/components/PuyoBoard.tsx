import { type ResponsiveValue, useBreakpointValue } from '@chakra-ui/react';
import type React from 'react';
import { useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectActiveFieldAndNextPuyos } from '../hooks/selectActiveFieldAndNextPuyos';
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

interface IProps {
  width: ResponsiveValue<number>;
}

/** ぷよの盤面を描画するSVG */
const PuyoBoard: React.FC<IProps> = (props) => {
  const { width } = props;
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const dispatch = useDispatch<AppDispatch>();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const responsiveWidth =
    typeof width !== 'number' ? useBreakpointValue(width) : width;

  const { isBoardEditing, boardEditMode, simulationData, solveResult } = state;
  const { field, nextPuyos } = selectActiveFieldAndNextPuyos(state);
  const { boostAreaCoordList, traceCoords } = simulationData;
  const editing = isBoardEditing;
  const optimalTraceCoords = solveResult?.optimal_solutions[0]?.trace_coords;
  const [touching, setTouching] = useState(false);
  const hasAnimation = state.animationSteps.length > 0;

  const ratio = (responsiveWidth ?? W) / W;

  const getPosition = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const rect = svg!.getBoundingClientRect();
    const px = ~~((e.clientX - rect.left) / ratio);
    const py = ~~((e.clientY - rect.top) / ratio);

    return {
      px,
      py
    };
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
        dispatch(tracingCoordAdded(coord));
      }
    } else {
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
    if (e.buttons !== 1 || hasAnimation || editing) {
      return;
    }

    const { px, py } = getPosition(e);
    const coord = detectHitInField(px, py);

    if (coord) {
      dispatch(tracingCoordAdded(coord));
    }
  };

  const onPointerUp = () => {
    if (hasAnimation || editing || !touching) {
      return;
    }
    dispatch(tracingFinished());
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
    dispatch(tracingCanceled());
  };

  const { howToEdit, customType } = boardEditMode ?? {};

  let cursor: string;

  if (hasAnimation) {
    cursor = styles.cursorNotAllowed;
  } else if (editing) {
    switch (howToEdit) {
      case HowToEditBoard.ClearEnhance:
        cursor = styles.cursorCrosshair;
        break;
      case HowToEditBoard.ToCustomType:
        cursor = styles[getCursorClass(customType)];
        break;
      case HowToEditBoard.AddChance:
        cursor = styles.cursorChance;
        break;
      case HowToEditBoard.AddPlus:
        cursor = styles.cursorPlus;
        break;
    }
  } else {
    cursor = styles.cursorPointer;
  }

  const viewBox = `0 0 ${W} ${H}`;

  return (
    <svg
      ref={svgRef}
      className={`board ${styles.svg} ${cursor}`}
      viewBox={viewBox}
      width={W * ratio}
      height={H * ratio}
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
};

export default PuyoBoard;
