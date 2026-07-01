import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DragHandle } from './SortableItem';

describe('DragHandle', () => {
  it('renders without crashing outside of a SortableItem provider', () => {
    render(<DragHandle />);
    const button = screen.getByLabelText('ドラッグして並べ替え');
    // Falls back to the context's no-op ref/listeners; clicking must not throw.
    fireEvent.pointerDown(button);
    expect(button).toBeInTheDocument();
  });
});
