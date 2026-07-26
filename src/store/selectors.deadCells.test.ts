import { beforeEach, describe, expect, it } from 'vitest';

import type { AnimationStep } from '../logics/AnimationStep';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType } from '../logics/PuyoType';
import { TraceMode } from '../logics/TraceMode';
import { createSimulationData } from './internal/createSimulationData';
import { usePuyoAppStore } from './puyoAppStore';
import { selectDeadCellCoords } from './selectors';
import { INITIAL_PUYO_APP_STATE } from './types';

/** 赤が2個だけ (ひっつけない) の盤面。 */
const twoRedsBoard = () => ({
  field: [...new Array(PuyoCoord.YNum)].map((_, y) =>
    [...new Array(PuyoCoord.XNum)].map((_, x) =>
      x === 0 && y < 2 ? PuyoType.Red : undefined
    )
  ),
  nextPuyos: [...new Array(PuyoCoord.XNum)].map(() => undefined)
});

/** 盤面から4個つながる赤を作る (印が出ない盤面)。 */
const fourRedsBoard = () => ({
  field: [...new Array(PuyoCoord.YNum)].map((_, y) =>
    [...new Array(PuyoCoord.XNum)].map((_, x) =>
      x === 0 && y < 4 ? PuyoType.Red : undefined
    )
  ),
  nextPuyos: [...new Array(PuyoCoord.XNum)].map(() => undefined)
});

const coordsOf = () =>
  selectDeadCellCoords(usePuyoAppStore.getState()).map(
    (coord) => `${coord.x},${coord.y}`
  );

describe('selectDeadCellCoords', () => {
  beforeEach(() => {
    usePuyoAppStore.setState({
      ...structuredClone(INITIAL_PUYO_APP_STATE),
      showDeadCells: true,
      simulationData: createSimulationData(twoRedsBoard(), {})
    });
  });

  it('marks the cells of the current board', () => {
    expect(coordsOf()).toEqual(['0,0', '0,1']);
  });

  it('gives nothing while the display is off', () => {
    usePuyoAppStore.setState({ showDeadCells: false });
    expect(coordsOf()).toEqual([]);
  });

  it('judges the board of the animation step being shown', () => {
    // アニメーションのコマでは、そのコマの盤面に対して判定する。
    // 4個つながっているコマなら印は出ない。
    const step = {
      ...createSimulationData(fourRedsBoard(), {}),
      chains: []
    } as unknown as AnimationStep;
    usePuyoAppStore.setState({
      animationSteps: [step],
      activeAnimationStepIndex: 0
    });

    expect(coordsOf()).toEqual([]);
  });

  it('keeps marking after a chain animation has finished', () => {
    // 連鎖が終わっても animationSteps は残る。そこで判定をやめてしまうと、
    // 盤面を変えるまで印が二度と出なくなる。
    const step = {
      ...createSimulationData(twoRedsBoard(), {}),
      chains: []
    } as unknown as AnimationStep;
    usePuyoAppStore.setState({
      animationSteps: [step],
      activeAnimationStepIndex: 0,
      animating: false
    });

    expect(coordsOf()).toEqual(['0,0', '0,1']);
  });

  it('gives nothing in the paint trace modes', () => {
    usePuyoAppStore.setState((state) => ({
      simulationData: { ...state.simulationData, traceMode: TraceMode.ToRed }
    }));

    expect(coordsOf()).toEqual([]);
  });
});
