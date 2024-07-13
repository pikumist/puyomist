import { PuyoType } from '../../logics/PuyoType';

export const getCursorClass = (type: PuyoType | undefined) => {
  if (!type) {
    return 'cursorCrosshair';
  }
  if (type >= PuyoType.Red && type <= PuyoType.PurpleChancePlus) {
    const color = Math.floor((type - PuyoType.Red) / 4);
    const colorName = ['Red', 'Blue', 'Green', 'Yellow', 'Purple'][color];
    const enchant = type - PuyoType.Red - color * 4;
    const enchantName = ['', 'Plus', 'Chance', 'ChancePlus'][enchant];
    return `cursor${colorName}${enchantName}`;
  }
  switch (type) {
    case PuyoType.Heart:
      return 'cursorHeart';
    case PuyoType.Prism:
      return 'cursorPrism';
    case PuyoType.Ojama:
      return 'cursorOjama';
    case PuyoType.Kata:
      return 'cursorKata';
    case PuyoType.Padding:
      return 'cursorPadding';
    default:
      return '';
  }
};
