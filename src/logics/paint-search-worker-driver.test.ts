import { releaseProxy } from 'comlink';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSimulationData } from '../store/internal/createSimulationData';
import { ExplorationCategory, PreferenceKind } from './ExplorationTarget';
import type { ExplorationTarget } from './ExplorationTarget';
import { PuyoCoord } from './PuyoCoord';
import { defaultPaintSearchSettings } from './paint-search';
import { searchPaintPlansByWasm } from './paint-search-worker-driver';
import type { WasmPaintEvaluation, WasmPaintSet } from './wasm-interface';

/**
 * ワーカーの代わり。wasm は呼ばず、深さ1段だけ展開して「渡された順のまま」評価を返す。
 * 評価値は塗り集合の中身から決まるので、分割の仕方が変わって順序が崩れれば結果も変わる。
 */
const createdWorkers = vi.hoisted(() => [] as FakeWorker[]);

interface FakeWorker {
  terminated: boolean;
  released: boolean;
  /** 受け取った評価チャンクの記録 */
  chunks: WasmPaintSet[][];
}

const scoreOf = (cells: WasmPaintSet): number =>
  cells.reduce((sum, index) => sum + index, 0);

vi.mock('./solution-wasm-worker-shim', () => ({
  createWorker: () => {
    if (createWorkerHook) {
      createWorkerHook(createdWorkers.length);
    }
    const worker: FakeWorker = {
      terminated: false,
      released: false,
      chunks: []
    };
    createdWorkers.push(worker);

    const proxy = {
      expandPaintBeam: async (
        _simulationData: unknown,
        _params: unknown,
        beam: WasmPaintSet[]
      ): Promise<WasmPaintSet[]> => {
        // 深さ1段だけ展開する。2段目以降は打ち切り (空を返す)。
        if (beam.length === 1 && beam[0].length === 0) {
          return [[0], [1], [2], [3]];
        }
        return [];
      },
      evaluatePaintSets: async (
        _simulationData: unknown,
        _explorationTarget: unknown,
        _params: unknown,
        paintSets: WasmPaintSet[],
        _maxTraceNum: number,
        withSolution: boolean
      ): Promise<WasmPaintEvaluation[]> => {
        worker.chunks.push(paintSets);
        await evaluateDelay?.();
        return paintSets.map((cells) => ({
          value: scoreOf(cells),
          expected_value: undefined,
          solution: withSolution
            ? {
                trace_coords: [{ x: 0, y: 0 }],
                chains: [],
                value: scoreOf(cells),
                popped_chance_num: 0,
                popped_heart_num: 0,
                popped_prism_num: 0,
                popped_ojama_num: 0,
                popped_kata_num: 0,
                is_all_cleared: false
              }
            : undefined
        }));
      },
      selectTopPaintSets: async (
        scores: number[],
        count: number
      ): Promise<number[]> =>
        scores
          .map((score, i) => [score, i] as const)
          .sort((a, b) => b[0] - a[0])
          .slice(0, count)
          .map(([, i]) => i),
      buildPaintPlans: async (
        _explorationTarget: unknown,
        paintSets: WasmPaintSet[],
        evaluations: WasmPaintEvaluation[]
      ) =>
        paintSets.map((cells, i) => ({
          coords: cells.map((index) => {
            const coord = PuyoCoord.indexToCoord(index)!;
            return { x: coord.x, y: coord.y };
          }),
          value: evaluations[i].value,
          expected_value: undefined,
          solution: evaluations[i].solution!
        })),
      [releaseProxy]: () => {
        worker.released = true;
      }
    };

    return {
      workerInstance: {
        terminate: () => {
          worker.terminated = true;
        }
      } as unknown as Worker,
      workerProxy: proxy as never
    };
  }
}));

/** ワーカー生成に割り込むフック (途中で失敗させるテスト用) */
let createWorkerHook: ((index: number) => void) | undefined;
/** 評価の途中で待たせたいときのフック (中断のテスト用) */
let evaluateDelay: (() => Promise<void>) | undefined;

