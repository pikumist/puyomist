import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './select';

function Fixture() {
  return (
    <Select defaultValue="red">
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Pick" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="red">Red</SelectItem>
        <SelectItem value="blue">Blue</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('renders a closed combobox trigger reflecting the value', () => {
    render(<Fixture />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('red');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('opens the listbox of options on trigger click', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'Blue' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Red' })).toBeInTheDocument();
  });
});
