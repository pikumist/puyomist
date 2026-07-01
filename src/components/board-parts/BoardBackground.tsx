import React from 'react';
import styles from '../PuyoBoard.module.css';
import { H, W } from './logics/measurements';

/** ボードの背景 */
const BoardBackground: React.FC = React.memo(() => {
  const d = `M0,0 h${W} v${H} h${-W} z`;

  return (
    <>
      <defs>
        {/*
          微細グレイン。fractalNoise を彩度ゼロ・低アルファのモノクロ粒に
          変換し、overlay で下地に馴染ませる。柄ではなく「質感」なので
          ぷよ・なぞり線の視認性は奪わず、ベタ塗り感だけを消す。
        */}
        <filter
          id="boardBgGrain"
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            stitchTiles="stitch"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" result="mono" />
          <feComponentTransfer in="mono">
            <feFuncA type="linear" slope="0.8" intercept="0" />
          </feComponentTransfer>
        </filter>
      </defs>
      <path className={styles.boardBackground} d={d} />
      <rect
        className={styles.boardGrain}
        x="0"
        y="0"
        width={W}
        height={H}
        filter="url(#boardBgGrain)"
      />
    </>
  );
});

export default BoardBackground;
