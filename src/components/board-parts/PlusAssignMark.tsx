import React from 'react';
import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';

interface PlusAssignMarkProps {
  x: number;
  y: number;
  /** 何番目に付けるとよいか (1始まり) */
  rank: number;
}

/**
 * プラスを付けるとよいマスの印。マスを縁取り、左下に「＋順位」のバッジを出す。
 *
 * 実際のプラスぷよの見た目 (スプライト側) と紛れないよう、色と形を分けてある。
 */
const PlusAssignMark: React.FC<PlusAssignMarkProps> = React.memo((props) => {
  const { x, y, rank } = props;

  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;

  return (
    <g transform={outerTransform} className={styles.plusAssignMark}>
      <rect
        className={styles.plusAssignCell}
        x="2.5"
        y="2.5"
        width="43"
        height="43"
        rx="5"
      />
      <rect
        className={styles.plusAssignBadge}
        x="2.5"
        y="30.5"
        width="24"
        height="15"
        rx="5"
      />
      <text className={styles.plusAssignBadgeText} x="14.5" y="41.5">
        {`+${rank}`}
      </text>
    </g>
  );
});

export default PlusAssignMark;
