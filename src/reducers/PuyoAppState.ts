import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import type { AnimationStep } from '../logics/AnimationStep';
import type { Board } from '../logics/Board';
import { type BoardEditMode, HowToEditBoard } from '../logics/BoardEditMode';
import {
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from '../logics/ExplorationTarget';
import { PuyoCoord } from '../logics/PuyoCoord';
import type { SimulationData } from '../logics/SimulationData';
import { Simulator } from '../logics/Simulator';
import { TraceMode } from '../logics/TraceMode';
import { customBoardId } from '../logics/boards';
import { SolutionMethod, type SolveResult } from '../logics/solution';

export interface PuyoAppState {
  /** 盤面ID */
  boardId: string;
  /** ネクスト選択プリセット名 */
  nextSelection: string;
  /** 探索対象 */
  explorationTarget: ExplorationTarget;
  /** 探索法 */
  solutionMethod: SolutionMethod;
  /** 最新スクリーンショットによる盤面 */
  lastScreenshotBoard: Board | undefined;
  /** ブーストエリアキーリスト */
  boostAreaKeyList: string[];
  /** 盤面編集モード */
  boardEditMode: BoardEditMode;
  /** 盤面編集中かどうか */
  isBoardEditing: boolean;
  /** シミュレーションに用いるデータ */
  simulationData: SimulationData;
  /** アニメーション中かどうか */
  animating: boolean;
  /** アニメーションのステップ情報のリスト */
  animationSteps: AnimationStep[];
  /** アクティブなステップ */
  activeAnimationStepIndex: number;
  /** 最後になぞり消しが発生した際のなぞり位置 */
  lastTraceCoords: PuyoCoord[] | undefined;
  /** 最適解探索中かどうか */
  solving: boolean;
  /** 最適解探索の中断コントローラー */
  abortControllerForSolving: AbortController | undefined;
  /** 最適解探索結果 */
  solveResult: SolveResult | undefined;
  /** スクリーンショット情報 */
  screenshotInfo: ScreenshotInfo | undefined;
  /** スクリーンショット解析時のエラーメッセージ */
  screenshotErrorMessage: string | undefined;
}

export const INITIAL_PUYO_APP_STATE: PuyoAppState = {
  boardId: customBoardId,
  nextSelection: 'random',
  explorationTarget: {
    preferencePriorities: [
      PreferenceKind.BiggerValue,
      PreferenceKind.ChancePop,
      PreferenceKind.PrismPop,
      PreferenceKind.AllClear,
      PreferenceKind.SmallerTraceNum
    ],
    category: ExplorationCategory.PuyotsukaiCount
  },
  solutionMethod: SolutionMethod.solveAllInParallel,
  lastScreenshotBoard: undefined,
  boostAreaKeyList: [],
  boardEditMode: {
    howToEdit: HowToEditBoard.ClearEnhance
  },
  isBoardEditing: false,
  simulationData: {
    nextPuyos: [...new Array(PuyoCoord.XNum)],
    field: [...new Array(PuyoCoord.YNum)].map(() => [
      ...new Array(PuyoCoord.XNum)
    ]),
    boostAreaCoordList: [],
    isChanceMode: false,
    traceCoords: [],
    minimumPuyoNumForPopping: Simulator.defaultMinimumPuyoNumForPopping,
    maxTraceNum: Simulator.defaultMaxTraceNum,
    traceMode: TraceMode.Normal,
    poppingLeverage: 1.0,
    chainLeverage: 1.0,
    animationDuration: Simulator.defaultAnimationDuration
  },
  animating: false,
  animationSteps: [],
  activeAnimationStepIndex: -1,
  lastTraceCoords: undefined,
  solving: false,
  abortControllerForSolving: undefined,
  solveResult: undefined,
  screenshotInfo: undefined,
  screenshotErrorMessage: undefined
};
