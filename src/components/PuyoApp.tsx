import {
  faBroom,
  faMagnifyingGlass,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons';
import type React from 'react';
import { useCallback } from 'react';
import { customBoardId } from '../logics/boards';
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
import PuyoBoard from './PuyoBoard';
import SolutionResultView from './SolutionResultView';
import TracingResultView from './TracingResultView';
import IconButton from './buttons/IconButton';
import AnimationDurationSetting from './settings/AnimationDurationSetting';
import BoardEditSetting from './settings/BoardEditSetting';
import ChainLeverageSetting from './settings/ChainLeverageSetting';
import ExplorationTargetSetting from './settings/ExplorationTargetSetting';
import MaxTraceNumSetting from './settings/MaxTraceNumSetting';
import MinimumPuyoNumForPoppingSetting from './settings/MinimumPuyoNumForPoppingSetting';
import PoppingLeverageSetting from './settings/PoppingLeverageSetting';
import SolutionMethodSetting from './settings/SolutionMethodSetting';
import TraceModeSetting from './settings/TraceModeSetting';

/** ぷよクエの最適解計算アプリ */
const PuyoApp: React.FC = () => {
  const state = useSelector<RootState, RootState['puyoApp']>(
    (state) => state.puyoApp
  );
  const dispatch = useDispatch<AppDispatch>();
  dispatchWhenScreenshotReceivedViaWebSocket(dispatch);

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
        <div className={`${layout.vertical} ${layout.gap4}`}>
          <div className={`${layout.horizontal} ${layout.gap8}`}>
            <BoardSetting boardId={state.boardId} />
            <NextConfig
              disabled={state.boardId === customBoardId}
              nextSelection={state.nextSelection}
            />
          </div>

          <PuyoBoard />

          <div>
            <IconButton
              tooltipId="resetBtnTooltip"
              icon={faRotateRight}
              onClicked={onBoardRestButtonCliecked}
            />
            <TracingResultView
              tracingCoords={state.simulationData.traceCoords}
              lastTraceCoords={state.lastTraceCoords}
              chains={state.chains}
            />
          </div>
        </div>

        <div className={setting.settings}>
          <TraceModeSetting traceMode={state.simulationData.traceMode} />
          <MinimumPuyoNumForPoppingSetting
            num={state.simulationData.minimumPuyoNumForPopping}
          />
          <MaxTraceNumSetting maxTraceNum={state.simulationData.maxTraceNum} />
          <PoppingLeverageSetting
            leverage={state.simulationData.poppingLeverage}
          />
          <ChainLeverageSetting leverage={state.simulationData.chainLeverage} />
          <BoostAreaSetting boostAreaKeyList={state.boostAreaKeyList} />
          <hr />
          <AnimationDurationSetting
            duration={state.simulationData.animationDuration}
          />
          <ExplorationTargetSetting target={state.explorationTarget} />
          <SolutionMethodSetting method={state.solutionMethod} />
          <hr />
          <BoardEditSetting boardEditMode={state.boardEditMode!} />
          <div>
            <IconButton
              tooltipId="solveBtnTooltip"
              icon={faMagnifyingGlass}
              onClicked={onSolveButtonClicked}
            />
            <IconButton
              tooltipId="clearSolutionBtnTooltip"
              icon={faBroom}
              disabled={Boolean(!state.explorationResult)}
              onClicked={onSolutionResetButtonClicked}
            />
            <IconButton
              tooltipId="playSolutionBtnTooltip"
              text="▶"
              disabled={Boolean(!state.explorationResult)}
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
            result={state.explorationResult}
          />
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
