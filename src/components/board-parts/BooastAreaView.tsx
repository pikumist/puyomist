import React from 'react';
import type { PuyoCoord } from '../../logics/PuyoCoord';
import { ch, cw, fw, gw, nch } from './logics/measurements';
import { getBoostAreaSymbolReference } from './logics/symbol-reference';

interface BoostAreaProps {
  coordList: ReadonlyArray<PuyoCoord>;
}

const calcTransform = (x: number, y: number) =>
  `translate(${fw + x * (cw + gw)} ${fw + nch + gw + y * (ch + gw)})`;

/** ブーストエリア表示 */
const BoostAreaView: React.FC<BoostAreaProps> = React.memo((props) => {
  const { coordList } = props;

  return (
    <g key="boostArea">
      {coordList.map(({ x, y }) => {
        return (
          <g key={`${x},${y}`} transform={calcTransform(x, y)}>
            <use
              width="48"
              height="48"
              xlinkHref={getBoostAreaSymbolReference()}
            />
          </g>
        );
      })}
    </g>
  );
});

export default BoostAreaView;
