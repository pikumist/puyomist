import { releaseProxy } from 'comlink';
import pLimit from 'p-limit';
import type { ExplorationTarget } from '../../logics/ExplorationTarget';
import type { SimulationData } from '../../logics/SimulationData';
import type { ExplorationResult, SolutionResult } from '../../logics/solution';
import { betterSolution } from '../../logics/solution-explorer';
import { createWorker as createWasmWorker } from '../../logics/solution-wasm-worker-shim';
import { createWorker } from '../../logics/solution-worker-shim';

const createSolveAllAbortPromises = (
  factory: typeof createWorker | typeof createWasmWorker,
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget,
  signal: AbortSignal
) => {
  const { workerInstance, workerProxy } = factory();

  const exitWorker = () => {
    workerProxy[releaseProxy]();
    workerInstance.terminate();
  };

  const solvePromise = new Promise<ExplorationResult | undefined>(
    (resolve, reject) => {
      workerProxy
        .solveAllTraces(simulationData, explorationTarget)
        .then((result) => {
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

const createSolveIncludingTraceIndexAbortPromises = (
  factory: typeof createWorker | typeof createWasmWorker,
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
          console.log(index, result?.candidatesNum, `${result?.elapsedTime}ms`);
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
) => _createSolveAllInSerial(createWorker, simulationData, explorationTarget);

export const createSolveAllInSerialByWasm = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) =>
  _createSolveAllInSerial(createWasmWorker, simulationData, explorationTarget);

export const _createSolveAllInSerial =
  (
    factory: typeof createWorker | typeof createWasmWorker,
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget
  ) =>
  async (signal: AbortSignal): Promise<ExplorationResult> => {
    return (await Promise.race(
      createSolveAllAbortPromises(
        factory,
        simulationData,
        explorationTarget,
        signal
      )
    )) as ExplorationResult;
  };

export const createSolveAllInParallel = (
  simulationData: SimulationData,
  explorationTarget: ExplorationTarget
) => _createSolveAllInParallel(createWorker, simulationData, explorationTarget);

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
    factory: typeof createWorker | typeof createWasmWorker,
    simulationData: SimulationData,
    explorationTarget: ExplorationTarget
  ) =>
  async (signal: AbortSignal): Promise<ExplorationResult> => {
    const startTime = Date.now();

    const limit = pLimit(window.navigator.hardwareConcurrency || 1);

    const solutionsByIndexs = await Promise.all(
      [...new Array(48)].map((_, i) => {
        return limit(async () => {
          return (await Promise.race(
            createSolveIncludingTraceIndexAbortPromises(
              factory,
              simulationData,
              explorationTarget,
              i,
              signal
            )
          )) as ExplorationResult;
        });
      })
    );

    const candidatesNum = solutionsByIndexs.reduce((m, s) => {
      return m + (s?.candidatesNum || 0);
    }, 0);

    const optimalSolution = solutionsByIndexs.reduce(
      (m, s) => {
        if (!m) {
          return s?.optimalSolution;
        }
        if (!s?.optimalSolution) {
          return m;
        }
        return betterSolution(
          explorationTarget.preferencePriorities,
          m,
          s.optimalSolution
        );
      },
      undefined as SolutionResult | undefined
    );

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    return {
      explorationTarget,
      elapsedTime,
      candidatesNum,
      optimalSolution
    } satisfies ExplorationResult;
  };
