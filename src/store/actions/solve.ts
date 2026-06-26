import { SolutionMethod, type SolveResult } from '../../logics/solution';
import {
  createSolveAllInParallel,
  createSolveAllInParallelByWasm,
  createSolveAllInSerial,
  createSolveAllInSerialByWasm
} from '../internal/solve';
import { usePuyoAppStore } from '../puyoAppStore';
import { tracingFinished } from './chainAnimation';

/** 最適解探索ボタンがクリックされたとき */
export const solveButtonClicked = (): void => {
  const state = usePuyoAppStore.getState();
  if (state.solving) {
    return;
  }

  state.solvingStarted();

  let solve: (
    signal: AbortSignal,
    onProgress?: (result: SolveResult, rate: number) => void
  ) => Promise<SolveResult>;

  switch (state.solutionMethod) {
    case SolutionMethod.solveAllInSerial:
      solve = createSolveAllInSerial(
        state.simulationData,
        state.explorationTarget
      );
      break;
    case SolutionMethod.solveAllInParallel:
      solve = createSolveAllInParallel(
        state.simulationData,
        state.explorationTarget
      );
      break;
    case SolutionMethod.solveAllInSerialByWasm:
      solve = createSolveAllInSerialByWasm(
        state.simulationData,
        state.explorationTarget
      );
      break;
    case SolutionMethod.solveAllInParallelByWasm:
      solve = createSolveAllInParallelByWasm(
        state.simulationData,
        state.explorationTarget
      );
      break;
  }

  (async () => {
    try {
      const signal =
        usePuyoAppStore.getState().abortControllerForSolving!.signal;
      const result = await solve(signal, (res, percent) => {
        usePuyoAppStore.getState().solvingProgress({ result: res, percent });
      });
      usePuyoAppStore.getState().solved(result);
    } catch (_) {
      usePuyoAppStore.getState().solveFailed();
    }
  })();
};

/** 最適解でなぞるボタンがクリックされたとき */
export const playSolutionButtonClicked = (): void => {
  const state = usePuyoAppStore.getState();

  if (!state.solveResult?.optimal_solutions.length) {
    return;
  }

  state.preparePlaySolutionButtonClicked();
  tracingFinished();
};
