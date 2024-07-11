import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  type AllClearPreference,
  type ChancePopPreference,
  CountingBonusType,
  ExplorationCategory,
  type ExplorationTarget,
  getAllClearPreferenceDescription,
  getChancePopPreferenceDescription,
  getCountingBonusTypeDescription,
  getExplorationCategoryDescription,
  possibleAllClearPreferenceList,
  possibleChancePopPreferenceList,
  possibleCountingBonusTypeList,
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
import styles from '../styles/Setting.module.css';

/** 探索対象の設定 */
const ExplorationTargetSetting: React.FC<{ target: ExplorationTarget }> = (
  props
) => {
  const { target } = props;

  return (
    <div className={styles.setting}>
      <CategorySelector target={target} />
      <DetailSetting target={target} />
      <AllClearPreferenceSelector target={target} />
      <ChancePopPreferenceSelector target={target} />
    </div>
  );
};

const CategorySelector: React.FC<{
  target: ExplorationTarget;
}> = (props) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onCategoryItemSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        explorationCategorySelected(
          Number.parseInt(e.target.value) as ExplorationCategory
        )
      );
    },
    [dispatch]
  );

  return (
    <div>
      <label className={styles.label} htmlFor="explorationCategory">
        探索対象:
      </label>
      <select
        id="explorationCategory"
        name="explorationCategory"
        value={target.category}
        onChange={onCategoryItemSelected}
      >
        {possibleExplorationCategoryList.map((category) => {
          return (
            <option value={category} key={category}>
              {getExplorationCategoryDescription(category)}
            </option>
          );
        })}
      </select>
    </div>
  );
};

const AllClearPreferenceSelector: React.FC<{
  target: ExplorationTarget;
}> = (props) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onAllClearPreferenceSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        explorationAllClearPreferenceSelected(
          Number.parseInt(e.target.value) as AllClearPreference
        )
      );
    },
    [dispatch]
  );

  return (
    <div>
      <label className={styles.label} htmlFor="allClearPreference">
        全消し優先:
      </label>
      <select
        id="allClearPreference"
        name="allClearPreference"
        value={target.allClearPreference}
        onChange={onAllClearPreferenceSelected}
      >
        {possibleAllClearPreferenceList.map((preference) => {
          return (
            <option value={preference} key={preference}>
              {getAllClearPreferenceDescription(preference)}
            </option>
          );
        })}
      </select>
    </div>
  );
};

