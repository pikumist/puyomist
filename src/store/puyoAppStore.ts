import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
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
  convertPuyoType,
  isTraceablePuyo,
  toChanceColoredType,
  toNormalColoredType,
  toPlusColoredType
} from '../logics/PuyoType';
import { TraceMode } from '../logics/TraceMode';
import type { PuyomistJson } from '../logics/app-json';
import { customBoardId, getSpecialBoard } from '../logics/boards';
import type {
  PaintSearchResult,
  PaintSearchSettings
} from '../logics/paint-search';
import { unionSet } from '../logics/generics/set';
import type { SolutionMethod, SolveResult } from '../logics/solution';
import { createNextPuyos } from './internal/createNextPuyos';
import { createSimulationData } from './internal/createSimulationData';
import { INITIAL_PUYO_APP_STATE, type PuyoAppState } from './types';

interface PuyoAppActions {
  /// システム系
  hydrate: (payload: PuyoAppState) => void;

  /// キャンバスアクション系
  tracingCoordAdded: (coord: PuyoCoord) => void;
  tracingCanceled: () => void;
  puyoEdited: (payload: { fieldCoord?: PuyoCoord; nextX?: number }) => void;
  boardResetButtonClicked: () => void;

  /// 連鎖系
  chainStarted: () => void;
  chainEnded: (animationSteps: AnimationStep[]) => void;
  chainAnimationStarted: () => void;
  chainAnimationStepBack: () => void;
  chainAnimationStepForward: () => void;
  chainAnimationStep: (index: number) => void;
  chainAnimationEnded: () => void;

  /// 設定系
  boardIdChanged: (boardId: string) => void;
  nextItemSelected: (nextSelection: string) => void;
  traceModeChanged: (traceMode: TraceMode) => void;
  minimumPuyoNumForPoppingChanged: (num: number) => void;
  maxTraceNumChanged: (maxTraceNum: number) => void;
  poppingLeverageChanged: (leverage: number) => void;
  chainLeverageChanged: (leverage: number) => void;
  animationDurationChanged: (duration: number) => void;
  explorationCategorySelected: (category: ExplorationCategory) => void;
  explorationOptimalSolutionNumChanged: (num: number) => void;
  explorationPreferencePrioritiesChanged: (
    priorities: PreferenceKind[]
  ) => void;
  explorationPreferenceReplaced: (payload: {
    from: PreferenceKind;
    to: PreferenceKind;
  }) => void;
  explorationPreferenceAdded: (pref: PreferenceKind) => void;
  explorationDamageMainAttrSelected: (
    mainAttr: ColoredPuyoAttr | undefined
  ) => void;
  explorationDamageSubAttrSelected: (
    subAttr: ColoredPuyoAttr | undefined
  ) => void;
  explorationDamageMainSubRatioSelected: (ratio: number) => void;
  explorationPuyoCountMainAttrSelected: (mainAttr: ColoredPuyoAttr) => void;
  explorationCountingBonusTypeSelected: (
    bonusType: CountingBonusType | undefined
  ) => void;
  explorationCountingBonusStepTargetAttrSelected: (attr: PuyoAttr) => void;
  explorationCountingBonusStepHeightChanged: (height: number) => void;
  explorationCountingBonusCountChanged: (count: number) => void;
  explorationCountingBonusStepRepeatCheckChanged: (repeat: boolean) => void;
  solutionMethodItemSelected: (method: SolutionMethod) => void;
  boostAreaKeyListChanged: (keyList: string[]) => void;
  boardEditingStarted: () => void;
  boardEditingEnded: () => void;
  howToEditBoardChanged: (howToEdit: HowToEditBoard) => void;
  boardEditCustomTypeChanged: (customType: PuyoType | undefined) => void;

  /// 最適解探索系
  solvingStarted: () => void;
  solvingProgress: (payload: { result: SolveResult; percent: number }) => void;
  solved: (result: SolveResult) => void;
  solveFailed: () => void;
  solveCancelButtonClicked: () => void;
  solutionResetButtonClicked: () => void;
  preparePlaySolutionButtonClicked: () => void;
  optimalSolutionIndexChanged: (index: number) => void;

