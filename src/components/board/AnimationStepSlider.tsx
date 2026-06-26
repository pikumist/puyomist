import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import type React from 'react';

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import type { AnimationStep } from '@/logics/AnimationStep';
import {
  chainAnimationStep,
  chainAnimationStepBack,
  chainAnimationStepForward
} from '@/store/puyoAppStore';

interface IProps {
  /** List of animation steps. */
  animationSteps: AnimationStep[];
  /** Active animation step index. */
  index: number;
}

/** Chain-animation scrubber (step back / slider / step forward). */
const AnimationStepSlider: React.FC<IProps> = (props) => {
  const { animationSteps, index } = props;

  const max = animationSteps.length - 1;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="コマ戻り"
              disabled={index <= 0}
              onClick={() => chainAnimationStepBack()}
            />
          }
        >
          <ChevronLeftIcon />
        </TooltipTrigger>
        <TooltipContent>コマ戻り</TooltipContent>
      </Tooltip>
      <Slider
        aria-label="アニメーションコマ"
        className="flex-1"
        value={index}
        min={0}
        max={Math.max(0, max)}
        step={1}
        onValueChange={(value) =>
          chainAnimationStep(Array.isArray(value) ? value[0] : value)
        }
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="outline"
              size="icon"
              aria-label="コマ送り"
              disabled={index >= max}
              onClick={() => chainAnimationStepForward()}
            />
          }
        >
          <ChevronRightIcon />
        </TooltipTrigger>
        <TooltipContent>コマ送り</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default AnimationStepSlider;
