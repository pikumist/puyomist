import type { Field } from '../../logics/Field';
import { getSpecialBoard } from '../../logics/boards';

/** ボード情報をフィールドに反映する。 */
export const reflectBoardInField = (field: Field, boardId: string) => {
  const board = getSpecialBoard(boardId);
  field.resetFieldByBoard(board);
};
