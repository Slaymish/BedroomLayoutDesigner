import type { OpeningWall, RoomDesign, RoomItem } from '../types.js';
import { inferWallFromRotation, isOpening } from './openings.js';

export type FengShuiRuleId =
  | 'bed-not-facing-door'
  | 'bed-headboard-solid-wall'
  | 'bed-not-under-window'
  | 'door-clearance-open';

export interface FengShuiRuleDefinition {
  id: FengShuiRuleId;
  title: string;
  guidance: string;
}

export interface FengShuiRuleViolation {
  ruleId: FengShuiRuleId;
  title: string;
  detail: string;
}

export interface FengShuiAssessment {
  evaluatedRules: number;
  violations: FengShuiRuleViolation[];
}

export const FENG_SHUI_RULES: readonly FengShuiRuleDefinition[] = [
  {
    id: 'bed-not-facing-door',
    title: 'Bed should not directly face a door',
    guidance: 'Avoid pointing the foot of the bed straight at a doorway.',
  },
  {
    id: 'bed-headboard-solid-wall',
    title: 'Bed headboard should be near a solid wall',
    guidance: 'Anchor the head of the bed close to a wall for stability.',
  },
  {
    id: 'bed-not-under-window',
    title: 'Bed should not sit directly under a window',
    guidance: 'Keep beds away from window zones when possible.',
  },
  {
    id: 'door-clearance-open',
    title: 'Keep the immediate door path clear',
    guidance: 'Leave the first part of the room inside each door unobstructed.',
  },
];

interface Point {
  x: number;
  y: number;
}

interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Span {
  start: number;
  end: number;
}

const BED_TO_DOOR_ALIGNMENT_COS = Math.cos((50 * Math.PI) / 180);
const BED_HEADBOARD_MAX_WALL_DISTANCE_CM = 28;
const BED_WINDOW_CLEARANCE_CM = 60;
const OPENING_MIN_OVERLAP_CM = 20;
const DOOR_CLEARANCE_DEPTH_CM = 90;
const DOOR_CLEARANCE_SIDE_PADDING_CM = 24;

const toRadians = (rotation: number): number => (rotation * Math.PI) / 180;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const normalizeType = (value: string | undefined): string => (value || '').trim().toLowerCase();

const isBed = (item: RoomItem): boolean => normalizeType(item.type) === 'bed';

const isDoor = (item: RoomItem): boolean => normalizeType(item.type) === 'door';

const isWindow = (item: RoomItem): boolean => normalizeType(item.type) === 'window';

const getItemCenter = (item: RoomItem): Point => ({
  x: item.x + item.width / 2,
  y: item.y + item.height / 2,
});

