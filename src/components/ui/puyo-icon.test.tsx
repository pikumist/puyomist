import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PuyoAttr } from '@/logics/PuyoAttr';
import { PuyoType } from '@/logics/PuyoType';
import { PuyoIcon } from './puyo-icon';

describe('PuyoIcon', () => {
  it('renders an svg sprite reference for an attribute', () => {
    const { container } = render(<PuyoIcon attr={PuyoAttr.Red} />);
    const use = container.querySelector('use');
    expect(use?.getAttribute('xlink:href')).toContain('#red');
  });

  it('applies the requested size to the svg', () => {
    const { container } = render(<PuyoIcon attr={PuyoAttr.Blue} size={40} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '40');
  });

  it('overlays the chance mark for chance puyo types', () => {
    const { container } = render(<PuyoIcon type={PuyoType.RedChance} />);
    const uses = Array.from(container.querySelectorAll('use')).map((u) =>
      u.getAttribute('xlink:href')
    );
    expect(uses.some((href) => href?.includes('#chance'))).toBe(true);
  });

  it('falls back to the padding attribute when neither type nor attr is given', () => {
    const { container } = render(<PuyoIcon />);
    const use = container.querySelector('use');
    expect(use?.getAttribute('xlink:href')).toContain('#padding');
  });
});
