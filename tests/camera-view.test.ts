import test from 'node:test';
import assert from 'node:assert/strict';
import { constrainCamera, zoomLimits } from '../src/camera-view.ts';
import { BASE, MAP_BOUNDS } from '../src/data.ts';

test('the complete viewport stays within map bounds at every zoom and drag limit', () => {
  for (const [width, height] of [[1912, 914], [1337, 805], [390, 844], [844, 390], [3840, 2160]]) {
    const limits = zoomLimits(width, height);
    for (const zoom of [.01, limits.min, limits.initial, limits.max, 100]) {
      for (const x of [-10000, BASE.x, 10000]) for (const y of [-10000, BASE.y, 10000]) {
        const view = constrainCamera(width, height, zoom, x, y);
        const cx = view.scrollX + width / 2, cy = view.scrollY + height / 2;
        assert.ok(cx - width / (2 * view.zoom) >= MAP_BOUNDS.left - 1e-7);
        assert.ok(cx + width / (2 * view.zoom) <= MAP_BOUNDS.right + 1e-7);
        assert.ok(cy - height / (2 * view.zoom) >= MAP_BOUNDS.top - 1e-7);
        assert.ok(cy + height / (2 * view.zoom) <= MAP_BOUNDS.bottom + 1e-7);
      }
    }
  }
});

test('dragging reaches the actual world edge and reset centers the fixed base', () => {
  const width = 1337, height = 805;
  const view = constrainCamera(width, height, 2, -10000, 10000);
  assert.ok(Math.abs(view.scrollX + width / 2 - width / 4 - MAP_BOUNDS.left) < 1e-7);
  assert.ok(Math.abs(view.scrollY + height / 2 + height / 4 - MAP_BOUNDS.bottom) < 1e-7);
  const reset = constrainCamera(width, height, zoomLimits(width, height).initial);
  assert.equal(reset.scrollX + width / 2, BASE.x);
  assert.equal(reset.scrollY + height / 2, BASE.y);
});