const explorationTarget: ExplorationTarget = {
  category: ExplorationCategory.PuyotsukaiCount,
  preference_priorities: [PreferenceKind.BiggerValue],
  optimal_solution_count: 1
};

const simulationData = createSimulationData({}, { maxTraceNum: 5 });

const search = (options = {}) =>
  searchPaintPlansByWasm(
    simulationData,
    explorationTarget,
    { ...defaultPaintSearchSettings, maxPaintNum: 1 },
    { concurrency: 3, ...options }
  );

describe('searchPaintPlansByWasm', () => {
  beforeEach(() => {
    createdWorkers.length = 0;
    createWorkerHook = undefined;
    evaluateDelay = undefined;
  });

  it('splits the evaluation across the pool and keeps the original order', async () => {
    const result = await search();

    // 4件を3ワーカーへ: 2 + 2 (3つ目は空きなので使われない)
    const chunks = createdWorkers.flatMap((w) => w.chunks);
    expect(chunks.some((chunk) => chunk.length > 1)).toBe(true);

    // 評価値は塗りマスの添字そのもの。良い順に並ぶ ([3] が最良)
    expect(result.plans.map((p) => p.value)).toEqual([3, 2, 1, 0, 0]);
    expect(result.plans[0].coords).toEqual([PuyoCoord.indexToCoord(3)]);
  });

  it('gives the same plans whatever the worker count is', async () => {
    const one = await search({ concurrency: 1 });
    createdWorkers.length = 0;
    const many = await search({ concurrency: 7 });

    expect(many.plans.map((p) => p.value)).toEqual(
      one.plans.map((p) => p.value)
    );
    expect(many.plans.map((p) => p.coords)).toEqual(
      one.plans.map((p) => p.coords)
    );
  });

  it('terminates every worker once it is done', async () => {
    await search();

    expect(createdWorkers.length).toBeGreaterThan(0);
    expect(createdWorkers.every((w) => w.terminated)).toBe(true);
    expect(createdWorkers.every((w) => w.released)).toBe(true);
  });

  it('terminates the workers it did create when one fails to start', async () => {
    createWorkerHook = (index) => {
      if (index === 2) {
        throw new Error('worker limit reached');
      }
    };

    await expect(search()).rejects.toThrow('worker limit reached');
    expect(createdWorkers).toHaveLength(2);
    expect(createdWorkers.every((w) => w.terminated)).toBe(true);
  });

  it('gives up promptly when aborted mid-evaluation, and terminates the pool', async () => {
    const controller = new AbortController();
    // 評価が終わらないあいだに中断する。中断が評価を待たされないことを見る。
    evaluateDelay = () => new Promise<void>(() => {});

    const promise = search({ signal: controller.signal });
    await vi.waitFor(() =>
      expect(createdWorkers.some((w) => w.chunks.length > 0)).toBe(true)
    );
    controller.abort();

    await expect(promise).rejects.toThrow('aborted');
    expect(createdWorkers.every((w) => w.terminated)).toBe(true);
  });

  it('reports no progress and no result after being aborted', async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    evaluateDelay = () => new Promise<void>(() => {});

    const promise = search({
      signal: controller.signal,
      onProgress: (percent: number) => seen.push(percent)
    });
    await vi.waitFor(() =>
      expect(createdWorkers.some((w) => w.chunks.length > 0)).toBe(true)
    );
    controller.abort();

    await expect(promise).rejects.toThrow('aborted');
    expect(seen).not.toContain(100);
  });

  it('rejects without starting anything when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(search({ signal: controller.signal })).rejects.toThrow(
      'aborted'
    );
  });

  it('reports progress up to 100 on a normal run', async () => {
    const seen: number[] = [];
    await search({ onProgress: (percent: number) => seen.push(percent) });

    expect(seen.at(-1)).toBe(100);
    expect(seen.every((p, i) => i === 0 || seen[i - 1] <= p)).toBe(true);
  });
});
