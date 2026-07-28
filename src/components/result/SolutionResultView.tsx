import { SettingsIcon } from 'lucide-react';
import React, { useMemo } from 'react';

import { NumberStepper } from '@/components/controls/NumberStepper';
import PlusAssignPrioritySetting from '@/components/panels/PlusAssignPrioritySetting';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { PuyoIcon } from '@/components/ui/puyo-icon';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  ExplorationCategory,
  explorationCategoryDescriptionMap
} from '@/logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '@/logics/PuyoAttr';
import { Simulator } from '@/logics/Simulator';
import { formatDuration } from '@/logics/datetime';
import { plusAssignMaxNumLimit } from '@/logics/plus-assign';
import type { SolveResult } from '@/logics/solution';
import {
  plusAssignApplied,
  plusAssignSettingsChanged,
  plusAssignUndone,
  usePuyoAppState
} from '@/store/puyoAppStore';
import {
  selectPlusAssignPlan,
  selectPlusAssignUndoAvailable
} from '@/store/selectors';
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

    const state = usePuyoAppState();
    const {
      enabled: plusAssignEnabled,
      num: plusAssignNum,
      priorities: plusAssignPriorities,
      color: plusAssignColor
    } = state.plusAssignSettings;
    const plusAssignPlan = selectPlusAssignPlan(state);
    const plusAssignUndoAvailable = selectPlusAssignUndoAvailable(state);

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

    const isDamage =
      result.explorationTarget.category === ExplorationCategory.Damage;
    const formatValue = (value: number) => value.toFixed(isDamage ? 2 : 0);

    const undoButton = plusAssignUndoAvailable ? (
      <Button variant="ghost" onClick={() => plusAssignUndone()}>
        取り消し
      </Button>
    ) : null;

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

        {/* プラス付与案。選択中の解に対して「どのマスをプラスにすると値が伸びるか」を
            盤面に重ねる。探索ではなく厳密計算なので、切り替えるだけで即座に出る。 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <div className="flex items-center gap-1.5">
            <Switch
              aria-label="プラス付与案"
              checked={plusAssignEnabled}
              onCheckedChange={(checked) =>
                plusAssignSettingsChanged({ enabled: checked })
              }
            />
            <span>プラス付与案</span>
          </div>
          {/* 下の行の歯車と右端を揃える */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">個数</span>
            <NumberStepper
              ariaLabel="プラス付与数"
              value={plusAssignNum}
              min={1}
              max={plusAssignMaxNumLimit}
              disabled={!plusAssignEnabled}
              onChange={(v) => plusAssignSettingsChanged({ num: v })}
            />
          </div>
        </div>

        {plusAssignEnabled ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            {plusAssignPlan ? (
              <>
                <span>
                  <span className="num">
                    {formatValue(plusAssignPlan.baseValue)}
                  </span>
                  {' → '}
                  <span className="num">
                    {formatValue(plusAssignPlan.value)}
                  </span>{' '}
                  <span className="text-primary">
                    (+
                    <span className="num">
                      {formatValue(
                        plusAssignPlan.value - plusAssignPlan.baseValue
                      )}
                    </span>
                    )
                  </span>
                </span>
                <Button
                  variant="outline"
                  onClick={() => plusAssignApplied(plusAssignPlan.coords)}
                >
                  適用
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">
                プラスを付けられるマスがありません
              </span>
            )}
            {undoButton}
            {/* 並べ替えリストは縦に伸びるので、結果パネルを圧迫しないよう畳んでおく */}
            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="ml-auto"
                    aria-label="プラス付与案の優先度"
                  />
                }
              >
                <SettingsIcon />
              </PopoverTrigger>
              <PopoverContent className="w-72">
                <PlusAssignPrioritySetting
                  priorities={plusAssignPriorities}
                  color={plusAssignColor}
                />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

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
