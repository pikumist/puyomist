import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PreferenceKind } from '@/logics/ExplorationTarget';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import PreferencePrioritySetting from './PreferencePrioritySetting';

const priorities = [
  PreferenceKind.BiggerValue,
  PreferenceKind.ChancePop,
  PreferenceKind.PrismPop
];

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

let originalGetBoundingClientRect: () => DOMRect;

describe('PreferencePrioritySetting', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    usePuyoAppStore.setState({
      explorationTarget: {
        ...INITIAL_PUYO_APP_STATE.explorationTarget,
        preference_priorities: priorities
      }
    });

    // jsdom lays out every element at (0, 0), which makes dnd-kit unable to
    // tell rows apart. Stub the rect based on sibling position instead (see
    // sortable/SortableList.test.tsx for the same technique).
    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      const siblings = this.parentElement
        ? Array.from(this.parentElement.children)
        : [];
      const index = siblings.indexOf(this);
      const top = index >= 0 ? index * 60 : 0;
      const height = 50;
      return {
        x: 0,
        y: top,
        width: 200,
        height,
        top,
        left: 0,
        right: 200,
        bottom: top + height,
        toJSON() {
          return {};
        }
      } as DOMRect;
    };
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it('renders one row per priority with its index', () => {
    render(<PreferencePrioritySetting preferencePriorities={priorities} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
  });

  it('hides the add-preference trigger once every base preference is added', () => {
    const allBase = [
      PreferenceKind.BiggerValue,
      PreferenceKind.ChancePop,
      PreferenceKind.PrismPop,
      PreferenceKind.AllClear,
      PreferenceKind.SmallerTraceNum,
      PreferenceKind.HeartPop,
      PreferenceKind.OjamaPop
    ];
    render(<PreferencePrioritySetting preferencePriorities={allBase} />);
    expect(screen.queryByLabelText('優先度を追加')).not.toBeInTheDocument();
  });

  it('adds a preference from the add popover', () => {
    render(<PreferencePrioritySetting preferencePriorities={priorities} />);
    fireEvent.click(screen.getByLabelText('優先度を追加'));
    const options = screen.getAllByRole('button');
    // last buttons in the popover are the addable preferences
    const before =
      usePuyoAppStore.getState().explorationTarget.preference_priorities.length;
    fireEvent.click(options[options.length - 1]);
    expect(
      usePuyoAppStore.getState().explorationTarget.preference_priorities.length
    ).toBe(before + 1);
  });

  it('replaces a preference with a derivative', () => {
    render(<PreferencePrioritySetting preferencePriorities={priorities} />);
    // open the ChancePop item's preference popover (it has derivatives)
    fireEvent.click(screen.getByText('チャンスを含む'));
    const derivative = screen.getByText('チャンスを含まない');
    fireEvent.click(derivative);
    expect(
      usePuyoAppStore
        .getState()
        .explorationTarget.preference_priorities.includes(
          PreferenceKind.NoChancePop
        )
    ).toBe(true);
  });

  it('updates the priority order in the store when reordered', async () => {
    render(<PreferencePrioritySetting preferencePriorities={priorities} />);
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    // Pick up the first row and move it down past the second one.
    fireEvent.keyDown(handles[0], { code: 'Space' });
    await tick();
    fireEvent.keyDown(document, { code: 'ArrowDown' });
    fireEvent.keyDown(document, { code: 'Space' });

    expect(
      usePuyoAppStore.getState().explorationTarget.preference_priorities
    ).toEqual([
      PreferenceKind.ChancePop,
      PreferenceKind.BiggerValue,
      PreferenceKind.PrismPop
    ]);
  });
});
