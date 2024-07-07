import { PuyoType } from '../../logics/PuyoType';
import type { Simulator } from '../../logics/Simulator';

/**
 * ネクスト情報をフィールドに反映する。
 * TODO: ネクスト情報文字列を簡略化する。
 */
export const reflectNextInSimulator = (
  simulator: Simulator,
  nextSelection: string
) => {
  const isPlus = nextSelection[nextSelection.length - 1] === '+';
  const v = isPlus
    ? nextSelection.slice(0, nextSelection.length - 1)
    : nextSelection;
  switch (v) {
    case 'random':
      simulator.resetNextPuyosAsRandom();
      break;
    case 'red':
      simulator.resetNextPuyosAsSameType(
        isPlus ? PuyoType.RedPlus : PuyoType.Red
      );
      break;
    case 'blue':
      simulator.resetNextPuyosAsSameType(
        isPlus ? PuyoType.BluePlus : PuyoType.Blue
      );
      break;
    case 'green':
      simulator.resetNextPuyosAsSameType(
        isPlus ? PuyoType.GreenPlus : PuyoType.Green
      );
      break;
    case 'yellow':
      simulator.resetNextPuyosAsSameType(
        isPlus ? PuyoType.YellowPlus : PuyoType.Yellow
      );
      break;
    case 'purple':
      simulator.resetNextPuyosAsSameType(
        isPlus ? PuyoType.PurplePlus : PuyoType.Purple
      );
      break;
  }
};
