import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_EDGE_INSET, constrainCamera, zoomLimits } from '../src/camera-view.ts';
import { BASE, MAP_BOUNDS } from '../src/data.ts';
import { project, unproject } from '../src/projection.ts';

test('camera focus stays inside the map at every zoom, drag limit and viewport size', () => {
  for (const [width, height] of [[1912, 914], [1337, 805], [390, 844], [844, 390], [3840, 2160]]) {
    const limits = zoomLimits(width, height);
    for (const zoom of [.01, limits.min, limits.initial, limits.max, 100]) {
      for (const x of [-10000, BASE.x, 10000]) for (const y of [-10000, BASE.y, 10000]) {
        const view = constrainCamera(width, height, zoom, x, y);
        const cx = view.scrollX + width / 2, cy = view.scrollY + height / 2;
        const p = unproject(cx, cy);
        assert.ok(p.x >= MAP_BOUNDS.left + CAMERA_EDGE_INSET - 1e-7 && p.x <= MAP_BOUNDS.right - CAMERA_EDGE_INSET + 1e-7);
        assert.ok(p.y >= MAP_BOUNDS.top + CAMERA_EDGE_INSET - 1e-7 && p.y <= MAP_BOUNDS.bottom - CAMERA_EDGE_INSET + 1e-7);
      }
    }
  }
});

test('dragging reaches a finite edge and reset centers the fixed base', () => {
  const width = 1337, height = 805;
  const view = constrainCamera(width, height, 2, -10000, 10000);
  const center = unproject(view.scrollX + width / 2, view.scrollY + height / 2);
  assert.ok(Math.abs(center.y - (MAP_BOUNDS.bottom - CAMERA_EDGE_INSET)) < 1e-7);
  const reset = constrainCamera(width, height, zoomLimits(width, height).initial);
  assert.equal(reset.scrollX + width / 2, BASE.x);
  assert.equal(reset.scrollY + height / 2, BASE.y);
});

test('overview zoom fits all four map corners and is substantially farther than the starting view', () => {
  for (const [width, height] of [[1244, 729], [1912, 914], [390, 844], [844, 390]]) {
    const limits = zoomLimits(width, height);
    assert.ok(limits.min < limits.initial * .7);
    for (const x of [MAP_BOUNDS.left, MAP_BOUNDS.right]) for (const y of [MAP_BOUNDS.top, MAP_BOUNDS.bottom]) {
      const p = project(x, y);
      assert.ok(Math.abs(p.x - BASE.x) * limits.min < width / 2);
      assert.ok(Math.abs(p.y - BASE.y) * limits.min < height / 2);
    }
  }
});

test('screen horizontal and vertical pans remain independent even at minimum zoom', () => {
  for (const [width, height] of [[1244, 729], [1912, 914], [390, 844], [844, 390]]) {
    const limits = zoomLimits(width, height);
    for (const zoom of [limits.min, limits.initial, limits.max]) {
      for (const [dx, dy] of [[90, 0], [-90, 0], [0, 90], [0, -90], [90, 90], [-90, -90]]) {
        const view = constrainCamera(width, height, zoom, BASE.x + dx, BASE.y + dy);
        assert.ok(Math.abs(view.scrollX + width / 2 - BASE.x - dx) < 1e-7);
        assert.ok(Math.abs(view.scrollY + height / 2 - BASE.y - dy) < 1e-7);
      }
    }
  }
});
