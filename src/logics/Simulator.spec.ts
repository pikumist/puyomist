import { beforeEach, describe, expect, it } from 'vitest';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import type { Board } from './Board';
import type { Chain } from './Chain';
import { __resetPuyoIdCount } from './Puyo';
import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import { B, E, G, H, P, R, W, Y } from './boards/alias';

const Rp = PuyoType.RedPlus;
const Bp = PuyoType.BluePlus;
const Gcp = PuyoType.GreenChancePlus;
const Yp = PuyoType.YellowPlus;
const Pp = PuyoType.PurplePlus;

describe('Simulator', () => {
  beforeEach(() => {
    __resetPuyoIdCount();
  });

  describe('detectPopBlocks()', () => {
    const U = undefined;

    it.each([
      {
        board: {
          // biome-ignore format:
          field: [
            [R, P, H, P, Y, G, Y, Y],
            [R, Y, P, H, Y, G, P, G],
            [B, Y, G, B, H, Y, G, P],
            [B, R, B, R, P, B, R, P],
            [Y, G, P, P, R, B, G, G],
            [B, G, B, R, B, Y, R, R]
          ],
          traceMode: TraceMode.Normal,
          minimumPuyoNumForPopping: 3
        } as Board,
        expected: []
      },
      {
        board: {
          // biome-ignore format:
          field: [
            [R, R, H, P, Y, Y, Y, Y],
            [R, R, P, H, Y, G, P, G],
            [B, Y, G, B, H, Y, G, P],
            [B, R, B, B, P, B, R, P],
            [Y, G, P, P, R, B, G, G],
            [G, G, P, R, B, Y, R, G]
          ],
          traceMode: TraceMode.Normal,
          minimumPuyoNumForPopping: 3
        } as Board,
        expected: [
          {
            attr: PuyoAttr.Red,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 0), 1],
              [PuyoCoord.xyToCoord(1, 0), 2],
              [PuyoCoord.xyToCoord(0, 1), 9],
              [PuyoCoord.xyToCoord(1, 1), 10]
            ])
          },
          {
            attr: PuyoAttr.Blue,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 3), 27],
              [PuyoCoord.xyToCoord(3, 2), 20],
              [PuyoCoord.xyToCoord(3, 3), 28]
            ])
          },
          {
            attr: PuyoAttr.Green,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 5), 41],
              [PuyoCoord.xyToCoord(1, 4), 34],
              [PuyoCoord.xyToCoord(1, 5), 42]
            ])
          },
          {
            attr: PuyoAttr.Green,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(6, 4), 39],
              [PuyoCoord.xyToCoord(7, 4), 40],
              [PuyoCoord.xyToCoord(7, 5), 48]
            ])
          },
          {
            attr: PuyoAttr.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(4, 0), 5],
              [PuyoCoord.xyToCoord(5, 0), 6],
              [PuyoCoord.xyToCoord(4, 1), 13],
              [PuyoCoord.xyToCoord(6, 0), 7],
              [PuyoCoord.xyToCoord(7, 0), 8]
            ])
          },
          {
            attr: PuyoAttr.Purple,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 4), 35],
              [PuyoCoord.xyToCoord(3, 4), 36],
              [PuyoCoord.xyToCoord(2, 5), 43]
            ])
          },
          {
            attr: PuyoAttr.Heart,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 0), 3],
              [PuyoCoord.xyToCoord(3, 1), 12],
              [PuyoCoord.xyToCoord(4, 2), 21]
            ])
          }
        ]
      },
      {
        board: {
          // biome-ignore format:
          field: [
            [Y, P, R, G, Y, G, B, G],
            [P, G, P, H, W, Y, R, G],
            [P, P, B, B, Y, B, G, R],
            [Y, Y, Y, G, P, Y, G, R],
            [G, G, P, R, G, P, B, R],
            [P, G, P, R, R, P, P, B]
          ],
          traceMode: TraceMode.ToBlue,
          minimumPuyoNumForPopping: 4
        } as Board,
        expected: []
      },
      {
        board: {
          // biome-ignore format:
          field: [
            [Y, P, R, G, G, G, G, G],
            [P, G, P, H, W, Y, R, G],
            [P, P, B, B, B, B, G, R],
            [Y, Y, Y, G, P, Y, Y, R],
            [G, Y, P, R, P, P, Y, Y],
            [P, Y, P, R, R, P, P, B]
          ],
          traceMode: TraceMode.ToBlue,
          minimumPuyoNumForPopping: 4
        } as Board,
        expected: [
          {
            attr: PuyoAttr.Blue,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 2), 19],
              [PuyoCoord.xyToCoord(3, 2), 20],
              [PuyoCoord.xyToCoord(4, 2), 21],
              [PuyoCoord.xyToCoord(5, 2), 22]
            ])
          },
          {
            attr: PuyoAttr.Green,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(3, 0), 4],
              [PuyoCoord.xyToCoord(4, 0), 5],
              [PuyoCoord.xyToCoord(5, 0), 6],
              [PuyoCoord.xyToCoord(6, 0), 7],
              [PuyoCoord.xyToCoord(7, 0), 8],
              [PuyoCoord.xyToCoord(7, 1), 16]
            ])
          },
          {
            attr: PuyoAttr.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(5, 3), 30],
              [PuyoCoord.xyToCoord(6, 3), 31],
              [PuyoCoord.xyToCoord(6, 4), 39],
              [PuyoCoord.xyToCoord(7, 4), 40]
            ])
          },
          {
            attr: PuyoAttr.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 3), 25],
              [PuyoCoord.xyToCoord(1, 3), 26],
              [PuyoCoord.xyToCoord(2, 3), 27],
              [PuyoCoord.xyToCoord(1, 4), 34],
              [PuyoCoord.xyToCoord(1, 5), 42]
            ])
          },
          {
            attr: PuyoAttr.Purple,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(4, 3), 29],
              [PuyoCoord.xyToCoord(4, 4), 37],
              [PuyoCoord.xyToCoord(5, 4), 38],
              [PuyoCoord.xyToCoord(5, 5), 46],
              [PuyoCoord.xyToCoord(6, 5), 47]
            ])
          },
          {
            attr: PuyoAttr.Heart,
            coordIdMap: new Map([[PuyoCoord.xyToCoord(3, 1), 12]])
          },
          {
            attr: PuyoAttr.Prism,
            coordIdMap: new Map([[PuyoCoord.xyToCoord(4, 1), 13]])
          }
        ]
      },
      {
        board: {
          // biome-ignore format:
          field: [
            [U, U, U, U, U, U, U, G],
            [U, U, U, H, W, Y, U, G],
            [U, U, B, B, B, B, U, R],
            [Y, Y, U, G, P, Y, U, R],
            [G, Y, P, R, P, P, U, Y],
            [P, Y, P, R, R, P, P, B]
          ],
          traceMode: TraceMode.ToBlue,
          minimumPuyoNumForPopping: 4
        } as Board,
        expected: [
          {
            attr: PuyoAttr.Blue,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 2), 6],
              [PuyoCoord.xyToCoord(3, 2), 7],
              [PuyoCoord.xyToCoord(4, 2), 8],
              [PuyoCoord.xyToCoord(5, 2), 9]
            ])
          },
          {
            attr: PuyoAttr.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 3), 11],
              [PuyoCoord.xyToCoord(1, 3), 12],
              [PuyoCoord.xyToCoord(1, 4), 18],
              [PuyoCoord.xyToCoord(1, 5), 25]
            ])
          },
          {
            attr: PuyoAttr.Purple,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(4, 3), 14],
              [PuyoCoord.xyToCoord(4, 4), 21],
              [PuyoCoord.xyToCoord(5, 4), 22],
              [PuyoCoord.xyToCoord(5, 5), 29],
              [PuyoCoord.xyToCoord(6, 5), 30]
            ])
          },
          {
            attr: PuyoAttr.Heart,
            coordIdMap: new Map([[PuyoCoord.xyToCoord(3, 1), 2]])
          },
          {
            attr: PuyoAttr.Prism,
            coordIdMap: new Map([[PuyoCoord.xyToCoord(4, 1), 3]])
          }
        ]
      }
    ])('should detect blocks to be popped', ({ board, expected }) => {
      // Arrange
      const simulator = new Simulator(createSimulationData(board));

      // Act
      const actual = (simulator as any).detectPopBlocks();

      // Assert
      expect(actual).toEqual(expected);
    });
  });

  describe('doChains()', () => {
    it.each([
      {
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        // specialRule1/1'
        board: {
          field: [
            [R, P, H, P, Y, G, Y, Y],
            [R, Y, P, H, Y, G, P, G],
            [B, Y, G, B, H, Y, G, P],
            [B, R, B, R, P, B, R, P],
            [Y, G, P, P, R, B, G, G],
            [B, G, B, R, B, Y, R, R]
          ],
          nextPuyos: [G, G, G, G, G, G, G, G],
          traceMode: TraceMode.Normal,
          minimumPuyoNumForPopping: 3,
          chainLeverage: 7.0
        } satisfies Board,
        traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
        expected: [
          {
            chain_num: 1,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 1,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 2,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 3.8000000000000003,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 3,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 5.8999999999999995,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 4,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Yellow]: {
                strength: 8,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 5,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Blue]: {
                strength: 9.4,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 6,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 10.799999999999999,
                popped_count: 3,
                separated_blocks_num: 1
              },
              [PuyoAttr.Heart]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            }
          },
          {
            chain_num: 7,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 12.200000000000001,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 8,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Blue]: {
                strength: 13.6,
                popped_count: 3,
                separated_blocks_num: 1
              },
              [PuyoAttr.Heart]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            }
          },
          {
            chain_num: 9,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 15,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 10,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Yellow]: {
                strength: 16.400000000000002,
                popped_count: 3,
                separated_blocks_num: 1
              },
              [PuyoAttr.Heart]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            }
          },
          {
            chain_num: 11,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Blue]: {
                strength: 17.800000000000004,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 12,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 19.2,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 13,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 20.599999999999998,
                popped_count: 3,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 14,
            simultaneous_num: 10,
            boost_count: 0,
            puyo_tsukai_count: 10,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 90.19999999999999,
                popped_count: 10,
                separated_blocks_num: 2
              }
            }
          }
        ] satisfies Chain[]
      },
      {
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        // specialRule2/1'
        board: {
          field: [
            [Y, P, R, G, Y, G, B, G],
            [P, G, P, H, W, Y, R, G],
            [P, P, B, B, Y, B, G, R],
            [Y, Y, Y, G, P, Y, G, R],
            [G, G, P, R, G, P, B, R],
            [P, G, P, R, R, P, P, B]
          ],
          nextPuyos: [B, B, B, B, B, B, B, B],
          traceMode: TraceMode.ToBlue,
          minimumPuyoNumForPopping: 4,
          chainLeverage: 10.0
        } satisfies Board,
        traceCoords: [
          PuyoCoord.xyToCoord(3, 0),
          PuyoCoord.xyToCoord(5, 0),
          PuyoCoord.xyToCoord(4, 1),
          PuyoCoord.xyToCoord(4, 2),
          PuyoCoord.xyToCoord(3, 3)
        ],
        expected: [
          {
            chain_num: 1,
            simultaneous_num: 6,
            boost_count: 0,
            puyo_tsukai_count: 7,
            attributes: {
              [PuyoAttr.Blue]: {
                strength: 1.3,
                popped_count: 6,
                separated_blocks_num: 1
              },
              [PuyoAttr.Heart]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            }
          },
          {
            chain_num: 2,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 5,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 3,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Yellow]: {
                strength: 8,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 4,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 11,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 5,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 13,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 6,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 15,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 7,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 17,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 8,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 19,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 9,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 21,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 10,
            simultaneous_num: 13,
            boost_count: 0,
            puyo_tsukai_count: 13,
            attributes: {
              [PuyoAttr.Blue]: {
                strength: 108.09999999999998,
                popped_count: 13,
                separated_blocks_num: 2
              }
            }
          }
        ] satisfies Chain[]
      },
      {
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        board: {
          field: [
            [P, B, E, G, G, G, E, E],
            [P, G, P, P, R, R, R, Y],
            [G, P, G, B, P, B, Y, B],
            [B, G, B, P, B, R, B, R],
            [Y, B, Y, B, R, P, R, R],
            [Y, Y, G, R, B, B, Y, Y]
          ],
          isChanceMode: true
        } satisfies Board,
        traceCoords: [
          PuyoCoord.xyToCoord(3, 2),
          PuyoCoord.xyToCoord(4, 3),
          PuyoCoord.xyToCoord(5, 4),
          PuyoCoord.xyToCoord(3, 4),
          PuyoCoord.xyToCoord(2, 5)
        ],
        expected: [
          {
            chain_num: 1,
            simultaneous_num: 9,
            boost_count: 0,
            puyo_tsukai_count: 9,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 1.75,
                popped_count: 5,
                separated_blocks_num: 1
              },
              [PuyoAttr.Yellow]: {
                strength: 1.75,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 2,
            simultaneous_num: 12,
            boost_count: 0,
            puyo_tsukai_count: 12,
            attributes: {
              [PuyoAttr.Blue]: {
                strength: 3.08,
                popped_count: 5,
                separated_blocks_num: 1
              },
              [PuyoAttr.Purple]: {
                strength: 3.08,
                popped_count: 7,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 3,
            simultaneous_num: 11,
            boost_count: 0,
            puyo_tsukai_count: 11,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 3.4849999999999994,
                popped_count: 7,
                separated_blocks_num: 1
              },
              [PuyoAttr.Yellow]: {
                strength: 3.4849999999999994,
                popped_count: 4,
                separated_blocks_num: 1
              }
            }
          },
          {
            chain_num: 4,
            simultaneous_num: 8,
            boost_count: 0,
            puyo_tsukai_count: 8,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 3.2,
                popped_count: 4,
                separated_blocks_num: 1
              },
              [PuyoAttr.Blue]: {
                strength: 3.2,
                popped_count: 4,
                separated_blocks_num: 1
              }
            },
            is_all_cleared: true
          }
        ] satisfies Chain[]
      },
      {
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        // アルルのエリア
        boostAreaCoordList: ['E2', 'D3', 'E3', 'D4', 'E4', 'D5', 'E6'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        board: {
          field: [
            [H, R, R, G, P, B, H, B],
            [H, P, B, B, G, R, P, G],
            [G, P, R, Gcp, H, Y, B, G],
            [G, P, R, R, P, B, B, Y],
            [B, P, R, G, R, Y, Y, P],
            [P, B, P, G, P, G, P, R]
          ],
          nextPuyos: [Pp, Pp, Pp, Rp, Yp, Yp, Pp, Bp],
          isChanceMode: false
        } satisfies Board,
        traceCoords: [
          PuyoCoord.cellAddrToCoord('C3'),
          PuyoCoord.cellAddrToCoord('D4'),
          PuyoCoord.cellAddrToCoord('E4'),
          PuyoCoord.cellAddrToCoord('E5'),
          PuyoCoord.cellAddrToCoord('F4')
        ],
        expected: [
          {
            chain_num: 1,
            simultaneous_num: 9,
            boost_count: 4,
            puyo_tsukai_count: 19,
            attributes: {
              [PuyoAttr.Green]: {
                strength: 1.75,
                popped_count: 5,
                separated_blocks_num: 1
              },
              [PuyoAttr.Purple]: {
                strength: 1.75,
                popped_count: 4,
                separated_blocks_num: 1
              },
              [PuyoAttr.Heart]: {
                strength: 0,
                popped_count: 2,
                separated_blocks_num: 0
              }
            },
            is_chance_popped: true
          },
          {
            chain_num: 2,
            simultaneous_num: 10,
            boost_count: 4,
            puyo_tsukai_count: 18,
            attributes: {
              [PuyoAttr.Red]: {
                strength: 2.6599999999999997,
                popped_count: 5,
                separated_blocks_num: 1
              },
              [PuyoAttr.Yellow]: {
                strength: 2.6599999999999997,
                popped_count: 5,
                separated_blocks_num: 1
              }
            }
          }
        ] satisfies Chain[]
      }
    ])(
      'should calculate chains',
      ({
        maxTraceNum,
        poppingLeverage,
        boostAreaCoordList,
        board,
        traceCoords,
        expected
      }) => {
        // Arrange
        const simulationData = createSimulationData(board, {
          maxTraceNum,
          poppingLeverage,
          boostAreaCoordList
        });
        const simulator = new Simulator(simulationData);
        simulator.setTraceCoords(traceCoords as PuyoCoord[]);

        // Act
        simulator.doChains()!;

        // Assert
        const chains = simulator.getChains();
        expect(chains).toEqual(expected);
      }
    );
  });

  describe('calcTotalDamageOfTargetAttr()', () => {
    it('should take account of boost_count', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 9,
          boost_count: 4,
          puyo_tsukai_count: 19,
          attributes: {
            [PuyoAttr.Green]: {
              strength: 1.75,
              popped_count: 5,
              separated_blocks_num: 1
            },
            [PuyoAttr.Purple]: {
              strength: 1.75,
              popped_count: 4,
              separated_blocks_num: 1
            },
            [PuyoAttr.Heart]: {
              strength: 0,
              popped_count: 2,
              separated_blocks_num: 1
            }
          }
        },
        {
          chain_num: 2,
          simultaneous_num: 10,
          boost_count: 4,
          puyo_tsukai_count: 18,
          attributes: {
            [PuyoAttr.Red]: {
              strength: 2.6599999999999997,
              popped_count: 5,
              separated_blocks_num: 1
            },
            [PuyoAttr.Yellow]: {
              strength: 2.6599999999999997,
              popped_count: 5,
              separated_blocks_num: 1
            }
          }
        }
      ];

      // Act
      const actualRed = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttr.Red
      );
      const actualBlue = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttr.Blue
      );
      const actualGreen = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttr.Green
      );
      const actualYellow = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttr.Yellow
      );
      const actualPurple = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttr.Purple
      );

      // Assert
      expect(actualRed).toBe(3.5111999999999997);
      expect(actualBlue).toBe(0);
      expect(actualGreen).toBe(2.31);
      expect(actualYellow).toBe(3.5111999999999997);
      expect(actualPurple).toBe(2.31);
    });

    it.each([
      { boost_count: 0, expected: 1.0 },
      { boost_count: 1, expected: 1.04 },
      { boost_count: 50, expected: 3.0 },
      { boost_count: 51, expected: 3.0 }
    ])('boostRatio should be up to 3.0', ({ boost_count, expected }) => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 4,
          boost_count,
          puyo_tsukai_count: 0,
          attributes: {
            [PuyoAttr.Red]: {
              strength: 1,
              popped_count: 4,
              separated_blocks_num: 1
            }
          }
        }
      ];

      // Actual
      const actual = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttr.Red
      );

      // Assert
      expect(actual).toBe(expected);
    });
  });

  describe('calcTotalWildDamage()', () => {
    it('should calculate total wild damage including prism and boost count ratio', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 11,
          boost_count: 4,
          puyo_tsukai_count: 21,
          attributes: {
            [PuyoAttr.Green]: {
              strength: 2.05,
              popped_count: 5,
              separated_blocks_num: 1
            },
            [PuyoAttr.Purple]: {
              strength: 2.05,
              popped_count: 4,
              separated_blocks_num: 1
            },
            [PuyoAttr.Heart]: {
              strength: 0,
              popped_count: 2,
              separated_blocks_num: 0
            },
            [PuyoAttr.Prism]: {
              strength: 6.0,
              popped_count: 2,
              separated_blocks_num: 0
            }
          }
        },
        {
          chain_num: 2,
          simultaneous_num: 10,
          boost_count: 4,
          puyo_tsukai_count: 18,
          attributes: {
            [PuyoAttr.Red]: {
              strength: 2.6599999999999997,
              popped_count: 5,
              separated_blocks_num: 1
            },
            [PuyoAttr.Yellow]: {
              strength: 2.6599999999999997,
              popped_count: 5,
              separated_blocks_num: 1
            }
          }
        }
      ];

      // Actual
      const actual = Simulator.calcTotalWildDamage(chains);

      // Assert
      expect(actual).toBeCloseTo(20.3544);
    });
  });
});
