import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Board } from '../logics/Board';
import { HowToEditBoard } from '../logics/BoardEditMode';
import { boostAreaKeyMap } from '../logics/BoostArea';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTargetDamage,
  type ExplorationTargetSkillPuyoCount,
  PreferenceKind
} from '../logics/ExplorationTarget';
import { PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import { PuyoType } from '../logics/PuyoType';
import { TraceMode } from '../logics/TraceMode';
import { SolutionMethod, type SolveResult } from '../logics/solution';
import { createSimulationData } from './internal/createSimulationData';
import {
  animationDurationChanged,
  boardEditCustomTypeChanged,
  boardEditingEnded,
  boardEditingStarted,
  boardResetButtonClicked,
  boostAreaKeyListChanged,
  chainAnimationEnded,
  chainAnimationStarted,
  chainAnimationStep,
  chainAnimationStepBack,
  chainAnimationStepForward,
  chainEnded,
  chainLeverageChanged,
  chainStarted,
  explorationCategorySelected,
  explorationCountingBonusCountChanged,
  explorationCountingBonusStepHeightChanged,
  explorationCountingBonusStepRepeatCheckChanged,
  explorationCountingBonusStepTargetAttrSelected,
  explorationCountingBonusTypeSelected,
  explorationDamageMainAttrSelected,
  explorationDamageMainSubRatioSelected,
  explorationDamageSubAttrSelected,
  explorationOptimalSolutionNumChanged,
  explorationPreferenceAdded,
  explorationPreferencePrioritiesChanged,
  explorationPreferenceReplaced,
  explorationPuyoCountMainAttrSelected,
  howToEditBoardChanged,
  hydrate,
  maxTraceNumChanged,
  minimumPuyoNumForPoppingChanged,
  nextItemSelected,
  optimalSolutionIndexChanged,
  poppingLeverageChanged,
  preparePlaySolutionButtonClicked,
  screenshotReceived,
  solutionMethodItemSelected,
  solutionResetButtonClicked,
  solveCancelButtonClicked,
  solveFailed,
  solved,
  solvingProgress,
  solvingStarted,
  traceModeChanged,
  tracingCanceled,
  tracingCoordAdded,
  usePuyoAppStore
} from './puyoAppStore';
import {
  selectActiveAnimationStep,
  selectActiveChains,
  selectActiveFieldAndNextPuyos
} from './selectors';
import { INITIAL_PUYO_APP_STATE } from './types';

const getState = () => usePuyoAppStore.getState();

/** 全面赤の盤面からシミュレーションデータを作る */
const makeRedSimulationData = () => {
  const field: PuyoType[][] = [...new Array(PuyoCoord.YNum)].map(() =>
    [...new Array(PuyoCoord.XNum)].map(() => PuyoType.Red)
  );
  const nextPuyos: PuyoType[] = [...new Array(PuyoCoord.XNum)].map(
    () => PuyoType.Red
  );
  const board: Board = { field, nextPuyos };
  return createSimulationData(board, {});
};

const makeSolveResult = (
  optimalSolutions: SolveResult['optimal_solutions'] = []
): SolveResult => ({
  explorationTarget: INITIAL_PUYO_APP_STATE.explorationTarget,
  elapsedTime: 0,
  candidates_num: 0,
  optimal_solutions: optimalSolutions
});

beforeEach(() => {
  usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
});

describe('puyoAppStore - システム系', () => {
  it('hydrate はデータを置き換えつつアクションを保持する', () => {
    const next = structuredClone(INITIAL_PUYO_APP_STATE);
    next.boardId = 'hydrated-board';
    next.animationDuration = 999;
    hydrate(next);
    expect(getState().boardId).toBe('hydrated-board');
    expect(getState().animationDuration).toBe(999);
    // アクションが残っている
    expect(typeof getState().maxTraceNumChanged).toBe('function');
  });
});

describe('puyoAppStore - キャンバス/なぞり系', () => {
  beforeEach(() => {
    usePuyoAppStore.setState({ simulationData: makeRedSimulationData() });
  });

  it('tracingCoordAdded は最初の座標と隣接座標を追加し、非隣接を拒否する', () => {
    const c00 = PuyoCoord.xyToCoord(0, 0)!;
    const c10 = PuyoCoord.xyToCoord(1, 0)!;
    const cFar = PuyoCoord.xyToCoord(5, 5)!;

    tracingCoordAdded(c00);
    expect(getState().simulationData.traceCoords).toEqual([c00]);

    tracingCoordAdded(c10);
    expect(getState().simulationData.traceCoords).toEqual([c00, c10]);

    tracingCoordAdded(cFar);
    expect(getState().simulationData.traceCoords).toEqual([c00, c10]);

    // 同一座標は重複追加されない
    tracingCoordAdded(c00);
    expect(getState().simulationData.traceCoords).toEqual([c00, c10]);
  });

  it('tracingCoordAdded は maxTraceNum を超えない', () => {
    const sim = makeRedSimulationData();
    sim.maxTraceNum = 1;
    usePuyoAppStore.setState({ simulationData: sim });

    tracingCoordAdded(PuyoCoord.xyToCoord(0, 0)!);
    tracingCoordAdded(PuyoCoord.xyToCoord(1, 0)!);
    expect(getState().simulationData.traceCoords).toHaveLength(1);
  });

  it('tracingCanceled はなぞり座標をクリアする', () => {
    tracingCoordAdded(PuyoCoord.xyToCoord(0, 0)!);
    tracingCanceled();
    expect(getState().simulationData.traceCoords).toEqual([]);
  });

  it('boardResetButtonClicked はアニメーションをリセットする', () => {
    usePuyoAppStore.setState({
      animationSteps: [{} as never, {} as never],
      activeAnimationStepIndex: 1
    });
    boardResetButtonClicked();
    expect(getState().animationSteps).toEqual([]);
    expect(getState().activeAnimationStepIndex).toBe(-1);
  });
});

describe('puyoAppStore - 連鎖系', () => {
  it('chainStarted は lastTraceCoords を退避しアニメをクリアする', () => {
    const sim = makeRedSimulationData();
    const c = PuyoCoord.xyToCoord(0, 0)!;
    sim.traceCoords = [c];
    usePuyoAppStore.setState({
      simulationData: sim,
      animationSteps: [{} as never]
    });
    chainStarted();
    expect(getState().lastTraceCoords).toEqual([c]);
    expect(getState().animationSteps).toEqual([]);
  });

  it('chainEnded はなぞりをクリアしアニメステップを設定する', () => {
    const steps = [{ foo: 1 } as never];
    chainEnded(steps);
    expect(getState().simulationData.traceCoords).toEqual([]);
    expect(getState().animationSteps).toBe(steps);
  });

  it('chainAnimationStarted/Ended は animating を切り替える', () => {
    chainAnimationStarted();
    expect(getState().animating).toBe(true);
    chainAnimationEnded();
    expect(getState().animating).toBe(false);
  });

  it('chainAnimationStep/Back/Forward はインデックスを変更しクランプする', () => {
    usePuyoAppStore.setState({
      animationSteps: [{} as never, {} as never, {} as never],
      activeAnimationStepIndex: 0
    });
    chainAnimationStepForward();
    expect(getState().activeAnimationStepIndex).toBe(1);
    chainAnimationStep(2);
    expect(getState().activeAnimationStepIndex).toBe(2);
    chainAnimationStepForward();
    expect(getState().activeAnimationStepIndex).toBe(2); // max でクランプ
    chainAnimationStepBack();
    expect(getState().activeAnimationStepIndex).toBe(1);
  });

  it('アニメステップが空のとき Back/Forward は -1 にする', () => {
    usePuyoAppStore.setState({
      animationSteps: [],
      activeAnimationStepIndex: 5
    });
    chainAnimationStepForward();
    expect(getState().activeAnimationStepIndex).toBe(-1);
  });
});

describe('puyoAppStore - 設定系', () => {
  it('nextItemSelected はネクストを更新しアニメをリセットする', () => {
    usePuyoAppStore.setState({
      animationSteps: [{} as never],
      activeAnimationStepIndex: 0
    });
    nextItemSelected('red');
    expect(getState().nextSelection).toBe('red');
    expect(getState().animationSteps).toEqual([]);
    expect(getState().activeAnimationStepIndex).toBe(-1);
  });

  it('maxTraceNumChanged / poppingLeverageChanged / chainLeverageChanged', () => {
    maxTraceNumChanged(7);
    poppingLeverageChanged(2.5);
    chainLeverageChanged(3.5);
    expect(getState().simulationData.maxTraceNum).toBe(7);
    expect(getState().simulationData.poppingLeverage).toBe(2.5);
    expect(getState().simulationData.chainLeverage).toBe(3.5);
  });

  it('animationDurationChanged はコマ間隔を更新する', () => {
    animationDurationChanged(123);
    expect(getState().animationDuration).toBe(123);
  });

  it('minimumPuyoNumForPoppingChanged は通常モードのみ反映する', () => {
    minimumPuyoNumForPoppingChanged(3);
    expect(getState().simulationData.minimumPuyoNumForPopping).toBe(3);

    traceModeChanged(TraceMode.ToRed);
    // 非通常モードでは 4 に固定され、変更は無視される
    expect(getState().simulationData.minimumPuyoNumForPopping).toBe(4);
    minimumPuyoNumForPoppingChanged(3);
    expect(getState().simulationData.minimumPuyoNumForPopping).toBe(4);
  });

  it('traceModeChanged はモードを更新する', () => {
    traceModeChanged(TraceMode.ToBlue);
    expect(getState().simulationData.traceMode).toBe(TraceMode.ToBlue);
  });

  it('solutionMethodItemSelected は探索法を更新する', () => {
    solutionMethodItemSelected(SolutionMethod.solveAllInSerial);
    expect(getState().solutionMethod).toBe(SolutionMethod.solveAllInSerial);
  });

  it('boostAreaKeyListChanged はキーリストと座標リストを更新する', () => {
    const key = [...boostAreaKeyMap.keys()][0];
    boostAreaKeyListChanged([key]);
    expect(getState().boostAreaKeyList).toEqual([key]);
    expect(
      getState().simulationData.boostAreaCoordList.length
    ).toBeGreaterThan(0);
  });

  it('boardEditingStarted/Ended は編集フラグを切り替える', () => {
    boardEditingStarted();
    expect(getState().isBoardEditing).toBe(true);
    boardEditingEnded();
    expect(getState().isBoardEditing).toBe(false);
  });

  it('howToEditBoardChanged / boardEditCustomTypeChanged', () => {
    howToEditBoardChanged(HowToEditBoard.AddChance);
    expect(getState().boardEditMode.howToEdit).toBe(HowToEditBoard.AddChance);

    boardEditCustomTypeChanged(PuyoType.Blue);
    expect(getState().boardEditMode.howToEdit).toBe(
      HowToEditBoard.ToCustomType
    );
    expect(getState().boardEditMode.customType).toBe(PuyoType.Blue);
  });
});

describe('puyoAppStore - 探索対象の設定', () => {
  it('explorationCategorySelected はカテゴリを切り替え優先度を保持する', () => {
    const priorities = getState().explorationTarget.preference_priorities;

    explorationCategorySelected(ExplorationCategory.Damage);
    expect(getState().explorationTarget.category).toBe(
      ExplorationCategory.Damage
    );
    expect(
      (getState().explorationTarget as ExplorationTargetDamage).main_attr
    ).toBe(PuyoAttr.Red);
    expect(getState().explorationTarget.preference_priorities).toEqual(
      priorities
    );

    explorationCategorySelected(ExplorationCategory.SkillPuyoCount);
    expect(getState().explorationTarget.category).toBe(
      ExplorationCategory.SkillPuyoCount
    );

    explorationCategorySelected(ExplorationCategory.PuyotsukaiCount);
    expect(getState().explorationTarget.category).toBe(
      ExplorationCategory.PuyotsukaiCount
    );
  });

  it('explorationOptimalSolutionNumChanged は最適解数を更新する', () => {
    explorationOptimalSolutionNumChanged(10);
    expect(getState().explorationTarget.optimal_solution_count).toBe(10);
  });

  it('explorationPreferencePrioritiesChanged は優先度リストを置き換える', () => {
    const next = [PreferenceKind.SmallerTraceNum, PreferenceKind.BiggerValue];
    explorationPreferencePrioritiesChanged(next);
    expect(getState().explorationTarget.preference_priorities).toEqual(next);
  });

  it('explorationPreferenceReplaced は要素を置換する', () => {
    explorationPreferencePrioritiesChanged([
      PreferenceKind.BiggerValue,
      PreferenceKind.ChancePop
    ]);
    explorationPreferenceReplaced({
      from: PreferenceKind.ChancePop,
      to: PreferenceKind.PrismPop
    });
    expect(getState().explorationTarget.preference_priorities).toEqual([
      PreferenceKind.BiggerValue,
      PreferenceKind.PrismPop
    ]);
  });

  it('explorationPreferenceAdded は重複しない場合のみ追加する', () => {
    explorationPreferencePrioritiesChanged([PreferenceKind.BiggerValue]);
    explorationPreferenceAdded(PreferenceKind.AllClear);
    expect(getState().explorationTarget.preference_priorities).toContain(
      PreferenceKind.AllClear
    );
    const len = getState().explorationTarget.preference_priorities.length;
    // 同種(下一桁が同じ)は追加されない
    explorationPreferenceAdded(PreferenceKind.AllClear);
    expect(getState().explorationTarget.preference_priorities).toHaveLength(
      len
    );
  });

  it('ダメージ主属性/副属性/ダメージ率の選択', () => {
    explorationCategorySelected(ExplorationCategory.Damage);
    explorationDamageMainAttrSelected(PuyoAttr.Blue);
    expect(
      (getState().explorationTarget as ExplorationTargetDamage).main_attr
    ).toBe(PuyoAttr.Blue);

    explorationDamageSubAttrSelected(PuyoAttr.Green);
    expect(
      (getState().explorationTarget as ExplorationTargetDamage).sub_attr
    ).toBe(PuyoAttr.Green);

    explorationDamageMainSubRatioSelected(1);
    expect(
      (getState().explorationTarget as ExplorationTargetDamage).main_sub_ratio
    ).toBe(1);

    // 主属性を undefined にすると副属性もクリアされる
    explorationDamageMainAttrSelected(undefined);
    expect(
      (getState().explorationTarget as ExplorationTargetDamage).sub_attr
    ).toBeUndefined();
  });

  it('ぷよ数の主属性と加速ボーナスの設定', () => {
    explorationCategorySelected(ExplorationCategory.SkillPuyoCount);
    explorationPuyoCountMainAttrSelected(PuyoAttr.Green);
    expect(
      (getState().explorationTarget as ExplorationTargetSkillPuyoCount)
        .main_attr
    ).toBe(PuyoAttr.Green);

    explorationCountingBonusTypeSelected(CountingBonusType.Step);
    const bonus = (
      getState().explorationTarget as ExplorationTargetSkillPuyoCount
    ).counting_bonus;
    expect(bonus?.bonus_type).toBe(CountingBonusType.Step);

    explorationCountingBonusStepTargetAttrSelected(PuyoAttr.Yellow);
    explorationCountingBonusStepHeightChanged(8);
    explorationCountingBonusCountChanged(3);
    explorationCountingBonusStepRepeatCheckChanged(false);
    const bonus2 = (
      getState().explorationTarget as ExplorationTargetSkillPuyoCount
    ).counting_bonus!;
    expect(bonus2.target_attrs).toEqual([PuyoAttr.Yellow]);
    expect(bonus2.step_height).toBe(8);
    expect(bonus2.bonus_count).toBe(3);
    expect(bonus2.repeat).toBe(false);

    // 解除すると counting_bonus が undefined になる
    explorationCountingBonusTypeSelected(undefined);
    expect(
      (getState().explorationTarget as ExplorationTargetSkillPuyoCount)
        .counting_bonus
    ).toBeUndefined();
  });
});

describe('puyoAppStore - 最適解探索系', () => {
  it('solvingStarted は AbortController を生成する', () => {
    solvingStarted();
    expect(getState().solving).toBe(true);
    expect(getState().abortControllerForSolving).toBeInstanceOf(
      AbortController
    );
    expect(getState().solvingProgressPercent).toBe(0);
  });

  it('solveCancelButtonClicked は signal を abort する', () => {
    solvingStarted();
    const controller = getState().abortControllerForSolving!;
    solveCancelButtonClicked();
    expect(controller.signal.aborted).toBe(true);
  });

  it('solvingProgress は途中経過を反映する', () => {
    const result = makeSolveResult();
    solvingProgress({ result, percent: 42 });
    expect(getState().solveResult).toBe(result);
    expect(getState().solvingProgressPercent).toBe(42);
    expect(getState().optimalSolutionIndex).toBe(0);
  });

  it('solved は結果を確定する', () => {
    solvingStarted();
    const result = makeSolveResult();
    solved(result);
    expect(getState().solveResult).toBe(result);
    expect(getState().solving).toBe(false);
    expect(getState().solvingProgressPercent).toBe(100);
    expect(getState().abortControllerForSolving).toBeUndefined();
  });

  it('solveFailed は状態をクリアする', () => {
    solvingStarted();
    solveFailed();
    expect(getState().solveResult).toBeUndefined();
    expect(getState().optimalSolutionIndex).toBe(-1);
    expect(getState().solving).toBe(false);
  });

  it('solutionResetButtonClicked は結果をクリアする', () => {
    solvingProgress({ result: makeSolveResult(), percent: 50 });
    solutionResetButtonClicked();
    expect(getState().solveResult).toBeUndefined();
    expect(getState().optimalSolutionIndex).toBe(-1);
  });

  it('optimalSolutionIndexChanged はインデックスを更新する', () => {
    optimalSolutionIndexChanged(3);
    expect(getState().optimalSolutionIndex).toBe(3);
  });

  it('preparePlaySolutionButtonClicked は解のなぞりを反映する', () => {
    const coord = PuyoCoord.xyToCoord(2, 2)!;
    const result = makeSolveResult([
      {
        trace_coords: [coord],
        puyo_tsukai_count: 0,
        value: 0
      } as never
    ]);
    usePuyoAppStore.setState({ solveResult: result, optimalSolutionIndex: 0 });
    preparePlaySolutionButtonClicked();
    expect(getState().simulationData.traceCoords).toEqual([coord]);
  });
});

describe('puyoAppStore - スクリーンショット系', () => {
  it('screenshotReceived は前の blobUrl を解放し新しい情報を設定する', () => {
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    usePuyoAppStore.setState({
      screenshotInfo: {
        filePath: '',
        fileName: 'old.png',
        mime: 'image/png',
        size: 1,
        blobUrl: 'blob:old'
      }
    });
    const info = {
      filePath: '',
      fileName: 'new.png',
      mime: 'image/png',
      size: 2,
      blobUrl: 'blob:new'
    };
    screenshotReceived(info);
    expect(revoke).toHaveBeenCalledWith('blob:old');
    expect(getState().screenshotInfo).toBe(info);
    revoke.mockRestore();
  });
});

describe('selectors', () => {
  it('selectActiveAnimationStep はアクティブなステップを返す', () => {
    const steps = [{ id: 0 } as never, { id: 1 } as never];
    usePuyoAppStore.setState({
      animationSteps: steps,
      activeAnimationStepIndex: 1
    });
    expect(selectActiveAnimationStep(getState())).toBe(steps[1]);
  });

  it('selectActiveAnimationStep は範囲外で undefined を返す', () => {
    usePuyoAppStore.setState({
      animationSteps: [],
      activeAnimationStepIndex: -1
    });
    expect(selectActiveAnimationStep(getState())).toBeUndefined();
  });

  it('selectActiveChains はアクティブステップの連鎖を返す', () => {
    const chains = [{ chain_num: 1 }];
    usePuyoAppStore.setState({
      animationSteps: [{ chains } as never],
      activeAnimationStepIndex: 0
    });
    expect(selectActiveChains(getState())).toBe(chains);
  });

  it('selectActiveFieldAndNextPuyos はステップが無ければ simulationData を返す', () => {
    const sim = makeRedSimulationData();
    usePuyoAppStore.setState({
      simulationData: sim,
      animationSteps: [],
      activeAnimationStepIndex: -1
    });
    const result = selectActiveFieldAndNextPuyos(getState());
    expect(result.field).toBe(sim.field);
    expect(result.nextPuyos).toBe(sim.nextPuyos);
  });

  it('selectActiveFieldAndNextPuyos はステップがあればステップの盤面を返す', () => {
    const field = [['x']];
    const nextPuyos = ['n'];
    usePuyoAppStore.setState({
      animationSteps: [{ field, nextPuyos } as never],
      activeAnimationStepIndex: 0
    });
    const result = selectActiveFieldAndNextPuyos(getState());
    expect(result.field).toBe(field);
    expect(result.nextPuyos).toBe(nextPuyos);
  });
});
