/**
 * Tailwind port of the dnd-kit sortable list.
 * [Original](https://codesandbox.io/s/dnd-kit-sortable-starter-template-22x1ix)
 */

import {
  type Active,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { Fragment, type ReactNode, useMemo, useState } from 'react';

import { PreferenceKind } from '@/logics/ExplorationTarget';
import SortableItem, { DragHandle } from './SortableItem';
import SortableOverlay from './SortableOverlay';

interface BaseItem {
  id: UniqueIdentifier;
}

interface Props<T extends BaseItem> {
  items: T[];
  onChange(items: T[]): void;
  renderItem(item: T): ReactNode;
}

const SortableList = <T extends BaseItem>(props: Props<T>) => {
  const { items, onChange, renderItem } = props;
  const [active, setActive] = useState<Active | null>(null);
  const activeItem = useMemo(
    () => items.find((item) => item.id === active?.id),
    [active, items]
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  return (
    <DndContext
      modifiers={[restrictToVerticalAxis]}
      sensors={sensors}
      onDragStart={({ active }) => {
        setActive(active);
      }}
      onDragEnd={({ active, over }) => {
        if (over) {
          if (active.id !== over?.id) {
            const activeIndex = items.findIndex(({ id }) => id === active.id);
            const overIndex = items.findIndex(({ id }) => id === over.id);
            onChange(arrayMove(items, activeIndex, overIndex));
          }
        } else {
          const pref = active.id as PreferenceKind;
          if (
            pref !== PreferenceKind.BiggerValue &&
            pref !== PreferenceKind.SmallerValue
          ) {
            const activeIndex = items.findIndex(({ id }) => id === active.id);
            const newItems = [...items];
            newItems.splice(activeIndex, 1);
            onChange(newItems);
          }
        }
        setActive(null);
      }}
      onDragCancel={() => {
        setActive(null);
      }}
    >
      <SortableContext items={items}>
        <div className="flex max-h-[276px] flex-col gap-1 overflow-hidden">
          {items.map((item) => (
            <Fragment key={item.id}>{renderItem(item)}</Fragment>
          ))}
        </div>
      </SortableContext>
      <SortableOverlay>
        {activeItem ? renderItem(activeItem) : null}
      </SortableOverlay>
    </DndContext>
  );
};

SortableList.DragHandle = DragHandle;
SortableList.Item = SortableItem;

export default SortableList;
