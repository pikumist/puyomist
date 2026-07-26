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
import {
  type PaintSearchResult,
  type PaintSearchSettings,
  defaultPaintSearchSettings
} from '../logics/paint-search';
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
  /** 連鎖ステップのアニメーション間隔(ms) */
  animationDuration: number;
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
  /** 解探索の進捗率 (%) */
  solvingProgressPercent: number;
  /** 最適解探索の中断コントローラー */
  abortControllerForSolving: AbortController | undefined;
  /** 最適解探索結果 */
  solveResult: SolveResult | undefined;
  /** 最適解のインデックス */
  optimalSolutionIndex: number;
  /** スクリーンショット情報 */
  screenshotInfo: ScreenshotInfo | undefined;
  /** スクリーンショット解析時のエラーメッセージ */
  screenshotErrorMessage: string | undefined;
  /** ボードブリッジから受け取ったプレビュー画像 */
  bridgePreview: ScreenshotInfo | undefined;
  /** ぷよ塗り探索の設定 */
  paintSearchSettings: PaintSearchSettings;
  /** ぷよ塗り探索中かどうか */
  paintSearching: boolean;
  /** ぷよ塗り探索の結果 */
  paintSearchResult: PaintSearchResult | undefined;
  /** 盤面上にハイライト表示する塗りマス (塗り案にホバーしている間だけ入る) */
  paintHighlightCoords: PuyoCoord[] | undefined;
  /**
   * 塗り案を適用する直前の盤面。適用の取り消し用に1手分だけ保持する。
   * 多段塗りでは1段ずつ取り消せれば十分なので履歴は積まない。
   */
  boardBeforePaint: Board | undefined;
}

export const INITIAL_PUYO_APP_STATE: PuyoAppState = {
  boardId: customBoardId,
  nextSelection: 'random',
  explorationTarget: {
    category: ExplorationCategory.PuyotsukaiCount,
    preference_priorities: [
      PreferenceKind.BiggerValue,
      PreferenceKind.ChancePop,
      PreferenceKind.PrismPop,
      PreferenceKind.AllClear,
      PreferenceKind.SmallerTraceNum
    ],
    optimal_solution_count: 1
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
    chainLeverage: 1.0
  },
  animationDuration: 200,
  animating: false,
  animationSteps: [],
  activeAnimationStepIndex: -1,
  lastTraceCoords: undefined,
  solving: false,
  solvingProgressPercent: 0.0,
  abortControllerForSolving: undefined,
  solveResult: undefined,
  optimalSolutionIndex: -1,
  screenshotInfo: undefined,
  screenshotErrorMessage: undefined,
  bridgePreview: undefined,
  paintSearchSettings: { ...defaultPaintSearchSettings },
  paintSearching: false,
  paintSearchResult: undefined,
  paintHighlightCoords: undefined,
  boardBeforePaint: undefined
};
