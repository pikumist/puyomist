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
import type { SolveResult } from '../logics/solution';
import { optimalSolutionIndexChanged } from '../reducers/puyoAppSlice';
import PuyoIcon from './PuyoIcon';

interface SolutionResultViewProps {
  /** solve関数の結果 */
  result: SolveResult | undefined;
  /** 解のインデックス */
  index: number;
}

/** 探索結果ビュー */
const SolutionResultView: React.FC<SolutionResultViewProps> = React.memo(
  (props) => {
    const { result, index } = props;
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
            <Text>探索時間: {result?.elapsedTime} ms</Text>
            <Text>候補数: {result?.candidates_num}</Text>
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
