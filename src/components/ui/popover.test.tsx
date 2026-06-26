import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

function Fixture() {
  return (
    <Popover>
      <PopoverTrigger render={<Button>Open</Button>} />
      <PopoverContent showArrow={false}>popover-body</PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('is closed initially', () => {
    render(<Fixture />);
    expect(screen.queryByText('popover-body')).not.toBeInTheDocument();
  });

  it('reveals content on trigger click', () => {
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('popover-body')).toBeInTheDocument();
  });
});