  /// スクリーンショット系
  screenshotReceived: (screenshotInfo: ScreenshotInfo) => void;
  boardDetected: (payload: {
    error?: string | undefined;
    board?: Board | undefined;
  }) => void;
  puyomistJsonDetected: (puyomist: PuyomistJson) => void;
  /** ボードブリッジから受け取ったプレビュー画像がセットされたとき */
  bridgePreviewReceived: (preview: ScreenshotInfo | undefined) => void;

  /// ぷよ塗り探索系
  paintSearchSettingsChanged: (settings: Partial<PaintSearchSettings>) => void;
  paintSearchStarted: () => void;
  paintSearched: (result: PaintSearchResult) => void;
  paintSearchFailed: () => void;
  paintSearchCleared: () => void;
  paintPlanHovered: (coords: PuyoCoord[] | undefined) => void;
  paintPlanApplied: (coords: PuyoCoord[]) => void;
  paintUndone: () => void;
}

type PuyoAppStore = PuyoAppState & PuyoAppActions;

export const usePuyoAppStore = create<PuyoAppStore>()(
  immer((set) => ({
    ...INITIAL_PUYO_APP_STATE,

    ///
    /// システム系
    ///

    /** ステートをストレージなどから読み込む。 */
    hydrate: (payload) =>
      set((state) => {
        Object.assign(state, payload);
      }),

    ///
    /// キャンバスアクション系
    ///

    /** なぞり消し座標の追加があったとき */
    tracingCoordAdded: (coord) =>
      set((state) => {
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
      }),

    /** なぞり消しがキャンセルされたとき */
    tracingCanceled: () =>
      set((state) => {
        state.simulationData.traceCoords = [];
      }),

    /** 盤面(ネクストを含む)内のぷよが編集されたとき */
    puyoEdited: (payload) =>
      set((state) => {
        ensureEditableBoard(state);

        const { fieldCoord, nextX } = payload;

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
          case HowToEditBoard.ToRed:
            setTargetPuyoType(convertPuyoType(prevType!, PuyoAttr.Red));
            break;
          case HowToEditBoard.ToBlue:
            setTargetPuyoType(convertPuyoType(prevType!, PuyoAttr.Blue));
            break;
          case HowToEditBoard.ToGreen:
            setTargetPuyoType(convertPuyoType(prevType!, PuyoAttr.Green));
            break;
          case HowToEditBoard.ToYellow:
            setTargetPuyoType(convertPuyoType(prevType!, PuyoAttr.Yellow));
            break;
          case HowToEditBoard.ToPurple:
            setTargetPuyoType(convertPuyoType(prevType!, PuyoAttr.Purple));
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
      }),

    /** 盤面リセットボタンがクリックされたとき */
    boardResetButtonClicked: () =>
      set((state) => {
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
      }),

    ///
    /// 連鎖系
    ///

    /** なぞり消しによる連鎖を開始したとき */
    chainStarted: () =>
      set((state) => {
        state.lastTraceCoords = [...state.simulationData.traceCoords];
        state.animationSteps = [];
      }),

    /** なぞり消しによる連鎖が終了したとき */
    chainEnded: (animationSteps) =>
      set((state) => {
        state.simulationData.traceCoords = [];
        state.animationSteps = animationSteps;
      }),

    /** 連鎖アニメーションを開始したとき */
    chainAnimationStarted: () =>
      set((state) => {
        state.animating = true;
      }),

    /** 連鎖アニメーションのステップが一コマ戻されたとき */
    chainAnimationStepBack: () =>
      set((state) => {
        if (state.animationSteps.length === 0) {
          state.activeAnimationStepIndex = -1;
          return;
        }
        state.activeAnimationStepIndex = Math.max(
          0,
          state.activeAnimationStepIndex - 1
        );
      }),

    /** 連鎖アニメーションのステップが一コマ進んだとき */
    chainAnimationStepForward: () =>
      set((state) => {
        if (state.animationSteps.length === 0) {
          state.activeAnimationStepIndex = -1;
          return;
        }
        state.activeAnimationStepIndex = Math.min(
          state.animationSteps.length - 1,
          state.activeAnimationStepIndex + 1
        );
      }),

    /** 連鎖アニメーションのステップが変更されたとき */
    chainAnimationStep: (index) =>
      set((state) => {
        state.activeAnimationStepIndex = index;
      }),

    /** 連鎖アニメーションが終了したとき */
    chainAnimationEnded: () =>
      set((state) => {
        state.animating = false;
      }),

    ///
    /// 設定系
    ///

    /** 盤面IDが変更されたとき */
    boardIdChanged: (boardId) =>
      set((state) => {
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
      }),

    /** ネクストの項目が選択されたとき */
    nextItemSelected: (nextSelection) =>
      set((state) => {
        state.nextSelection = nextSelection;
        const nextPuyos = createNextPuyos(nextSelection);
        state.simulationData.nextPuyos = nextPuyos;
        state.animationSteps = [];
        state.activeAnimationStepIndex = -1;
      }),

    /** なぞり消しモードが変更されたとき */
    traceModeChanged: (traceMode) =>
      set((state) => {
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
      }),

    /** ぷよが消えるのに必要な個数が変更されたとき */
    minimumPuyoNumForPoppingChanged: (num) =>
      set((state) => {
        const traceMode = state.simulationData.traceMode;
        if (traceMode === TraceMode.Normal) {
          state.simulationData.minimumPuyoNumForPopping = num;
        }
      }),

    /** 最大なぞり数が変更されたとき */
    maxTraceNumChanged: (maxTraceNum) =>
      set((state) => {
        state.simulationData.maxTraceNum = maxTraceNum;
      }),

    /** 同時消し倍率が変更されたとき */
    poppingLeverageChanged: (leverage) =>
      set((state) => {
        state.simulationData.poppingLeverage = leverage;
      }),

    /** 連鎖倍率が変更されたとき */
    chainLeverageChanged: (leverage) =>
      set((state) => {
        state.simulationData.chainLeverage = leverage;
      }),

    /** アニメーション時間間隔が変更されたとき */
    animationDurationChanged: (duration) =>
      set((state) => {
        state.animationDuration = duration;
      }),

    /** 最適化対象カテゴリーの項目が選択されたとき */
    explorationCategorySelected: (category) =>
      set((state) => {
        const common = {
          preference_priorities: state.explorationTarget.preference_priorities,
          optimal_solution_count:
            state.explorationTarget.optimal_solution_count || 1
        };
        switch (category) {
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
      }),

    /** 探索対象の優先度に変更があったとき */
    explorationOptimalSolutionNumChanged: (num) =>
      set((state) => {
        state.explorationTarget.optimal_solution_count = num;
      }),

    /** 探索対象の優先度リストに変更があったとき */
    explorationPreferencePrioritiesChanged: (priorities) =>
      set((state) => {
        state.explorationTarget.preference_priorities = priorities;
      }),

    /** 派生プリファレンスに置換されたとき */
    explorationPreferenceReplaced: (payload) =>
      set((state) => {
        const { from, to } = payload;
        const preference_priorities = [
          ...state.explorationTarget.preference_priorities
        ];
        preference_priorities.splice(
          preference_priorities.indexOf(from),
          1,
          to
        );
        state.explorationTarget.preference_priorities = preference_priorities;
      }),

    /** プリファレンスが追加されたとき */
    explorationPreferenceAdded: (pref) =>
      set((state) => {
        if (
          !state.explorationTarget.preference_priorities.some(
            (p) => p % 10 === pref % 10
          )
        ) {
          state.explorationTarget.preference_priorities.push(pref);
        }
      }),

    /** ダメージの主属性項目が選択されたとき */
    explorationDamageMainAttrSelected: (mainAttr) =>
      set((state) => {
        const target = state.explorationTarget as ExplorationTargetDamage;

        if (mainAttr === undefined || target.sub_attr === mainAttr) {
          target.sub_attr = undefined;
        }
        target.main_attr = mainAttr;
      }),

    /** ダメージの副属性項目が選択されたとき */
    explorationDamageSubAttrSelected: (subAttr) =>
      set((state) => {
        const target = state.explorationTarget as ExplorationTargetDamage;

        target.sub_attr = target.main_attr === subAttr ? undefined : subAttr;
      }),

    /** ダメージの副属性ダメージ率項目が選択されたとき */
    explorationDamageMainSubRatioSelected: (ratio) =>
      set((state) => {
        const target = state.explorationTarget as ExplorationTargetDamage;
        target.main_sub_ratio = ratio;
      }),

    /** ぷよ数の主属性項目が選択されたとき */
    explorationPuyoCountMainAttrSelected: (mainAttr) =>
      set((state) => {
        const target =
          state.explorationTarget as ExplorationTargetSkillPuyoCount;

        target.main_attr = mainAttr;
      }),

    /** ぷよ数のボーナスタイプ項目が選択されたとき */
    explorationCountingBonusTypeSelected: (bonusType) =>
      set((state) => {
        const target =
          state.explorationTarget as ExplorationTargetSkillPuyoCount;

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
      }),

    explorationCountingBonusStepTargetAttrSelected: (attr) =>
      set((state) => {
        const target =
          state.explorationTarget as ExplorationTargetSkillPuyoCount;

        if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
          // TODO: リストなので追加削除できるようにする
          target.counting_bonus.target_attrs = [attr];
        }
      }),

    explorationCountingBonusStepHeightChanged: (height) =>
      set((state) => {
        const target =
          state.explorationTarget as ExplorationTargetSkillPuyoCount;

        if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
          target.counting_bonus.step_height = height;
        }
      }),

    explorationCountingBonusCountChanged: (count) =>
      set((state) => {
        const target =
          state.explorationTarget as ExplorationTargetSkillPuyoCount;

        if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
          target.counting_bonus.bonus_count = count;
        }
      }),

    explorationCountingBonusStepRepeatCheckChanged: (repeat) =>
      set((state) => {
        const target =
          state.explorationTarget as ExplorationTargetSkillPuyoCount;

        if (target.counting_bonus?.bonus_type === CountingBonusType.Step) {
          target.counting_bonus.repeat = repeat;
        }
      }),

    /** 探索法の項目が選択されたとき */
    solutionMethodItemSelected: (method) =>
      set((state) => {
        state.solutionMethod = method;
      }),

    /** ブーストエリアのキーリストが変更されたとき */
    boostAreaKeyListChanged: (keyList) =>
      set((state) => {
        state.boostAreaKeyList = keyList;
        state.simulationData.boostAreaCoordList = [
          ...keyList
            .map((key) => boostAreaKeyMap.get(key)?.coordSet)
            .filter(Boolean)
            .reduce((m, s) => unionSet(m!, s!), new Set<PuyoCoord>([]))!
            .keys()
        ];
      }),

    /** 盤面編集が開始されたとき */
    boardEditingStarted: () =>
      set((state) => {
        state.isBoardEditing = true;
      }),

    /** 盤面編集が終了されたとき */
    boardEditingEnded: () =>
      set((state) => {
        state.isBoardEditing = false;
      }),

    /** 盤面編集の仕方が変更されたとき */
    howToEditBoardChanged: (howToEdit) =>
      set((state) => {
        state.boardEditMode.howToEdit = howToEdit;
      }),

    /** 盤面編集時の変換先のぷよタイプが変更されたとき */
    boardEditCustomTypeChanged: (customType) =>
      set((state) => {
        state.boardEditMode.howToEdit = HowToEditBoard.ToCustomType;
        state.boardEditMode.customType = customType;
      }),

    ///
    /// 最適解探索系
    ///

    /** 最適解探索が開始されたとき */
    solvingStarted: () =>
      set((state) => {
        state.solving = true;
        state.abortControllerForSolving = new AbortController();
        state.solvingProgressPercent = 0;
      }),

    /** 解の途中経過 */
    solvingProgress: (payload) =>
      set((state) => {
        const { result, percent } = payload;

        state.solveResult = result;
        state.solvingProgressPercent = percent;
        state.optimalSolutionIndex = 0;
      }),

    /** 解が求まったとき */
    solved: (result) =>
      set((state) => {
        state.solveResult = result;
        state.optimalSolutionIndex = 0;
        state.solving = false;
        state.solvingProgressPercent = 100.0;
        state.abortControllerForSolving = undefined;
      }),

    /** 解を求めるのが失敗したとき */
    solveFailed: () =>
      set((state) => {
        state.solveResult = undefined;
        state.optimalSolutionIndex = -1;
        state.solving = false;
        state.solvingProgressPercent = 0.0;
        state.abortControllerForSolving = undefined;
      }),

    /** 最適解計算をキャンセルするボタンがクリックされたとき */
    solveCancelButtonClicked: () =>
      set((state) => {
        state.abortControllerForSolving?.abort();
      }),

    /** 最適解リセットボタンがクリックされたとき */
    solutionResetButtonClicked: () =>
      set((state) => {
        state.solveResult = undefined;
        state.optimalSolutionIndex = -1;
      }),

    /** 解でなぞりボタンが押されたときの準備アクション */
    preparePlaySolutionButtonClicked: () =>
      set((state) => {
        state.simulationData.traceCoords =
          state.solveResult?.optimal_solutions[state.optimalSolutionIndex]
            .trace_coords ?? [];
      }),

    /** 解のインデックスが変更されたとき */
    optimalSolutionIndexChanged: (index) =>
      set((state) => {
        state.optimalSolutionIndex = index;
      }),

    ///
    /// スクリーンショット系
    ///

    /** スクリーンショット画像を受け取ったとき */
    screenshotReceived: (screenshotInfo) =>
      set((state) => {
        if (state.screenshotInfo?.blobUrl) {
          URL.revokeObjectURL(state.screenshotInfo.blobUrl);
        }
        state.screenshotInfo = screenshotInfo;
      }),

    /** ボードブリッジから受け取ったプレビュー画像がセットされたとき */
    bridgePreviewReceived: (preview) =>
      set((state) => {
        if (state.bridgePreview?.blobUrl) {
          URL.revokeObjectURL(state.bridgePreview.blobUrl);
        }
        state.bridgePreview = preview;
      }),

    /** 盤面判定が完了したとき */
    boardDetected: (payload) =>
      set((state) => {
        const { error, board } = payload;
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
      }),

    /** puyomist JSONを受け取ったとき */
    puyomistJsonDetected: (puyomist) =>
      set((state) => {
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
      }),

    ///
    /// ぷよ塗り探索系
    ///

    /** ぷよ塗り探索の設定が変更されたとき */
    paintSearchSettingsChanged: (settings) =>
      set((state) => {
        Object.assign(state.paintSearchSettings, settings);
        // 設定が変われば前の結果は無効。ハイライトも道連れにする。
        state.paintSearchResult = undefined;
        state.paintHighlightCoords = undefined;
      }),

    /** ぷよ塗り探索を開始したとき */
    paintSearchStarted: () =>
      set((state) => {
        state.paintSearching = true;
        state.paintSearchResult = undefined;
        state.paintHighlightCoords = undefined;
      }),

    /** ぷよ塗り探索が完了したとき */
    paintSearched: (result) =>
      set((state) => {
        state.paintSearching = false;
        state.paintSearchResult = result;
      }),

    /** ぷよ塗り探索が失敗したとき */
    paintSearchFailed: () =>
      set((state) => {
        state.paintSearching = false;
        state.paintSearchResult = undefined;
      }),

    /** ぷよ塗り探索の結果を破棄するとき */
    paintSearchCleared: () =>
      set((state) => {
        state.paintSearchResult = undefined;
        state.paintHighlightCoords = undefined;
      }),

    /** 塗り案にホバーした/ホバーが外れたとき */
    paintPlanHovered: (coords) =>
      set((state) => {
        state.paintHighlightCoords = coords;
      }),

    /** 塗り案が盤面に適用されたとき */
    paintPlanApplied: (coords) =>
      set((state) => {
        if (coords.length === 0) {
          return;
        }

        const board = ensureEditableBoard(state);
        // 適用前の盤面を1手分だけ控えておく (取り消し用)
        state.boardBeforePaint = cloneBoard(board);

        const { color } = state.paintSearchSettings;

        for (const coord of coords) {
          const prevType = board.field[coord.y][coord.x];
          if (prevType === undefined) {
            continue;
          }
          board.field[coord.y][coord.x] = convertPuyoType(prevType, color);
        }

        state.boardId = customBoardId;
        state.simulationData = createSimulationData(
          board,
          {},
          state.simulationData as any
        );
        state.animationSteps = [];
        state.activeAnimationStepIndex = -1;
        state.paintSearchResult = undefined;
        state.paintHighlightCoords = undefined;
      }),

    /** 塗りの適用が取り消されたとき */
    paintUndone: () =>
      set((state) => {
        const board = state.boardBeforePaint;
        if (!board) {
          return;
        }

        state.lastScreenshotBoard = board;
        state.boardBeforePaint = undefined;
        state.boardId = customBoardId;
        state.simulationData = createSimulationData(
          board,
          {},
          state.simulationData as any
        );
        state.animationSteps = [];
        state.activeAnimationStepIndex = -1;
      })
  }))
);

