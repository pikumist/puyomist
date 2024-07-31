import { Select } from '@chakra-ui/react';
import type React from 'react';
import { useDispatch } from 'react-redux';
import { boardIdToNameMap } from '../../logics/boards';
import { boardIdChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';

interface IProps {
  /** 盤面ID */
  boardId: string;
}

/** 盤面選択 */
const BoardSelector: React.FC<IProps> = (props) => {
  const { boardId } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = (e: React.ChangeEvent<HTMLSelectElement>) =>
    dispatch(boardIdChanged(e.target.value));

  return (
    <Select aria-label="盤面の選択" value={boardId} onChange={onChanged}>
      {[...boardIdToNameMap.entries()].map((entry) => (
        <option value={entry[0]} key={entry[0]}>
          {entry[1]}
        </option>
      ))}
    </Select>
  );
};

export default BoardSelector;
