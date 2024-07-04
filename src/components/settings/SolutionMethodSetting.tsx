import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { SolutionMethod } from '../../logics/solution';
import { solutionMethodItemSelected } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 探索法 */
  method: SolutionMethod;
}

/** 探索法の設定 */
const SolutionMethodSetting: React.FC<IProps> = (props) => {
  const { method } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onItemSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(solutionMethodItemSelected(e.target.value as SolutionMethod));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="solutionMethod">
        探索法:
      </label>
      <select
        id="solutionMethod"
        name="solutionMethod"
        value={method}
        onChange={onItemSelected}
      >
        {[SolutionMethod.solve2, SolutionMethod.solve3].map((method) => {
          return (
            <option value={method} key={method}>
              {method}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default SolutionMethodSetting;
