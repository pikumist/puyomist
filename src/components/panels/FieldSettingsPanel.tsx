import type React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { pastelClassForAttr } from '@/components/controls/puyoColorClass';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import { TraceMode, traceModeDescriptionMap } from '@/logics/TraceMode';
import {
  animationDurationChanged,
  chainLeverageChanged,
  maxTraceNumChanged,
  minimumPuyoNumForPoppingChanged,
  poppingLeverageChanged,
  traceModeChanged,
  usePuyoAppState
} from '@/store/puyoAppStore';
import BoardReceiver from './BoardReceiver';
import BoostAreaSetting from './BoostAreaSetting';

const traceModeItems = [...traceModeDescriptionMap] as ReadonlyArray<
  readonly [TraceMode, string]
>;

/**
 * Field settings panel. Shared between the desktop left sidebar and the mobile
 * field sheet.
 */
const FieldSettingsPanel: React.FC = () => {
  const {
    simulationData,
    animationDuration,
    boostAreaKeyList,
    screenshotInfo,
    screenshotErrorMessage
  } = usePuyoAppState();
  const {
    traceMode,
    minimumPuyoNumForPopping,
    maxTraceNum,
    poppingLeverage,
    chainLeverage
  } = simulationData;

  return (
    <div className="space-y-3">
      <SettingRow label="なぞり">
        <EnumSelect<TraceMode>
          ariaLabel="なぞりモードの選択"
          value={traceMode}
          items={traceModeItems}
          colorClassFor={pastelClassForAttr}
          onValueChange={(v) => traceModeChanged(v)}
        />
      </SettingRow>
      <SettingRow label="ひっつき最小数">
        <NumberStepper
          ariaLabel="ひっつき最小数"
          value={minimumPuyoNumForPopping}
          min={3}
          max={4}
          disabled={traceMode !== TraceMode.Normal}
          onChange={(v) => minimumPuyoNumForPoppingChanged(v)}
        />
      </SettingRow>
      <SettingRow label="最大なぞり数">
        <NumberStepper
          ariaLabel="最大なぞり数"
          value={maxTraceNum}
          min={1}
          max={15}
          onChange={(v) => maxTraceNumChanged(v)}
        />
      </SettingRow>
      <SettingRow label="コマ間隔(ms)">
        <NumberStepper
          ariaLabel="コマ間隔"
          value={animationDuration}
          min={0}
          max={3000}
          step={100}
          onChange={(v) => animationDurationChanged(v)}
        />
      </SettingRow>
      <SettingRow label="同時消し倍率">
        <NumberStepper
          ariaLabel="同時消し倍率"
          value={poppingLeverage}
          min={1.0}
          max={9.9}
          step={0.1}
          onChange={(v) => poppingLeverageChanged(v)}
        />
      </SettingRow>
      <SettingRow label="連鎖倍率">
        <NumberStepper
          ariaLabel="連鎖倍率"
          value={chainLeverage}
          min={1.0}
          max={19.9}
          step={0.1}
          onChange={(v) => chainLeverageChanged(v)}
        />
      </SettingRow>
      <BoostAreaSetting boostAreaKeyList={boostAreaKeyList} />
      <BoardReceiver
        canvasMaxWidth={100}
        screenshotInfo={screenshotInfo}
        errorMessage={screenshotErrorMessage}
      />
    </div>
  );
};

export default FieldSettingsPanel;
