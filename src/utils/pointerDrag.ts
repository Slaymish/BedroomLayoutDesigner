export interface PointerCoordinate {
  x: number;
  y: number;
}

export const getPointerTravelDistance = (
  start: PointerCoordinate,
  end: PointerCoordinate
): number => Math.hypot(end.x - start.x, end.y - start.y);

export const hasPointerExceededDragThreshold = (
  start: PointerCoordinate,
  end: PointerCoordinate,
  threshold: number
): boolean => getPointerTravelDistance(start, end) >= Math.max(0, threshold);
