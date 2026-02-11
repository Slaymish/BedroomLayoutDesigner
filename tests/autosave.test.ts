import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAutosaveFingerprint } from '../src/utils/autosave.js';
import { createDefaultWorkspaceState } from '../src/utils/workspaceState.js';

test('autosave fingerprint ignores click-only selection state', () => {
  const workspace = createDefaultWorkspaceState();
  const baseline = buildAutosaveFingerprint(workspace);

  const clickOnlyState = {
    ...workspace,
    activeRoomId: 'temporary-selection',
    rooms: workspace.rooms.map((room) => ({
      ...room,
      editingItemId: 1234,
    })),
  };

  assert.equal(buildAutosaveFingerprint(clickOnlyState), baseline);
});

test('autosave fingerprint changes when room layout or preferences change', () => {
  const workspace = createDefaultWorkspaceState();
  const baseline = buildAutosaveFingerprint(workspace);

  const renamedRoomState = {
    ...workspace,
    rooms: workspace.rooms.map((room, index) => (index === 0 ? { ...room, name: 'Master Bedroom' } : room)),
  };
  assert.notEqual(buildAutosaveFingerprint(renamedRoomState), baseline);

  const preferenceState = {
    ...workspace,
    preferences: {
      ...workspace.preferences,
      gridSpacing: workspace.preferences.gridSpacing + 10,
    },
  };
  assert.notEqual(buildAutosaveFingerprint(preferenceState), baseline);
});
