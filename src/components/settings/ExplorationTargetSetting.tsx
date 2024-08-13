import {
  Box,
  Checkbox,
  HStack,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  Stack,
  Text
} from '@chakra-ui/react';
import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget,
  type ExplorationTargetDamage,
  type ExplorationTargetSkillPuyoCount,
  explorationCategoryDescriptionMap
} from '../../logics/ExplorationTarget';
import {
  type ColoredPuyoAttr,
  PuyoAttr,
  coloredPuyoAttrList,
  getPuyoAttrName
} from '../../logics/PuyoAttr';
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
} from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import PreferencePrioritySetting from './PreferencePrioritySetting';

/** 探索対象の設定 */
const ExplorationTargetSetting: React.FC<{ target: ExplorationTarget }> = (
  props
) => {
  const { target } = props;

  return (
    <Stack spacing={1}>
      <CategorySelector category={target.category} />
      <DetailSetting target={target} />
      <OptimalSolutionCountInput num={target.optimal_solution_count} />
      <PreferencePrioritySetting
        preferencePriorities={target.preference_priorities}
      />
    </Stack>
  );
};

const CategorySelector: React.FC<{
  category: ExplorationCategory;
}> = (props) => {
  const { category } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(
      explorationCategorySelected(
        Number.parseInt(e.target.value) as ExplorationCategory
      )
    );

  return (
    <HStack>
      <Text>探索対象</Text>
      <Select
        aria-label="探索対象の選択"
        w="10em"
        value={category}
        onChange={onChanged}
      >
        {[...explorationCategoryDescriptionMap].map(
          ([category, description]) => {
            return (
              <option value={category} key={category}>
                {description}
              </option>
            );
          }
        )}
      </Select>
    </HStack>
  );
};

const OptimalSolutionCountInput: React.FC<{
  num: number;
}> = (props) => {
  const { num } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (_: string, valueAsNumber: number) =>
    dispatch(explorationOptimalSolutionNumChanged(valueAsNumber));

  return (
    <HStack>
      <Box>
        <Text>最適解の数</Text>
      </Box>
      <NumberInput
        width="4.5em"
        value={num}
        step={1}
        min={1}
        max={10}
        onChange={onChanged}
      >
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </HStack>
  );
};

const notAvailable = '--' as const;

const stepPuyoAtrributeList: ReadonlyArray<PuyoAttr> = [
  ...coloredPuyoAttrList,
  PuyoAttr.Heart,
  PuyoAttr.Prism,
  PuyoAttr.Ojama
];

const DetailSetting: React.FC<{
  target: ExplorationTarget;
}> = (props) => {
  const { target } = props;

  switch (target.category) {
    case ExplorationCategory.Damage:
      return <DamageSetting target={target} />;
    case ExplorationCategory.SkillPuyoCount:
      return <SkilPuyoCountSetting target={target} />;
    default:
      return null;
  }
};

// セレクターのワイルド属性に割り当てる数値
const wildAttr = 0;

const DamageSetting: React.FC<{ target: ExplorationTargetDamage }> = (
  props
) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onDamageMainAttrSelected = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(
      explorationDamageMainAttrSelected(
        (Number.parseInt(e.target.value) as ColoredPuyoAttr) || undefined
      )
    );

  const onDamageSubAttrSelected = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value =
      e.target.value === notAvailable
        ? undefined
        : (Number.parseInt(e.target.value) as ColoredPuyoAttr);
    dispatch(explorationDamageSubAttrSelected(value));
  };

  const onDamageMainSubRatioSelected = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value === '1' ? 1 : 1 / 3;
    dispatch(explorationDamageMainSubRatioSelected(value));
  };

  return (
    <Stack spacing="1">
      <HStack>
        <Text>主属性</Text>
        <Select
          aria-label="主属性の選択"
          w="7em"
          value={target.main_attr || wildAttr}
          onChange={onDamageMainAttrSelected}
        >
          {[wildAttr, ...coloredPuyoAttrList].map((attr) => {
            return (
              <option value={attr} key={attr}>
                {attr === wildAttr ? 'ワイルド' : getPuyoAttrName(attr)}
              </option>
            );
          })}
        </Select>
      </HStack>

      <HStack>
        <Text>副属性</Text>
        <Select
          aria-label="副属性の選択"
          w="5em"
          value={target.sub_attr ?? notAvailable}
          isDisabled={!target.main_attr}
          onChange={onDamageSubAttrSelected}
        >
          {[notAvailable, ...coloredPuyoAttrList].map((attr) => {
            return (
              <option
                hidden={attr === target.main_attr}
                value={attr}
                key={attr}
              >
                {attr === notAvailable ? notAvailable : getPuyoAttrName(attr)}
              </option>
            );
          })}
        </Select>
      </HStack>

      {target.sub_attr ? (
        <HStack>
          <Text>副属性のダメージ率</Text>
          <Select
            aria-label="副属性のダメージ率の選択"
            w="5em"
            value={target.main_sub_ratio}
            onChange={onDamageMainSubRatioSelected}
          >
            {['1/3', '1'].map((ratioStr) => {
              return (
                <option value={ratioStr} key={ratioStr}>
                  {ratioStr}
                </option>
              );
            })}
          </Select>
        </HStack>
      ) : null}
    </Stack>
  );
};

