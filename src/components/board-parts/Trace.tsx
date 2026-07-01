import React from 'react';
import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';

interface TraceProps {
  x: number;
  y: number;
}

/** なぞり描画 */
const Trace: React.FC<TraceProps> = React.memo((props) => {
  const { x, y } = props;

  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;

  return (
    <g transform={outerTransform}>
      <circle className={styles.traceInk} cx="24" cy="24" r="4.2" />
      <circle className={styles.traceInkGlint} cx="22.8" cy="22.6" r="1.05" />
    </g>
  );
});

export default Trace;
