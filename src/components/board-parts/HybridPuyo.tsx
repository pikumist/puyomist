import React from 'react';
import { isColoredPuyoAttr } from '../../logics/PuyoAttr';
import {
  type PuyoType,
  getPuyoAttr,
  isChancePuyo,
  isPlusPuyo
} from '../../logics/PuyoType';
import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';
import {
  getAttrSymbolReference,
  getChanceSymbolReference,
  getPlusSymbolReference
} from './logics/symbol-reference';

interface PuyoProps {
  type: PuyoType | undefined;
  x: number;
  /** yが-1のときネクスト */
  y: number;
}

/** フィールドとネクストのぷよいずれか1つの描画 */
const HybridPuyo: React.FC<PuyoProps> = React.memo((props) => {
  const { type, x, y } = props;

  if (!type) {
    return <></>;
  }

  // ネクストの場合
  if (y === -1) {
    const attr = getPuyoAttr(type)!;
    const outerTransform = `translate(${x * (cw + gw)} 0)`;
    const innerTransform = 'translate(12)';

    if (isColoredPuyoAttr(attr)) {
      const isChance = isChancePuyo(type);
      const isPlus = isPlusPuyo(type);

      return (
        <g key="outer" className={styles.puyo} transform={outerTransform}>
          <g key="inner" transform={innerTransform}>
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
              <use
                width="24"
                height="24"
                xlinkHref={getPlusSymbolReference()}
              />
            ) : (
              ''
            )}
          </g>
        </g>
      );
    }

    return (
      <g key="outer" className={styles.puyo} transform={outerTransform}>
        <g key="inner" transform={innerTransform}>
          <use
            width="24"
            height="24"
            xlinkHref={getAttrSymbolReference(attr)}
          />
        </g>
      </g>
    );
  }

  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;
  const attr = getPuyoAttr(type)!;

  if (isColoredPuyoAttr(attr)) {
    const isChance = isChancePuyo(type);
    const isPlus = isPlusPuyo(type);

    return (
      <g key="outer" className={styles.puyo} transform={outerTransform}>
        <g key="inner">
          <use
            width="48"
            height="48"
            xlinkHref={getAttrSymbolReference(attr)}
          />
          {isChance ? (
            <use
              width="48"
              height="48"
              xlinkHref={getChanceSymbolReference()}
            />
          ) : (
            ''
          )}
          {isPlus ? (
            <use width="48" height="48" xlinkHref={getPlusSymbolReference()} />
          ) : (
            ''
          )}
        </g>
      </g>
    );
  }

  return (
    <g key="outer" className={styles.puyo} transform={outerTransform}>
      <g key="inner">
        <use width="48" height="48" xlinkHref={getAttrSymbolReference(attr)} />
      </g>
    </g>
  );
});

export default HybridPuyo;
