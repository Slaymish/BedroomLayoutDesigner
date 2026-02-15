import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkspaceSharePayload } from '../src/types.js';
import {
  MAX_ITEM_DIMENSION_CM,
  createDefaultWorkspaceState,
} from '../src/utils/workspaceState.js';
import {
  MAX_SHARE_LINK_LENGTH,
  buildWorkspaceSharePayload,
  decodeWorkspaceSharePayload,
  encodeWorkspaceSharePayload,
  readSharePayloadFromHash,
} from '../src/utils/workspaceShare.js';

test('share payload round-trips through encode/decode', () => {
  const workspace = createDefaultWorkspaceState();
  workspace.rooms[0].name = 'Guest Bedroom';
  workspace.rooms[0].items.push({
    id: workspace.rooms[0].nextItemId,
    width: 140,
    height: 200,
    x: 40,
    y: 50,
    type: 'Bed',
    rotate: 0,
  });
  workspace.rooms[0].nextItemId += 1;

  const encoded = encodeWorkspaceSharePayload(buildWorkspaceSharePayload(workspace));
  const decoded = decodeWorkspaceSharePayload(encoded);

  assert.equal(decoded.rooms[0].name, 'Guest Bedroom');
  assert.equal(decoded.rooms[0].items.length, 1);
  assert.equal(decoded.rooms[0].items[0].type, 'Bed');
});

test('share payload can be read from URL hash', () => {
  const workspace = createDefaultWorkspaceState();
  const encoded = encodeWorkspaceSharePayload(buildWorkspaceSharePayload(workspace));
  const decoded = readSharePayloadFromHash(`#share=${encoded}`);

  assert.ok(decoded);
  assert.equal(decoded?.rooms.length, 1);
});

test('invalid share payload kind is rejected', () => {
  const invalidPayload = {
    kind: 'NotBedroomLayoutShare',
    version: 1,
    createdAtIso: new Date().toISOString(),
    workspace: createDefaultWorkspaceState(),
  } as unknown as WorkspaceSharePayload;
  const encoded = encodeWorkspaceSharePayload(invalidPayload);

  assert.throws(
    () => decodeWorkspaceSharePayload(encoded),
    /Share link payload is not a valid Bedroom Layout share\./
  );
});

test('oversized share payload is rejected', () => {
  assert.throws(
    () => decodeWorkspaceSharePayload('a'.repeat(MAX_SHARE_LINK_LENGTH + 1)),
    /Share link is too large to fit reliably in a URL\./
  );
});

test('share payload rejects unsupported extreme geometry values', () => {
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

  const encoded = encodeWorkspaceSharePayload(buildWorkspaceSharePayload(workspace));
  assert.throws(
    () => decodeWorkspaceSharePayload(encoded),
    /Share link contains unsupported dimensions\./
  );
});
