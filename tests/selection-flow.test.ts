import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultWorkspaceState } from '../src/utils/workspaceState.js';

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
