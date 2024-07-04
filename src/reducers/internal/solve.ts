import { releaseProxy } from 'comlink';
import { Field } from '../../logics/Field';
import type { OptimizationTarget } from '../../logics/OptimizationTarget';
import type { SolutionResult } from '../../logics/solution';
import { createWorker } from '../../logics/solution-worker-shim';

export const createSolve2 =
  (field: Field, optimizationTarget: OptimizationTarget) => async () => {
    const { workerProxy } = createWorker();
    return await workerProxy.solve2(field, optimizationTarget);
  };

export const createSolve3 =
  (field: Field, optimizationTarget: OptimizationTarget) => async () => {
    const startTime = Date.now();

    const solutionsByIndexs = await Promise.all(
      [...new Array(48)].map((_, i) => {
        const { workerInstance, workerProxy } = createWorker();
        return workerProxy
          .solve3(field, optimizationTarget, i)
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
        return Field.betterSolution(optimizationTarget, m, s.optimalSolution);
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
