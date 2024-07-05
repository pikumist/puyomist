import {
  type Dispatch,
  type PayloadAction,
  createSlice
} from '@reduxjs/toolkit';
import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import { type Board, emptyBoard } from '../logics/Board';
import { type BoardEditMode, HowToEditBoard } from '../logics/BoardEditMode';
import { getBoostArea } from '../logics/BoostArea';
import { Field } from '../logics/Field';
import type { OptimizationTarget } from '../logics/OptimizationTarget';
import { PuyoCoord } from '../logics/PuyoCoord';
import type { TraceMode } from '../logics/TraceMode';
import { screenshotBoardId } from '../logics/boards';
import type { ChainDamage } from '../logics/damage';
import {
  PuyoType,
  toChanceColoredType,
  toNormalColoredType,
  toPlusColoredType
} from '../logics/puyo';
import { SolutionMethod, type SolvedResult } from '../logics/solution';
import { INITIAL_PUYO_APP_STATE, type PuyoAppState } from './PuyoAppState';
import { reflectBoardInField } from './internal/reflectBoardInField';
import { reflectNextInField } from './internal/reflectNextInField';
import { createSolve2, createSolve3 } from './internal/solve';
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
      state.field.addTracingPuyo(action.payload);
      state.field = state.field.clone();
    },

    /** なぞり消しがキャンセルされたとき */
    tracingCanceled: (state) => {
      state.field.clearTraceCoords();
      state.field = state.field.clone();
    },

    /** アニメーションが開始したとき */
    animationStart: (state) => {
      state.animating = true;
    },

    /** アニメーションステップ(連鎖の1コマ)が発生したとき */
    animationStep: (
      state,
      action: PayloadAction<{ field: Field; damages: ChainDamage[] }>
    ) => {
      const { field, damages } = action.payload;
      state.chainDamages = [...damages];
      state.field = field.clone();
    },

    /** アニメーションが終了したとき */
    animationEnd: (
      state,
      action: PayloadAction<{ field: Field; damages: ChainDamage[] }>
    ) => {
      const { field, damages } = action.payload;
      state.chainDamages = [...damages];
      state.animating = false;
      state.field = field.clone();
    },

    /** 盤面(ネクストを含む)内のぷよが編集されたとき */
    puyoEdited: (
      state,
      action: PayloadAction<{ matrixCoord?: PuyoCoord; nextX?: number }>
    ) => {
      if (!state.lastScreenshotBoard || !state.boardEditMode) {
        return;
      }

      const { matrixCoord, nextX } = action.payload;

      if (!matrixCoord && !Number.isInteger(nextX)) {
        return;
      }

      const getTargetPuyoType = () => {
        if (matrixCoord) {
          const coord = matrixCoord;
          return state.lastScreenshotBoard!.matrix[coord.y][coord.x];
        }
        return state.lastScreenshotBoard!.nextPuyos![nextX!];
      };

      const setTargetPuyoType = (puyoType: PuyoType) => {
        if (matrixCoord) {
          const coord = matrixCoord;
          state.lastScreenshotBoard!.matrix[coord.y][coord.x] = puyoType;
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
      state.field.resetFieldByBoard(state.lastScreenshotBoard);
      state.field = state.field.clone();
    },

    /** 盤面リセットボタンがクリックされたとき */
    boardResetButtonClicked: (state) => {
      if (state.boardId === screenshotBoardId) {
        if (state.lastScreenshotBoard) {
          state.field.resetFieldByBoard(state.lastScreenshotBoard);
        }
      } else {
        reflectBoardInField(state.field as Field, state.boardId);
        reflectNextInField(state.field as Field, state.nextSelection);
      }
      state.field = state.field.clone();
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
          state.field.resetFieldByBoard(state.lastScreenshotBoard);
          state.field = state.field.clone();
        }
      } else {
        reflectBoardInField(state.field as Field, boardId);
        state.field = state.field.clone();
      }
    },

    /** ネクストの項目が選択されたとき */
    nextItemSelected: (state, action: PayloadAction<string>) => {
      const nextSelection = action.payload;
      state.nextSelection = nextSelection;
      reflectNextInField(state.field as Field, nextSelection);
      state.field = state.field.clone();
    },

    /** なぞり消しモードの項目が選択されたとき */
    traceModeItemSelected: (state, action: PayloadAction<TraceMode>) => {
      state.field.setTraceMode(action.payload);
      state.field = state.field.clone();
    },

    /** ぷよが消えるのに必要な個数が変更されたとき */
    minimumPuyoNumForPoppingChanged: (state, action: PayloadAction<number>) => {
      state.field.setMinimumPuyoNumForPopping(action.payload);
      state.field = state.field.clone();
    },

    /** 最大なぞり数が変更されたとき */
    maxTraceNumChanged: (state, action: PayloadAction<number>) => {
      state.field.setMaxTraceNum(action.payload);
      state.field = state.field.clone();
    },

    /** なぞり消し倍率が変更されたとき */
    poppingLeverageChanged: (state, action: PayloadAction<number>) => {
      state.field.setPoppingLeverage(action.payload);
      state.field = state.field.clone();
    },

    /** 連鎖倍率が変更されたとき */
    chainLeverageChanged: (state, action: PayloadAction<number>) => {
      state.field.setChainLeverage(action.payload);
      state.field = state.field.clone();
    },

    /** アニメーション時間間隔が変更されたとき */
    animationDurationChanged: (state, action: PayloadAction<number>) => {
      state.field.setAnimationDuration(action.payload);
      state.field = state.field.clone();
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

      state.field.setBoostAreaCoordSetList(
        keyList
          .map((key) => getBoostArea(key)?.coordSet)
          .filter(Boolean) as ReadonlySet<PuyoCoord>[]
      );
      state.field = state.field.clone();
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
    solved: (state, action: PayloadAction<SolvedResult | undefined>) => {
      const solvedResult = action.payload;

      if (solvedResult?.optimalSolution) {
        // ワーカー経由で壊れてしまう座標を修正する。
        solvedResult.optimalSolution.traceCoords =
          solvedResult.optimalSolution.traceCoords.map(
            (c: any) => PuyoCoord.xyToCoord(c._x, c._y)!
          );
      }

      state.solvedResult = solvedResult;
      state.solving = false;
    },

    /** 最適解リセットボタンがクリックされたとき */
    solutionResetButtonClicked: (state) => {
      state.solvedResult = undefined;
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
      state.field.resetFieldByBoard(bd);
      state.field = state.field.clone();
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

    const field = new Field(getState().puyoApp.field);

    field.continueChainsToTheEnd({
      onAnimateField: (field: Field, damages: ChainDamage[]) => {
        dispatch(animationStep({ field, damages }));
      },
      onAnimateEnd: (field: Field, damages: ChainDamage[]) => {
        dispatch(animationEnd({ field, damages }));
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

    let solve: () => Promise<SolvedResult | undefined>;

    switch (state.solutionMethod) {
      case SolutionMethod.solve2:
        solve = createSolve2(state.field, state.optimizationTarget);
        break;
      case SolutionMethod.solve3:
        solve = createSolve3(state.field, state.optimizationTarget);
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
    const optimalSolution = state.solvedResult?.optimalSolution;
    if (!optimalSolution) {
      return;
    }

    state.field.setTraceCoords(optimalSolution.traceCoords);

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
