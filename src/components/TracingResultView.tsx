import { Box, type BoxProps, HStack, Text } from '@chakra-ui/react';
import React from 'react';
import type { AnimationStep } from '../logics/AnimationStep';
import type { Chain } from '../logics/Chain';
import { PuyoAttr } from '../logics/PuyoAttr';
import type { PuyoCoord } from '../logics/PuyoCoord';
import { Simulator } from '../logics/Simulator';
import DamageDetail from './DamageDetail';
import AnimationStepSlider from './settings/AnimationStepSlider';

interface IProps extends BoxProps {
  keepSliderArea?: boolean;
  isDamageTwoLine: boolean;
  hasBoostArea: boolean;
  tracingCoords: PuyoCoord[];
  lastTraceCoords: PuyoCoord[] | undefined;
  chains: Chain[] | undefined;
  animationSteps: AnimationStep[];
  activeAnimationStepIndex: number;
}

const emptyChains: Chain[] = [];

/** なぞり消し結果ビュー */
const TracingResultView: React.FC<IProps> = React.memo((props) => {
  const {
    keepSliderArea,
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
      {keepSliderArea || animationSteps?.length > 0 ? (
        <AnimationStepSlider
          animationSteps={animationSteps}
          index={activeAnimationStepIndex}
        />
      ) : null}
      <Box>
        <Text>現在のなぞり: {coords || 'なし'}</Text>
      </Box>
      <Box>
        <Text>最後のなぞり: {lastCoords || 'なし'}</Text>
      </Box>
      <Text hidden={!hasBoostArea}>ブーストカウント: {boostCount}</Text>
      <Text hidden={!hasBoostArea}>ぷよ使いカウント: {puyoTsukaiCount}</Text>
      <Box mt="1">
        {[
          PuyoAttr.Red,
          PuyoAttr.Blue,
          PuyoAttr.Green,
          PuyoAttr.Yellow,
          PuyoAttr.Purple
        ].map((attr) => (
          <DamageDetail
            key={attr}
            isTwoLine={isDamageTwoLine}
            attr={attr}
            chains={chains ?? emptyChains}
          />
        ))}
      </Box>
    </Box>
  );
});

export default TracingResultView;
