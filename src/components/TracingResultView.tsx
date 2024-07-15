import { Box, type BoxProps, Text } from '@chakra-ui/react';
import React from 'react';
import type { Chain } from '../logics/Chain';
import { PuyoAttribute } from '../logics/PuyoAttribute';
import type { PuyoCoord } from '../logics/PuyoCoord';
import { Simulator } from '../logics/Simulator';
import DamageDetail from './DamageDetail';

interface IProps extends BoxProps {
  hasBoostArea: boolean;
  tracingCoords: PuyoCoord[];
  lastTraceCoords: PuyoCoord[] | undefined;
  chains: Chain[];
}

/** なぞり消し結果ビュー */
const TracingResultView: React.FC<IProps> = React.memo((props) => {
  const { hasBoostArea, tracingCoords, lastTraceCoords, chains, ...rest } =
    props;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');
  const lastCoords = lastTraceCoords?.map((c) => c.toCellAddr()).join(',');
  const boostCount = chains ? Simulator.calcTotalBoostCount(chains) : '';
  const puyoTsukaiCount = chains
    ? Simulator.calcTotalPuyoTsukaiCount(chains)
    : '';

  return (
    <Box {...rest}>
      <Text>現在なぞり: {coords}</Text>
      <Text>最後のなぞり: {lastCoords}</Text>
      <Text hidden={!hasBoostArea}>ブーストカウント: {boostCount}</Text>
      <Text hidden={!hasBoostArea}>ぷよ使いカウント: {puyoTsukaiCount}</Text>
      <Box mt="1">
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
    </Box>
  );
});

export default TracingResultView;
