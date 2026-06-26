import type React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import SolutionMenu from '@/components/result/SolutionMenu';
import SolutionResultView from '@/components/result/SolutionResultView';
import { Progress } from '@/components/ui/progress';
import {
  type SolutionMethod,
  solutionMethodDescriptionMap
} from '@/logics/solution';
import {
  maxTraceNumChanged,
  solutionMethodItemSelected,
  usePuyoAppState
} from '@/store/puyoAppStore';
import ExplorationTargetSetting from './ExplorationTargetSetting';

const methodItems = [...solutionMethodDescriptionMap] as ReadonlyArray<
  readonly [SolutionMethod, string]
>;

/**
 * Exploration panel: settings + solve menu + progress + result. Shared between
 * the desktop right sidebar and the mobile exploration sheet.
 */
const ExplorationPanel: React.FC = () => {
  const {
    simulationData,
    solutionMethod,
    explorationTarget,
    solving,
    solvingProgressPercent,
    solveResult,
    optimalSolutionIndex
  } = usePuyoAppState();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SettingRow label="最大なぞり数">
          <NumberStepper
            ariaLabel="最大なぞり数"
            value={simulationData.maxTraceNum}
            min={1}
            max={15}
            onChange={(v) => maxTraceNumChanged(v)}
          />
        </SettingRow>
        <SettingRow label="探索法">
          <EnumSelect<SolutionMethod>
            ariaLabel="探索法の選択"
            value={solutionMethod}
            items={methodItems}
            onValueChange={(v) => solutionMethodItemSelected(v)}
          />
        </SettingRow>
        <ExplorationTargetSetting target={explorationTarget} />
      </div>

      <div>
        <SolutionMenu solving={solving} hasResult={Boolean(solveResult)} />
        <Progress
          className="mt-2"
          value={
            solving && solvingProgressPercent === 0
              ? null
              : solvingProgressPercent
          }
          style={{ visibility: solving ? 'visible' : 'hidden' }}
        />
      </div>

      <SolutionResultView
        result={solveResult}
        index={optimalSolutionIndex}
        isInProgress={
          solvingProgressPercent > 0 && solvingProgressPercent < 100
        }
      />
    </div>
  );
};

export default ExplorationPanel;
