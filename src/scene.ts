import Phaser from 'phaser';
import { BASE, BUILDING_GAP, MAP_BOUNDS, SPAWN_WARNING, TERRAIN, TOWERS, ENEMIES, type TowerKind } from './data';
import { GameEngine, stats, type Tower, type Enemy } from './engine';
import { constrainCamera, zoomLimits } from './camera-view';
import { BUILDING_RADIUS, BASE_HEIGHT, towerHeight, towerPickHeight, towerVisualScale } from './building-visuals';
import { project, unproject, projectVector, hitsRaisedBody, YAW, GROUND_SCALE, type Point } from './projection';
import { ART_FRAMES, ART_TEXTURE, ART_URL } from './art';
import { ArtLayer } from './art-layer';
import { GROUND_TEXTURE, GROUND_URL } from './terrain';
import { TerrainRenderer } from './terrain-renderer';
import { hasWeapon, WEAPON_TEXTURE, WEAPON_URL } from './weapon-art';

export interface Selection { kind: TowerKind | null; towerId: number | null; base?: boolean }
export class BoardScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private groundInk!: Phaser.GameObjects.Graphics;
  private overlayInk!: Phaser.GameObjects.Graphics;
  private art!: ArtLayer;
  private terrain!: TerrainRenderer;
  private armorLabels = new Map<number, Phaser.GameObjects.Text>();
  private cursor: { x: number; y: number } | null = null;
  private visualTime = 0;
  private dragPoint: { x: number; y: number } | null = null;
  private dragPointerId: number | null = null;
  constructor(private model: GameEngine, private selection: Selection, private choose: (x: number, y: number) => void, private afterFrame: () => void, private cancel: () => void = () => { this.selection.kind = null; this.selection.towerId = null; this.selection.base = false; }) { super('battlefield'); }
  preload() { this.load.image(ART_TEXTURE, ART_URL); this.load.image(GROUND_TEXTURE, GROUND_URL); this.load.image(WEAPON_TEXTURE, WEAPON_URL); }
  create() {
    this.cameras.main.setBackgroundColor('#0e2724').setRoundPixels(false);
    this.resetView();
    this.scale.on('resize', this.resizeView, this);
    this.events.once('shutdown', () => { this.scale.off('resize', this.resizeView, this); this.armorLabels.clear(); this.art.destroy(); this.terrain.destroy(); });
    this.drawTerrain();
    this.groundInk = this.add.graphics().setDepth(-1000000);
    this.overlayInk = this.add.graphics().setDepth(1000000);
    this.ink = this.overlayInk; this.art = new ArtLayer(this);
    this.bindPanInput();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.cursor = this.dragPoint ? null : this.worldPoint(pointer);
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) { this.cancel(); this.cursor = null; return; }
      if (pointer.middleButtonDown()) return;
      if (!pointer.leftButtonDown() || this.dragPoint) return;
      this.game.canvas.focus({ preventScroll: true });
      this.cursor = this.worldPoint(pointer);
      const target = this.selection.kind ? this.cursor : this.pickBuilding(this.viewPoint(pointer)) ?? this.cursor;
      this.choose(target.x, target.y);
    });
    this.input.on('gameout', () => { this.cursor = null; });
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      const camera = this.cameras.main, before = this.viewPoint(pointer);
      const limits = zoomLimits(camera.width, camera.height);
      camera.setZoom(Phaser.Math.Clamp(camera.zoom * Math.exp(-dy * 0.001), limits.min, limits.max));
      const after = this.viewPoint(pointer);
      camera.scrollX += before.x - after.x; camera.scrollY += before.y - after.y;
      this.constrainView(); this.cursor = this.worldPoint(pointer);
    });
    this.game.canvas.addEventListener('mousedown', event => { if (event.button === 1) event.preventDefault(); });
    this.game.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.game.canvas.setAttribute('aria-label', '45度斜视战场：选择炮塔后自由点击地面建造，滚轮缩放，中键拖拽。');
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.tabIndex = 0;
  }
  private bindPanInput() {
    const canvas = this.game.canvas;
    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect(), camera = this.cameras.main;
      return { x: (event.clientX - rect.left) * camera.width / rect.width, y: (event.clientY - rect.top) * camera.height / rect.height };
    };
    const stop = () => {
      const id = this.dragPointerId;
      this.dragPoint = null; this.dragPointerId = null; canvas.style.cursor = '';
      if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 1) return;
      event.preventDefault(); this.dragPointerId = event.pointerId;
      this.dragPoint = point(event); this.cursor = null;
      canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.dragPointerId || !this.dragPoint) return;
      if (!(event.buttons & 4)) { stop(); return; }
      const p = point(event), camera = this.cameras.main;
      camera.scrollX -= (p.x - this.dragPoint.x) / camera.zoom;
      camera.scrollY -= (p.y - this.dragPoint.y) / camera.zoom;
      this.constrainView(); this.dragPoint = p; this.cursor = null;
    };
    const up = (event: PointerEvent) => { if (event.pointerId === this.dragPointerId && event.button === 1) stop(); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('lostpointercapture', stop);
    window.addEventListener('blur', stop);
    this.events.once('shutdown', () => {
      stop(); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', stop);
      canvas.removeEventListener('lostpointercapture', stop); window.removeEventListener('blur', stop);
    });
  }
  private viewPoint(pointer: Phaser.Input.Pointer) {
    const camera = this.cameras.main;
    return { x: camera.scrollX + camera.width / 2 + (pointer.x - camera.width / 2) / camera.zoom,
      y: camera.scrollY + camera.height / 2 + (pointer.y - camera.height / 2) / camera.zoom };
  }
  private worldPoint(pointer: Phaser.Input.Pointer) {
    const p = this.viewPoint(pointer);
    return unproject(p.x, p.y);
  }
  private pickBuilding(point: Point) {
    const buildings = [
      { x: BASE.x, y: BASE.y, radius: BASE.radius, height: BASE_HEIGHT },
      ...this.model.towers.map(t => ({ x: t.x, y: t.y, radius: TOWERS[t.kind].radius, height: towerPickHeight(t.kind) })),
    ];
    buildings.sort((a, b) => project(b.x, b.y).y - project(a.x, a.y).y);
    return buildings.find(b => hitsRaisedBody(point, b.x, b.y, b.radius, b.height));
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
    if (!this.model.paused) this.visualTime += Math.min(delta, 100) / 1000;
    this.model.update(delta / 1000); this.draw(); this.afterFrame();
  }
  private ground(g: Phaser.GameObjects.Graphics) {
    g.save(); g.translateCanvas(BASE.x, BASE.y); g.scaleCanvas(1, GROUND_SCALE);
    g.rotateCanvas(YAW); g.translateCanvas(-BASE.x, -BASE.y);
  }
  private drawTerrain() { this.terrain = new TerrainRenderer(this, MAP_BOUNDS); }
  private draw() {
    let g = this.ink = this.groundInk; g.clear(); this.art.begin();
    const base = BASE;
    const active = this.model.phase !== 'victory' && this.model.phase !== 'defeat';
    this.ground(g);
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
    for (const tower of this.model.towers) if (tower.work) {
      const radius = TOWERS[tower.kind].radius + 5;
      g.lineStyle(3, 0xeac089, 0.25).strokeCircle(tower.x, tower.y, radius);
      g.lineStyle(3, 0xeac089, 1).beginPath();
      g.arc(tower.x, tower.y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - tower.work.remaining / tower.work.duration)); g.strokePath();
    }
    if (this.model.baseWork) {
      g.lineStyle(3, 0xeac089, 0.9).beginPath();
      g.arc(base.x, base.y, 43, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - this.model.baseWork.remaining / this.model.baseWork.duration)); g.strokePath();
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
    }
    g.restore();
    // All solid objects share one painter order, including rocks and the base.
    const solids = [
      { id: 'base', y: project(base.x, base.y).y, draw: () => this.drawBase() },
      ...TERRAIN.map((rock, i) => ({ id: rock.id, y: project(rock.x, rock.y).y, draw: () => this.drawRock(rock, i) })),
      ...this.model.towers.map(tower => ({ id: `tower-${tower.id}`, y: project(tower.x, tower.y).y, draw: () => this.drawTower(tower) })),
      ...this.model.enemies.map(enemy => ({ id: `enemy-${enemy.id}`, y: project(enemy.x, enemy.y).y, draw: () => this.drawEnemy(enemy) })),
    ];
    solids.sort((a, b) => a.y - b.y);
    for (const solid of solids) { this.ink = this.art.select(solid.id, solid.y); solid.draw(); }
    if (this.cursor && this.selection.kind && active) {
      this.ink = this.art.select('preview', 999999);
      this.turret(this.cursor.x, this.cursor.y, this.selection.kind, -Math.PI / 2, 1, 0.55, 0);
    }
    this.art.end(); g = this.ink = this.overlayInk; g.clear();
    for (const projectile of this.model.projectiles) {
      const tower = this.model.towers.find(t => t.id === projectile.towerId);
      const enemy = this.model.enemies.find(e => e.id === projectile.targetId);
      const remaining = Math.hypot(projectile.tx - projectile.x, projectile.ty - projectile.y);
      const total = tower ? Math.hypot(projectile.tx - tower.x, projectile.ty - tower.y) : remaining;
      const fraction = Math.min(1, remaining / Math.max(1, total));
      const endHeight = enemy ? this.enemyHeight(enemy) : 10;
      const height = endHeight + ((tower ? towerHeight(tower.kind) + 4 : 22) - endHeight) * fraction;
      const pos = project(projectile.x, projectile.y, height);
      const angle = Math.atan2(projectile.ty - projectile.y, projectile.tx - projectile.x);
      const tail = project(projectile.x - Math.cos(angle) * 10, projectile.y - Math.sin(angle) * 10, height);
      g.lineStyle(projectile.kind === 'rapid' ? 2 : 3, TOWERS[projectile.kind].color, 0.35);
      g.lineBetween(pos.x, pos.y, tail.x, tail.y);
      g.fillStyle(TOWERS[projectile.kind].color); g.fillCircle(pos.x, pos.y, projectile.kind === 'rapid' ? 2.5 : 4.5);
    }
    for (const effect of this.model.effects) {
      if ((effect.kind === 'beam' || effect.kind === 'arc') && effect.tx !== undefined && effect.ty !== undefined) {
        const from = project(effect.x, effect.y, effect.kind === 'arc' ? 40 : 15);
        const to = project(effect.tx, effect.ty, 15);
        g.lineStyle(2, effect.color ?? ENEMIES.ranged.color, effect.life / effect.duration);
        if (effect.kind === 'arc') {
          const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) || 1;
          const mx = (from.x + to.x) / 2 - dy / length * 8, my = (from.y + to.y) / 2 + dx / length * 8;
          g.lineBetween(from.x, from.y, mx, my); g.lineBetween(mx, my, to.x, to.y);
        } else g.lineBetween(from.x, from.y, to.x, to.y);
        continue;
      }
      this.ground(g);
      const t = 1 - effect.life / effect.duration, color = effect.kind === 'frost' ? TOWERS.frost.color : effect.kind === 'heal' ? ENEMIES.medic.color : effect.kind === 'build' ? 0xc5e5bd : effect.kind === 'damage' ? 0xed8c75 : 0xf0c59b;
      g.lineStyle(2 - t, color, (1 - t) * 0.8); g.strokeCircle(effect.x, effect.y, effect.size * (0.25 + t * 0.75));
      g.fillStyle(color, (1 - t) * (effect.kind === 'blast' ? 0.2 : 0.08)); g.fillCircle(effect.x, effect.y, effect.size * (0.2 + t * 0.6));
      if (effect.kind === 'death' || effect.kind === 'blast' || effect.kind === 'spawn') for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3; g.fillStyle(color, 1 - t); g.fillCircle(effect.x + Math.cos(angle) * effect.size * t, effect.y + Math.sin(angle) * effect.size * t, 2 * (1 - t));
      }
      g.restore();
    }
    this.drawHealthBars();
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
      label = this.add.text(0, 0, String(armor), { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#ecf4fb' }).setOrigin(0.5).setResolution(2).setDepth(1000001);
      this.armorLabels.set(id, label);
    }
    label.setText(String(armor)).setPosition(x - 27 * scale, y + 1 * scale).setScale(scale);
  }
  private shadow(x: number, y: number, radius: number, alpha = 1) {
    const p = project(x + 3, y + 3), g = this.groundInk;
    g.fillStyle(0x071d19, .12 * alpha); g.fillEllipse(p.x, p.y + 1, radius * 2.6, radius * 1.65);
    g.fillStyle(0x071d19, .28 * alpha); g.fillEllipse(p.x, p.y, radius * 2, radius * 1.2);
  }
  private drawRock(rock: { x: number; y: number; radius: number }, index: number) {
    this.shadow(rock.x, rock.y, rock.radius);
    const foot = project(rock.x, rock.y);
    this.art.sprite(index % 2 ? 'rockB' : 'rockA', foot.x, foot.y + rock.radius * .5, rock.radius * 2.15, 1, index % 3 === 0);
  }
  private drawBase() {
    const g = this.ink, foot = project(BASE.x, BASE.y);
    this.shadow(BASE.x, BASE.y, 34);
    this.art.sprite('base', foot.x, foot.y + 13, BUILDING_RADIUS.base * 2);
    for (let i = 0; i < this.model.baseLevel; i++) {
      g.fillStyle(0xf7d899); g.fillRoundedRect(foot.x - (this.model.baseLevel - 1) * 5 + i * 10 - 2, foot.y + 8, 4, 2, 1);
    }
  }
  private drawTower(tower: Tower) {
    this.turret(tower.x, tower.y, tower.kind, tower.angle, tower.level, tower.work ? .45 : 1, tower.work ? 0 : tower.recoil);
  }
  private enemyHeight(enemy: Enemy) { return ENEMIES[enemy.kind].radius * 2; }
  private drawEnemy(enemy: Enemy) {
    const g = this.ink, info = ENEMIES[enemy.kind], foot = project(enemy.x, enemy.y);
    this.shadow(enemy.x, enemy.y, info.radius);
    const direction = projectVector(Math.cos(enemy.angle), Math.sin(enemy.angle));
    const stride = this.visualTime * (enemy.kind === 'runner' || enemy.kind === 'berserker' ? 13 : 8) + enemy.id * 2.4;
    const moving = enemy.path.length > 0 && !enemy.attacking;
    const bob = moving ? Math.abs(Math.sin(stride)) * Math.min(1.4, info.radius * .08) : 0;
    const tint = enemy.hit > 0 ? 0xffc9aa : (enemy.slowRemaining ?? 0) > 0 ? 0xb2e8ff : 0xffffff;
    this.art.sprite(enemy.kind, foot.x, foot.y + info.radius * .45, info.radius * 2.3, 1, direction.x < 0, bob, moving ? Math.sin(stride) * .035 : 0, tint);
    if (enemy.hit > 0) { g.fillStyle(0xffe5b5, .65); g.fillCircle(foot.x + info.radius * .25, foot.y - info.radius, 2.5); }
    if ((enemy.slowRemaining ?? 0) > 0 || enemy.kind === 'boss' || (enemy.kind === 'berserker' && enemy.hp <= enemy.maxHp / 2)) {
      g.lineStyle(2, (enemy.slowRemaining ?? 0) > 0 ? 0x9edce8 : enemy.kind === 'boss' ? 0xf2c7a2 : 0xff714f, .8);
      g.strokeEllipse(foot.x, foot.y, info.radius * 2 + 5, (info.radius * 2 + 5) * GROUND_SCALE);
    }
  }
  private drawHealthBars() {
    const base = project(BASE.x, BASE.y, BASE_HEIGHT);
    this.healthBar(base.x, base.y - 27, 52, this.model.baseHp / this.model.maxBaseHp, 0xbce8c2);
    for (const tower of this.model.towers) if (tower.work || tower.hp < stats(tower).hp || tower.id === this.selection.towerId) {
      const p = project(tower.x, tower.y, towerHeight(tower.kind));
      this.healthBar(p.x, p.y - (tower.kind === 'tesla' ? 34 : 23), 30 * towerVisualScale(tower.kind), tower.hp / stats(tower).hp, 0xb5d7b8);
    }
    const armoredIds = new Set<number>();
    for (const enemy of this.model.enemies) {
      const info = ENEMIES[enemy.kind], p = project(enemy.x, enemy.y, this.enemyHeight(enemy)), armor = 'armor' in info ? info.armor : 0;
      if (armor > 0 && enemy.hp > 0) {
        armoredIds.add(enemy.id); this.armoredHealthBar(enemy.id, p.x, p.y - info.radius * GROUND_SCALE, enemy.hp / enemy.maxHp, armor);
      } else if (enemy.hp < enemy.maxHp || enemy.kind === 'boss') this.healthBar(p.x, p.y - info.radius * GROUND_SCALE - 8, enemy.kind === 'boss' ? 42 : 24, enemy.hp / enemy.maxHp, info.color);
    }
    for (const [id, label] of this.armorLabels) if (!armoredIds.has(id)) { label.destroy(); this.armorLabels.delete(id); }
  }
  private turret(x: number, y: number, kind: TowerKind, angle: number, level: number, alpha: number, recoil: number) {
    const g = this.ink, color = TOWERS[kind].color, scale = towerVisualScale(kind), foot = project(x, y);
    this.shadow(x, y, BUILDING_RADIUS[kind], alpha);
    const width = BUILDING_RADIUS[kind] * 2, bottom = foot.y + 7 * scale;
    this.art.sprite(kind, foot.x, bottom, width, alpha);
    const [, , frameWidth, frameHeight] = ART_FRAMES[kind];
    const p = { x: foot.x, y: bottom - width * frameHeight / frameWidth * .83 };
    if (hasWeapon(kind)) {
      const muzzles = this.art.weapon(kind, p.x, p.y, angle, scale, alpha, recoil);
      if (recoil > .45) {
        const heading = projectVector(Math.cos(angle), Math.sin(angle));
        const distance = Math.hypot(heading.x, heading.y);
        for (const muzzle of muzzles) {
          g.fillStyle(0xffa744, alpha * recoil * .3); g.fillCircle(muzzle.x, muzzle.y, 5 * scale);
          g.lineStyle(2 * scale, 0xffd48b, alpha * recoil);
          g.lineBetween(muzzle.x, muzzle.y, muzzle.x + heading.x / distance * 7 * scale, muzzle.y + heading.y / distance * 7 * scale);
          g.fillStyle(0xfff2cb, alpha * recoil); g.fillCircle(muzzle.x, muzzle.y, 1.8 * scale);
        }
      }
    } else {
      const pulse = .15 + Math.sin(this.visualTime * 2.5 + x) * .06;
      g.fillStyle(color, pulse * alpha); g.fillEllipse(p.x, p.y, 12 * scale, 16 * scale);
    }
    for (let i = 0; i < level; i++) { g.fillStyle(0xf7d899, alpha); g.fillRoundedRect(foot.x - (level - 1) * 3 + i * 6 - 1.5, foot.y + 5, 3, 2, .6); }
  }
}
