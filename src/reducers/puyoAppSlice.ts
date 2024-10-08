import {
  type Dispatch,
  type PayloadAction,
  createSlice
} from '@reduxjs/toolkit';
import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import type { AnimationStep } from '../logics/AnimationStep';
import { type Board, emptyBoard } from '../logics/Board';
import { HowToEditBoard } from '../logics/BoardEditMode';
import { boostAreaKeyMap } from '../logics/BoostArea';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTargetDamage,
  type ExplorationTargetSkillPuyoCount,
  type PreferenceKind
} from '../logics/ExplorationTarget';
import { type ColoredPuyoAttr, PuyoAttr } from '../logics/PuyoAttr';
import { PuyoCoord } from '../logics/PuyoCoord';
import {
  type PuyoType,
  isTraceablePuyo,
  toChanceColoredType,
  toNormalColoredType,
  toPlusColoredType
} from '../logics/PuyoType';
import { cloneSimulationData } from '../logics/SimulationData';
import { Simulator } from '../logics/Simulator';
import { TraceMode } from '../logics/TraceMode';
import type { PuyomistJson } from '../logics/app-json';
import { customBoardId, getSpecialBoard } from '../logics/boards';
import { unionSet } from '../logics/generics/set';
import { sleep } from '../logics/generics/sleep';
import { SolutionMethod, type SolveResult } from '../logics/solution';
import { INITIAL_PUYO_APP_STATE, type PuyoAppState } from './PuyoAppState';
import { createNextPuyos } from './internal/createNextPuyos';
import { createSimulationData } from './internal/createSimulationData';
import {
  createSolveAllInParallel,
  createSolveAllInParallelByWasm,
  createSolveAllInSerial,
  createSolveAllInSerialByWasm
} from './internal/solve';
import type { AppDispatch, RootState } from './store';

export const PUYO_APP_SLICE_KEY = 'puyoApp';

