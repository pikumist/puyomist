import type React from 'react';
import type { Chain } from '../logics/Chain';
import { PuyoAttribute } from '../logics/PuyoAttribute';
import type { PuyoCoord } from '../logics/PuyoCoord';
import { Simulator } from '../logics/Simulator';
import DamageDetail from './DamageDetail';

type IProps = {
  tracingCoords: PuyoCoord[];
  chains: Chain[];
};

/** なぞり消し結果View */
const TracingResultView: React.FC<IProps> = (props) => {
  const { tracingCoords, chains } = props;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');
  const puyoTsukaiCount = chains
    ? Simulator.calcTotalPuyoTsukaiCount(chains)
    : '';

  return (
    <>
      <div>現在なぞり: {coords}</div>
      <div>ぷよ使いカウント: {puyoTsukaiCount}</div>
      {[
        PuyoAttribute.Red,
        PuyoAttribute.Blue,
        PuyoAttribute.Green,
        PuyoAttribute.Yellow,
        PuyoAttribute.Purple
      ].map((attr) => (
        <DamageDetail key={attr} attr={attr} chains={chains} />
      ))}
    </>
  );
};

export default TracingResultView;
