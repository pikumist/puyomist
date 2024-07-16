import {
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
  type AllClearPreference,
  type ChancePopPreference,
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget,
  type ExplorationTargetDamage,
  type ExplorationTargetSkillPuyoCount,
  allClearPreferenceDescriptionMap,
  chancePopPreferenceDescriptionMap,
  explorationCategoryDescriptionMap,
  wildAttribute
} from '../../logics/ExplorationTarget';
import {
  type ColoredPuyoAttribute,
  PuyoAttribute,
  coloredPuyoAttributeList,
  getPuyoAttributeName
} from '../../logics/PuyoAttribute';
import {
  explorationAllClearPreferenceSelected,
  explorationCategorySelected,
  explorationChancePopPreferenceSelected,
  explorationCountingBonusCountChanged,
  explorationCountingBonusStepHeightChanged,
  explorationCountingBonusStepRepeatCheckChanged,
  explorationCountingBonusStepTargetAttrSelected,
  explorationCountingBonusTypeSelected,
  explorationDamageMainAttrSelected,
  explorationDamageMainSubRatioSelected,
  explorationDamageSubAttrSelected,
  explorationPuyoCountMainAttrSelected
} from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

/** 探索対象の設定 */
const ExplorationTargetSetting: React.FC<{ target: ExplorationTarget }> = (
  props
) => {
  const { target } = props;

  return (
    <Stack my={2} spacing={0}>
      <CategorySelector category={target.category} />
      <DetailSetting target={target} />
      <AllClearPreferenceSelector preference={target.allClearPreference} />
      <ChancePopPreferenceSelector preference={target.chancePopPreference} />
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
      <Text>探索対象:</Text>
      <Select
        aria-label="探索対象の選択"
        w="11em"
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

const AllClearPreferenceSelector: React.FC<{
  preference: AllClearPreference;
}> = (props) => {
  const { preference } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(
      explorationAllClearPreferenceSelected(
        Number.parseInt(e.target.value) as AllClearPreference
      )
    );

  return (
    <HStack>
      <Text>全消し優先:</Text>
      <Select
        aria-label="全消し優先の選択"
        w="9em"
        value={preference}
        onChange={onChanged}
      >
        {[...allClearPreferenceDescriptionMap].map(([pref, description]) => {
          return (
            <option value={pref} key={pref}>
              {description}
            </option>
          );
        })}
      </Select>
    </HStack>
  );
};

const ChancePopPreferenceSelector: React.FC<{
  preference: ChancePopPreference;
}> = (props) => {
  const { preference } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(
      explorationChancePopPreferenceSelected(
        Number.parseInt(e.target.value) as ChancePopPreference
      )
    );

  return (
    <HStack>
      <Text>チャンスぷよ優先:</Text>
      <Select
        aria-label="チャンスぷよ優先の選択"
        w="9em"
        value={preference}
        onChange={onChanged}
      >
        {[...chancePopPreferenceDescriptionMap].map(([pref, description]) => {
          return (
            <option value={pref} key={pref}>
              {description}
            </option>
          );
        })}
      </Select>
    </HStack>
  );
};

const notAvailable = '--' as const;

const stepPuyoAtrributeList: ReadonlyArray<PuyoAttribute> = [
  ...coloredPuyoAttributeList,
  PuyoAttribute.Heart,
  PuyoAttribute.Prism,
  PuyoAttribute.Ojama
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

const DamageSetting: React.FC<{ target: ExplorationTargetDamage }> = (
  props
) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onDamageMainAttrSelected = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(
      explorationDamageMainAttrSelected(
        Number.parseInt(e.target.value) as
          | ColoredPuyoAttribute
          | typeof wildAttribute
      )
    );

  const onDamageSubAttrSelected = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value =
      e.target.value === notAvailable
        ? undefined
        : (Number.parseInt(e.target.value) as ColoredPuyoAttribute);
    dispatch(explorationDamageSubAttrSelected(value));
  };

  const onDamageMainSubRatioSelected = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value === '1' ? 1 : 1 / 3;
    dispatch(explorationDamageMainSubRatioSelected(value));
  };

  return (
    <Stack spacing="0">
      <HStack>
        <Text>主属性:</Text>
        <Select
          aria-label="主属性の選択"
          w="7em"
          value={target.mainAttr}
          onChange={onDamageMainAttrSelected}
        >
          {[wildAttribute, ...coloredPuyoAttributeList].map((attr) => {
            return (
              <option value={attr} key={attr}>
                {attr === wildAttribute
                  ? 'ワイルド'
                  : getPuyoAttributeName(attr)}
              </option>
            );
          })}
        </Select>
      </HStack>

      <HStack>
        <Text>副属性:</Text>
        <Select
          aria-label="副属性の選択"
          w="5em"
          value={target.subAttr ?? notAvailable}
          isDisabled={target.mainAttr === wildAttribute}
          onChange={onDamageSubAttrSelected}
        >
          {[notAvailable, ...coloredPuyoAttributeList].map((attr) => {
            return (
              <option hidden={attr === target.mainAttr} value={attr} key={attr}>
                {attr === notAvailable
                  ? notAvailable
                  : getPuyoAttributeName(attr)}
              </option>
            );
          })}
        </Select>
      </HStack>

      {target.subAttr ? (
        <HStack>
          <Text>副属性のダメージ率:</Text>
          <Select
            aria-label="副属性のダメージ率の選択"
            w="5em"
            value={target.mainSubRatio}
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
        Number.parseInt(e.target.value) as ColoredPuyoAttribute
      )
    );

  const onCountBonusCheckChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const type = e.target.checked ? CountingBonusType.Step : undefined;
    dispatch(explorationCountingBonusTypeSelected(type));
  };

  const onCountStepTargetAttrSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const attr = Number.parseInt(e.target.value) as PuyoAttribute;
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
    <Stack spacing="0">
      <HStack>
        <Text>主属性:</Text>
        <Select
          aria-label="主属性の選択"
          w="6em"
          value={target.mainAttr}
          onChange={onCountMainAttrSelected}
        >
          {coloredPuyoAttributeList.map((attr) => (
            <option value={attr} key={attr}>
              {getPuyoAttributeName(attr)}
            </option>
          ))}
        </Select>
      </HStack>

      <Checkbox
        w="8em"
        checked={target.countingBonus?.type === CountingBonusType.Step}
        onChange={onCountBonusCheckChanged}
      >
        加速ボーナス
      </Checkbox>

      {target.countingBonus?.type === CountingBonusType.Step ? (
        <Stack spacing="0">
          {/* TODO: 項目の追加・削除に対応する */}
          <HStack>
            <Text>ボーナス属性:</Text>
            <Select
              aria-label="ボーナス属性の選択"
              w="7em"
              value={target.countingBonus?.targetAttrs?.[0]}
              onChange={onCountStepTargetAttrSelected}
            >
              {stepPuyoAtrributeList.map((attr) => (
                <option value={attr} key={attr}>
                  {getPuyoAttributeName(attr)}
                </option>
              ))}
            </Select>
          </HStack>

          <HStack>
            <Text>段高:</Text>
            <NumberInput
              width="5em"
              value={target.countingBonus?.stepHeight}
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
            <Text>ボーナス数:</Text>
            <NumberInput
              width="4em"
              size="sm"
              value={target.countingBonus?.bonusCount}
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
            checked={target.countingBonus?.repeat}
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
