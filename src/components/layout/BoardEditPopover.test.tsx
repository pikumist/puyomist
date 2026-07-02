import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HowToEditBoard,
  howToEditBoardDescriptionMap
} from '@/logics/BoardEditMode';
import { PuyoType } from '@/logics/PuyoType';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import BoardEditPopover from './BoardEditPopover';

/** matchMedia を指定の matches 値で差し替える(useMediaQuery 制御用)。 */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      }) as MediaQueryList
  );
}

describe('BoardEditPopover', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    // 既定は狭い画面(モバイル)相当。
    mockMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enters board editing when the popover opens', () => {
    render(
      <BoardEditPopover
        isBoardEditing={false}
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
  });

  it('defaults the mode select to ClearEnhance when no boardEditMode is set', () => {
    render(<BoardEditPopover isBoardEditing={false} boardEditMode={undefined} />);
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    expect(screen.getByLabelText('編集モードの選択')).toHaveTextContent(
      howToEditBoardDescriptionMap.get(HowToEditBoard.ClearEnhance)!
    );
  });

  it('ends board editing and closes the popover on any screen', () => {
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
    // ポップアップも閉じる。
    expect(
      screen.queryByLabelText('編集モードの選択')
    ).not.toBeInTheDocument();
  });

  it('ends board editing and closes the popover on wide screens too', () => {
    mockMatchMedia(true);
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
    expect(
      screen.queryByLabelText('編集モードの選択')
    ).not.toBeInTheDocument();
  });

  it('disables the end button when not editing', () => {
    render(
      <BoardEditPopover
        isBoardEditing={false}
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    expect(screen.getByText('編集終了')).toBeDisabled();
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

  it('changes the edit mode from the mode select and starts editing', () => {
    usePuyoAppStore.setState({ isBoardEditing: false });
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
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
  });

  it('sets the custom type when a puyo type is picked and starts editing', () => {
    usePuyoAppStore.setState({ isBoardEditing: false });
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
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
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

  it('closing via the × button ends editing on wide screens', () => {
    mockMatchMedia(true);
    usePuyoAppStore.setState({ isBoardEditing: true });
    render(
      <BoardEditPopover
        isBoardEditing
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.click(screen.getByLabelText('閉じる'));
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(false);
  });

  it('keeps the popover open on outside press on wide screens', () => {
    mockMatchMedia(true);
    usePuyoAppStore.setState({ isBoardEditing: true });
    render(
      <BoardEditPopover
        isBoardEditing
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    // 盤面側(ポップアップ外)をクリックしても閉じない。
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
    expect(screen.getByLabelText('編集モードの選択')).toBeInTheDocument();
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
  });

  it('keeps the popover open on trigger re-press on wide screens', () => {
    mockMatchMedia(true);
    usePuyoAppStore.setState({ isBoardEditing: true });
    render(
      <BoardEditPopover
        isBoardEditing
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    const trigger = screen.getByLabelText('盤面を編集');
    fireEvent.click(trigger);
    // 鉛筆ボタンの再クリックでは閉じない(× または ESC のみ)。
    fireEvent.click(trigger);
    expect(screen.getByLabelText('編集モードの選択')).toBeInTheDocument();
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
  });

  it('closes and ends editing on Escape on wide screens', () => {
    mockMatchMedia(true);
    usePuyoAppStore.setState({ isBoardEditing: true });
    render(
      <BoardEditPopover
        isBoardEditing
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.keyDown(screen.getByLabelText('編集モードの選択'), {
      key: 'Escape'
    });
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(false);
  });

  it('closing via the × button keeps editing on narrow screens', () => {
    mockMatchMedia(false);
    usePuyoAppStore.setState({ isBoardEditing: true });
    render(
      <BoardEditPopover
        isBoardEditing
        boardEditMode={{ howToEdit: HowToEditBoard.ClearEnhance }}
      />
    );
    fireEvent.click(screen.getByLabelText('盤面を編集'));
    fireEvent.click(screen.getByLabelText('閉じる'));
    // モバイルでは編集モードを保持したまま閉じられる。
    expect(usePuyoAppStore.getState().isBoardEditing).toBe(true);
  });
});
