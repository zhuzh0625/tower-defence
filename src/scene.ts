import Phaser from 'phaser';
import { BASE, BUILD_RADIUS, CELL, COLS, ROWS, WIDTH, HEIGHT, TERRAIN, TOWERS, ENEMIES, WAVES, center, key, type TowerKind, type Side } from './data';
import { GameEngine, stats } from './engine';
import { BUILDING_RADIUS, towerVisualScale } from './building-visuals';

export interface Selection { kind: TowerKind | null; towerId: number | null }
export class BoardScene extends Phaser.Scene {
  private ink!: Phaser.GameObjects.Graphics;
  private cursor: { col: number; row: number } | null = null;
  private visualTime = 0;
  constructor(private model: GameEngine, private selection: Selection, private choose: (col: number, row: number) => void, private afterFrame: () => void) { super('battlefield'); }
  create() {
    this.cameras.main.setBackgroundColor('#193d36');
    this.drawTerrain(); this.ink = this.add.graphics();
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => { this.cursor = { col: Math.floor(pointer.x / CELL), row: Math.floor(pointer.y / CELL) }; });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      // Return keyboard control to the battlefield after using a toolbar button.
      this.game.canvas.focus({ preventScroll: true });
      this.choose(Math.floor(pointer.x / CELL), Math.floor(pointer.y / CELL));
    });
    this.input.on('gameout', () => { this.cursor = null; });
    this.game.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.game.canvas.setAttribute('aria-label', '开放战场：中心为固定基地，选择炮塔后点击地图建造。');
    this.game.canvas.setAttribute('role', 'img');
    this.game.canvas.tabIndex = 0;
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
    g.fillStyle(0x193d36); g.fillRect(0, 0, WIDTH, HEIGHT);
    let seed = 37;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    // A quiet topographic field. These contours are terrain, never fixed lanes.
    for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
      g.fillStyle(random() > 0.5 ? 0x416455 : 0x0c2d27, random() * 0.13);
      g.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
    for (let i = 0; i < 550; i++) {
      const x = random() * WIDTH, y = random() * HEIGHT;
      g.lineStyle(1, 0x7f9a72, 0.12); g.lineBetween(x, y, x + 2, y - 4 - random() * 3);
      g.lineBetween(x + 3, y, x + 5, y - 3);
    }
    const base = center(BASE.col, BASE.row);
    for (const radius of [120, 220, 330, 450]) {
      g.lineStyle(1, 0xa4bf97, 0.055); g.strokeEllipse(base.x - 40, base.y + 15, radius * 2.3, radius * 1.8);
      g.strokeEllipse(base.x - 40, base.y + 15, radius * 2.3 + 14, radius * 1.8 + 10);
    }
    g.lineStyle(1, 0xbad1ac, 0.065);
    for (let col = 0; col <= COLS; col++) g.lineBetween(col * CELL, 0, col * CELL, HEIGHT);
    for (let row = 0; row <= ROWS; row++) g.lineBetween(0, row * CELL, WIDTH, row * CELL);
    for (const index of TERRAIN) {
      const position = center(index % COLS, Math.floor(index / COLS));
      g.fillStyle(0x102e28, 0.8); g.fillEllipse(position.x + 4, position.y + 9, 40, 26);
      g.fillStyle(0x607064); g.lineStyle(1, 0x819080, 0.5); this.polygon(g, position.x, position.y, 19, 5, index * 0.7);
      g.fillStyle(0x788373, 0.8); g.lineStyle(0, 0x788373); this.polygon(g, position.x - 4, position.y - 6, 11, 3, index);
      g.fillStyle(0x405749); g.fillEllipse(position.x - 13, position.y + 8, 13, 9);
    }
    // Boundary markers and small survey notches.
    g.lineStyle(2, 0x9bb697, 0.16); g.strokeRect(12, 12, WIDTH - 24, HEIGHT - 24);
    for (const x of [24, WIDTH - 24]) for (const y of [24, HEIGHT - 24]) {
      g.lineStyle(2, 0xc4d6b5, 0.4); g.lineBetween(x - 6, y, x + 6, y); g.lineBetween(x, y - 6, x, y + 6);
    }
    this.add.text(28, 29, 'SECTOR 07 / 荒原哨站', { fontFamily: 'monospace', fontSize: '12px', color: '#8aa496', letterSpacing: 2 });
    this.add.text(WIDTH - 72, 30, 'N ↑', { fontFamily: 'monospace', fontSize: '14px', color: '#a9bbac' });
    this.add.text(28, HEIGHT - 40, '26 × 18   /   OPEN FIELD', { fontFamily: 'monospace', fontSize: '10px', color: '#7c998b', letterSpacing: 2 });
  }
  private draw() {
    const g = this.ink; g.clear();
    const base = center(BASE.col, BASE.row);
    const active = this.model.phase !== 'victory' && this.model.phase !== 'defeat';
    const selected = this.model.towers.find(tower => tower.id === this.selection.towerId);
    if (this.selection.kind && active) {
      const radius = BUILD_RADIUS * CELL;
      g.fillStyle(0xb3d6b9, 0.025); g.fillCircle(base.x, base.y, radius);
      g.lineStyle(1.5, 0xc6e2bd, 0.35);
      for (let angle = 0; angle < Math.PI * 2; angle += 0.09) { g.beginPath(); g.arc(base.x, base.y, radius, angle, angle + 0.04); g.strokePath(); }
    }
    if (selected) {
      const position = center(selected.col, selected.row);
      g.fillStyle(TOWERS[selected.kind].color, 0.06); g.fillCircle(position.x, position.y, stats(selected).range * CELL);
      g.lineStyle(1, TOWERS[selected.kind].color, 0.35); g.strokeCircle(position.x, position.y, stats(selected).range * CELL);
      const halfSize = 19 * towerVisualScale(selected.kind);
      g.lineStyle(2, 0xeaf1cf, 0.8); g.strokeRoundedRect(position.x - halfSize, position.y - halfSize, halfSize * 2, halfSize * 2, 5);
    }
    const wave = WAVES[Math.min(this.model.phase === 'planning' ? this.model.wave : this.model.wave - 1, 4)];
    for (const side of wave?.sides ?? []) this.spawnMarker(side, this.model.phase === 'combat');
    // Base platform, generator and revolving radar sweep.
    g.fillStyle(0x071d19, 0.55); g.fillEllipse(base.x + 3, base.y + 13, 65, 42);
    g.lineStyle(2, 0x89b499, 0.55); g.fillStyle(0x416356); this.polygon(g, base.x, base.y, BUILDING_RADIUS.base, 6, Math.PI / 6);
    g.lineStyle(2, 0xc4d9b5, 0.75); g.fillStyle(0x203f37); this.polygon(g, base.x, base.y, 23, 6, Math.PI / 6);
    g.fillStyle(0xa7d6b0, 0.08 + Math.sin(this.visualTime * 2) * 0.025); g.fillCircle(base.x, base.y, 48);
    g.lineStyle(3, 0xa4cdae, 0.4); g.beginPath(); g.arc(base.x, base.y, 36, this.visualTime * 0.3, this.visualTime * 0.3 + 1.1); g.strokePath();
    g.fillStyle(0xbce8c2); g.fillRoundedRect(base.x - 10, base.y - 13, 20, 26, 3);
    g.fillStyle(0x3f725a); g.fillRect(base.x - 5, base.y - 6, 10, 3); g.fillRect(base.x - 5, base.y + 1, 10, 3);
    this.healthBar(base.x, base.y + 39, 52, this.model.baseHp / this.model.maxBaseHp, 0xbce8c2);
    for (const tower of this.model.towers) {
      this.turret(center(tower.col, tower.row).x, center(tower.col, tower.row).y, tower.kind, tower.angle, tower.level, 1, tower.recoil);
      if (tower.hp < stats(tower).hp || tower.id === this.selection.towerId) { const p = center(tower.col, tower.row), scale = towerVisualScale(tower.kind); this.healthBar(p.x, p.y + 23 * scale, 30 * scale, tower.hp / stats(tower).hp, 0xb5d7b8); }
    }
    for (const enemy of this.model.enemies) {
      const info = ENEMIES[enemy.kind];
      const pulse = enemy.attacking ? Math.sin(this.visualTime * 12) * 2 : Math.sin(this.visualTime * 10 + enemy.id) * 1.3;
      g.fillStyle(0x0d251f, 0.5); g.fillEllipse(enemy.x + 2, enemy.y + info.radius * 0.7, info.radius * 2.5, info.radius * 1.4);
      g.fillStyle(enemy.hit > 0 ? 0xffead4 : info.color); g.lineStyle(enemy.kind === 'boss' ? 3 : 2, 0x6a3f3c);
      this.polygon(g, enemy.x, enemy.y + pulse, info.radius, enemy.kind === 'runner' ? 3 : enemy.kind === 'heavy' || enemy.kind === 'boss' ? 6 : 5, enemy.angle);
      g.lineStyle(2, 0x623c36); g.lineBetween(enemy.x, enemy.y + pulse, enemy.x + Math.cos(enemy.angle) * info.radius * 0.7, enemy.y + Math.sin(enemy.angle) * info.radius * 0.7 + pulse);
      if (enemy.kind === 'boss') { g.lineStyle(1, 0xf2c7a2, 0.8); g.strokeCircle(enemy.x, enemy.y + pulse, info.radius + 4); }
      if (enemy.hp < enemy.maxHp || enemy.kind === 'boss') this.healthBar(enemy.x, enemy.y - info.radius - 8, enemy.kind === 'boss' ? 42 : 24, enemy.hp / enemy.maxHp, info.color);
    }
    for (const projectile of this.model.projectiles) {
      const angle = Math.atan2(projectile.ty - projectile.y, projectile.tx - projectile.x);
      g.lineStyle(projectile.kind === 'rapid' ? 2 : 3, TOWERS[projectile.kind].color, 0.35);
      g.lineBetween(projectile.x, projectile.y, projectile.x - Math.cos(angle) * 10, projectile.y - Math.sin(angle) * 10);
      g.fillStyle(projectile.kind === 'rapid' ? 0xe6f4c9 : 0xf2c694); g.fillCircle(projectile.x, projectile.y, projectile.kind === 'rapid' ? 2.5 : 4.5);
    }
    for (const effect of this.model.effects) {
      const t = 1 - effect.life / effect.duration, color = effect.kind === 'build' ? 0xc5e5bd : effect.kind === 'damage' ? 0xed8c75 : 0xf0c59b;
      g.lineStyle(2 - t, color, (1 - t) * 0.8); g.strokeCircle(effect.x, effect.y, effect.size * (0.25 + t * 0.75));
      g.fillStyle(color, (1 - t) * (effect.kind === 'blast' ? 0.2 : 0.08)); g.fillCircle(effect.x, effect.y, effect.size * (0.2 + t * 0.6));
      if (effect.kind === 'death' || effect.kind === 'blast') for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3; g.fillStyle(color, 1 - t); g.fillCircle(effect.x + Math.cos(angle) * effect.size * t, effect.y + Math.sin(angle) * effect.size * t, 2 * (1 - t));
      }
    }
    if (this.cursor && this.selection.kind && active) {
      const { col, row } = this.cursor, position = center(col, row);
      const valid = !this.model.canBuild(col, row, this.selection.kind);
      const color = valid ? TOWERS[this.selection.kind].color : 0xe69985;
      g.fillStyle(color, 0.05); g.fillCircle(position.x, position.y, TOWERS[this.selection.kind].range * CELL);
      g.lineStyle(1, color, 0.4); g.strokeCircle(position.x, position.y, TOWERS[this.selection.kind].range * CELL);
      g.fillStyle(color, 0.2); g.fillRoundedRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4, 5);
      g.lineStyle(2, color, 0.8); g.strokeRoundedRect(col * CELL + 2, row * CELL + 2, CELL - 4, CELL - 4, 5);
      this.turret(position.x, position.y, this.selection.kind, -Math.PI / 2, 1, 0.55, 0);
    }
  }
  private healthBar(x: number, y: number, width: number, ratio: number, color: number) {
    const g = this.ink; g.fillStyle(0x0a211d, 0.85); g.fillRoundedRect(x - width / 2 - 1, y - 1, width + 2, 5, 2);
    g.fillStyle(ratio < 0.3 ? 0xe48b77 : color, 0.9); g.fillRect(x - width / 2, y, width * Math.max(0, ratio), 3);
  }
  private turret(x: number, y: number, kind: TowerKind, angle: number, level: number, alpha: number, recoil: number) {
    const g = this.ink, color = TOWERS[kind].color;
    g.save(); g.translateCanvas(x, y); g.scaleCanvas(towerVisualScale(kind), towerVisualScale(kind));
    x = 0; y = 0;
    g.fillStyle(0x09251e, 0.55 * alpha); g.fillEllipse(x + 3, y + 10, 35, 24);
    g.lineStyle(2, 0x6c8b78, alpha); g.fillStyle(0x2c5043, alpha); this.polygon(g, x, y, 17, 6, Math.PI / 6);
    g.lineStyle(1, color, alpha * 0.55); g.fillStyle(0x426555, alpha); g.fillCircle(x, y, 12); g.strokeCircle(x, y, 12);
    const length = (kind === 'rapid' ? 23 : 21) - recoil * 4;
    const barrel = (offset: number) => {
      const ox = Math.sin(angle) * offset, oy = -Math.cos(angle) * offset;
      g.lineStyle(kind === 'rapid' ? 5 : 10, 0x203e34, alpha); g.lineBetween(x + ox, y + oy, x + Math.cos(angle) * length + ox, y + Math.sin(angle) * length + oy);
      g.lineStyle(kind === 'rapid' ? 2.5 : 6, color, alpha); g.lineBetween(x + Math.cos(angle) * 5 + ox, y + Math.sin(angle) * 5 + oy, x + Math.cos(angle) * length + ox, y + Math.sin(angle) * length + oy);
    };
    if (kind === 'rapid') { barrel(-3); barrel(3); } else barrel(0);
    g.fillStyle(color, alpha); g.fillCircle(x, y, kind === 'rapid' ? 6 : 8);
    g.fillStyle(0x264f3b, alpha); g.fillCircle(x, y, 3);
    for (let i = 0; i < level; i++) { g.fillStyle(color, alpha); g.fillCircle(x - (level - 1) * 3 + i * 6, y + 14, 1.6); }
    g.restore();
  }
  private spawnMarker(side: Side, combat: boolean) {
    const g = this.ink, pulse = 0.45 + Math.sin(this.visualTime * 3) * 0.15;
    for (const lane of [0, 1, 2]) {
      const x = side === 'west' ? 17 : side === 'east' ? WIDTH - 17 : [6.5, 13.5, 20.5][lane] * CELL;
      const y = side === 'north' ? 17 : side === 'south' ? HEIGHT - 17 : [4.5, 9.5, 14.5][lane] * CELL;
      const angle = side === 'west' ? 0 : side === 'east' ? Math.PI : side === 'north' ? Math.PI / 2 : -Math.PI / 2;
      g.lineStyle(2, combat ? 0xf0a58d : 0xdcba8b, pulse);
      for (const offset of [0, -7]) {
        const px = x + Math.cos(angle) * offset, py = y + Math.sin(angle) * offset;
        g.lineBetween(px - Math.cos(angle + 0.7) * 8, py - Math.sin(angle + 0.7) * 8, px, py);
        g.lineBetween(px - Math.cos(angle - 0.7) * 8, py - Math.sin(angle - 0.7) * 8, px, py);
      }
    }
  }
}