/**
 * `ensureEditableBoard` が触る範囲だけを表した型。
 * immer のドラフトは `PuyoAppState` そのものには代入できないので構造で受ける。
 */
interface EditableBoardState {
  boardId: string;
  lastScreenshotBoard: Board | undefined;
  simulationData: { nextPuyos: ({ type: PuyoType } | undefined)[] };
}

/**
 * 盤面を編集できる状態にして `lastScreenshotBoard` を返す。
 * 組み込み盤面を編集し始めたときはその複製へ、まだ何も無いときは空盤面へ差し替える。
 */
const ensureEditableBoard = (state: EditableBoardState): Board => {
  if (state.boardId !== customBoardId) {
    state.lastScreenshotBoard = structuredClone(getSpecialBoard(state.boardId));
    if (!state.lastScreenshotBoard.nextPuyos) {
      state.lastScreenshotBoard.nextPuyos = state.simulationData.nextPuyos.map(
        (puyo) => puyo?.type
      );
    }
  } else if (!state.lastScreenshotBoard) {
    state.lastScreenshotBoard = {
      field: [...new Array(PuyoCoord.YNum)].map(() => [
        ...new Array(PuyoCoord.XNum)
      ]),
      nextPuyos: [...new Array(PuyoCoord.XNum)]
    };
  }
  return state.lastScreenshotBoard!;
};

