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

  /** 赤ぷよに塗り替えする。 */
  ToRed = 4,

  /** 青ぷよに塗り替えする。 */
  ToBlue = 5,

  /** 緑ぷよに塗り替えする。 */
  ToGreen = 6,

  /** 黄ぷよに塗り替えする。 */
  ToYellow = 7,

  /** 紫ぷよに塗り替えする。 */
  ToPurple = 8,

  /** 任意のぷよに変換する。 */
  ToCustomType = 9
}

/** ボード編集の仕方と説明のマップ */
export const howToEditBoardDescriptionMap: ReadonlyMap<HowToEditBoard, string> =
  new Map<HowToEditBoard, string>([
    [HowToEditBoard.ClearEnhance, '色ぷよの付与を消去'],
    [HowToEditBoard.AddChance, 'チャンスを付与'],
    [HowToEditBoard.AddPlus, 'プラスを付与'],
    [HowToEditBoard.ToRed, '赤ぷよに塗り替え'],
    [HowToEditBoard.ToBlue, '青ぷよに塗り替え'],
    [HowToEditBoard.ToGreen, '緑ぷよに塗り替え'],
    [HowToEditBoard.ToYellow, '黄ぷよに塗り替え'],
    [HowToEditBoard.ToPurple, '紫ぷよに塗り替え'],
    [HowToEditBoard.ToCustomType, '任意のぷよに変換']
  ]);
