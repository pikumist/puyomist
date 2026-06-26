import '@/hooks/dispatchWhenScreenshotReceivedViaWebSocket';

import PuyoBoard from '@/components/board/PuyoBoard';
import FieldController from '@/components/board/FieldController';
import TopBar from '@/components/layout/TopBar';
import ExplorationPanel from '@/components/panels/ExplorationPanel';
import FieldSettingsPanel from '@/components/panels/FieldSettingsPanel';
import TracingResultView from '@/components/result/TracingResultView';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePuyoAppState } from '@/store/puyoAppStore';
import { selectActiveChains } from '@/store/selectors';

/**
 * New (shadcn/Tailwind) layout shell. Responsive across three breakpoints:
 * - <768px  : board + bottom sheets (settings/exploration in TopBar).
 * - 768-1023: board + a right column with field/exploration tabs.
 * - ≥1024px : full 3-pane grid (field | board | exploration).
 *
 * Panel content is shared (`FieldSettingsPanel` / `ExplorationPanel`); only the
 * outer shell changes per breakpoint.
 */
export function App() {
  const state = usePuyoAppState();
  const {
    boostAreaKeyList,
    simulationData,
    lastTraceCoords,
    animationSteps,
    activeAnimationStepIndex
  } = state;
  const chains = selectActiveChains(state);
  const hasBoostArea = boostAreaKeyList.length > 0;

  return (
    <div className="app-shell">
      <TopBar />

      {/* Desktop-only left field panel */}
      <aside className="app-left panel hidden p-4 lg:block">
        <FieldSettingsPanel />
      </aside>

      {/* Board (all breakpoints). Board + controls share one fluid width so they
          stay aligned as the board grows on larger screens. */}
      <main className="app-board panel flex flex-col items-center overflow-y-auto p-4">
        <div className="board-stack space-y-4">
          <PuyoBoard className="board-fluid" />
          <div className="space-y-3">
            <FieldController
              hideReset={false}
              tracingCoords={simulationData.traceCoords}
              animationSteps={animationSteps}
              activeAnimationStepIndex={activeAnimationStepIndex}
            />
            <TracingResultView
              isDamageTwoLine={false}
              hasBoostArea={hasBoostArea}
              tracingCoords={simulationData.traceCoords}
              lastTraceCoords={lastTraceCoords}
              chains={chains}
              animationSteps={animationSteps}
              activeAnimationStepIndex={activeAnimationStepIndex}
            />
          </div>
        </div>
      </main>

      {/* Right column: tablet tabs (md..lg) + desktop exploration (lg+) */}
      <aside className="app-right panel hidden overflow-y-auto p-4 md:block">
        <div className="lg:hidden">
          <Tabs defaultValue="field">
            <TabsList className="w-full">
              <TabsTrigger value="field">フィールド</TabsTrigger>
              <TabsTrigger value="explore">探索</TabsTrigger>
            </TabsList>
            <TabsContent value="field">
              <FieldSettingsPanel />
            </TabsContent>
            <TabsContent value="explore">
              <ExplorationPanel />
            </TabsContent>
          </Tabs>
        </div>
        <div className="hidden lg:block">
          <ExplorationPanel />
        </div>
      </aside>
    </div>
  );
}

export default App;
