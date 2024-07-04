import type { PuyoType } from './puyo';

/** 盤面編集モード */
export interface BoardEditMode {
  /** 盤面編集の仕方 */
  howToEdit: HowToEditBoard;

  /** 任意ぷよ変換時に変換するぷよ型 */
  customType?: PuyoType;
}

/** ボード編集の仕方 */
export enum HowToEditBoard {
  /** 編集しない。つまりぷよ消しモード。 */
  None = 0,

  /** 色ぷよであればプラスやチャンスの付与を消去する。 */
  ToNormal = 1,

  /** 色ぷよであればチャンスぷよに変換する。 */
  ToChance = 2,

  /** 色ぷよであればプラスに変換する。 */
  ToPlus = 3,

  /** 任意のぷよに変換する。 */
  ToCustomType = 4
}

const howToEditBoardMap: ReadonlyMap<HowToEditBoard, string> = new Map<
  HowToEditBoard,
  string
>([
  [HowToEditBoard.None, '編集しない'],
  [HowToEditBoard.ToNormal, '色ぷよの付与を消去'],
  [HowToEditBoard.ToChance, 'チャンスぷよに変換'],
  [HowToEditBoard.ToPlus, 'プラスぷよに変換'],
  [HowToEditBoard.ToCustomType, '任意のぷよに変換']
]);

/** 取りうるボード編集の仕方のリスト */
export const possibleHowToEditBoardList: ReadonlyArray<HowToEditBoard> = [
  ...howToEditBoardMap.keys()
];

/**
 * ボード編集の仕方の説明を取得する。
 * @param optimizationTarget
 * @returns
 */
export const getHowToEditBoardDescription = (
  howToEditBoard: HowToEditBoard
): string | undefined => {
  return howToEditBoardMap.get(howToEditBoard);
};
