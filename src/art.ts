import type { EnemyKind, TowerKind } from './data';
import { WEAPONS, weaponIcon, type WeaponKind } from './weapon-art';

export const ART_TEXTURE = 'battlefield-art-v1';
export const ART_URL = '/art/battlefield-atlas-v1.png';
// Transparent source rectangles. Art dimensions are never simulation dimensions.
export const ART_FRAMES = {
  base: [20, 0, 290, 307], rapid: [350, 85, 265, 207], cannon: [650, 60, 282, 244], frost: [970, 0, 270, 306],
  sniper: [25, 375, 270, 225], tesla: [340, 303, 255, 309], scout: [680, 328, 205, 282], runner: [970, 350, 270, 250],
  heavy: [25, 635, 285, 298], ranged: [380, 632, 228, 303], boss: [635, 621, 331, 315], armored: [978, 627, 264, 310],
  berserker: [25, 943, 290, 286], medic: [378, 945, 220, 283], rockA: [638, 1008, 297, 202], rockB: [970, 990, 270, 220],
} as const;
export type ArtKind = keyof typeof ART_FRAMES;

// UI and battlefield use the very same artwork, including turret attachments.
export function artIcon(kind: TowerKind | EnemyKind) {
  const [x, y, width, height] = ART_FRAMES[kind];
  const barrel = Object.hasOwn(WEAPONS, kind) ? weaponIcon(kind as WeaponKind) : '';
  return `<svg viewBox="0 0 72 72" aria-hidden="true"><svg x="3" y="${barrel ? 18 : 3}" width="66" height="${barrel ? 51 : 66}" viewBox="${x} ${y} ${width} ${height}" overflow="hidden"><image href="${ART_URL}" width="1254" height="1254"/></svg>${barrel}</svg>`;
}
