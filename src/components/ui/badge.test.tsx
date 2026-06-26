import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from './badge';

describe('Badge', () => {
  it('renders its content', () => {
    render(<Badge>5 chains</Badge>);
    expect(screen.getByText('5 chains')).toBeInTheDocument();
  });

  it('marks itself with a badge slot', () => {
    render(<Badge>x</Badge>);
    expect(screen.getByText('x')).toHaveAttribute('data-slot', 'badge');
  });

  it('can render as a custom element via render prop', () => {
    render(<Badge render={<a href="/x">link</a>}>link</Badge>);
    expect(screen.getByRole('link', { name: 'link' })).toBeInTheDocument();
  });
});
