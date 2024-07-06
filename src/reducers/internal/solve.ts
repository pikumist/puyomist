import { releaseProxy } from 'comlink';
import type { OptimizationTarget } from '../../logics/OptimizationTarget';
import type { Simulator } from '../../logics/Simulator';
import type { SolutionResult } from '../../logics/solution';
import { betterSolution } from '../../logics/solution-explorer';
import { createWorker } from '../../logics/solution-worker-shim';

export const createSolveAllInSerial =
  (simulator: Simulator, optimizationTarget: OptimizationTarget) =>
  async () => {
    const { workerProxy } = createWorker();
    return await workerProxy.solveAllTraces(simulator, optimizationTarget);
  };

export const createSolveAllInParallel =
  (simulator: Simulator, optimizationTarget: OptimizationTarget) =>
  async () => {
    const startTime = Date.now();

    const solutionsByIndexs = await Promise.all(
      [...new Array(48)].map((_, i) => {
        const { workerInstance, workerProxy } = createWorker();
        return workerProxy
          .solveIncludingTraceIndex(simulator, optimizationTarget, i)
          .then((result) => {
            console.log(i, result?.candidatesNum, `${result?.elapsedTime}ms`);
            workerProxy[releaseProxy]();
            workerInstance.terminate();
            return result;
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
        return betterSolution(optimizationTarget, m, s.optimalSolution);
      },
      undefined as SolutionResult | undefined
    );

    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    return {
      optimizationTarget,
      elapsedTime,
      candidatesNum,
      optimalSolution
    };
  };
