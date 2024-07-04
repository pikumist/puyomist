import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { getBoostArea, possibleBoostAreaKeyList } from '../../logics/BoostArea';
import { boostAreaKeyCheckedChanged } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** ブーストエリアキーリスト */
  boostAreaKeyList: string[];
}

/** ブーストエリア設定 */
const BoostAreaSetting: React.FC<IProps> = (props) => {
  const { boostAreaKeyList } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const key = e.target.dataset.key!;
      const checked = e.target.checked;

      dispatch(boostAreaKeyCheckedChanged({ key, checked }));
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <div>ブーストエリア:</div>
      {possibleBoostAreaKeyList.map((key) => {
        const boostAreaId = `boostarea-${key}`;
        return (
          <div key={key}>
            <input
              type="checkbox"
              id={boostAreaId}
              name={boostAreaId}
              data-key={key}
              checked={boostAreaKeyList.includes(key)}
              onChange={onChanged}
            />
            <label htmlFor={boostAreaId}>{getBoostArea(key)!.name}</label>
          </div>
        );
      })}
    </div>
  );
};

export default BoostAreaSetting;
