import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectSeparator,
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

function GroupedFixture() {
  return (
    <Select defaultValue="red">
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Pick" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectGroupLabel>Warm colors</SelectGroupLabel>
          <SelectItem value="red">Red</SelectItem>
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectGroupLabel>Cool colors</SelectGroupLabel>
          <SelectItem value="blue">Blue</SelectItem>
        </SelectGroup>
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

  it('renders grouped options with labels and a separator', () => {
    render(<GroupedFixture />);
    fireEvent.click(screen.getByRole('combobox'));
    const warmLabel = screen.getByText('Warm colors');
    expect(warmLabel).toHaveAttribute('data-slot', 'select-group-label');
    expect(warmLabel).toHaveClass('px-2', 'py-1.5', 'text-xs', 'text-muted-foreground');
    expect(screen.getByText('Cool colors')).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="select-separator"]')
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Red' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Blue' })).toBeInTheDocument();
  });
});
