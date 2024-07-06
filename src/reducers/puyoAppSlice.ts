import {
  type Dispatch,
  type PayloadAction,
  createSlice
} from '@reduxjs/toolkit';
import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import { type Board, emptyBoard } from '../logics/Board';
import { type BoardEditMode, HowToEditBoard } from '../logics/BoardEditMode';
import { getBoostArea } from '../logics/BoostArea';
import type { OptimizationTarget } from '../logics/OptimizationTarget';
import { PuyoCoord } from '../logics/PuyoCoord';
import { Simulator } from '../logics/Simulator';
import type { TraceMode } from '../logics/TraceMode';
import { screenshotBoardId } from '../logics/boards';
import type { ChainDamage } from '../logics/damage';
import {
  PuyoType,
  toChanceColoredType,
  toNormalColoredType,
  toPlusColoredType
} from '../logics/puyo';
import { type ExplorationResult, SolutionMethod } from '../logics/solution';
import { INITIAL_PUYO_APP_STATE, type PuyoAppState } from './PuyoAppState';
import { reflectBoardInSimulator } from './internal/reflectBoardInSimulator';
import { reflectNextInSimulator } from './internal/reflectNextInSimulator';
import {
  createSolveAllInParallel,
  createSolveAllInSerial
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
      state.simulator.addTracingPuyo(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** なぞり消しがキャンセルされたとき */
    tracingCanceled: (state) => {
      state.simulator.clearTraceCoords();
      state.simulator = state.simulator.clone();
    },

    /** アニメーションが開始したとき */
    animationStart: (state) => {
      state.animating = true;
    },

    /** アニメーションステップ(連鎖の1コマ)が発生したとき */
    animationStep: (
      state,
      action: PayloadAction<{ simulator: Simulator; damages: ChainDamage[] }>
    ) => {
      const { simulator, damages } = action.payload;
      state.chainDamages = [...damages];
      state.simulator = simulator.clone();
    },

    /** アニメーションが終了したとき */
    animationEnd: (
      state,
      action: PayloadAction<{ simulator: Simulator; damages: ChainDamage[] }>
    ) => {
      const { simulator, damages } = action.payload;
      state.chainDamages = [...damages];
      state.animating = false;
      state.simulator = simulator.clone();
    },

    /** 盤面(ネクストを含む)内のぷよが編集されたとき */
    puyoEdited: (
      state,
      action: PayloadAction<{ fieldCoord?: PuyoCoord; nextX?: number }>
    ) => {
      if (!state.lastScreenshotBoard || !state.boardEditMode) {
        return;
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

      const setTargetPuyoType = (puyoType: PuyoType) => {
        if (fieldCoord) {
          const coord = fieldCoord;
          state.lastScreenshotBoard!.field[coord.y][coord.x] = puyoType;
        } else {
          state.lastScreenshotBoard!.nextPuyos![nextX!] = puyoType;
        }
      };

      const { howToEdit, customType } = state.boardEditMode!;
      const prevType = getTargetPuyoType();

      if (howToEdit !== HowToEditBoard.ToCustomType && !prevType) {
        return;
      }
      if (howToEdit === HowToEditBoard.ToCustomType && !customType) {
        return;
      }

      switch (howToEdit) {
        case HowToEditBoard.ToNormal:
          setTargetPuyoType(toNormalColoredType(prevType!));
          break;
        case HowToEditBoard.ToChance:
          setTargetPuyoType(toChanceColoredType(prevType!));
          break;
        case HowToEditBoard.ToPlus:
          setTargetPuyoType(toPlusColoredType(prevType!));
          break;
        case HowToEditBoard.ToCustomType:
          setTargetPuyoType(customType!);
          break;
      }

      state.boardId = screenshotBoardId;
      state.simulator.resetWithBoard(state.lastScreenshotBoard);
      state.simulator = state.simulator.clone();
    },

    /** 盤面リセットボタンがクリックされたとき */
    boardResetButtonClicked: (state) => {
      if (state.boardId === screenshotBoardId) {
        if (state.lastScreenshotBoard) {
          state.simulator.resetWithBoard(state.lastScreenshotBoard);
        }
      } else {
        reflectBoardInSimulator(state.simulator as Simulator, state.boardId);
        reflectNextInSimulator(
          state.simulator as Simulator,
          state.nextSelection
        );
      }
      state.simulator = state.simulator.clone();
      state.chainDamages = [];
    },

    ///
    /// 設定系
    ///

    /** 盤面IDが変更されたとき */
    boardIdChanged: (state, action: PayloadAction<string>) => {
      const boardId = action.payload;
      state.boardId = boardId;

      if (boardId === screenshotBoardId) {
        if (state.lastScreenshotBoard) {
          state.simulator.resetWithBoard(state.lastScreenshotBoard);
          state.simulator = state.simulator.clone();
        }
      } else {
        reflectBoardInSimulator(state.simulator as Simulator, boardId);
        state.simulator = state.simulator.clone();
      }
    },

    /** ネクストの項目が選択されたとき */
    nextItemSelected: (state, action: PayloadAction<string>) => {
      const nextSelection = action.payload;
      state.nextSelection = nextSelection;
      reflectNextInSimulator(state.simulator as Simulator, nextSelection);
      state.simulator = state.simulator.clone();
    },

    /** なぞり消しモードの項目が選択されたとき */
    traceModeItemSelected: (state, action: PayloadAction<TraceMode>) => {
      state.simulator.setTraceMode(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** ぷよが消えるのに必要な個数が変更されたとき */
    minimumPuyoNumForPoppingChanged: (state, action: PayloadAction<number>) => {
      state.simulator.setMinimumPuyoNumForPopping(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** 最大なぞり数が変更されたとき */
    maxTraceNumChanged: (state, action: PayloadAction<number>) => {
      state.simulator.setMaxTraceNum(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** なぞり消し倍率が変更されたとき */
    poppingLeverageChanged: (state, action: PayloadAction<number>) => {
      state.simulator.setPoppingLeverage(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** 連鎖倍率が変更されたとき */
    chainLeverageChanged: (state, action: PayloadAction<number>) => {
      state.simulator.setChainLeverage(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** アニメーション時間間隔が変更されたとき */
    animationDurationChanged: (state, action: PayloadAction<number>) => {
      state.simulator.setAnimationDuration(action.payload);
      state.simulator = state.simulator.clone();
    },

    /** 最適化対象の項目が選択されたとき */
    optimizationTargetItemSelected: (
      state,
      action: PayloadAction<OptimizationTarget>
    ) => {
      state.optimizationTarget = action.payload;
    },

    /** 探索法の項目が選択されたとき */
    solutionMethodItemSelected: (
      state,
      action: PayloadAction<SolutionMethod>
    ) => {
      state.solutionMethod = action.payload;
    },

    /** ブーストエリアのチェックが変更されたとき */
    boostAreaKeyCheckedChanged: (
      state,
      action: PayloadAction<{ key: string; checked: boolean }>
    ) => {
      const { key, checked } = action.payload;
      const keyList = [...state.boostAreaKeyList];

      if (checked && !keyList.includes(key)) {
        keyList.push(key);
      } else if (!checked && keyList.includes(key)) {
        const i = keyList.indexOf(key);
        keyList.splice(i, 1);
      }

      state.simulator.setBoostAreaCoordSetList(
        keyList
          .map((key) => getBoostArea(key)?.coordSet)
          .filter(Boolean) as ReadonlySet<PuyoCoord>[]
      );
      state.simulator = state.simulator.clone();
      state.boostAreaKeyList = keyList;
    },

    /** 盤面編集の仕方の項目が変更されたとき */
    howToEditBoardItemSelected: (
      state,
      action: PayloadAction<HowToEditBoard>
    ) => {
      const howToEdit = action.payload;
      const mode: BoardEditMode = {
        howToEdit,
        customType: state.boardEditMode?.customType ?? PuyoType.Red
      };
      state.boardEditMode = mode;
    },

    /** 盤面編集時の変換先のぷよタイプ項目が選択されたとき */
    boardEditCustomTypeItemSelected: (
      state,
      action: PayloadAction<PuyoType>
    ) => {
      const customType = action.payload;
      const mode: BoardEditMode = {
        howToEdit: HowToEditBoard.ToCustomType,
        customType
      };
      state.boardEditMode = mode;
    },

    ///
    /// 最適解探索系
    ///

    /** 最適解探索が開始されたとき */
    solvingStarted: (state) => {
      state.solving = true;
    },

    /** 解が求まったとき */
    solved: (state, action: PayloadAction<ExplorationResult | undefined>) => {
      const result = action.payload;

      if (result?.optimalSolution) {
        // ワーカー経由で壊れてしまう座標を修正する。
        result.optimalSolution.traceCoords =
          result.optimalSolution.traceCoords.map(
            (c: any) => PuyoCoord.xyToCoord(c._x, c._y)!
          );
      }

      state.explorationResult = result;
      state.solving = false;
    },

    /** 最適解リセットボタンがクリックされたとき */
    solutionResetButtonClicked: (state) => {
      state.explorationResult = undefined;
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
      state.boardId = screenshotBoardId;
      state.simulator.resetWithBoard(bd);
      state.simulator = state.simulator.clone();
    }
  }
});

export const {
  /// システム系
  hydrate,
  /// キャンバスアクション系
  tracingCoordAdded,
  tracingCanceled,
  animationStart,
  animationStep,
  animationEnd,
  puyoEdited,
  boardResetButtonClicked,
  /// 設定系
  boardIdChanged,
  nextItemSelected,
  traceModeItemSelected,
  minimumPuyoNumForPoppingChanged,
  maxTraceNumChanged,
  poppingLeverageChanged,
  chainLeverageChanged,
  animationDurationChanged,
  optimizationTargetItemSelected,
  solutionMethodItemSelected,
  boostAreaKeyCheckedChanged,
  howToEditBoardItemSelected,
  boardEditCustomTypeItemSelected,
  /// 最適解探索系
  solvingStarted,
  solved,
  solutionResetButtonClicked,
  /// スクリーンショット系
  screenshotReceived,
  boardDetected
} = puyoAppSlice.actions;

export const puyoAppReducer = puyoAppSlice.reducer;

///
/// Redux Thunk
///

/** なぞりが完了したとき */
export const tracingFinished =
  () => (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(animationStart());

    const simulator = new Simulator(getState().puyoApp.simulator);

    simulator.doChains({
      onAnimateStep: (simulator: Simulator, damages: ChainDamage[]) => {
        dispatch(animationStep({ simulator, damages }));
      },
      onAnimateEnd: (simulator: Simulator, damages: ChainDamage[]) => {
        dispatch(animationEnd({ simulator, damages }));
      }
    });
  };

/** 最適解探索ボタンがクリックされたとき */
export const solveButtonClicked =
  () => (dispatch: Dispatch, getState: () => RootState) => {
    const state = getState().puyoApp;
    if (state.solving) {
      return;
    }

    dispatch(solvingStarted());

    let solve: () => Promise<ExplorationResult | undefined>;

    switch (state.solutionMethod) {
      case SolutionMethod.solveAllInSerial:
        solve = createSolveAllInSerial(
          state.simulator,
          state.optimizationTarget
        );
        break;
      case SolutionMethod.solveAllInParallel:
        solve = createSolveAllInParallel(
          state.simulator,
          state.optimizationTarget
        );
        break;
    }

    (async () => {
      const result = await solve();
      dispatch(solved(result));
    })();
  };

/** 最適解でなぞるボタンがクリックされたとき */
export const playSolutionButtonClicked =
  () => (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState().puyoApp;
    const optimalSolution = state.explorationResult?.optimalSolution;
    if (!optimalSolution) {
      return;
    }

    state.simulator.setTraceCoords(optimalSolution.traceCoords);

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
