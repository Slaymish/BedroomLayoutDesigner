import type { RoomItem } from '../types';
import { getBoundingBox } from './geometry.js';

export interface SelectionPoint {
  x: number;
  y: number;
}

export interface SelectionBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface SelectionQueryOptions {
  mode?: 'intersect' | 'contain';
  includeItem?: (item: RoomItem) => boolean;
}

export const createSelectionBounds = (start: SelectionPoint, end: SelectionPoint): SelectionBounds => ({
  left: Math.min(start.x, end.x),
  top: Math.min(start.y, end.y),
  right: Math.max(start.x, end.x),
  bottom: Math.max(start.y, end.y),
});

export const getSelectionDragDistance = (start: SelectionPoint, end: SelectionPoint): number => (
  Math.hypot(end.x - start.x, end.y - start.y)
);

export const getSelectionSize = (bounds: SelectionBounds): { width: number; height: number } => ({
  width: Math.max(0, bounds.right - bounds.left),
  height: Math.max(0, bounds.bottom - bounds.top),
});

const getItemBounds = (item: RoomItem): SelectionBounds => {
  const bbox = getBoundingBox(item.width, item.height, item.rotate);
  const insetX = (bbox.width - item.width) / 2;
  const insetY = (bbox.height - item.height) / 2;

  return {
    left: item.x - insetX,
    top: item.y - insetY,
    right: item.x + item.width + insetX,
    bottom: item.y + item.height + insetY,
  };
};

const intersects = (selection: SelectionBounds, candidate: SelectionBounds): boolean => (
  selection.left <= candidate.right &&
  selection.right >= candidate.left &&
  selection.top <= candidate.bottom &&
  selection.bottom >= candidate.top
);

const contains = (selection: SelectionBounds, candidate: SelectionBounds): boolean => (
  selection.left <= candidate.left &&
  selection.top <= candidate.top &&
  selection.right >= candidate.right &&
  selection.bottom >= candidate.bottom
);

export const getSelectableItemIds = (
  items: RoomItem[],
  selection: SelectionBounds,
  options: SelectionQueryOptions = {}
): number[] => {
  const mode = options.mode ?? 'intersect';
  const includeItem = options.includeItem ?? (() => true);
  return items
    .filter((item) => includeItem(item))
    .filter((item) => {
      const bounds = getItemBounds(item);
      return mode === 'contain' ? contains(selection, bounds) : intersects(selection, bounds);
    })
    .map((item) => item.id);
};
