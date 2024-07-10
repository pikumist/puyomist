import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { poppingLeverageChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import styles from '../styles/Setting.module.css';

interface IProps {
  /** 同時消し倍率 */
  leverage: number;
}

/** 同時消し倍率の設定 */
const PoppingLeverageSetting: React.FC<IProps> = (props) => {
  const { leverage } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(poppingLeverageChanged(e.target.valueAsNumber));
    },
    [dispatch]
  );

  return (
    <div className={styles.setting}>
      <label className={styles.label} htmlFor="poppingLeverage">
        同時消し倍率:
      </label>
      <input
        className={styles.w3dot5}
        id="poppingLeverage"
        name="poppingLeverage"
        type="number"
        value={leverage.toFixed(1)}
        onChange={onChanged}
        min="1.0"
        step="0.1"
      />
    </div>
  );
};

export default PoppingLeverageSetting;
