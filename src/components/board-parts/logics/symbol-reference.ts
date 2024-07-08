import { PuyoAttribute } from '../../../logics/PuyoAttribute';

const sprite = '/puyomist/assets/puyo-sprite.svg';

const symbolIdMap: ReadonlyMap<PuyoAttribute, string> = new Map([
  [PuyoAttribute.Red, 'red'],
  [PuyoAttribute.Blue, 'blue'],
  [PuyoAttribute.Green, 'green'],
  [PuyoAttribute.Yellow, 'yellow'],
  [PuyoAttribute.Purple, 'purple'],
  [PuyoAttribute.Heart, 'heart'],
  [PuyoAttribute.Prism, 'prism'],
  [PuyoAttribute.Ojyama, 'ojama'],
  [PuyoAttribute.Kata, 'kata'],
  [PuyoAttribute.Padding, 'padding']
]);

export const getAttrSymbolReference = (attr: PuyoAttribute) => {
  const id = symbolIdMap.get(attr);
  if (!id) {
    return;
  }
  return `${sprite}#${id}`;
};

export const getPlusSymbolReference = () => {
  return `${sprite}#plus`;
};

export const getChanceSymbolReference = () => {
  return `${sprite}#chance`;
};

export const getBoostAreaSymbolReference = () => {
  return `${sprite}#boostArea`;
};
