import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
});
