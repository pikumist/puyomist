import React from 'react';
import type { Puyo } from '../../logics/Puyo';
import HybridPuyo from './HybridPuyo';

interface PuyoMatrixProps {
  nextPuyos: (Puyo | undefined)[];
  field: (Puyo | undefined)[][];
}

function* enumerateField(
  nextPuyos: (Puyo | undefined)[],
  field: (Puyo | undefined)[][]
) {
  for (const [j, puyo] of nextPuyos.entries()) {
    yield {
      x: j,
      y: -1,
      puyo
    };
  }
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
      {[...enumerateField(nextPuyos, field)].map(({ x, y, puyo }) => {
        return (
          <HybridPuyo
            key={
              Number.isInteger(puyo?.id)
                ? puyo?.id
                : `empty-${String(x)}-${String(y)}`
            }
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
