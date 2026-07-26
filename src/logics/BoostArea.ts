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
  ],
  [
    'raffina',
    {
      name: 'ラフィナ',
      coordSet: new Set(
        ['G2', 'F3', 'H3', 'F4', 'G5', 'H5', 'G6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'klug',
    {
      name: 'クルーク',
      coordSet: new Set(
        ['B2', 'A3', 'C3', 'C4', 'A5', 'B5', 'B6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'serilly',
    {
      name: 'セリリ',
      coordSet: new Set(
        ['D2', 'F2', 'D3', 'D4', 'E4', 'D5', 'E6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'harpy',
    {
      name: 'ハーピー',
      coordSet: new Set(
        ['C2', 'C3', 'A4', 'C4', 'A5', 'A6', 'B6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'amitie',
    {
      name: 'アミティ',
      coordSet: new Set(
        ['D2', 'D3', 'E3', 'D4', 'E4', 'E5', 'D6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'sig',
    {
      name: 'シグ',
      coordSet: new Set(
        ['F2', 'G3', 'G4', 'H4', 'F5', 'F6', 'H6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'lidelle',
    {
      name: 'リデル',
      coordSet: new Set(
        ['C2', 'B3', 'A4', 'B4', 'C5', 'A6', 'C6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'haruka',
    {
      name: '春香',
      coordSet: new Set(
        ['B2', 'E2', 'G3', 'C4', 'G4', 'D5', 'H5', 'B6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'chihaya',
    {
      name: '千早',
      coordSet: new Set(
        ['A2', 'G2', 'C3', 'D4', 'H4', 'B5', 'E6', 'H6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'miki',
    {
      name: '美希',
      coordSet: new Set(
        ['C2', 'H2', 'D3', 'B4', 'E4', 'F5', 'D6', 'G6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'lemres',
    {
      name: 'レムレス',
      coordSet: new Set(
        ['G2', 'F3', 'F4', 'G4', 'G5', 'G6', 'H6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'feli',
    {
      name: 'フェーリ',
      coordSet: new Set(
        ['C2', 'D3', 'E3', 'E4', 'C5', 'D5', 'C6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'ally',
    {
      name: 'アリィ',
      coordSet: new Set(
        ['E2', 'E3', 'H4', 'E5', 'H5', 'D6', 'F6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'rafisol',
    {
      name: 'ラフィソル',
      coordSet: new Set(
        ['F2', 'G3', 'D4', 'G4', 'F5', 'G5', 'E6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'accord',
    {
      name: 'アコール',
      coordSet: new Set(
        ['D2', 'B3', 'A4', 'B4', 'C5', 'A6', 'D6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'satan',
    {
      name: 'サタン',
      coordSet: new Set(
        ['H2', 'G3', 'F4', 'H4', 'H5', 'G6', 'H6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'ecolo',
    {
      name: 'エコロ',
      coordSet: new Set(
        ['E2', 'D3', 'E4', 'D5', 'F5', 'C6', 'E6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'summer_collector_witch',
    {
      name: 'なつッチ',
      coordSet: new Set(
        ['A3', 'E3', 'B4', 'B5', 'D5', 'E5', 'C6', 'D6', 'F6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'roco',
    {
      name: 'ロコ',
      coordSet: new Set(
        ['A2', 'B3', 'C3', 'D4', 'B5', 'D5', 'A6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ],
  [
    'maurice',
    {
      name: 'モーリス',
      coordSet: new Set(
        ['G2', 'H3', 'G4', 'H4', 'H5', 'F6', 'G6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        )
      )
    }
  ]
]);
