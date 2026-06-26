import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EnumSelect } from './EnumSelect';

const items = [
  [1, 'One'],
  [2, 'Two']
] as ReadonlyArray<readonly [number, string]>;

describe('EnumSelect', () => {
  it('shows the label for the current value', () => {
    render(
      <EnumSelect<number>
        ariaLabel="number"
        value={1}
        items={items}
        onValueChange={() => {}}
      />
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('One');
  });

  it('renders all options when opened', () => {
    render(
      <EnumSelect<number>
        ariaLabel="number"
        value={1}
        items={items}
        onValueChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'One' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Two' })).toBeInTheDocument();
  });

  it('falls back to the placeholder when the value is not in items', () => {
    render(
      <EnumSelect<number>
        ariaLabel="number"
        value={99}
        items={items}
        placeholder="未選択"
        onValueChange={() => {}}
      />
    );
    expect(screen.getByRole('combobox')).toHaveTextContent('未選択');
  });
});
