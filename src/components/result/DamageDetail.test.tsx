import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PuyoAttr } from '@/logics/PuyoAttr';
import DamageDetail from './DamageDetail';

describe('DamageDetail', () => {
  it('renders zero damage with no chains', () => {
    render(<DamageDetail attr={PuyoAttr.Red} chains={[]} isTwoLine={false} />);
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getByText('(0個)')).toBeInTheDocument();
  });

  it('renders a puyo icon sprite reference', () => {
    const { container } = render(
      <DamageDetail attr={PuyoAttr.Blue} chains={[]} isTwoLine />
    );
    const use = container.querySelector('use');
    expect(use?.getAttribute('xlink:href')).toContain('#blue');
  });
});
