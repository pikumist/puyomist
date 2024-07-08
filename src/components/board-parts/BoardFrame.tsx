import React from 'react';
import styles from '../PuyoBoard.module.css';
import { H, W, fw } from './logics/measurements';

/** ボードの枠 */
const BoardFrame: React.FC = React.memo(() => {
  const frameStyle = {
    strokeWidth: `${fw}px`
  };

  // biome-ignore format:
  const outer = `M0,0 h${W} v${H} h${-W} z`;
  // biome-ignore format:
  const inner = `M${fw},${fw} v${H-fw*2} h${W-fw*2} v${-(H-fw*2)} z`;

  const d = `${outer} ${inner}`;

  return <path className={styles.boardFrame} style={frameStyle} d={d} />;
});

export default BoardFrame;
