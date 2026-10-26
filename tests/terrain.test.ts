import test from 'node:test';
import assert from 'node:assert/strict';
import { groundTiles, groundDetails, GROUND_TILE_SIZE, type GroundBounds } from '../src/terrain.ts';

const small = { left: -240, right: 1320, top: -160, bottom: 920 };
const large = { left: -1020, right: 2100, top: -700, bottom: 1460 };

test('expansion adds fixed-scale tiles without moving or changing existing ground', () => {
  const original = groundTiles(small), expanded = groundTiles(large);
  assert.ok(expanded.length > original.length * 2);
  for (const tile of original) assert.deepEqual(expanded.find(t => t.x === tile.x && t.y === tile.y), tile);
  assert.ok(expanded.every(t => t.size === GROUND_TILE_SIZE));
  const originalDetails = groundDetails(small), expandedDetails = groundDetails(large);
  for (const detail of originalDetails) assert.deepEqual(expandedDetails.find(d => d.id === detail.id), detail);
  assert.deepEqual(groundDetails(small), originalDetails, 'restarting must reproduce the same scenery');
});

test('negative, fractional and non-square map sizes are covered without holes or oversized tiles', () => {
  for (const bounds of [small, large, {left:-17.5,right:19.3,top:-4.2,bottom:3.7}, {left:-5000.25,right:6000.5,top:-350,bottom:200}, {left:-192,right:0,top:0,bottom:192}]) {
    const tiles = groundTiles(bounds);
    for (const x of [bounds.left, (bounds.left + bounds.right) / 2, bounds.right - .001]) {
      for (const y of [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom - .001]) {
        assert.equal(tiles.filter(t => x >= t.x && x < t.x + t.size && y >= t.y && y < t.y + t.size).length, 1);
      }
    }
    assert.ok(tiles.every(t => t.x < bounds.right && t.x + t.size > bounds.left && t.y < bounds.bottom && t.y + t.size > bounds.top));
  }
});

test('mirror tiling uses identical source edges for every adjoining pair including negative cells', () => {
  const tiles = groundTiles(large);
  for (const tile of tiles) {
    const right = tiles.find(t => t.x === tile.x + tile.size && t.y === tile.y);
    const below = tiles.find(t => t.y === tile.y + tile.size && t.x === tile.x);
    if (right) { assert.notEqual(right.flipX, tile.flipX); assert.equal(right.flipY, tile.flipY); }
    if (below) { assert.notEqual(below.flipY, tile.flipY); assert.equal(below.flipX, tile.flipX); }
  }
});
