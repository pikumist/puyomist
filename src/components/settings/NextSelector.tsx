import { Select } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import { nextItemSelected } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** 盤面がスクリーンショットの時にtrueにする */
  disabled?: boolean;

  /** ネクストぷよ選択 */
  nextSelection: string;
}

/** ネクストぷよの選択 */
const NextSelector: React.FC<IProps> = (props) => {
  const { disabled, nextSelection } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(nextItemSelected(e.target.value));

  return (
    <Select
      aria-label="ネクストぷよの選択"
      w="7em"
      disabled={disabled}
      value={nextSelection}
      onChange={onChanged}
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
    </Select>
  );
};

export default NextSelector;