const puyoAppSlice = createSlice({
  name: PUYO_APP_SLICE_KEY,
  initialState: INITIAL_PUYO_APP_STATE,
  reducers: {
    ///
    /// システム系
    ///

    /** ステートをストレージなどから読み込む。 */
    hydrate: (_state, action: PayloadAction<PuyoAppState>) => {
      return action.payload;
    },

    ///
    /// キャンバスアクション系
    ///

    /** なぞり消し座標の追加があったとき */
    tracingCoordAdded: (state, action: PayloadAction<PuyoCoord>) => {
      const coord = action.payload;
      const { traceCoords, maxTraceNum } = state.simulationData;

      if (traceCoords.length >= maxTraceNum || traceCoords.includes(coord)) {
        return;
      }
      if (traceCoords.length === 0) {
        const puyo = state.simulationData.field[coord.y][coord.x];
        if (isTraceablePuyo(puyo?.type)) {
          traceCoords.push(coord);
        }
        return;
      }
      for (const c of traceCoords) {
        if (Math.abs(coord.x - c.x) <= 1 && Math.abs(coord.y - c.y) <= 1) {
          const puyo = state.simulationData.field[coord.y][coord.x];
          if (isTraceablePuyo(puyo?.type)) {
            traceCoords.push(coord);
            return;
          }
        }
      }
    },

    /** なぞり消しがキャンセルされたとき */
    tracingCanceled: (state) => {
      state.simulationData.traceCoords = [];
    },

    /** 盤面(ネクストを含む)内のぷよが編集されたとき */
    puyoEdited: (
      state,
      action: PayloadAction<{ fieldCoord?: PuyoCoord; nextX?: number }>
    ) => {
      if (state.boardId !== customBoardId) {
        state.lastScreenshotBoard = structuredClone(
          getSpecialBoard(state.boardId)
        );
        if (!state.lastScreenshotBoard.nextPuyos) {
          state.lastScreenshotBoard.nextPuyos =
            state.simulationData.nextPuyos.map((puyo) => puyo?.type);
        }
      } else if (!state.lastScreenshotBoard) {
        state.lastScreenshotBoard = {
          field: [...new Array(PuyoCoord.YNum)].map(() => [
            ...new Array(PuyoCoord.XNum)
          ]),
          nextPuyos: [...new Array(PuyoCoord.XNum)]
        };
      }

      const { fieldCoord, nextX } = action.payload;

      if (!fieldCoord && !Number.isInteger(nextX)) {
        return;
      }

      const getTargetPuyoType = () => {
        if (fieldCoord) {
          const coord = fieldCoord;
          return state.lastScreenshotBoard!.field[coord.y][coord.x];
        }
        return state.lastScreenshotBoard!.nextPuyos![nextX!];
      };

      const setTargetPuyoType = (puyoType: PuyoType | undefined) => {
        if (fieldCoord) {
          const coord = fieldCoord;
          state.lastScreenshotBoard!.field[coord.y][coord.x] = puyoType;
        } else {
          state.lastScreenshotBoard!.nextPuyos![nextX!] = puyoType;
        }
      };

      const { howToEdit, customType } = state.boardEditMode;
      const prevType = getTargetPuyoType();

      if (!prevType && howToEdit !== HowToEditBoard.ToCustomType) {
        return;
      }

      switch (howToEdit) {
        case HowToEditBoard.ClearEnhance:
          setTargetPuyoType(toNormalColoredType(prevType!));
          break;
        case HowToEditBoard.AddChance:
          setTargetPuyoType(toChanceColoredType(prevType!));
          break;
        case HowToEditBoard.AddPlus:
          setTargetPuyoType(toPlusColoredType(prevType!));
          break;
        case HowToEditBoard.ToCustomType:
          setTargetPuyoType(customType);
          break;
      }

      state.boardId = customBoardId;

      const simulationData = state.simulationData;

      state.simulationData = createSimulationData(
        state.lastScreenshotBoard!,
        {},
        simulationData as any
      );
    },

    /** 盤面リセットボタンがクリックされたとき */
    boardResetButtonClicked: (state) => {
      const simulationData = state.simulationData;

      if (state.boardId !== customBoardId) {
        const board = getSpecialBoard(state.boardId);
        const nextPuyos = createNextPuyos(state.nextSelection);
        state.simulationData = createSimulationData(
          board,
          { nextPuyos },
          simulationData as any
        ) as any;
      } else {
        const board = state.lastScreenshotBoard ?? {};
        state.simulationData = createSimulationData(
          board,
          {},
          simulationData as any
        );
      }

      state.animationSteps = [];
      state.activeAnimationStepIndex = -1;
    },

    ///
    /// 連鎖系
    ///

    /** なぞり消しによる連鎖を開始したとき */
    chainStarted: (state) => {
      state.lastTraceCoords = [...state.simulationData.traceCoords];
      state.animationSteps = [];
    },

    /** なぞり消しによる連鎖が終了したとき */
    chainEnded: (state, action: PayloadAction<AnimationStep[]>) => {
      const animationSteps = action.payload;
      state.simulationData.traceCoords = [];
      state.animationSteps = animationSteps;
    },

    /** 連鎖アニメーションを開始したとき */
    chainAnimationStarted: (state) => {
      state.animating = true;
    },

    /** 連鎖アニメーションのステップが一コマ戻されたとき */
    chainAnimationStepBack: (state) => {
      if (state.animationSteps.length === 0) {
        state.activeAnimationStepIndex = -1;
        return;
      }
      state.activeAnimationStepIndex = Math.max(
        0,
        state.activeAnimationStepIndex - 1
      );
    },

    /** 連鎖アニメーションのステップが一コマ進んだとき */
    chainAnimationStepForward: (state) => {
      if (state.animationSteps.length === 0) {
        state.activeAnimationStepIndex = -1;
        return;
      }
      state.activeAnimationStepIndex = Math.min(
        state.animationSteps.length - 1,
        state.activeAnimationStepIndex + 1
      );
    },

    /** 連鎖アニメーションのステップが変更されたとき */
    chainAnimationStep: (state, action: PayloadAction<number>) => {
      state.activeAnimationStepIndex = action.payload;
    },

    /** 連鎖アニメーションが終了したとき */
    chainAnimationEnded: (state) => {
      state.animating = false;
    },

    ///
    /// 設定系
    ///

    /** 盤面IDが変更されたとき */
    boardIdChanged: (state, action: PayloadAction<string>) => {
      const boardId = action.payload;
      state.boardId = boardId;
      const simulationData = state.simulationData;

      if (boardId !== customBoardId) {
        const board = getSpecialBoard(state.boardId);
        const nextPuyos = createNextPuyos(state.nextSelection);
        state.simulationData = createSimulationData(
          board,
          { nextPuyos },
          simulationData as any
        );
      } else {
        const board = state.lastScreenshotBoard ?? {};
        state.simulationData = createSimulationData(
          board,
          {},
          simulationData as any
        );
      }

      state.animationSteps = [];
      state.activeAnimationStepIndex = -1;
      state.solveResult = undefined;
      state.optimalSolutionIndex = -1;
    },

    /** ネクストの項目が選択されたとき */
    nextItemSelected: (state, action: PayloadAction<string>) => {
      const nextSelection = action.payload;
      state.nextSelection = nextSelection;
      const nextPuyos = createNextPuyos(nextSelection);
      state.simulationData.nextPuyos = nextPuyos;
      state.animationSteps = [];
      state.activeAnimationStepIndex = -1;
    },

    /** なぞり消しモードが変更されたとき */
    traceModeChanged: (state, action: PayloadAction<TraceMode>) => {
      const traceMode = action.payload;
      state.simulationData.traceMode = traceMode;
      if (traceMode !== TraceMode.Normal) {
        state.simulationData.minimumPuyoNumForPopping = 4;
      }
      if (state.boardId !== customBoardId) {
        const board = structuredClone(getSpecialBoard(state.boardId));
        // biome-ignore lint/performance/noDelete: カスタムボードではboard内のtraceModeは無い想定
        delete board.traceMode;
        state.lastScreenshotBoard = board;
        if (!state.lastScreenshotBoard.nextPuyos) {
          state.lastScreenshotBoard.nextPuyos =
            state.simulationData.nextPuyos.map((puyo) => puyo?.type);
        }
        state.boardId = customBoardId;
      }
    },

    /** ぷよが消えるのに必要な個数が変更されたとき */
    minimumPuyoNumForPoppingChanged: (state, action: PayloadAction<number>) => {
      const traceMode = state.simulationData.traceMode;
      if (traceMode === TraceMode.Normal) {
        state.simulationData.minimumPuyoNumForPopping = action.payload;
      }
    },

    /** 最大なぞり数が変更されたとき */
    maxTraceNumChanged: (state, action: PayloadAction<number>) => {
      state.simulationData.maxTraceNum = action.payload;
    },

    /** 同時消し倍率が変更されたとき */
    poppingLeverageChanged: (state, action: PayloadAction<number>) => {
      state.simulationData.poppingLeverage = action.payload;
    },

    /** 連鎖倍率が変更されたとき */
    chainLeverageChanged: (state, action: PayloadAction<number>) => {
      state.simulationData.chainLeverage = action.payload;
    },

    /** アニメーション時間間隔が変更されたとき */
    animationDurationChanged: (state, action: PayloadAction<number>) => {
      state.animationDuration = action.payload;
    },

    /** 最適化対象カテゴリーの項目が選択されたとき */
    explorationCategorySelected: (
      state,
      action: PayloadAction<ExplorationCategory>
    ) => {
      const common = {
        preference_priorities: state.explorationTarget.preference_priorities,
        optimal_solution_count:
          state.explorationTarget.optimal_solution_count || 1
      };
      switch (action.payload) {
        case ExplorationCategory.Damage:
          state.explorationTarget = {
            category: ExplorationCategory.Damage,
            ...common,
            main_attr: PuyoAttr.Red
          };
          break;
        case ExplorationCategory.SkillPuyoCount:
          state.explorationTarget = {
            category: ExplorationCategory.SkillPuyoCount,
            ...common,
            main_attr: PuyoAttr.Red
          };
          break;
        case ExplorationCategory.PuyotsukaiCount:
          state.explorationTarget = {
            category: ExplorationCategory.PuyotsukaiCount,
            ...common
          };
      }
    },

    /** 探索対象の優先度に変更があったとき */
    explorationOptimalSolutionNumChanged: (
      state,
      action: PayloadAction<number>
    ) => {
      state.explorationTarget.optimal_solution_count = action.payload;
    },

    /** 探索対象の優先度リストに変更があったとき */
    explorationPreferencePrioritiesChanged: (
      state,
      action: PayloadAction<PreferenceKind[]>
    ) => {
      state.explorationTarget.preference_priorities = action.payload;
    },

    /** 派生プリファレンスに置換されたとき */
    explorationPreferenceReplaced: (
      state,
      action: PayloadAction<{ from: PreferenceKind; to: PreferenceKind }>
    ) => {
      const { from, to } = action.payload;
      const preference_priorities = [
        ...state.explorationTarget.preference_priorities
      ];
      preference_priorities.splice(preference_priorities.indexOf(from), 1, to);
      state.explorationTarget.preference_priorities = preference_priorities;
    },

    /** プリファレンスが追加されたとき */
    explorationPreferenceAdded: (
      state,
      action: PayloadAction<PreferenceKind>
    ) => {
      const pref = action.payload;
      if (
        !state.explorationTarget.preference_priorities.some(
          (p) => p % 10 === pref % 10
        )
      ) {
        state.explorationTarget.preference_priorities.push(pref);
      }
    },

    /** ダメージの主属性項目が選択されたとき */
    explorationDamageMainAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttr | undefined>
    ) => {
      const mainAttr = action.payload;
      const target = state.explorationTarget as ExplorationTargetDamage;

      if (mainAttr === undefined || target.sub_attr === mainAttr) {
        target.sub_attr = undefined;
      }
      target.main_attr = mainAttr;
    },

    /** ダメージの副属性項目が選択されたとき */
    explorationDamageSubAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttr | undefined>
    ) => {
      const subAttr = action.payload;
      const target = state.explorationTarget as ExplorationTargetDamage;

      target.sub_attr = target.main_attr === subAttr ? undefined : subAttr;
    },

    /** ダメージの副属性ダメージ率項目が選択されたとき */
    explorationDamageMainSubRatioSelected: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.explorationTarget as ExplorationTargetDamage;
      target.main_sub_ratio = action.payload;
    },

    /** ぷよ数の主属性項目が選択されたとき */
    explorationPuyoCountMainAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttr>
    ) => {
      const mainAttr = action.payload;
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      target.main_attr = mainAttr;
    },

    /** ぷよ数のボーナスタイプ項目が選択されたとき */
    explorationCountingBonusTypeSelected: (
      state,
      action: PayloadAction<CountingBonusType | undefined>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;
      const bonusType = action.payload;

      if (bonusType === CountingBonusType.Step) {
        target.counting_bonus = {
          bonus_type: bonusType,
          target_attrs: [PuyoAttr.Red],
          step_height: 4,
          bonus_count: 4,
          repeat: true
        };
      } else {
        target.counting_bonus = undefined;
      }
    },

    explorationCountingBonusStepTargetAttrSelected: (
      state,
      action: PayloadAction<PuyoAttr>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;
      const attr = action.payload;

      if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
        // TODO: リストなので追加削除できるようにする
        target.counting_bonus.target_attrs = [attr];
      }
    },

    explorationCountingBonusStepHeightChanged: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
        target.counting_bonus.step_height = action.payload;
      }
    },

    explorationCountingBonusCountChanged: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
        target.counting_bonus.bonus_count = action.payload;
      }
    },

    explorationCountingBonusStepRepeatCheckChanged: (
      state,
      action: PayloadAction<boolean>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
        target.counting_bonus.repeat = action.payload;
      }
    },

    /** 探索法の項目が選択されたとき */
    solutionMethodItemSelected: (
      state,
      action: PayloadAction<SolutionMethod>
    ) => {
      state.solutionMethod = action.payload;
    },

    /** ブーストエリアのキーリストが変更されたとき */
    boostAreaKeyListChanged: (state, action: PayloadAction<string[]>) => {
      const keyList = action.payload;
      state.boostAreaKeyList = keyList;
      state.simulationData.boostAreaCoordList = [
        ...keyList
          .map((key) => boostAreaKeyMap.get(key)?.coordSet)
          .filter(Boolean)
          .reduce((m, s) => unionSet(m!, s!), new Set<PuyoCoord>([]))!
          .keys()
      ];
    },

    /** 盤面編集が開始されたとき */
    boardEditingStarted: (state) => {
      state.isBoardEditing = true;
    },

    /** 盤面編集が終了されたとき */
    boardEditingEnded: (state) => {
      state.isBoardEditing = false;
    },

    /** 盤面編集の仕方が変更されたとき */
    howToEditBoardChanged: (state, action: PayloadAction<HowToEditBoard>) => {
      state.boardEditMode.howToEdit = action.payload;
    },

    /** 盤面編集時の変換先のぷよタイプが変更されたとき */
    boardEditCustomTypeChanged: (
      state,
      action: PayloadAction<PuyoType | undefined>
    ) => {
      state.boardEditMode.howToEdit = HowToEditBoard.ToCustomType;
      state.boardEditMode.customType = action.payload;
    },

    ///
    /// 最適解探索系
    ///

    /** 最適解探索が開始されたとき */
    solvingStarted: (state) => {
      state.solving = true;
      state.abortControllerForSolving = new AbortController();
      state.solvingProgressPercent = 0;
    },

    /** 解の途中経過 */
    solvingProgress: (
      state,
      action: PayloadAction<{ result: SolveResult; percent: number }>
    ) => {
      const { result, percent } = action.payload;

      state.solveResult = result;
      state.solvingProgressPercent = percent;
      state.optimalSolutionIndex = 0;
    },

    /** 解が求まったとき */
    solved: (state, action: PayloadAction<SolveResult>) => {
      const result = action.payload;
      state.solveResult = result;
      state.optimalSolutionIndex = 0;
      state.solving = false;
      state.solvingProgressPercent = 100.0;
      state.abortControllerForSolving = undefined;
    },

    /** 解を求めるのが失敗したとき */
    solveFailed: (state) => {
      state.solveResult = undefined;
      state.optimalSolutionIndex = -1;
      state.solving = false;
      state.solvingProgressPercent = 0.0;
      state.abortControllerForSolving = undefined;
    },

    /** 最適解計算をキャンセルするボタンがクリックされたとき */
    solveCancelButtonClicked: (state) => {
      state.abortControllerForSolving?.abort();
    },

    /** 最適解リセットボタンがクリックされたとき */
    solutionResetButtonClicked: (state) => {
      state.solveResult = undefined;
      state.optimalSolutionIndex = -1;
    },

    /** 解でなぞりボタンが押されたときの準備アクション */
    preparePlaySolutionButtonClicked: (state) => {
      state.simulationData.traceCoords =
        state.solveResult?.optimal_solutions[state.optimalSolutionIndex]
          .trace_coords ?? [];
    },

    /** 解のインデックスが変更されたとき */
    optimalSolutionIndexChanged: (state, action: PayloadAction<number>) => {
      state.optimalSolutionIndex = action.payload;
    },

    ///
    /// スクリーンショット系
    ///

    /** スクリーンショット画像を受け取ったとき */
    screenshotReceived: (state, action: PayloadAction<ScreenshotInfo>) => {
      if (state.screenshotInfo?.blobUrl) {
        URL.revokeObjectURL(state.screenshotInfo.blobUrl);
      }
      state.screenshotInfo = action.payload;
    },

    /** 盤面判定が完了したとき */
    boardDetected: (
      state,
      action: PayloadAction<{
        error?: string | undefined;
        board?: Board | undefined;
      }>
    ) => {
      const { error, board } = action.payload;
      state.screenshotErrorMessage = error;

      const bd = board ?? emptyBoard;
      state.lastScreenshotBoard = bd;
      state.boardId = customBoardId;
      state.simulationData = createSimulationData(
        bd,
        {},
        state.simulationData as any
      ) as any;
      state.animationSteps = [];
      state.isBoardEditing = false;
    },

    /** puyomist JSONを受け取ったとき */
    puyomistJsonDetected: (state, action: PayloadAction<PuyomistJson>) => {
      const puyomist = action.payload;
      state.screenshotErrorMessage = undefined;

      const bd = puyomist.board;
      state.lastScreenshotBoard = bd;
      state.boardId = customBoardId;
      state.boostAreaKeyList = puyomist.boostAreaKeyList;
      const boostAreaCoordList = [
        ...puyomist.boostAreaKeyList
          .map((key) => boostAreaKeyMap.get(key)?.coordSet)
          .filter(Boolean)
          .reduce((m, s) => unionSet(m!, s!), new Set<PuyoCoord>([]))!
          .keys()
      ];
      state.explorationTarget = puyomist.explorationTarget;
      state.simulationData = createSimulationData(
        bd,
        { boostAreaCoordList },
        state.simulationData as any
      ) as any;
      state.animationSteps = [];
      state.isBoardEditing = false;
    }
  }
});

