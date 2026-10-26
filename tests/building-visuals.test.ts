import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_RADIUS, towerVisualScale } from '../src/building-visuals.ts';
import { BASE, TOWERS, TOWER_KINDS } from '../src/data.ts';

test('building artwork preserves rapid size and gives cannon and base distinct sizes', () => {
  assert.equal(towerVisualScale('rapid'), 1);
  assert.equal(towerVisualScale('cannon'), 1.25);
  assert.equal(BUILDING_RADIUS.cannon / BUILDING_RADIUS.rapid, 1.25);
  assert.equal(BUILDING_RADIUS.base, 30);
  assert.ok(BUILDING_RADIUS.base / BUILDING_RADIUS.cannon > 1.25);
});

test('physical footprints cover the platforms including their strokes', () => {
  for (const kind of TOWER_KINDS) assert.ok(TOWERS[kind].radius >= BUILDING_RADIUS[kind] + towerVisualScale(kind));
  assert.ok(BASE.radius >= BUILDING_RADIUS.base + 1);
});
