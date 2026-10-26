import type Phaser from 'phaser';
import { ART_FRAMES, ART_TEXTURE, type ArtKind } from './art';
import { WeaponLayer } from './weapon-layer';
import type { WeaponKind } from './weapon-art';

interface ArtNode { container: Phaser.GameObjects.Container; image: Phaser.GameObjects.Image; ink: Phaser.GameObjects.Graphics; weapon?: WeaponLayer }

/** Reuse one image and one attachment canvas per entity, in ground-depth order. */
export class ArtLayer {
  private nodes = new Map<string, ArtNode>();
  private seen = new Set<string>();
  private current!: ArtNode;
  constructor(private scene: Phaser.Scene) {
    const texture = scene.textures.get(ART_TEXTURE);
    for (const [key, [x, y, width, height]] of Object.entries(ART_FRAMES)) texture.add(key, 0, x, y, width, height);
  }
  begin() { this.seen.clear(); }
  select(id: string, depth: number) {
    let node = this.nodes.get(id);
    if (!node) {
      const image = this.scene.add.image(0, 0, ART_TEXTURE, 'base');
      const ink = this.scene.add.graphics();
      const container = this.scene.add.container(0, 0, [image, ink]);
      node = { container, image, ink }; this.nodes.set(id, node);
    }
    this.seen.add(id); this.current = node;
    node.container.setDepth(depth); node.image.setVisible(false); node.ink.clear();
    node.weapon?.root.setVisible(false);
    return node.ink;
  }
  sprite(kind: ArtKind, x: number, bottom: number, width: number, alpha = 1, flip = false, bob = 0, rotation = 0, tint = 0xffffff) {
    const [, , w, h] = ART_FRAMES[kind];
    this.current.image.setTexture(ART_TEXTURE, kind).setOrigin(.5, 1).setPosition(x, bottom - bob)
      .setDisplaySize(width, width * h / w).setAlpha(alpha).setFlipX(flip).setRotation(rotation).setTint(tint).setVisible(true);
  }
  end() {
    for (const [id, node] of this.nodes) if (!this.seen.has(id)) { node.container.destroy(); this.nodes.delete(id); }
  }
  weapon(kind: WeaponKind, x: number, y: number, angle: number, scale: number, alpha: number, recoil: number) {
    if (!this.current.weapon) {
      this.current.weapon = new WeaponLayer(this.scene);
      this.current.container.addAt(this.current.weapon.root, 1);
    }
    return this.current.weapon.draw(kind, x, y, angle, scale, alpha, recoil);
  }
  destroy() { for (const node of this.nodes.values()) node.container.destroy(); this.nodes.clear(); this.seen.clear(); }
}
