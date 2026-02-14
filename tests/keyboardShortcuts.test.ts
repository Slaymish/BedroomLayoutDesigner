import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canDeleteActiveSelection,
  isEditableEventTarget,
  isUnmodifiedDeleteShortcut,
} from '../src/utils/keyboardShortcuts.js';

test('isUnmodifiedDeleteShortcut only accepts unmodified delete/backspace keys', () => {
  assert.equal(isUnmodifiedDeleteShortcut({ key: 'Delete', metaKey: false, ctrlKey: false, altKey: false }), true);
  assert.equal(isUnmodifiedDeleteShortcut({ key: 'Backspace', metaKey: false, ctrlKey: false, altKey: false }), true);
  assert.equal(isUnmodifiedDeleteShortcut({ key: 'Backspace', metaKey: true, ctrlKey: false, altKey: false }), false);
  assert.equal(isUnmodifiedDeleteShortcut({ key: 'x', metaKey: false, ctrlKey: false, altKey: false }), false);
});

test('canDeleteActiveSelection requires selection, completed onboarding, and closed dimension editor', () => {
  assert.equal(canDeleteActiveSelection(12, true, false), true);
  assert.equal(canDeleteActiveSelection(null, true, false), false);
  assert.equal(canDeleteActiveSelection(12, false, false), false);
  assert.equal(canDeleteActiveSelection(12, true, true), false);
});

test('isEditableEventTarget is safe in non-DOM test runtime', () => {
  assert.equal(isEditableEventTarget(null), false);
  assert.equal(isEditableEventTarget({} as EventTarget), false);
});
