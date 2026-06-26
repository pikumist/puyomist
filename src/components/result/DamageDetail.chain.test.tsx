import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Chain } from '@/logics/Chain';
import { PuyoAttr } from '@/logics/PuyoAttr';
import DamageDetail from './DamageDetail';

const chainWithRed = (): Chain => ({
  chain_num: 2,
  simultaneous_num: 4,
  boost_count: 0,
  puyo_tsukai_count: 0,
  popped_chance_num: 0,
  is_all_cleared: false,
  attributes: {
    [PuyoAttr.Red]: {
      strength: 1.5,
      popped_count: 4,
      separated_blocks_num: 1
    }
  }
});

describe('DamageDetail with chains', () => {
  it('renders popped counts and the chain-block-simultaneous list', () => {
    render(
      <DamageDetail attr={PuyoAttr.Red} chains={[chainWithRed()]} isTwoLine={false} />
    );
    expect(screen.getByText('(4個)')).toBeInTheDocument();
    // chain_num - separated_blocks_num - simultaneous_num
    expect(screen.getByText(/2-1-4/)).toBeInTheDocument();
  });

  it('renders the breakdown on a second line when isTwoLine', () => {
    const { container } = render(
      <DamageDetail attr={PuyoAttr.Red} chains={[chainWithRed()]} isTwoLine />
    );
    expect(container.textContent).toContain('2-1-4');
  });
});
