import type { ScreenshotInfo } from '../hooks/dispatchWhenScreenshotReceivedViaWebSocket';
import type { Board } from '../logics/Board';
import type { BoardEditMode } from '../logics/BoardEditMode';
import { Field } from '../logics/Field';
import { OptimizationTarget } from '../logics/OptimizationTarget';
import { ssBoardKey } from '../logics/boards';
import type { ChainDamage } from '../logics/damage';
import { SolutionMethod, type SolvedResult } from '../logics/solution';

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

  /** フィールド (盤面+設定) */
  field: Field;

  /** アニメーション中かどうか */
  animating: boolean;

  /** 連鎖ダメージ情報 */
  chainDamages: ChainDamage[];

  /** 最適化計算中かどうか */
  solving: boolean;

  /** 最適化計算結果 */
  solvedResult: SolvedResult | undefined;

  /** スクリーンショット情報 */
  screenshotInfo: ScreenshotInfo | undefined;

  /** スクリーンショット解析時のエラーメッセージ */
  screenshotErrorMessage: string | undefined;
}

export const INITIAL_PUYO_APP_STATE: PuyoAppState = {
  boardId: ssBoardKey,
  nextSelection: 'random',
  optimizationTarget: OptimizationTarget.PuyoTsukaiCount,
  solutionMethod: SolutionMethod.solve3,
  lastScreenshotBoard: undefined,
  boostAreaKeyList: [],
  boardEditMode: undefined,
  field: new Field(),
  animating: false,
  chainDamages: [],
  solving: false,
  solvedResult: undefined,
  screenshotInfo: undefined,
  screenshotErrorMessage: undefined
};
