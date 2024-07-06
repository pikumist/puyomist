import type { Simulator } from '../../logics/Simulator';
import { getSpecialBoard } from '../../logics/boards';

/** ボード情報をフィールドに反映する。 */
export const reflectBoardInSimulator = (
  simulator: Simulator,
  boardId: string
) => {
  const board = getSpecialBoard(boardId);
  simulator.resetWithBoard(board);
};
