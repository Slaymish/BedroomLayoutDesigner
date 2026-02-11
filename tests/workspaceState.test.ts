import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PREFERENCES,
  MAX_GRID_SPACING,
  MAX_ITEM_DIMENSION_CM,
  MAX_ROOM_DIMENSION_CM,
  createBlankRoom,
  parseStoredWorkspaceState,
  reorderRooms,
  sanitizeWorkspaceState,
} from '../src/utils/workspaceState.js';

test('legacy workspace state migrates and normalizes next item id', () => {
  const legacyRaw = JSON.stringify({
    version: 1,
    roomWidthCm: 240,
    roomHeightCm: 260,
    items: [
      {
        id: 4,
        width: 50,
        height: 40,
        x: 12,
        y: 18,
        type: 'Desk',
      },
    ],
    nextItemId: 2,
    preferences: { ...DEFAULT_PREFERENCES },
  });

  const parsed = parseStoredWorkspaceState(legacyRaw);
  assert.ok(parsed);
  assert.equal(parsed.rooms.length, 1);
  assert.equal(parsed.rooms[0].roomWidthCm, 240);
  assert.equal(parsed.rooms[0].roomHeightCm, 260);
  assert.equal(parsed.rooms[0].nextItemId, 5);
  assert.equal(parsed.preferences.wallThicknessCm, 12);
});

test('invalid active room id falls back to first room', () => {
  const first = createBlankRoom('Room A');
  const second = createBlankRoom('Room B');
  const raw = JSON.stringify({
    version: 4,
    rooms: [first, second],
    activeRoomId: 'missing-room-id',
    preferences: { ...DEFAULT_PREFERENCES },
  });

  const parsed = parseStoredWorkspaceState(raw);
  assert.ok(parsed);
  assert.equal(parsed.activeRoomId, parsed.rooms[0].id);
});

test('v4 workspaces default new wall and label fields during migration', () => {
  const room = createBlankRoom('Room A');
  room.dimensionLabelLayout = undefined;
  room.measures = [
    {
      id: 1,
      x1: 10,
      y1: 10,
      x2: 90,
      y2: 10,
      includeInPdf: false,
    },
  ];

  const raw = JSON.stringify({
    version: 4,
    rooms: [room],
    activeRoomId: room.id,
    preferences: {
      ...DEFAULT_PREFERENCES,
      wallThicknessCm: undefined,
    },
  });

  const parsed = parseStoredWorkspaceState(raw);
  assert.ok(parsed);
  assert.equal(parsed.preferences.wallThicknessCm, 12);
  assert.equal(parsed.rooms[0].dimensionLabelLayout?.widthLabelT, 0.5);
  assert.equal(parsed.rooms[0].dimensionLabelLayout?.heightLabelT, 0.5);
  assert.equal(parsed.rooms[0].measures[0].labelT, 0.5);
});

test('room reorder moves the source room to target index', () => {
  const first = createBlankRoom('Room A');
  const second = createBlankRoom('Room B');
  const third = createBlankRoom('Room C');

  const reordered = reorderRooms([first, second, third], first.id, third.id);
  assert.deepEqual(reordered.map((room) => room.id), [second.id, third.id, first.id]);
});

test('workspace sanitization deduplicates room and item ids', () => {
  const first = createBlankRoom('Room A');
  const second = createBlankRoom('Room B');
  second.id = first.id;

  first.items = [
    { id: 1, width: 60, height: 40, x: 0, y: 0, type: 'Desk' },
    { id: 1, width: 30, height: 50, x: 20, y: 20, type: 'Bed' },
  ];
  first.nextItemId = 1;

  const parsed = sanitizeWorkspaceState({
    version: 5,
    rooms: [first, second],
    activeRoomId: first.id,
    preferences: { ...DEFAULT_PREFERENCES },
  });

  assert.equal(new Set(parsed.rooms.map((room) => room.id)).size, parsed.rooms.length);
  assert.equal(new Set(parsed.rooms[0].items.map((item) => item.id)).size, parsed.rooms[0].items.length);
  const highestItemId = parsed.rooms[0].items.reduce((max, item) => Math.max(max, item.id), 0);
  assert.equal(parsed.rooms[0].nextItemId, highestItemId + 1);
});

test('workspace sanitization clamps oversized room, item, and preference values', () => {
  const parsed = sanitizeWorkspaceState({
    version: 5,
    activeRoomId: 'room-a',
    rooms: [
      {
        id: 'room-a',
        name: 'Huge Room',
        roomWidthCm: MAX_ROOM_DIMENSION_CM * 100,
        roomHeightCm: MAX_ROOM_DIMENSION_CM * 100,
        items: [
          {
            id: 1,
            width: MAX_ITEM_DIMENSION_CM * 10,
            height: MAX_ITEM_DIMENSION_CM * 10,
            x: 999999,
            y: 999999,
            type: 'Desk',
          },
        ],
        measures: [
          {
            id: 1,
            x1: 999999,
            y1: 999999,
            x2: 999999,
            y2: 999999,
            includeInPdf: false,
          },
        ],
        nextItemId: 1,
        editingItemId: null,
        setup: {
          onboardingComplete: true,
          onboardingStep: 'openings',
          doorDefaults: { doorOpenDirection: 'in', doorOpenSide: 'left' },
          windowDraftWidthCm: 100,
        },
      },
    ],
    preferences: {
      ...DEFAULT_PREFERENCES,
      gridSpacing: MAX_GRID_SPACING * 10,
    },
  });

  const room = parsed.rooms[0];
  assert.equal(room.roomWidthCm, MAX_ROOM_DIMENSION_CM);
  assert.equal(room.roomHeightCm, MAX_ROOM_DIMENSION_CM);
  assert.equal(room.items[0].width, MAX_ITEM_DIMENSION_CM);
  assert.equal(room.items[0].height, MAX_ITEM_DIMENSION_CM);
  assert.equal(room.items[0].x, room.roomWidthCm - room.items[0].width);
  assert.equal(room.items[0].y, room.roomHeightCm - room.items[0].height);
  assert.equal(room.measures[0].x1, room.roomWidthCm);
  assert.equal(room.measures[0].y1, room.roomHeightCm);
  assert.equal(parsed.preferences.gridSpacing, MAX_GRID_SPACING);
});
