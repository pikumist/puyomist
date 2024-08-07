import { Select, type SelectProps } from '@chakra-ui/react';
import React from 'react';
import { useDispatch } from 'react-redux';
import { ExplorationCategory } from '../logics/ExplorationTarget';
import type { SolutionResult, SolveResult } from '../logics/solution';
import { optimalSolutionIndexChanged } from '../reducers/puyoAppSlice';

interface OptimalSolutionSelectorProps extends SelectProps {
  /** solve関数の結果 */
  result: SolveResult;
  /** 解のインデックス */
  index: number;
}

/** 最適解のセレクター */
const OptimalSolutionSelector: React.FC<OptimalSolutionSelectorProps> =
  React.memo((props) => {
    const { result, index, ...rest } = props;
    const dispatch = useDispatch();

    const onIndexChanged = (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        optimalSolutionIndexChanged(Number.parseInt(e.target.value, 10))
      );
    };

    return (
      <Select
        aria-label="解の選択"
        value={index}
        onChange={onIndexChanged}
        {...rest}
      >
        {[...result.optimal_solutions.entries()].map(([i, solutionResult]) => {
          const cellAddrs = solutionResult.trace_coords
            .map((coord) => coord.toCellAddr())
            .join(',');
          const value = getSolutionValue(
            result.explorationTarget.category,
            solutionResult
          );
          return (
            <option value={i} key={cellAddrs} data-index={i}>
              {value}&nbsp;(
              {cellAddrs})
            </option>
          );
        })}
      </Select>
    );
  });

const getSolutionValue = (
  category: ExplorationCategory,
  result: SolutionResult
): string => {
  return result.value.toFixed(category === ExplorationCategory.Damage ? 2 : 0);
};

export default OptimalSolutionSelector;
