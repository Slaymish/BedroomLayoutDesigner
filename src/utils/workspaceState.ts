import type {
  MeasureLine,
  OnboardingStep,
  OpeningWall,
  Preferences,
  RoomDesign,
  RoomItem,
  RoomSetupState,
  WorkspaceState,
} from '../types.js';
import { fromBaseCm, type Unit } from './units.js';
import {
  inferNearestWall,
  inferWallFromRotation,
  isOpening,
  normalizeOpeningOnWall,
} from './openings.js';

interface LegacyStoredLayoutState {
  version?: number;
  onboardingComplete?: boolean;
  onboardingStep?: OnboardingStep;
  roomWidthCm?: number;
  roomHeightCm?: number;
  items?: RoomItem[];
  preferences?: Preferences;
  nextItemId?: number;
}

export interface WorkspaceSnapshot {
  rooms: RoomDesign[];
  activeRoomId: string;
}

export const STORAGE_KEY = 'bedroom-layout-designer:v1';
export const WORKSPACE_STORAGE_VERSION = 4;
export const DEFAULT_ROOM_WIDTH_CM = 360;
export const DEFAULT_ROOM_HEIGHT_CM = 320;
export const SOFT_ROOM_WARNING_COUNT = 8;
export const UNIT_OPTIONS: Unit[] = ['mm', 'cm', 'm', 'in', 'ft'];
export const OPENING_PRESETS: Record<'Door' | 'Window', { widthCm: number; heightCm: number }> = {
  Door: { widthCm: 80, heightCm: 10 },
  Window: { widthCm: 100, heightCm: 10 },
};
export const DEFAULT_PREFERENCES: Preferences = {
  gridSpacing: 30,
  gridColor: '#c8d2dd',
  unit: 'cm',
  showDebugTelemetry: false,
  themeMode: 'system',
};

const isValidUnit = (unit: string | undefined): unit is Unit =>
  !!unit && UNIT_OPTIONS.includes(unit as Unit);

const isValidOpeningWall = (wall: string | undefined): wall is OpeningWall =>
  wall === 'top' || wall === 'right' || wall === 'bottom' || wall === 'left';