export const {
  /// システム系
  hydrate,
  /// キャンバスアクション系
  tracingCoordAdded,
  tracingCanceled,
  puyoEdited,
  boardResetButtonClicked,
  /// 連鎖系
  chainAnimationStepBack,
  chainAnimationStepForward,
  chainAnimationStep,
  /// 設定系
  boardIdChanged,
  nextItemSelected,
  traceModeChanged,
  minimumPuyoNumForPoppingChanged,
  maxTraceNumChanged,
  poppingLeverageChanged,
  chainLeverageChanged,
  animationDurationChanged,
  explorationCategorySelected,
  explorationOptimalSolutionNumChanged,
  explorationPreferencePrioritiesChanged,
  explorationPreferenceReplaced,
  explorationPreferenceAdded,
  explorationDamageMainAttrSelected,
  explorationDamageSubAttrSelected,
  explorationDamageMainSubRatioSelected,
  explorationPuyoCountMainAttrSelected,
  explorationCountingBonusTypeSelected,
  explorationCountingBonusStepTargetAttrSelected,
  explorationCountingBonusStepHeightChanged,
  explorationCountingBonusCountChanged,
  explorationCountingBonusStepRepeatCheckChanged,
  solutionMethodItemSelected,
  boostAreaKeyListChanged,
  boardEditingStarted,
  boardEditingEnded,
  howToEditBoardChanged,
  boardEditCustomTypeChanged,
  /// 最適解探索系
  solvingStarted,
  solveCancelButtonClicked,
  solutionResetButtonClicked,
  optimalSolutionIndexChanged,
  /// スクリーンショット系
  screenshotReceived,
  boardDetected
} = puyoAppSlice.actions;

