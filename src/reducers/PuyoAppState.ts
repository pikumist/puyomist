import type { ScreenshotInfo } from '../hooks/internal/ScreenshotInfo';
import type { Board } from '../logics/Board';
import type { BoardEditMode } from '../logics/BoardEditMode';
import { OptimizationTarget } from '../logics/OptimizationTarget';
import { Simulator } from '../logics/Simulator';
import { screenshotBoardId } from '../logics/boards';
import type { ChainDamage } from '../logics/damage';
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

  /** TODO: 内部ステートを抜き出す */
  simulator: Simulator;

  /** アニメーション中かどうか */
  animating: boolean;

  /** 連鎖ダメージ情報 */
  chainDamages: ChainDamage[];

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
  boardId: screenshotBoardId,
  nextSelection: 'random',
  optimizationTarget: OptimizationTarget.PuyoTsukaiCount,
  solutionMethod: SolutionMethod.solveAllInParallel,
  lastScreenshotBoard: undefined,
  boostAreaKeyList: [],
  boardEditMode: undefined,
  simulator: new Simulator(),
  animating: false,
  chainDamages: [],
  solving: false,
  explorationResult: undefined,
  screenshotInfo: undefined,
  screenshotErrorMessage: undefined
};
