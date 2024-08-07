import { Box, HStack, Text } from '@chakra-ui/react';
import React, { useMemo } from 'react';
import { explorationCategoryDescriptionMap } from '../logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '../logics/PuyoAttr';
import { Simulator } from '../logics/Simulator';
import { formatDuration } from '../logics/datetime';
import type { SolveResult } from '../logics/solution';
import OptimalSolutionSelector from './OptimalSolutionSelector';
import PuyoIcon from './PuyoIcon';

interface SolutionResultViewProps {
  /** solve関数の結果 */
  result: SolveResult | undefined;
  /** 解のインデックス */
  index: number;
  /** 計算が進捗中かどうか (マルチスレッド時のみ) */
  isInProgress: boolean;
}

/** 探索結果ビュー */
const SolutionResultView: React.FC<SolutionResultViewProps> = React.memo(
  (props) => {
    const { result, index, isInProgress } = props;

    const totalDamageMap = useMemo(() => {
      const solution = result?.optimal_solutions[index];
      if (!solution) {
        return undefined;
      }
      return new Map(
        coloredPuyoAttrList.map((attr) => [
          attr,
          Simulator.calcTotalDamageOfTargetAttr(solution.chains, attr)
        ])
      );
    }, [result, index]);

    const elapsedTime = result?.elapsedTime
      ? formatDuration(result?.elapsedTime)
      : '';

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
            <OptimalSolutionSelector result={result} index={index} />
            <Text>
              探索時間: {elapsedTime}
              {isInProgress ? ' ...' : ''}
            </Text>
            <Text>
              候補数
              {isInProgress ? (
                <Text as="span" fontSize="xs" color="blue.200">
                  (推定)
                </Text>
              ) : (
                ''
              )}
              : {result?.candidates_num}
            </Text>
            <Box>
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
            </Box>
          </Box>
        ) : null}
      </>
    );
  }
);

export default SolutionResultView;
