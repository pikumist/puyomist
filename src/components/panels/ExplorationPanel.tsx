import type React from 'react';
import { useState } from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { NumberStepper } from '@/components/controls/NumberStepper';
import { SettingRow } from '@/components/controls/SettingRow';
import SolutionMenu from '@/components/result/SolutionMenu';
import SolutionResultView from '@/components/result/SolutionResultView';
import { Progress } from '@/components/ui/progress';
import {
  SolutionMethod,
  rustBackendSolutionMethodDescription,
  solutionMethodDescriptionMap
} from '@/logics/solution';
import { Button } from '@/components/ui/button';
import {
  maxTraceNumChanged,
  paintUndone,
  solutionMethodItemSelected,
  usePuyoAppState
} from '@/store/puyoAppStore';
import { selectPaintUndoAvailable } from '@/store/selectors';
import ExplorationTargetSetting from './ExplorationTargetSetting';
import PaintSearchDialog from './PaintSearchDialog';

/** ぷよ塗り探索に対応していない探索法 (JS実装には塗り探索が無い) */
const jsSolutionMethods: ReadonlySet<SolutionMethod> = new Set([
  SolutionMethod.solveAllInSerial,
  SolutionMethod.solveAllInParallel
]);

// Rustネイティブバックエンドはlocalhost限定 (README「外部通信なし」維持のため、公開サイトでは
// 選択肢に出さない。ローカル専用のsolver-serverへ接続する探索法のため)。
const methodItems = (
  window.location.hostname === 'localhost'
    ? [
        ...solutionMethodDescriptionMap,
        [
          SolutionMethod.solveAllByRustBackend,
          rustBackendSolutionMethodDescription
        ] as const
      ]
    : [...solutionMethodDescriptionMap]
) as ReadonlyArray<readonly [SolutionMethod, string]>;

/**
 * Exploration panel: settings + solve menu + progress + result. Shared between
 * the desktop right sidebar and the mobile exploration sheet.
 */
const ExplorationPanel: React.FC = () => {
  const state = usePuyoAppState();
  const {
    simulationData,
    solutionMethod,
    explorationTarget,
    solving,
    solvingProgressPercent,
    solveResult,
    optimalSolutionIndex
  } = state;
  const paintUndoAvailable = selectPaintUndoAvailable(state);
  const [paintDialogOpen, setPaintDialogOpen] = useState(false);
  const paintSearchAvailable = !jsSolutionMethods.has(solutionMethod);

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

      {(paintSearchAvailable || paintUndoAvailable) && (
        <div className="flex gap-2">
          {paintSearchAvailable && (
            <Button variant="outline" onClick={() => setPaintDialogOpen(true)}>
              塗探索
            </Button>
          )}
          {paintUndoAvailable && (
            <Button variant="ghost" onClick={() => paintUndone()}>
              塗りを元に戻す
            </Button>
          )}
        </div>
      )}
      <PaintSearchDialog
        open={paintDialogOpen}
        onOpenChange={setPaintDialogOpen}
      />

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
