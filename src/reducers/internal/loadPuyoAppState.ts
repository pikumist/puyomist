import { getBoostArea } from '../../logics/BoostArea';
import type { PuyoCoord } from '../../logics/PuyoCoord';
import { Simulator } from '../../logics/Simulator';
import { screenshotBoardId } from '../../logics/boards';
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
  simulator.setBoostAreaCoordSetList(
    boostAreaKeyList
      .map((key) => {
        return getBoostArea(key)?.coordSet;
      })
      .filter(Boolean) as ReadonlySet<PuyoCoord>[]
  );
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
