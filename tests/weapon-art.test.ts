import test from 'node:test';
import assert from 'node:assert/strict';
import { hasWeapon, WEAPONS, weaponPose, type WeaponKind } from '../src/weapon-art.ts';
import { projectVector, GROUND_SCALE } from '../src/projection.ts';

test('recoil moves the gun and every muzzle backwards along its projected aim at every heading', () => {
  for (const kind of Object.keys(WEAPONS) as WeaponKind[]) for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, scale = 1.25;
    const rest = weaponPose(kind, angle, scale, 0), kick = weaponPose(kind, angle, scale, 1);
    const retreat = projectVector(-Math.cos(angle) * 3 * scale, -Math.sin(angle) * 3 * scale);
    assert.equal(kick.width, rest.width, 'recoil translates the whole assembly without squashing the texture');
    assert.ok(Math.abs(kick.x - retreat.x) < 1e-8);
    assert.ok(Math.abs(kick.y * GROUND_SCALE - retreat.y) < 1e-8);
    for (let barrel = 0; barrel < rest.muzzles.length; barrel++) {
      assert.ok(Math.abs(kick.muzzles[barrel].x - rest.muzzles[barrel].x - retreat.x) < 1e-8);
      assert.ok(Math.abs(kick.muzzles[barrel].y - rest.muzzles[barrel].y - retreat.y) < 1e-8);
    }
  }
});

test('only physical gun towers get attachments and each receiver pivot lies inside its frame', () => {
  assert.equal(hasWeapon('frost'), false); assert.equal(hasWeapon('tesla'), false);
  for (const kind of ['rapid', 'cannon', 'sniper'] as const) {
    assert.equal(hasWeapon(kind), true);
    const { frame, pivot } = WEAPONS[kind];
    assert.ok(pivot[0] > 0 && pivot[0] < frame[2] && pivot[1] > 0 && pivot[1] < frame[3]);
    assert.equal(weaponPose(kind, 0, 1, 0).muzzles.length, kind === 'cannon' ? 1 : 2);
  }
});
