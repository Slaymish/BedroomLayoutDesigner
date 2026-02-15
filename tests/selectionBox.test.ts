import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSelectionBounds,
  getSelectableItemIds,
  getSelectionDragDistance,
  getSelectionSize,
} from '../src/utils/selectionBox.js';
import type { RoomItem } from '../src/types.js';

const item = (input: Partial<RoomItem> & Pick<RoomItem, 'id' | 'x' | 'y' | 'width' | 'height'>): RoomItem => ({
  id: input.id,
  x: input.x,
  y: input.y,
  width: input.width,
  height: input.height,
  rotate: input.rotate ?? 0,
  type: input.type ?? 'Desk',
});

test('createSelectionBounds normalizes left/top/right/bottom regardless of drag direction', () => {
  const bounds = createSelectionBounds({ x: 280, y: 200 }, { x: 120, y: 40 });
  assert.deepEqual(bounds, { left: 120, top: 40, right: 280, bottom: 200 });
  assert.deepEqual(getSelectionSize(bounds), { width: 160, height: 160 });
});

test('getSelectionDragDistance returns euclidean drag distance', () => {
  assert.equal(getSelectionDragDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test('getSelectableItemIds includes intersecting items by default', () => {
  const items = [
    item({ id: 1, x: 20, y: 20, width: 40, height: 30 }),
    item({ id: 2, x: 200, y: 180, width: 50, height: 50 }),
    item({ id: 3, x: 75, y: 40, width: 40, height: 40 }),
  ];

  const selected = getSelectableItemIds(items, createSelectionBounds({ x: 0, y: 0 }, { x: 120, y: 100 }));
  assert.deepEqual(selected, [1, 3]);
});

test('getSelectableItemIds can require full containment', () => {
  const items = [
    item({ id: 1, x: 20, y: 20, width: 40, height: 40 }),
    item({ id: 2, x: 90, y: 90, width: 50, height: 50 }),
  ];

  const selection = createSelectionBounds({ x: 0, y: 0 }, { x: 120, y: 120 });
  const selected = getSelectableItemIds(items, selection, { mode: 'contain' });
  assert.deepEqual(selected, [1]);
});

test('getSelectableItemIds uses rotated bounding extents for hit-testing', () => {
  const items = [
    item({ id: 1, x: 100, y: 100, width: 80, height: 40, rotate: 45 }),
  ];

  const selection = createSelectionBounds({ x: 118, y: 150 }, { x: 132, y: 158 });
  const selected = getSelectableItemIds(items, selection);
  assert.deepEqual(selected, [1]);
});

test('getSelectableItemIds supports includeItem filter', () => {
  const items = [
    item({ id: 1, x: 10, y: 10, width: 30, height: 30, type: 'Desk' }),
    item({ id: 2, x: 20, y: 20, width: 30, height: 30, type: 'Door' }),
  ];

  const selected = getSelectableItemIds(
    items,
    createSelectionBounds({ x: 0, y: 0 }, { x: 60, y: 60 }),
    { includeItem: (candidate) => candidate.type !== 'Door' }
  );

  assert.deepEqual(selected, [1]);
});
