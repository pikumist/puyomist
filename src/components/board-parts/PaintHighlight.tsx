import React from 'react';
import { PuyoAttr } from '../../logics/PuyoAttr';
import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';

interface PaintHighlightProps {
  x: number;
  y: number;
  /** 塗り色 */
  attr: PuyoAttr;
}

const colorClass = (attr: PuyoAttr): string => {
  switch (attr) {
    case PuyoAttr.Red:
      return styles.paintHighlightRed;
    case PuyoAttr.Blue:
      return styles.paintHighlightBlue;
    case PuyoAttr.Green:
      return styles.paintHighlightGreen;
    case PuyoAttr.Yellow:
      return styles.paintHighlightYellow;
    default:
      return styles.paintHighlightPurple;
  }
};

/** 塗り案のマス描画。塗り案にホバーしている間だけ盤面に重ねる。 */
const PaintHighlight: React.FC<PaintHighlightProps> = React.memo((props) => {
  const { x, y, attr } = props;

  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;

  return (
    <g transform={outerTransform}>
      <rect
        className={`${styles.paintHighlight} ${colorClass(attr)}`}
        x="2.5"
        y="2.5"
        width="43"
        height="43"
        rx="5"
      />
    </g>
  );
});

export default PaintHighlight;
