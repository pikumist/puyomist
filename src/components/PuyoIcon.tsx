import { Box, type BoxProps } from '@chakra-ui/react';
import React from 'react';
import { PuyoAttribute } from '../logics/PuyoAttribute';
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

interface IProps extends BoxProps {
  type?: PuyoType;
  attr?: PuyoAttribute;
  size?: number;
}

/** ぷよアイコン */
const PuyoIcon: React.FC<IProps> = React.memo((props) => {
  const { type, attr: _attr, size: iconSize, ...rest } = props;

  const size = iconSize ?? 24;
  const iconStyle = {
    width: `${size}px`,
    height: `${size}px`
  };
  const attr = getPuyoAttribute(type) || _attr || PuyoAttribute.Padding;
  const isChance = type ? isChancePuyo(type) : false;
  const isPlus = type ? isPlusPuyo(type) : false;

  return (
    <Box {...rest}>
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: <explanation> */}
      <svg viewBox="0 0 48 48" style={iconStyle}>
        <use width="48" height="48" xlinkHref={getAttrSymbolReference(attr)} />
        {isChance ? (
          <use width="48" height="48" xlinkHref={getChanceSymbolReference()} />
        ) : null}
        {isPlus ? (
          <use width="48" height="48" xlinkHref={getPlusSymbolReference()} />
        ) : null}
      </svg>
    </Box>
  );
});

export default PuyoIcon;
