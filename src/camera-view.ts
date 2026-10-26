import { BASE, WIDTH, HEIGHT, MAP_BOUNDS } from './data';
import { project, unproject } from './projection';

// Keep the focus on playable terrain without shrinking a pan axis to zero.
export const CAMERA_EDGE_INSET = 40;

export function zoomLimits(width: number, height: number) {
  const projectedWidth = (WIDTH + HEIGHT) * Math.SQRT1_2;
  const projectedHeight = (WIDTH + HEIGHT) / 2;
  // Fit the whole diamond with a small margin. Its exterior is a dark backdrop.
  const min = Math.min(width / projectedWidth, height / projectedHeight) * .9;
  const initial = Math.max(min, .75, Math.min(width / 1120, height / 760));
  return { min, max: Math.max(2.5, initial * 3), initial };
}

export function constrainCamera(width: number, height: number, zoom: number, centerX = BASE.x, centerY = BASE.y) {
  const limits = zoomLimits(width, height);
  zoom = Math.max(limits.min, Math.min(limits.max, zoom));
  const ground = unproject(centerX, centerY);
  ground.x = Math.max(MAP_BOUNDS.left + CAMERA_EDGE_INSET, Math.min(MAP_BOUNDS.right - CAMERA_EDGE_INSET, ground.x));
  ground.y = Math.max(MAP_BOUNDS.top + CAMERA_EDGE_INSET, Math.min(MAP_BOUNDS.bottom - CAMERA_EDGE_INSET, ground.y));
  const center = project(ground.x, ground.y);
  return { zoom, scrollX: center.x - width / 2, scrollY: center.y - height / 2 };
}
