import type { WorkspaceSharePayload, WorkspaceState } from '../types.js';
import { findWorkspaceBoundsViolation, sanitizeWorkspaceState } from './workspaceState.js';

const WORKSPACE_SHARE_KIND = 'BedroomLayoutShare';
const WORKSPACE_SHARE_VERSION = 1;

// Conservative guard for reliability across browsers, chat apps, and URL transports.
export const MAX_SHARE_LINK_LENGTH = 7000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isWorkspaceSharePayload = (value: unknown): value is WorkspaceSharePayload => {
  if (!isObject(value)) return false;
  if (value.kind !== WORKSPACE_SHARE_KIND || value.version !== WORKSPACE_SHARE_VERSION) return false;
  if (typeof value.createdAtIso !== 'string') return false;
  if (!('workspace' in value) || !isObject(value.workspace)) return false;
  return true;
};

interface BufferLike {
  from: (value: string, encoding: string) => { toString: (encoding: string) => string };
}

const getGlobalBuffer = (): BufferLike | null => {
  const candidate = (globalThis as Record<string, unknown>).Buffer;
  if (!candidate || (typeof candidate !== 'object' && typeof candidate !== 'function')) return null;
  if (typeof (candidate as { from?: unknown }).from !== 'function') return null;
  return candidate as BufferLike;
};

const encodeBase64 = (value: string): string => {
  if (typeof btoa === 'function' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  const buffer = getGlobalBuffer();
  if (buffer) {
    return buffer.from(value, 'utf8').toString('base64');
  }

  throw new Error('Unable to encode share link in this environment.');
};

const decodeBase64 = (value: string): string => {
  if (typeof atob === 'function' && typeof TextDecoder !== 'undefined') {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  const buffer = getGlobalBuffer();
  if (buffer) {
    return buffer.from(value, 'base64').toString('utf8');
  }

  throw new Error('Unable to decode share link in this environment.');
};

const toBase64Url = (value: string): string => (
  encodeBase64(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
);

const fromBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  if (remainder === 1) {
    throw new Error('Invalid share link encoding.');
  }
  const padded = normalized + (remainder === 0 ? '' : '='.repeat(4 - remainder));
  return decodeBase64(padded);
};

export const buildWorkspaceSharePayload = (workspace: WorkspaceState): WorkspaceSharePayload => ({
  kind: WORKSPACE_SHARE_KIND,
  version: WORKSPACE_SHARE_VERSION,
  createdAtIso: new Date().toISOString(),
  workspace,
});

export const encodeWorkspaceSharePayload = (payload: WorkspaceSharePayload): string => {
  const encoded = toBase64Url(JSON.stringify(payload));
  if (encoded.length > MAX_SHARE_LINK_LENGTH) {
    throw new Error('Share link is too large to fit reliably in a URL. Use Export Workspace instead.');
  }
  return encoded;
};

export const decodeWorkspaceSharePayload = (encoded: string): WorkspaceState => {
  if (typeof encoded !== 'string' || encoded.trim() === '') {
    throw new Error('Share link is empty or invalid.');
  }

  if (encoded.length > MAX_SHARE_LINK_LENGTH) {
    throw new Error('Share link is too large to fit reliably in a URL. Use Export Workspace instead.');
  }

  let parsed: unknown;
  try {
    const rawJson = fromBase64Url(encoded);
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Share link is invalid or corrupted.');
  }

  if (!isWorkspaceSharePayload(parsed)) {
    throw new Error('Share link payload is not a valid Bedroom Layout share.');
  }

  const boundsViolation = findWorkspaceBoundsViolation(parsed.workspace);
  if (boundsViolation) {
    throw new Error(
      `Share link contains unsupported dimensions. ${boundsViolation} Use Export Workspace instead.`
    );
  }

  return sanitizeWorkspaceState(parsed.workspace);
};

export const readSharePayloadFromHash = (hash: string): WorkspaceState | null => {
  const normalized = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!normalized) return null;

  const params = new URLSearchParams(normalized);
  const encoded = params.get('share');
  if (!encoded) return null;

  return decodeWorkspaceSharePayload(encoded);
};
