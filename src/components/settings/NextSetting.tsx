import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { nextItemSelected } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 盤面がスクリーンショットの時にtrueにする */
  disabled?: boolean;

  /** ネクストぷよ選択 */
  nextSelection: string;
}

/** ネクストぷよの設定 */
const NextConfig: React.FC<IProps> = (props) => {
  const { disabled, nextSelection } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onItemSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(nextItemSelected(e.target.value));
    },
    [dispatch]
  );

  return (
    <div className={setting.item}>
      <label htmlFor="next">ネクスト: </label>
      <select
        disabled={Boolean(disabled)}
        name="next"
        value={nextSelection}
        onChange={onItemSelected}
      >
        <option value="random">ランダム</option>
        <option value="red">赤</option>
        <option value="red+">赤+</option>
        <option value="blue">青</option>
        <option value="blue+">青+</option>
        <option value="green">緑</option>
        <option value="green+">緑+</option>
        <option value="yellow">黄</option>
        <option value="yellow+">黄+</option>
        <option value="purple">紫</option>
        <option value="purple+">紫+</option>
      </select>
    </div>
  );
};

export default NextConfig;
