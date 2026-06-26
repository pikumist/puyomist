import type React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget,
  type ExplorationTargetDamage,
  type ExplorationTargetSkillPuyoCount,
  explorationCategoryDescriptionMap
} from '@/logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  PuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '@/logics/PuyoAttr';
import {
  explorationCategorySelected,
  explorationCountingBonusCountChanged,
  explorationCountingBonusStepHeightChanged,
  explorationCountingBonusStepRepeatCheckChanged,
  explorationCountingBonusStepTargetAttrSelected,
  explorationCountingBonusTypeSelected,
  explorationDamageMainAttrSelected,
  explorationDamageMainSubRatioSelected,
  explorationDamageSubAttrSelected,
  explorationOptimalSolutionNumChanged,
  explorationPuyoCountMainAttrSelected
} from '@/store/puyoAppStore';
import PreferencePrioritySetting from './PreferencePrioritySetting';

// 0 is not a valid colored attribute, so it doubles as "wild" / "none".
const WILD = 0;
const NONE = 0;

const categoryItems = [...explorationCategoryDescriptionMap] as ReadonlyArray<
  readonly [ExplorationCategory, string]
>;

const stepPuyoAttributeList: ReadonlyArray<PuyoAttr> = [
  ...coloredPuyoAttrList,
  PuyoAttr.Heart,
  PuyoAttr.Prism,
  PuyoAttr.Ojama
];

/** Exploration target settings. */
const ExplorationTargetSetting: React.FC<{ target: ExplorationTarget }> = (
  props
) => {
  const { target } = props;

  return (
    <div className="space-y-2">
      <SettingRow label="探索対象">
        <EnumSelect<ExplorationCategory>
          ariaLabel="探索対象の選択"
          value={target.category}
          items={categoryItems}
          onValueChange={(v) => explorationCategorySelected(v)}
        />
      </SettingRow>
      <DetailSetting target={target} />
      <SettingRow label="最適解の数">
        <NumberStepper
          ariaLabel="最適解の数"
          value={target.optimal_solution_count}
          min={1}
          max={100}
          onChange={(v) => explorationOptimalSolutionNumChanged(v)}
        />
      </SettingRow>
      <PreferencePrioritySetting
        preferencePriorities={target.preference_priorities}
      />
    </div>
  );
};

const DetailSetting: React.FC<{ target: ExplorationTarget }> = ({ target }) => {
  switch (target.category) {
    case ExplorationCategory.Damage:
      return <DamageSetting target={target} />;
    case ExplorationCategory.SkillPuyoCount:
      return <SkillPuyoCountSetting target={target} />;
    default:
      return null;
  }
};

const DamageSetting: React.FC<{ target: ExplorationTargetDamage }> = ({
  target
}) => {
  const mainItems: ReadonlyArray<readonly [number, string]> = [
    [WILD, 'ワイルド'],
    ...coloredPuyoAttrList.map(
      (attr) => [attr, getPuyoAttrName(attr)] as readonly [number, string]
    )
  ];
  const subItems: ReadonlyArray<readonly [number, string]> = [
    [NONE, '--'],
    ...coloredPuyoAttrList
      .filter((attr) => attr !== target.main_attr)
      .map(
        (attr) => [attr, getPuyoAttrName(attr)] as readonly [number, string]
      )
  ];

  return (
    <div className="space-y-2">
      <SettingRow label="主属性">
        <EnumSelect<number>
          ariaLabel="主属性の選択"
          value={target.main_attr ?? WILD}
          items={mainItems}
          onValueChange={(v) =>
            explorationDamageMainAttrSelected(
              (v as ColoredPuyoAttr) || undefined
            )
          }
        />
      </SettingRow>
      <SettingRow label="副属性">
        <EnumSelect<number>
          ariaLabel="副属性の選択"
          disabled={!target.main_attr}
          value={target.sub_attr ?? NONE}
          items={subItems}
          onValueChange={(v) =>
            explorationDamageSubAttrSelected(
              v === NONE ? undefined : (v as ColoredPuyoAttr)
            )
          }
        />
      </SettingRow>
      {target.sub_attr ? (
        <SettingRow label="副属性のダメージ率">
          <EnumSelect<number>
            ariaLabel="副属性のダメージ率の選択"
            value={target.main_sub_ratio ?? 1 / 3}
            items={[
              [1 / 3, '1/3'],
              [1, '1']
            ]}
            onValueChange={(v) => explorationDamageMainSubRatioSelected(v)}
          />
        </SettingRow>
      ) : null}
    </div>
  );
};

const SkillPuyoCountSetting: React.FC<{
  target: ExplorationTargetSkillPuyoCount;
}> = ({ target }) => {
  const isStep =
    target.counting_bonus?.bonus_type === CountingBonusType.Step;

  return (
    <div className="space-y-2">
      <SettingRow label="主属性">
        <EnumSelect<PuyoAttr>
          ariaLabel="主属性の選択"
          value={target.main_attr}
          items={coloredPuyoAttrList.map(
            (attr) => [attr, getPuyoAttrName(attr)] as readonly [PuyoAttr, string]
          )}
          onValueChange={(v) =>
            explorationPuyoCountMainAttrSelected(v as ColoredPuyoAttr)
          }
        />
      </SettingRow>

      <Label className="font-normal">
        <Checkbox
          checked={isStep}
          onCheckedChange={(checked) =>
            explorationCountingBonusTypeSelected(
              checked ? CountingBonusType.Step : undefined
            )
          }
        />
        加速ボーナス
      </Label>

      {isStep && target.counting_bonus?.bonus_type === CountingBonusType.Step ? (
        <div className="space-y-2">
          <SettingRow label="ボーナス属性">
            <EnumSelect<PuyoAttr>
              ariaLabel="ボーナス属性の選択"
              value={target.counting_bonus.target_attrs[0]}
              items={stepPuyoAttributeList.map(
                (attr) =>
                  [attr, getPuyoAttrName(attr)] as readonly [PuyoAttr, string]
              )}
              onValueChange={(v) =>
                explorationCountingBonusStepTargetAttrSelected(v)
              }
            />
          </SettingRow>
          <SettingRow label="段高">
            <NumberStepper
              ariaLabel="段高"
              value={target.counting_bonus.step_height}
              min={1}
              max={19}
              onChange={(v) => explorationCountingBonusStepHeightChanged(v)}
            />
          </SettingRow>
          <SettingRow label="ボーナス数">
            <NumberStepper
              ariaLabel="ボーナス数"
              value={target.counting_bonus.bonus_count}
              min={1}
              max={9}
              onChange={(v) => explorationCountingBonusCountChanged(v)}
            />
          </SettingRow>
          <Label className="font-normal">
            <Checkbox
              checked={target.counting_bonus.repeat}
              onCheckedChange={(checked) =>
                explorationCountingBonusStepRepeatCheckChanged(checked)
              }
            />
            段の繰り返し
          </Label>
        </div>
      ) : null}
    </div>
  );
};

export default ExplorationTargetSetting;
