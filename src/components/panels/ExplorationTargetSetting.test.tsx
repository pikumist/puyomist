import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTargetDamage,
  type ExplorationTargetSkillPuyoCount,
  PreferenceKind
} from '@/logics/ExplorationTarget';
import { PuyoAttr } from '@/logics/PuyoAttr';
import { usePuyoAppStore } from '@/store/puyoAppStore';
import { INITIAL_PUYO_APP_STATE } from '@/store/types';
import ExplorationTargetSetting from './ExplorationTargetSetting';

const basePriorities = [PreferenceKind.BiggerValue];

const damageTarget: ExplorationTargetDamage = {
  category: ExplorationCategory.Damage,
  preference_priorities: basePriorities,
  optimal_solution_count: 5,
  main_attr: PuyoAttr.Red,
  sub_attr: PuyoAttr.Blue,
  main_sub_ratio: 1 / 3
};

const skillTarget: ExplorationTargetSkillPuyoCount = {
  category: ExplorationCategory.SkillPuyoCount,
  preference_priorities: basePriorities,
  optimal_solution_count: 5,
  main_attr: PuyoAttr.Green,
  counting_bonus: {
    bonus_type: CountingBonusType.Step,
    target_attrs: [PuyoAttr.Green],
    step_height: 3,
    bonus_count: 2,
    repeat: true
  }
};

const skillTargetNoBonus: ExplorationTargetSkillPuyoCount = {
  category: ExplorationCategory.SkillPuyoCount,
  preference_priorities: basePriorities,
  optimal_solution_count: 5,
  main_attr: PuyoAttr.Red
};

/**
 * Opens the given EnumSelect combobox and picks the option with the given
 * accessible name, mirroring the interaction sequence the underlying
 * base-ui Select needs to actually commit a selection (see
 * EnumSelect.test.tsx).
 */
function selectOption(comboboxLabel: string, optionName: string) {
  fireEvent.click(screen.getByLabelText(comboboxLabel));
  const option = screen.getByRole('option', { name: optionName });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.pointerUp(option, { pointerType: 'mouse' });
  fireEvent.click(option);
}

