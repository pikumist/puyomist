import type React from 'react';
import {
  type PuyoType,
  getPuyoAttribute,
  isChancePuyo,
  isPlusPuyo
} from '../logics/PuyoType';
import {
  getAttrSymbolReference,
  getChanceSymbolReference,
  getPlusSymbolReference
} from './board-parts/logics/symbol-reference';

interface IProps {
  type: PuyoType;
}

const iconStyle = {
  width: '24px',
  height: '24px'
};

/** ぷよアイコン */
const PuyoIcon: React.FC<IProps> = (props) => {
  const { type } = props;

  const attr = getPuyoAttribute(type)!;
  const isChance = isChancePuyo(type);
  const isPlus = isPlusPuyo(type);

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: <explanation>
    <svg viewBox="0 0 24 24" style={iconStyle}>
      <use width="24" height="24" xlinkHref={getAttrSymbolReference(attr)} />
      {isChance ? (
        <use width="24" height="24" xlinkHref={getChanceSymbolReference()} />
      ) : null}
      {isPlus ? (
        <use width="24" height="24" xlinkHref={getPlusSymbolReference()} />
      ) : null}
    </svg>
  );
};

export default PuyoIcon;
