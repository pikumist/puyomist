import {
  type Dispatch,
  type PayloadAction,
  createSlice
} from '@reduxjs/toolkit';
import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import { type Board, emptyBoard } from '../logics/Board';
import { type BoardEditMode, HowToEditBoard } from '../logics/BoardEditMode';
import { getBoostArea } from '../logics/BoostArea';
import type { Chain } from '../logics/Chain';
import {
  AllClearPreference,
  CountingBonusType,
  OptimizationCategory,
  type OptimizationDamageTarget,
  type OptimizationPuyoCountTarget
} from '../logics/OptimizationTarget';
import {
  type ColoredPuyoAttribute,
  PuyoAttribute
} from '../logics/PuyoAttribute';
import { PuyoCoord } from '../logics/PuyoCoord';
import {
  PuyoType,
  isTraceablePuyo,
  toChanceColoredType,
  toNormalColoredType,
  toPlusColoredType
} from '../logics/PuyoType';
import {
  type SimulationData,
  cloneSimulationData
} from '../logics/SimulationData';
import { Simulator } from '../logics/Simulator';
import type { TraceMode } from '../logics/TraceMode';
import { customBoardId, getSpecialBoard } from '../logics/boards';
import { unionSet } from '../logics/generics/set';
import { type ExplorationResult, SolutionMethod } from '../logics/solution';
import { INITIAL_PUYO_APP_STATE, type PuyoAppState } from './PuyoAppState';
import { createNextPuyos } from './internal/createNextPuyos';
import { createSimulationData } from './internal/createSimulationData';
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

    /** アニメーションが開始したとき */
    animationStart: (state) => {
      state.animating = true;
      state.lastTraceCoords = [...state.simulationData.traceCoords];
    },

    /** アニメーションステップ(連鎖の1コマ)が発生したとき */
    animationStep: (
      state,
      action: PayloadAction<{
        simulationData: SimulationData;
        chains: Chain[];
      }>
    ) => {
      const { simulationData, chains } = action.payload;
      state.chains = chains;
      state.simulationData = simulationData;
    },

    /** アニメーションが終了したとき */
    animationEnd: (
      state,
      action: PayloadAction<{ simulationData: SimulationData; chains: Chain[] }>
    ) => {
      const { simulationData, chains } = action.payload;
      state.chains = chains;
      state.animating = false;
      state.simulationData = simulationData;
    },

    /** 盤面(ネクストを含む)内のぷよが編集されたとき */
    puyoEdited: (
      state,
      action: PayloadAction<{ fieldCoord?: PuyoCoord; nextX?: number }>
    ) => {
      if (!state.boardEditMode) {
        return;
      }

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

      state.chains = [];
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
        state.simulationData = createSimulationData(
          board,
          {},
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
    },

    /** ネクストの項目が選択されたとき */
    nextItemSelected: (state, action: PayloadAction<string>) => {
      const nextSelection = action.payload;
      state.nextSelection = nextSelection;
      const nextPuyos = createNextPuyos(nextSelection);
      state.simulationData.nextPuyos = nextPuyos;
    },

    /** なぞり消しモードの項目が選択されたとき */
    traceModeItemSelected: (state, action: PayloadAction<TraceMode>) => {
      state.simulationData.traceMode = action.payload;
    },

    /** ぷよが消えるのに必要な個数が変更されたとき */
    minimumPuyoNumForPoppingChanged: (state, action: PayloadAction<number>) => {
      state.simulationData.minimumPuyoNumForPopping = action.payload;
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
    optCategorySelected: (
      state,
      action: PayloadAction<OptimizationCategory>
    ) => {
      switch (action.payload) {
        case OptimizationCategory.Damage:
          state.optimizationTarget = {
            allClearPreference: AllClearPreference.PreferIfBestValue,
            category: OptimizationCategory.Damage,
            mainAttr: PuyoAttribute.Red
          };
          break;
        case OptimizationCategory.PuyoCount:
          state.optimizationTarget = {
            allClearPreference: AllClearPreference.PreferIfBestValue,
            category: OptimizationCategory.PuyoCount,
            mainAttr: PuyoAttribute.Red
          };
          break;
        case OptimizationCategory.PuyotsukaiCount:
          state.optimizationTarget = {
            allClearPreference: AllClearPreference.PreferIfBestValue,
            category: OptimizationCategory.PuyotsukaiCount
          };
      }
    },

    optAllClearPreferenceSelected: (
      state,
      action: PayloadAction<AllClearPreference>
    ) => {
      state.optimizationTarget.allClearPreference = action.payload;
    },

    /** ダメージの主属性項目が選択されたとき */
    optDamageMainAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttribute>
    ) => {
      const mainAttr = action.payload;
      const target = state.optimizationTarget as OptimizationDamageTarget;

      if (target.subAttr === mainAttr) {
        target.subAttr = undefined;
      }
      target.mainAttr = mainAttr;
    },

    /** ダメージの副属性項目が選択されたとき */
    optDamageSubAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttribute | undefined>
    ) => {
      const subAttr = action.payload;
      const target = state.optimizationTarget as OptimizationDamageTarget;

      target.subAttr = target.mainAttr === subAttr ? undefined : subAttr;
    },

    /** ダメージの副属性ダメージ率項目が選択されたとき */
    optDamageMainSubRatioSelected: (state, action: PayloadAction<number>) => {
      const target = state.optimizationTarget as OptimizationDamageTarget;
      target.mainSubRatio = action.payload;
    },

    /** ぷよ数の主属性項目が選択されたとき */
    optPuyoCountMainAttrSelected: (
      state,
      action: PayloadAction<ColoredPuyoAttribute>
    ) => {
      const mainAttr = action.payload;
      const target = state.optimizationTarget as OptimizationPuyoCountTarget;

      target.mainAttr = mainAttr;
    },

    /** ぷよ数のボーナスタイプ項目が選択されたとき */
    optCountingBonusTypeSelected: (
      state,
      action: PayloadAction<CountingBonusType | undefined>
    ) => {
      const target = state.optimizationTarget as OptimizationPuyoCountTarget;
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

    optCountingBonusStepTargetAttrSelected: (
      state,
      action: PayloadAction<PuyoAttribute>
    ) => {
      const target = state.optimizationTarget as OptimizationPuyoCountTarget;
      const attr = action.payload;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        // TODO: リストなので追加削除できるようにする
        target.countingBonus.targetAttrs = [attr];
      }
    },

    optCountingBonusStepHeightChanged: (
      state,
      action: PayloadAction<number>
    ) => {
      const target = state.optimizationTarget as OptimizationPuyoCountTarget;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        target.countingBonus.stepHeight = action.payload;
      }
    },

    optCountingBonusCountChanged: (state, action: PayloadAction<number>) => {
      const target = state.optimizationTarget as OptimizationPuyoCountTarget;

      if (target.countingBonus?.type === CountingBonusType.Step) {
        target.countingBonus.bonusCount = action.payload;
      }
    },

    optCountingBonusStepRepeatCheckChanged: (
      state,
      action: PayloadAction<boolean>
    ) => {
      const target = state.optimizationTarget as OptimizationPuyoCountTarget;

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

      state.boostAreaKeyList = keyList;
      state.simulationData.boostAreaCoordList = [
        ...keyList
          .map((key) => getBoostArea(key)?.coordSet)
          .filter(Boolean)
          .reduce((m, s) => unionSet(m!, s!), new Set<PuyoCoord>([]))!
          .keys()
      ];
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

    /** 解でなぞりボタンが押されたときの準備アクション */
    preparePlaySolutionButtonClicked: (state) => {
      state.simulationData.traceCoords =
        state.explorationResult?.optimalSolution?.traceCoords ?? [];
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
  /// 設定系
  boardIdChanged,
  nextItemSelected,
  traceModeItemSelected,
  minimumPuyoNumForPoppingChanged,
  maxTraceNumChanged,
  poppingLeverageChanged,
  chainLeverageChanged,
  animationDurationChanged,
  optCategorySelected,
  optAllClearPreferenceSelected,
  optDamageMainAttrSelected,
  optDamageSubAttrSelected,
  optDamageMainSubRatioSelected,
  optPuyoCountMainAttrSelected,
  optCountingBonusTypeSelected,
  optCountingBonusStepTargetAttrSelected,
  optCountingBonusStepHeightChanged,
  optCountingBonusCountChanged,
  optCountingBonusStepRepeatCheckChanged,
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
    dispatch(puyoAppSlice.actions.animationStart());

    const state = getState().puyoApp;
    const simulator = new Simulator(cloneSimulationData(state.simulationData));

    // TODO:
    // dispatchするとaction引数のオブジェクトがfreeze(readonly状態)するので、
    // Simulatorでデータ操作する際にエラーになってしまう。
    // 全て計算してから途中状態も合わせて一回のみコールバックする形にすべきか？

    simulator.doChains({
      onAnimateStep: (simulationData: SimulationData, chains: Chain[]) => {
        dispatch(
          puyoAppSlice.actions.animationStep({
            simulationData: cloneSimulationData(simulationData),
            chains: [...chains]
          })
        );
      },
      onAnimateEnd: (simulationData: SimulationData, chains: Chain[]) => {
        dispatch(
          puyoAppSlice.actions.animationEnd({
            simulationData: cloneSimulationData(simulationData),
            chains: [...chains]
          })
        );
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
          state.simulationData,
          state.optimizationTarget
        );
        break;
      case SolutionMethod.solveAllInParallel:
        solve = createSolveAllInParallel(
          state.simulationData,
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
