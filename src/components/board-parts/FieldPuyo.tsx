import { isColoredPuyoAttribute } from '../../logics/PuyoAttribute';
import {
  type PuyoType,
  getPuyoAttribute,
  isChancePuyo,
  isPlusPuyo
} from '../../logics/PuyoType';
import { ch, cw, gw, nch } from './logics/measurements';
import {
  getAttrSymbolReference,
  getChanceSymbolReference,
  getPlusSymbolReference
} from './logics/symbol-reference';

interface PuyoProps {
  type: PuyoType | undefined;
  x: number;
  y: number;
}

/** フィールドぷよ1つの描画 */
const FieldPuyo: React.FC<PuyoProps> = (props) => {
  const { type, x, y } = props;

  if (!type) {
    return <></>;
  }

  const attr = getPuyoAttribute(type)!;
  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;

  if (isColoredPuyoAttribute(attr)) {
    const isChance = isChancePuyo(type);
    const isPlus = isPlusPuyo(type);

    return (
      <g transform={outerTransform}>
        <use width="48" height="48" xlinkHref={getAttrSymbolReference(attr)} />
        {isChance ? (
          <use width="48" height="48" xlinkHref={getChanceSymbolReference()} />
        ) : (
          ''
        )}
        {isPlus ? (
          <use width="48" height="48" xlinkHref={getPlusSymbolReference()} />
        ) : (
          ''
        )}
      </g>
    );
  }

  return (
    <g transform={outerTransform}>
      <use width="48" height="48" xlinkHref={getAttrSymbolReference(attr)} />
    </g>
  );
};

export default FieldPuyo;
