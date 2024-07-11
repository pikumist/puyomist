import { releaseProxy } from 'comlink';
import type { ExplorationTarget } from '../../logics/ExplorationTarget';
import type { SimulationData } from '../../logics/SimulationData';
import type { ExplorationResult, SolutionResult } from '../../logics/solution';
import { betterSolution } from '../../logics/solution-explorer';
import { createWorker } from '../../logics/solution-worker-shim';

export const createSolveAllInSerial =
  (simulationData: SimulationData, explorationTarget: ExplorationTarget) =>
  async () => {
    const { workerProxy } = createWorker();
    return await workerProxy.solveAllTraces(simulationData, explorationTarget);
  };

export const createSolveAllInParallel =
  (simulationData: SimulationData, explorationTarget: ExplorationTarget) =>
  async () => {
    const startTime = Date.now();

    const solutionsByIndexs = await Promise.all(
      [...new Array(48)].map((_, i) => {
        const { workerInstance, workerProxy } = createWorker();
        return workerProxy
          .solveIncludingTraceIndex(simulationData, explorationTarget, i)
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
        return betterSolution(explorationTarget, m, s.optimalSolution);
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
