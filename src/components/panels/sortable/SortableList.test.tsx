import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PreferenceKind } from '@/logics/ExplorationTarget';
import { DragHandle } from './SortableItem';
import SortableItem from './SortableItem';
import SortableList from './SortableList';

interface Item {
  id: string | PreferenceKind;
}

const renderRow = (item: Item) => (
  <SortableList.Item id={item.id}>
    <div>
      <span>{item.id}</span>
      <SortableList.DragHandle />
    </div>
  </SortableList.Item>
);

const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

/**
 * jsdom lays out every element at (0, 0) unless `getBoundingClientRect` is
 * overridden, which would make every sortable row occupy the exact same
 * rect. dnd-kit's keyboard/pointer collision detection relies on rects
 * differing between rows to figure out which row is "above"/"below"/"under
 * the pointer", so we stub the rect for each row based on its id.
 *
 * `SortableList` re-invokes `renderItem` for the `DragOverlay` clone of the
 * item currently being dragged, which mounts a *second* `SortableItem`
 * (i.e. a second `useSortable({ id })`) for that same id while the drag is
 * in progress. Rather than trying to track which of the two same-id DOM
 * nodes dnd-kit ends up treating as canonical (an internal detail we don't
 * want this test to depend on), we key the mocked rect off the row's id
 * (read from its rendered text) so both nodes report the identical,
 * correct rect for a given id no matter where they sit in the DOM.
 */
let originalGetBoundingClientRect: () => DOMRect;
let idToTop: Record<string, number> = {};

const makeRect = (top: number, height: number): DOMRect =>
  ({
    x: 0,
    y: top,
    width: 200,
    height,
    top,
    left: 0,
    right: 200,
    bottom: top + height,
    toJSON() {
      return {};
    }
  }) as DOMRect;

/** Row height used by the mocked rects below. */
const ROW_HEIGHT = 60;

const setupItemRects = (items: { id: string | number }[]) => {
  idToTop = {};
  items.forEach((item, index) => {
    idToTop[String(item.id)] = index * ROW_HEIGHT;
  });
};

beforeEach(() => {
  originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    // A row's outer wrapper (rendered by `SortableItem`, either in the
    // list or inside the `DragOverlay` clone) has the shape
    // `<div><div><span>{id}</span><button/></div></div>`.
    const inner = this.firstElementChild;
    const span =
      inner?.tagName === 'DIV' ? inner.querySelector(':scope > span') : null;
    if (span?.textContent != null && span.textContent in idToTop) {
      return makeRect(idToTop[span.textContent], 50);
    }
    // The list's own container: give it a rect spanning every row so that
    // dnd-kit's scrollable-ancestor bookkeeping (it's the only
    // `overflow-hidden` ancestor) sees sane bounds.
    if (this.classList.contains('overflow-hidden')) {
      return makeRect(0, Object.keys(idToTop).length * ROW_HEIGHT);
    }
    return makeRect(-10000, 1);
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe('SortableList', () => {
  it('exposes DragHandle and Item as static members', () => {
    expect(SortableList.DragHandle).toBe(DragHandle);
    expect(SortableList.Item).toBe(SortableItem);
  });

  it('renders nothing but the (empty) container when there are no items', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SortableList<Item>
        items={[]}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(screen.queryAllByLabelText('ドラッグして並べ替え')).toHaveLength(0);
  });

  it('renders one drag handle per item', () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const onChange = vi.fn();
    setupItemRects(items);
    render(
      <SortableList<Item>
        items={items}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.getAllByLabelText('ドラッグして並べ替え')).toHaveLength(3);
  });

  it('reorders items and calls onChange when dropped over a different item (keyboard sensor)', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const onChange = vi.fn();
    setupItemRects(items);
    render(
      <SortableList<Item>
        items={items}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    // Pick up the first row ("a").
    fireEvent.keyDown(handles[0], { code: 'Space' });
    // The keyboard sensor attaches its document-level keydown listener in a
    // setTimeout(0), so let that flush before sending movement keys.
    await tick();
    // Move it down past "b".
    fireEvent.keyDown(document, { code: 'ArrowDown' });
    // Drop.
    fireEvent.keyDown(document, { code: 'Space' });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((item: Item) => item.id)).toEqual([
      'b',
      'a',
      'c'
    ]);
  });

  it('does not call onChange when dropped back onto its own position (active.id === over.id)', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const onChange = vi.fn();
    setupItemRects(items);
    render(
      <SortableList<Item>
        items={items}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    // Pick up and immediately drop without moving.
    fireEvent.keyDown(handles[1], { code: 'Space' });
    await tick();
    fireEvent.keyDown(document, { code: 'Space' });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when the drag is cancelled (Escape)', async () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const onChange = vi.fn();
    setupItemRects(items);
    render(
      <SortableList<Item>
        items={items}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    fireEvent.keyDown(handles[0], { code: 'Space' });
    await tick();
    fireEvent.keyDown(document, { code: 'ArrowDown' });
    fireEvent.keyDown(document, { code: 'Escape' });
    // Flush the `setActive(null)` state update triggered by onDragCancel.
    await tick();

    expect(onChange).not.toHaveBeenCalled();
    // The list is left untouched.
    expect(screen.getAllByLabelText('ドラッグして並べ替え')).toHaveLength(3);
  });

  // The `over === null` branch of onDragEnd (dropped outside any droppable
  // area) can't be reached through the keyboard sensor: its coordinate
  // getter (sortableKeyboardCoordinates) only ever proposes a new position
  // that exactly matches another row's rect, so the dragged row is always
  // "over" something (or, if no candidate exists, movement is a no-op and
  // it stays over itself). Only the pointer sensor can move the drag
  // further than any droppable's rect, so we drive it directly with
  // pointer events instead.
  it('removes the item when dropped outside the list (pointer sensor, over === null)', () => {
    const items: Item[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const onChange = vi.fn();
    setupItemRects(items);
    render(
      <SortableList<Item>
        items={items}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    fireEvent.pointerDown(handles[1], {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 60
    });
    // Move far below every row's mocked rect (rows occupy y ranges up to
    // 170), so no droppable rect intersects anymore -> over === null.
    fireEvent.pointerMove(document, {
      pointerId: 1,
      isPrimary: true,
      clientX: 0,
      clientY: 5000
    });
    fireEvent.pointerUp(document, {
      pointerId: 1,
      isPrimary: true,
      clientX: 0,
      clientY: 5000
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((item: Item) => item.id)).toEqual([
      'a',
      'c'
    ]);
  });

  it('does not remove the item when dropped outside the list if it is a value preference (BiggerValue/SmallerValue)', () => {
    const items: Item[] = [
      { id: PreferenceKind.BiggerValue },
      { id: PreferenceKind.SmallerValue },
      { id: 'other' }
    ];
    const onChange = vi.fn();
    setupItemRects(items);
    render(
      <SortableList<Item>
        items={items}
        onChange={onChange}
        renderItem={renderRow}
      />
    );
    const handles = screen.getAllByLabelText('ドラッグして並べ替え');

    fireEvent.pointerDown(handles[0], {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 0,
      clientY: 0
    });
    fireEvent.pointerMove(document, {
      pointerId: 1,
      isPrimary: true,
      clientX: 0,
      clientY: 5000
    });
    fireEvent.pointerUp(document, {
      pointerId: 1,
      isPrimary: true,
      clientX: 0,
      clientY: 5000
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
