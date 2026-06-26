import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScrollArea } from './scroll-area';

describe('ScrollArea', () => {
  it('renders its children inside a viewport', () => {
    render(
      <ScrollArea className="h-20">
        <div>scroll-content</div>
      </ScrollArea>
    );
    expect(screen.getByText('scroll-content')).toBeInTheDocument();
  });

  it('marks the root with a scroll-area slot', () => {
    const { container } = render(
      <ScrollArea>
        <div>x</div>
      </ScrollArea>
    );
    expect(
      container.querySelector('[data-slot="scroll-area"]')
    ).toBeInTheDocument();
  });
});
