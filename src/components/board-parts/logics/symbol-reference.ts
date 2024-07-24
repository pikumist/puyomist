import { PuyoAttr } from '../../../logics/PuyoAttr';

const sprite = '/puyomist/assets/puyo-sprite.svg';

const symbolIdMap: ReadonlyMap<PuyoAttr, string> = new Map([
  [PuyoAttr.Red, 'red'],
  [PuyoAttr.Blue, 'blue'],
  [PuyoAttr.Green, 'green'],
  [PuyoAttr.Yellow, 'yellow'],
  [PuyoAttr.Purple, 'purple'],
  [PuyoAttr.Heart, 'heart'],
  [PuyoAttr.Prism, 'prism'],
  [PuyoAttr.Ojama, 'ojama'],
  [PuyoAttr.Kata, 'kata'],
  [PuyoAttr.Padding, 'padding']
]);

export const getAttrSymbolReference = (attr: PuyoAttr) => {
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
