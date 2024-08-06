import { Box, HStack, Select, Text } from '@chakra-ui/react';
import React, { useMemo } from 'react';
import { useDispatch } from 'react-redux';
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
import { formatDuration } from '../logics/datetime';
import type { SolveResult } from '../logics/solution';
import { optimalSolutionIndexChanged } from '../reducers/puyoAppSlice';
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
    const dispatch = useDispatch();

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

    const onIndexChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        optimalSolutionIndexChanged(Number.parseInt(e.target.value, 10))
      );
    };

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
            <HStack>
              <Select
                aria-label="解の選択"
                value={index}
                onChange={onIndexChanged}
              >
                {[...result.optimal_solutions.entries()].map(
                  ([i, solutionResult]) => {
                    const cellAddrs = solutionResult.trace_coords
                      .map((coord) => coord.toCellAddr())
                      .join(',');
                    const value = solutionResult.value.toFixed(
                      result.explorationTarget.category ===
                        ExplorationCategory.Damage
                        ? 2
                        : 0
                    );
                    return (
                      <option value={i} key={cellAddrs} data-index={i}>
                        {value}&nbsp;(
                        {cellAddrs})
                      </option>
                    );
                  }
                )}
              </Select>
            </HStack>
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
