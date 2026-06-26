import React from 'react';

import { cn } from '@/lib/utils';
import type { AnimationStep } from '@/logics/AnimationStep';
import type { Chain } from '@/logics/Chain';
import { PuyoAttr } from '@/logics/PuyoAttr';
import type { PuyoCoord } from '@/logics/PuyoCoord';
import { Simulator } from '@/logics/Simulator';
import DamageDetail from './DamageDetail';

interface IProps {
  isDamageTwoLine: boolean;
  hasBoostArea: boolean;
  tracingCoords: PuyoCoord[];
  lastTraceCoords: PuyoCoord[] | undefined;
  chains: Chain[] | undefined;
  animationSteps: AnimationStep[];
  activeAnimationStepIndex: number;
  className?: string;
}

const emptyChains: Chain[] = [];

/** Trace result view: last trace + boost/puyotsukai counts + per-colour damage. */
const TracingResultView: React.FC<IProps> = React.memo((props) => {
  const {
    isDamageTwoLine,
    hasBoostArea,
    lastTraceCoords,
    chains,
    className
  } = props;

  const lastCoords = lastTraceCoords?.map((c) => c.toCellAddr()).join(',');
  const boostCount = chains ? Simulator.calcTotalBoostCount(chains) : '';
  const puyoTsukaiCount = chains
    ? Simulator.calcTotalPuyoTsukaiCount(chains)
    : '';

  return (
    <div className={cn(className)}>
      <div>
        <div className="text-muted-foreground">最後のなぞり:</div>
        <div className="num">{lastCoords || 'なし'}</div>
      </div>
      {hasBoostArea ? (
        <div>ブーストカウント: {boostCount}</div>
      ) : null}
      {hasBoostArea ? (
        <div>ぷよ使いカウント: {puyoTsukaiCount}</div>
      ) : null}
      <div className="mt-1">
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
      </div>
    </div>
  );
});

export default TracingResultView;
