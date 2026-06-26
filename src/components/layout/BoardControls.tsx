import type React from 'react';

import { EnumSelect } from '@/components/controls/EnumSelect';
import { pastelClassForNextSelection } from '@/components/controls/puyoColorClass';
import { cn } from '@/lib/utils';
import { boardIdChanged, nextItemSelected } from '@/store/puyoAppStore';
import { usePuyoAppState } from '@/store/puyoAppStore';
import { boardIdToNameMap, customBoardId } from '@/logics/boards';
import BoardEditPopover from './BoardEditPopover';
import ExportMenu from './ExportMenu';

const boardItems = [...boardIdToNameMap.entries()] as ReadonlyArray<
  readonly [string, string]
>;

const nextItems: ReadonlyArray<readonly [string, string]> = [
  ['random', 'ランダム'],
  ['red', '赤'],
  ['red+', '赤+'],
  ['blue', '青'],
  ['blue+', '青+'],
  ['green', '緑'],
  ['green+', '緑+'],
  ['yellow', '黄'],
  ['yellow+', '黄+'],
  ['purple', '紫'],
  ['purple+', '紫+']
];

/**
 * Board-level controls: board selector, next-puyo selector, export menu and
 * board-edit popover. Reused in the desktop top bar and the mobile field sheet.
 */
const BoardControls: React.FC<{ className?: string }> = ({ className }) => {
  const {
    boardId,
    nextSelection,
    isBoardEditing,
    boardEditMode,
    simulationData,
    boostAreaKeyList,
    explorationTarget
  } = usePuyoAppState();

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <EnumSelect<string>
        ariaLabel="盤面の選択"
        value={boardId}
        items={boardItems}
        onValueChange={(v) => boardIdChanged(v)}
      />
      <EnumSelect<string>
        ariaLabel="ネクストぷよの選択"
        value={nextSelection}
        items={nextItems}
        disabled={boardId === customBoardId}
        colorClassFor={pastelClassForNextSelection}
        onValueChange={(v) => nextItemSelected(v)}
      />
      <ExportMenu
        simulationData={simulationData}
        boostAreaKeyList={boostAreaKeyList}
        explorationTarget={explorationTarget}
      />
      <BoardEditPopover
        isBoardEditing={isBoardEditing}
        boardEditMode={boardEditMode}
      />
    </div>
  );
};

export default BoardControls;
