import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { maxTraceNumChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 最大なぞり消し数 */
  maxTraceNum: number;
}

/** 最大なぞり消し数の設定 */
const MaxTraceNumSetting: React.FC<IProps> = (props) => {
  const { maxTraceNum } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(maxTraceNumChanged(e.target.valueAsNumber));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="maxTraceNum">
        最大なぞり消し数:
      </label>
      <input
        className={setting.w3}
        id="maxTraceNum"
        name="maxTraceNum"
        type="number"
        value={maxTraceNum}
        onChange={onChanged}
        min="1"
        max="48"
        step="1"
      />
    </div>
  );
};

export default MaxTraceNumSetting;
