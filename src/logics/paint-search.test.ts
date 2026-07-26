import { describe, expect, it } from 'vitest';

import { PuyoAttr } from './PuyoAttr';
import { PuyoCoord } from './PuyoCoord';
import { PuyoType } from './PuyoType';
import type { SimulationData } from './SimulationData';
import { Simulator } from './Simulator';
import { TraceMode } from './TraceMode';
import { SolutionMethod } from './solution';
import { INITIAL_PUYO_APP_STATE } from '../store/types';
import {
  PaintPrecision,
  boardSignatureOf,
  clampPaintPrecision,
  defaultPaintSearchSettings,
  enumeratePaintableCoords,
  isPaintableType,
  paintPrecisionDescriptionMap,
  paintPrecisionListFor,
  paintSearchSignatureOf,
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

const target = INITIAL_PUYO_APP_STATE.explorationTarget;

describe('boardSignatureOf', () => {
  it('changes when a puyo changes', () => {
    const before = createSimulationDataOf(PuyoType.Blue);
    const after = createSimulationDataOf(PuyoType.Blue, [[2, 3, PuyoType.Red]]);
    expect(boardSignatureOf(before)).not.toBe(boardSignatureOf(after));
  });

  it('is stable for the same board', () => {
    expect(boardSignatureOf(createSimulationDataOf(PuyoType.Blue))).toBe(
      boardSignatureOf(createSimulationDataOf(PuyoType.Blue))
    );
  });
});

describe('paintSearchSignatureOf', () => {
  const simulationData = createSimulationDataOf(PuyoType.Blue);
  const signature = (
    data = simulationData,
    settings = defaultPaintSearchSettings,
    explorationTarget = target
  ) => paintSearchSignatureOf(data, explorationTarget, settings);

  it('changes when the paint colour changes', () => {
    expect(signature()).not.toBe(
      signature(simulationData, {
        ...defaultPaintSearchSettings,
        color: PuyoAttr.Green
      })
    );
  });

  it('changes when the popping rule changes', () => {
    expect(signature()).not.toBe(
      signature({ ...simulationData, minimumPuyoNumForPopping: 3 })
    );
  });

  it('changes when the exploration target changes', () => {
    expect(signature()).not.toBe(
      signature(simulationData, defaultPaintSearchSettings, {
        ...target,
        optimal_solution_count: target.optimal_solution_count + 1
      })
    );
  });

  it('changes when the boost area changes', () => {
    expect(signature()).not.toBe(
      signature({
        ...simulationData,
        boostAreaCoordList: [
          PuyoCoord.xyToCoord(1, 1)!,
          PuyoCoord.xyToCoord(0, 0)!
        ]
      })
    );
  });

  it('does not care about the order of the boost area cells', () => {
    const a = PuyoCoord.xyToCoord(0, 0)!;
    const b = PuyoCoord.xyToCoord(1, 1)!;
    expect(signature({ ...simulationData, boostAreaCoordList: [a, b] })).toBe(
      signature({ ...simulationData, boostAreaCoordList: [b, a] })
    );
  });

  it('ignores the trace in progress', () => {
    expect(signature()).toBe(
      signature({
        ...simulationData,
        traceCoords: [PuyoCoord.xyToCoord(0, 0)!]
      })
    );
  });
});

describe('clampPaintPrecision', () => {
  it('keeps a precision that the backend offers', () => {
    expect(
      clampPaintPrecision(PaintPrecision.High, wasmPaintPrecisionList)
    ).toBe(PaintPrecision.High);
  });

  it('falls back to the best available one', () => {
    expect(
      clampPaintPrecision(PaintPrecision.Ultra, wasmPaintPrecisionList)
    ).toBe(PaintPrecision.High);
  });
});

describe('paintPrecisionListFor', () => {
  it('offers the ultra precision only on the rust backend', () => {
    expect(paintPrecisionListFor(SolutionMethod.solveAllByRustBackend)).toBe(
      rustBackendPaintPrecisionList
    );
    expect(paintPrecisionListFor(SolutionMethod.solveAllInParallelByWasm)).toBe(
      wasmPaintPrecisionList
    );
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
