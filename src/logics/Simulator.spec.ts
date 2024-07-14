import { beforeEach, describe, expect, it } from 'vitest';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import type { Board } from './Board';
import type { AttributeChain, Chain } from './Chain';
import { __resetPuyoIdCount } from './Puyo';
import { PuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import { B, E, G, H, P, R, W, Y } from './boards/alias';

const Rp = PuyoType.RedPlus;
const Bp = PuyoType.BluePlus;
const Gp = PuyoType.GreenPlus;
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
            attr: PuyoAttribute.Red,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 0), 1],
              [PuyoCoord.xyToCoord(1, 0), 2],
              [PuyoCoord.xyToCoord(0, 1), 9],
              [PuyoCoord.xyToCoord(1, 1), 10]
            ])
          },
          {
            attr: PuyoAttribute.Blue,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 3), 27],
              [PuyoCoord.xyToCoord(3, 2), 20],
              [PuyoCoord.xyToCoord(3, 3), 28]
            ])
          },
          {
            attr: PuyoAttribute.Green,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 5), 41],
              [PuyoCoord.xyToCoord(1, 4), 34],
              [PuyoCoord.xyToCoord(1, 5), 42]
            ])
          },
          {
            attr: PuyoAttribute.Green,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(6, 4), 39],
              [PuyoCoord.xyToCoord(7, 4), 40],
              [PuyoCoord.xyToCoord(7, 5), 48]
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(4, 0), 5],
              [PuyoCoord.xyToCoord(5, 0), 6],
              [PuyoCoord.xyToCoord(4, 1), 13],
              [PuyoCoord.xyToCoord(6, 0), 7],
              [PuyoCoord.xyToCoord(7, 0), 8]
            ])
          },
          {
            attr: PuyoAttribute.Purple,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 4), 35],
              [PuyoCoord.xyToCoord(3, 4), 36],
              [PuyoCoord.xyToCoord(2, 5), 43]
            ])
          },
          {
            attr: PuyoAttribute.Heart,
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
            attr: PuyoAttribute.Blue,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 2), 19],
              [PuyoCoord.xyToCoord(3, 2), 20],
              [PuyoCoord.xyToCoord(4, 2), 21],
              [PuyoCoord.xyToCoord(5, 2), 22]
            ])
          },
          {
            attr: PuyoAttribute.Green,
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
            attr: PuyoAttribute.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(5, 3), 30],
              [PuyoCoord.xyToCoord(6, 3), 31],
              [PuyoCoord.xyToCoord(6, 4), 39],
              [PuyoCoord.xyToCoord(7, 4), 40]
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 3), 25],
              [PuyoCoord.xyToCoord(1, 3), 26],
              [PuyoCoord.xyToCoord(2, 3), 27],
              [PuyoCoord.xyToCoord(1, 4), 34],
              [PuyoCoord.xyToCoord(1, 5), 42]
            ])
          },
          {
            attr: PuyoAttribute.Purple,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(4, 3), 29],
              [PuyoCoord.xyToCoord(4, 4), 37],
              [PuyoCoord.xyToCoord(5, 4), 38],
              [PuyoCoord.xyToCoord(5, 5), 46],
              [PuyoCoord.xyToCoord(6, 5), 47]
            ])
          },
          {
            attr: PuyoAttribute.Heart,
            coordIdMap: new Map([[PuyoCoord.xyToCoord(3, 1), 12]])
          },
          {
            attr: PuyoAttribute.Prism,
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
            attr: PuyoAttribute.Blue,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(2, 2), 6],
              [PuyoCoord.xyToCoord(3, 2), 7],
              [PuyoCoord.xyToCoord(4, 2), 8],
              [PuyoCoord.xyToCoord(5, 2), 9]
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(0, 3), 11],
              [PuyoCoord.xyToCoord(1, 3), 12],
              [PuyoCoord.xyToCoord(1, 4), 18],
              [PuyoCoord.xyToCoord(1, 5), 25]
            ])
          },
          {
            attr: PuyoAttribute.Purple,
            coordIdMap: new Map([
              [PuyoCoord.xyToCoord(4, 3), 14],
              [PuyoCoord.xyToCoord(4, 4), 21],
              [PuyoCoord.xyToCoord(5, 4), 22],
              [PuyoCoord.xyToCoord(5, 5), 29],
              [PuyoCoord.xyToCoord(6, 5), 30]
            ])
          },
          {
            attr: PuyoAttribute.Heart,
            coordIdMap: new Map([[PuyoCoord.xyToCoord(3, 1), 2]])
          },
          {
            attr: PuyoAttribute.Prism,
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
            chainNum: 1,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 1,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 1,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 2,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 3.8000000000000003,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 3.8000000000000003,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 3,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 5.8999999999999995,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 5.8999999999999995,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 4,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Yellow]: {
                strength: 8,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 8,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 5,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 9.4,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 9.4,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 6,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 10.799999999999999,
                poppedNum: 3,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Heart]: {
                strength: 0,
                poppedNum: 1,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 10.799999999999999,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 7,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 12.200000000000001,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 12.200000000000001,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 8,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 13.6,
                poppedNum: 3,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Heart]: {
                strength: 0,
                poppedNum: 1,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 13.6,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 9,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 15,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 15,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 10,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Yellow]: {
                strength: 16.400000000000002,
                poppedNum: 3,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Heart]: {
                strength: 0,
                poppedNum: 1,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 16.400000000000002,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 11,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 17.800000000000004,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 17.800000000000004,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 12,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 19.2,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 19.2,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 13,
            poppedPuyoNum: 3,
            boostCount: 0,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 20.599999999999998,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 20.599999999999998,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 14,
            poppedPuyoNum: 10,
            boostCount: 0,
            puyoTsukaiCount: 10,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 90.19999999999999,
                poppedNum: 10,
                separatedBlocksNum: 2
              }
            },
            wild: {
              strength: 90.19999999999999,
              separatedBlocksNum: 2
            }
          }
        ]
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
            chainNum: 1,
            poppedPuyoNum: 6,
            boostCount: 0,
            puyoTsukaiCount: 7,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 1.3,
                poppedNum: 6,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Heart]: {
                strength: 0,
                poppedNum: 1,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 1.3,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 2,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 5,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 5,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 3,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Yellow]: {
                strength: 8,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 8,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 4,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 11,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 11,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 5,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 13,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 13,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 6,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 15,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 15,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 7,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 17,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 17,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 8,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 19,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 19,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 9,
            poppedPuyoNum: 4,
            boostCount: 0,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 21,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 21,
              separatedBlocksNum: 1
            }
          },
          {
            chainNum: 10,
            poppedPuyoNum: 13,
            boostCount: 0,
            puyoTsukaiCount: 13,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 108.09999999999998,
                poppedNum: 13,
                separatedBlocksNum: 2
              }
            },
            wild: {
              strength: 108.09999999999998,
              separatedBlocksNum: 2
            }
          }
        ]
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
            chainNum: 1,
            poppedPuyoNum: 9,
            boostCount: 0,
            puyoTsukaiCount: 9,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 1.75,
                poppedNum: 5,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Yellow]: {
                strength: 1.75,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 3.5,
              separatedBlocksNum: 2
            }
          },
          {
            chainNum: 2,
            poppedPuyoNum: 12,
            boostCount: 0,
            puyoTsukaiCount: 12,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 3.08,
                poppedNum: 5,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Purple]: {
                strength: 3.08,
                poppedNum: 7,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 6.16,
              separatedBlocksNum: 2
            }
          },
          {
            chainNum: 3,
            poppedPuyoNum: 11,
            boostCount: 0,
            puyoTsukaiCount: 11,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 3.4849999999999994,
                poppedNum: 7,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Yellow]: {
                strength: 3.4849999999999994,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 6.969999999999999,
              separatedBlocksNum: 2
            }
          },
          {
            chainNum: 4,
            poppedPuyoNum: 8,
            boostCount: 0,
            puyoTsukaiCount: 8,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 3.2,
                poppedNum: 4,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Blue]: {
                strength: 3.2,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 6.4,
              separatedBlocksNum: 2
            },
            allCleared: true
          }
        ]
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
            [G, P, R, Gp, H, Y, B, G],
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
            chainNum: 1,
            poppedPuyoNum: 9,
            boostCount: 4,
            puyoTsukaiCount: 19,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 1.75,
                poppedNum: 5,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Purple]: {
                strength: 1.75,
                poppedNum: 4,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Heart]: {
                strength: 0,
                poppedNum: 2,
                separatedBlocksNum: 1
              }
            },
            wild: {
              separatedBlocksNum: 2,
              strength: 3.5
            }
          },
          {
            chainNum: 2,
            poppedPuyoNum: 10,
            boostCount: 4,
            puyoTsukaiCount: 18,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 2.6599999999999997,
                poppedNum: 5,
                separatedBlocksNum: 1
              },
              [PuyoAttribute.Yellow]: {
                strength: 2.6599999999999997,
                poppedNum: 5,
                separatedBlocksNum: 1
              }
            },
            wild: {
              strength: 5.319999999999999,
              separatedBlocksNum: 2
            }
          }
        ]
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
    it('should take account of boostCount', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chainNum: 1,
          poppedPuyoNum: 9,
          boostCount: 4,
          puyoTsukaiCount: 19,
          attributes: {
            [PuyoAttribute.Green]: {
              strength: 1.75,
              poppedNum: 5,
              separatedBlocksNum: 1
            },
            [PuyoAttribute.Purple]: {
              strength: 1.75,
              poppedNum: 4,
              separatedBlocksNum: 1
            },
            [PuyoAttribute.Heart]: {
              strength: 0,
              poppedNum: 2,
              separatedBlocksNum: 1
            }
          } as Record<PuyoAttribute, AttributeChain>,
          wild: {
            separatedBlocksNum: 2,
            strength: 3.5
          }
        },
        {
          chainNum: 2,
          poppedPuyoNum: 10,
          boostCount: 4,
          puyoTsukaiCount: 18,
          attributes: {
            [PuyoAttribute.Red]: {
              strength: 2.6599999999999997,
              poppedNum: 5,
              separatedBlocksNum: 1
            },
            [PuyoAttribute.Yellow]: {
              strength: 2.6599999999999997,
              poppedNum: 5,
              separatedBlocksNum: 1
            }
          } as Record<PuyoAttribute, AttributeChain>,
          wild: {
            strength: 5.319999999999999,
            separatedBlocksNum: 2
          }
        }
      ];

      // Act
      const actualRed = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttribute.Red
      );
      const actualBlue = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttribute.Blue
      );
      const actualGreen = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttribute.Green
      );
      const actualYellow = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttribute.Yellow
      );
      const actualPurple = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttribute.Purple
      );

      // Assert
      expect(actualRed).toBe(3.5111999999999997);
      expect(actualBlue).toBe(0);
      expect(actualGreen).toBe(2.31);
      expect(actualYellow).toBe(3.5111999999999997);
      expect(actualPurple).toBe(2.31);
    });

    it.each([
      { boostCount: 0, expected: 1.0 },
      { boostCount: 1, expected: 1.04 },
      { boostCount: 50, expected: 3.0 },
      { boostCount: 51, expected: 3.0 }
    ])('boostRatio should be up to 3.0', ({ boostCount, expected }) => {
      // Arrange
      const chains: Chain[] = [
        {
          chainNum: 1,
          poppedPuyoNum: 4,
          boostCount,
          puyoTsukaiCount: 0,
          attributes: {
            [PuyoAttribute.Red]: {
              strength: 1,
              poppedNum: 4,
              separatedBlocksNum: 1
            }
          } as Record<PuyoAttribute, AttributeChain>,
          wild: {
            separatedBlocksNum: 1,
            strength: 1
          }
        }
      ];

      // Actual
      const actual = Simulator.calcTotalDamageOfTargetAttr(
        chains,
        PuyoAttribute.Red
      );

      // Assert
      expect(actual).toBe(expected);
    });
  });
});
