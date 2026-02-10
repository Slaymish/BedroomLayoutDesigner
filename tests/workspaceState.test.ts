import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PREFERENCES,
  createBlankRoom,
  parseStoredWorkspaceState,
  reorderRooms,
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

test('room reorder moves the source room to target index', () => {
  const first = createBlankRoom('Room A');
  const second = createBlankRoom('Room B');
  const third = createBlankRoom('Room C');

  const reordered = reorderRooms([first, second, third], first.id, third.id);
  assert.deepEqual(reordered.map((room) => room.id), [second.id, third.id, first.id]);
});
