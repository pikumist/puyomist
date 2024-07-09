import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import type { Board } from '../logics/Board';
import type { BoardEditMode } from '../logics/BoardEditMode';
import type { Chain } from '../logics/Chain';
import { OptimizationTarget } from '../logics/OptimizationTarget';
import { PuyoCoord } from '../logics/PuyoCoord';
import type { SimulationData } from '../logics/SimulationData';
import { Simulator } from '../logics/Simulator';
import { TraceMode } from '../logics/TraceMode';
import { customBoardId } from '../logics/boards';
import { type ExplorationResult, SolutionMethod } from '../logics/solution';

export interface PuyoAppState {
  /** 盤面ID */
  boardId: string;
  /** ネクスト選択プリセット名 */
  nextSelection: string;
  /** 最適化対象 */
  optimizationTarget: OptimizationTarget;
  /** 探索法 */
  solutionMethod: SolutionMethod;
  /** 最新スクリーンショットによる盤面 */
  lastScreenshotBoard: Board | undefined;
  /** ブーストエリアキーリスト */
  boostAreaKeyList: string[];
  /** 盤面編集モード */
  boardEditMode: BoardEditMode | undefined;
  /** シミュレーションに用いるデータ */
  simulationData: SimulationData;
  /** アニメーション中かどうか */
  animating: boolean;
  /** 最後になぞり消しが発生した際のなぞり位置 */
  lastTraceCoords: PuyoCoord[] | undefined;
  /** 全連鎖情報 */
  chains: Chain[];
  /** 最適化計算中かどうか */
  solving: boolean;
  /** 最適解探索結果 */
  explorationResult: ExplorationResult | undefined;
  /** スクリーンショット情報 */
  screenshotInfo: ScreenshotInfo | undefined;
  /** スクリーンショット解析時のエラーメッセージ */
  screenshotErrorMessage: string | undefined;
}

export const INITIAL_PUYO_APP_STATE: PuyoAppState = {
  boardId: customBoardId,
  nextSelection: 'random',
  optimizationTarget: OptimizationTarget.PuyoTsukaiCount,
  solutionMethod: SolutionMethod.solveAllInParallel,
  lastScreenshotBoard: undefined,
  boostAreaKeyList: [],
  boardEditMode: undefined,
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
  lastTraceCoords: undefined,
  chains: [],
  solving: false,
  explorationResult: undefined,
  screenshotInfo: undefined,
  screenshotErrorMessage: undefined
};
