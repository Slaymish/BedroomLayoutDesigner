import type { WorkspaceFile, WorkspaceState } from '../types';
import { sanitizeWorkspaceState } from './workspaceState';

const WORKSPACE_FILE_KIND = 'BedroomLayoutWorkspace';
const WORKSPACE_FILE_VERSION = 1;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const buildWorkspaceFile = (workspace: WorkspaceState): WorkspaceFile => ({
  kind: WORKSPACE_FILE_KIND,
  version: WORKSPACE_FILE_VERSION,
  exportedAtIso: new Date().toISOString(),
  workspace,
});

export const isWorkspaceFile = (value: unknown): value is WorkspaceFile => {
  if (!isObject(value)) return false;
  if (value.kind !== WORKSPACE_FILE_KIND || value.version !== WORKSPACE_FILE_VERSION) return false;
  if (typeof value.exportedAtIso !== 'string') return false;
  if (!('workspace' in value) || !isObject(value.workspace)) return false;
  return true;
};

export const parseWorkspaceFileContent = (raw: string): WorkspaceState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON file.');
  }

  if (!isWorkspaceFile(parsed)) {
    throw new Error('File is not a valid Bedroom Layout workspace export.');
  }

  return sanitizeWorkspaceState(parsed.workspace);
};

export const downloadWorkspaceFile = (workspace: WorkspaceState): void => {
  const payload = buildWorkspaceFile(workspace);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `bedroom-workspace-${today}.json`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
