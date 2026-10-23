import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDING_RADIUS, towerVisualScale } from '../src/building-visuals.ts';
import { CELL } from '../src/data.ts';

test('building artwork preserves rapid size and gives cannon and base distinct sizes', () => {
  assert.equal(towerVisualScale('rapid'), 1);
  assert.equal(towerVisualScale('cannon'), 1.25);
  assert.equal(BUILDING_RADIUS.cannon / BUILDING_RADIUS.rapid, 1.25);
  assert.equal(BUILDING_RADIUS.base, 30);
  assert.ok(BUILDING_RADIUS.base / BUILDING_RADIUS.cannon > 1.25);
});

test('flat-sided cannon platform including its stroke fits inside one cell', () => {
  assert.ok(BUILDING_RADIUS.cannon * Math.sqrt(3) + 2 * towerVisualScale('cannon') < CELL);
});
