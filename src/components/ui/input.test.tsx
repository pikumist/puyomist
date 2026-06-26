import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './input';

describe('Input', () => {
  it('renders with a placeholder', () => {
    render(<Input placeholder="min puyo" />);
    expect(screen.getByPlaceholderText('min puyo')).toBeInTheDocument();
  });

  it('reflects typed value when controlled via onValueChange', () => {
    const onValueChange = vi.fn();
    render(<Input value="" onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '42' }
    });
    expect(onValueChange).toHaveBeenCalled();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
