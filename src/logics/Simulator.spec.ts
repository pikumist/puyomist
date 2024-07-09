import { beforeEach, describe, expect, it } from 'vitest';
import { createNextPuyosAsSameType } from '../reducers/internal/createNextPuyos';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import type { Board } from './Board';
import { __resetPuyoIdCount } from './Puyo';
import { PuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import { getSpecialBoard } from './boards';
import { B, G, H, P, R, W, Y } from './boards/alias';

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
        boardId: 'specialRule1/1',
        nextPuyoType: PuyoType.Green,
        traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
        expected: [
          {
            chainNum: 1,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 1,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 2,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 3.8000000000000003,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 3,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 5.8999999999999995,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 4,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Yellow]: {
                strength: 8,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 5,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 9.4,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 6,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 10.799999999999999,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 7,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 12.200000000000001,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 8,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 13.6,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 9,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 15,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 10,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Yellow]: {
                strength: 16.400000000000002,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 11,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 17.800000000000004,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 12,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 19.2,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 13,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 20.599999999999998,
                poppedNum: 3,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 14,
            poppedPuyoNum: 10,
            puyoTsukaiCount: 10,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 90.19999999999999,
                poppedNum: 10,
                separatedBlocksNum: 2
              }
            }
          }
        ]
      },
      {
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule2/1',
        nextPuyoType: PuyoType.Blue,
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
            puyoTsukaiCount: 7,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 1.3,
                poppedNum: 6,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 2,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 5,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 3,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Yellow]: {
                strength: 8,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 4,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 11,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 5,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 13,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 6,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 15,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 7,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Purple]: {
                strength: 17,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 8,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Red]: {
                strength: 19,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 9,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            attributes: {
              [PuyoAttribute.Green]: {
                strength: 21,
                poppedNum: 4,
                separatedBlocksNum: 1
              }
            }
          },
          {
            chainNum: 10,
            poppedPuyoNum: 13,
            puyoTsukaiCount: 13,
            attributes: {
              [PuyoAttribute.Blue]: {
                strength: 108.09999999999998,
                poppedNum: 13,
                separatedBlocksNum: 2
              }
            }
          }
        ]
      }
    ])(
      'should calculate chains',
      ({
        maxTraceNum,
        poppingLeverage,
        boardId,
        nextPuyoType,
        traceCoords,
        expected
      }) => {
        // Arrange
        const board = getSpecialBoard(boardId);
        const nextPuyos = createNextPuyosAsSameType(nextPuyoType);
        const simulationData = createSimulationData(board, {
          nextPuyos,
          maxTraceNum,
          poppingLeverage
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
});
