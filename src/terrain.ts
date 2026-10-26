export const GROUND_TEXTURE = 'ground-moss-v1';
export const GROUND_URL = '/art/ground-moss-v1.png';
export const GROUND_TILE_SIZE = 512;
export const GROUND_DETAIL_SPACING = 192;
export interface GroundBounds { left: number; right: number; top: number; bottom: number }

// World-anchored cells: enlarging a map never resizes or relocates existing terrain.
export function groundTiles(bounds: GroundBounds) {
  const tiles: { x: number; y: number; size: number; flipX: boolean; flipY: boolean }[] = [];
  for (let row = Math.floor(bounds.top / GROUND_TILE_SIZE); row < Math.ceil(bounds.bottom / GROUND_TILE_SIZE); row++) {
    for (let col = Math.floor(bounds.left / GROUND_TILE_SIZE); col < Math.ceil(bounds.right / GROUND_TILE_SIZE); col++) {
      tiles.push({ x: col * GROUND_TILE_SIZE, y: row * GROUND_TILE_SIZE, size: GROUND_TILE_SIZE, flipX: (col & 1) !== 0, flipY: (row & 1) !== 0 });
    }
  }
  return tiles;
}

function cellRandom(x: number, y: number, salt: number) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function groundDetails(bounds: GroundBounds) {
  const details: { id: string; x: number; y: number; radius: number; angle: number; variant: number; opacity: number }[] = [];
  // Include intersecting edge cells, then let the renderer clip to the exact map.
  for (let row = Math.floor(bounds.top / GROUND_DETAIL_SPACING); row < Math.ceil(bounds.bottom / GROUND_DETAIL_SPACING); row++) {
    for (let col = Math.floor(bounds.left / GROUND_DETAIL_SPACING); col < Math.ceil(bounds.right / GROUND_DETAIL_SPACING); col++) {
      details.push({
        id: `${col}:${row}`, x: (col + .2 + cellRandom(col, row, 1) * .6) * GROUND_DETAIL_SPACING,
        y: (row + .2 + cellRandom(col, row, 2) * .6) * GROUND_DETAIL_SPACING,
        radius: 24 + cellRandom(col, row, 3) * 40, angle: cellRandom(col, row, 4) * Math.PI * 2,
        variant: Math.floor(cellRandom(col, row, 5) * 4), opacity: .06 + cellRandom(col, row, 6) * .07,
      });
    }
  }
  return details;
}
