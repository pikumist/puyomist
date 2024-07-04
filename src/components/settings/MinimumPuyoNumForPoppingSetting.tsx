import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { minimumPuyoNumForPoppingChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** ぷよが消えるのに必要な個数 */
  num: number;
}

/** なぞり消しモードの設定 */
const MinimumPuyoNumForPoppingSetting: React.FC<IProps> = (props) => {
  const { num } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(minimumPuyoNumForPoppingChanged(e.target.valueAsNumber));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="minimumPuyoNumForPopping">
        ぷよが消えるのに必要な個数:
      </label>
      <input
        className={setting.w3}
        id="minimumPuyoNumForPopping"
        name="minimumPuyoNumForPopping"
        type="number"
        value={num}
        onChange={onChanged}
        min="3"
        max="4"
        step="1"
      />
    </div>
  );
};

export default MinimumPuyoNumForPoppingSetting;
