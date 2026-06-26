import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Label } from './label';

describe('Label', () => {
  it('renders as a native label element', () => {
    render(<Label>Minimum puyo</Label>);
    const label = screen.getByText('Minimum puyo');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('data-slot', 'label');
  });

  it('associates with a control via htmlFor', () => {
    render(<Label htmlFor="x">Trace</Label>);
    expect(screen.getByText('Trace')).toHaveAttribute('for', 'x');
  });
});
