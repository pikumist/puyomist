import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from './tooltip';

describe('Tooltip', () => {
  it('renders the trigger and keeps content hidden by default', () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<Button>Hover</Button>} />
          <TooltipContent>tooltip-body</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(screen.getByRole('button', { name: 'Hover' })).toBeInTheDocument();
    expect(screen.queryByText('tooltip-body')).not.toBeInTheDocument();
  });
});
