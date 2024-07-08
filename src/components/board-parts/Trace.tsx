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
      <rect className={styles.trace} x="4" y="4" width="40" height="40" />
    </g>
  );
});

export default Trace;
