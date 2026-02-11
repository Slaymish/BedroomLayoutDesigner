import { BED_SIZE_PRESETS } from '../constants/objectPresets.js';
import type { RoomItem } from '../types.js';

export interface Point {
  x: number;
  y: number;
}

export interface MeasureConstraintResult {
  point: Point;
  snappedX: boolean;
  snappedY: boolean;
}

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

export const getBedPresetIndex = (item: RoomItem): number => {
  const widthRounded = Math.round(item.width);
  const heightRounded = Math.round(item.height);
  const exact = BED_SIZE_PRESETS.findIndex(
    (preset) => Math.round(preset.widthCm) === widthRounded && Math.round(preset.heightCm) === heightRounded
  );
  if (exact >= 0) return exact;

  let closestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  BED_SIZE_PRESETS.forEach((preset, index) => {
    const distance = Math.abs(preset.widthCm - item.width) + Math.abs(preset.heightCm - item.height);
    if (distance < bestDistance) {
      bestDistance = distance;
      closestIndex = index;
    }
  });
  return closestIndex;
};

export const projectPointToSegmentT = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return 0.5;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq;
  return clamp(t, 0, 1);
};

export const subtractIntervals = (
  length: number,
  cutouts: Array<{ start: number; end: number }>,
  minSegmentLength = 0.2
): Array<{ start: number; end: number }> => {
  const normalized = cutouts
    .map((cutout) => ({
      start: clamp(Math.min(cutout.start, cutout.end), 0, length),
      end: clamp(Math.max(cutout.start, cutout.end), 0, length),
    }))
    .filter((cutout) => cutout.end > cutout.start)
    .sort((left, right) => left.start - right.start);

  const solids: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  normalized.forEach((cutout) => {
    if (cutout.start > cursor) {
      solids.push({ start: cursor, end: cutout.start });
    }
    cursor = Math.max(cursor, cutout.end);
  });
  if (cursor < length) {
    solids.push({ start: cursor, end: length });
  }
  return solids.filter((segment) => segment.end - segment.start > minSegmentLength);
};

export const applyMeasureConstraint = (
  raw: Point,
  anchor: Point,
  isFreeMove: boolean,
  snapTargets: Point[],
  roomWidthCm: number,
  roomHeightCm: number,
  snapThresholdCm: number
): MeasureConstraintResult => {
  const constrained: Point = {
    x: clamp(raw.x, 0, roomWidthCm),
    y: clamp(raw.y, 0, roomHeightCm),
  };

  if (isFreeMove) {
    return {
      point: constrained,
      snappedX: false,
      snappedY: false,
    };
  }

  const deltaX = Math.abs(constrained.x - anchor.x);
  const deltaY = Math.abs(constrained.y - anchor.y);
  if (deltaX >= deltaY) {
    constrained.y = anchor.y;
  } else {
    constrained.x = anchor.x;
  }

  let bestXDelta = snapThresholdCm + 1;
  let bestYDelta = snapThresholdCm + 1;

  const xCandidates = [0, roomWidthCm, ...snapTargets.map((point) => point.x)];
  const yCandidates = [0, roomHeightCm, ...snapTargets.map((point) => point.y)];

  xCandidates.forEach((candidate) => {
    const delta = Math.abs(candidate - constrained.x);
    if (delta < bestXDelta) {
      bestXDelta = delta;
      constrained.x = candidate;
    }
  });

  yCandidates.forEach((candidate) => {
    const delta = Math.abs(candidate - constrained.y);
    if (delta < bestYDelta) {
      bestYDelta = delta;
      constrained.y = candidate;
    }
  });

  return {
    point: {
      x: clamp(constrained.x, 0, roomWidthCm),
      y: clamp(constrained.y, 0, roomHeightCm),
    },
    snappedX: bestXDelta <= snapThresholdCm,
    snappedY: bestYDelta <= snapThresholdCm,
  };
};
