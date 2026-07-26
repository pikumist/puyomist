import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { boostAreaKeyMap } from '@/logics/BoostArea';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import BoostAreaSetting from './BoostAreaSetting';

describe('BoostAreaSetting', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('renders a checkbox per boost area', () => {
    render(<BoostAreaSetting boostAreaKeyList={[]} />);
    expect(screen.getAllByRole('checkbox').length).toBe(boostAreaKeyMap.size);
  });

  it('adds a boost area key to the store on check', () => {
    const firstArea = [...boostAreaKeyMap.values()][0];
    render(<BoostAreaSetting boostAreaKeyList={[]} />);
    fireEvent.click(screen.getByText(firstArea.name));
    expect(usePuyoAppStore.getState().boostAreaKeyList.length).toBeGreaterThan(
      0
    );
  });

  it('removes a boost area key when unchecked', () => {
    const [firstKey, firstArea] = [...boostAreaKeyMap.entries()][0];
    render(<BoostAreaSetting boostAreaKeyList={[firstKey]} />);
    fireEvent.click(screen.getByText(firstArea.name));
    expect(usePuyoAppStore.getState().boostAreaKeyList).not.toContain(firstKey);
  });
});
