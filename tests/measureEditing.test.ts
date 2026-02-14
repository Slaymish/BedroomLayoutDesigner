import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatMeasureLengthValue,
  getMeasureInputStep,
  getUnitDecimalPlaces,
  MIN_MEASURE_EDIT_LENGTH_CM,
  resizeMeasureToLengthInRoom,
} from '../src/utils/measureEditing.js';

const measureLength = (measure: { x1: number; y1: number; x2: number; y2: number }): number => (
  Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1)
);

test('resizeMeasureToLengthInRoom applies requested length when it fits', () => {
  const resized = resizeMeasureToLengthInRoom(
    { x1: 20, y1: 20, x2: 60, y2: 20 },
    60,
    100,
    100
  );
  assert.equal(resized.y1, 20);
  assert.equal(resized.y2, 20);
  assert.equal(resized.x1, 10);
  assert.equal(resized.x2, 70);
  assert.equal(measureLength(resized), 60);
});

test('resizeMeasureToLengthInRoom clamps to room bounds when target is too long', () => {
  const resized = resizeMeasureToLengthInRoom(
    { x1: 1, y1: 50, x2: 21, y2: 50 },
    100,
    100,
    100
  );
  assert.equal(resized.x1, 0);
  assert.equal(resized.x2, 22);
  assert.equal(measureLength(resized), 22);
});

test('resizeMeasureToLengthInRoom enforces minimum editable length', () => {
  const resized = resizeMeasureToLengthInRoom(
    { x1: 10, y1: 10, x2: 11, y2: 10 },
    0.5,
    100,
    100
  );
  assert.equal(measureLength(resized), MIN_MEASURE_EDIT_LENGTH_CM);
});

test('measure formatting helpers use unit-aware precision and steps', () => {
  assert.equal(getUnitDecimalPlaces('m'), 2);
  assert.equal(getUnitDecimalPlaces('ft'), 2);
  assert.equal(getUnitDecimalPlaces('cm'), 1);

  assert.equal(getMeasureInputStep('mm'), '1');
  assert.equal(getMeasureInputStep('m'), '0.01');
  assert.equal(getMeasureInputStep('cm'), '0.1');

  assert.equal(formatMeasureLengthValue(123.456, 'cm'), '123.5');
  assert.equal(formatMeasureLengthValue(123.456, 'm'), '1.23');
});
