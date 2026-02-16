import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPointerTravelDistance,
  hasPointerExceededDragThreshold,
} from '../src/utils/pointerDrag.js';

test('getPointerTravelDistance returns euclidean distance', () => {
  assert.equal(getPointerTravelDistance({ x: 5, y: 7 }, { x: 8, y: 11 }), 5);
});

test('hasPointerExceededDragThreshold is false below threshold and true at threshold', () => {
  const start = { x: 10, y: 10 };
  const end = { x: 13, y: 14 };

  assert.equal(hasPointerExceededDragThreshold(start, end, 5.1), false);
  assert.equal(hasPointerExceededDragThreshold(start, end, 5), true);
});

test('hasPointerExceededDragThreshold clamps negative thresholds to zero', () => {
  assert.equal(
    hasPointerExceededDragThreshold({ x: 1, y: 1 }, { x: 1, y: 1 }, -2),
    true
  );
});
