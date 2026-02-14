import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOpeningOnWall } from '../src/utils/openings.js';
import { sanitizeWorkspaceState } from '../src/utils/workspaceState.js';

test('normalizeOpeningOnWall clamps opening span to wall length', () => {
  const normalizedLeft = normalizeOpeningOnWall(
    { id: 1, type: 'Window', width: 400, height: 10, x: 0, y: 0, rotate: 90 },
    'left',
    500,
    300
  );
  assert.equal(normalizedLeft.width, 300);
  const leftStart = normalizedLeft.y + normalizedLeft.height / 2 - normalizedLeft.width / 2;
  const leftEnd = normalizedLeft.y + normalizedLeft.height / 2 + normalizedLeft.width / 2;
  assert.equal(leftStart, 0);
  assert.equal(leftEnd, 300);

  const normalizedTop = normalizeOpeningOnWall(
    { id: 2, type: 'Door', width: 450, height: 10, x: 0, y: 0, rotate: 180 },
    'top',
    320,
    280
  );
  assert.equal(normalizedTop.width, 320);
  const topStart = normalizedTop.x + normalizedTop.width / 2 - normalizedTop.width / 2;
  const topEnd = normalizedTop.x + normalizedTop.width / 2 + normalizedTop.width / 2;
  assert.equal(topStart, 0);
  assert.equal(topEnd, 320);
});

test('sanitizeWorkspaceState normalizes oversized wall openings to room bounds', () => {
  const sanitized = sanitizeWorkspaceState({
    version: 5,
    activeRoomId: 'room-1',
    rooms: [
      {
        id: 'room-1',
        name: 'Room 1',
        roomWidthCm: 500,
        roomHeightCm: 300,
        items: [
          {
            id: 1,
            type: 'Window',
            width: 400,
            height: 10,
            x: 0,
            y: 0,
            rotate: 90,
            openingWall: 'left',
          },
        ],
        measures: [],
        nextItemId: 2,
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
      gridSpacing: 30,
      gridColor: '#c8d2dd',
      unit: 'cm',
      wallThicknessCm: 12,
      showDebugTelemetry: false,
      themeMode: 'system',
    },
  });

  const windowItem = sanitized.rooms[0].items[0];
  assert.equal(windowItem.width, 300);
  const spanStart = windowItem.y + windowItem.height / 2 - windowItem.width / 2;
  const spanEnd = windowItem.y + windowItem.height / 2 + windowItem.width / 2;
  assert.equal(spanStart, 0);
  assert.equal(spanEnd, 300);
});
