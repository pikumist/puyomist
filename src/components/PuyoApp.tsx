import {
  faBroom,
  faMagnifyingGlass,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons';
import type React from 'react';
import { useCallback } from 'react';
import { ssBoardKey } from '../logics/boards';
import PuyoCanvas from './PuyoCanvas';
import ScreenshotCanvas from './ScreenshotCanvas';
import BoardSetting from './settings/BoardSetting';
import BoostAreaSetting from './settings/BoostAreaSetting';
import NextConfig from './settings/NextSetting';
import layout from './styles/Layout.module.css';
import setting from './styles/Setting.module.css';
import 'react-tooltip/dist/react-tooltip.css';
import { useDispatch, useSelector } from 'react-redux';
import { Tooltip } from 'react-tooltip';
import { dispatchWhenScreenshotReceivedViaWebSocket } from '../hooks/dispatchWhenScreenshotReceivedViaWebSocket';
import {
  boardResetButtonClicked,
  playSolutionButtonClicked,
  solutionResetButtonClicked,
  solveButtonClicked
} from '../reducers/puyoAppSlice';
import type { AppDispatch, RootState } from '../reducers/store';
import SolutionResultView from './SolutionResultView';
import TracingResultView from './TracingResultView';
import IconButton from './buttons/IconButton';
import AnimationDurationSetting from './settings/AnimationDurationSetting';
import BoardEditSetting from './settings/BoardEditSetting';
import ChainLeverageSetting from './settings/ChainLeverageSetting';
import MaxTraceNumSetting from './settings/MaxTraceNumSetting';
import MinimumPuyoNumForPoppingSetting from './settings/MinimumPuyoNumForPoppingSetting';
import OptimizationTargetSetting from './settings/OpmizationTargetSetting';
import PoppingLeverageSetting from './settings/PoppingLeverageSetting';
import SolutionMethodSetting from './settings/SolutionMethodSetting';
import TraceModeSetting from './settings/TraceModeSetting';

/** ぷよクエの最適解計算アプリ */
const PuyoApp: React.FC = () => {
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const dispatch = useDispatch<AppDispatch>();
  dispatchWhenScreenshotReceivedViaWebSocket(state.screenshotInfo, dispatch);

  const onBoardRestButtonCliecked = useCallback(() => {
    dispatch(boardResetButtonClicked());
  }, [dispatch]);

  const onSolutionResetButtonClicked = useCallback(() => {
    dispatch(solutionResetButtonClicked());
  }, [dispatch]);

  const onPlaySolutionButtonClicked = useCallback(() => {
    dispatch(playSolutionButtonClicked());
  }, [dispatch]);

  const onSolveButtonClicked = useCallback(() => {
    dispatch(solveButtonClicked());
  }, [dispatch]);

  return (
    <>
      <div className={`${layout.horizontal} ${layout.gap4}`}>
        <div className={`${layout.vertical} ${layout.width480} ${layout.gap4}`}>
          <div className={`${layout.horizontal} ${layout.gap8}`}>
            <BoardSetting boardId={state.boardId} />
            <NextConfig
              disabled={state.boardId === ssBoardKey}
              nextSelection={state.nextSelection}
            />
          </div>

          <PuyoCanvas width={480} height={390} />

          <div className={`${layout.horizontal} ${layout.gap8}`}>
            <div className={layout.flex1}>
              <IconButton
                tooltipId="resetBtnTooltip"
                icon={faRotateRight}
                onClicked={onBoardRestButtonCliecked}
              />
              <TracingResultView
                tracingCoords={state.field.getCurrentTracingCoords()}
                chainDamages={state.chainDamages}
              />
            </div>
            <div className={layout.flex1}>
              <div>
                <IconButton
                  tooltipId="solveBtnTooltip"
                  icon={faMagnifyingGlass}
                  onClicked={onSolveButtonClicked}
                />
                <IconButton
                  tooltipId="clearSolutionBtnTooltip"
                  icon={faBroom}
                  disabled={Boolean(!state.solvedResult)}
                  onClicked={onSolutionResetButtonClicked}
                />
                <IconButton
                  tooltipId="playSolutionBtnTooltip"
                  text="▶"
                  disabled={Boolean(!state.solvedResult)}
                  onClicked={onPlaySolutionButtonClicked}
                />
                <IconButton
                  tooltipId="resetBtnTooltip"
                  icon={faRotateRight}
                  onClicked={onBoardRestButtonCliecked}
                />
              </div>
              <SolutionResultView
                solving={state.solving}
                result={state.solvedResult}
              />
            </div>
          </div>
        </div>

        <div className={setting.settings}>
          <TraceModeSetting traceMode={state.field.getTraceMode()} />
          <MinimumPuyoNumForPoppingSetting
            num={state.field.getMinimumPuyoNumForPopping()}
          />
          <MaxTraceNumSetting maxTraceNum={state.field.getMaxTraceNum()} />
          <PoppingLeverageSetting leverage={state.field.getPoppingLeverage()} />
          <ChainLeverageSetting leverage={state.field.getChainLeverage()} />
          <BoostAreaSetting boostAreaKeyList={state.boostAreaKeyList} />
          <hr />
          <AnimationDurationSetting
            duration={state.field.getAnimationDuration()}
          />
          <OptimizationTargetSetting target={state.optimizationTarget} />
          <SolutionMethodSetting method={state.solutionMethod} />
          <hr />
          <BoardEditSetting boardEditMode={state.boardEditMode!} />
        </div>

        <ScreenshotCanvas
          screenshotInfo={state.screenshotInfo}
          errorMessage={state.screenshotErrorMessage}
        />
      </div>
      <Tooltip id="resetBtnTooltip">盤面リセット</Tooltip>
      <Tooltip id="solveBtnTooltip">探索</Tooltip>
      <Tooltip id="clearSolutionBtnTooltip">探索結果クリア</Tooltip>
      <Tooltip id="playSolutionBtnTooltip">解でなぞり</Tooltip>
    </>
  );
};

export default PuyoApp;
