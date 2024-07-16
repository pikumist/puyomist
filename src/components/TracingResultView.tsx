import { Box, type BoxProps, Text } from '@chakra-ui/react';
import React from 'react';
import type { AnimationStep } from '../logics/AnimationStep';
import type { Chain } from '../logics/Chain';
import { PuyoAttribute } from '../logics/PuyoAttribute';
import type { PuyoCoord } from '../logics/PuyoCoord';
import { Simulator } from '../logics/Simulator';
import DamageDetail from './DamageDetail';
import AnimationStepSlider from './settings/AnimationStepSlider';

interface IProps extends BoxProps {
  isDamageTwoLine: boolean;
  hasBoostArea: boolean;
  tracingCoords: PuyoCoord[];
  lastTraceCoords: PuyoCoord[] | undefined;
  chains: Chain[];
  animationSteps: AnimationStep[];
  activeAnimationStepIndex: number;
}

/** なぞり消し結果ビュー */
const TracingResultView: React.FC<IProps> = React.memo((props) => {
  const {
    isDamageTwoLine,
    hasBoostArea,
    tracingCoords,
    lastTraceCoords,
    chains,
    animationSteps,
    activeAnimationStepIndex,
    ...rest
  } = props;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');
  const lastCoords = lastTraceCoords?.map((c) => c.toCellAddr()).join(',');
  const boostCount = chains ? Simulator.calcTotalBoostCount(chains) : '';
  const puyoTsukaiCount = chains
    ? Simulator.calcTotalPuyoTsukaiCount(chains)
    : '';

  return (
    <Box {...rest}>
      <AnimationStepSlider
        animationSteps={animationSteps}
        index={activeAnimationStepIndex}
      />
      <Box>
        <Text>&nbsp;{coords || ''}</Text>
      </Box>
      <Box>
        <Text>最後のなぞり:</Text>
        <Text>&nbsp;{lastCoords || 'なし'}</Text>
      </Box>
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
          <DamageDetail
            key={attr}
            isTwoLine={isDamageTwoLine}
            attr={attr}
            chains={chains}
          />
        ))}
      </Box>
    </Box>
  );
});

export default TracingResultView;
