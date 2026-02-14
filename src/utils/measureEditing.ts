import type { MeasureLine } from '../types.js';
import { fromBaseCm, type Unit } from './units.js';
import { clamp } from './geometry.js';

export const MIN_MEASURE_EDIT_LENGTH_CM = 2;

export const getMeasureLengthCm = (measure: Pick<MeasureLine, 'x1' | 'y1' | 'x2' | 'y2'>): number => (
  Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1)
);

export const getUnitDecimalPlaces = (unit: Unit): number => (
  unit === 'm' || unit === 'ft' ? 2 : 1
);

export const getMeasureInputStep = (unit: Unit): string => {
  if (unit === 'mm') return '1';
  if (unit === 'm' || unit === 'ft') return '0.01';
  return '0.1';
};

export const formatMeasureLengthValue = (lengthCm: number, unit: Unit): string => (
  Number(fromBaseCm(lengthCm, unit).toFixed(getUnitDecimalPlaces(unit))).toString()
);

export const resizeMeasureToLengthInRoom = (
  measure: Pick<MeasureLine, 'x1' | 'y1' | 'x2' | 'y2'>,
  targetLengthCm: number,
  roomWidthCm: number,
  roomHeightCm: number
): Pick<MeasureLine, 'x1' | 'y1' | 'x2' | 'y2'> => {
  const dx = measure.x2 - measure.x1;
  const dy = measure.y2 - measure.y1;
  const currentLength = Math.hypot(dx, dy);
  const directionX = currentLength > 0.0001 ? dx / currentLength : 1;
  const directionY = currentLength > 0.0001 ? dy / currentLength : 0;
  const centerX = (measure.x1 + measure.x2) / 2;
  const centerY = (measure.y1 + measure.y2) / 2;
  const absDirectionX = Math.abs(directionX);
  const absDirectionY = Math.abs(directionY);
  const maxHalfLengthX = absDirectionX < 0.0001
    ? Number.POSITIVE_INFINITY
    : Math.min(centerX / absDirectionX, (roomWidthCm - centerX) / absDirectionX);
  const maxHalfLengthY = absDirectionY < 0.0001
    ? Number.POSITIVE_INFINITY
    : Math.min(centerY / absDirectionY, (roomHeightCm - centerY) / absDirectionY);
  const maxHalfLength = Math.max(0, Math.min(maxHalfLengthX, maxHalfLengthY));
  if (maxHalfLength <= 0.0001) {
    return {
      x1: clamp(centerX, 0, roomWidthCm),
      y1: clamp(centerY, 0, roomHeightCm),
      x2: clamp(centerX, 0, roomWidthCm),
      y2: clamp(centerY, 0, roomHeightCm),
    };
  }

  const minHalfLength = Math.min(MIN_MEASURE_EDIT_LENGTH_CM / 2, maxHalfLength);
  const targetHalfLength = Math.max(
    minHalfLength,
    Math.min(targetLengthCm / 2, maxHalfLength)
  );

  return {
    x1: clamp(centerX - directionX * targetHalfLength, 0, roomWidthCm),
    y1: clamp(centerY - directionY * targetHalfLength, 0, roomHeightCm),
    x2: clamp(centerX + directionX * targetHalfLength, 0, roomWidthCm),
    y2: clamp(centerY + directionY * targetHalfLength, 0, roomHeightCm),
  };
};
