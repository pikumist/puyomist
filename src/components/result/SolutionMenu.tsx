import { Eraser, PlayIcon, SearchIcon, Trash2Icon, XIcon } from 'lucide-react';
import React from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  playSolutionButtonClicked,
  solveButtonClicked
} from '@/store/actions';
import {
  boardResetButtonClicked,
  solutionResetButtonClicked,
  solveCancelButtonClicked
} from '@/store/puyoAppStore';

interface IProps {
  solving: boolean;
  hasResult: boolean;
}

/** Exploration menu (solve/cancel, clear, play, reset board). */
const SolutionMenu: React.FC<IProps> = React.memo((props) => {
  const { solving, hasResult } = props;

  const onSolveOrCancelButtonClicked = () => {
    if (solving) {
      solveCancelButtonClicked();
    } else {
      solveButtonClicked();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label={!solving ? '最適解を探索' : '探索をキャンセル'}
              onClick={onSolveOrCancelButtonClicked}
            />
          }
        >
          {!solving ? <SearchIcon /> : <XIcon />}
        </TooltipTrigger>
        <TooltipContent>
          {!solving ? '最適解を探索' : '探索をキャンセル'}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="探索結果クリア"
              disabled={!hasResult}
              onClick={() => solutionResetButtonClicked()}
            />
          }
        >
          <Eraser />
        </TooltipTrigger>
        <TooltipContent>探索結果クリア</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="解でなぞり"
              disabled={!hasResult}
              onClick={() => playSolutionButtonClicked()}
            />
          }
        >
          <PlayIcon />
        </TooltipTrigger>
        <TooltipContent>解でなぞり</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="盤面リセット"
              onClick={() => boardResetButtonClicked()}
            />
          }
        >
          <Trash2Icon />
        </TooltipTrigger>
        <TooltipContent>盤面リセット</TooltipContent>
      </Tooltip>
    </div>
  );
});

export default SolutionMenu;
