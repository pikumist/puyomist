import React from 'react';
import styles from '../PuyoBoard.module.css';
import { H, W } from './logics/measurements';

/** ボードの背景 */
const BoardBackground: React.FC = React.memo(() => {
  const d = `M0,0 h${W} v${H} h${-W} z`;

  return <path className={styles.boardBackground} d={d} />;
});

export default BoardBackground;
