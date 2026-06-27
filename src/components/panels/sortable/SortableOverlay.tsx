import {
  DragOverlay,
  type DropAnimation,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import type { PropsWithChildren } from 'react';
import { createPortal } from 'react-dom';

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
  // Render the overlay into <body> so it escapes any ancestor that creates a
  // containing block for `position: fixed` (e.g. `.panel`'s `backdrop-filter`).
  // Otherwise the fixed overlay is positioned relative to that panel instead of
  // the viewport, so it jumps toward the lower-right on pickup — which in turn
  // grows the scroll area and can drop the item outside the list. React context
  // (DndContext) still flows through the portal.
  return createPortal(
    <DragOverlay dropAnimation={dropAnimationConfig}>{children}</DragOverlay>,
    document.body
  );
};

export default SortableOverlay;
