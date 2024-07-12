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
  getAllClearPreferenceDescription,
  getChancePopPreferenceDescription,
  getExplorationCategoryDescription,
  possibleAllClearPreferenceList,
  possibleChancePopPreferenceList,
  possibleExplorationCategoryList,
  wildAttribute
} from '../../logics/ExplorationTarget';
import {
  type ColoredPuyoAttribute,
  PuyoAttribute,
  getPuyoAttributeName,
  possibleColoredPuyoAttributeList
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
      <Text fontSize="sm">探索対象:</Text>
      <Select
        aria-label="探索対象の選択"
        w="10em"
        size="sm"
        value={category}
        onChange={onChanged}
      >
        {possibleExplorationCategoryList.map((category) => {
          return (
            <option value={category} key={category}>
              {getExplorationCategoryDescription(category)}
            </option>
          );
        })}
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
      <Text fontSize="sm">全消し優先:</Text>
      <Select
        aria-label="全消し優先の選択"
        w="8em"
        size="sm"
        value={preference}
        onChange={onChanged}
      >
        {possibleAllClearPreferenceList.map((pref) => {
          return (
            <option value={pref} key={pref}>
              {getAllClearPreferenceDescription(pref)}
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
      <Text fontSize="sm">チャンスぷよ消し優先:</Text>
      <Select
        aria-label="チャンスぷよ消し優先の選択"
        w="8em"
        size="sm"
        value={preference}
        onChange={onChanged}
      >
        {possibleChancePopPreferenceList.map((pref) => {
          return (
            <option value={pref} key={pref}>
              {getChancePopPreferenceDescription(pref)}
            </option>
          );
        })}
      </Select>
    </HStack>
  );
};

const notAvailable = '--' as const;
const possibleStepPuyoAtrributeList: ReadonlyArray<PuyoAttribute> = [
  PuyoAttribute.Red,
  PuyoAttribute.Blue,
  PuyoAttribute.Green,
  PuyoAttribute.Yellow,
  PuyoAttribute.Purple,
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
        <Text fontSize="sm">主属性:</Text>
        <Select
          aria-label="主属性の選択"
          w="6em"
          size="sm"
          value={target.mainAttr}
          onChange={onDamageMainAttrSelected}
        >
          {[wildAttribute, ...possibleColoredPuyoAttributeList].map((attr) => {
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
        <Text fontSize="sm">副属性:</Text>
        <Select
          aria-label="副属性の選択"
          w="4em"
          size="sm"
          value={target.subAttr ?? notAvailable}
          isDisabled={target.mainAttr === wildAttribute}
          onChange={onDamageSubAttrSelected}
        >
          {[notAvailable, ...possibleColoredPuyoAttributeList].map((attr) => {
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
          <Text fontSize="sm">副属性のダメージ率:</Text>
          <Select
            aria-label="副属性のダメージ率の選択"
            w="5em"
            size="sm"
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
        <Text fontSize="sm">主属性:</Text>
        <Select
          aria-label="主属性の選択"
          w="6em"
          size="sm"
          value={target.mainAttr}
          onChange={onCountMainAttrSelected}
        >
          {possibleColoredPuyoAttributeList.map((attr) => (
            <option value={attr} key={attr}>
              {getPuyoAttributeName(attr)}
            </option>
          ))}
        </Select>
      </HStack>

      <Checkbox
        w="7em"
        size="sm"
        checked={target.countingBonus?.type === CountingBonusType.Step}
        onChange={onCountBonusCheckChanged}
      >
        加速ボーナス
      </Checkbox>

      {target.countingBonus?.type === CountingBonusType.Step ? (
        <Stack spacing="0">
          {/* TODO: 項目の追加・削除に対応する */}
          <HStack>
            <Text fontSize="sm">ボーナス属性:</Text>
            <Select
              aria-label="ボーナス属性の選択"
              w="6.5em"
              size="sm"
              value={target.countingBonus?.targetAttrs?.[0]}
              onChange={onCountStepTargetAttrSelected}
            >
              {possibleStepPuyoAtrributeList.map((attr) => (
                <option value={attr} key={attr}>
                  {getPuyoAttributeName(attr)}
                </option>
              ))}
            </Select>
          </HStack>

          <HStack>
            <Text fontSize="sm">段高:</Text>
            <NumberInput
              width="4em"
              size="sm"
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
            <Text fontSize="sm">ボーナス数:</Text>
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
            w="7em"
            size="sm"
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
