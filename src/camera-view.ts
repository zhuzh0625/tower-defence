import { BASE, WIDTH, HEIGHT, MAP_BOUNDS } from './data';

export function zoomLimits(width: number, height: number) {
  // The whole viewport must fit inside the world, even on very wide screens.
  const min = Math.max(width / WIDTH, height / HEIGHT);
  return { min, max: Math.max(2.5, min * 3), initial: Math.max(min, Math.min(width / 1040, height / 720)) };
}

export function constrainCamera(width: number, height: number, zoom: number, centerX = BASE.x, centerY = BASE.y) {
  const limits = zoomLimits(width, height);
  zoom = Math.max(limits.min, Math.min(limits.max, zoom));
  const halfWidth = width / (2 * zoom), halfHeight = height / (2 * zoom);
  centerX = Math.max(MAP_BOUNDS.left + halfWidth, Math.min(MAP_BOUNDS.right - halfWidth, centerX));
  centerY = Math.max(MAP_BOUNDS.top + halfHeight, Math.min(MAP_BOUNDS.bottom - halfHeight, centerY));
  return { zoom, scrollX: centerX - width / 2, scrollY: centerY - height / 2 };
}
