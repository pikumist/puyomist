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
  type PreferenceKind,
  wildAttribute
} from '../logics/ExplorationTarget';
import {
  type ColoredPuyoAttribute,
  PuyoAttribute
} from '../logics/PuyoAttribute';
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
      state.simulationData.animationDuration = action.payload;
    },

    /** 最適化対象カテゴリーの項目が選択されたとき */
    explorationCategorySelected: (
      state,
      action: PayloadAction<ExplorationCategory>
    ) => {
      const common = {
        preferencePriorities: state.explorationTarget.preferencePriorities
      };
      switch (action.payload) {
        case ExplorationCategory.Damage:
          state.explorationTarget = {
            ...common,
            category: ExplorationCategory.Damage,
            mainAttr: PuyoAttribute.Red
          };
          break;
        case ExplorationCategory.SkillPuyoCount:
          state.explorationTarget = {
            ...common,
            category: ExplorationCategory.SkillPuyoCount,
            mainAttr: PuyoAttribute.Red
          };
          break;
        case ExplorationCategory.PuyotsukaiCount:
          state.explorationTarget = {
            ...common,
            category: ExplorationCategory.PuyotsukaiCount
          };
      }
    },

    /** 探索対象の優先度に変更があったとき */
    explorationPreferencePrioritiesChanged: (
      state,
      action: PayloadAction<PreferenceKind[]>
    ) => {
      state.explorationTarget.preferencePriorities = action.payload;
    },

    /** ダメージの主属性項目が選択されたとき */
    explorationDamageMainAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttribute | typeof wildAttribute>
    ) => {
      const mainAttr = action.payload;
      const target = state.explorationTarget as ExplorationTargetDamage;

      if (mainAttr === wildAttribute || target.subAttr === mainAttr) {
        target.subAttr = undefined;
      }
      target.mainAttr = mainAttr;
    },

    /** ダメージの副属性項目が選択されたとき */
    explorationDamageSubAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttribute | undefined>
    ) => {
      const subAttr = action.payload;
      const target = state.explorationTarget as ExplorationTargetDamage;

      target.subAttr = target.mainAttr === subAttr ? undefined : subAttr;
    },

    /** ダメージの副属性ダメージ率項目が選択されたとき */
    explorationDamageMainSubRatioSelected: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.explorationTarget as ExplorationTargetDamage;
      target.mainSubRatio = action.payload;
    },

    /** ぷよ数の主属性項目が選択されたとき */
    explorationPuyoCountMainAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttribute>
    ) => {
      const mainAttr = action.payload;
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      target.mainAttr = mainAttr;
    },

    /** ぷよ数のボーナスタイプ項目が選択されたとき */
    explorationCountingBonusTypeSelected: (
      state,
      action: PayloadAction<CountingBonusType | undefined>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;
      const bonusType = action.payload;

      if (bonusType === CountingBonusType.Step) {
        target.countingBonus = {
          type: bonusType,
          targetAttrs: [PuyoAttribute.Red],
          stepHeight: 4,
          bonusCount: 4,
          repeat: true
        };
      } else {
        target.countingBonus = undefined;
      }
    },

    explorationCountingBonusStepTargetAttrSelected: (
      state,
      action: PayloadAction<PuyoAttribute>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;
      const attr = action.payload;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        // TODO: リストなので追加削除できるようにする
        target.countingBonus.targetAttrs = [attr];
      }
    },

    explorationCountingBonusStepHeightChanged: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        target.countingBonus.stepHeight = action.payload;
      }
    },

    explorationCountingBonusCountChanged: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        target.countingBonus.bonusCount = action.payload;
      }
    },

    explorationCountingBonusStepRepeatCheckChanged: (
      state,
      action: PayloadAction<boolean>
    ) => {
      const target = state.explorationTarget as ExplorationTargetSkillPuyoCount;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        target.countingBonus.repeat = action.payload;
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
    },

    /** 解が求まったとき */
    solved: (state, action: PayloadAction<SolveResult>) => {
      const result = action.payload;

      if (result.optimalSolution) {
        // ワーカー経由で壊れてしまう座標を修正する。
        result.optimalSolution.trace_coords =
          result.optimalSolution.trace_coords.map(
            (c: any) => PuyoCoord.xyToCoord(c._x, c._y)!
          );
      }

      state.solveResult = result;
      state.solving = false;
      state.abortControllerForSolving = undefined;
    },

    /** 解を求めるのが失敗したとき */
    solveFailed: (state) => {
      state.solveResult = undefined;
      state.solving = false;
      state.abortControllerForSolving = undefined;
    },

    /** 最適解計算をキャンセルするボタンがクリックされたとき */
    solveCancelButtonClicked: (state) => {
      state.abortControllerForSolving?.abort();
    },

    /** 最適解リセットボタンがクリックされたとき */
    solutionResetButtonClicked: (state) => {
      state.solveResult = undefined;
    },

    /** 解でなぞりボタンが押されたときの準備アクション */
    preparePlaySolutionButtonClicked: (state) => {
      state.simulationData.traceCoords =
        state.solveResult?.optimalSolution?.trace_coords ?? [];
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
  explorationPreferencePrioritiesChanged,
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

    const getAnimationDuration = () =>
      getState().puyoApp.simulationData.animationDuration;
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

    let solve: (signal: AbortSignal) => Promise<SolveResult>;

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
        const result = await solve(signal);

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
    const optimalSolution = state.solveResult?.optimalSolution;
    if (!optimalSolution) {
      return;
    }

    dispatch(puyoAppSlice.actions.preparePlaySolutionButtonClicked());
    dispatch(tracingFinished());
  };

/** 盤面判定が完了したら自動で最適化計算 */
export const boardDetectedAndSolve =
  (error?: string | undefined, board?: Board | undefined) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(boardDetected({ error, board }));
    dispatch(solutionResetButtonClicked());
    if (!getState().puyoApp.screenshotErrorMessage) {
      dispatch(solveButtonClicked());
    }
  };
