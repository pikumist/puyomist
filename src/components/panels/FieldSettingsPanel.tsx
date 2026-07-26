import type React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { pastelClassForAttr } from '@/components/controls/puyoColorClass';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { TraceMode, traceModeDescriptionMap } from '@/logics/TraceMode';
import { isDeadCellRuleApplicable } from '@/logics/dead-cells';
import {
  animationDurationChanged,
  chainLeverageChanged,
  maxTraceNumChanged,
  minimumPuyoNumForPoppingChanged,
  poppingLeverageChanged,
  showDeadCellsChanged,
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
    showDeadCells,
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
  // なぞり塗りモードや?ぷよのある盤面では判定が成り立たないので、トグルごと無効にする
  const deadCellRuleApplicable = isDeadCellRuleApplicable(
    simulationData.field,
    simulationData.nextPuyos,
    traceMode
  );
  // 無効の理由をツールチップで出し分けるため、なぞりモードのせいかどうかを見る
  const blockedByQuestionPuyo =
    !deadCellRuleApplicable && traceMode === TraceMode.Normal;

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
      <SettingRow
        label={
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="cursor-help underline decoration-dotted underline-offset-2" />
              }
            >
              ひっつかないぷよ
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {deadCellRuleApplicable
                ? '今の盤面ではひっつき消し (連鎖やダメージになる消え方) が起こせないぷよに×を付けます。なぞれば直接消せますし、連鎖で補充ぷよが降れば繋がることもあります。'
                : blockedByQuestionPuyo
                  ? '?ぷよがある盤面では色が分からないため判定できません。'
                  : 'なぞり塗りモードでは、なぞりが任意のぷよを塗り替えるため判定できません。'}
            </TooltipContent>
          </Tooltip>
        }
      >
        <Switch
          aria-label="ひっつかないぷよに印を付ける"
          checked={showDeadCells && deadCellRuleApplicable}
          disabled={!deadCellRuleApplicable}
          onCheckedChange={(checked) => showDeadCellsChanged(checked)}
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
