import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renders an unchecked checkbox', () => {
    render(<Checkbox aria-label="opt" />);
    expect(screen.getByRole('checkbox')).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('fires onCheckedChange when toggled', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="opt" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });
});
