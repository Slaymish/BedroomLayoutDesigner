import assert from 'node:assert/strict';
import test from 'node:test';
import { getExportCaptureSize, resolveExportCaptureSize } from '../src/utils/exportCapture.js';

test('resolveExportCaptureSize prefers scroll dimensions for centered content in scroll containers', () => {
  const size = resolveExportCaptureSize({
    scrollWidth: 1240,
    clientWidth: 860,
    rectWidth: 860,
    scrollHeight: 980,
    clientHeight: 760,
    rectHeight: 760,
  });

  assert.deepEqual(size, { width: 1240, height: 980 });
});

test('resolveExportCaptureSize falls back to client and rounded rect dimensions', () => {
  const clientFallback = resolveExportCaptureSize({
    scrollWidth: 0,
    clientWidth: 710,
    rectWidth: 709.2,
    scrollHeight: 0,
    clientHeight: 530,
    rectHeight: 529.1,
  });
  assert.deepEqual(clientFallback, { width: 710, height: 530 });

  const rectFallback = resolveExportCaptureSize({
    scrollWidth: 0,
    clientWidth: 0,
    rectWidth: 709.2,
    scrollHeight: 0,
    clientHeight: 0,
    rectHeight: 529.1,
  });
  assert.deepEqual(rectFallback, { width: 710, height: 530 });
});

test('getExportCaptureSize enforces a 1px minimum capture area', () => {
  const node = {
    scrollWidth: 0,
    clientWidth: 0,
    scrollHeight: 0,
    clientHeight: 0,
    getBoundingClientRect: () => ({ width: 0, height: 0 } as DOMRect),
  };

  const size = getExportCaptureSize(node);
  assert.deepEqual(size, { width: 1, height: 1 });
});
