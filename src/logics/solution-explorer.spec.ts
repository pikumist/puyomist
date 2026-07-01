import { describe, expect, it } from 'vitest';
import { createNextPuyosAsSameType } from '../store/internal/createNextPuyos';
import { createSimulationData } from '../store/internal/createSimulationData';
import type { Chain } from './Chain';
import {
  CountingBonusType,
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
import type { SolutionResult } from './solution';
import {
  type PartialSolutionResult,
  betterSolution,
  better_solution_by_all_clear,
  better_solution_by_bigger_trace_num,
  better_solution_by_bigger_value,
  better_solution_by_chance_pop,
  better_solution_by_heart_pop,
  better_solution_by_less_chance_pop,
  better_solution_by_less_heart_pop,
  better_solution_by_less_ojama_pop,
  better_solution_by_less_prism_pop,
  better_solution_by_more_chance_pop,
  better_solution_by_more_heart_pop,
  better_solution_by_more_ojama_pop,
  better_solution_by_more_prism_pop,
  better_solution_by_no_all_clear,
  better_solution_by_no_chance_pop,
  better_solution_by_no_heart_pop,
  better_solution_by_no_ojama_pop,
  better_solution_by_no_prism_pop,
  better_solution_by_ojama_pop,
  better_solution_by_prism_pop,
  better_solution_by_smaller_trace_num,
  better_solution_by_smaller_value,
  mergeResultIfRankedIn,
  solveAllTraces,
  solveIncludingTraceIndex,
  solveWithPrefix
} from './solution-explorer';

describe('solution-explorer', () => {
  describe('various better_solution methods', () => {
    const S: SolutionResult = {
      trace_coords: [],
      chains: [],
      value: 0.0,
      popped_chance_num: 0,
      popped_heart_num: 0,
      popped_prism_num: 0,
      popped_ojama_num: 0,
      popped_kata_num: 0,
      is_all_cleared: false
    };

    describe('better_solution_by_bigger_value()', () => {
      it.each([
        { s1: { ...S, value: 2.0 }, s2: { ...S, value: 1.0 }, expected: 's1' },
        { s1: { ...S, value: 1.0 }, s2: { ...S, value: 2.0 }, expected: 's2' },
        { s1: { ...S, value: 1.0 }, s2: { ...S, value: 1.0 }, expected: '' }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_bigger_value(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_chance_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_chance_num: 1 },
          s2: { ...S, popped_chance_num: 0 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_chance_num: 0 },
          s2: { ...S, popped_chance_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_chance_num: 1 },
          s2: { ...S, popped_chance_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_chance_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_prism_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_prism_num: 1 },
          s2: { ...S, popped_prism_num: 0 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_prism_num: 0 },
          s2: { ...S, popped_prism_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_prism_num: 1 },
          s2: { ...S, popped_prism_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_prism_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_all_clear()', () => {
      it.each([
        {
          s1: { ...S, is_all_cleared: true },
          s2: { ...S, is_all_cleared: false },
          expected: 's1'
        },
        {
          s1: { ...S, is_all_cleared: false },
          s2: { ...S, is_all_cleared: true },
          expected: 's2'
        },
        {
          s1: { ...S, is_all_cleared: true },
          s2: { ...S, is_all_cleared: true },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_all_clear(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_smaller_trace_num()', () => {
      it.each([
        {
          s1: { ...S, trace_coords: [PuyoCoord.indexToCoord(0)!] },
          s2: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(0)!,
              PuyoCoord.indexToCoord(1)!
            ]
          },
          expected: 's1'
        },
        {
          s1: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(0)!,
              PuyoCoord.indexToCoord(1)!
            ]
          },
          s2: { ...S, trace_coords: [PuyoCoord.indexToCoord(0)!] },
          expected: 's2'
        },
        {
          s1: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(0)!,
              PuyoCoord.indexToCoord(1)!
            ]
          },
          s2: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(1)!,
              PuyoCoord.indexToCoord(2)!
            ]
          },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_smaller_trace_num(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_heart_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_heart_num: 1 },
          s2: { ...S, popped_heart_num: 0 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_heart_num: 0 },
          s2: { ...S, popped_heart_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_heart_num: 1 },
          s2: { ...S, popped_heart_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_heart_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_ojama_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 0, popped_kata_num: 0 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_ojama_num: 0, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 0, popped_kata_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 0, popped_kata_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_ojama_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_smaller_value()', () => {
      it.each([
        { s1: { ...S, value: 1.0 }, s2: { ...S, value: 2.0 }, expected: 's1' },
        { s1: { ...S, value: 2.0 }, s2: { ...S, value: 1.0 }, expected: 's2' },
        { s1: { ...S, value: 1.0 }, s2: { ...S, value: 1.0 }, expected: '' }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_smaller_value(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_no_chance_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_chance_num: 0 },
          s2: { ...S, popped_chance_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_chance_num: 1 },
          s2: { ...S, popped_chance_num: 0 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_chance_num: 1 },
          s2: { ...S, popped_chance_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_no_chance_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_no_prism_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_prism_num: 0 },
          s2: { ...S, popped_prism_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_prism_num: 1 },
          s2: { ...S, popped_prism_num: 0 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_prism_num: 1 },
          s2: { ...S, popped_prism_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_no_prism_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_no_all_clear()', () => {
      it.each([
        {
          s1: { ...S, is_all_cleared: false },
          s2: { ...S, is_all_cleared: true },
          expected: 's1'
        },
        {
          s1: { ...S, is_all_cleared: true },
          s2: { ...S, is_all_cleared: false },
          expected: 's2'
        },
        {
          s1: { ...S, is_all_cleared: true },
          s2: { ...S, is_all_cleared: true },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_no_all_clear(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_no_heart_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_heart_num: 0 },
          s2: { ...S, popped_heart_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_heart_num: 1 },
          s2: { ...S, popped_heart_num: 0 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_heart_num: 1 },
          s2: { ...S, popped_heart_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_no_heart_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_bigger_trace_num()', () => {
      it.each([
        {
          s1: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(0)!,
              PuyoCoord.indexToCoord(1)!
            ]
          },
          s2: { ...S, trace_coords: [PuyoCoord.indexToCoord(0)!] },
          expected: 's1'
        },
        {
          s1: { ...S, trace_coords: [PuyoCoord.indexToCoord(0)!] },
          s2: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(0)!,
              PuyoCoord.indexToCoord(1)!
            ]
          },
          expected: 's2'
        },
        {
          s1: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(0)!,
              PuyoCoord.indexToCoord(1)!
            ]
          },
          s2: {
            ...S,
            trace_coords: [
              PuyoCoord.indexToCoord(1)!,
              PuyoCoord.indexToCoord(2)!
            ]
          },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_bigger_trace_num(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_no_ojama_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_ojama_num: 0, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_ojama_num: 0, popped_kata_num: 1 },
          s2: { ...S, popped_ojama_num: 0, popped_kata_num: 0 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 0, popped_kata_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_no_ojama_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_more_chance_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_chance_num: 2 },
          s2: { ...S, popped_chance_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_chance_num: 1 },
          s2: { ...S, popped_chance_num: 2 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_chance_num: 2 },
          s2: { ...S, popped_chance_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_more_chance_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_more_prism_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_prism_num: 2 },
          s2: { ...S, popped_prism_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_prism_num: 1 },
          s2: { ...S, popped_prism_num: 2 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_prism_num: 2 },
          s2: { ...S, popped_prism_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_more_prism_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_more_heart_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_heart_num: 2 },
          s2: { ...S, popped_heart_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_heart_num: 1 },
          s2: { ...S, popped_heart_num: 2 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_heart_num: 2 },
          s2: { ...S, popped_heart_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_more_heart_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_more_ojama_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_ojama_num: 2 },
          s2: { ...S, popped_ojama_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 1 },
          s2: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_ojama_num: 1 },
          s2: { ...S, popped_ojama_num: 2 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 1, popped_kata_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_ojama_num: 2 },
          s2: { ...S, popped_ojama_num: 2 },
          expected: ''
        },
        {
          s1: { ...S, popped_kata_num: 2 },
          s2: { ...S, popped_kata_num: 2 },
          expected: ''
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 2 },
          s2: { ...S, popped_ojama_num: 2, popped_kata_num: 1 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_more_ojama_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_less_chance_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_chance_num: 1 },
          s2: { ...S, popped_chance_num: 2 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_chance_num: 2 },
          s2: { ...S, popped_chance_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_chance_num: 2 },
          s2: { ...S, popped_chance_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_less_chance_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_less_prism_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_prism_num: 1 },
          s2: { ...S, popped_prism_num: 2 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_prism_num: 2 },
          s2: { ...S, popped_prism_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_prism_num: 2 },
          s2: { ...S, popped_prism_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_less_prism_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_less_heart_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_heart_num: 1 },
          s2: { ...S, popped_heart_num: 2 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_heart_num: 2 },
          s2: { ...S, popped_heart_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_heart_num: 2 },
          s2: { ...S, popped_heart_num: 2 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_less_heart_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });

    describe('better_solution_by_less_ojama_pop()', () => {
      it.each([
        {
          s1: { ...S, popped_ojama_num: 1 },
          s2: { ...S, popped_ojama_num: 2 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          s2: { ...S, popped_ojama_num: 1, popped_kata_num: 1 },
          expected: 's1'
        },
        {
          s1: { ...S, popped_ojama_num: 2 },
          s2: { ...S, popped_ojama_num: 1 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 1 },
          s2: { ...S, popped_ojama_num: 1, popped_kata_num: 0 },
          expected: 's2'
        },
        {
          s1: { ...S, popped_ojama_num: 2 },
          s2: { ...S, popped_ojama_num: 2 },
          expected: ''
        },
        {
          s1: { ...S, popped_kata_num: 2 },
          s2: { ...S, popped_kata_num: 2 },
          expected: ''
        },
        {
          s1: { ...S, popped_ojama_num: 1, popped_kata_num: 2 },
          s2: { ...S, popped_ojama_num: 2, popped_kata_num: 1 },
          expected: ''
        }
      ])(
        'should return the better one or undefined',
        ({ s1, s2, expected }) => {
          const actual = better_solution_by_less_ojama_pop(s1, s2);
          expect(actual).toBe({ s1, s2 }[expected]);
        }
      );
    });
  });

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
            popped_chance_num: 1,
            popped_prism_num: 1,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true,
            is_prism_popped: true
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 200,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
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
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
          },
          s2: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            popped_chance_num: 1,
            popped_prism_num: 1,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true
          },
          result: 's1'
        } as Input,
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 1,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            popped_chance_num: 1,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
          },
          result: 's2'
        } as Input,
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 1,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false,
            is_prism_popped: true
          },
          result: 's2'
        } as Input,
        {
          s1: {
            trace_coords: [PuyoCoord.cellAddrToCoord('B3')!],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true
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
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
          },
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')!
            ],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
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
            popped_chance_num: 1,
            popped_prism_num: 1,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true
          } as PartialSolutionResult,
          s2: {
            trace_coords: [PuyoCoord.cellAddrToCoord('D4')!],
            value: 100,
            popped_chance_num: 2,
            popped_prism_num: 2,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: true
          } as PartialSolutionResult
        },
        {
          s1: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('B3')!,
              PuyoCoord.cellAddrToCoord('C4')
            ],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
          } as PartialSolutionResult,
          s2: {
            trace_coords: [
              PuyoCoord.cellAddrToCoord('D4')!,
              PuyoCoord.cellAddrToCoord('E5')
            ],
            value: 100,
            popped_chance_num: 0,
            popped_prism_num: 0,
            popped_heart_num: 0,
            popped_ojama_num: 0,
            popped_kata_num: 0,
            is_all_cleared: false
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

  describe('mergeResultIfRankedIn()', () => {
    it('does nothing when optimal_solution_count is 0', () => {
      // Arrange
      const explorationTarget: ExplorationTarget = {
        category: ExplorationCategory.Damage,
        main_attr: PuyoAttr.Red,
        preference_priorities: [PreferenceKind.BiggerValue],
        optimal_solution_count: 0
      };
      const optimalSolutions: SolutionResult[] = [];
      const solutionResult: SolutionResult = {
        trace_coords: [PuyoCoord.indexToCoord(0)!],
        chains: [],
        value: 100,
        popped_chance_num: 0,
        popped_prism_num: 0,
        popped_heart_num: 0,
        popped_ojama_num: 0,
        popped_kata_num: 0,
        is_all_cleared: false
      };

      // Act
      mergeResultIfRankedIn(
        explorationTarget,
        solutionResult,
        optimalSolutions
      );

      // Assert
      expect(optimalSolutions).toEqual([]);
    });

    it('issues/52', () => {
      // Arrange
      const explorationTarget: ExplorationTarget = {
        category: ExplorationCategory.SkillPuyoCount,
        main_attr: PuyoAttr.Blue,
        preference_priorities: [
          PreferenceKind.AllClear,
          PreferenceKind.PrismPop,
          PreferenceKind.BiggerValue,
          PreferenceKind.ChancePop,
          PreferenceKind.SmallerTraceNum
        ],
        optimal_solution_count: 5
      };
      const optimalSolutions: SolutionResult[] = [];
      const wasm_1: SolutionResult = {
        trace_coords: ['E1', 'D2', 'F2', 'E3', 'F4'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const wasm_2: SolutionResult = {
        trace_coords: ['A2', 'A3', 'B3', 'C2', 'D2'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const wasm_3: SolutionResult = {
        trace_coords: ['E1', 'D2', 'F2', 'C3', 'E3', 'F4'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const wasm_4: SolutionResult = {
        trace_coords: ['E1', 'D2', 'F2', 'D3', 'E3', 'F4'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const wasm_5: SolutionResult = {
        trace_coords: ['E1', 'D2', 'F2', 'E3', 'G1', 'F4'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const js_2: SolutionResult = {
        trace_coords: ['A2', 'A3', 'B3', 'C2', 'C3', 'D2'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const js_3: SolutionResult = {
        trace_coords: ['A2', 'A3', 'B3', 'C2', 'D2', 'D3'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 19,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const js_4: SolutionResult = {
        trace_coords: ['A2', 'A3', 'B3', 'C3', 'D2'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 18,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const js_5: SolutionResult = {
        trace_coords: ['A2', 'A3', 'B3', 'C3', 'D2', 'D3'].map(
          (addr) => PuyoCoord.cellAddrToCoord(addr)!
        ),
        value: 18,
        popped_chance_num: 0,
        popped_prism_num: 1,
        popped_heart_num: 0,
        popped_kata_num: 0,
        popped_ojama_num: 0,
        is_all_cleared: true,
        chains: []
      };
      const candidates = {
        wasm_1,
        wasm_2,
        wasm_3,
        wasm_4,
        wasm_5,
        js_2,
        js_3,
        js_4,
        js_5
      };

      // Act
      mergeResultIfRankedIn(explorationTarget, js_2, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, js_3, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, js_4, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, js_5, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, wasm_1, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, wasm_2, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, wasm_3, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, wasm_4, optimalSolutions);
      mergeResultIfRankedIn(explorationTarget, wasm_5, optimalSolutions);

      // Assert
      expect(
        optimalSolutions.map(
          (s) => Object.entries(candidates).find(([_, _s]) => s === _s)![0]
        )
      ).toEqual(['wasm_1', 'wasm_2', 'js_2', 'js_3', 'wasm_3']);
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
                  strength: 9.799999999999999,
                  popped_count: 5,
                  separated_blocks_num: 1
                },
                [PuyoAttr.Purple]: {
                  strength: 9.799999999999999,
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
                  strength: 10.625,
                  popped_count: 7,
                  separated_blocks_num: 1
                },
                [PuyoAttr.Yellow]: {
                  strength: 10.625,
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
              popped_chance_num: 0,
              is_all_cleared: true
            }
          ],
          value: 66.35,
          popped_chance_num: 0,
          popped_heart_num: 0,
          popped_prism_num: 0,
          popped_ojama_num: 0,
          popped_kata_num: 0,
          is_all_cleared: true
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
                [PuyoAttr.Red]: {
                  strength: 1.4,
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
                [PuyoAttr.Blue]: {
                  strength: 1.7,
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
                [PuyoAttr.Yellow]: {
                  strength: 2.0,
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
                [PuyoAttr.Red]: {
                  strength: 2.2,
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
                [PuyoAttr.Green]: {
                  strength: 2.4,
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
                [PuyoAttr.Yellow]: {
                  strength: 2.6,
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
                [PuyoAttr.Purple]: {
                  strength: 2.8,
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
                  strength: 3.0,
                  popped_count: 4,
                  separated_blocks_num: 1
                }
              },
              popped_chance_num: 0,
              is_all_cleared: false
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
              popped_chance_num: 0,
              is_all_cleared: true
            }
          ],
          value: 22.3,
          popped_chance_num: 0,
          popped_heart_num: 0,
          popped_prism_num: 0,
          popped_ojama_num: 0,
          popped_kata_num: 0,
          is_all_cleared: true
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

    describe('solveWithPrefix()', () => {
      // 盤面 (index):
      //  0  1  2  3  4  5  6  7
      //  8  9 10 11 12 13 14 15
      // 16 17 18 19 20 21 22 23
      // 24 25 26 27 28 29 30 31
      // 32 33 34 35 36 37 38 39
      // 40 41 42 43 44 45 46 47
      // R R E E E E E E
      // R R E E E E E E
      // E E E E E E E E
      // E E E E E E E E
      // E E E E E E E E
      // R E E E E E E E
      const buildSimulator = (maxTraceNum: number) => {
        const simulationData = createSimulationData({
          nextPuyos: [E, E, E, E, E, E, E, E],
          field: [
            [R, R, E, E, E, E, E, E],
            [R, R, E, E, E, E, E, E],
            [E, E, E, E, E, E, E, E],
            [E, E, E, E, E, E, E, E],
            [E, E, E, E, E, E, E, E],
            [R, E, E, E, E, E, E, E]
          ],
          minimumPuyoNumForPopping: 4,
          maxTraceNum,
          traceMode: TraceMode.Normal,
          poppingLeverage: 1.0,
          chainLeverage: 1.0
        });
        return new Simulator(simulationData);
      };

      const damageTarget: ExplorationTarget = {
        category: ExplorationCategory.Damage,
        preference_priorities: [PreferenceKind.BiggerValue],
        optimal_solution_count: 5,
        main_attr: PuyoAttr.Red
      };

      it('returns an empty result when the prefix is empty', () => {
        // Arrange
        const simulator = buildSimulator(5);

        // Act
        const actual = solveWithPrefix(simulator, damageTarget, [], false);

        // Assert
        expect(actual).toEqual({ candidates_num: 0, optimal_solutions: [] });
      });

      it('returns an empty result when the prefix is longer than the actual max trace num', () => {
        // Arrange
        const simulator = buildSimulator(1);

        // Act
        const actual = solveWithPrefix(simulator, damageTarget, [0, 1], false);

        // Assert
        expect(actual).toEqual({ candidates_num: 0, optimal_solutions: [] });
      });

      it('returns an empty result when the first coord of the prefix is not traceable', () => {
        // Arrange
        const simulator = buildSimulator(5);

        // Act (index 2 is an empty cell)
        const actual = solveWithPrefix(simulator, damageTarget, [2], false);

        // Assert
        expect(actual).toEqual({ candidates_num: 0, optimal_solutions: [] });
      });

      it('returns an empty result when a later coord of the prefix is not traceable', () => {
        // Arrange
        const simulator = buildSimulator(5);

        // Act (index 0 is traceable but index 2 is an empty cell)
        const actual = solveWithPrefix(simulator, damageTarget, [0, 2], false);

        // Assert
        expect(actual).toEqual({ candidates_num: 0, optimal_solutions: [] });
      });

      it('returns an empty result when a later coord of the prefix is traceable but not addable', () => {
        // Arrange
        const simulator = buildSimulator(5);

        // Act (index 40 is traceable but is not adjacent to index 0's trace)
        const actual = solveWithPrefix(simulator, damageTarget, [0, 40], false);

        // Assert
        expect(actual).toEqual({ candidates_num: 0, optimal_solutions: [] });
      });

      // 既存の solveAllTraces()/solveIncludingTraceIndex() のテストと同じ盤面。
      // trace_coords = [(5,2), (6,2)] (index 21, 22) が最適解であることが
      // 既に確認されているので、その prefix を使って recurse=false / true の
      // 挙動を検証する。
      const buildGreenSimulator = () => {
        const board = getSpecialBoard('specialRule1/1');
        const nextPuyos = createNextPuyosAsSameType(PuyoType.Green);
        const simulationData = createSimulationData(board, {
          maxTraceNum: 5,
          poppingLeverage: 1.0,
          nextPuyos
        });
        return new Simulator(simulationData);
      };
      const greenPrefix = [
        PuyoCoord.xyToCoord(5, 2)!.index,
        PuyoCoord.xyToCoord(6, 2)!.index
      ];

      it('evaluates exactly the prefix trace and does not expand further when recurse is false', () => {
        // Arrange
        const simulator = buildGreenSimulator();
        const target: ExplorationTarget = {
          category: ExplorationCategory.Damage,
          preference_priorities: [
            PreferenceKind.BiggerValue,
            PreferenceKind.ChancePop,
            PreferenceKind.PrismPop,
            PreferenceKind.AllClear,
            PreferenceKind.SmallerTraceNum
          ],
          optimal_solution_count: 1,
          main_attr: PuyoAttr.Green
        };

        // Act
        const actual = solveWithPrefix(simulator, target, greenPrefix, false);

        // Assert: 既知の最適解と一致する (candidates_num は prefix 自身の1件のみ)
        expect(actual.candidates_num).toBe(1);
        expect(actual.optimal_solutions).toHaveLength(1);
        expect(actual.optimal_solutions[0].trace_coords).toEqual([
          PuyoCoord.xyToCoord(5, 2),
          PuyoCoord.xyToCoord(6, 2)
        ]);
        expect(actual.optimal_solutions[0].value).toBeCloseTo(109.0);
      });

      it('computes the SkillPuyoCount value from the actual pop counts of the prefix trace', () => {
        // Arrange
        const simulator = buildGreenSimulator();
        const target: ExplorationTarget = {
          category: ExplorationCategory.SkillPuyoCount,
          preference_priorities: [PreferenceKind.BiggerValue],
          optimal_solution_count: 1,
          main_attr: PuyoAttr.Green
        };

        // Act
        const actual = solveWithPrefix(simulator, target, greenPrefix, false);

        // Assert
        const solution = actual.optimal_solutions[0];
        expect(solution.value).toBe(16);
        expect(
          Simulator.calcTotalCountOfTargetAttr(solution.chains!, PuyoAttr.Green)
        ).toBe(solution.value);
      });

      it('applies a non-repeating step counting bonus on top of the raw count', () => {
        // Arrange
        const simulator = buildGreenSimulator();
        const target: ExplorationTarget = {
          category: ExplorationCategory.SkillPuyoCount,
          preference_priorities: [PreferenceKind.BiggerValue],
          optimal_solution_count: 1,
          main_attr: PuyoAttr.Green,
          counting_bonus: {
            bonus_type: CountingBonusType.Step,
            target_attrs: [PuyoAttr.Green],
            step_height: 5,
            bonus_count: 10,
            repeat: false
          }
        };

        // Act
        const actual = solveWithPrefix(simulator, target, greenPrefix, false);

        // Assert: 16 個の緑ぷよで floor(16/5) = 3 段登れるが、repeat: false
        // なので1段分のボーナスのみ加算される
        expect(actual.optimal_solutions[0].value).toBe(16 + 10);
      });

      it('applies a repeating step counting bonus for every step reached', () => {
        // Arrange
        const simulator = buildGreenSimulator();
        const target: ExplorationTarget = {
          category: ExplorationCategory.SkillPuyoCount,
          preference_priorities: [PreferenceKind.BiggerValue],
          optimal_solution_count: 1,
          main_attr: PuyoAttr.Green,
          counting_bonus: {
            bonus_type: CountingBonusType.Step,
            target_attrs: [PuyoAttr.Green],
            step_height: 5,
            bonus_count: 10,
            repeat: true
          }
        };

        // Act
        const actual = solveWithPrefix(simulator, target, greenPrefix, false);

        // Assert: floor(16/5) = 3 段、repeat: true なので3段分のボーナスが加算される
        expect(actual.optimal_solutions[0].value).toBe(16 + 10 * 3);
      });

      it('computes the value for PuyotsukaiCount category', () => {
        // Arrange
        const simulator = buildGreenSimulator();
        const target: ExplorationTarget = {
          category: ExplorationCategory.PuyotsukaiCount,
          preference_priorities: [PreferenceKind.BiggerValue],
          optimal_solution_count: 1
        };

        // Act
        const actual = solveWithPrefix(simulator, target, greenPrefix, false);

        // Assert
        const solution = actual.optimal_solutions[0];
        expect(solution.value).toBe(52);
        expect(Simulator.calcTotalPuyoTsukaiCount(solution.chains!)).toBe(
          solution.value
        );
      });

      it('expands every trace descending from the prefix when recurse is true, matching solveIncludingTraceIndex', () => {
        // Arrange
        const simulator = buildGreenSimulator();
        const target: ExplorationTarget = {
          category: ExplorationCategory.Damage,
          preference_priorities: [
            PreferenceKind.BiggerValue,
            PreferenceKind.ChancePop,
            PreferenceKind.PrismPop,
            PreferenceKind.AllClear,
            PreferenceKind.SmallerTraceNum
          ],
          optimal_solution_count: 1,
          main_attr: PuyoAttr.Green
        };

        // Act: prefix=[21] からの全展開は、index=21を起点にした全探索と等価
        const viaPrefix = solveWithPrefix(simulator, target, [21], true);
        const viaIndex = solveIncludingTraceIndex(simulator, target, 21);

        // Assert: 既に検証済みの solveIncludingTraceIndex() の結果と完全に一致する
        expect(viaPrefix.candidates_num).toBe(539);
        expect(viaPrefix).toEqual(viaIndex);
      });
    });
  });
});