const createRoomId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `room-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

const sanitizeNumber = (value: unknown, fallback: number, min?: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  if (typeof min === 'number') return Math.max(min, value);
  return value;
};

export const cloneRoomItem = (item: RoomItem): RoomItem => ({ ...item });

export const cloneRoomDesign = (room: RoomDesign): RoomDesign => ({
  ...room,
  items: room.items.map(cloneRoomItem),
  measures: room.measures.map((measure) => ({ ...measure })),
  setup: {
    ...room.setup,
    doorDefaults: { ...room.setup.doorDefaults },
  },
});

export const cloneRooms = (rooms: RoomDesign[]): RoomDesign[] => rooms.map(cloneRoomDesign);

export const normalizeOpeningForRoom = (
  item: RoomItem,
  roomWidthCm: number,
  roomHeightCm: number
): RoomItem => {
  const wall =
    inferWallFromRotation(item.rotate) ||
    (isValidOpeningWall(item.openingWall) ? item.openingWall : null) ||
    inferNearestWall(item.x + item.width / 2, item.y + item.height / 2, roomWidthCm, roomHeightCm);
  return normalizeOpeningOnWall(
    {
      ...item,
      doorOpenDirection: item.type === 'Door' ? (item.doorOpenDirection || 'in') : item.doorOpenDirection,
      doorOpenSide: item.type === 'Door' ? (item.doorOpenSide || 'left') : item.doorOpenSide,
    },
    wall,
    roomWidthCm,
    roomHeightCm
  );
};

const sanitizePreferences = (preferences: Preferences | undefined): Preferences => {
  const unit = isValidUnit(preferences?.unit) ? preferences?.unit : DEFAULT_PREFERENCES.unit;
  const legacyGridSize = sanitizeNumber(preferences?.gridSize, DEFAULT_PREFERENCES.gridSpacing, 2);
  const gridSpacing = sanitizeNumber(
    preferences?.gridSpacing,
    fromBaseCm(legacyGridSize, unit || 'cm'),
    0.1
  );
  return {
    gridSpacing,
    gridSize: undefined,
    gridColor: preferences?.gridColor || DEFAULT_PREFERENCES.gridColor,
    unit,
    showDebugTelemetry: typeof preferences?.showDebugTelemetry === 'boolean'
      ? preferences.showDebugTelemetry
      : DEFAULT_PREFERENCES.showDebugTelemetry,
    themeMode:
      preferences?.themeMode === 'light' || preferences?.themeMode === 'dark' || preferences?.themeMode === 'system'
        ? preferences.themeMode
        : DEFAULT_PREFERENCES.themeMode,
  };
};

const sanitizeSetup = (
  setup: Partial<RoomSetupState> | undefined,
  fallbackComplete = false
): RoomSetupState => {
  const onboardingComplete =
    typeof setup?.onboardingComplete === 'boolean' ? setup.onboardingComplete : fallbackComplete;
  const onboardingStep: OnboardingStep =
    setup?.onboardingStep === 'dimensions' || setup?.onboardingStep === 'openings'
      ? setup.onboardingStep
      : 'welcome';
  return {
    onboardingComplete,
    onboardingStep,
    doorDefaults: {
      doorOpenDirection: setup?.doorDefaults?.doorOpenDirection === 'out' ? 'out' : 'in',
      doorOpenSide: setup?.doorDefaults?.doorOpenSide === 'right' ? 'right' : 'left',
    },
    windowDraftWidthCm: sanitizeNumber(
      setup?.windowDraftWidthCm,
      OPENING_PRESETS.Window.widthCm,
      1
    ),
  };
};

const sanitizeRoomItems = (items: RoomItem[], roomWidthCm: number, roomHeightCm: number): RoomItem[] => {
  return items.map((item, index) => {
    const base: RoomItem = {
      id: sanitizeNumber(item.id, index + 1, 1),
      width: sanitizeNumber(item.width, 1, 1),
      height: sanitizeNumber(item.height, 1, 1),
      x: sanitizeNumber(item.x, 0),
      y: sanitizeNumber(item.y, 0),
      rotate: sanitizeNumber(item.rotate, 0),
      type: item.type || 'Object',
      doorOpenDirection: item.doorOpenDirection,
      doorOpenSide: item.doorOpenSide,
      openingWall: item.openingWall,
    };
    if (!isOpening(base)) return base;
    return normalizeOpeningForRoom(base, roomWidthCm, roomHeightCm);
  });
};

const sanitizeMeasureLine = (measure: Partial<MeasureLine>, fallbackId: number): MeasureLine => ({
  id: sanitizeNumber(measure.id, fallbackId, 1),
  x1: sanitizeNumber(measure.x1, 0),
  y1: sanitizeNumber(measure.y1, 0),
  x2: sanitizeNumber(measure.x2, 0),
  y2: sanitizeNumber(measure.y2, 0),
  includeInPdf: typeof measure.includeInPdf === 'boolean' ? measure.includeInPdf : false,
});

const sanitizeRoomName = (name: unknown, fallback: string): string => {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  return trimmed || fallback;
};

const sanitizeRoomDesign = (room: Partial<RoomDesign>, fallbackName: string): RoomDesign => {
  const roomWidthCm = sanitizeNumber(room.roomWidthCm, DEFAULT_ROOM_WIDTH_CM, 180);
  const roomHeightCm = sanitizeNumber(room.roomHeightCm, DEFAULT_ROOM_HEIGHT_CM, 180);
  const items = Array.isArray(room.items) ? sanitizeRoomItems(room.items, roomWidthCm, roomHeightCm) : [];
  const measures = Array.isArray(room.measures)
    ? room.measures.map((measure, index) => sanitizeMeasureLine(measure, index + 1))
    : [];
  const highestId = items.reduce((max, item) => Math.max(max, item.id), 0);
  const nextItemId = Math.max(sanitizeNumber(room.nextItemId, 1, 1), highestId + 1);
  const setup = sanitizeSetup(room.setup, true);
  return {
    id: typeof room.id === 'string' && room.id ? room.id : createRoomId(),
    name: sanitizeRoomName(room.name, fallbackName),
    roomWidthCm,
    roomHeightCm,
    items,
    measures,
    nextItemId,
    editingItemId:
      typeof room.editingItemId === 'number' && items.some((item) => item.id === room.editingItemId)
        ? room.editingItemId
        : null,
    setup,
  };
};

export const createBlankRoom = (name: string): RoomDesign => ({
  id: createRoomId(),
  name,
  roomWidthCm: DEFAULT_ROOM_WIDTH_CM,
  roomHeightCm: DEFAULT_ROOM_HEIGHT_CM,
  items: [],
  measures: [],
  nextItemId: 1,
  editingItemId: null,
  setup: {
    onboardingComplete: false,
    onboardingStep: 'dimensions',
    doorDefaults: {
      doorOpenDirection: 'in',
      doorOpenSide: 'left',
    },
    windowDraftWidthCm: OPENING_PRESETS.Window.widthCm,
  },
});

export const createDuplicateRoom = (source: RoomDesign, name: string): RoomDesign => {
  const copiedItems = source.items.map((item) => {
    if (!isOpening(item)) return { ...item };
    return normalizeOpeningForRoom({ ...item }, source.roomWidthCm, source.roomHeightCm);
  });
  const highestId = copiedItems.reduce((max, item) => Math.max(max, item.id), 0);
  return {
    id: createRoomId(),
    name,
    roomWidthCm: source.roomWidthCm,
    roomHeightCm: source.roomHeightCm,
    items: copiedItems,
    measures: source.measures.map((measure) => ({ ...measure })),
    nextItemId: Math.max(highestId + 1, 1),
    editingItemId: null,
    setup: {
      onboardingComplete: source.setup.onboardingComplete,
      onboardingStep: source.setup.onboardingComplete ? 'openings' : 'dimensions',
      doorDefaults: { ...source.setup.doorDefaults },
      windowDraftWidthCm: source.setup.windowDraftWidthCm || OPENING_PRESETS.Window.widthCm,
    },
  };
};

export const getNextRoomName = (rooms: RoomDesign[]): string => {
  const used = new Set(rooms.map((room) => room.name.trim().toLowerCase()));
  let candidate = rooms.length + 1;
  while (used.has(`room ${candidate}`)) {
    candidate += 1;
  }
  return `Room ${candidate}`;
};

export const reorderRooms = (rooms: RoomDesign[], sourceRoomId: string, targetRoomId: string): RoomDesign[] => {
  if (sourceRoomId === targetRoomId) return rooms;
  const sourceIndex = rooms.findIndex((room) => room.id === sourceRoomId);
  const targetIndex = rooms.findIndex((room) => room.id === targetRoomId);
  if (sourceIndex < 0 || targetIndex < 0) return rooms;
  const next = [...rooms];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

export const roomItemEquals = (left: RoomItem, right: RoomItem): boolean => (
  left.id === right.id &&
  left.width === right.width &&
  left.height === right.height &&
  left.x === right.x &&
  left.y === right.y &&
  left.rotate === right.rotate &&
  left.type === right.type &&
  left.doorOpenDirection === right.doorOpenDirection &&
  left.doorOpenSide === right.doorOpenSide &&
  left.openingWall === right.openingWall
);

const setupEquals = (left: RoomSetupState, right: RoomSetupState): boolean => (
  left.onboardingComplete === right.onboardingComplete &&
  left.onboardingStep === right.onboardingStep &&
  left.windowDraftWidthCm === right.windowDraftWidthCm &&
  left.doorDefaults.doorOpenDirection === right.doorDefaults.doorOpenDirection &&
  left.doorDefaults.doorOpenSide === right.doorDefaults.doorOpenSide
);

export const roomDesignEquals = (left: RoomDesign, right: RoomDesign): boolean => {
  if (
    left.id !== right.id ||
    left.name !== right.name ||
    left.roomWidthCm !== right.roomWidthCm ||
    left.roomHeightCm !== right.roomHeightCm ||
    left.nextItemId !== right.nextItemId ||
    left.editingItemId !== right.editingItemId ||
    left.items.length !== right.items.length ||
    left.measures.length !== right.measures.length ||
    !setupEquals(left.setup, right.setup)
  ) {
    return false;
  }
  for (let index = 0; index < left.items.length; index += 1) {
    if (!roomItemEquals(left.items[index], right.items[index])) {
      return false;
    }
  }
  for (let index = 0; index < left.measures.length; index += 1) {
    const leftMeasure = left.measures[index];
    const rightMeasure = right.measures[index];
    if (
      leftMeasure.id !== rightMeasure.id ||
      leftMeasure.x1 !== rightMeasure.x1 ||
      leftMeasure.y1 !== rightMeasure.y1 ||
      leftMeasure.x2 !== rightMeasure.x2 ||
      leftMeasure.y2 !== rightMeasure.y2 ||
      leftMeasure.includeInPdf !== rightMeasure.includeInPdf
    ) {
      return false;
    }
  }
  return true;
};

const preferencesEquals = (left: Preferences, right: Preferences): boolean => (
  left.gridSpacing === right.gridSpacing &&
  left.gridColor === right.gridColor &&
  left.unit === right.unit &&
  left.showDebugTelemetry === right.showDebugTelemetry &&
  left.themeMode === right.themeMode
);

export const workspaceStateEquals = (left: WorkspaceState, right: WorkspaceState): boolean => {
  if (
    left.version !== right.version ||
    left.activeRoomId !== right.activeRoomId ||
    left.rooms.length !== right.rooms.length ||
    !preferencesEquals(left.preferences, right.preferences)
  ) {
    return false;
  }
  for (let index = 0; index < left.rooms.length; index += 1) {
    if (!roomDesignEquals(left.rooms[index], right.rooms[index])) {
      return false;
    }
  }
  return true;
};

export const captureWorkspaceSnapshot = (workspace: WorkspaceState): WorkspaceSnapshot => ({
  rooms: cloneRooms(workspace.rooms),
  activeRoomId: workspace.activeRoomId,
});

export const workspaceSnapshotEquals = (left: WorkspaceSnapshot, right: WorkspaceSnapshot): boolean => {
  if (left.activeRoomId !== right.activeRoomId || left.rooms.length !== right.rooms.length) return false;
  for (let index = 0; index < left.rooms.length; index += 1) {
    if (!roomDesignEquals(left.rooms[index], right.rooms[index])) {
      return false;
    }
  }
  return true;
};

export const createDefaultWorkspaceState = (): WorkspaceState => {
  const firstRoom = createBlankRoom('Room 1');
  return {
    version: WORKSPACE_STORAGE_VERSION,
    rooms: [firstRoom],
    activeRoomId: firstRoom.id,
    preferences: { ...DEFAULT_PREFERENCES },
  };
};

export const sanitizeWorkspaceState = (workspace: Partial<WorkspaceState>): WorkspaceState => {
  const rooms = Array.isArray(workspace.rooms) ? workspace.rooms : [];
  const sanitizedRooms = rooms.length > 0
    ? rooms.map((room, index) => sanitizeRoomDesign(room, `Room ${index + 1}`))
    : [createBlankRoom('Room 1')];
  const activeRoomId = sanitizedRooms.some((room) => room.id === workspace.activeRoomId)
    ? (workspace.activeRoomId as string)
    : sanitizedRooms[0].id;
  return {
    version: WORKSPACE_STORAGE_VERSION,
    rooms: sanitizedRooms,
    activeRoomId,
    preferences: sanitizePreferences(workspace.preferences),
  };
};

const migrateLegacyLayoutState = (legacy: LegacyStoredLayoutState): WorkspaceState => {
  const roomWidthCm = sanitizeNumber(legacy.roomWidthCm, DEFAULT_ROOM_WIDTH_CM, 180);
  const roomHeightCm = sanitizeNumber(legacy.roomHeightCm, DEFAULT_ROOM_HEIGHT_CM, 180);
  const items = Array.isArray(legacy.items) ? sanitizeRoomItems(legacy.items, roomWidthCm, roomHeightCm) : [];
  const highestId = items.reduce((max, item) => Math.max(max, item.id), 0);
  const room = createBlankRoom('Room 1');
  room.roomWidthCm = roomWidthCm;
  room.roomHeightCm = roomHeightCm;
  room.items = items;
  room.measures = [];
  room.nextItemId = Math.max(sanitizeNumber(legacy.nextItemId, 1, 1), highestId + 1);
  room.setup.onboardingComplete =
    typeof legacy.onboardingComplete === 'boolean'
      ? legacy.onboardingComplete
      : items.length > 0;
  room.setup.onboardingStep =
    legacy.onboardingStep === 'dimensions' || legacy.onboardingStep === 'openings'
      ? legacy.onboardingStep
      : 'welcome';
  return {
    version: WORKSPACE_STORAGE_VERSION,
    rooms: [room],
    activeRoomId: room.id,
    preferences: sanitizePreferences(legacy.preferences),
  };
};

export const parseStoredWorkspaceState = (rawState: string | null): WorkspaceState | null => {
  if (!rawState) return null;
  try {
    const parsed = JSON.parse(rawState) as Partial<WorkspaceState> | LegacyStoredLayoutState;
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Partial<WorkspaceState>).rooms)) {
      return sanitizeWorkspaceState(parsed as Partial<WorkspaceState>);
    }
    if (
      parsed &&
      typeof parsed === 'object' &&
      (((parsed as LegacyStoredLayoutState).version ?? 0) === 1 ||
        ((parsed as LegacyStoredLayoutState).version ?? 0) === 2)
    ) {
      return migrateLegacyLayoutState(parsed as LegacyStoredLayoutState);
    }
    return null;
  } catch {
    return null;
  }
};

export const hasDoor = (room: RoomDesign): boolean => room.items.some((item) => item.type === 'Door');

export const findRoom = (workspace: WorkspaceState, roomId: string): RoomDesign | null =>
  workspace.rooms.find((room) => room.id === roomId) || null;
