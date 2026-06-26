import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PreferenceKind } from '@/logics/ExplorationTarget';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import PreferencePrioritySetting from './PreferencePrioritySetting';

const priorities = [
  PreferenceKind.BiggerValue,
  PreferenceKind.ChancePop,
  PreferenceKind.PrismPop
];

describe('PreferencePrioritySetting', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
    usePuyoAppStore.setState({
      explorationTarget: {
        ...INITIAL_PUYO_APP_STATE.explorationTarget,
        preference_priorities: priorities
      }
    });
  });

  it('renders one row per priority with its index', () => {
    render(<PreferencePrioritySetting preferencePriorities={priorities} />);
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('3.')).toBeInTheDocument();
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
});
