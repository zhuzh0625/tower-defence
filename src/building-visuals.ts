import type { TowerKind } from './data';

// Renderer-only dimensions; never use for occupancy, pathfinding, or range.
export const BUILDING_RADIUS = { rapid: 17, cannon: 17 * 1.25, frost: 17, sniper: 18, tesla: 18, base: 30 } as const;

export function towerVisualScale(kind: TowerKind) {
  return BUILDING_RADIUS[kind] / 17;
}
