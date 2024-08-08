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
  better_solution_by_no_ojama_pop,
  better_solution_by_no_prism_pop,
  better_solution_by_ojama_pop,
  better_solution_by_prism_pop,
  better_solution_by_smaller_trace_num,
  better_solution_by_smaller_value,
  mergeResultIfRankedIn,
  solveAllTraces,
  solveIncludingTraceIndex
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
  });
});
