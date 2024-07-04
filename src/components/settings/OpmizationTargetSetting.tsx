import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  type OptimizationTarget,
  getOptimizationTargetDescription,
  possibleOptimizationTargetList
} from '../../logics/OptimizationTarget';
import { optimizationTargetItemSelected } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 最適化対象 */
  target: OptimizationTarget;
}

/** 最適化対象の設定 */
const OptimizationTargetSetting: React.FC<IProps> = (props) => {
  const { target } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        optimizationTargetItemSelected(
          Number.parseInt(e.target.value) as OptimizationTarget
        )
      );
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="optimizationTarget">
        最適化対象:
      </label>
      <select
        id="optimizationTarget"
        name="optimizationTarget"
        value={target}
        onChange={onChanged}
      >
        {possibleOptimizationTargetList.map((optTarget) => {
          return (
            <option value={optTarget} key={optTarget}>
              {getOptimizationTargetDescription(optTarget)}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default OptimizationTargetSetting;
