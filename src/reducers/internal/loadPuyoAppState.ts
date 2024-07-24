import { boostAreaKeyMap } from '../../logics/BoostArea';
import type { PuyoCoord } from '../../logics/PuyoCoord';
import type { SimulationData } from '../../logics/SimulationData';
import { customBoardId, getSpecialBoard } from '../../logics/boards';
import { unionSet } from '../../logics/generics/set';
import { type Session, session as g_session } from '../../logics/session';
import type { PuyoAppState } from '../PuyoAppState';
import { createNextPuyos } from './createNextPuyos';
import { createSimulationData } from './createSimulationData';

export const loadPuyoAppState = (session?: Session): PuyoAppState => {
  const s = session ?? g_session;

  const boardId = s.getBoardId();
  const nextSelection = s.getNextSelection();
  const explorationTarget = s.getExplorationTarget();
  const solutionMethod = s.getSolutionMethod();
  const lastScreenshotBoard = s.getLastScreenshotBoard();
  const boostAreaKeyList = s.getBoostAreaKeyList();
  const boardEditMode = s.getBoardEditMode();

  const traceMode = s.getTraceMode();
  const maxTraceNum = s.getMaxTraceNum();
  const poppingLeverage = s.getPoppingLeverage();
  const animationDuration = s.getAnimationDuration();
  const boostAreaCoordList = [
    ...boostAreaKeyList
      .map((key) => boostAreaKeyMap.get(key)?.coordSet)
      .filter(Boolean)
      .reduce((m, s) => unionSet(m!, s!), new Set<PuyoCoord>([]))!
      .keys()
  ];
  const options: Partial<SimulationData> = {
    maxTraceNum,
    poppingLeverage,
    animationDuration,
    boostAreaCoordList
  };

  let simulationData: SimulationData | undefined;

  if (boardId !== customBoardId) {
    try {
      const board = getSpecialBoard(boardId);
      const nextPuyos = createNextPuyos(nextSelection);
      simulationData = createSimulationData(
        board,
        {
          ...options,
          nextPuyos
        },
        { traceMode }
      );
    } catch (ex) {
      simulationData = createSimulationData({}, options);
    }
  } else if (lastScreenshotBoard) {
    simulationData = createSimulationData(lastScreenshotBoard, options, {
      traceMode
    });
  } else {
    simulationData = createSimulationData({}, options, { traceMode });
  }

  return {
    boardId,
    nextSelection,
    explorationTarget,
    solutionMethod,
    lastScreenshotBoard,
    boostAreaKeyList,
    boardEditMode,
    isBoardEditing: false,
    simulationData,
    animating: false,
    animationSteps: [],
    activeAnimationStepIndex: -1,
    lastTraceCoords: undefined,
    solving: false,
    abortControllerForSolving: undefined,
    solveResult: undefined,
    screenshotInfo: undefined,
    screenshotErrorMessage: undefined
  };
};