/**
 * 盤面を複製する。immer のドラフトは Proxy なので `structuredClone` に渡せない。
 * 塗りが触るのは field と nextPuyos だけだが、取り消し時にそのまま盤面として
 * 使うので全項目を引き継ぐ。
 */
const cloneBoard = (board: Board): Board => ({
  ...board,
  field: board.field.map((row) => [...row]),
  nextPuyos: board.nextPuyos ? [...board.nextPuyos] : undefined
});

///
/// バインド済みアクション（React外/コンポーネントから直接呼ぶ用）
///
/// ストアのアクション関数は初期化時に一度だけ定義され、以降 set はデータの
/// マージのみ行うため、参照は安定している。destructure して個別エクスポートする。
export const {
  /// システム系
  hydrate,
  /// キャンバスアクション系
  tracingCoordAdded,
  tracingCanceled,
  puyoEdited,
  boardResetButtonClicked,
  /// 連鎖系
  chainStarted,
  chainEnded,
  chainAnimationStarted,
  chainAnimationStepBack,
  chainAnimationStepForward,
  chainAnimationStep,
  chainAnimationEnded,
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
  solvingProgress,
  solved,
  solveFailed,
  solveCancelButtonClicked,
  solutionResetButtonClicked,
  preparePlaySolutionButtonClicked,
  optimalSolutionIndexChanged,
  /// スクリーンショット系
  screenshotReceived,
  boardDetected,
  puyomistJsonDetected,
  bridgePreviewReceived,
  /// ぷよ塗り探索系
  paintSearchSettingsChanged,
  paintSearchStarted,
  paintSearched,
  paintSearchFailed,
  paintSearchCleared,
  paintPlanHovered,
  paintPlanApplied,
  paintUndone
} = usePuyoAppStore.getState();

/** ストア全体を購読するフック（旧 useSelector((s) => s.puyoApp) 相当） */
export const usePuyoAppState = (): PuyoAppStore => usePuyoAppStore();

export type { PuyoAppState } from './types';
