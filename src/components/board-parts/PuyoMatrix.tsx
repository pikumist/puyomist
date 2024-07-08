import type { Puyo } from '../../logics/Puyo';
import FieldPuyo from './FieldPuyo';
import NextPuyo from './NextPuyo';

type PuyoMatrixProps = {
  nextPuyos: (Puyo | undefined)[];
  field: (Puyo | undefined)[][];
};

/** 全てのぷよの描画 */
const PuyoMatrix: React.FC<PuyoMatrixProps> = (props) => {
  const { nextPuyos, field } = props;

  return (
    <g>
      {nextPuyos.map((puyo, j) => (
        <NextPuyo
          key={puyo?.id ?? `empty-${String(j)}`}
          type={puyo?.type}
          x={j}
        />
      ))}
      {field.map((row, i) =>
        row.map((puyo, j) => (
          <FieldPuyo
            key={puyo?.id ?? `empty-${String(j)}-${String(i)}`}
            type={puyo?.type}
            x={j}
            y={i}
          />
        ))
      )}
    </g>
  );
};

export default PuyoMatrix;
