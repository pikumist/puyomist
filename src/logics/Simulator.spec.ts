import { beforeEach, describe, expect, it } from 'vitest';
import { createSimulationData } from '../store/internal/createSimulationData';
import type { Board } from './Board';
import { emptyBoard } from './Board';
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
const Pc = PuyoType.PurpleChance;
const O = PuyoType.Ojama;
const Z = PuyoType.Kata;

describe('Simulator', () => {
  beforeEach(() => {
    __resetPuyoIdCount();
  });

  describe('constructor', () => {
    it('should initialize an empty board when no simulation data is given', () => {
      // Act
      const simulator = new Simulator();

      // Assert
      const data = simulator.getSimulationData();
      expect(data.field).toHaveLength(PuyoCoord.YNum);
      for (const row of data.field) {
        expect(row).toHaveLength(PuyoCoord.XNum);
        for (const puyo of row) {
          expect(puyo).toBeUndefined();
        }
      }
      expect(data.nextPuyos).toHaveLength(PuyoCoord.XNum);
      for (const puyo of data.nextPuyos) {
        expect(puyo).toBeUndefined();
      }
      expect(data.boostAreaCoordList).toEqual([]);
      expect(data.isChanceMode).toBe(false);
      expect(data.traceCoords).toEqual([]);
      expect(data.minimumPuyoNumForPopping).toBe(
        Simulator.defaultMinimumPuyoNumForPopping
      );
      expect(data.maxTraceNum).toBe(Simulator.defaultMaxTraceNum);
      expect(data.traceMode).toBe(TraceMode.Normal);
      expect(data.poppingLeverage).toBe(1.0);
      expect(data.chainLeverage).toBe(1.0);
    });
  });

  describe('getField()', () => {
    it('should return the field matrix built from the simulation data', () => {
      // Arrange
      const board = {
        // biome-ignore format:
        field: [
          [R, B, G, Y, P, H, W, O],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E]
        ]
      } satisfies Board;
      const simulator = new Simulator(createSimulationData(board));

      // Act
      const field = simulator.getField();

      // Assert
      expect(field[0][0]?.type).toBe(R);
      expect(field[0][1]?.type).toBe(B);
      expect(field[0][2]?.type).toBe(G);
      expect(field[0][7]?.type).toBe(O);
      expect(field[1][0]).toBeUndefined();
    });
  });

  describe('getActualMaxTraceNum()', () => {
    it.each([
      { isChanceMode: false, maxTraceNum: 3, expected: 3 },
      { isChanceMode: true, maxTraceNum: 3, expected: 5 },
      { isChanceMode: true, maxTraceNum: 7, expected: 5 }
    ])(
      'should be $expected when isChanceMode=$isChanceMode and maxTraceNum=$maxTraceNum',
      ({ isChanceMode, maxTraceNum, expected }) => {
        // Arrange
        const simulationData = createSimulationData(
          { ...emptyBoard, isChanceMode } satisfies Board,
          { maxTraceNum }
        );
        const simulator = new Simulator(simulationData);

        // Act & Assert
        expect(simulator.getActualMaxTraceNum()).toBe(expected);
      }
    );
  });

  describe('clear()', () => {
    it('should reset field, nextPuyos, chance mode and max trace num to defaults', () => {
      // Arrange
      const board = {
        // biome-ignore format:
        field: [
          [R, B, G, Y, P, H, W, O],
          [R, B, G, Y, P, H, W, O],
          [R, B, G, Y, P, H, W, O],
          [R, B, G, Y, P, H, W, O],
          [R, B, G, Y, P, H, W, O],
          [R, B, G, Y, P, H, W, O]
        ],
        nextPuyos: [R, R, R, R, R, R, R, R],
        isChanceMode: true
      } satisfies Board;
      const simulationData = createSimulationData(board, { maxTraceNum: 2 });
      const simulator = new Simulator(simulationData);

      // Act
      simulator.clear();

      // Assert
      const data = simulator.getSimulationData();
      for (const row of data.field) {
        for (const puyo of row) {
          expect(puyo).toBeUndefined();
        }
      }
      for (const puyo of data.nextPuyos) {
        expect(puyo).toBeUndefined();
      }
      expect(data.isChanceMode).toBe(false);
      expect(data.maxTraceNum).toBe(Simulator.defaultMaxTraceNum);
    });
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
        // specialRule1/1 modified'
        board: {
          field: [
            [R, P, Z, P, Y, G, Y, Y],
            [R, Y, P, H, Y, G, Pc, G],
            [B, Y, G, B, O, Y, G, Pc],
            [B, R, B, R, P, B, R, Pc],
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
            },
            popped_chance_num: 3,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
          },
          {
            chain_num: 6,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 12.419999999999998,
                popped_count: 3,
                separated_blocks_num: 1
              },
              [PuyoAttr.Ojama]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
          },
          {
            chain_num: 10,
            simultaneous_num: 3,
            boost_count: 0,
            puyo_tsukai_count: 3,
            attributes: {
              [PuyoAttr.Yellow]: {
                strength: 16.400000000000002,
                popped_count: 3,
                separated_blocks_num: 1
              },
              [PuyoAttr.Kata]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
          },
          {
            chain_num: 13,
            simultaneous_num: 4,
            boost_count: 0,
            puyo_tsukai_count: 4,
            attributes: {
              [PuyoAttr.Purple]: {
                strength: 23.689999999999994,
                popped_count: 3,
                separated_blocks_num: 1
              },
              [PuyoAttr.Ojama]: {
                strength: 0,
                popped_count: 1,
                separated_blocks_num: 0
              }
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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
            popped_chance_num: 0,
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
            popped_chance_num: 1,
            is_all_cleared: false
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
            },
            popped_chance_num: 0,
            is_all_cleared: false
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

    it('should return animation steps reflecting every intermediate field state when animate=true', () => {
      // Arrange
      const board = {
        field: [
          [R, P, Z, P, Y, G, Y, Y],
          [R, Y, P, H, Y, G, Pc, G],
          [B, Y, G, B, O, Y, G, Pc],
          [B, R, B, R, P, B, R, Pc],
          [Y, G, P, P, R, B, G, G],
          [B, G, B, R, B, Y, R, R]
        ],
        nextPuyos: [G, G, G, G, G, G, G, G],
        traceMode: TraceMode.Normal,
        minimumPuyoNumForPopping: 3,
        chainLeverage: 7.0
      } satisfies Board;
      const simulationData = createSimulationData(board, {
        maxTraceNum: 5,
        poppingLeverage: 1.0
      });
      const simulator = new Simulator(simulationData);
      simulator.setTraceCoords([
        PuyoCoord.xyToCoord(5, 2)!,
        PuyoCoord.xyToCoord(6, 2)!
      ]);

      // Act
      const animationSteps = simulator.doChains(true);

      // Assert
      expect(animationSteps).toBeDefined();
      // The first step is captured before anything has popped or dropped.
      expect(animationSteps![0].chains).toEqual([]);
      expect(animationSteps![0].field).toEqual(
        simulationData.field.map((row) => [...row])
      );
      // Every intermediate step's recorded chains grow monotonically and the
      // final one matches the fully resolved chain list.
      const finalChains = simulator.getChains();
      expect(finalChains).toHaveLength(14);
      expect(animationSteps!.length).toBeGreaterThan(finalChains.length);
      expect(animationSteps![animationSteps!.length - 1].chains).toEqual(
        finalChains
      );
      for (let i = 1; i < animationSteps!.length; i++) {
        expect(animationSteps![i].chains.length).toBeGreaterThanOrEqual(
          animationSteps![i - 1].chains.length
        );
      }
    });

    it('should keep chaining when a puyo dropped in from the next queue falls again and forms a further match', () => {
      // Arrange
      //
      // Columns 0 and 1 have a 2-row gap at the top, backed by a green pair
      // (0,2)-(0,3) that is horizontally joined to (1,2), and column 2 is a
      // full column holding an isolated blue pair at (2,2)-(2,3).
      // Dropping a green next-puyo into column 0 (landing at (0,1)) and a
      // blue one into column 1 (landing at (1,1)) completes the green block
      // (0,1)-(0,2)-(0,3)-(1,2), which pops. The drop that follows shifts the
      // still-unpopped blue puyo at (1,1) down into (1,2), where it newly
      // joins the blue pair at (2,2)-(2,3) into a second, cascading pop.
      const board = {
        // biome-ignore format:
        field: [
          [E, E, P, Y, R, Y, R, Y],
          [E, E, Y, R, Y, R, Y, R],
          [G, G, B, Y, R, Y, R, Y],
          [G, R, B, R, Y, R, Y, R],
          [R, Y, P, Y, R, Y, R, Y],
          [B, P, Y, R, Y, R, Y, R]
        ],
        nextPuyos: [G, B, E, E, E, E, E, E],
        minimumPuyoNumForPopping: 3
      } satisfies Board;
      const simulator = new Simulator(createSimulationData(board));
      // Removing this puyo does not require any puyo to fall (it is already
      // at the top of an otherwise full column), so it only serves to make
      // popTracingPuyos() report that something was traced.
      simulator.setTraceCoords([PuyoCoord.xyToCoord(7, 0)!]);

      // Act
      const animationSteps = simulator.doChains(true);

      // Assert
      const chains = simulator.getChains();
      expect(chains).toHaveLength(2);
      // The animation captured a step for both the initial state and each
      // subsequent drop/pop, and its last step reflects the fully resolved
      // chain list.
      expect(animationSteps!.length).toBeGreaterThan(2);
      expect(animationSteps![0].chains).toEqual([]);
      expect(animationSteps![animationSteps!.length - 1].chains).toEqual(
        chains
      );
      expect(chains[0]).toMatchObject({
        chain_num: 1,
        simultaneous_num: 4,
        boost_count: 0,
        puyo_tsukai_count: 4,
        attributes: {
          [PuyoAttr.Green]: { popped_count: 4, separated_blocks_num: 1 }
        },
        popped_chance_num: 0,
        is_all_cleared: false
      });
      expect(chains[1]).toMatchObject({
        chain_num: 2,
        simultaneous_num: 3,
        boost_count: 0,
        puyo_tsukai_count: 3,
        attributes: {
          [PuyoAttr.Blue]: { popped_count: 3, separated_blocks_num: 1 }
        },
        popped_chance_num: 0,
        is_all_cleared: false
      });
    });

    it('should count a special (non-colored) block toward boost_count and puyo_tsukai_count when it is inside a boost area', () => {
      // Arrange
      //
      // (0,5)-(1,5)-(2,5) is a red trio, and the heart at (1,4) is adjacent
      // to it, so both pop together in one block detection pass. Only the
      // heart's coordinate is inside the boost area. Everywhere else is
      // empty except a lone yellow puyo in column 3, used only to make a
      // puyo fall (via the removal below) so doChains() re-scans the whole
      // board for the already-complete red+heart block.
      const board = {
        // biome-ignore format:
        field: [
          [E, E, E, Y, E, E, E, E],
          [E, E, E, P, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, H, E, E, E, E, E, E],
          [R, R, R, E, E, E, E, E]
        ],
        minimumPuyoNumForPopping: 3
      } satisfies Board;
      const simulationData = createSimulationData(board, {
        boostAreaCoordList: [PuyoCoord.xyToCoord(1, 4)!]
      });
      const simulator = new Simulator(simulationData);
      simulator.setTraceCoords([PuyoCoord.xyToCoord(3, 1)!]);

      // Act
      simulator.doChains();

      // Assert
      const chains = simulator.getChains();
      expect(chains).toHaveLength(1);
      expect(chains[0]).toMatchObject({
        chain_num: 1,
        simultaneous_num: 3,
        boost_count: 1,
        puyo_tsukai_count: 6,
        attributes: {
          [PuyoAttr.Red]: { popped_count: 3, separated_blocks_num: 1 },
          [PuyoAttr.Heart]: {
            strength: 0,
            popped_count: 1,
            separated_blocks_num: 0
          }
        },
        popped_chance_num: 0,
        is_all_cleared: false
      });
    });
  });

  describe('popTracingPuyos() via doChains()', () => {
    it('should throw when traceMode is neither Normal nor a valid colored attribute', () => {
      // Arrange
      const simulationData = createSimulationData(emptyBoard, {
        traceMode: 100 as unknown as TraceMode
      });
      const simulator = new Simulator(simulationData);
      simulator.setTraceCoords([PuyoCoord.xyToCoord(0, 0)!]);

      // Act & Assert
      expect(() => simulator.doChains()).toThrow('traceMode is invalid.');
    });

    it('should skip trace coordinates that have no puyo when changing colors', () => {
      // Arrange
      const board = {
        // biome-ignore format:
        field: [
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [E, E, E, E, E, E, E, E],
          [R, R, E, E, E, E, E, E],
          [R, E, E, E, E, E, E, E]
        ],
        traceMode: TraceMode.ToRed
      } satisfies Board;
      const simulator = new Simulator(createSimulationData(board));
      // The second coordinate has no puyo, so it should just be skipped
      // rather than throwing or otherwise breaking the trace.
      simulator.setTraceCoords([
        PuyoCoord.xyToCoord(1, 4)!,
        PuyoCoord.xyToCoord(3, 3)!
      ]);

      // Act
      simulator.doChains();

      // Assert
      expect(simulator.getChains()).toEqual([]);
      // The skipped coordinate never had a puyo, so it stays empty.
      expect(simulator.getField()[3][3]).toBeUndefined();
      // The traced puyo that did exist gets converted (still Red here).
      expect(simulator.getField()[4][1]?.type).toBe(R);
    });
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
          },
          popped_chance_num: 0,
          is_all_cleared: false
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
          },
          popped_chance_num: 0,
          is_all_cleared: false
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
          },
          popped_chance_num: 0,
          is_all_cleared: false
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
          },
          popped_chance_num: 0,
          is_all_cleared: false
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
          },
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ];

      // Actual
      const actual = Simulator.calcTotalWildDamage(chains);

      // Assert
      expect(actual).toBeCloseTo(20.3544);
    });
  });

  describe('isAllCleared()', () => {
    it.each([
      { flags: [false, false], expected: false },
      { flags: [false, true], expected: true }
    ])(
      'should be $expected when chain is_all_cleared flags are $flags',
      ({ flags, expected }) => {
        // Arrange
        const chains: Chain[] = flags.map((is_all_cleared, i) => ({
          chain_num: i + 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          attributes: {},
          popped_chance_num: 0,
          is_all_cleared
        }));

        // Act & Assert
        expect(Simulator.isAllCleared(chains)).toBe(expected);
      }
    );
  });

  describe('isChancePopped()', () => {
    it.each([
      { counts: [0, 0], expected: false },
      { counts: [0, 2], expected: true }
    ])(
      'should be $expected when popped_chance_num values are $counts',
      ({ counts, expected }) => {
        // Arrange
        const chains: Chain[] = counts.map((popped_chance_num, i) => ({
          chain_num: i + 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          attributes: {},
          popped_chance_num,
          is_all_cleared: false
        }));

        // Act & Assert
        expect(Simulator.isChancePopped(chains)).toBe(expected);
      }
    );
  });

  describe('calcPoppedChanceNum()', () => {
    it('should sum popped_chance_num across all chains', () => {
      // Arrange
      const chains: Chain[] = [1, 0, 2].map((popped_chance_num, i) => ({
        chain_num: i + 1,
        simultaneous_num: 4,
        boost_count: 0,
        puyo_tsukai_count: 4,
        attributes: {},
        popped_chance_num,
        is_all_cleared: false
      }));

      // Act & Assert
      expect(Simulator.calcPoppedChanceNum(chains)).toBe(3);
    });
  });

  describe('isPrismPopped()', () => {
    it('should return true when a chain popped one or more prism puyos', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          attributes: {},
          popped_chance_num: 0,
          is_all_cleared: false
        },
        {
          chain_num: 2,
          simultaneous_num: 1,
          boost_count: 0,
          puyo_tsukai_count: 1,
          attributes: {
            [PuyoAttr.Prism]: {
              strength: 3,
              popped_count: 1,
              separated_blocks_num: 0
            }
          },
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ];

      // Act & Assert
      expect(Simulator.isPrismPopped(chains)).toBe(true);
    });

    it('should return false when no chain has a popped prism puyo', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          attributes: {},
          popped_chance_num: 0,
          is_all_cleared: false
        },
        {
          chain_num: 2,
          simultaneous_num: 0,
          boost_count: 0,
          puyo_tsukai_count: 0,
          attributes: {
            [PuyoAttr.Prism]: {
              strength: 0,
              popped_count: 0,
              separated_blocks_num: 0
            }
          },
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ];

      // Act & Assert
      expect(Simulator.isPrismPopped(chains)).toBe(false);
    });
  });

  describe('calcTotalPuyoTsukaiCount()', () => {
    it('should sum puyo_tsukai_count across all chains', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 5,
          attributes: {},
          popped_chance_num: 0,
          is_all_cleared: false
        },
        {
          chain_num: 2,
          simultaneous_num: 6,
          boost_count: 0,
          puyo_tsukai_count: 8,
          attributes: {},
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ];

      // Act & Assert
      expect(Simulator.calcTotalPuyoTsukaiCount(chains)).toBe(13);
    });
  });

  describe('calcTotalCountOfTargetAttr()', () => {
    it('should sum popped_count of the target attribute, treating a missing attribute as 0', () => {
      // Arrange
      const chains: Chain[] = [
        {
          chain_num: 1,
          simultaneous_num: 5,
          boost_count: 0,
          puyo_tsukai_count: 5,
          attributes: {
            [PuyoAttr.Heart]: {
              strength: 0,
              popped_count: 2,
              separated_blocks_num: 0
            }
          },
          popped_chance_num: 0,
          is_all_cleared: false
        },
        {
          chain_num: 2,
          simultaneous_num: 4,
          boost_count: 0,
          puyo_tsukai_count: 4,
          attributes: {
            [PuyoAttr.Heart]: {
              strength: 0,
              popped_count: 3,
              separated_blocks_num: 0
            }
          },
          popped_chance_num: 0,
          is_all_cleared: false
        }
      ];

      // Act & Assert
      expect(Simulator.calcTotalCountOfTargetAttr(chains, PuyoAttr.Heart)).toBe(
        5
      );
      expect(Simulator.calcTotalCountOfTargetAttr(chains, PuyoAttr.Prism)).toBe(
        0
      );
    });
  });
});
