import { describe, expect, it } from 'vitest';
import { createNextPuyosAsSameType } from '../reducers/internal/createNextPuyos';
import { createSimulationData } from '../reducers/internal/createSimulationData';
import type { Chain } from './Chain';
import {
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from './ExplorationTarget';
import { PuyoAttribute } from './PuyoAttribute';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import { Simulator } from './Simulator';
import { getSpecialBoard } from './boards';
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
    const calcCsp = (chain: Chain, attr: PuyoAttribute) => {
      const c = chain.chain_num;
      const s = chain.attributes[attr]?.separated_blocks_num;
      const p = chain.simultaneous_num;
      if (s) {
        return `${c}-${s}-${p}`;
      }
    };

    const findMostDamageChain = (
      chains: Chain[],
      attr: PuyoAttribute
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
          attr: PuyoAttribute.Green,
          explorationTarget: {
            preferencePriorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            category: ExplorationCategory.Damage as const,
            mainAttr: PuyoAttribute.Green as const
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
          attr: PuyoAttribute.Blue,
          explorationTarget: {
            preferencePriorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            category: ExplorationCategory.Damage as const,
            mainAttr: PuyoAttribute.Blue as const
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
        'should find an optimal solution for the optimization target',
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
          expect(actual.candidatesNum).toBe(expected.candidatesNum);
          expect(actual.optimalSolution?.trace_coords).toEqual(
            expected.traceCoords
          );
          expect(actual.optimalSolution?.value).toBeCloseTo(expected.value);
          const csp = calcCsp(
            findMostDamageChain(actual.optimalSolution?.chains!, attr)!,
            attr
          );
          expect(csp).toBe(expected.csp);
        }
      );

      it.each([
        {
          attr: PuyoAttribute.Green,
          explorationTarget: {
            preferencePriorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            category: ExplorationCategory.Damage as const,
            mainAttr: PuyoAttribute.Green as const
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
          expect(actual.candidatesNum).toBe(expected.candidatesNum);
          expect(actual.optimalSolution?.trace_coords).toEqual(
            expected.traceCoords
          );
          expect(actual.optimalSolution?.value).toBeCloseTo(expected.value);
          const csp = calcCsp(
            findMostDamageChain(actual.optimalSolution?.chains!, attr)!,
            attr
          );
          expect(csp).toBe(expected.csp);
        }
      );
    });

    describe('solveIncludingTraceIndex()', () => {
      it.each([
        {
          traceIndex: 21,
          attr: PuyoAttribute.Green,
          explorationTarget: {
            preferencePriorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            category: ExplorationCategory.Damage as const,
            mainAttr: PuyoAttribute.Green as const
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
          attr: PuyoAttribute.Blue,
          explorationTarget: {
            preferencePriorities: [
              PreferenceKind.BiggerValue,
              PreferenceKind.ChancePop,
              PreferenceKind.PrismPop,
              PreferenceKind.AllClear,
              PreferenceKind.SmallerTraceNum
            ],
            category: ExplorationCategory.Damage as const,
            mainAttr: PuyoAttribute.Blue as const
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
          expect(actual.candidatesNum).toBe(expected.candidatesNum);
          expect(actual.optimalSolution?.trace_coords).toEqual(
            expected.traceCoords
          );
          expect(actual.optimalSolution?.value).toBeCloseTo(expected.value);
          const csp = calcCsp(
            findMostDamageChain(actual.optimalSolution?.chains!, attr)!,
            attr
          );
          expect(csp).toBe(expected.csp);
        }
      );
    });
  });
});
