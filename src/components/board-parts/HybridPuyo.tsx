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
  /** 消えかけ(ポップのフェード演出中)かどうか */
  popping?: boolean;
}

/** フィールドとネクストのぷよいずれか1つの描画 */
const HybridPuyo: React.FC<PuyoProps> = React.memo((props) => {
  const { type, x, y, popping } = props;

  if (!type) {
    return <></>;
  }

  // フィールドぷよの中身。popping のときバースト(拡大+フェード)して消える。
  const bodyClass = popping
    ? `${styles.puyoBody} ${styles.popping}`
    : styles.puyoBody;

  // ネクストの場合
  if (y === -1) {
    const attr = getPuyoAttr(type)!;
    // 位置は CSS の transform プロパティで指定する(SVG の transform 属性だと
    // CSS transition が効かないため)。移動時はこの値だけが変わる。
    const outerStyle = { transform: `translate(${x * (cw + gw)}px, 0px)` };
    const innerTransform = 'translate(12)';

    if (isColoredPuyoAttr(attr)) {
      const isChance = isChancePuyo(type);
      const isPlus = isPlusPuyo(type);

      return (
        <g key="outer" className={styles.puyo} style={outerStyle}>
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
      <g key="outer" className={styles.puyo} style={outerStyle}>
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

  const outerStyle = {
    transform: `translate(${x * (cw + gw)}px, ${nch + gw + y * (ch + gw)}px)`
  };
  const attr = getPuyoAttr(type)!;

  if (isColoredPuyoAttr(attr)) {
    const isChance = isChancePuyo(type);
    const isPlus = isPlusPuyo(type);

    return (
      <g key="outer" className={styles.puyo} style={outerStyle}>
        <g key="inner" className={bodyClass}>
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
    <g key="outer" className={styles.puyo} style={outerStyle}>
      <g key="inner" className={bodyClass}>
        <use width="48" height="48" xlinkHref={getAttrSymbolReference(attr)} />
      </g>
    </g>
  );
});

export default HybridPuyo;
