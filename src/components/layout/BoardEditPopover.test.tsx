import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { HowToEditBoard } from '@/logics/BoardEditMode';
import { PuyoType } from '@/logics/PuyoType';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import BoardEditPopover from './BoardEditPopover';

describe('BoardEditPopover', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('starts board editing from the popover', () => {
    render(
      <BoardEditPopover
        isBoardEditing={false}
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.click(screen.getByText('編集開始'));
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
  });

  it('ends board editing when already editing', () => {
    usePuyoAppStore.setState({ isBoardEditing: true });
    render(
      <BoardEditPopover
        isBoardEditing
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.click(screen.getByText('編集終了'));
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(false);
  });

  it('renders the custom-type picker for ToCustomType mode', () => {
    render(
      <BoardEditPopover
        isBoardEditing={false}
        boardEditMode={{
          howToEdit: HowToEditBoard.ToCustomType,
          customType: PuyoType.Red
        }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    expect(screen.getByText('空')).toBeInTheDocument();
    expect(screen.getAllByRole('radio').length).toBeGreaterThan(1);
  });
});
