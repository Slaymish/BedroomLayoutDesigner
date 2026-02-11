import assert from 'node:assert/strict';
import test from 'node:test';
import type { OpeningWall, RoomDesign, RoomItem } from '../src/types.js';
import { rotationForWall, normalizeOpeningOnWall } from '../src/utils/openings.js';
import { createBlankRoom } from '../src/utils/workspaceState.js';
import { evaluateRoomFengShui, FENG_SHUI_RULES } from '../src/utils/fengShui.js';

const createRoom = (): RoomDesign => {
  const room = createBlankRoom('Feng Shui Test');
  room.roomWidthCm = 420;
  room.roomHeightCm = 340;
  room.setup.onboardingComplete = true;
  return room;
};

const createOpening = (
  id: number,
  type: 'Door' | 'Window',
  wall: OpeningWall,
  centerOnWallCm: number,
  roomWidthCm: number,
  roomHeightCm: number
): RoomItem => {
  const width = type === 'Door' ? 80 : 100;
  const height = 10;
  const rough: RoomItem = wall === 'top' || wall === 'bottom'
    ? {
      id,
      type,
      width,
      height,
      x: centerOnWallCm - width / 2,
      y: wall === 'top' ? 0 : roomHeightCm,
      rotate: rotationForWall(wall),
    }
    : {
      id,
      type,
      width,
      height,
      x: wall === 'left' ? 0 : roomWidthCm,
      y: centerOnWallCm - height / 2,
      rotate: rotationForWall(wall),
    };

  return normalizeOpeningOnWall(rough, wall, roomWidthCm, roomHeightCm);
};

test('safe bedroom layout does not trigger feng shui violations', () => {
  const room = createRoom();
  room.items = [
    createOpening(1, 'Door', 'top', 320, room.roomWidthCm, room.roomHeightCm),
    createOpening(2, 'Window', 'right', 220, room.roomWidthCm, room.roomHeightCm),
    {
      id: 3,
      type: 'Bed',
      width: 150,
      height: 200,
      x: 30,
      y: 12,
      rotate: 0,
    },
    {
      id: 4,
      type: 'Desk',
      width: 120,
      height: 60,
      x: 220,
      y: 190,
      rotate: 0,
    },
  ];

  const assessment = evaluateRoomFengShui(room);
  assert.equal(assessment.evaluatedRules, FENG_SHUI_RULES.length);
  assert.equal(assessment.violations.length, 0);
});

test('flags bed directly facing a door', () => {
  const room = createRoom();
  room.items = [
    createOpening(1, 'Door', 'bottom', 210, room.roomWidthCm, room.roomHeightCm),
    {
      id: 2,
      type: 'Bed',
      width: 150,
      height: 200,
      x: 135,
      y: 20,
      rotate: 0,
    },
  ];

  const assessment = evaluateRoomFengShui(room);
  assert.ok(assessment.violations.some((violation) => violation.ruleId === 'bed-not-facing-door'));
});

test('flags bed headboard when it is floating away from walls', () => {
  const room = createRoom();
  room.items = [
    createOpening(1, 'Door', 'top', 320, room.roomWidthCm, room.roomHeightCm),
    {
      id: 2,
      type: 'Bed',
      width: 150,
      height: 200,
      x: 120,
      y: 105,
      rotate: 0,
    },
  ];

  const assessment = evaluateRoomFengShui(room);
  assert.ok(assessment.violations.some((violation) => violation.ruleId === 'bed-headboard-solid-wall'));
});

test('flags beds placed under a window zone', () => {
  const room = createRoom();
  room.items = [
    createOpening(1, 'Window', 'top', 165, room.roomWidthCm, room.roomHeightCm),
    {
      id: 2,
      type: 'Bed',
      width: 150,
      height: 200,
      x: 90,
      y: 18,
      rotate: 0,
    },
  ];

  const assessment = evaluateRoomFengShui(room);
  assert.ok(assessment.violations.some((violation) => violation.ruleId === 'bed-not-under-window'));
});

test('flags blocked clearance area inside a door', () => {
  const room = createRoom();
  room.items = [
    createOpening(1, 'Door', 'top', 210, room.roomWidthCm, room.roomHeightCm),
    {
      id: 2,
      type: 'Wardrobe',
      width: 130,
      height: 70,
      x: 165,
      y: 18,
      rotate: 0,
    },
  ];

  const assessment = evaluateRoomFengShui(room);
  assert.ok(assessment.violations.some((violation) => violation.ruleId === 'door-clearance-open'));
});
