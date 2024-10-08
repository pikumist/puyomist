import type { PuyoType } from './PuyoType';

/** 盤面編集モード */
export interface BoardEditMode {
  /** 盤面編集の仕方 */
  howToEdit: HowToEditBoard;

  /** 任意ぷよ変換時に変換するぷよ型 */
  customType?: PuyoType;
}

/** ボード編集の仕方 */
export enum HowToEditBoard {
  /** 色ぷよであればプラスやチャンスの付与を消去する。 */
  ClearEnhance = 1,

  /** 色ぷよであればチャンスを付与する。 */
  AddChance = 2,

  /** 色ぷよであればプラスを付与する。 */
  AddPlus = 3,

  /** 任意のぷよに変換する。 */
  ToCustomType = 4
}

/** ボード編集の仕方と説明のマップ */
export const howToEditBoardDescriptionMap: ReadonlyMap<HowToEditBoard, string> =
  new Map<HowToEditBoard, string>([
    [HowToEditBoard.ClearEnhance, '色ぷよの付与を消去'],
    [HowToEditBoard.AddChance, 'チャンスを付与'],
    [HowToEditBoard.AddPlus, 'プラスを付与'],
    [HowToEditBoard.ToCustomType, '任意のぷよに変換']
  ]);
