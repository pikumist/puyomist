import React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { ExplorationCategory } from '@/logics/ExplorationTarget';
import type { SolutionResult, SolveResult } from '@/logics/solution';
import { optimalSolutionIndexChanged } from '@/store/puyoAppStore';

interface OptimalSolutionSelectorProps {
  /** solve result. */
  result: SolveResult;
  /** Selected solution index. */
  index: number;
}

const formatSolutionValue = (
  category: ExplorationCategory,
  result: SolutionResult
): string =>
  result.value.toFixed(category === ExplorationCategory.Damage ? 2 : 0);

/** Selector over the optimal solutions. */
const OptimalSolutionSelector: React.FC<OptimalSolutionSelectorProps> =
  React.memo((props) => {
    const { result, index } = props;

    const items = [...result.optimal_solutions.entries()].map(
      ([i, solutionResult]) => {
        const cellAddrs = solutionResult.trace_coords
          .map((coord) => coord.toCellAddr())
          .join(',');
        const value = formatSolutionValue(
          result.explorationTarget.category,
          solutionResult
        );
        return [
          i,
          `${i + 1}: ${value} (${cellAddrs})`
        ] as readonly [number, string];
      }
    );

    return (
      <EnumSelect<number>
        ariaLabel="解の選択"
        triggerClassName="w-full"
        value={index}
        items={items}
        onValueChange={(i) => optimalSolutionIndexChanged(i)}
      />
    );
  });

export default OptimalSolutionSelector;
