/**
 * [The original](https://codesandbox.io/s/dnd-kit-sortable-starter-template-22x1ix)
 */

import { Stack } from '@chakra-ui/react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { Active, UniqueIdentifier } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { Fragment, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { PreferenceKind } from '../../logics/ExplorationTarget';
import SortableItem, { DragHandle } from './parts/SortableItem';
import SortableOverlay from './parts/SortableOverlay';

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
        {/* item内でメニューを開くと高さがバグってスクロールバーが出てしまうのでXY方向のoverflowを無くしている */}
        <Stack gap="1" maxH="276px" overflowY="hidden" overflowX="hidden">
          {items.map((item) => (
            <Fragment key={item.id}>{renderItem(item)}</Fragment>
          ))}
        </Stack>
      </SortableContext>
      <SortableOverlay>
        {activeItem ? renderItem(activeItem) : null}
      </SortableOverlay>
    </DndContext>
  );
};

export default SortableList;

SortableList.DragHandle = DragHandle;
SortableList.Item = SortableItem;
