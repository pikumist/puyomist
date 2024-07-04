import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { boardIdToNameMap } from '../../logics/boards';
import { boardIdChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 盤面ID */
  boardId: string;
}

/** 盤面設定 */
const BoardSetting: React.FC<IProps> = (props) => {
  const { boardId } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      return dispatch(boardIdChanged(e.target.value));
    },
    [dispatch]
  );

  return (
    <div className={setting.item}>
      <label htmlFor="board">盤面: </label>
      <select name="board" value={boardId} onChange={onChanged}>
        {[...boardIdToNameMap.entries()].map((entry) => (
          <option value={entry[0]} key={entry[0]}>
            {entry[1]}
          </option>
        ))}
      </select>
    </div>
  );
};

export default BoardSetting;
