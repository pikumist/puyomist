import { getBoostArea } from '../../logics/BoostArea';
import { Field } from '../../logics/Field';
import type { PuyoCoord } from '../../logics/PuyoCoord';
import { screenshotBoardId } from '../../logics/boards';
import { type Session, session as g_session } from '../../logics/session';
import type { PuyoAppState } from '../PuyoAppState';
import { reflectBoardInField } from './reflectBoardInField';
import { reflectNextInField } from './reflectNextInField';

export const loadPuyoAppState = (session?: Session): PuyoAppState => {
  const s = session ?? g_session;

  const boardId = s.getBoardId();
  const nextSelection = s.getNextSelection();
  const optimizationTarget = s.getOptimizationTarget();
  const solutionMethod = s.getSolutionMethod();
  const lastScreenshotBoard = s.getLastScreenshotBoard();
  const boostAreaKeyList = s.getBoostAreaKeyList();
  const boardEditMode = s.getBoardEditMode();

  const field = new Field();
  field.setMaxTraceNum(s.getMaxTraceNum());
  field.setPoppingLeverage(s.getPoppingLeverage());
  field.setAnimationDuration(s.getAnimationDuration());
  field.setBoostAreaCoordSetList(
    boostAreaKeyList
      .map((key) => {
        return getBoostArea(key)?.coordSet;
      })
      .filter(Boolean) as ReadonlySet<PuyoCoord>[]
  );
  if (boardId === screenshotBoardId) {
    if (lastScreenshotBoard) {
      field.resetFieldByBoard(lastScreenshotBoard);
    }
  } else {
    reflectBoardInField(field, boardId);
    reflectNextInField(field, nextSelection);
  }

  return {
    boardId,
    nextSelection,
    optimizationTarget,
    solutionMethod,
    lastScreenshotBoard,
    boostAreaKeyList,
    boardEditMode,
    field,
    animating: false,
    chainDamages: [],
    solving: false,
    solvedResult: undefined,
    screenshotInfo: undefined,
    screenshotErrorMessage: undefined
  };
};
