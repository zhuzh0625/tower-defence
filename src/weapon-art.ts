import { GROUND_SCALE, YAW } from './projection';
import type { TowerKind } from './data';

export const WEAPON_TEXTURE = 'barrels-v1';
export const WEAPON_URL = '/art/barrels-v1.png';
// Pixel crops and receiver pivots in the top-down attachment atlas.
export const WEAPONS = {
  rapid: { frame: [52, 110, 1151, 359], pivot: [234, 176], width: 38, muzzles: [132, 245] },
  cannon: { frame: [43, 511, 1172, 370], pivot: [235, 191], width: 36, muzzles: [191] },
  sniper: { frame: [40, 896, 1184, 282], pivot: [201, 140], width: 45, muzzles: [99, 187] },
} as const;
export type WeaponKind = keyof typeof WEAPONS;
export function hasWeapon(kind: TowerKind): kind is WeaponKind { return Object.hasOwn(WEAPONS, kind); }

export function weaponPose(kind: WeaponKind, angle: number, scale: number, recoil: number) {
  const spec = WEAPONS[kind], rotation = angle + YAW, width = spec.width * scale;
  const retreat = Math.max(0, Math.min(1, recoil)) * 3 * scale;
  const unit = width / spec.frame[2], c = Math.cos(rotation), s = Math.sin(rotation);
  const muzzleX = (spec.frame[2] - spec.pivot[0] - 6) * unit - retreat;
  return {
    rotation, width, height: spec.frame[3] * unit,
    x: -c * retreat, y: -s * retreat,
    muzzles: spec.muzzles.map(y => {
      const side = (y - spec.pivot[1]) * unit;
      return { x: c * muzzleX - s * side, y: (s * muzzleX + c * side) * GROUND_SCALE };
    }),
  };
}

export function weaponIcon(kind: WeaponKind) {
  const { frame: [x, y, w, h], pivot } = WEAPONS[kind], scale = 50 / w;
  return `<g transform="translate(35 30) scale(1 ${GROUND_SCALE}) rotate(-45)"><svg x="${-pivot[0] * scale}" y="${-pivot[1] * scale}" width="50" height="${h * scale}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden"><image href="${WEAPON_URL}" width="1254" height="1254"/></svg></g>`;
}
