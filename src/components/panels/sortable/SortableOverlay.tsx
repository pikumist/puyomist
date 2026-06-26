import {
  DragOverlay,
  type DropAnimation,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import type { PropsWithChildren } from 'react';

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4'
      }
    }
  })
};

const SortableOverlay = ({ children }: PropsWithChildren) => {
  return (
    <DragOverlay dropAnimation={dropAnimationConfig}>{children}</DragOverlay>
  );
};

export default SortableOverlay;
