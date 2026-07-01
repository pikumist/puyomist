import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './dialog';

function Fixture() {
  return (
    <Dialog>
      <DialogTrigger render={<Button>Open</Button>} />
      <DialogContent>
        <DialogTitle>Reset board</DialogTitle>
        <DialogDescription>Are you sure?</DialogDescription>
      </DialogContent>
    </Dialog>
  );
}

function FixtureWithClose() {
  return (
    <Dialog>
      <DialogTrigger render={<Button>Open</Button>} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Reset board</DialogTitle>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <DialogClose render={<Button>Cancel</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('is closed initially', () => {
    render(<Fixture />);
    expect(screen.queryByText('Reset board')).not.toBeInTheDocument();
  });

  it('opens its content when the trigger is clicked', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Reset board')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders a DialogHeader with its data-slot and layout class', () => {
    render(<FixtureWithClose />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const title = screen.getByText('Reset board');
    const header = title.parentElement;
    expect(header).toHaveAttribute('data-slot', 'dialog-header');
    expect(header).toHaveClass('flex', 'flex-col', 'gap-2');
  });

  it('renders a DialogFooter with the extra close button when showCloseButton is set', () => {
    render(<FixtureWithClose />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const footer = screen.getByText('Close').closest('[data-slot="dialog-footer"]');
    expect(footer).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('closes the dialog when DialogClose is clicked', () => {
    render(<FixtureWithClose />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Reset board')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Reset board')).not.toBeInTheDocument();
  });
});
