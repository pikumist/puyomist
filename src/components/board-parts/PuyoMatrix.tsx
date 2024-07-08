import React from 'react';
import type { Puyo } from '../../logics/Puyo';
import FieldPuyo from './FieldPuyo';
import NextPuyo from './NextPuyo';

type PuyoMatrixProps = {
  nextPuyos: (Puyo | undefined)[];
  field: (Puyo | undefined)[][];
};

function* enumerateField(field: (Puyo | undefined)[][]) {
  for (const [i, row] of field.entries()) {
    for (const [j, puyo] of row.entries()) {
      yield {
        x: j,
        y: i,
        puyo
      };
    }
  }
}

/** 全てのぷよの描画 */
const PuyoMatrix: React.FC<PuyoMatrixProps> = React.memo((props) => {
  const { nextPuyos, field } = props;

  return (
    <g>
      {nextPuyos.map((puyo, j) => (
        <NextPuyo
          key={puyo?.id ?? `empty-${String(j)}`}
          puyoId={puyo?.id}
          type={puyo?.type}
          x={j}
        />
      ))}
      {[...enumerateField(field)].map(({ x, y, puyo }) => {
        return (
          <FieldPuyo
            key={puyo?.id ?? `empty-${String(x)}-${String(y)}`}
            puyoId={puyo?.id}
            type={puyo?.type}
            x={x}
            y={y}
          />
        );
      })}
    </g>
  );
});

export default PuyoMatrix;
