import type { Board } from '../../logics/Board';
import type { PuyomistJson } from '../../logics/app-json';
import { usePuyoAppStore } from '../puyoAppStore';
import { solveButtonClicked } from './solve';

/** 盤面判定が完了したら自動で最適解探索 */
export const boardDetectedAndSolve = (
  error?: string | undefined,
  board?: Board | undefined
): void => {
  const store = usePuyoAppStore.getState();
  store.boardDetected({ error, board });
  store.solutionResetButtonClicked();
  if (!usePuyoAppStore.getState().screenshotErrorMessage) {
    solveButtonClicked();
  }
};

/** puyomist JSONを受け取ったら自動で最適解探索 */
export const puyomistJsonDetectedAndSolve = (json: PuyomistJson): void => {
  const store = usePuyoAppStore.getState();
  store.puyomistJsonDetected(json);
  store.solutionResetButtonClicked();
  if (!usePuyoAppStore.getState().screenshotErrorMessage) {
    solveButtonClicked();
  }
};
