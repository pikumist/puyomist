import { type Puyo, generatePuyoId } from '../../logics/Puyo';
import { PuyoCoord } from '../../logics/PuyoCoord';
import { PuyoType } from '../../logics/PuyoType';
import { choice } from '../../logics/generics/random';

export const createNextPuyos = (
  nextSelection?: string
): (Puyo | undefined)[] => {
  if (!nextSelection) {
    return [...new Array(PuyoCoord.XNum)];
  }

  const isPlus = nextSelection[nextSelection.length - 1] === '+';
  const v = isPlus
    ? nextSelection.slice(0, nextSelection.length - 1)
    : nextSelection;

  switch (v) {
    case 'random':
      return createNextPuyosAsRandom();
    case 'red':
      return createNextPuyosAsSameType(
        isPlus ? PuyoType.RedPlus : PuyoType.Red
      );
    case 'blue':
      return createNextPuyosAsSameType(
        isPlus ? PuyoType.BluePlus : PuyoType.Blue
      );
    case 'green':
      return createNextPuyosAsSameType(
        isPlus ? PuyoType.GreenPlus : PuyoType.Green
      );
    case 'yellow':
      return createNextPuyosAsSameType(
        isPlus ? PuyoType.YellowPlus : PuyoType.Yellow
      );
    case 'purple':
      return createNextPuyosAsSameType(
        isPlus ? PuyoType.PurplePlus : PuyoType.Purple
      );
    default:
      return [...new Array(PuyoCoord.XNum)];
  }
};

export const createNextPuyosAsRandom = (): (Puyo | undefined)[] => {
  const possibleNextPuyoTypes = [
    PuyoType.Red,
    PuyoType.Blue,
    PuyoType.Green,
    PuyoType.Yellow,
    PuyoType.Purple
  ];

  return [...new Array(PuyoCoord.XNum)].map((_) => ({
    id: generatePuyoId(),
    type: choice(possibleNextPuyoTypes)
  }));
};

export const createNextPuyosAsSameType = (
  type: PuyoType
): (Puyo | undefined)[] =>
  [...new Array(PuyoCoord.XNum)].map((_) => ({
    id: generatePuyoId(),
    type
  }));
