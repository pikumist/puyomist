import { getBoostArea } from '../../logics/BoostArea';
import type { PuyoCoord } from '../../logics/PuyoCoord';
import { Simulator } from '../../logics/Simulator';
import { screenshotBoardId } from '../../logics/boards';
import { unionSet } from '../../logics/generics/set';
import { type Session, session as g_session } from '../../logics/session';
import type { PuyoAppState } from '../PuyoAppState';
import { reflectBoardInSimulator } from './reflectBoardInSimulator';
import { reflectNextInSimulator } from './reflectNextInSimulator';

export const loadPuyoAppState = (session?: Session): PuyoAppState => {
  const s = session ?? g_session;

  const boardId = s.getBoardId();
  const nextSelection = s.getNextSelection();
  const optimizationTarget = s.getOptimizationTarget();
  const solutionMethod = s.getSolutionMethod();
  const lastScreenshotBoard = s.getLastScreenshotBoard();
  const boostAreaKeyList = s.getBoostAreaKeyList();
  const boardEditMode = s.getBoardEditMode();

  const simulator = new Simulator();
  simulator.setMaxTraceNum(s.getMaxTraceNum());
  simulator.setPoppingLeverage(s.getPoppingLeverage());
  simulator.setAnimationDuration(s.getAnimationDuration());
  simulator.setBoostAreaCoordList([
    ...boostAreaKeyList
      .map((key) => getBoostArea(key)?.coordSet)
      .filter(Boolean)
      .reduce((m, s) => unionSet(m!, s!), new Set<PuyoCoord>([]))!
      .keys()
  ]);
  if (boardId === screenshotBoardId) {
    if (lastScreenshotBoard) {
      simulator.resetWithBoard(lastScreenshotBoard);
    }
  } else {
    reflectBoardInSimulator(simulator, boardId);
    reflectNextInSimulator(simulator, nextSelection);
  }

  return {
    boardId,
    nextSelection,
    optimizationTarget,
    solutionMethod,
    lastScreenshotBoard,
    boostAreaKeyList,
    boardEditMode,
    simulator,
    animating: false,
    lastTraceCoords: undefined,
    chains: [],
    solving: false,
    explorationResult: undefined,
    screenshotInfo: undefined,
    screenshotErrorMessage: undefined
  };
};
