import { BASE } from './data';

export interface Point { x: number; y: number }
// Orthographic view: 45 degrees around the ground plane, 45 degrees above it.
export const YAW = Math.PI / 4;
export const GROUND_SCALE = Math.SQRT1_2;
export const HEIGHT_SCALE = Math.SQRT1_2;

export function project(x: number, y: number, height = 0): Point {
  const dx = x - BASE.x, dy = y - BASE.y;
  return { x: BASE.x + (dx - dy) * Math.SQRT1_2, y: BASE.y + (dx + dy) / 2 - height * HEIGHT_SCALE };
}

export function unproject(x: number, y: number): Point {
  const dx = (x - BASE.x) * Math.SQRT1_2, dy = y - BASE.y;
  return { x: BASE.x + dx + dy, y: BASE.y - dx + dy };
}

export function projectVector(x: number, y: number): Point {
  return { x: (x - y) * Math.SQRT1_2, y: (x + y) / 2 };
}

// An upright circular building occupies an ellipse swept vertically upwards.
// This is only for visual selection; gameplay footprints stay in ground space.
export function hitsRaisedBody(point: Point, x: number, y: number, radius: number, height: number) {
  const foot = project(x, y), top = foot.y - height * HEIGHT_SCALE;
  const nearestY = Math.max(top, Math.min(foot.y, point.y));
  return ((point.x - foot.x) / radius) ** 2 + ((point.y - nearestY) / (radius * GROUND_SCALE)) ** 2 <= 1;
}
