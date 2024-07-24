import { Box, HStack, Text } from '@chakra-ui/react';
import React, { useMemo } from 'react';
import {
  ExplorationCategory,
  explorationCategoryDescriptionMap
} from '../logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '../logics/PuyoAttr';
import { Simulator } from '../logics/Simulator';
import type { SolveResult } from '../logics/solution';
import PuyoIcon from './PuyoIcon';

interface SolutionResultViewProps {
  /** 解 */
  result: SolveResult | undefined;
}

/** 探索結果ビュー */
const SolutionResultView: React.FC<SolutionResultViewProps> = React.memo(
  (props) => {
    const { result } = props;

    const totalDamageMap = useMemo(() => {
      const solution = result?.optimalSolution;
      if (!solution) {
        return undefined;
      }
      return new Map(
        coloredPuyoAttrList.map((attr) => [
          attr,
          Simulator.calcTotalDamageOfTargetAttr(solution.chains, attr)
        ])
      );
    }, [result?.optimalSolution]);

    return (
      <>
        {result ? (
          <Box>
            <Text>
              探索対象:{' '}
              {explorationCategoryDescriptionMap.get(
                result?.explorationTarget.category
              )}
            </Text>
            <Text>探索時間: {result?.elapsedTime} ms</Text>
            <Text>候補数: {result?.candidatesNum}</Text>
            <Text>
              最適なぞり:{' '}
              {result?.optimalSolution?.trace_coords
                .map((c) => c.toCellAddr())
                .join(',')}
            </Text>
            <Text>
              <OptimalValue
                category={result?.explorationTarget?.category}
                optimalValue={result?.optimalSolution?.value}
              />
              {coloredPuyoAttrList.map((attr) => (
                <HStack key={attr} spacing="1">
                  <PuyoIcon
                    position="relative"
                    top="1px"
                    size={18}
                    attr={attr}
                  />
                  <Text>
                    {getPuyoAttrName(attr)}:{' '}
                    {totalDamageMap?.get(attr as ColoredPuyoAttr)?.toFixed(2)}
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
