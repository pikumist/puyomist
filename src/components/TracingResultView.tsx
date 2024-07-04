import type React from 'react';
import { Field } from '../logics/Field';
import type { PuyoCoord } from '../logics/PuyoCoord';
import type { ChainDamage } from '../logics/damage';
import { PuyoAttribute } from '../logics/puyo';
import DamageDetail from './DamageDetail';

type IProps = {
  tracingCoords: PuyoCoord[];
  chainDamages: ChainDamage[];
};

/** なぞり消し結果View */
const TracingResultView: React.FC<IProps> = (props) => {
  const { tracingCoords, chainDamages } = props;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');
  const puyoTsukaiCount = chainDamages
    ? Field.calcTotalPuyoTsukaiCount(chainDamages)
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
        <DamageDetail key={attr} attr={attr} chainDamages={chainDamages} />
      ))}
    </>
  );
};

export default TracingResultView;