const SkilPuyoCountSetting: React.FC<{
  target: ExplorationTargetSkillPuyoCount;
}> = (props) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onCountMainAttrSelected = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(
      explorationPuyoCountMainAttrSelected(
        Number.parseInt(e.target.value) as ColoredPuyoAttr
      )
    );

  const onCountBonusCheckChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const type = e.target.checked ? CountingBonusType.Step : undefined;
    dispatch(explorationCountingBonusTypeSelected(type));
  };

  const onCountStepTargetAttrSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const attr = Number.parseInt(e.target.value) as PuyoAttr;
      dispatch(explorationCountingBonusStepTargetAttrSelected(attr));
    },
    [dispatch]
  );

  const onStepHeightChanged = (_: string, valueAsNumber: number) =>
    dispatch(explorationCountingBonusStepHeightChanged(valueAsNumber));

  const onBonusCountChanged = (_: string, valueAsNumber: number) =>
    dispatch(explorationCountingBonusCountChanged(valueAsNumber));

  const onBonusStepRepeatCheckChanged = (
    e: React.ChangeEvent<HTMLInputElement>
  ) =>
    dispatch(explorationCountingBonusStepRepeatCheckChanged(e.target.checked));

  return (
    <Stack spacing="1">
      <HStack>
        <Text>主属性</Text>
        <Select
          aria-label="主属性の選択"
          w="6em"
          value={target.main_attr}
          onChange={onCountMainAttrSelected}
        >
          {coloredPuyoAttrList.map((attr) => (
            <option value={attr} key={attr}>
              {getPuyoAttrName(attr)}
            </option>
          ))}
        </Select>
      </HStack>

      <Checkbox
        w="8em"
        checked={target.counting_bonus?.bonus_type === CountingBonusType.Step}
        onChange={onCountBonusCheckChanged}
      >
        加速ボーナス
      </Checkbox>

      {target.counting_bonus?.bonus_type === CountingBonusType.Step ? (
        <Stack spacing="0">
          {/* TODO: 項目の追加・削除に対応する */}
          <HStack>
            <Text>ボーナス属性</Text>
            <Select
              aria-label="ボーナス属性の選択"
              w="7em"
              value={target.counting_bonus?.target_attrs?.[0]}
              onChange={onCountStepTargetAttrSelected}
            >
              {stepPuyoAtrributeList.map((attr) => (
                <option value={attr} key={attr}>
                  {getPuyoAttrName(attr)}
                </option>
              ))}
            </Select>
          </HStack>

          <HStack>
            <Text>段高</Text>
            <NumberInput
              width="5em"
              value={target.counting_bonus?.step_height}
              step={1}
              min={1}
              max={19}
              onChange={onStepHeightChanged}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </HStack>

          <HStack>
            <Text>ボーナス数</Text>
            <NumberInput
              width="4em"
              size="sm"
              value={target.counting_bonus?.bonus_count}
              step={1}
              min={1}
              max={9}
              onChange={onBonusCountChanged}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </HStack>

          <Checkbox
            w="8em"
            checked={target.counting_bonus?.repeat}
            onChange={onBonusStepRepeatCheckChanged}
          >
            段の繰り返し
          </Checkbox>
        </Stack>
      ) : null}
    </Stack>
  );
};

export default ExplorationTargetSetting;
