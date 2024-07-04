import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { animationDurationChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** ワンステップのアニメーションの時間間隔(ms) */
  duration: number;
}

/** ワンステップのアニメーション時間間隔設定 */
const AnimationDurationSetting: React.FC<IProps> = (props) => {
  const { duration } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(animationDurationChanged(e.target.valueAsNumber));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="animationDuration">
        アニメーションの時間間隔(ミリ秒):
      </label>
      <input
        className={setting.w3dot5}
        id="animationDuration"
        name="animationDuration"
        type="number"
        value={duration}
        onChange={onChanged}
        min="100"
        step="100"
      />
    </div>
  );
};

export default AnimationDurationSetting;
