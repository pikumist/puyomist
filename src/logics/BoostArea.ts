import { PuyoCoord } from './PuyoCoord';

/** ブーストエリア */
export interface BoostArea {
  /** 名前(キャラ名) */
  name: string;

  /** 座標セット */
  coordSet: ReadonlySet<PuyoCoord>;
}

/** ブーストエリアのキーとエリア情報とのマップ */
export const boostAreaKeyMap: ReadonlyMap<string, BoostArea> = new Map([
  [
    'rulue',
    {
      name: 'ルルー',
      coordSet: new Set(
        ['A2', 'A3', 'B3', 'B4', 'B5', 'C5', 'C6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'arle',
    {
      name: 'アルル',
      coordSet: new Set(
        ['E2', 'D3', 'E3', 'D4', 'E4', 'D5', 'E6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'draco',
    {
      name: 'ドラコ',
      coordSet: new Set(
        ['H2', 'G3', 'H3', 'G4', 'F5', 'G5', 'F6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'schezo',
    {
      name: 'シェゾ',
      coordSet: new Set(
        ['G2', 'F3', 'F4', 'H4', 'H5', 'G6', 'H6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'witch',
    {
      name: 'ウィッチ',
      coordSet: new Set(
        ['B2', 'C3', 'A4', 'C4', 'A5', 'A6', 'B6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'ringo',
    {
      name: 'りんご',
      coordSet: new Set(
        ['F2', 'G3', 'F4', 'G4', 'G5', 'F6', 'G6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'maguro',
    {
      name: 'まぐろ',
      coordSet: new Set(
        ['A2', 'B3', 'B4', 'C4', 'B5', 'B6', 'C6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'risukuma',
    {
      name: 'りすくま',
      coordSet: new Set(
        ['D2', 'C3', 'D3', 'D4', 'E4', 'D6', 'E6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ]
]);
