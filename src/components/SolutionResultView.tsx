import { Box, HStack, Text } from '@chakra-ui/react';
import React from 'react';
import {
  ExplorationCategory,
  getExplorationCategoryDescription
} from '../logics/ExplorationTarget';
import {
  type ColoredPuyoAttribute,
  getPuyoAttributeName
} from '../logics/PuyoAttribute';
import { Simulator } from '../logics/Simulator';
import type { ExplorationResult } from '../logics/solution';
import PuyoIcon from './PuyoIcon';

interface SolutionResultViewProps {
  /** 解 */
  result: ExplorationResult | undefined;
}

/** 探索結果ビュー */
const SolutionResultView: React.FC<SolutionResultViewProps> = React.memo(
  (props) => {
    const { result } = props;

    return (
      <>
        {result ? (
          <Box>
            <Text>
              探索対象:{' '}
              {getExplorationCategoryDescription(
                result?.explorationTarget.category
              )}
            </Text>
            <Text>探索時間: {result?.elapsedTime} ms</Text>
            <Text>候補数: {result?.candidatesNum}</Text>
            <Text>
              最適なぞり:{' '}
              {result?.optimalSolution?.traceCoords
                .map((c) => c.toCellAddr())
                .join(',')}
            </Text>
            <Text>
              <OptimalValue
                category={result?.explorationTarget?.category}
                optimalValue={result?.optimalSolution?.value}
              />
              {Simulator.colorAttrs.map((attr) => (
                <HStack key={attr} spacing="1">
                  <PuyoIcon
                    position="relative"
                    top="1px"
                    size={18}
                    attr={attr}
                  />
                  <Text>
                    {getPuyoAttributeName(attr)}:{' '}
                    {result?.optimalSolution?.totalDamages[
                      attr as ColoredPuyoAttribute
                    ]?.toFixed(2)}
                  </Text>
                </HStack>
              ))}
            </Text>
          </Box>
        ) : null}
      </>
    );
  }
);

const OptimalValue: React.FC<{
  category: ExplorationCategory | undefined;
  optimalValue: number | undefined;
}> = (props) => {
  const { category, optimalValue } = props;

  switch (category) {
    case ExplorationCategory.Damage:
      return <Text>対象のダメージ量: {optimalValue?.toFixed(2)}</Text>;
    case ExplorationCategory.SkillPuyoCount:
      return <Text>スキル溜めぷよ数: {optimalValue}</Text>;
    case ExplorationCategory.PuyotsukaiCount:
      return <Text>ぷよ使いカウント: {optimalValue}</Text>;
    default:
      return <Text>最適値: </Text>;
  }
};

export default SolutionResultView;