const ChancePopPreferenceSelector: React.FC<{
  target: ExplorationTarget;
}> = (props) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChancePopPreferenceSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        explorationChancePopPreferenceSelected(
          Number.parseInt(e.target.value) as ChancePopPreference
        )
      );
    },
    [dispatch]
  );

  return (
    <div>
      <label className={styles.label} htmlFor="chancePopPreference">
        チャンスぷよ消し優先:
      </label>
      <select
        id="chancePopPreference"
        name="chancePopPreference"
        value={target.chancePopPreference}
        onChange={onChancePopPreferenceSelected}
      >
        {possibleChancePopPreferenceList.map((preference) => {
          return (
            <option value={preference} key={preference}>
              {getChancePopPreferenceDescription(preference)}
            </option>
          );
        })}
      </select>
    </div>
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
  const dispatch = useDispatch<AppDispatch>();

  const onDamageMainAttrSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        explorationDamageMainAttrSelected(
          Number.parseInt(e.target.value) as
            | ColoredPuyoAttribute
            | typeof wildAttribute
        )
      );
    },
    [dispatch]
  );

  const onDamageSubAttrSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value =
        e.target.value === notAvailable
          ? undefined
          : (Number.parseInt(e.target.value) as ColoredPuyoAttribute);
      dispatch(explorationDamageSubAttrSelected(value));
    },
    [dispatch]
  );

  const onDamageMainSubRatioSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value === '1' ? 1 : 1 / 3;
      dispatch(explorationDamageMainSubRatioSelected(value));
    },
    [dispatch]
  );

  const onCountMainAttrSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        explorationPuyoCountMainAttrSelected(
          Number.parseInt(e.target.value) as ColoredPuyoAttribute
        )
      );
    },
    [dispatch]
  );

  const onCountBonusTypeSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value =
        e.target.value === notAvailable
          ? undefined
          : (Number.parseInt(e.target.value) as CountingBonusType);
      dispatch(explorationCountingBonusTypeSelected(value));
    },
    [dispatch]
  );

  const onCountStepTargetAttrSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const attr = Number.parseInt(e.target.value) as PuyoAttribute;
      dispatch(explorationCountingBonusStepTargetAttrSelected(attr));
    },
    [dispatch]
  );

  const onStepHeightChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(
        explorationCountingBonusStepHeightChanged(e.target.valueAsNumber)
      );
    },
    [dispatch]
  );

  const onBonusCountChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(explorationCountingBonusCountChanged(e.target.valueAsNumber));
    },
    [dispatch]
  );

  const onBonusStepRepeatCheckChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(
        explorationCountingBonusStepRepeatCheckChanged(e.target.checked)
      );
    },
    [dispatch]
  );

  switch (target.category) {
    case ExplorationCategory.Damage:
      return (
        <div>
          <div>
            <label className={styles.label} htmlFor="optDamageMainAttr">
              主属性:
            </label>
            <select
              id="optDamageMainAttr"
              name="optDamageMainAttr"
              value={target.mainAttr}
              onChange={onDamageMainAttrSelected}
            >
              {[wildAttribute, ...possibleColoredPuyoAttributeList].map(
                (attr) => {
                  return (
                    <option value={attr} key={attr}>
                      {attr === wildAttribute
                        ? 'ワイルド'
                        : getPuyoAttributeName(attr)}
                    </option>
                  );
                }
              )}
            </select>
          </div>
          <div>
            <label className={styles.label} htmlFor="optDamageSubAttr">
              副属性:
            </label>
            <select
              id="optDamageSubAttr"
              name="optDamageSubAttr"
              disabled={target.mainAttr === wildAttribute}
              value={target.subAttr ?? notAvailable}
              onChange={onDamageSubAttrSelected}
            >
              {[notAvailable, ...possibleColoredPuyoAttributeList].map(
                (attr) => {
                  return (
                    <option
                      hidden={attr === target.mainAttr}
                      value={attr}
                      key={attr}
                    >
                      {attr === notAvailable
                        ? notAvailable
                        : getPuyoAttributeName(attr)}
                    </option>
                  );
                }
              )}
            </select>
          </div>
          {target.subAttr ? (
            <div>
              <label className={styles.label} htmlFor="optDamageMainSubRatio">
                副属性のダメージ率:
              </label>
              <select
                id="optDamageMainSubRatio"
                name="optDamageMainSubRatio"
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
              </select>
            </div>
          ) : null}
        </div>
      );
    case ExplorationCategory.SkillPuyoCount:
      return (
        <div>
          <div>
            <label className={styles.label} htmlFor="optPuyoCountMainAttr">
              主属性:
            </label>
            <select
              id="optPuyoCountMainAttr"
              name="optPuyoCountMainAttr"
              value={target.mainAttr}
              onChange={onCountMainAttrSelected}
            >
              {possibleColoredPuyoAttributeList.map((attr) => {
                return (
                  <option value={attr} key={attr}>
                    {getPuyoAttributeName(attr)}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className={styles.label} htmlFor="optPuyoCountBonusType">
              加速ボーナス:
            </label>
            <select
              id="optPuyoCountBonusType"
              name="optPuyoCountBonusType"
              value={target.countingBonus?.type ?? notAvailable}
              onChange={onCountBonusTypeSelected}
            >
              {[notAvailable, ...possibleCountingBonusTypeList].map((type) => {
                return (
                  <option value={type} key={type}>
                    {type === notAvailable
                      ? notAvailable
                      : getCountingBonusTypeDescription(type)}
                  </option>
                );
              })}
            </select>
          </div>

          {target.countingBonus?.type === CountingBonusType.Step ? (
            <div>
              <label
                className={styles.label}
                htmlFor="optPuyoCountStepTargetAttr"
              >
                ボーナス属性:
              </label>
              <select
                id="optPuyoCountStepTargetAttr"
                name="optPuyoCountStepTargetAttr"
                value={target.countingBonus?.targetAttrs?.[0]}
                onChange={onCountStepTargetAttrSelected}
              >
                {possibleStepPuyoAtrributeList.map((attr) => {
                  return (
                    <option value={attr} key={attr}>
                      {getPuyoAttributeName(attr)}
                    </option>
                  );
                })}
              </select>
              <div>
                <label className={styles.label} htmlFor="stepHeight">
                  段高:
                </label>
                <input
                  className={styles.w3}
                  id="stepHeight"
                  name="stepHeight"
                  type="number"
                  value={target.countingBonus?.stepHeight}
                  onChange={onStepHeightChanged}
                  min="1"
                  max="11"
                  step="1"
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="bonusCount">
                  ボーナス数:
                </label>
                <input
                  className={styles.w3}
                  id="bonusCount"
                  name="bonusCount"
                  type="number"
                  value={target.countingBonus?.bonusCount}
                  onChange={onBonusCountChanged}
                  min="1"
                  max="5"
                  step="1"
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="bonusStepRepeat">
                  ステップ繰り返し
                </label>
                <input
                  id="bonusStepRepeat"
                  name="bonusStepRepeat"
                  type="checkbox"
                  checked={target.countingBonus?.repeat}
                  onChange={onBonusStepRepeatCheckChanged}
                />
              </div>
            </div>
          ) : null}
        </div>
      );
    default:
      return null;
  }
};

export default ExplorationTargetSetting;
