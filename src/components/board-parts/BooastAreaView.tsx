import type React from 'react';
import { useMemo } from 'react';
import type { PuyoCoord } from '../../logics/PuyoCoord';
import { ch, cw, fw, gw, nch } from './logics/measurements';
import { getBoostAreaSymbolReference } from './logics/symbol-reference';

interface BoostAreaProps {
  coordSetList: ReadonlySet<PuyoCoord>[];
}

const calcTransform = (x: number, y: number) =>
  `translate(${fw + x * (cw + gw)} ${fw + nch + gw + y * (ch + gw)})`;

/** ブーストエリア表示 */
const BoostAreaView: React.FC<BoostAreaProps> = (props) => {
  const { coordSetList } = props;

  const coordSet = useMemo(
    () =>
      coordSetList.reduce((m: Set<PuyoCoord>, coordSet) => {
        for (const coord of coordSet) {
          m.add(coord);
        }
        return m;
      }, new Set<PuyoCoord>([])),
    [coordSetList]
  );

  return (
    <g>
      {[...coordSet.keys()].map(({ x, y }) => {
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
};

export default BoostAreaView;
