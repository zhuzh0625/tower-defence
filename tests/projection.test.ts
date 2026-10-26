import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, projectVector, hitsRaisedBody, GROUND_SCALE } from '../src/projection.ts';
import { BASE, MAP_BOUNDS } from '../src/data.ts';

test('continuous ground coordinates round trip without snapping', () => {
  for (let i = 0; i < 200; i++) {
    const x = MAP_BOUNDS.left + i * 7.17, y = MAP_BOUNDS.top + i * 5.03;
    const screen = project(x, y), p = unproject(screen.x, screen.y);
    assert.ok(Math.hypot(p.x - x, p.y - y) < 1e-9);
  }
});
test('45 degree ground vectors and height have separate projections', () => {
  const v = projectVector(100, 0);
  assert.ok(Math.abs(v.x - 100 / Math.sqrt(2)) < 1e-9); assert.equal(v.y, 50);
  const foot = project(BASE.x, BASE.y), top = project(BASE.x, BASE.y, 48);
  assert.equal(foot.x, top.x); assert.ok(Math.abs(foot.y - top.y - 48 * GROUND_SCALE) < 1e-9);
});
test('raised selection accepts the roof and sides but rejects adjacent ground', () => {
  const p = project(420.25, 340.5, 48);
  assert.ok(hitsRaisedBody(p, 420.25, 340.5, 31, 48));
  assert.ok(hitsRaisedBody({ x: p.x, y: p.y + 24 }, 420.25, 340.5, 31, 48));
  assert.equal(hitsRaisedBody({ x: p.x + 40, y: p.y }, 420.25, 340.5, 31, 48), false);
});
