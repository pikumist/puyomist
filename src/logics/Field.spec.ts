import { describe, expect, it } from 'vitest';
import type { Board } from './Board';
import { Field } from './Field';
import { OptimizationTarget } from './OptimizationTarget';
import { PuyoCoord } from './PuyoCoord';
import { TraceMode } from './TraceMode';
import { getSpecialBoard } from './boards';
import { B, G, H, P, R, W, Y } from './boards/alias';
import type { ChainDamage } from './damage';
import { type ColoredPuyoAttribute, PuyoAttribute, PuyoType } from './puyo';

describe('Field', () => {
  const calcCsp = (chainDamage: ChainDamage, attr: PuyoAttribute) => {
    const c = chainDamage.chainNum;
    const s = chainDamage.damageTerms.get(attr)?.separatedBlocksNum;
    const p = chainDamage.poppedPuyoNum;
    if (s) {
      return `${c}-${s}-${p}`;
    }
  };

  const findMostDamageChain = (
    chainDamages: ChainDamage[],
    attr: PuyoAttribute
  ): ChainDamage | undefined => {
    const effectiveChainDamages = chainDamages.filter((chainDamage) => {
      return chainDamage.damageTerms.get(attr)?.strength;
    });
    const mostDamageChain = effectiveChainDamages.reduce(
      (m, chainDamage) => {
        if (!m) {
          return chainDamage;
        }
        return chainDamage.damageTerms.get(attr)?.strength! >=
          m.damageTerms.get(attr)?.strength!
          ? chainDamage
          : m;
      },
      undefined as ChainDamage | undefined
    );

    return mostDamageChain;
  };

  describe('detectPopBlocks2()', () => {
    const U = undefined;

    it.each([
      {
        board: {
          // biome-ignore format:
          matrix: [
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
          matrix: [
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
            coords: new Set([
              PuyoCoord.xyToCoord(0, 0),
              PuyoCoord.xyToCoord(1, 0),
              PuyoCoord.xyToCoord(0, 1),
              PuyoCoord.xyToCoord(1, 1)
            ])
          },
          {
            attr: PuyoAttribute.Blue,
            coords: new Set([
              PuyoCoord.xyToCoord(2, 3),
              PuyoCoord.xyToCoord(3, 2),
              PuyoCoord.xyToCoord(3, 3)
            ])
          },
          {
            attr: PuyoAttribute.Green,
            coords: new Set([
              PuyoCoord.xyToCoord(0, 5),
              PuyoCoord.xyToCoord(1, 4),
              PuyoCoord.xyToCoord(1, 5)
            ])
          },
          {
            attr: PuyoAttribute.Green,
            coords: new Set([
              PuyoCoord.xyToCoord(6, 4),
              PuyoCoord.xyToCoord(7, 4),
              PuyoCoord.xyToCoord(7, 5)
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coords: new Set([
              PuyoCoord.xyToCoord(4, 0),
              PuyoCoord.xyToCoord(5, 0),
              PuyoCoord.xyToCoord(4, 1),
              PuyoCoord.xyToCoord(6, 0),
              PuyoCoord.xyToCoord(7, 0)
            ])
          },
          {
            attr: PuyoAttribute.Purple,
            coords: new Set([
              PuyoCoord.xyToCoord(2, 4),
              PuyoCoord.xyToCoord(3, 4),
              PuyoCoord.xyToCoord(2, 5)
            ])
          },
          {
            attr: PuyoAttribute.Heart,
            coords: new Set([
              PuyoCoord.xyToCoord(2, 0),
              PuyoCoord.xyToCoord(3, 1),
              PuyoCoord.xyToCoord(4, 2)
            ])
          }
        ]
      },
      {
        board: {
          // biome-ignore format:
          matrix: [
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
          matrix: [
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
            coords: new Set([
              PuyoCoord.xyToCoord(2, 2),
              PuyoCoord.xyToCoord(3, 2),
              PuyoCoord.xyToCoord(4, 2),
              PuyoCoord.xyToCoord(5, 2)
            ])
          },
          {
            attr: PuyoAttribute.Green,
            coords: new Set([
              PuyoCoord.xyToCoord(3, 0),
              PuyoCoord.xyToCoord(4, 0),
              PuyoCoord.xyToCoord(5, 0),
              PuyoCoord.xyToCoord(6, 0),
              PuyoCoord.xyToCoord(7, 0),
              PuyoCoord.xyToCoord(7, 1)
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coords: new Set([
              PuyoCoord.xyToCoord(5, 3),
              PuyoCoord.xyToCoord(6, 3),
              PuyoCoord.xyToCoord(6, 4),
              PuyoCoord.xyToCoord(7, 4)
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coords: new Set([
              PuyoCoord.xyToCoord(0, 3),
              PuyoCoord.xyToCoord(1, 3),
              PuyoCoord.xyToCoord(2, 3),
              PuyoCoord.xyToCoord(1, 4),
              PuyoCoord.xyToCoord(1, 5)
            ])
          },
          {
            attr: PuyoAttribute.Purple,
            coords: new Set([
              PuyoCoord.xyToCoord(4, 3),
              PuyoCoord.xyToCoord(4, 4),
              PuyoCoord.xyToCoord(5, 4),
              PuyoCoord.xyToCoord(5, 5),
              PuyoCoord.xyToCoord(6, 5)
            ])
          },
          {
            attr: PuyoAttribute.Heart,
            coords: new Set([PuyoCoord.xyToCoord(3, 1)])
          },
          {
            attr: PuyoAttribute.Prism,
            coords: new Set([PuyoCoord.xyToCoord(4, 1)])
          }
        ]
      },
      {
        board: {
          // biome-ignore format:
          matrix: [
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
            coords: new Set([
              PuyoCoord.xyToCoord(2, 2),
              PuyoCoord.xyToCoord(3, 2),
              PuyoCoord.xyToCoord(4, 2),
              PuyoCoord.xyToCoord(5, 2)
            ])
          },
          {
            attr: PuyoAttribute.Yellow,
            coords: new Set([
              PuyoCoord.xyToCoord(0, 3),
              PuyoCoord.xyToCoord(1, 3),
              PuyoCoord.xyToCoord(1, 4),
              PuyoCoord.xyToCoord(1, 5)
            ])
          },
          {
            attr: PuyoAttribute.Purple,
            coords: new Set([
              PuyoCoord.xyToCoord(4, 3),
              PuyoCoord.xyToCoord(4, 4),
              PuyoCoord.xyToCoord(5, 4),
              PuyoCoord.xyToCoord(5, 5),
              PuyoCoord.xyToCoord(6, 5)
            ])
          },
          {
            attr: PuyoAttribute.Heart,
            coords: new Set([PuyoCoord.xyToCoord(3, 1)])
          },
          {
            attr: PuyoAttribute.Prism,
            coords: new Set([PuyoCoord.xyToCoord(4, 1)])
          }
        ]
      }
    ])('should detect blocks to be popped', ({ board, expected }) => {
      // Arrange
      const field = new Field();
      field.resetFieldByBoard(board);

      // Act
      const actual = (field as any).detectPopBlocks2();

      // Assert
      expect(actual).toEqual(expected);
    });
  });

  describe('continueChainsToTheEnd()', () => {
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
            damageTerms: new Map([
              [
                PuyoAttribute.Purple,
                {
                  strength: 1,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 2,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Green,
                {
                  strength: 3.8000000000000003,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 3,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Red,
                {
                  strength: 5.8999999999999995,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 4,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Yellow,
                {
                  strength: 8,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 5,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Blue,
                {
                  strength: 9.4,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 6,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Purple,
                {
                  strength: 10.799999999999999,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 7,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Red,
                {
                  strength: 12.200000000000001,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 8,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Blue,
                {
                  strength: 13.6,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 9,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Green,
                {
                  strength: 15,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 10,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Yellow,
                {
                  strength: 16.400000000000002,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 11,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Blue,
                {
                  strength: 17.800000000000004,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 12,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Red,
                {
                  strength: 19.2,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 13,
            poppedPuyoNum: 3,
            puyoTsukaiCount: 3,
            damageTerms: new Map([
              [
                PuyoAttribute.Purple,
                {
                  strength: 20.599999999999998,
                  poppedNum: 3,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 14,
            poppedPuyoNum: 10,
            puyoTsukaiCount: 10,
            damageTerms: new Map([
              [
                PuyoAttribute.Green,
                {
                  strength: 90.19999999999999,
                  poppedNum: 10,
                  separatedBlocksNum: 2
                }
              ]
            ])
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
            damageTerms: new Map([
              [
                PuyoAttribute.Blue,
                {
                  strength: 1.3,
                  poppedNum: 6,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 2,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Purple,
                {
                  strength: 5,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 3,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Yellow,
                {
                  strength: 8,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 4,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Green,
                {
                  strength: 11,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 5,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Purple,
                {
                  strength: 13,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 6,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Red,
                {
                  strength: 15,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 7,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Purple,
                {
                  strength: 17,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 8,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Red,
                {
                  strength: 19,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 9,
            poppedPuyoNum: 4,
            puyoTsukaiCount: 4,
            damageTerms: new Map([
              [
                PuyoAttribute.Green,
                {
                  strength: 21,
                  poppedNum: 4,
                  separatedBlocksNum: 1
                }
              ]
            ])
          },
          {
            chainNum: 10,
            poppedPuyoNum: 13,
            puyoTsukaiCount: 13,
            damageTerms: new Map([
              [
                PuyoAttribute.Blue,
                {
                  strength: 108.09999999999998,
                  poppedNum: 13,
                  separatedBlocksNum: 2
                }
              ]
            ])
          }
        ]
      }
    ])(
      'should calculate chainDamages',
      ({
        maxTraceNum,
        poppingLeverage,
        boardId,
        nextPuyoType,
        traceCoords,
        expected
      }) => {
        // Arrange
        const field = new Field();
        const board = getSpecialBoard(boardId);
        field.resetFieldByBoard(board);
        field.setMaxTraceNum(maxTraceNum);
        field.setPoppingLeverage(poppingLeverage);
        field.resetNextPuyosAsSameType(nextPuyoType);
        field.setTraceCoords(traceCoords as PuyoCoord[]);

        // Act
        field.continueChainsToTheEnd()!;

        // Assert
        const chainDamages = field.getChainDamages();
        expect(chainDamages).toEqual(expected);
      }
    );
  });

  describe('solve2()', () => {
    it.each([
      {
        attr: PuyoAttribute.Green,
        optTarget: OptimizationTarget.GreenDamage,
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule1/1',
        nextPuyoType: PuyoType.Green,
        expected: {
          candidatesNum: 15359,
          traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
          totalAttrDamage: 109.0,
          csp: '14-2-10'
        }
      },
      {
        attr: PuyoAttribute.Blue,
        optTarget: OptimizationTarget.BlueDamage,
        maxTraceNum: 5,
        poppingLeverage: 1.0,
        boardId: 'specialRule2/1',
        nextPuyoType: PuyoType.Blue,
        expected: {
          candidatesNum: 15359,
          traceCoords: [
            PuyoCoord.xyToCoord(3, 0),
            PuyoCoord.xyToCoord(4, 1),
            PuyoCoord.xyToCoord(5, 0),
            PuyoCoord.xyToCoord(4, 2),
            PuyoCoord.xyToCoord(3, 3)
          ],
          totalAttrDamage: 109.4,
          csp: '10-2-13'
        }
      }
    ])(
      'should find optimal solution for attr damage in the field ',
      ({
        attr,
        optTarget,
        maxTraceNum,
        poppingLeverage,
        boardId,
        nextPuyoType,
        expected
      }) => {
        // Arrange
        const field = new Field();
        const board = getSpecialBoard(boardId);
        field.resetFieldByBoard(board);
        field.setMaxTraceNum(maxTraceNum);
        field.setPoppingLeverage(poppingLeverage);
        field.resetNextPuyosAsSameType(nextPuyoType);

        // Act
        const actual = field.solve2(optTarget)!;

        // Assert
        expect(actual.optimizationTarget).toBe(optTarget);
        expect(actual.candidatesNum).toBe(expected.candidatesNum);
        expect(actual.optimalSolution?.traceCoords).toEqual(
          expected.traceCoords
        );
        expect(
          actual.optimalSolution?.totalDamages[attr as ColoredPuyoAttribute]
        ).toBeCloseTo(expected.totalAttrDamage);
        const csp = calcCsp(
          findMostDamageChain(actual.optimalSolution?.chainDamages!, attr)!,
          attr
        );
        expect(csp).toBe(expected.csp);
      }
    );
  });
});
