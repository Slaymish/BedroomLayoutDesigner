import type { WorkspaceState } from '../types';

export const buildAutosaveFingerprint = (workspace: WorkspaceState): string => JSON.stringify({
  version: workspace.version,
  preferences: workspace.preferences,
  rooms: workspace.rooms.map((room) => ({
    ...room,
    editingItemId: null,
  })),
});
