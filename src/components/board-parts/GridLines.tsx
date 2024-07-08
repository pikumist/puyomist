import type React from 'react';
import { PuyoCoord } from '../../logics/PuyoCoord';
import styles from '../PuyoBoard.module.css';
import { H, W, ch, cw, fw, gw, nch } from './logics/measurements';

/** グリッドライン */
const GridLines: React.FC = () => {
  const gridStyle = {
    strokeWidth: `${gw}px`
  };

  const xLines = [...new Array(PuyoCoord.XNum - 1)].map((_, i) => {
    const x = fw + cw + (gw + cw) * i;
    const d = `M${x},${fw} v${H - fw * 2}`;

    return (
      <path
        className={styles.gridLine}
        style={gridStyle}
        key={String(i)}
        d={d}
      />
    );
  });

  const yLines = [...new Array(PuyoCoord.YNum)].map((_, i) => {
    const y = fw + nch + (gw + ch) * i;
    const d = `M${fw},${y} h${W - fw * 2}`;

    return (
      <path
        className={styles.gridLine}
        style={gridStyle}
        key={String(i)}
        d={d}
      />
    );
  });

  return (
    <g>
      {xLines}
      {yLines}
    </g>
  );
};

export default GridLines;
