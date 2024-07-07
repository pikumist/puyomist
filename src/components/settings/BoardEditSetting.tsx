import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  type BoardEditMode,
  HowToEditBoard,
  getHowToEditBoardDescription,
  possibleHowToEditBoardList
} from '../../logics/BoardEditMode';
import { type PuyoType, puyoTypeMap } from '../../logics/PuyoType';
import {
  boardEditCustomTypeItemSelected,
  howToEditBoardItemSelected
} from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** 盤面編集モード */
  boardEditMode: BoardEditMode;
}

/** 盤面編集設定 */
const BoardEditSetting: React.FC<IProps> = (props) => {
  const { boardEditMode } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onHowToEditItemSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const howToEdit = Number.parseInt(e.target.value, 10) as HowToEditBoard;
      dispatch(howToEditBoardItemSelected(howToEdit));
    },
    [dispatch]
  );

  const onCustomTypeItemSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const customType = Number.parseInt(e.target.value, 10) as PuyoType;
      dispatch(boardEditCustomTypeItemSelected(customType));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <div className={setting.item}>
        <label htmlFor="boardEdit">盤面編集モード: </label>
        <select
          id="boardEdit"
          name="boardEdit"
          value={boardEditMode?.howToEdit}
          onChange={onHowToEditItemSelected}
        >
          {possibleHowToEditBoardList.map((howToEdit) => {
            return (
              <option value={howToEdit} key={howToEdit}>
                {getHowToEditBoardDescription(howToEdit)}
              </option>
            );
          })}
        </select>
      </div>
      <div
        className={setting.grid}
        hidden={boardEditMode?.howToEdit !== HowToEditBoard.ToCustomType}
      >
        {[...puyoTypeMap.entries()].map((entry) => {
          const [type, description] = entry;
          return (
            <div key={type}>
              <input
                type="radio"
                name="customType"
                id={`customtype_${type}`}
                value={type}
                checked={boardEditMode?.customType === type}
                onChange={onCustomTypeItemSelected}
              />
              <label htmlFor={`customtype_${type}`}>{description}</label>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BoardEditSetting;
