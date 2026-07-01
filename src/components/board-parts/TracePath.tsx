import React from 'react';
import type { PuyoCoord } from '@/logics/PuyoCoord';
import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';

interface TracePathProps {
  coords: ReadonlyArray<PuyoCoord>;
}

const toPoint = (coord: PuyoCoord) => {
  const x = coord.x * (cw + gw) + cw / 2;
  const y = nch + gw + coord.y * (ch + gw) + ch / 2;
  return `${x},${y}`;
};

/** なぞり順をつなぐ軌跡 */
const TracePath: React.FC<TracePathProps> = React.memo((props) => {
  const { coords } = props;

  if (coords.length === 0) {
    return null;
  }

  const points = coords.map(toPoint).join(' ');
  const lastCoord = coords[coords.length - 1]!;
  const lastX = lastCoord.x * (cw + gw) + cw / 2;
  const lastY = nch + gw + lastCoord.y * (ch + gw) + ch / 2;

  return (
    <g className={styles.tracePath}>
      {coords.length > 1 ? (
        <>
          <polyline className={styles.tracePathHalo} points={points} />
          <polyline className={styles.tracePathLine} points={points} />
          <polyline className={styles.tracePathGlint} points={points} />
        </>
      ) : null}
      <circle className={styles.tracePathEndHalo} cx={lastX} cy={lastY} r="10.5" />
      <circle className={styles.tracePathEnd} cx={lastX} cy={lastY} r="4.6" />
    </g>
  );
});

export default TracePath;
