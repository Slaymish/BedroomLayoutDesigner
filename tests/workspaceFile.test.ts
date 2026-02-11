import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkspaceFile, parseWorkspaceFileContent } from '../src/utils/workspaceFile.js';
import {
  MAX_ITEM_DIMENSION_CM,
  WORKSPACE_STORAGE_VERSION,
  createDefaultWorkspaceState,
} from '../src/utils/workspaceState.js';

test('workspace export parses and sanitizes persisted version', () => {
  const workspace = createDefaultWorkspaceState();
  const payload = buildWorkspaceFile({
    ...workspace,
    version: 999,
  });

  const parsed = parseWorkspaceFileContent(JSON.stringify(payload));
  assert.equal(parsed.version, WORKSPACE_STORAGE_VERSION);
  assert.equal(parsed.rooms.length, workspace.rooms.length);
  assert.equal(parsed.activeRoomId, workspace.activeRoomId);
});

test('invalid json throws a clear error', () => {
  assert.throws(
    () => parseWorkspaceFileContent('{invalid-json'),
    /Invalid JSON file\./
  );
});

test('invalid workspace file kind is rejected', () => {
  const invalidPayload = JSON.stringify({
    kind: 'NotBedroomLayoutWorkspace',
    version: 1,
    exportedAtIso: new Date().toISOString(),
    workspace: createDefaultWorkspaceState(),
  });

  assert.throws(
    () => parseWorkspaceFileContent(invalidPayload),
    /File is not a valid Bedroom Layout workspace export\./
  );
});

test('workspace file rejects unsupported extreme geometry values', () => {
  const workspace = createDefaultWorkspaceState();
  workspace.rooms[0].items.push({
    id: workspace.rooms[0].nextItemId,
    width: MAX_ITEM_DIMENSION_CM + 1,
    height: 40,
    x: 20,
    y: 20,
    type: 'Desk',
  });
  workspace.rooms[0].nextItemId += 1;

  const payload = buildWorkspaceFile(workspace);
  assert.throws(
    () => parseWorkspaceFileContent(JSON.stringify(payload)),
    /Workspace file contains unsupported dimensions\./
  );
});
