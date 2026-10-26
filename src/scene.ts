import Phaser from 'phaser';
import { BASE, BUILDING_GAP, WIDTH, HEIGHT, MAP_BOUNDS, SPAWN_WARNING, TERRAIN, TOWERS, ENEMIES, type TowerKind } from './data';
import { GameEngine, stats } from './engine';
import { constrainCamera, zoomLimits } from './camera-view';
import { BUILDING_RADIUS, towerVisualScale } from './building-visuals';

export interface Selection { kind: TowerKind | null; towerId: number | null; base?: boolean }
export class BoardScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private armorLabels = new Map<number, Phaser.GameObjects.Text>();
  private cursor: { x: number; y: number } | null = null;
  private visualTime = 0;
  private dragPoint: { x: number; y: number } | null = null;
  constructor(private model: GameEngine, private selection: Selection, private choose: (x: number, y: number) => void, private afterFrame: () => void, private cancel: () => void = () => { this.selection.kind = null; this.selection.towerId = null; this.selection.base = false; }) { super('battlefield'); }
  create() {
    this.cameras.main.setBackgroundColor('#193d36').setRoundPixels(false);
    this.resetView();
    this.scale.on('resize', this.resizeView, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.resizeView, this); this.armorLabels.clear(); });
    this.drawTerrain(); this.ink = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const camera = this.cameras.main;
      if (this.dragPoint && pointer.middleButtonDown()) {
        camera.scrollX -= (pointer.x - this.dragPoint.x) / camera.zoom;
        camera.scrollY -= (pointer.y - this.dragPoint.y) / camera.zoom;
        this.constrainView();
        this.dragPoint = { x: pointer.x, y: pointer.y };
        this.cursor = null;
      } else {
        this.dragPoint = null;
        this.cursor = this.worldPoint(pointer);
      }
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) { this.cancel(); this.cursor = null; return; }
      if (pointer.middleButtonDown()) { this.dragPoint = { x: pointer.x, y: pointer.y }; this.cursor = null; return; }
      if (!pointer.leftButtonDown() || this.dragPoint) return;
      this.game.canvas.focus({ preventScroll: true });
      this.cursor = this.worldPoint(pointer);
      this.choose(this.cursor.x, this.cursor.y);
    });
    this.input.on('pointerup', () => { this.dragPoint = null; });
    this.input.on('gameout', () => { this.cursor = null; this.dragPoint = null; });
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      const camera = this.cameras.main, before = this.worldPoint(pointer);
      const limits = zoomLimits(camera.width, camera.height);
      camera.setZoom(Phaser.Math.Clamp(camera.zoom * Math.exp(-dy * 0.001), limits.min, limits.max));
      const after = this.worldPoint(pointer);
      camera.scrollX += before.x - after.x; camera.scrollY += before.y - after.y;
      this.constrainView(); this.cursor = this.worldPoint(pointer);
    });
    this.game.canvas.addEventListener('mousedown', event => { if (event.button === 1) event.preventDefault(); });
    this.game.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.game.canvas.setAttribute('aria-label', '开放战场：中心为固定基地，选择炮塔后点击地图建造。');
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.tabIndex = 0;
  }
  private worldPoint(pointer: Phaser.Input.Pointer) {
    const camera = this.cameras.main;
    return { x: camera.scrollX + camera.width / 2 + (pointer.x - camera.width / 2) / camera.zoom,
      y: camera.scrollY + camera.height / 2 + (pointer.y - camera.height / 2) / camera.zoom };
  }
  private constrainView() {
    const camera = this.cameras.main;
    const view = constrainCamera(camera.width, camera.height, camera.zoom, camera.scrollX + camera.width / 2, camera.scrollY + camera.height / 2);
    camera.setZoom(view.zoom).setScroll(view.scrollX, view.scrollY);
  }
  private resizeView(size: Phaser.Structs.Size, _base: Phaser.Structs.Size, _display: Phaser.Structs.Size, previousWidth: number, previousHeight: number) {
    const camera = this.cameras.main;
    const centerX = camera.scrollX + previousWidth / 2, centerY = camera.scrollY + previousHeight / 2;
    camera.setSize(size.width, size.height).centerOn(centerX, centerY);
    this.constrainView(); this.dragPoint = null; this.cursor = null;
  }
  resetView() {
    const camera = this.cameras.main;
    camera.setZoom(zoomLimits(camera.width, camera.height).initial).centerOn(BASE.x, BASE.y);
    this.constrainView(); this.dragPoint = null; this.cursor = null;
  }
  update(_time: number, delta: number) {
    this.visualTime += Math.min(delta, 100) / 1000;
    this.model.update(delta / 1000); this.draw(); this.afterFrame();
  }
  private polygon(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, sides: number, rotation = 0) {
    const points = Array.from({ length: sides }, (_, i) => ({ x: x + Math.cos(rotation + i / sides * Math.PI * 2) * radius, y: y + Math.sin(rotation + i / sides * Math.PI * 2) * radius }));
    g.fillPoints(points, true); g.strokePoints(points, true);
  }
  private drawTerrain() {
    const g = this.add.graphics();
    g.fillStyle(0x193d36); g.fillRect(MAP_BOUNDS.left, MAP_BOUNDS.top, WIDTH, HEIGHT);
    let seed = 37;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // A quiet topographic field. These contours are terrain, never fixed lanes.
    for (let i = 0; i < 150; i++) {
      g.fillStyle(random() > 0.5 ? 0x416455 : 0x0c2d27, random() * 0.07);
      g.fillEllipse(MAP_BOUNDS.left + random() * WIDTH, MAP_BOUNDS.top + random() * HEIGHT, 40 + random() * 150, 20 + random() * 80);
    }
    for (let i = 0; i < 1100; i++) {
      const x = MAP_BOUNDS.left + random() * WIDTH, y = MAP_BOUNDS.top + random() * HEIGHT;
      g.lineStyle(1, 0x7f9a72, 0.12); g.lineBetween(x, y, x + 2, y - 4 - random() * 3);
      g.lineBetween(x + 3, y, x + 5, y - 3);
    }
    const base = BASE;
    for (const radius of [120, 220, 330, 450]) {
      g.lineStyle(1, 0xa4bf97, 0.055); g.strokeEllipse(base.x - 40, base.y + 15, radius * 2.3, radius * 1.8);
      g.strokeEllipse(base.x - 40, base.y + 15, radius * 2.3 + 14, radius * 1.8 + 10);
    }

    for (const [index, position] of TERRAIN.entries()) {
      g.fillStyle(0x102e28, 0.8); g.fillEllipse(position.x + 4, position.y + 9, 40, 26);
      g.fillStyle(0x607064); g.lineStyle(1, 0x819080, 0.5); this.polygon(g, position.x, position.y, position.radius - 0.5, 5, index * 0.7);
      g.fillStyle(0x788373, 0.8); g.lineStyle(0, 0x788373); this.polygon(g, position.x - 4, position.y - 6, 11, 3, index);
      g.fillStyle(0x405749); g.fillEllipse(position.x - 13, position.y + 8, 13, 9);
    }
    // The map boundary is part of the world, not the browser canvas outline.
    const { left, top } = MAP_BOUNDS;
    g.fillStyle(0x0d2822, 0.85);
    g.fillRect(left, top, WIDTH, 18); g.fillRect(left, MAP_BOUNDS.bottom - 18, WIDTH, 18);
    g.fillRect(left, top, 18, HEIGHT); g.fillRect(MAP_BOUNDS.right - 18, top, 18, HEIGHT);
    g.lineStyle(2, 0xa6ad78, 0.8); g.strokeRect(left + 2, top + 2, WIDTH - 4, HEIGHT - 4);
    g.lineStyle(1, 0x738665, 0.6); g.strokeRect(left + 18, top + 18, WIDTH - 36, HEIGHT - 36);
    g.lineStyle(2, 0xc3c18c, 0.75);
    for (let x = left + 40; x < MAP_BOUNDS.right; x += 80) {
      g.lineBetween(x, top + 3, x, top + 11);
      g.lineBetween(x, MAP_BOUNDS.bottom - 3, x, MAP_BOUNDS.bottom - 11);
    }
    for (let y = top + 40; y < MAP_BOUNDS.bottom; y += 80) {
      g.lineBetween(left + 3, y, left + 11, y);
      g.lineBetween(MAP_BOUNDS.right - 3, y, MAP_BOUNDS.right - 11, y);
    }
  }
  private draw() {
    const g = this.ink; g.clear();
    const base = BASE;
    const active = this.model.phase !== 'victory' && this.model.phase !== 'defeat';
    const selected = this.model.towers.find(tower => tower.id === this.selection.towerId);
    if ((this.selection.kind || this.selection.base) && active) {
      const radius = this.model.buildRadius;
      g.fillStyle(0xb3d6b9, 0.025); g.fillCircle(base.x, base.y, radius);
      g.lineStyle(1.5, 0xc6e2bd, 0.35);
      for (let angle = 0; angle < Math.PI * 2; angle += 0.09) { g.beginPath(); g.arc(base.x, base.y, radius, angle, angle + 0.04); g.strokePath(); }
      // Non-overlapping reservation rings guarantee the full lane between bases.
      g.lineStyle(1, 0xb6dfc3, 0.3);
      g.strokeCircle(base.x, base.y, BASE.radius + BUILDING_GAP / 2);
      for (const tower of this.model.towers) g.strokeCircle(tower.x, tower.y, TOWERS[tower.kind].radius + BUILDING_GAP / 2);
    }
    if (selected) {
      const position = selected;
      g.fillStyle(TOWERS[selected.kind].color, 0.06); g.fillCircle(position.x, position.y, stats(selected).range);
      g.lineStyle(1, TOWERS[selected.kind].color, 0.35); g.strokeCircle(position.x, position.y, stats(selected).range);
      g.lineStyle(2, 0xeaf1cf, 0.8); g.strokeCircle(position.x, position.y, TOWERS[selected.kind].radius + 3);
    }
    const portal = this.model.pendingSpawn;
    if (portal) {
      const t = 1 - portal.remaining / SPAWN_WARNING, radius = ENEMIES[portal.kind].radius + 17;
      g.fillStyle(0x40242f, 0.7); g.fillCircle(portal.x, portal.y, radius);
      g.lineStyle(2, 0xf3ac91, 0.9); g.strokeCircle(portal.x, portal.y, radius);
      g.lineStyle(3, 0xffdfac, 1).beginPath();
      g.arc(portal.x, portal.y, radius + 5, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2, false); g.strokePath();
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + t * Math.PI;
        g.lineStyle(2, 0xf3ac91, 0.6 + t * 0.4);
        g.lineBetween(portal.x + Math.cos(angle) * 6, portal.y + Math.sin(angle) * 6, portal.x + Math.cos(angle) * radius * 0.7, portal.y + Math.sin(angle) * radius * 0.7);
      }
    }
    // Base platform, generator and revolving radar sweep.
    g.fillStyle(0x071d19, 0.55); g.fillEllipse(base.x + 3, base.y + 13, 65, 42);
    g.lineStyle(2, 0x89b499, 0.55); g.fillStyle(0x416356); this.polygon(g, base.x, base.y, BUILDING_RADIUS.base, 6, Math.PI / 6);
    g.lineStyle(2, 0xc4d9b5, 0.75); g.fillStyle(0x203f37); this.polygon(g, base.x, base.y, 23, 6, Math.PI / 6);
    g.fillStyle(0xa7d6b0, 0.08 + Math.sin(this.visualTime * 2) * 0.025); g.fillCircle(base.x, base.y, 48);
    g.lineStyle(3, 0xa4cdae, 0.4); g.beginPath(); g.arc(base.x, base.y, 36, this.visualTime * 0.3, this.visualTime * 0.3 + 1.1); g.strokePath();
    g.fillStyle(0xbce8c2); g.fillRoundedRect(base.x - 10, base.y - 13, 20, 26, 3);
    g.fillStyle(0x3f725a); g.fillRect(base.x - 5, base.y - 6, 10, 3); g.fillRect(base.x - 5, base.y + 1, 10, 3);
    for (let level = 0; level < this.model.baseLevel; level++) {
      g.fillStyle(0xeac089); g.fillCircle(base.x - (this.model.baseLevel - 1) * 5 + level * 10, base.y + 23, 2);
    }
    if (this.model.baseWork) {
      g.lineStyle(3, 0xeac089, 0.9).beginPath();
      g.arc(base.x, base.y, 43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.model.baseWork.remaining / this.model.baseWork.duration), false); g.strokePath();
    }
    this.healthBar(base.x, base.y + 39, 52, this.model.baseHp / this.model.maxBaseHp, 0xbce8c2);
    for (const tower of this.model.towers) {
      if (tower.work) {
        const progress = 1 - tower.work.remaining / tower.work.duration;
        const radius = TOWERS[tower.kind].radius + 5;
        g.lineStyle(3, 0xeac089, 0.25).strokeCircle(tower.x, tower.y, radius);
        g.lineStyle(3, 0xeac089, 1).beginPath();
        g.arc(tower.x, tower.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress, false);
        g.strokePath();
      }
      this.turret(tower.x, tower.y, tower.kind, tower.angle, tower.level, tower.work ? 0.45 : 1, tower.work ? 0 : tower.recoil);
      if (tower.work || tower.hp < stats(tower).hp || tower.id === this.selection.towerId) { const p = tower, scale = towerVisualScale(tower.kind); this.healthBar(p.x, p.y + 23 * scale, 30 * scale, tower.hp / stats(tower).hp, 0xb5d7b8); }
    }
    const armoredIds = new Set<number>();
    for (const enemy of this.model.enemies) {
      const info = ENEMIES[enemy.kind];
      const stroke = enemy.kind === 'boss' ? 3 : 2;
      const bodyRadius = info.radius - stroke / 2;
      g.fillStyle(0x0d251f, 0.5); g.fillEllipse(enemy.x + 2, enemy.y + info.radius * 0.7, info.radius * 2.5, info.radius * 1.4);
      g.fillStyle(enemy.hit > 0 ? 0xffead4 : info.color); g.lineStyle(stroke, 0x6a3f3c);
      this.polygon(g, enemy.x, enemy.y, bodyRadius, enemy.kind === 'ranged' ? 4 : enemy.kind === 'runner' || enemy.kind === 'berserker' ? 3 : enemy.kind === 'heavy' || enemy.kind === 'boss' || enemy.kind === 'armored' ? 6 : 5, enemy.angle);
      g.lineStyle(2, 0x623c36); g.lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(enemy.angle) * bodyRadius * 0.7, enemy.y + Math.sin(enemy.angle) * bodyRadius * 0.7);
      if (enemy.kind === 'ranged') {
        g.lineStyle(3, enemy.attacking ? 0xffe3f7 : 0x79436e);
        g.lineBetween(enemy.x, enemy.y, enemy.x + Math.cos(enemy.angle) * bodyRadius * 0.9, enemy.y + Math.sin(enemy.angle) * bodyRadius * 0.9);
        g.fillStyle(0xffe3f7); g.fillCircle(enemy.x, enemy.y, 2);
      }
      if (enemy.kind === 'armored') {
        g.lineStyle(2, 0xd4e2e8, 0.8); g.strokeCircle(enemy.x, enemy.y, bodyRadius - 3);
        g.lineBetween(enemy.x - 5, enemy.y, enemy.x + 5, enemy.y);
      }
      if (enemy.kind === 'medic') {
        g.lineStyle(3, 0xf2ffe0); g.lineBetween(enemy.x - 4, enemy.y, enemy.x + 4, enemy.y);
        g.lineBetween(enemy.x, enemy.y - 4, enemy.x, enemy.y + 4);
      }
      if (enemy.kind === 'berserker' && enemy.hp <= enemy.maxHp / 2) {
        g.lineStyle(2, 0xff714f, 0.8); g.strokeCircle(enemy.x, enemy.y, info.radius + 4);
      }
      if ((enemy.slowRemaining ?? 0) > 0) {
        g.lineStyle(2, 0x9edce8, 0.8); g.strokeCircle(enemy.x, enemy.y, info.radius + 2);
      }
      if (enemy.kind === 'boss') { g.lineStyle(1, 0xf2c7a2, 0.8); g.strokeCircle(enemy.x, enemy.y, info.radius + 4); }
      const armor = 'armor' in info ? info.armor : 0;
      if (armor > 0 && enemy.hp > 0) {
        armoredIds.add(enemy.id);
        this.armoredHealthBar(enemy.id, enemy.x, enemy.y - info.radius, enemy.hp / enemy.maxHp, armor);
      } else if (enemy.hp < enemy.maxHp || enemy.kind === 'boss') this.healthBar(enemy.x, enemy.y - info.radius - 8, enemy.kind === 'boss' ? 42 : 24, enemy.hp / enemy.maxHp, info.color);
    }
    for (const [id, label] of this.armorLabels) {
      if (!armoredIds.has(id)) { label.destroy(); this.armorLabels.delete(id); }
    }
    for (const projectile of this.model.projectiles) {
      const angle = Math.atan2(projectile.ty - projectile.y, projectile.tx - projectile.x);
      g.lineStyle(projectile.kind === 'rapid' ? 2 : 3, TOWERS[projectile.kind].color, 0.35);
      g.lineBetween(projectile.x, projectile.y, projectile.x - Math.cos(angle) * 10, projectile.y - Math.sin(angle) * 10);
      g.fillStyle(TOWERS[projectile.kind].color); g.fillCircle(projectile.x, projectile.y, projectile.kind === 'rapid' ? 2.5 : 4.5);
    }
    for (const effect of this.model.effects) {
      if ((effect.kind === 'beam' || effect.kind === 'arc') && effect.tx !== undefined && effect.ty !== undefined) {
        g.lineStyle(2, effect.color ?? ENEMIES.ranged.color, effect.life / effect.duration);
        if (effect.kind === 'arc') {
          const dx = effect.tx - effect.x, dy = effect.ty - effect.y, length = Math.hypot(dx, dy) || 1;
          const mx = (effect.x + effect.tx) / 2 - dy / length * 8, my = (effect.y + effect.ty) / 2 + dx / length * 8;
          g.lineBetween(effect.x, effect.y, mx, my); g.lineBetween(mx, my, effect.tx, effect.ty);
        } else g.lineBetween(effect.x, effect.y, effect.tx, effect.ty);
        continue;
      }
      const t = 1 - effect.life / effect.duration, color = effect.kind === 'frost' ? TOWERS.frost.color : effect.kind === 'heal' ? ENEMIES.medic.color : effect.kind === 'build' ? 0xc5e5bd : effect.kind === 'damage' ? 0xed8c75 : 0xf0c59b;
      g.lineStyle(2 - t, color, (1 - t) * 0.8); g.strokeCircle(effect.x, effect.y, effect.size * (0.25 + t * 0.75));
      g.fillStyle(color, (1 - t) * (effect.kind === 'blast' ? 0.2 : 0.08)); g.fillCircle(effect.x, effect.y, effect.size * (0.2 + t * 0.6));
      if (effect.kind === 'death' || effect.kind === 'blast' || effect.kind === 'spawn') for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3; g.fillStyle(color, 1 - t); g.fillCircle(effect.x + Math.cos(angle) * effect.size * t, effect.y + Math.sin(angle) * effect.size * t, 2 * (1 - t));
      }
    }
    if (this.cursor && this.selection.kind && active) {
      const position = this.cursor;
      const valid = !this.model.canBuild(position.x, position.y, this.selection.kind);
      const color = valid ? 0xb6dfc3 : 0xe69985;
      g.fillStyle(color, 0.05); g.fillCircle(position.x, position.y, TOWERS[this.selection.kind].range);
      g.lineStyle(1, color, 0.4); g.strokeCircle(position.x, position.y, TOWERS[this.selection.kind].range);
      const footprint = TOWERS[this.selection.kind].radius;
      g.fillStyle(color, 0.2); g.fillCircle(position.x, position.y, footprint);
      g.lineStyle(2, color, 0.8); g.strokeCircle(position.x, position.y, footprint);
      const reservation = footprint + BUILDING_GAP / 2;
      g.lineStyle(1.5, color, 0.7);
      for (let angle = 0; angle < Math.PI * 2; angle += 0.3) { g.beginPath(); g.arc(position.x, position.y, reservation, angle, angle + 0.18); g.strokePath(); }
      this.turret(position.x, position.y, this.selection.kind, -Math.PI / 2, 1, 0.55, 0);
    }
  }
  private healthBar(x: number, y: number, width: number, ratio: number, color: number) {
    const g = this.ink; g.fillStyle(0x0a211d, 0.85); g.fillRoundedRect(x - width / 2 - 1, y - 1, width + 2, 5, 2);
    g.fillStyle(ratio < 0.3 ? 0xe48b77 : color, 0.9); g.fillRect(x - width / 2, y, width * Math.max(0, ratio), 3);
  }
  private armoredHealthBar(id: number, x: number, top: number, ratio: number, armor: number) {
    // Keep the badge readable when zooming out; reuse text for each living enemy.
    const scale = 1 / Math.min(1, this.cameras.main.zoom), y = top - 12 * scale, g = this.ink;
    g.save(); g.translateCanvas(x, y); g.scaleCanvas(scale, scale);
    this.healthBar(0, 0, 32, ratio, 0xd4e2e8);
    g.lineStyle(1, 0xa5c7db, 1); g.strokeRoundedRect(-17, -2, 34, 7, 2);
    const shield = [{ x: -34, y: -5 }, { x: -27, y: -7 }, { x: -20, y: -5 }, { x: -20, y: 3 }, { x: -27, y: 9 }, { x: -34, y: 3 }];
    g.fillStyle(0x243f50, 1); g.fillPoints(shield, true); g.strokePoints(shield, true);
    g.restore();
    let label = this.armorLabels.get(id);
    if (!label) {
      label = this.add.text(0, 0, String(armor), { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ecf4fb' }).setOrigin(0.5).setResolution(2).setDepth(1);
      this.armorLabels.set(id, label);
    }
    label.setText(String(armor)).setPosition(x - 27 * scale, y + 1 * scale).setScale(scale);
  }
  private turret(x: number, y: number, kind: TowerKind, angle: number, level: number, alpha: number, recoil: number) {
    const g = this.ink, color = TOWERS[kind].color;
    g.save(); g.translateCanvas(x, y); g.scaleCanvas(towerVisualScale(kind), towerVisualScale(kind));
    x = 0; y = 0;
    g.fillStyle(0x09251e, 0.55 * alpha); g.fillEllipse(x + 3, y + 10, 35, 24);
    g.lineStyle(2, 0x6c8b78, alpha); g.fillStyle(0x2c5043, alpha); this.polygon(g, x, y, 17, 6, Math.PI / 6);
    g.lineStyle(1, color, alpha * 0.55); g.fillStyle(0x426555, alpha); g.fillCircle(x, y, 12); g.strokeCircle(x, y, 12);
    const length = (kind === 'sniper' ? 29 : kind === 'rapid' ? 23 : 21) - recoil * 4;
    const barrel = (offset: number) => {
      const ox = Math.sin(angle) * offset, oy = -Math.cos(angle) * offset;
      g.lineStyle(kind === 'rapid' ? 5 : 10, 0x203e34, alpha); g.lineBetween(x + ox, y + oy, x + Math.cos(angle) * length + ox, y + Math.sin(angle) * length + oy);
      g.lineStyle(kind === 'rapid' ? 2.5 : 6, color, alpha); g.lineBetween(x + Math.cos(angle) * 5 + ox, y + Math.sin(angle) * 5 + oy, x + Math.cos(angle) * length + ox, y + Math.sin(angle) * length + oy);
    };
    if (kind === 'rapid') { barrel(-3); barrel(3); }
    else if (kind === 'sniper') { barrel(-3); barrel(3); }
    else if (kind === 'frost') {
      g.fillStyle(color, alpha); g.lineStyle(2, 0xe2ffff, alpha); this.polygon(g, x, y - 5, 10, 4, 0);
      g.lineBetween(x - 7, y - 5, x + 7, y - 5); g.lineBetween(x, y - 12, x, y + 2);
    } else if (kind === 'tesla') {
      g.lineStyle(4, color, alpha); g.lineBetween(x, y + 4, x, y - 18);
      g.lineStyle(2, color, alpha); g.strokeEllipse(x, y - 10, 23, 9); g.strokeEllipse(x, y - 16, 15, 6);
      g.fillStyle(0xf4e6ff, alpha); g.fillCircle(x, y - 20, 4);
    } else barrel(0);
    g.fillStyle(color, alpha); g.fillCircle(x, y, kind === 'rapid' ? 6 : 8);
    g.fillStyle(0x264f3b, alpha); g.fillCircle(x, y, 3);
    for (let i = 0; i < level; i++) { g.fillStyle(color, alpha); g.fillCircle(x - (level - 1) * 3 + i * 6, y + 14, 1.6); }
    g.restore();
  }
}