describe('ExplorationTargetSetting', () => {
  beforeEach(() => {
    usePuyoAppStore.setState(structuredClone(INITIAL_PUYO_APP_STATE));
  });

  it('renders the base controls for puyotsukai count', () => {
    render(
      <ExplorationTargetSetting
        target={INITIAL_PUYO_APP_STATE.explorationTarget}
      />
    );
    expect(screen.getByLabelText('探索対象の選択')).toBeInTheDocument();
    expect(screen.getByLabelText('最適解の数')).toBeInTheDocument();
  });

  it('renders the damage detail sub-settings', () => {
    render(<ExplorationTargetSetting target={damageTarget} />);
    expect(screen.getByLabelText('主属性の選択')).toBeInTheDocument();
    expect(screen.getByLabelText('副属性の選択')).toBeInTheDocument();
    expect(
      screen.getByLabelText('副属性のダメージ率の選択')
    ).toBeInTheDocument();
  });

  it('renders the skill-puyo-count step bonus sub-settings', () => {
    render(<ExplorationTargetSetting target={skillTarget} />);
    expect(screen.getByLabelText('主属性の選択')).toBeInTheDocument();
    expect(screen.getByText('加速ボーナス')).toBeInTheDocument();
    expect(screen.getByLabelText('ボーナス属性の選択')).toBeInTheDocument();
    expect(screen.getByLabelText('段高')).toBeInTheDocument();
    expect(screen.getByLabelText('ボーナス数')).toBeInTheDocument();
  });

  it('renders a wild main attribute and the default ratio when they are unset', () => {
    const target: ExplorationTargetDamage = {
      category: ExplorationCategory.Damage,
      preference_priorities: basePriorities,
      optimal_solution_count: 5,
      main_attr: undefined,
      sub_attr: PuyoAttr.Blue,
      main_sub_ratio: undefined
    };
    render(<ExplorationTargetSetting target={target} />);
    expect(screen.getByLabelText('主属性の選択')).toHaveTextContent(
      'ワイルド'
    );
    expect(
      screen.getByLabelText('副属性のダメージ率の選択')
    ).toHaveTextContent('1/3');
  });

  it('increments the optimal solution count', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(damageTarget)
    });
    render(<ExplorationTargetSetting target={damageTarget} />);
    fireEvent.click(screen.getByLabelText('最適解の数を増やす'));
    expect(
      usePuyoAppStore.getState().explorationTarget.optimal_solution_count
    ).toBe(damageTarget.optimal_solution_count + 1);
  });

  it('does not render the damage/sub ratio row when there is no sub attribute', () => {
    const target: ExplorationTargetDamage = {
      ...damageTarget,
      sub_attr: undefined
    };
    render(<ExplorationTargetSetting target={target} />);
    expect(
      screen.queryByLabelText('副属性のダメージ率の選択')
    ).not.toBeInTheDocument();
  });

  it('updates the exploration category when a new option is selected', () => {
    render(
      <ExplorationTargetSetting
        target={INITIAL_PUYO_APP_STATE.explorationTarget}
      />
    );
    selectOption('探索対象の選択', 'ダメージ量');
    expect(usePuyoAppStore.getState().explorationTarget.category).toBe(
      ExplorationCategory.Damage
    );
  });

  it('clears the sub attribute when a wild main attribute is selected for damage', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(damageTarget)
    });
    render(<ExplorationTargetSetting target={damageTarget} />);
    selectOption('主属性の選択', 'ワイルド');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetDamage;
    expect(target.main_attr).toBeUndefined();
    expect(target.sub_attr).toBeUndefined();
  });

  it('keeps a different sub attribute when a new colored main attribute is selected for damage', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(damageTarget)
    });
    render(<ExplorationTargetSetting target={damageTarget} />);
    selectOption('主属性の選択', '黄');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetDamage;
    expect(target.main_attr).toBe(PuyoAttr.Yellow);
    expect(target.sub_attr).toBe(PuyoAttr.Blue);
  });

  it('selects a colored sub attribute for damage', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(damageTarget)
    });
    render(<ExplorationTargetSetting target={damageTarget} />);
    selectOption('副属性の選択', '黄');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetDamage;
    expect(target.sub_attr).toBe(PuyoAttr.Yellow);
  });

  it('clears the sub attribute for damage when "--" is selected', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(damageTarget)
    });
    render(<ExplorationTargetSetting target={damageTarget} />);
    selectOption('副属性の選択', '--');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetDamage;
    expect(target.sub_attr).toBeUndefined();
  });

  it('updates the damage main/sub ratio', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(damageTarget)
    });
    render(<ExplorationTargetSetting target={damageTarget} />);
    selectOption('副属性のダメージ率の選択', '1');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetDamage;
    expect(target.main_sub_ratio).toBe(1);
  });

  it('updates the skill puyo count main attribute', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTarget)
    });
    render(<ExplorationTargetSetting target={skillTarget} />);
    selectOption('主属性の選択', '青');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.main_attr).toBe(PuyoAttr.Blue);
  });

  it('enables the step counting bonus when the checkbox is checked', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTargetNoBonus)
    });
    render(<ExplorationTargetSetting target={skillTargetNoBonus} />);
    expect(
      screen.queryByLabelText('ボーナス属性の選択')
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('加速ボーナス'));
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.counting_bonus?.bonus_type).toBe(CountingBonusType.Step);
  });

  it('disables the step counting bonus when the checkbox is unchecked', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTarget)
    });
    render(<ExplorationTargetSetting target={skillTarget} />);
    fireEvent.click(screen.getByText('加速ボーナス'));
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.counting_bonus).toBeUndefined();
  });

  it('updates the step bonus target attribute', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTarget)
    });
    render(<ExplorationTargetSetting target={skillTarget} />);
    selectOption('ボーナス属性の選択', 'ハート');
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.counting_bonus?.target_attrs).toEqual([PuyoAttr.Heart]);
  });

  it('increments the step height', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTarget)
    });
    render(<ExplorationTargetSetting target={skillTarget} />);
    fireEvent.click(screen.getByLabelText('段高を増やす'));
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.counting_bonus?.step_height).toBe(4);
  });

  it('increments the bonus count', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTarget)
    });
    render(<ExplorationTargetSetting target={skillTarget} />);
    fireEvent.click(screen.getByLabelText('ボーナス数を増やす'));
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.counting_bonus?.bonus_count).toBe(3);
  });

  it('toggles the step repeat flag', () => {
    usePuyoAppStore.setState({
      explorationTarget: structuredClone(skillTarget)
    });
    render(<ExplorationTargetSetting target={skillTarget} />);
    fireEvent.click(screen.getByText('段の繰り返し'));
    const target = usePuyoAppStore.getState()
      .explorationTarget as ExplorationTargetSkillPuyoCount;
    expect(target.counting_bonus?.repeat).toBe(false);
  });
});
