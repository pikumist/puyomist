import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { chainLeverageChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 連鎖倍率 */
  leverage: number;
}

/** 連鎖倍率の設定 */
const ChainLeverageSetting: React.FC<IProps> = (props) => {
  const { leverage } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(chainLeverageChanged(e.target.valueAsNumber));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="chainLeverage">
        連鎖倍率:
      </label>
      <input
        className={setting.w3dot5}
        id="chainLeverage"
        name="chainLeverage"
        type="number"
        value={leverage.toFixed(1)}
        onChange={onChanged}
        min="1.0"
        step="0.1"
      />
    </div>
  );
};

export default ChainLeverageSetting;
