import React, { useMemo } from 'react';

import { PuyoIcon } from '@/components/ui/puyo-icon';
import { cn } from '@/lib/utils';
import { explorationCategoryDescriptionMap } from '@/logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '@/logics/PuyoAttr';
import { Simulator } from '@/logics/Simulator';
import { formatDuration } from '@/logics/datetime';
import type { SolveResult } from '@/logics/solution';
import OptimalSolutionSelector from './OptimalSolutionSelector';

interface SolutionResultViewProps {
  /** solve result. */
  result: SolveResult | undefined;
  /** Selected solution index. */
  index: number;
  /** Whether the computation is still in progress (parallel mode only). */
  isInProgress: boolean;
  className?: string;
}

/** Exploration result view. */
const SolutionResultView: React.FC<SolutionResultViewProps> = React.memo(
  (props) => {
    const { result, index, isInProgress, className } = props;

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

    if (!result) {
      return null;
    }

    const elapsedTime = result.elapsedTime
      ? formatDuration(result.elapsedTime)
      : '';

    return (
      <div className={cn('space-y-1', className)}>
        <div>
          探索対象:{' '}
          {explorationCategoryDescriptionMap.get(
            result.explorationTarget.category
          )}
        </div>
        <OptimalSolutionSelector result={result} index={index} />
        <div>
          探索時間: <span className="num">{elapsedTime}</span>
          {isInProgress ? ' ...' : ''}
        </div>
        <div>
          候補数
          {isInProgress ? (
            <span className="text-xs text-primary">(推定)</span>
          ) : null}
          : <span className="num">{result.candidates_num}</span>
        </div>
        <div>
          {coloredPuyoAttrList.map((attr) => (
            <div key={attr} className="flex items-center gap-1">
              <PuyoIcon className="relative top-px" size={18} attr={attr} />
              <span>
                {getPuyoAttrName(attr)}:{' '}
                <span className="num">
                  {totalDamageMap?.get(attr as ColoredPuyoAttr)?.toFixed(2)}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);

export default SolutionResultView;