const getRotatedCorners = (item: RoomItem): Point[] => {
  const center = getItemCenter(item);
  const rotation = toRadians(item.rotate ?? 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfWidth = item.width / 2;
  const halfHeight = item.height / 2;
  const localCorners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return localCorners.map((corner) => ({
    x: center.x + corner.x * cos - corner.y * sin,
    y: center.y + corner.x * sin + corner.y * cos,
  }));
};

const getItemAabb = (item: RoomItem): Rect => {
  const corners = getRotatedCorners(item);
  return {
    minX: corners.reduce((min, corner) => Math.min(min, corner.x), Number.POSITIVE_INFINITY),
    minY: corners.reduce((min, corner) => Math.min(min, corner.y), Number.POSITIVE_INFINITY),
    maxX: corners.reduce((max, corner) => Math.max(max, corner.x), Number.NEGATIVE_INFINITY),
    maxY: corners.reduce((max, corner) => Math.max(max, corner.y), Number.NEGATIVE_INFINITY),
  };
};

const getOpeningWall = (item: RoomItem): OpeningWall | null => (
  item.openingWall ?? inferWallFromRotation(item.rotate) ?? null
);

const getOpeningSpan = (item: RoomItem, wall: OpeningWall): Span => {
  const center = getItemCenter(item);
  if (wall === 'top' || wall === 'bottom') {
    return {
      start: center.x - item.width / 2,
      end: center.x + item.width / 2,
    };
  }
  return {
    start: center.y - item.width / 2,
    end: center.y + item.width / 2,
  };
};

const overlapAmount = (startA: number, endA: number, startB: number, endB: number): number => (
  Math.max(0, Math.min(endA, endB) - Math.max(startA, startB))
);

const rectsOverlap = (left: Rect, right: Rect): boolean => (
  overlapAmount(left.minX, left.maxX, right.minX, right.maxX) > 0 &&
  overlapAmount(left.minY, left.maxY, right.minY, right.maxY) > 0
);

const summarizeObjectTypes = (items: RoomItem[]): string => {
  const labels = Array.from(
    new Set(
      items.map((item) => {
        const type = (item.type || '').trim();
        return type || `Object #${item.id}`;
      })
    )
  );

  if (labels.length <= 1) return labels[0] || 'objects';
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels[0]}, ${labels[1]}, and ${labels.length - 2} more`;
};

const getRuleTitle = (ruleId: FengShuiRuleId): string => (
  FENG_SHUI_RULES.find((rule) => rule.id === ruleId)?.title ?? ruleId
);

const isBedFacingDoor = (bed: RoomItem, doors: RoomItem[]): boolean => {
  const bedCenter = getItemCenter(bed);
  const rotation = toRadians(bed.rotate ?? 0);
  const bedFootDirection = {
    x: -Math.sin(rotation),
    y: Math.cos(rotation),
  };

  return doors.some((door) => {
    const doorCenter = getItemCenter(door);
    const toDoor = {
      x: doorCenter.x - bedCenter.x,
      y: doorCenter.y - bedCenter.y,
    };
    const distance = Math.hypot(toDoor.x, toDoor.y);
    if (distance < 1) return false;
    const normalized = {
      x: toDoor.x / distance,
      y: toDoor.y / distance,
    };
    const facingAmount = normalized.x * bedFootDirection.x + normalized.y * bedFootDirection.y;
    return facingAmount >= BED_TO_DOOR_ALIGNMENT_COS;
  });
};

const isBedHeadboardNearWall = (bed: RoomItem, roomWidthCm: number, roomHeightCm: number): boolean => {
  const center = getItemCenter(bed);
  const rotation = toRadians(bed.rotate ?? 0);
  const headboardPoint = {
    x: center.x + Math.sin(rotation) * (bed.height / 2),
    y: center.y - Math.cos(rotation) * (bed.height / 2),
  };
  const nearestWallDistance = Math.min(
    headboardPoint.x,
    roomWidthCm - headboardPoint.x,
    headboardPoint.y,
    roomHeightCm - headboardPoint.y
  );
  return nearestWallDistance <= BED_HEADBOARD_MAX_WALL_DISTANCE_CM;
};

const isBedUnderWindow = (
  bedAabb: Rect,
  windowItem: RoomItem,
  roomWidthCm: number,
  roomHeightCm: number
): boolean => {
  const wall = getOpeningWall(windowItem);
  if (!wall) return false;
  const span = getOpeningSpan(windowItem, wall);

  if (wall === 'top') {
    if (bedAabb.minY > BED_WINDOW_CLEARANCE_CM) return false;
    return overlapAmount(span.start, span.end, bedAabb.minX, bedAabb.maxX) >= OPENING_MIN_OVERLAP_CM;
  }
  if (wall === 'bottom') {
    if (roomHeightCm - bedAabb.maxY > BED_WINDOW_CLEARANCE_CM) return false;
    return overlapAmount(span.start, span.end, bedAabb.minX, bedAabb.maxX) >= OPENING_MIN_OVERLAP_CM;
  }
  if (wall === 'left') {
    if (bedAabb.minX > BED_WINDOW_CLEARANCE_CM) return false;
    return overlapAmount(span.start, span.end, bedAabb.minY, bedAabb.maxY) >= OPENING_MIN_OVERLAP_CM;
  }
  if (roomWidthCm - bedAabb.maxX > BED_WINDOW_CLEARANCE_CM) return false;
  return overlapAmount(span.start, span.end, bedAabb.minY, bedAabb.maxY) >= OPENING_MIN_OVERLAP_CM;
};

const getDoorClearanceRect = (
  door: RoomItem,
  roomWidthCm: number,
  roomHeightCm: number
): Rect | null => {
  const wall = getOpeningWall(door);
  if (!wall) return null;
  const span = getOpeningSpan(door, wall);

  if (wall === 'top') {
    return {
      minX: clamp(span.start - DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomWidthCm),
      maxX: clamp(span.end + DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomWidthCm),
      minY: 0,
      maxY: Math.min(roomHeightCm, DOOR_CLEARANCE_DEPTH_CM),
    };
  }
  if (wall === 'bottom') {
    return {
      minX: clamp(span.start - DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomWidthCm),
      maxX: clamp(span.end + DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomWidthCm),
      minY: Math.max(0, roomHeightCm - DOOR_CLEARANCE_DEPTH_CM),
      maxY: roomHeightCm,
    };
  }
  if (wall === 'left') {
    return {
      minX: 0,
      maxX: Math.min(roomWidthCm, DOOR_CLEARANCE_DEPTH_CM),
      minY: clamp(span.start - DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomHeightCm),
      maxY: clamp(span.end + DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomHeightCm),
    };
  }
  return {
    minX: Math.max(0, roomWidthCm - DOOR_CLEARANCE_DEPTH_CM),
    maxX: roomWidthCm,
    minY: clamp(span.start - DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomHeightCm),
    maxY: clamp(span.end + DOOR_CLEARANCE_SIDE_PADDING_CM, 0, roomHeightCm),
  };
};

export const evaluateRoomFengShui = (room: RoomDesign): FengShuiAssessment => {
  const doors = room.items.filter(isDoor);
  const windows = room.items.filter(isWindow);
  const beds = room.items.filter(isBed);
  const furniture = room.items.filter((item) => !isOpening(item));
  const violations: FengShuiRuleViolation[] = [];

  const bedsFacingDoor = doors.length > 0 ? beds.filter((bed) => isBedFacingDoor(bed, doors)) : [];
  if (bedsFacingDoor.length > 0) {
    violations.push({
      ruleId: 'bed-not-facing-door',
      title: getRuleTitle('bed-not-facing-door'),
      detail: `${bedsFacingDoor.length} bed${bedsFacingDoor.length === 1 ? '' : 's'} point directly toward a door.`,
    });
  }

  const unsupportedBeds = beds.filter((bed) => !isBedHeadboardNearWall(bed, room.roomWidthCm, room.roomHeightCm));
  if (unsupportedBeds.length > 0) {
    violations.push({
      ruleId: 'bed-headboard-solid-wall',
      title: getRuleTitle('bed-headboard-solid-wall'),
      detail: `${unsupportedBeds.length} bed${unsupportedBeds.length === 1 ? '' : 's'} have headboards floating away from the wall.`,
    });
  }

  const bedsUnderWindows = windows.length > 0
    ? beds.filter((bed) => {
      const bedAabb = getItemAabb(bed);
      return windows.some((windowItem) => isBedUnderWindow(bedAabb, windowItem, room.roomWidthCm, room.roomHeightCm));
    })
    : [];
  if (bedsUnderWindows.length > 0) {
    violations.push({
      ruleId: 'bed-not-under-window',
      title: getRuleTitle('bed-not-under-window'),
      detail: `${bedsUnderWindows.length} bed${bedsUnderWindows.length === 1 ? '' : 's'} sit inside a window zone.`,
    });
  }

  const doorClearanceZones = doors
    .map((door) => getDoorClearanceRect(door, room.roomWidthCm, room.roomHeightCm))
    .filter((zone): zone is Rect => zone !== null);
  const blockedBy = doorClearanceZones.length > 0
    ? furniture.filter((item) => {
      const aabb = getItemAabb(item);
      return doorClearanceZones.some((zone) => rectsOverlap(aabb, zone));
    })
    : [];
  if (blockedBy.length > 0) {
    violations.push({
      ruleId: 'door-clearance-open',
      title: getRuleTitle('door-clearance-open'),
      detail: `Door entry space is blocked by ${summarizeObjectTypes(blockedBy)}.`,
    });
  }

  return {
    evaluatedRules: FENG_SHUI_RULES.length,
    violations,
  };
};
