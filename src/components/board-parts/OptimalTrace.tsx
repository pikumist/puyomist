import styles from '../PuyoBoard.module.css';
import { ch, cw, gw, nch } from './logics/measurements';

interface OptimalTraceProps {
  x: number;
  y: number;
}

/** 最適なぞり描画 */
const OptimalTrace: React.FC<OptimalTraceProps> = (props) => {
  const { x, y } = props;

  const outerTransform = `translate(${x * (cw + gw)} ${
    nch + gw + y * (ch + gw)
  })`;

  return (
    <g transform={outerTransform}>
      <rect
        className={styles.optimalTrace}
        x="4"
        y="4"
        width="40"
        height="40"
      />
    </g>
  );
};

export default OptimalTrace;
