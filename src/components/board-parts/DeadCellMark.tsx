import React from 'react';
import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';

interface DeadCellMarkProps {
  x: number;
  y: number;
}

/**
 * そのままでは消せないぷよの印。マスの右上に小さな×を出す。
 *
 * ぷよの見た目 (色・プラス・チャンス) には手を付けない。盤面の把握を邪魔しないよう、
 * 印だけを重ねる。
 */
const DeadCellMark: React.FC<DeadCellMarkProps> = React.memo((props) => {
  const { x, y } = props;

  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;

  return (
    <g transform={outerTransform} className={styles.deadCellMark}>
      {/* 暗いぷよの上でも見えるよう、太い暗色の下地に細い明色を重ねる */}
      <path className={styles.deadCellMarkHalo} d="M35 6 L43 14 M43 6 L35 14" />
      <path className={styles.deadCellMarkLine} d="M35 6 L43 14 M43 6 L35 14" />
    </g>
  );
});

export default DeadCellMark;
