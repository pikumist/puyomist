import { describe, expect, it } from 'vitest';

import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import {
  PaintPrecision,
  createMockPaintSearchResult,
  defaultPaintSearchSettings,
  enumeratePaintableCoords,
  isPaintableType,
  paintPrecisionDescriptionMap,
  rustBackendPaintPrecisionList,
  wasmPaintPrecisionList
} from './paint-search';

/** 指定した型を敷き詰めた盤面を作る。座標を指定した分だけ型を差し替える。 */
const createSimulationDataOf = (
  baseType: PuyoType,
  overrides: ReadonlyArray<readonly [x: number, y: number, type: PuyoType]> = []
): SimulationData => {
  let id = 1;
  const field = [...new Array(PuyoCoord.YNum)].map(() =>
    [...new Array(PuyoCoord.XNum)].map(() => ({ id: id++, type: baseType }))
  );

  for (const [x, y, type] of overrides) {
    field[y][x] = { id: id++, type };
  }

  return {
    nextPuyos: [...new Array(PuyoCoord.XNum)].map(() => ({
      id: id++,
      type: PuyoType.Blue
    })),
    field,
    boostAreaCoordList: [],
    isChanceMode: false,
    traceCoords: [],
    minimumPuyoNumForPopping: Simulator.defaultMinimumPuyoNumForPopping,
    maxTraceNum: Simulator.defaultMaxTraceNum,
    traceMode: TraceMode.Normal,
    poppingLeverage: 1.0,
    chainLeverage: 1.0
  };
};

describe('isPaintableType', () => {
  it('returns false for an empty cell', () => {
    expect(isPaintableType(undefined, PuyoAttr.Red)).toBe(false);
  });

  it.each([
    ['prism', PuyoType.Prism],
    ['question', PuyoType.Question]
  ])('returns false for %s', (_name, type) => {
    expect(isPaintableType(type, PuyoAttr.Red)).toBe(false);
  });

  it.each([
    ['plain', PuyoType.Red],
    ['plus', PuyoType.RedPlus],
    ['chance', PuyoType.RedChance]
  ])('returns false for a %s puyo already in the paint colour', (_n, type) => {
    expect(isPaintableType(type, PuyoAttr.Red)).toBe(false);
  });

  it.each([
    ['another colour', PuyoType.Blue],
    ['heart', PuyoType.Heart],
    ['ojama', PuyoType.Ojama],
    ['kata', PuyoType.Kata]
  ])('returns true for %s', (_name, type) => {
    expect(isPaintableType(type, PuyoAttr.Red)).toBe(true);
  });
});

describe('enumeratePaintableCoords', () => {
  it('lists every cell that can be repainted', () => {
    const simulationData = createSimulationDataOf(PuyoType.Blue, [
      [0, 0, PuyoType.Red],
      [1, 0, PuyoType.Prism]
    ]);

    const coords = enumeratePaintableCoords(simulationData, PuyoAttr.Red);

    // 赤とプリズムの2マスだけが候補から外れる
    expect(coords).toHaveLength(PuyoCoord.XNum * PuyoCoord.YNum - 2);
    expect(coords).not.toContain(PuyoCoord.xyToCoord(0, 0));
    expect(coords).not.toContain(PuyoCoord.xyToCoord(1, 0));
    expect(coords).toContain(PuyoCoord.xyToCoord(2, 0));
  });

  it('returns an empty list when the whole board is already the paint colour', () => {
    const simulationData = createSimulationDataOf(PuyoType.Red);
    expect(enumeratePaintableCoords(simulationData, PuyoAttr.Red)).toEqual([]);
  });
});

describe('createMockPaintSearchResult', () => {
  const simulationData = createSimulationDataOf(PuyoType.Blue, [
    [0, 0, PuyoType.Red],
    [3, 2, PuyoType.Heart],
    [7, 5, PuyoType.Ojama]
  ]);

  it('is deterministic for the same board and settings', () => {
    const a = createMockPaintSearchResult(
      simulationData,
      defaultPaintSearchSettings
    );
    const b = createMockPaintSearchResult(
      simulationData,
      defaultPaintSearchSettings
    );
    expect(a.plans.map((p) => p.coords)).toEqual(b.plans.map((p) => p.coords));
  });

  it('never paints more cells than the limit', () => {
    const result = createMockPaintSearchResult(simulationData, {
      ...defaultPaintSearchSettings,
      maxPaintNum: 5
    });
    for (const plan of result.plans) {
      expect(plan.coords.length).toBeLessThanOrEqual(5);
    }
  });

  it('only paints cells that can be repainted', () => {
    const candidates = new Set(
      enumeratePaintableCoords(simulationData, defaultPaintSearchSettings.color)
    );
    const result = createMockPaintSearchResult(
      simulationData,
      defaultPaintSearchSettings
    );
    for (const plan of result.plans) {
      for (const coord of plan.coords) {
        expect(candidates.has(coord)).toBe(true);
      }
    }
  });

  it('always offers the "no paint" plan, ordered last', () => {
    const result = createMockPaintSearchResult(
      simulationData,
      defaultPaintSearchSettings
    );
    expect(result.plans.at(-1)!.coords).toEqual([]);
  });

  it('omits the expected value unless it is asked for', () => {
    const without = createMockPaintSearchResult(simulationData, {
      ...defaultPaintSearchSettings,
      showExpectedValue: false
    });
    const with_ = createMockPaintSearchResult(simulationData, {
      ...defaultPaintSearchSettings,
      showExpectedValue: true
    });

    expect(without.plans.every((p) => p.expectedValue === undefined)).toBe(
      true
    );
    expect(with_.plans.every((p) => typeof p.expectedValue === 'number')).toBe(
      true
    );
  });

  it('falls back to the "no paint" plan when nothing can be painted', () => {
    const painted = createSimulationDataOf(PuyoType.Red);
    const result = createMockPaintSearchResult(
      painted,
      defaultPaintSearchSettings
    );
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].coords).toEqual([]);
  });
});

describe('paint precision', () => {
  it('hides the ultra precision from wasm but offers it on the rust backend', () => {
    expect(wasmPaintPrecisionList).not.toContain(PaintPrecision.Ultra);
    expect(rustBackendPaintPrecisionList).toContain(PaintPrecision.Ultra);
  });

  it('has a description for every precision', () => {
    for (const precision of rustBackendPaintPrecisionList) {
      expect(paintPrecisionDescriptionMap.get(precision)).toBeTruthy();
    }
  });
});
