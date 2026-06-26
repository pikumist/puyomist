import { render, screen } from '@testing-library/react';
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
});
