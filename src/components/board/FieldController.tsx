import { Trash2Icon } from 'lucide-react';
import type React from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import type { AnimationStep } from '@/logics/AnimationStep';
import type { PuyoCoord } from '@/logics/PuyoCoord';
import { boardResetButtonClicked } from '@/store/puyoAppStore';
import AnimationStepSlider from './AnimationStepSlider';

interface FieldControllerProps {
  /** Current trace coordinates. */
  tracingCoords: PuyoCoord[];
  /** Animation steps. */
  animationSteps: AnimationStep[];
  /** Active animation step index. */
  activeAnimationStepIndex: number;
  /** Hide the board-reset button. */
  hideReset?: boolean;
  className?: string;
}

/**
 * Field controller: shows the live trace while editing, or the chain-animation
 * scrubber (+ reset) once a chain has played.
 */
const FieldController: React.FC<FieldControllerProps> = (props) => {
  const {
    tracingCoords,
    animationSteps,
    activeAnimationStepIndex,
    hideReset,
    className
  } = props;

  const coords = tracingCoords.map((c) => c.toCellAddr()).join(',');

  return (
    <div className={className}>
      {animationSteps?.length > 0 ? (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <AnimationStepSlider
              animationSteps={animationSteps}
              index={activeAnimationStepIndex}
            />
          </div>
          {!hideReset ? (
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
          ) : null}
        </div>
      ) : (
        <div>
          <div className="text-muted-foreground">現在のなぞり:</div>
          <div className="num">{coords || 'なし'}</div>
        </div>
      )}
    </div>
  );
};

export default FieldController;
