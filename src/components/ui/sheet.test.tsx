import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from './sheet';

function Fixture() {
  return (
    <Sheet>
      <SheetTrigger render={<Button>Settings</Button>} />
      <SheetContent side="bottom">
        <SheetTitle>Field settings</SheetTitle>
        <SheetDescription>Adjust the field.</SheetDescription>
      </SheetContent>
    </Sheet>
  );
}

function FixtureWithClose() {
  return (
    <Sheet>
      <SheetTrigger render={<Button>Settings</Button>} />
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Field settings</SheetTitle>
        </SheetHeader>
        <SheetFooter>
          <SheetClose render={<Button>Done</Button>} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

describe('Sheet', () => {
  it('is closed initially', () => {
    render(<Fixture />);
    expect(screen.queryByText('Field settings')).not.toBeInTheDocument();
  });

  it('opens from the trigger', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Field settings')).toBeInTheDocument();
  });

  it('renders a SheetHeader and SheetFooter with their data-slots and layout classes', () => {
    render(<FixtureWithClose />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const title = screen.getByText('Field settings');
    const header = title.parentElement;
    expect(header).toHaveAttribute('data-slot', 'sheet-header');
    expect(header).toHaveClass('flex', 'flex-col', 'gap-1.5', 'p-4');

    const doneButton = screen.getByRole('button', { name: 'Done' });
    const footer = doneButton.closest('[data-slot="sheet-footer"]');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('mt-auto', 'flex', 'flex-col', 'gap-2', 'p-4');
  });

  it('closes the sheet when SheetClose is clicked', () => {
    render(<FixtureWithClose />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByText('Field settings')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Field settings')).not.toBeInTheDocument();
  });
});
