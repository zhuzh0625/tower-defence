import type { TowerKind } from './data';

// Renderer-only dimensions; never use for occupancy, pathfinding, or range.
export const BUILDING_RADIUS = { rapid: 17, cannon: 17 * 1.25, frost: 17, sniper: 18, tesla: 18, base: 30 } as const;
export const BASE_HEIGHT = 48;
export const towerHeight = (kind: TowerKind) => 22 * towerVisualScale(kind);
// Include the crystal/coil above the body when selecting visible artwork.
export const towerPickHeight = (kind: TowerKind) => towerHeight(kind) + (kind === 'tesla' ? 34 : kind === 'frost' ? 26 : 4);

export function towerVisualScale(kind: TowerKind) {
  return BUILDING_RADIUS[kind] / 17;
}
