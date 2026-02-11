import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMeasureConstraint,
  getBedPresetIndex,
  projectPointToSegmentT,
  subtractIntervals,
} from '../src/utils/roomCanvasMath.js';

test('subtractIntervals removes cutouts and preserves solid spans', () => {
  const solids = subtractIntervals(100, [
    { start: 10, end: 20 },
    { start: 35, end: 50 },
    { start: 65, end: 70 },
  ]);

  assert.deepEqual(solids, [
    { start: 0, end: 10 },
    { start: 20, end: 35 },
    { start: 50, end: 65 },
    { start: 70, end: 100 },
  ]);
});

test('applyMeasureConstraint locks axis and snaps to nearby targets', () => {
  const constrained = applyMeasureConstraint(
    { x: 49, y: 17 },
    { x: 10, y: 10 },
    false,
    [{ x: 50, y: 10 }],
    120,
    90,
    12
  );

  assert.deepEqual(constrained, {
    point: { x: 50, y: 0 },
    snappedX: true,
    snappedY: true,
  });
});

test('projectPointToSegmentT returns midpoint for zero-length segments', () => {
  const t = projectPointToSegmentT(
    { x: 20, y: 25 },
    { x: 10, y: 10 },
    { x: 10, y: 10 }
  );

  assert.equal(t, 0.5);
});

test('getBedPresetIndex chooses exact or nearest bed preset', () => {
  const exact = getBedPresetIndex({
    id: 1,
    width: 150,
    height: 190,
    x: 0,
    y: 0,
    type: 'Bed',
  });
  assert.equal(exact, 3);

  const nearest = getBedPresetIndex({
    id: 2,
    width: 148,
    height: 188,
    x: 0,
    y: 0,
    type: 'Bed',
  });
  assert.equal(nearest, 3);
});
