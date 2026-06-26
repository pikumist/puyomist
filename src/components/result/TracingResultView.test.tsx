import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PuyoCoord } from '@/logics/PuyoCoord';
import TracingResultView from './TracingResultView';

describe('TracingResultView', () => {
  it('shows "なし" when there is no last trace', () => {
    render(
      <TracingResultView
        isDamageTwoLine={false}
        hasBoostArea={false}
        tracingCoords={[]}
        lastTraceCoords={undefined}
        chains={undefined}
        animationSteps={[]}
        activeAnimationStepIndex={-1}
      />
    );
    expect(screen.getByText('なし')).toBeInTheDocument();
  });

  it('renders the last trace cell addresses', () => {
    render(
      <TracingResultView
        isDamageTwoLine={false}
        hasBoostArea={false}
        tracingCoords={[]}
        lastTraceCoords={[
          PuyoCoord.xyToCoord(0, 0)!,
          PuyoCoord.xyToCoord(1, 0)!
        ]}
        chains={[]}
        animationSteps={[]}
        activeAnimationStepIndex={-1}
      />
    );
    const expected = [
      PuyoCoord.xyToCoord(0, 0)!.toCellAddr(),
      PuyoCoord.xyToCoord(1, 0)!.toCellAddr()
    ].join(',');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('shows boost / puyotsukai counts when a boost area is active', () => {
    render(
      <TracingResultView
        isDamageTwoLine={false}
        hasBoostArea
        tracingCoords={[]}
        lastTraceCoords={[]}
        chains={[]}
        animationSteps={[]}
        activeAnimationStepIndex={-1}
      />
    );
    expect(screen.getByText(/ブーストカウント/)).toBeInTheDocument();
    expect(screen.getByText(/ぷよ使いカウント/)).toBeInTheDocument();
  });
});
