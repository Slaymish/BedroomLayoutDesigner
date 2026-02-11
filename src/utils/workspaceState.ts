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
export const WORKSPACE_STORAGE_VERSION = 5;
export const DEFAULT_ROOM_WIDTH_CM = 360;
export const DEFAULT_ROOM_HEIGHT_CM = 320;
export const MAX_ROOM_DIMENSION_CM = 5000;
export const MAX_ITEM_DIMENSION_CM = 2000;
export const MAX_GRID_SPACING = 500;
export const MAX_ABSOLUTE_COORDINATE_CM = MAX_ROOM_DIMENSION_CM * 4;
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
  wallThicknessCm: 12,
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

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(value, max));

const sanitizeClampedNumber = (value: unknown, fallback: number, min: number, max: number): number => (
  clamp(sanitizeNumber(value, fallback, min), min, max)
);

const sanitizePositiveInt = (value: unknown, fallback: number, min = 1): number => (
  Math.max(min, Math.round(sanitizeNumber(value, fallback, min)))
);

export const cloneRoomItem = (item: RoomItem): RoomItem => ({ ...item });

export const cloneRoomDesign = (room: RoomDesign): RoomDesign => ({
  ...room,
  items: room.items.map(cloneRoomItem),
  measures: room.measures.map((measure) => ({ ...measure, labelT: measure.labelT ?? 0.5 })),
  dimensionLabelLayout: room.dimensionLabelLayout
    ? { ...room.dimensionLabelLayout }
    : { widthLabelT: 0.5, heightLabelT: 0.5 },
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
  const gridSpacing = sanitizeClampedNumber(
    preferences?.gridSpacing,
    fromBaseCm(legacyGridSize, unit || 'cm'),
    0.1,
    MAX_GRID_SPACING
  );
  return {
    gridSpacing,
    gridSize: undefined,
    gridColor: preferences?.gridColor || DEFAULT_PREFERENCES.gridColor,
    unit,
    wallThicknessCm: Math.min(60, sanitizeNumber(
      preferences?.wallThicknessCm,
      DEFAULT_PREFERENCES.wallThicknessCm,
      1
    )),
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
  const usedIds = new Set<number>();
  return items.map((item, index) => {
    let id = sanitizePositiveInt(item.id, index + 1, 1);
    while (usedIds.has(id)) {
      id += 1;
    }
    usedIds.add(id);

    const type = item.type || 'Object';
    const opening = type === 'Door' || type === 'Window';
    const spanLimit = Math.min(MAX_ITEM_DIMENSION_CM, Math.max(roomWidthCm, roomHeightCm));
    const widthLimit = opening
      ? spanLimit
      : Math.min(MAX_ITEM_DIMENSION_CM, roomWidthCm);
    const heightLimit = opening
      ? spanLimit
      : Math.min(MAX_ITEM_DIMENSION_CM, roomHeightCm);
    const width = sanitizeClampedNumber(item.width, 1, 1, Math.max(1, widthLimit));
    const height = sanitizeClampedNumber(item.height, 1, 1, Math.max(1, heightLimit));
    const base: RoomItem = {
      id,
      width,
      height,
      x: sanitizeNumber(item.x, 0),
      y: sanitizeNumber(item.y, 0),
      rotate: sanitizeNumber(item.rotate, 0),
      type,
      doorOpenDirection: item.doorOpenDirection,
      doorOpenSide: item.doorOpenSide,
      openingWall: item.openingWall,
    };
    if (!isOpening(base)) {
      const maxX = Math.max(0, roomWidthCm - width);
      const maxY = Math.max(0, roomHeightCm - height);
      return {
        ...base,
        x: clamp(base.x, 0, maxX),
        y: clamp(base.y, 0, maxY),
      };
    }
    return normalizeOpeningForRoom(base, roomWidthCm, roomHeightCm);
  });
};

const sanitizeMeasureLine = (
  measure: Partial<MeasureLine>,
  fallbackId: number,
  roomWidthCm: number,
  roomHeightCm: number
): MeasureLine => ({
  id: sanitizePositiveInt(measure.id, fallbackId, 1),
  x1: clamp(sanitizeNumber(measure.x1, 0), 0, roomWidthCm),
  y1: clamp(sanitizeNumber(measure.y1, 0), 0, roomHeightCm),
  x2: clamp(sanitizeNumber(measure.x2, 0), 0, roomWidthCm),
  y2: clamp(sanitizeNumber(measure.y2, 0), 0, roomHeightCm),
  includeInPdf: typeof measure.includeInPdf === 'boolean' ? measure.includeInPdf : false,
  labelT: Math.min(1, sanitizeNumber(measure.labelT, 0.5, 0)),
});

const sanitizeRoomName = (name: unknown, fallback: string): string => {
  if (typeof name !== 'string') return fallback;
  const trimmed = name.trim();
  return trimmed || fallback;
};

const sanitizeRoomDesign = (room: Partial<RoomDesign>, fallbackName: string): RoomDesign => {
  const roomWidthCm = sanitizeClampedNumber(room.roomWidthCm, DEFAULT_ROOM_WIDTH_CM, 180, MAX_ROOM_DIMENSION_CM);
  const roomHeightCm = sanitizeClampedNumber(room.roomHeightCm, DEFAULT_ROOM_HEIGHT_CM, 180, MAX_ROOM_DIMENSION_CM);
  const items = Array.isArray(room.items) ? sanitizeRoomItems(room.items, roomWidthCm, roomHeightCm) : [];
  const rawMeasures = Array.isArray(room.measures)
    ? room.measures.map((measure, index) => sanitizeMeasureLine(measure, index + 1, roomWidthCm, roomHeightCm))
    : [];
  const usedMeasureIds = new Set<number>();
  const measures = rawMeasures.map((measure) => {
    let id = measure.id;
    while (usedMeasureIds.has(id)) {
      id += 1;
    }
    usedMeasureIds.add(id);
    return id === measure.id ? measure : { ...measure, id };
  });
  const highestId = items.reduce((max, item) => Math.max(max, item.id), 0);
  const nextItemId = Math.max(sanitizePositiveInt(room.nextItemId, 1, 1), highestId + 1);
  const setup = sanitizeSetup(room.setup, true);
  const widthLabelT = sanitizeNumber(room.dimensionLabelLayout?.widthLabelT, 0.5, 0);
  const heightLabelT = sanitizeNumber(room.dimensionLabelLayout?.heightLabelT, 0.5, 0);
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
    dimensionLabelLayout: {
      widthLabelT: Math.min(1, widthLabelT),
      heightLabelT: Math.min(1, heightLabelT),
    },
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
  dimensionLabelLayout: {
    widthLabelT: 0.5,
    heightLabelT: 0.5,
  },
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
    measures: source.measures.map((measure) => ({ ...measure, labelT: measure.labelT ?? 0.5 })),
    nextItemId: Math.max(highestId + 1, 1),
    editingItemId: null,
    dimensionLabelLayout: source.dimensionLabelLayout
      ? { ...source.dimensionLabelLayout }
      : { widthLabelT: 0.5, heightLabelT: 0.5 },
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
    (left.dimensionLabelLayout?.widthLabelT ?? 0.5) !== (right.dimensionLabelLayout?.widthLabelT ?? 0.5) ||
    (left.dimensionLabelLayout?.heightLabelT ?? 0.5) !== (right.dimensionLabelLayout?.heightLabelT ?? 0.5) ||
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
      leftMeasure.includeInPdf !== rightMeasure.includeInPdf ||
      (leftMeasure.labelT ?? 0.5) !== (rightMeasure.labelT ?? 0.5)
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
  left.wallThicknessCm === right.wallThicknessCm &&
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
  const roomCandidates = rooms.length > 0
    ? rooms.map((room, index) => sanitizeRoomDesign(room, `Room ${index + 1}`))
    : [createBlankRoom('Room 1')];
  const seenRoomIds = new Set<string>();
  const sanitizedRooms = roomCandidates.map((room) => {
    let roomId = room.id;
    while (seenRoomIds.has(roomId)) {
      roomId = createRoomId();
    }
    seenRoomIds.add(roomId);
    return roomId === room.id ? room : { ...room, id: roomId };
  });
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

const exceedsCoordinateLimit = (value: unknown): boolean => (
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) > MAX_ABSOLUTE_COORDINATE_CM
);

export const findWorkspaceBoundsViolation = (workspace: Partial<WorkspaceState>): string | null => {
  const rooms = Array.isArray(workspace.rooms) ? workspace.rooms : [];

  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    const label = `Room ${roomIndex + 1}`;
    if (typeof room.roomWidthCm === 'number' && room.roomWidthCm > MAX_ROOM_DIMENSION_CM) {
      return `${label} width exceeds ${MAX_ROOM_DIMENSION_CM}cm.`;
    }
    if (typeof room.roomHeightCm === 'number' && room.roomHeightCm > MAX_ROOM_DIMENSION_CM) {
      return `${label} height exceeds ${MAX_ROOM_DIMENSION_CM}cm.`;
    }

    if (Array.isArray(room.items)) {
      for (let itemIndex = 0; itemIndex < room.items.length; itemIndex += 1) {
        const item = room.items[itemIndex];
        if (typeof item.width === 'number' && item.width > MAX_ITEM_DIMENSION_CM) {
          return `${label} item ${itemIndex + 1} width exceeds ${MAX_ITEM_DIMENSION_CM}cm.`;
        }
        if (typeof item.height === 'number' && item.height > MAX_ITEM_DIMENSION_CM) {
          return `${label} item ${itemIndex + 1} height exceeds ${MAX_ITEM_DIMENSION_CM}cm.`;
        }
        if (
          exceedsCoordinateLimit(item.x) ||
          exceedsCoordinateLimit(item.y)
        ) {
          return `${label} item ${itemIndex + 1} has unsupported coordinates.`;
        }
      }
    }

    if (Array.isArray(room.measures)) {
      for (let measureIndex = 0; measureIndex < room.measures.length; measureIndex += 1) {
        const measure = room.measures[measureIndex];
        if (
          exceedsCoordinateLimit(measure.x1) ||
          exceedsCoordinateLimit(measure.y1) ||
          exceedsCoordinateLimit(measure.x2) ||
          exceedsCoordinateLimit(measure.y2)
        ) {
          return `${label} measure ${measureIndex + 1} has unsupported coordinates.`;
        }
      }
    }
  }

  if (
    typeof workspace.preferences?.gridSpacing === 'number' &&
    workspace.preferences.gridSpacing > MAX_GRID_SPACING
  ) {
    return `Grid spacing exceeds ${MAX_GRID_SPACING}.`;
  }

  return null;
};

const migrateLegacyLayoutState = (legacy: LegacyStoredLayoutState): WorkspaceState => {
  const roomWidthCm = sanitizeClampedNumber(legacy.roomWidthCm, DEFAULT_ROOM_WIDTH_CM, 180, MAX_ROOM_DIMENSION_CM);
  const roomHeightCm = sanitizeClampedNumber(legacy.roomHeightCm, DEFAULT_ROOM_HEIGHT_CM, 180, MAX_ROOM_DIMENSION_CM);
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
