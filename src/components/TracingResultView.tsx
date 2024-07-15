import { Box, Text } from '@chakra-ui/react';
import React from 'react';
import type { Chain } from '../logics/Chain';
import { PuyoAttribute } from '../logics/PuyoAttribute';
import type { PuyoCoord } from '../logics/PuyoCoord';
import { Simulator } from '../logics/Simulator';
import DamageDetail from './DamageDetail';

interface IProps {
  tracingCoords: PuyoCoord[];
  lastTraceCoords: PuyoCoord[] | undefined;
  chains: Chain[];
}

/** なぞり消し結果ビュー */
const TracingResultView: React.FC<IProps> = React.memo((props) => {
  const { tracingCoords, lastTraceCoords, chains } = props;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');
  const lastCoords = lastTraceCoords?.map((c) => c.toCellAddr()).join(',');
  const boostCount = chains ? Simulator.calcTotalBoostCount(chains) : '';
  const puyoTsukaiCount = chains
    ? Simulator.calcTotalPuyoTsukaiCount(chains)
    : '';

  return (
    <Box>
      <Text>現在なぞり: {coords}</Text>
      <Text>最後のなぞり: {lastCoords}</Text>
      <Text>ブーストカウント: {boostCount}</Text>
      <Text>ぷよ使いカウント: {puyoTsukaiCount}</Text>
      {[
        PuyoAttribute.Red,
        PuyoAttribute.Blue,
        PuyoAttribute.Green,
        PuyoAttribute.Yellow,
        PuyoAttribute.Purple
      ].map((attr) => (
        <DamageDetail key={attr} attr={attr} chains={chains} />
      ))}
    </Box>
  );
});

export default TracingResultView;
