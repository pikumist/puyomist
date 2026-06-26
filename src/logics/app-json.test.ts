import { describe, expect, it } from 'vitest';
import { boostAreaKeyMap } from './BoostArea';
import {
  ExplorationCategory,
  type ExplorationTarget,
  PreferenceKind
} from './ExplorationTarget';
import {
  parseBoardJson,
  parsePuyomistJson,
  toBoardJson,
  toPuyomistJson
} from './app-json';
import { PuyoType } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { createSimulationData } from '../store/internal/createSimulationData';

const makeSimulationData = (): SimulationData => {
  const field: PuyoType[][] = [...new Array(6)].map(() =>
    [...new Array(8)].map(() => PuyoType.Red)
  );
  const nextPuyos: PuyoType[] = [...new Array(8)].map(() => PuyoType.Blue);
  return createSimulationData({ field, nextPuyos });
};

const explorationTarget: ExplorationTarget = {
  category: ExplorationCategory.PuyotsukaiCount,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 5
} as ExplorationTarget;

describe('app-json board round-trip', () => {
  it('toBoardJson then parseBoardJson yields a valid board', () => {
    const sim = makeSimulationData();
    const json = toBoardJson(sim);
    const board = parseBoardJson(json);
    expect(typeof board).not.toBe('string');
    if (typeof board !== 'string') {
      expect(board.nextPuyos).toHaveLength(8);
      expect(board.field).toHaveLength(6);
    }
  });

  it('parseBoardJson rejects wrong type / missing board', () => {
    expect(parseBoardJson(JSON.stringify({ type: 'nope' }))).toBe(
      'typeがboardでない'
    );
    expect(parseBoardJson(JSON.stringify({ type: 'board' }))).toBe(
      'boardがない'
    );
  });

  it('parseBoardJson surfaces validation errors', () => {
    const base = JSON.parse(toBoardJson(makeSimulationData()));
    const withBad = (mut: (b: any) => void, msg: string) => {
      const clone = structuredClone(base);
      mut(clone.board);
      expect(parseBoardJson(JSON.stringify(clone))).toBe(msg);
    };
    withBad((b) => {
      b.nextPuyos = [];
    }, 'nextPuyosが不正');
    withBad((b) => {
      b.field = [];
    }, 'fieldが不正');
    withBad((b) => {
      b.isChanceMode = 'x';
    }, 'isChanceModeが不正');
    withBad((b) => {
      b.minimumPuyoNumForPopping = 2;
    }, 'minimumPuyoNumForPoppingが不正');
    withBad((b) => {
      b.maxTraceNum = 0;
    }, 'maxTraceNumが不正');
    withBad((b) => {
      b.poppingLeverage = 0;
    }, 'poppingLeverageが不正');
    withBad((b) => {
      b.chainLeverage = 0;
    }, 'chainLeverageが不正');
    withBad((b) => {
      b.traceMode = 99;
    }, 'traceModeが不正');
  });
});

describe('app-json puyomist round-trip', () => {
  it('toPuyomistJson then parsePuyomistJson yields a valid object', () => {
    const sim = makeSimulationData();
    const boostKey = [...boostAreaKeyMap.keys()][0];
    const json = toPuyomistJson(sim, [boostKey], explorationTarget);
    const result = parsePuyomistJson(json);
    expect(typeof result).not.toBe('string');
    if (typeof result !== 'string') {
      expect(result.type).toBe('puyomist');
      expect(result.boostAreaKeyList).toEqual([boostKey]);
    }
  });

  it('parsePuyomistJson rejects wrong type / missing board', () => {
    expect(parsePuyomistJson(JSON.stringify({ type: 'nope' }))).toBe(
      'typeがpuyomistでない'
    );
    expect(parsePuyomistJson(JSON.stringify({ type: 'puyomist' }))).toBe(
      'boardがない'
    );
  });

  it('parsePuyomistJson surfaces boost/target errors', () => {
    const valid = JSON.parse(
      toPuyomistJson(makeSimulationData(), [], explorationTarget)
    );
    const withBad = (mut: (p: any) => void, msg: string) => {
      const clone = structuredClone(valid);
      mut(clone);
      expect(parsePuyomistJson(JSON.stringify(clone))).toBe(msg);
    };
    withBad((p) => {
      p.boostAreaKeyList = undefined;
    }, 'boostAreaKeyListが配列でない');
    withBad((p) => {
      p.boostAreaKeyList = ['bogus'];
    }, 'boostAreaKeyListのキーが不正');
    withBad((p) => {
      p.explorationTarget = undefined;
    }, 'explorationTargetが不正');
    withBad((p) => {
      p.explorationTarget.category = 999;
    }, 'explorationTargetのcategoryが不正');
    withBad((p) => {
      p.explorationTarget.preference_priorities = undefined;
    }, 'explorationTarget.preference_prioritiesが配列でない');
    withBad((p) => {
      p.explorationTarget.preference_priorities = [999];
    }, 'explorationTarget.preference_prioritiesに不正な値がある');
    withBad((p) => {
      p.explorationTarget.optimal_solution_count = 0;
    }, 'explorationTarget.optimal_solution_countが1以上でない');
  });
});
