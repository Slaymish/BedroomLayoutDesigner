import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultWorkspaceState } from '../src/utils/workspaceState.js';
import { resolveRoomSelectedItemIds } from '../src/utils/selectionState.js';

test('explicit empty selection can be replaced by selecting an item', () => {
  const ws = createDefaultWorkspaceState();
  const room = ws.rooms[0];
  const roomId = room.id;

  const selectedByRoom: Record<string, number[]> = { [roomId]: [] };
  const explicit = selectedByRoom[roomId];
  assert.ok(Array.isArray(explicit));

  const nextSelection = [1];
  selectedByRoom[roomId] = nextSelection;
  assert.deepEqual(selectedByRoom[roomId], nextSelection);
});

test('resolveRoomSelectedItemIds preserves explicit empty deselection', () => {
  const ws = createDefaultWorkspaceState();
  const room = ws.rooms[0];

  const selectedByRoom: Record<string, number[]> = {
    [room.id]: [],
  };

  assert.deepEqual(resolveRoomSelectedItemIds(selectedByRoom, room.id, room.editingItemId), []);
});

test('resolveRoomSelectedItemIds falls back to editing item when no explicit key exists', () => {
  const ws = createDefaultWorkspaceState();
  const room = ws.rooms[0];

  const selectedByRoom: Record<string, number[]> = {};

  assert.deepEqual(resolveRoomSelectedItemIds(selectedByRoom, room.id, 7), [7]);
  assert.deepEqual(resolveRoomSelectedItemIds(selectedByRoom, room.id, null), []);
});

test('resolveRoomSelectedItemIds reflects immediate reselection after explicit empty', () => {
  const ws = createDefaultWorkspaceState();
  const room = ws.rooms[0];

  const selectedByRoom: Record<string, number[]> = {
    [room.id]: [],
  };

  assert.deepEqual(resolveRoomSelectedItemIds(selectedByRoom, room.id, null), []);

  selectedByRoom[room.id] = [room.nextItemId];
  assert.deepEqual(resolveRoomSelectedItemIds(selectedByRoom, room.id, null), [room.nextItemId]);
});
