import { isColoredPuyoAttribute } from '../../logics/PuyoAttribute';
import {
  type PuyoType,
  getPuyoAttribute,
  isChancePuyo,
  isPlusPuyo
} from '../../logics/PuyoType';
import { cw, gw } from './logics/measurements';
import {
  getAttrSymbolReference,
  getChanceSymbolReference,
  getPlusSymbolReference
} from './logics/symbol-reference';

interface NextPuyoProps {
  type: PuyoType | undefined;
  x: number;
}

/** ネクストぷよ1つの描画 */
const NextPuyo: React.FC<NextPuyoProps> = (props) => {
  const { type, x } = props;

  if (!type) {
    return <></>;
  }

  const attr = getPuyoAttribute(type)!;
  const outerTransform = `translate(${x * (cw + gw)} 0)`;
  const innerTransform = 'translate(12)';

  if (isColoredPuyoAttribute(attr)) {
    const isChance = isChancePuyo(type);
    const isPlus = isPlusPuyo(type);

    return (
      <g transform={outerTransform}>
        <g transform={innerTransform}>
          <use
            width="24"
            height="24"
            xlinkHref={getAttrSymbolReference(attr)}
          />
          {isChance ? (
            <use
              width="24"
              height="24"
              xlinkHref={getChanceSymbolReference()}
            />
          ) : (
            ''
          )}
          {isPlus ? (
            <use width="24" height="24" xlinkHref={getPlusSymbolReference()} />
          ) : (
            ''
          )}
        </g>
      </g>
    );
  }

  return (
    <g transform={outerTransform}>
      <g transform={innerTransform}>
        <use width="24" height="24" xlinkHref={getAttrSymbolReference(attr)} />
      </g>
    </g>
  );
};

export default NextPuyo;
