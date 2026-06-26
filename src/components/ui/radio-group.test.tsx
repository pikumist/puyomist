import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RadioGroup, RadioGroupItem } from './radio-group';

function Fixture({
  onValueChange
}: {
  onValueChange?: (value: unknown) => void;
}) {
  return (
    <RadioGroup defaultValue="a" onValueChange={onValueChange}>
      <RadioGroupItem value="a" aria-label="a" />
      <RadioGroupItem value="b" aria-label="b" />
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('renders all radio items', () => {
    render(<Fixture />);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('marks the default value as checked', () => {
    render(<Fixture />);
    expect(screen.getByRole('radio', { name: 'a' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('changes selection on click', () => {
    const onValueChange = vi.fn();
    render(<Fixture onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'b' }));
    expect(onValueChange).toHaveBeenCalledWith('b', expect.anything());
  });
});
