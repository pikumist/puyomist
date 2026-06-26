import { releaseProxy } from 'comlink';
import type { ExplorationTarget } from '../../logics/ExplorationTarget';
import { PuyoCoord } from '../../logics/PuyoCoord';
import type { SimulationData } from '../../logics/SimulationData';
import type {
  ExplorationResult,
  SolutionResult,
  SolveResult
} from '../../logics/solution';
import { mergeResultIfRankedIn } from '../../logics/solution-explorer';
import { createWorker as createWasmWorker } from '../../logics/solution-wasm-worker-shim';
import { createWorker as createJsWorker } from '../../logics/solution-worker-shim';
import { traceCandidatesNumMap } from '../../logics/trace-candidates';

const createSolveAllAbortPromises = (
  factory: typeof createJsWorker | typeof createWasmWorker,
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  signal: AbortSignal
) => {
  const { workerInstance, workerProxy } = factory();

  const exitWorker = () => {
    workerProxy[releaseProxy]();
    workerInstance.terminate();
  };

  const solvePromise = new Promise<ExplorationResult>((resolve, reject) => {
    workerProxy
      .solveAllTraces(simulationData, explorationTarget)
      .then((explorationResult) => {
        fixTraceCoordsInResult(explorationResult);
        exitWorker();
        resolve(explorationResult);
      })
      .catch((ex) => {
        exitWorker();
        reject(ex);
      });
  });

  const abortPromise = new Promise((_, reject) => {
    const onAborted = () => {
      signal.removeEventListener('abort', onAborted);
      exitWorker();
      reject(new Error('aborted'));
    };
    signal.addEventListener('abort', onAborted);
  });

  return [solvePromise, abortPromise];
};

export const createSolveAllInSerial = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) => _createSolveAllInSerial(createJsWorker, simulationData, explorationTarget);

export const createSolveAllInSerialByWasm = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInSerial(createWasmWorker, simulationData, explorationTarget);

const _createSolveAllInSerial =
  (
    factory: typeof createJsWorker | typeof createWasmWorker,
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget
  ) =>
  async (
    signal: AbortSignal,
    _onProgress?: (result: SolveResult, percent: number) => void
  ): Promise<SolveResult> => {
    const startTime = Date.now();

    const explorationResult = (await Promise.race(
      createSolveAllAbortPromises(
        factory,
        simulationData,
        explorationTarget,
        signal
      )
    )) as ExplorationResult;

    return {
      explorationTarget,
      elapsedTime: Date.now() - startTime,
      ...explorationResult
    };
  };

export const createSolveAllInParallel = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInParallel(createJsWorker, simulationData, explorationTarget);

export const createSolveAllInParallelByWasm = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInParallel(
    createWasmWorker,
    simulationData,
    explorationTarget
  );

const _createSolveAllInParallel =
  (
    factory: typeof createJsWorker | typeof createWasmWorker,
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget
  ) =>
  async (
    signal: AbortSignal,
    onProgress?: (result: SolveResult, percent: number) => void
  ): Promise<SolveResult> => {
    const startTime = Date.now();
    const concurrency = Math.max(1, window.navigator.hardwareConcurrency || 1);

    const maxTraceNum = simulationData.isChanceMode
      ? 5
      : simulationData.maxTraceNum;
    const ideal_candidates_num_by_indexes =
      traceCandidatesNumMap.get(maxTraceNum);
    const ideal_total_num = ideal_candidates_num_by_indexes?.reduce(
      (m, n) => m + n
    );

    // 4-B: 開始インデックスを「候補数(=処理時間の目安)が大きい順」に並べる (LPT)。
    // 重いタスクを先に流し、軽いタスクで終盤の隙間を埋めることで遊休の尻尾を防ぐ。
    const indexOrder = [...new Array(48)].map((_, i) => i);
    if (ideal_candidates_num_by_indexes) {
      indexOrder.sort(
        (a, b) =>
          ideal_candidates_num_by_indexes[b] - ideal_candidates_num_by_indexes[a]
      );
    }

    const optimal_solutions: SolutionResult[] = [];
    let candidates_num = 0;
    let intermediate_ideal_candidates = 0;

    // 4-A: 永続ワーカープール。コア数ぶんのワーカーを一度だけ生成・init し、タスク間で使い回す
    // (従来は 48 タスクごとに new Worker + wasm init していた)。
    const pool = [...new Array(concurrency)].map(() => factory());
    const exitAll = () => {
      for (const w of pool) {
        try {
          w.workerProxy[releaseProxy]();
        } catch (_) {}
        w.workerInstance.terminate();
      }
    };

    // 空いたワーカーが次の(LPT順の)インデックスを引いていく動的スケジューリング。
    // JS は単一スレッドなので nextOrderIndex++ に競合はない。
    let nextOrderIndex = 0;
    const runWorker = async (
      worker: (typeof pool)[number]
    ): Promise<void> => {
      while (true) {
        if (signal.aborted) {
          throw new Error('aborted');
        }
        const k = nextOrderIndex++;
        if (k >= indexOrder.length) {
          return;
        }
        const i = indexOrder[k];

        const result = (await worker.workerProxy.solveIncludingTraceIndex(
          simulationData,
          explorationTarget,
          i
        )) as ExplorationResult;
        fixTraceCoordsInResult(result);

        candidates_num += result.candidates_num;
        for (const s of result.optimal_solutions) {
          mergeResultIfRankedIn(explorationTarget, s, optimal_solutions);
        }

        if (ideal_candidates_num_by_indexes && ideal_total_num) {
          intermediate_ideal_candidates += ideal_candidates_num_by_indexes[i];
          onProgress?.(
            {
              explorationTarget,
              elapsedTime: Date.now() - startTime,
              candidates_num,
              optimal_solutions: [...optimal_solutions]
            },
            (100 * intermediate_ideal_candidates) / ideal_total_num
          );
        }
      }
    };

    const abortPromise = new Promise<never>((_, reject) => {
      const onAborted = () => {
        signal.removeEventListener('abort', onAborted);
        reject(new Error('aborted'));
      };
      signal.addEventListener('abort', onAborted);
    });

    try {
      await Promise.race([
        Promise.all(pool.map((w) => runWorker(w))),
        abortPromise
      ]);
    } finally {
      exitAll();
    }

    return {
      explorationTarget,
      elapsedTime: Date.now() - startTime,
      candidates_num,
      optimal_solutions
    } satisfies SolveResult;
  };

/** ワーカー経由で壊れてしまう座標を修正する。*/
const fixTraceCoordsInResult = (result: ExplorationResult) => {
  for (const s of result.optimal_solutions) {
    s.trace_coords = s.trace_coords.map(
      (c: any) => PuyoCoord.xyToCoord(c._x, c._y)!
    );
  }
};
