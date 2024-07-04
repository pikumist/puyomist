import type { Field } from '../../logics/Field';
import { PuyoType } from '../../logics/puyo';

/**
 * ネクスト情報をフィールドに反映する。
 * TODO: ネクスト情報文字列を簡略化する。
 */
export const reflectNextInField = (field: Field, nextSelection: string) => {
  const isPlus = nextSelection[nextSelection.length - 1] === '+';
  const v = isPlus
    ? nextSelection.slice(0, nextSelection.length - 1)
    : nextSelection;
  switch (v) {
    case 'random':
      field.resetNextPuyosAsRandom();
      break;
    case 'red':
      field.resetNextPuyosAsSameType(isPlus ? PuyoType.RedPlus : PuyoType.Red);
      break;
    case 'blue':
      field.resetNextPuyosAsSameType(
        isPlus ? PuyoType.BluePlus : PuyoType.Blue
      );
      break;
    case 'green':
      field.resetNextPuyosAsSameType(
        isPlus ? PuyoType.GreenPlus : PuyoType.Green
      );
      break;
    case 'yellow':
      field.resetNextPuyosAsSameType(
        isPlus ? PuyoType.YellowPlus : PuyoType.Yellow
      );
      break;
    case 'purple':
      field.resetNextPuyosAsSameType(
        isPlus ? PuyoType.PurplePlus : PuyoType.Purple
      );
      break;
  }
};
