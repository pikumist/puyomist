import { beforeEach, describe, expect, it } from 'vitest';

import type { Board } from '../logics/Board';
import {
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from '../logics/ExplorationTarget';
import { PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType } from '../logics/PuyoType';
import { customBoardId } from '../logics/boards';
import {
  PlusPreferenceKind,
  defaultPlusAssignSettings,
  plusAssignMaxNumLimit
} from '../logics/plus-assign';
import type { SolveResult } from '../logics/solution';
import { simulateSolution } from '../logics/solution-value';
import { createSimulationData } from './internal/createSimulationData';
import {
  plusAssignApplied,
  plusAssignSettingsChanged,
  plusAssignUndone,
  usePuyoAppStore
} from './puyoAppStore';
import {
  selectPlusAssignPlan,
  selectPlusAssignUndoAvailable
} from './selectors';
import { INITIAL_PUYO_APP_STATE } from './types';

const coord = (x: number, y: number) => PuyoCoord.xyToCoord(x, y)!;

const explorationTarget: ExplorationTarget = {
  category: ExplorationCategory.PuyotsukaiCount,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 1
};

/** ハートをなぞると赤4個が落ちて消える盤面 */
const fallingRedsBoard = (): Board => {
  const field = [...new Array(PuyoCoord.YNum)].map(() => [
    ...new Array<PuyoType | undefined>(PuyoCoord.XNum)
  ]);
  field[0][0] = PuyoType.Red;
  field[1][0] = PuyoType.Red;
  field[2][0] = PuyoType.Red;
  field[3][0] = PuyoType.Red;
  field[3][1] = PuyoType.Ojama;
  field[5][1] = PuyoType.Heart;

  return { field, nextPuyos: [...new Array(PuyoCoord.XNum)] };
};

const trace = [coord(1, 5)];

/** 盤面と、そこから作った simulationData を揃えてストアに置く */
const setBoard = (board: Board) => {
  usePuyoAppStore.setState({
    boardId: customBoardId,
    lastScreenshotBoard: board,
    simulationData: createSimulationData(board, {})
  });
};

/** そのなぞりを最適解1件だけ持つ探索結果をストアに置く */
const setSolveResult = () => {
  const state = usePuyoAppStore.getState();
  const result: SolveResult = {
    explorationTarget,
    candidates_num: 1,
    optimal_solutions: [
      simulateSolution(state.simulationData, explorationTarget, trace)
    ],
    elapsedTime: 1
  };
  usePuyoAppStore.setState({ solveResult: result, optimalSolutionIndex: 0 });
  return result;
};

describe('plus assign', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    setBoard(fallingRedsBoard());
    setSolveResult();
  });

  it('付与数は1以上・盤面のマス数以下に丸める', () => {
    plusAssignSettingsChanged({ num: 0 });
    expect(usePuyoAppStore.getState().plusAssignSettings.num).toBe(1);

    plusAssignSettingsChanged({ num: 999 });
    expect(usePuyoAppStore.getState().plusAssignSettings.num).toBe(
      plusAssignMaxNumLimit
    );
  });

  it('付与数に数値でない値が来たら既定へ倒す', () => {
    plusAssignSettingsChanged({ num: Number.NaN });
    expect(usePuyoAppStore.getState().plusAssignSettings.num).toBe(
      defaultPlusAssignSettings.num
    );
  });

  it('優先度は既知の種類がちょうど1回ずつになるよう直す', () => {
    plusAssignSettingsChanged({
      priorities: [
        PlusPreferenceKind.ColoredPuyo,
        PlusPreferenceKind.ColoredPuyo
      ]
    });

    expect(usePuyoAppStore.getState().plusAssignSettings.priorities).toEqual([
      PlusPreferenceKind.ColoredPuyo,
      PlusPreferenceKind.BiggerValue
    ]);
  });

  it('優先度を入れ替えると案も入れ替わる', () => {
    plusAssignSettingsChanged({ enabled: true, num: 1, color: PuyoAttr.Blue });
    // 盤面には消えない青は無いので、値優先では赤が採られる
    expect(selectPlusAssignPlan(usePuyoAppStore.getState())!.gains).toEqual([
      1
    ]);

    plusAssignSettingsChanged({
      priorities: [
        PlusPreferenceKind.ColoredPuyo,
        PlusPreferenceKind.BiggerValue
      ]
    });
    // 青ぷよが無いので段は1つのまま。案は変わらないが指紋は別物になる
    expect(selectPlusAssignPlan(usePuyoAppStore.getState())!.gains).toEqual([
      1
    ]);
  });

  it('オフの間は案を出さない', () => {
    expect(selectPlusAssignPlan(usePuyoAppStore.getState())).toBeUndefined();

    plusAssignSettingsChanged({ enabled: true });
    expect(selectPlusAssignPlan(usePuyoAppStore.getState())).toBeDefined();
  });

  it('連鎖アニメーションで盤面が進んでいる間は案を出さない', () => {
    plusAssignSettingsChanged({ enabled: true });
    const state = usePuyoAppStore.getState();
    usePuyoAppStore.setState({
      animationSteps: [
        {
          field: state.simulationData.field,
          nextPuyos: state.simulationData.nextPuyos,
          chains: []
        }
      ]
    });

    expect(selectPlusAssignPlan(usePuyoAppStore.getState())).toBeUndefined();
  });

  it('解が選ばれていなければ案を出さない', () => {
    plusAssignSettingsChanged({ enabled: true });
    usePuyoAppStore.setState({ optimalSolutionIndex: -1 });

    expect(selectPlusAssignPlan(usePuyoAppStore.getState())).toBeUndefined();
  });

  it('同じ入力なら案の参照が変わらない', () => {
    plusAssignSettingsChanged({ enabled: true });
    const first = selectPlusAssignPlan(usePuyoAppStore.getState());
    const second = selectPlusAssignPlan(usePuyoAppStore.getState());

    expect(first).toBe(second);
  });

  it('適用でプラスが付き、なぞりはそのままで値だけ上がる', () => {
    plusAssignSettingsChanged({ enabled: true, num: 2 });
    const plan = selectPlusAssignPlan(usePuyoAppStore.getState())!;
    const before = usePuyoAppStore.getState().solveResult!.optimal_solutions[0];

    plusAssignApplied(plan.coords);

    const state = usePuyoAppStore.getState();
    for (const c of plan.coords) {
      expect(state.simulationData.field[c.y][c.x]!.type).toBe(PuyoType.RedPlus);
    }

    const after = state.solveResult!.optimal_solutions[0];
    expect(after.trace_coords).toEqual(before.trace_coords);
    expect(after.value).toBe(plan.value);
    expect(after.value).toBeGreaterThan(before.value);
    expect(selectPlusAssignUndoAvailable(state)).toBe(true);
  });

  it('取り消しで盤面と値が元に戻る', () => {
    plusAssignSettingsChanged({ enabled: true, num: 2 });
    const plan = selectPlusAssignPlan(usePuyoAppStore.getState())!;
    const before = usePuyoAppStore.getState().solveResult!.optimal_solutions[0];

    plusAssignApplied(plan.coords);
    plusAssignUndone();

    const state = usePuyoAppStore.getState();
    for (const c of plan.coords) {
      expect(state.simulationData.field[c.y][c.x]!.type).toBe(PuyoType.Red);
    }
    expect(state.solveResult!.optimal_solutions[0].value).toBe(before.value);
    expect(state.plusAssignUndo).toBeUndefined();
  });

  it('付与したあとに盤面が変わっていたら取り消しは盤面に触らない', () => {
    plusAssignSettingsChanged({ enabled: true, num: 2 });
    const plan = selectPlusAssignPlan(usePuyoAppStore.getState())!;
    plusAssignApplied(plan.coords);

    const edited = fallingRedsBoard();
    edited.field[5][7] = PuyoType.Green;
    setBoard(edited);
    expect(selectPlusAssignUndoAvailable(usePuyoAppStore.getState())).toBe(
      false
    );

    plusAssignUndone();

    const state = usePuyoAppStore.getState();
    expect(state.simulationData.field[5][7]!.type).toBe(PuyoType.Green);
    expect(state.plusAssignUndo).toBeUndefined();
  });

  it('控えが無ければ取り消しは何もしない', () => {
    const before = usePuyoAppStore.getState().simulationData;
    plusAssignUndone();
    expect(usePuyoAppStore.getState().simulationData).toBe(before);
  });

  it('もうプラスを付けられないマスしか渡されなければ何もしない', () => {
    plusAssignApplied([coord(1, 5)]);

    const state = usePuyoAppStore.getState();
    expect(state.simulationData.field[5][1]!.type).toBe(PuyoType.Heart);
    expect(state.plusAssignUndo).toBeUndefined();
  });
});
