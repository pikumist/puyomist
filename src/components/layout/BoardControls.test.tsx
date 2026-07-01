import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import BoardControls from './BoardControls';

describe('BoardControls', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('renders the board and next-puyo selects', () => {
    render(<BoardControls />);
    expect(screen.getByLabelText('盤面の選択')).toBeInTheDocument();
    expect(screen.getByLabelText('ネクストぷよの選択')).toBeInTheDocument();
  });

  it('changes the board on selection', () => {
    render(<BoardControls />);
    fireEvent.click(screen.getByLabelText('盤面の選択'));
    const option = screen.getByRole('option', { name: 'なつアマ/1' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().boardId).toBe('specialRule4/1');
  });

  it('changes the next puyo selection', () => {
    // Pick a non-custom board so the next-puyo select is enabled.
    usePuyoAppStore.setState({ boardId: 'specialRule4/1' });
    render(<BoardControls />);
    fireEvent.click(screen.getByLabelText('ネクストぷよの選択'));
    const option = screen.getByRole('option', { name: '赤' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().nextSelection).toBe('red');
  });
});
