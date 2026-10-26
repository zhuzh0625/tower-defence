import type Phaser from 'phaser';
import { BASE } from './data';
import { project, YAW, GROUND_SCALE } from './projection';
import { GROUND_TEXTURE, groundTiles, groundDetails, type GroundBounds } from './terrain';

/** Small shared-texture tiles, clipped together on the isometric ground plane. */
export class TerrainRenderer {
  readonly root: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private mask: Phaser.Display.Masks.GeometryMask;

  constructor(scene: Phaser.Scene, bounds: GroundBounds) {
    this.root = scene.add.container(BASE.x, BASE.y).setScale(1, GROUND_SCALE).setDepth(-2000000);
    const plane = scene.add.container(0, 0).setRotation(YAW); this.root.add(plane);
    const floor = scene.add.graphics(); plane.add(floor);
    floor.fillStyle(0x23382f).fillRect(bounds.left - BASE.x, bounds.top - BASE.y, bounds.right - bounds.left, bounds.bottom - bounds.top);
    for (const tile of groundTiles(bounds)) {
      // Mirrored neighbours share the same edge texels, avoiding hard tile seams.
      // Every tile keeps its world size, regardless of the dimensions of the map.
      const image = scene.add.image(tile.x - BASE.x, tile.y - BASE.y, GROUND_TEXTURE).setOrigin(0)
        .setDisplaySize(tile.size, tile.size).setFlip(tile.flipX, tile.flipY).setTint(0x91a59c).setAlpha(.62);
      plane.add(image);
    }
    const detail = scene.add.graphics(); plane.add(detail);
    detail.translateCanvas(-BASE.x, -BASE.y);
    this.drawDetails(detail, bounds);
    // Subdue fine texture near the fighting area without tying it to map size.
    for (let radius = 510; radius >= 110; radius -= 16) detail.fillStyle(0x26372c, .012).fillCircle(BASE.x, BASE.y, radius);
    this.drawApron(detail);
    this.drawBoundary(detail, bounds);

    // Clip in projected world space; partially covered edge tiles are never stretched.
    this.maskShape = scene.make.graphics({}, false);
    this.maskShape.fillStyle(0xffffff).fillPoints([
      project(bounds.left, bounds.top), project(bounds.right, bounds.top),
      project(bounds.right, bounds.bottom), project(bounds.left, bounds.bottom),
    ], true);
    this.mask = this.maskShape.createGeometryMask(); this.root.setMask(this.mask);
  }

  private drawDetails(g: Phaser.GameObjects.Graphics, bounds: GroundBounds) {
    for (const patch of groundDetails(bounds)) {
      g.save(); g.translateCanvas(patch.x, patch.y); g.rotateCanvas(patch.angle);
      g.fillStyle(patch.variant === 0 ? 0x9d9970 : patch.variant === 1 ? 0x0e2924 : 0x3c5c34, patch.opacity);
      g.fillEllipse(0, 0, patch.radius * 2.6, patch.radius * 1.3);
      if (patch.variant === 0) {
        // Flat weathered metal fragments, purely decorative and never obstacles.
        g.fillStyle(0x6a6251, .16).fillRoundedRect(-8, -5, 16, 10, 1);
        g.lineStyle(1, 0xb7a17b, .15).lineBetween(-7, -4, 7, -4);
        g.lineStyle(1, 0x111e1a, .3).lineBetween(-5, -2, 4, 3);
      } else {
        for (let i = 0; i < 5; i++) {
          const x = Math.cos(i * 2.4) * patch.radius * .6, y = Math.sin(i * 2.4) * patch.radius * .35;
          g.lineStyle(.8, 0x94a477, .22).lineBetween(x, y, x + 2, y - 5);
          g.lineStyle(.8, 0x5c754f, .35).lineBetween(x, y, x - 3, y - 3);
        }
      }
      g.restore();
    }
  }

  private drawApron(g: Phaser.GameObjects.Graphics) {
    const { x, y } = BASE;
    // A fixed-size service apron anchors the command bunker; it isn't a path.
    for (let radius = 104; radius >= 62; radius -= 6) g.fillStyle(0x777661, .035).fillCircle(x, y, radius);
    g.fillStyle(0x343d35, .82).fillCircle(x, y, 56);
    g.lineStyle(3, 0x9a9475, .36).strokeCircle(x, y, 56);
    g.lineStyle(1, 0x171e1a, .7).strokeCircle(x, y, 51);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      g.lineStyle(1.2, 0x171e1a, .7).lineBetween(x + Math.cos(angle) * 35, y + Math.sin(angle) * 35, x + Math.cos(angle) * 55, y + Math.sin(angle) * 55);
      g.fillStyle(0xb5b095, .55).fillCircle(x + Math.cos(angle + .12) * 49, y + Math.sin(angle + .12) * 49, 1.2);
      if (i % 3 !== 0) {
        g.lineStyle(2, 0xb39b57, .4).beginPath(); g.arc(x, y, 60, angle, angle + .18); g.strokePath();
      }
    }
  }

  private drawBoundary(g: Phaser.GameObjects.Graphics, b: GroundBounds) {
    const width = b.right - b.left, height = b.bottom - b.top;
    g.fillStyle(0x111e19, .65);
    g.fillRect(b.left, b.top, width, 12); g.fillRect(b.left, b.bottom - 12, width, 12);
    g.fillRect(b.left, b.top, 12, height); g.fillRect(b.right - 12, b.top, 12, height);
    g.lineStyle(1.5, 0x98977b, .65).strokeRect(b.left + 2, b.top + 2, width - 4, height - 4);
    g.lineStyle(1, 0x1b281e, .85).strokeRect(b.left + 12, b.top + 12, width - 24, height - 24);
    g.lineStyle(2, 0xc5ac6b, .65);
    for (let x = Math.ceil(b.left / 80) * 80; x < b.right - 12; x += 80) {
      if (x < b.left + 12) continue;
      g.lineBetween(x, b.top + 4, x, b.top + 9); g.lineBetween(x, b.bottom - 4, x, b.bottom - 9);
    }
    for (let y = Math.ceil(b.top / 80) * 80; y < b.bottom - 12; y += 80) {
      if (y < b.top + 12) continue;
      g.lineBetween(b.left + 4, y, b.left + 9, y); g.lineBetween(b.right - 4, y, b.right - 9, y);
    }
  }

  destroy() { this.root.clearMask(); this.root.destroy(); this.mask.destroy(); this.maskShape.destroy(); }
}
