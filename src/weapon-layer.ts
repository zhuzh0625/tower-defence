import type Phaser from 'phaser';
import { GROUND_SCALE } from './projection';
import { WEAPONS, WEAPON_TEXTURE, weaponPose, type WeaponKind } from './weapon-art';

/** Project a top-down gun into the same ground plane as its mounting socket. */
export class WeaponLayer {
  readonly root: Phaser.GameObjects.Container;
  private face: Phaser.GameObjects.Image;
  private side: Phaser.GameObjects.Image;
  private underside: Phaser.GameObjects.Container;
  constructor(scene: Phaser.Scene) {
    const texture = scene.textures.get(WEAPON_TEXTURE);
    for (const [kind, { frame: [x, y, w, h] }] of Object.entries(WEAPONS)) if (!texture.has(kind)) texture.add(kind, 0, x, y, w, h);
    this.side = scene.add.image(0, 0, WEAPON_TEXTURE, 'rapid').setTint(0x1a2521);
    this.face = scene.add.image(0, 0, WEAPON_TEXTURE, 'rapid');
    this.underside = scene.add.container(0, 0, [this.side]).setScale(1, GROUND_SCALE);
    const top = scene.add.container(0, 0, [this.face]).setScale(1, GROUND_SCALE);
    this.root = scene.add.container(0, 0, [this.underside, top]);
  }
  draw(kind: WeaponKind, x: number, y: number, angle: number, scale: number, alpha: number, recoil: number) {
    const { frame, pivot } = WEAPONS[kind], pose = weaponPose(kind, angle, scale, recoil);
    this.root.setVisible(true).setPosition(x, y).setAlpha(alpha);
    this.underside.setPosition(.5 * scale, 1.8 * scale);
    for (const image of [this.face, this.side]) image.setTexture(WEAPON_TEXTURE, kind)
      .setOrigin(pivot[0] / frame[2], pivot[1] / frame[3]).setDisplaySize(pose.width, pose.height)
      .setPosition(pose.x, pose.y).setRotation(pose.rotation);
    return pose.muzzles.map(p => ({ x: x + p.x, y: y + p.y }));
  }
}
