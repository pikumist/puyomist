import { releaseProxy } from 'comlink';
import pLimit from 'p-limit';
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

const createSolveIncludingTraceIndexAbortPromises = (
  factory: typeof createJsWorker | typeof createWasmWorker,
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  index: number,
  signal: AbortSignal
) => {
  if (signal.aborted) {
    throw new Error('aborted');
  }

  const { workerInstance, workerProxy } = factory();

  const exitWorker = () => {
    try {
      // 他のスレッドが先にabortシグナルを受け取って、proxyがリリースされている可能性があるようなので、
      // エラーが起きたら無視する。
      workerProxy[releaseProxy]();
    } catch (_) {}
    workerInstance.terminate();
  };

  const solvePromise = new Promise<ExplorationResult | undefined>(
    (resolve, reject) => {
      workerProxy
        .solveIncludingTraceIndex(simulationData, explorationTarget, index)
        .then((result) => {
          fixTraceCoordsInResult(result);
          exitWorker();
          resolve(result);
        })
        .catch((ex) => {
          exitWorker();
          reject(ex);
        });
    }
  );

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
    const limit = pLimit(window.navigator.hardwareConcurrency || 1);

    const maxTraceNum = simulationData.isChanceMode
      ? 5
      : simulationData.maxTraceNum;
    const ideal_candidates_num_by_indexes =
      traceCandidatesNumMap.get(maxTraceNum);
    const ideal_total_num = ideal_candidates_num_by_indexes?.reduce(
      (m, n) => m + n
    );
    const intermediate_optimal_solutions: SolutionResult[] = [];
    let intermediate_ideal_candidates = 0;
    let intermediate_candidates = 0;

    const solutionsByIndexs = await Promise.all(
      [...new Array(48)].map((_, i) => {
        return limit(async () => {
          const result = (await Promise.race(
            createSolveIncludingTraceIndexAbortPromises(
              factory,
              simulationData,
              explorationTarget,
              i,
              signal
            )
          )) as ExplorationResult;

          if (ideal_candidates_num_by_indexes && ideal_total_num) {
            intermediate_ideal_candidates += ideal_candidates_num_by_indexes[i];
            intermediate_candidates += result.candidates_num;
            for (const s of result.optimal_solutions) {
              mergeResultIfRankedIn(
                explorationTarget,
                s,
                intermediate_optimal_solutions
              );
            }
            onProgress?.(
              {
                explorationTarget,
                elapsedTime: Date.now() - startTime,
                candidates_num: intermediate_candidates,
                optimal_solutions: [...intermediate_optimal_solutions]
              },
              (100 * intermediate_ideal_candidates) / ideal_total_num
            );
          }

          return result;
        });
      })
    );

    const candidates_num = solutionsByIndexs.reduce((m, s) => {
      return m + (s?.candidates_num || 0);
    }, 0);

    const optimal_solutions = solutionsByIndexs.shift()!.optimal_solutions;

    for (const e of solutionsByIndexs) {
      for (const s of e.optimal_solutions) {
        mergeResultIfRankedIn(explorationTarget, s, optimal_solutions);
      }
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
