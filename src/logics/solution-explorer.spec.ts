import { describe, expect, it } from 'vitest';
import { createNextPuyosAsSameType } from '../reducers/internal/createNextPuyos';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import type { Chain } from './Chain';
import {
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from './ExplorationTarget';
import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import { getSpecialBoard } from './boards';
import { B, E, G, P, R, Y } from './boards/alias';
import {
  type PartialSolutionResult,
  betterSolution,
  solveAllTraces,
  solveIncludingTraceIndex
} from './solution-explorer';

describe('solution-explorer', () => {
  describe('betterSolution()', () => {
    type Input = {
      s1: PartialSolutionResult;
      s2: PartialSolutionResult;
      result: 's1' | 's2';
    };

    describe('BCPAS', () => {
      const priorities = [
        PreferenceKind.BiggerValue,
        PreferenceKind.ChancePop,
        PreferenceKind.PrismPop,
        PreferenceKind.AllClear,
        PreferenceKind.SmallerTraceNum
      ] satisfies PreferenceKind[];

      it.each([
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: true,
            is_prism_popped: true
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 200,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          },
          result: 's2'
        } as Input,
        {
          s1: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 200,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          },
          s2: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: true,
            is_prism_popped: true
          },
          result: 's1'
        } as Input,
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: false,
            is_prism_popped: true
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: true,
            is_prism_popped: false
          },
          result: 's2'
        } as Input,
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: false,
            is_prism_popped: false
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: true
          },
          result: 's2'
        } as Input,
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: false,
            is_prism_popped: false
          },
          result: 's2'
        } as Input,
        {
          s1: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!,
              PuyoCoord.cellAddrToCoord('D5')!
            ],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          },
          result: 's2'
        } as Input
      ])('should return better one', (params) => {
        // Arrange
        const { s1, s2 } = params;
        const expected = params[params.result];

        // Act
        const actual = betterSolution(priorities, s1, s2);

        // Assert
        expect(actual).toBe(expected);
      });

      it.each([
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: true,
            is_prism_popped: true
          } as PartialSolutionResult,
          s2: {
            trace_coords: [PuyoCoord.cellAddrToCoord('D4')!],
            value: 100,
            is_all_cleared: true,
            is_chance_popped: true,
            is_prism_popped: true
          } as PartialSolutionResult
        },
        {
          s1: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')
            ],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          } as PartialSolutionResult,
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('D4')!,
              PuyoCoord.cellAddrToCoord('E5')
            ],
            value: 100,
            is_all_cleared: false,
            is_chance_popped: false,
            is_prism_popped: false
          } as PartialSolutionResult
        }
      ])('should return s1 when everything is a tie', (params) => {
        // Arrange
        const { s1, s2 } = params;

        // Act
        const actual = betterSolution(priorities, s1, s2);

        // Assert
        expect(actual).toBe(s1);
      });
    });
  });

  describe('solve', () => {
    const calcCsp = (chain: Chain, attr: PuyoAttr) => {
      const c = chain.chain_num;
      const s = chain.attributes[attr]?.separated_blocks_num;
      const p = chain.simultaneous_num;
      if (s) {
        return `${c}-${s}-${p}`;
      }
    };

    const findMostDamageChain = (
      chains: Chain[],
      attr: PuyoAttr
    ): Chain | undefined => {
      const effectiveChainDamages = chains.filter((chainDamage) => {
        return chainDamage.attributes[attr]?.strength;
      });
      const mostDamageChain = effectiveChainDamages.reduce(
        (m, chainDamage) => {
          if (!m) {
            return chainDamage;
          }
          return chainDamage.attributes[attr]?.strength! >=
            m.attributes[attr]?.strength!
            ? chainDamage
            : m;
        },
        undefined as Chain | undefined
      );

      return mostDamageChain;
    };

    describe('solveAllTraces()', () => {
      it.each([
        {
          attr: PuyoAttr.Green,
          explorationTarget: {
            category: ExplorationCategory.Damage as const,
            preference_priorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            optimal_solution_count: 1,
            main_attr: PuyoAttr.Green as const
          } satisfies ExplorationTarget,
          maxTraceNum: 5,
          poppingLeverage: 1.0,
          boardId: 'specialRule1/1',
          nextPuyoType: PuyoType.Green,
          expected: {
            candidatesNum: 15359,
            traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
            value: 109.0,
            csp: '14-2-10'
          }
        },
        {
          attr: PuyoAttr.Blue,
          explorationTarget: {
            category: ExplorationCategory.Damage as const,
            preference_priorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            optimal_solution_count: 1,
            main_attr: PuyoAttr.Blue as const
          } satisfies ExplorationTarget,
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
            value: 109.4,
            csp: '10-2-13'
          }
        }
      ])(
        'should find an optimal solution for the optimization target when optimal_solution_num is one',
        ({
          attr,
          explorationTarget,
          maxTraceNum,
          poppingLeverage,
          boardId,
          nextPuyoType,
          expected
        }) => {
          // Arrange
          const board = getSpecialBoard(boardId);
          const nextPuyos = createNextPuyosAsSameType(nextPuyoType);
          const simulationData = createSimulationData(board, {
            maxTraceNum,
            poppingLeverage,
            nextPuyos
          });
          const simulator = new Simulator(simulationData);

          // Act
          const actual = solveAllTraces(simulator, explorationTarget)!;

          // Assert
          expect(actual.candidates_num).toBe(expected.candidatesNum);
          expect(actual.optimal_solutions[0].trace_coords).toEqual(
            expected.traceCoords
          );
          expect(actual.optimal_solutions[0].value).toBeCloseTo(expected.value);
          const csp = calcCsp(
            findMostDamageChain(actual.optimal_solutions[0].chains!, attr)!,
            attr
          );
          expect(csp).toBe(expected.csp);
        }
      );

      it.each([
        {
          attr: PuyoAttr.Green,
          explorationTarget: {
            category: ExplorationCategory.Damage as const,
            preference_priorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            optimal_solution_count: 1,
            main_attr: PuyoAttr.Green as const
          } satisfies ExplorationTarget,
          maxTraceNum: 5,
          poppingLeverage: 1.0,
          boardId: 'specialRule1/1',
          nextPuyoType: PuyoType.Green,
          customCoordMap: new Map<PuyoCoord, PuyoType>([
            [PuyoCoord.xyToCoord(5, 2)!, PuyoType.Ojama],
            [PuyoCoord.xyToCoord(6, 2)!, PuyoType.Kata]
          ]),
          expected: {
            candidatesNum: 11256,
            traceCoords: [
              PuyoCoord.xyToCoord(5, 4),
              PuyoCoord.xyToCoord(6, 4),
              PuyoCoord.xyToCoord(4, 5)
            ],
            value: 113.75,
            csp: '9-3-12'
          }
        }
      ])(
        'should find an optimal solution avoiding untraceable puyo',
        ({
          attr,
          explorationTarget,
          maxTraceNum,
          poppingLeverage,
          boardId,
          nextPuyoType,
          customCoordMap,
          expected
        }) => {
          // Arrange
          const board = structuredClone(getSpecialBoard(boardId));
          for (const [coord, type] of customCoordMap) {
            board.field[coord.y][coord.x] = type;
          }
          const nextPuyos = createNextPuyosAsSameType(nextPuyoType);
          const simulationData = createSimulationData(board, {
            maxTraceNum,
            poppingLeverage,
            nextPuyos
          });
          const simulator = new Simulator(simulationData);

          // Act
          const actual = solveAllTraces(simulator, explorationTarget)!;

          // Assert
          expect(actual.candidates_num).toBe(expected.candidatesNum);
          expect(actual.optimal_solutions[0].trace_coords).toEqual(
            expected.traceCoords
          );
          expect(actual.optimal_solutions[0].value).toBeCloseTo(expected.value);
          const csp = calcCsp(
            findMostDamageChain(actual.optimal_solutions[0].chains!, attr)!,
            attr
          );
          expect(csp).toBe(expected.csp);
        }
      );

      it('chance_mode, damage wild, preferring_all_clear, optimal_solution_count=2', () => {
        // Arrange
        const explorationTarget: ExplorationTarget = {
          category: ExplorationCategory.Damage,
          preference_priorities: [
            PreferenceKind.AllClear,
            PreferenceKind.BiggerValue,
            PreferenceKind.ChancePop,
            PreferenceKind.PrismPop,
            PreferenceKind.SmallerTraceNum
          ],
          optimal_solution_count: 2,
          main_attr: undefined
        };
        const simulationData = createSimulationData({
          nextPuyos: [E, E, E, E, E, E, E, E],
          field: [
            [P, B, E, G, G, G, E, E],
            [P, G, P, P, R, R, R, Y],
            [G, P, G, B, P, B, Y, B],
            [B, G, B, P, B, R, B, R],
            [Y, B, Y, B, R, P, R, R],
            [Y, Y, G, R, B, B, Y, Y]
          ],
          isChanceMode: true,
          minimumPuyoNumForPopping: 4,
          maxTraceNum: 48,
          traceMode: TraceMode.Normal,
          poppingLeverage: 5.0,
          chainLeverage: 1.0
        });
        const simulator = new Simulator(simulationData);

        // Act
        const actual = solveAllTraces(simulator, explorationTarget)!;

        // Assert
        expect(actual.candidates_num).toBe(13507);
        expect(actual.optimal_solutions.length).toBe(2);
        expect(actual.optimal_solutions[0]).toEqual({
          trace_coords: [
            PuyoCoord.xyToCoord(3, 2),
            PuyoCoord.xyToCoord(4, 3),
            PuyoCoord.xyToCoord(3, 4),
            PuyoCoord.xyToCoord(5, 4),
            PuyoCoord.xyToCoord(2, 5)
          ],
          chains: [
            {
              chain_num: 1,
              simultaneous_num: 9,
              boost_count: 0,
              puyo_tsukai_count: 9,
              attributes: {
                [PuyoAttr.Red]: {
                  strength: 4.75,
                  popped_count: 5,
                  separated_blocks_num: 1
                },
                [PuyoAttr.Yellow]: {
                  strength: 4.75,
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
                  strength: 9.799999999999999,
                  popped_count: 5,
                  separated_blocks_num: 1
                },
                [PuyoAttr.Purple]: {
                  strength: 9.799999999999999,
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
                  strength: 10.625,
                  popped_count: 7,
                  separated_blocks_num: 1
                },
                [PuyoAttr.Yellow]: {
                  strength: 10.625,
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
                  strength: 8.0,
                  popped_count: 4,
                  separated_blocks_num: 1
                },
                [PuyoAttr.Blue]: {
                  strength: 8.0,
                  popped_count: 4,
                  separated_blocks_num: 1
                }
              },
              is_all_cleared: true
            }
          ],
          value: 66.35,
          is_all_cleared: true,
          is_chance_popped: false,
          is_prism_popped: false
        });
        expect(actual.optimal_solutions[1]).toEqual({
          trace_coords: [
            PuyoCoord.xyToCoord(4, 1),
            PuyoCoord.xyToCoord(3, 2),
            PuyoCoord.xyToCoord(4, 3),
            PuyoCoord.xyToCoord(3, 4),
            PuyoCoord.xyToCoord(4, 5)
          ],
          chains: [
            {
              chain_num: 1,
              simultaneous_num: 4,
              boost_count: 0,
              puyo_tsukai_count: 4,
              attributes: {
                [PuyoAttr.Purple]: {
                  strength: 1.0,
                  popped_count: 4,
                  separated_blocks_num: 1
                }
              }
            },
            {
              chain_num: 2,
              simultaneous_num: 4,
              boost_count: 0,
              puyo_tsukai_count: 4,
              attributes: {
                [PuyoAttr.Red]: {
                  strength: 1.4,
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
                [PuyoAttr.Blue]: {
                  strength: 1.7,
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
                [PuyoAttr.Yellow]: {
                  strength: 2.0,
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
                [PuyoAttr.Red]: {
                  strength: 2.2,
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
                [PuyoAttr.Green]: {
                  strength: 2.4,
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
                [PuyoAttr.Yellow]: {
                  strength: 2.6,
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
                [PuyoAttr.Purple]: {
                  strength: 2.8,
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
                  strength: 3.0,
                  popped_count: 4,
                  separated_blocks_num: 1
                }
              }
            },
            {
              chain_num: 10,
              simultaneous_num: 4,
              boost_count: 0,
              puyo_tsukai_count: 4,
              attributes: {
                [PuyoAttr.Blue]: {
                  strength: 3.2,
                  popped_count: 4,
                  separated_blocks_num: 1
                }
              },
              is_all_cleared: true
            }
          ],
          value: 22.3,
          is_all_cleared: true,
          is_chance_popped: false,
          is_prism_popped: false
        });
      });
    });

    describe('solveIncludingTraceIndex()', () => {
      it.each([
        {
          traceIndex: 21,
          attr: PuyoAttr.Green,
          explorationTarget: {
            category: ExplorationCategory.Damage as const,
            preference_priorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            optimal_solution_count: 1,
            main_attr: PuyoAttr.Green as const
          } satisfies ExplorationTarget,
          maxTraceNum: 5,
          poppingLeverage: 1.0,
          boardId: 'specialRule1/1',
          nextPuyoType: PuyoType.Green,
          expected: {
            candidatesNum: 539,
            traceCoords: [PuyoCoord.xyToCoord(5, 2), PuyoCoord.xyToCoord(6, 2)],
            value: 109.0,
            csp: '14-2-10'
          }
        },
        {
          traceIndex: 3,
          attr: PuyoAttr.Blue,
          explorationTarget: {
            category: ExplorationCategory.Damage as const,
            preference_priorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            optimal_solution_count: 1,
            main_attr: PuyoAttr.Blue as const
          } satisfies ExplorationTarget,
          maxTraceNum: 5,
          poppingLeverage: 1.0,
          boardId: 'specialRule2/1',
          nextPuyoType: PuyoType.Blue,
          expected: {
            candidatesNum: 760,
            traceCoords: [
              PuyoCoord.xyToCoord(3, 0),
              PuyoCoord.xyToCoord(4, 1),
              PuyoCoord.xyToCoord(5, 0),
              PuyoCoord.xyToCoord(4, 2),
              PuyoCoord.xyToCoord(3, 3)
            ],
            value: 109.4,
            csp: '10-2-13'
          }
        }
      ])(
        'should find an optimal solution that includes the trace index',
        ({
          traceIndex,
          attr,
          explorationTarget,
          maxTraceNum,
          poppingLeverage,
          boardId,
          nextPuyoType,
          expected
        }) => {
          // Arrange
          const board = getSpecialBoard(boardId);
          const nextPuyos = createNextPuyosAsSameType(nextPuyoType);
          const simulationData = createSimulationData(board, {
            maxTraceNum,
            poppingLeverage,
            nextPuyos
          });
          const simulator = new Simulator(simulationData);

          // Act
          const actual = solveIncludingTraceIndex(
            simulator,
            explorationTarget,
            traceIndex
          )!;

          // Assert
          expect(actual.candidates_num).toBe(expected.candidatesNum);
          expect(actual.optimal_solutions[0].trace_coords).toEqual(
            expected.traceCoords
          );
          expect(actual.optimal_solutions[0].value).toBeCloseTo(expected.value);
          const csp = calcCsp(
            findMostDamageChain(actual.optimal_solutions[0].chains!, attr)!,
            attr
          );
          expect(csp).toBe(expected.csp);
        }
      );
    });
  });
});