export const puyoAppReducer = puyoAppSlice.reducer;

///
/// Redux Thunk
///

/** 連鎖アニメーションを実行する */
export const doChainAnimation =
  () => async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(puyoAppSlice.actions.chainAnimationStarted());

    const getAnimationDuration = () => getState().puyoApp.animationDuration;
    const animationSteps = getState().puyoApp.animationSteps;

    for (let i = 0; i < animationSteps.length; i++) {
      if (i !== 0) {
        await sleep(getAnimationDuration());
      }
      dispatch(puyoAppSlice.actions.chainAnimationStep(i));
    }

    dispatch(puyoAppSlice.actions.chainAnimationEnded());
  };

/** なぞりが完了したとき */
export const tracingFinished =
  () => (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(puyoAppSlice.actions.chainStarted());

    const state = getState().puyoApp;
    const simulator = new Simulator(cloneSimulationData(state.simulationData));

    const animationSteps = simulator.doChains(true)!;

    dispatch(puyoAppSlice.actions.chainEnded(animationSteps));

    dispatch(doChainAnimation());
  };

/** 最適解探索ボタンがクリックされたとき */
export const solveButtonClicked =
  () => (dispatch: Dispatch, getState: () => RootState) => {
    const state = getState().puyoApp;
    if (state.solving) {
      return;
    }

    dispatch(solvingStarted());

    let solve: (
      signal: AbortSignal,
      onProgress?: (result: SolveResult, rate: number) => void
    ) => Promise<SolveResult>;

    switch (state.solutionMethod) {
      case SolutionMethod.solveAllInSerial:
        solve = createSolveAllInSerial(
          state.simulationData,
          state.explorationTarget
        );
        break;
      case SolutionMethod.solveAllInParallel:
        solve = createSolveAllInParallel(
          state.simulationData,
          state.explorationTarget
        );
        break;
      case SolutionMethod.solveAllInSerialByWasm:
        solve = createSolveAllInSerialByWasm(
          state.simulationData,
          state.explorationTarget
        );
        break;
      case SolutionMethod.solveAllInParallelByWasm:
        solve = createSolveAllInParallelByWasm(
          state.simulationData,
          state.explorationTarget
        );
        break;
    }

    (async () => {
      try {
        const signal = getState().puyoApp.abortControllerForSolving!.signal;
        const result = await solve(signal, (res, percent) => {
          dispatch(
            puyoAppSlice.actions.solvingProgress({ result: res, percent })
          );
        });
        dispatch(puyoAppSlice.actions.solved(result));
      } catch (_) {
        dispatch(puyoAppSlice.actions.solveFailed());
      }
    })();
  };

/** 最適解でなぞるボタンがクリックされたとき */
export const playSolutionButtonClicked =
  () => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState().puyoApp;

    if (!state.solveResult?.optimal_solutions.length) {
      return;
    }

    dispatch(puyoAppSlice.actions.preparePlaySolutionButtonClicked());
    dispatch(tracingFinished());
  };

/** 盤面判定が完了したら自動で最適解探索 */
export const boardDetectedAndSolve =
  (error?: string | undefined, board?: Board | undefined) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(boardDetected({ error, board }));
    dispatch(solutionResetButtonClicked());
    if (!getState().puyoApp.screenshotErrorMessage) {
      dispatch(solveButtonClicked());
    }
  };

/** puyomist JSONを受け取ったら自動で最適解探索 */
export const puyomistJsonDetectedAndSolve =
  (json: PuyomistJson) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(puyoAppSlice.actions.puyomistJsonDetected(json));
    dispatch(solutionResetButtonClicked());
    if (!getState().puyoApp.screenshotErrorMessage) {
      dispatch(solveButtonClicked());
    }
  };
