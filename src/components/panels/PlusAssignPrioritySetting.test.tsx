import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PuyoAttr } from '@/logics/PuyoAttr';
import { PlusPreferenceKind } from '@/logics/plus-assign';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import PlusAssignPrioritySetting from './PlusAssignPrioritySetting';

const renderSetting = () => {
  const { priorities, color } = usePuyoAppStore.getState().plusAssignSettings;
  return render(
    <PlusAssignPrioritySetting priorities={priorities} color={color} />
  );
};

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

let originalGetBoundingClientRect: () => DOMRect;

describe('PlusAssignPrioritySetting', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));

    // jsdom lays every element out at (0, 0), which makes dnd-kit unable to
    // tell rows apart. Stub the rect by sibling position (see
    // PreferencePrioritySetting.test.tsx for the same technique).
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

  it('updates the priority order in the store when reordered', async () => {
    renderSetting();
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    fireEvent.keyDown(handles[0], { code: 'Space' });
    await tick();
    fireEvent.keyDown(document, { code: 'ArrowDown' });
    fireEvent.keyDown(document, { code: 'Space' });

    expect(usePuyoAppStore.getState().plusAssignSettings.priorities).toEqual([
      PlusPreferenceKind.ColoredPuyo,
      PlusPreferenceKind.BiggerValue
    ]);
  });

  it('lists the priorities in order with their rank', () => {
    renderSetting();

    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('探索対象の値が大きい')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
    expect(screen.getByText('色ぷよ')).toBeInTheDocument();
  });

  it('offers the colour picker only on the coloured-puyo row', () => {
    usePuyoAppStore.setState({
      plusAssignSettings: {
        ...INITIAL_PUYO_APP_STATE.plusAssignSettings,
        priorities: [PlusPreferenceKind.BiggerValue]
      }
    });
    renderSetting();

    expect(screen.queryByLabelText('優先する色')).toBeNull();
  });

  it('changes the target colour through the store', () => {
    renderSetting();
    fireEvent.click(screen.getByLabelText('優先する色'));
    const option = screen.getByRole('option', { name: '青' });
    fireEvent.pointerDown(option, { pointerType: 'mouse' });
    fireEvent.pointerUp(option, { pointerType: 'mouse' });
    fireEvent.click(option);

    expect(usePuyoAppStore.getState().plusAssignSettings.color).toBe(
      PuyoAttr.Blue
    );
  });
  // ポインタでのドラッグは document 側に後始末しきれない状態を残し、jsdom では
  // 後続テストの Select が開かなくなる。この検証は最後に置く。
  it('keeps the list intact when a row is dropped outside it', () => {
    renderSetting();
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    fireEvent.pointerDown(handles[0], {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0
    });
    // どの行の矩形からも外れる位置まで動かして離す (over === null)
    fireEvent.pointerMove(document, {
      pointerId: 1,
      isPrimary: true,
      clientX: 0,
      clientY: 5000
    });
    fireEvent.pointerUp(document, {
      pointerId: 1,
      isPrimary: true,
      clientX: 0,
      clientY: 5000
    });

    // 落とし損ねただけなので、並びも項目数も変わらない
    expect(usePuyoAppStore.getState().plusAssignSettings.priorities).toEqual([
      PlusPreferenceKind.BiggerValue,
      PlusPreferenceKind.ColoredPuyo
    ]);
  });
});
