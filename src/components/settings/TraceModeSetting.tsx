import type React from 'react';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  type TraceMode,
  getTraceModeDescription,
  possibleTraceModeList
} from '../../logics/TraceMode';
import { traceModeItemSelected } from '../../reducers/puyoAppSlice';
import type { AppDispatch } from '../../reducers/store';
import setting from '../styles/Setting.module.css';

interface IProps {
  /** なぞり消しモード */
  traceMode: TraceMode;
}

/** なぞり消しモードの設定 */
const TraceModeSetting: React.FC<IProps> = (props) => {
  const { traceMode } = props;
  const dispatch = useDispatch<AppDispatch>();

  const onItemSelected = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      dispatch(
        traceModeItemSelected(Number.parseInt(e.target.value) as TraceMode)
      );
    },
    [dispatch]
  );

  return (
    <div className={setting.setting}>
      <label className={setting.label} htmlFor="traceMode">
        なぞり消しモード:
      </label>
      <select
        id="traceMode"
        name="traceMode"
        value={traceMode}
        onChange={onItemSelected}
      >
        {possibleTraceModeList.map((traceMode) => {
          return (
            <option value={traceMode} key={traceMode}>
              {getTraceModeDescription(traceMode)}
            </option>
          );
        })}
      </select>
    </div>
  );
};

export default TraceModeSetting;
