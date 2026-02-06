import type { OpeningWall, RoomItem } from "../types";

const OPENING_TYPES = new Set(['Door', 'Window']);

export const isOpening = (item: RoomItem): boolean => OPENING_TYPES.has(item.type || '');

export const rotationForWall = (wall: OpeningWall): number => {
  switch (wall) {
    case 'top':
      return 180;
    case 'right':
      return 270;
    case 'bottom':
      return 0;
    case 'left':
      return 90;
    default:
      return 0;
  }
};

const normalizeRotation = (rotate: number): number => {
  return ((Math.round(rotate / 90) * 90) % 360 + 360) % 360;
};

export const inferWallFromRotation = (rotate?: number): OpeningWall | null => {
  if (!Number.isFinite(rotate)) return null;

  switch (normalizeRotation(rotate || 0)) {
    case 180:
      return 'top';
    case 270:
      return 'right';
    case 0:
      return 'bottom';
    case 90:
      return 'left';
    default:
      return null;
  }
};

export const inferNearestWall = (
  x: number,
  y: number,
  roomWidthCm: number,
  roomHeightCm: number
): OpeningWall => {
  const distances: Array<{ wall: OpeningWall; distance: number }> = [
    { wall: 'top', distance: Math.abs(y) },
    { wall: 'right', distance: Math.abs(roomWidthCm - x) },
    { wall: 'bottom', distance: Math.abs(roomHeightCm - y) },
    { wall: 'left', distance: Math.abs(x) },
  ];
  distances.sort((a, b) => a.distance - b.distance);
  return distances[0].wall;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export const normalizeOpeningOnWall = (
  item: RoomItem,
  wall: OpeningWall,
  roomWidthCm: number,
  roomHeightCm: number
): RoomItem => {
  const width = Math.max(1, item.width);
  const height = Math.max(1, item.height);
  const centerX = item.x + width / 2;
  const centerY = item.y + height / 2;

  if (wall === 'top' || wall === 'bottom') {
    const clampedCenterX = clamp(centerX, width / 2, roomWidthCm - width / 2);
    return {
      ...item,
      width,
      height,
      x: clampedCenterX - width / 2,
      y: wall === 'top' ? -height / 2 : roomHeightCm - height / 2,
      rotate: rotationForWall(wall),
      openingWall: wall,
    };
  }

  const clampedCenterY = clamp(centerY, width / 2, roomHeightCm - width / 2);
  return {
    ...item,
    width,
    height,
    x: wall === 'left' ? -width / 2 : roomWidthCm - width / 2,
    y: clampedCenterY - height / 2,
    rotate: rotationForWall(wall),
    openingWall: wall,
  };
};

export const snapOpeningToNearestWall = (
  item: RoomItem,
  pointerX: number,
  pointerY: number,
  roomWidthCm: number,
  roomHeightCm: number
): RoomItem => {
  const wall = inferNearestWall(pointerX, pointerY, roomWidthCm, roomHeightCm);
  const roughPosition = {
    ...item,
    x: pointerX - item.width / 2,
    y: pointerY - item.height / 2,
  };
  return normalizeOpeningOnWall(roughPosition, wall, roomWidthCm, roomHeightCm);
};

