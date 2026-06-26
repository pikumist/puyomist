import type {
  DraggableSyntheticListeners,
  UniqueIdentifier
} from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon } from 'lucide-react';
import type React from 'react';
import {
  type CSSProperties,
  type PropsWithChildren,
  createContext,
  useContext,
  useMemo
} from 'react';

import { cn } from '@/lib/utils';

interface Props {
  id: UniqueIdentifier;
}

interface Context {
  attributes: Record<string, unknown>;
  listeners: DraggableSyntheticListeners;
  ref(node: HTMLElement | null): void;
}

const SortableItemContext = createContext<Context>({
  attributes: {},
  listeners: undefined,
  ref() {}
});

export const SortableItem = ({ children, id }: PropsWithChildren<Props>) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition
  } = useSortable({ id });
  const context = useMemo<Context>(
    () => ({
      attributes: attributes as unknown as Record<string, unknown>,
      listeners,
      ref: setActivatorNodeRef
    }),
    [attributes, listeners, setActivatorNodeRef]
  );
  const style: CSSProperties = {
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Translate.toString(transform),
    transition
  };

  return (
    <SortableItemContext.Provider value={context}>
      <div ref={setNodeRef} style={style}>
        {children}
      </div>
    </SortableItemContext.Provider>
  );
};

export default SortableItem;

interface DragHandleProps {
  className?: string;
}

export const DragHandle: React.FC<DragHandleProps> = ({ className }) => {
  const { attributes, listeners, ref } = useContext(SortableItemContext);

  return (
    <button
      type="button"
      aria-label="ドラッグして並べ替え"
      className={cn(
        'flex cursor-grab touch-none items-center justify-center rounded-md p-1 text-muted-foreground outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...attributes}
      {...listeners}
      ref={ref}
    >
      <GripVerticalIcon className="size-3.5" />
    </button>
  );
};
