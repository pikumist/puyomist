import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  HowToEditBoard,
  howToEditBoardDescriptionMap
} from '@/logics/BoardEditMode';
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

  it('defaults the mode select to ClearEnhance when no boardEditMode is set', () => {
    render(<BoardEditPopover isBoardEditing={false} boardEditMode={undefined} />);
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    expect(screen.getByLabelText('編集モードの選択')).toHaveTextContent(
      howToEditBoardDescriptionMap.get(HowToEditBoard.ClearEnhance)!
    );
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

  it('changes the edit mode from the mode select', () => {
    render(
      <BoardEditPopover
        isBoardEditing={false}
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.click(screen.getByLabelText('編集モードの選択'));
    const option = screen.getByRole('option', { name: '任意のぷよに変換' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);
    expect(usePuyoAppStore.getState().boardEditMode?.howToEdit).toBe(
      HowToEditBoard.ToCustomType
    );
  });

  it('sets the custom type when a puyo type is picked', () => {
    render(
      <BoardEditPopover
        isBoardEditing={false}
        boardEditMode={{
          howToEdit: HowToEditBoard.ToCustomType,
          customType: undefined
        }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.click(screen.getAllByRole('radio')[0]);
    expect(usePuyoAppStore.getState().boardEditMode?.customType).toBe(
      PuyoType.Red
    );
  });

  it('clears the custom type when the empty option is picked', () => {
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
    fireEvent.click(screen.getByRole('radio', { name: '空' }));
    expect(usePuyoAppStore.getState().boardEditMode?.customType).toBeUndefined();
  });
});
