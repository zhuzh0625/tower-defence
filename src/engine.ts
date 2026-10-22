import { BASE, BUILD_RADIUS, CELL, COLS, ROWS, TOWERS, ENEMIES, WAVES, TERRAIN, center, inside, key, type TowerKind, type EnemyKind, type Side } from './data';
import { distanceField, nextCell } from './pathfinding';

export type Phase = 'planning' | 'combat' | 'victory' | 'defeat';
export interface Tower { id: number; kind: TowerKind; col: number; row: number; level: number; hp: number; cooldown: number; angle: number; recoil: number; kills: number }
export interface Enemy { id: number; kind: EnemyKind; x: number; y: number; cell: number; targetCell: number; hp: number; maxHp: number; attackTimer: number; angle: number; hit: number; attacking: boolean }
export interface Projectile { id: number; kind: TowerKind; x: number; y: number; targetId: number; tx: number; ty: number; damage: number; splash: number; towerId: number }
export interface Effect { x: number; y: number; life: number; duration: number; kind: 'blast' | 'hit' | 'death' | 'build' | 'damage'; size: number }
export interface GameEvent { type: 'shoot' | 'explosion' | 'build' | 'wave' | 'end' }

export function stats(tower: Tower) {
  const definition = TOWERS[tower.kind], multiplier = 1 + (tower.level - 1) * 0.55;
  return { ...definition, damage: Math.round(definition.damage * multiplier), range: definition.range + (tower.level - 1) * 0.35, hp: Math.round(definition.hp * (1 + (tower.level - 1) * 0.4)), cooldown: definition.cooldown * (1 - (tower.level - 1) * 0.1) };
}
export function upgradeCost(tower: Tower) { return Math.round(TOWERS[tower.kind].cost * (tower.level === 1 ? 0.8 : 1.2)); }
export function sellValue(tower: Tower) {
  const invested = TOWERS[tower.kind].cost + (tower.level >= 2 ? Math.round(TOWERS[tower.kind].cost * 0.8) : 0) + (tower.level >= 3 ? Math.round(TOWERS[tower.kind].cost * 1.2) : 0);
  return Math.floor(invested * 0.7 * (tower.hp / stats(tower).hp));
}

export class GameEngine {
  phase: Phase = 'planning';
  gold = 240;
  baseHp = 400;
  readonly maxBaseHp = 400;
  wave = 0;
  spawned = 0;
  kills = 0;
  elapsed = 0;
  paused = false;
  speed = 1;
  towers: Tower[] = [];
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  events: GameEvent[] = [];
  message = '先布置防线，再开始第一波进攻。';
  messageId = 0;
  private sequence = 1;
  private spawnTimer = 0;
  private occupied = new Set<number>();
  private normalField = distanceField(this.occupied);
  private breachField = distanceField(this.occupied, true);
  private accumulator = 0;

  reset() {
    this.phase = 'planning'; this.gold = 240; this.baseHp = this.maxBaseHp;
    this.wave = 0; this.spawned = 0; this.kills = 0; this.elapsed = 0;
    this.paused = false; this.speed = 1; this.towers = []; this.enemies = [];
    this.projectiles = []; this.effects = []; this.events = [];
    this.sequence = 1; this.spawnTimer = 0; this.accumulator = 0;
    this.rebuildPaths(); this.notify('新的防线已准备就绪。');
  }
  notify(message: string) { this.message = message; this.messageId++; }
  towerAt(col: number, row: number) { return this.towers.find(tower => tower.col === col && tower.row === row); }
  canBuild(col: number, row: number, kind: TowerKind): string | null {
    if (this.phase === 'victory' || this.phase === 'defeat') return '战役已结束，请重新开始。';
    if (this.paused) return '请先继续战斗。';
    if (!inside(col, row) || col < 1 || row < 1 || col >= COLS - 1 || row >= ROWS - 1) return '地图边缘无法建造。';
    if (col === BASE.col && row === BASE.row) return '这里是指挥基地。';
    if (Math.hypot(col - BASE.col, row - BASE.row) > BUILD_RADIUS) return '请在基地周围的虚线范围内建造。';
    if (TERRAIN.has(key(col, row))) return '岩石区域无法建造。';
    if (this.towerAt(col, row)) return '这个位置已有炮塔。';
    if (this.enemies.some(enemy => Math.floor(enemy.x / CELL) === col && Math.floor(enemy.y / CELL) === row || enemy.targetCell === key(col, row))) return '敌人正在经过这里。';
    if (this.gold < TOWERS[kind].cost) return '金币不足，击败敌人可获得金币。';
    return null;
  }
  build(col: number, row: number, kind: TowerKind): Tower | null {
    const error = this.canBuild(col, row, kind);
    if (error) { this.notify(error); return null; }
    this.gold -= TOWERS[kind].cost;
    const tower: Tower = { id: this.sequence++, kind, col, row, level: 1, hp: TOWERS[kind].hp, cooldown: 0, angle: -Math.PI / 2, recoil: 0, kills: 0 };
    this.towers.push(tower); this.rebuildPaths();
    this.effect(center(col, row), 'build', 34, 0.5);
    this.events.push({ type: 'build' }); this.notify(`${TOWERS[kind].name}已部署。可继续点击地图建造。`);
    return tower;
  }
  upgrade(id: number): boolean {
    const tower = this.towers.find(item => item.id === id);
    if (!tower || tower.level >= 3 || this.paused || this.phase === 'victory' || this.phase === 'defeat') return false;
    const cost = upgradeCost(tower);
    if (this.gold < cost) { this.notify('升级所需金币不足。'); return false; }
    this.gold -= cost; tower.level++; tower.hp = stats(tower).hp;
    this.effect(center(tower.col, tower.row), 'build', 42, 0.6);
    this.events.push({ type: 'build' }); this.notify(`${TOWERS[tower.kind].name}升至 ${tower.level} 级，耐久已修复。`);
    return true;
  }
  sell(id: number): boolean {
    const tower = this.towers.find(item => item.id === id);
    if (!tower || this.paused || this.phase === 'victory' || this.phase === 'defeat') return false;
    const refund = sellValue(tower); this.gold += refund;
    this.towers = this.towers.filter(item => item.id !== id); this.rebuildPaths();
    this.notify(`已拆除炮塔，返还 ${refund} 金币。`); return true;
  }
  startWave(): boolean {
    if (this.phase !== 'planning' || this.wave >= WAVES.length) return false;
    this.wave++; this.spawned = 0; this.spawnTimer = 0.7;
    this.phase = 'combat'; this.paused = false; this.accumulator = 0;
    this.events.push({ type: 'wave' }); this.notify(`第 ${this.wave} 波 · ${WAVES[this.wave - 1].name}`);
    return true;
  }
  private rebuildPaths() {
    this.occupied = new Set(this.towers.map(tower => key(tower.col, tower.row)));
    this.normalField = distanceField(this.occupied);
    this.breachField = distanceField(this.occupied, true);
  }
  private effect(position: { x: number; y: number }, kind: Effect['kind'], size: number, duration: number) {
    this.effects.push({ ...position, kind, size, duration, life: duration });
  }
  private spawn(kind: EnemyKind, side: Side) {
    const lane = this.spawned % 3;
    const col = side === 'west' ? 0 : side === 'east' ? COLS - 1 : [6, 13, 20][lane];
    const row = side === 'north' ? 0 : side === 'south' ? ROWS - 1 : [4, 9, 14][lane];
    const definition = ENEMIES[kind];
    const maxHp = Math.round(definition.hp * (1 + (this.wave - 1) * 0.1));
    this.enemies.push({ id: this.sequence++, kind, ...center(col, row), cell: key(col, row), targetCell: -1, hp: maxHp, maxHp, attackTimer: 0, angle: 0, hit: 0, attacking: false });
  }
  private hurt(enemy: Enemy, amount: number, towerId: number) {
    if (enemy.hp <= 0) return;
    enemy.hp -= amount; enemy.hit = 0.12;
    if (enemy.hp <= 0) {
      this.gold += ENEMIES[enemy.kind].reward; this.kills++;
      const tower = this.towers.find(item => item.id === towerId); if (tower) tower.kills++;
      this.effect(enemy, 'death', ENEMIES[enemy.kind].radius + 10, 0.35);
    }
  }
  /** Fixed simulation steps keep firing, movement, pause and 2x speed consistent. */
  update(realSeconds: number) {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    this.accumulator += Math.min(realSeconds, 0.1) * this.speed;
    while (this.accumulator >= 1 / 60) {
      this.tick(1 / 60); this.accumulator -= 1 / 60;
      if (this.phase as Phase === 'victory' || this.phase as Phase === 'defeat') { this.accumulator = 0; break; }
    }
  }
  private tick(dt: number) {
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter(effect => effect.life > 0);
    if (this.phase !== 'combat') return;
    this.elapsed += dt;
    const wave = WAVES[this.wave - 1];
    this.spawnTimer -= dt;
    if (this.spawned < wave.units.length && this.spawnTimer <= 0) {
      this.spawn(wave.units[this.spawned], wave.sides[this.spawned % wave.sides.length]);
      this.spawned++; this.spawnTimer += wave.interval;
    }
    for (const tower of this.towers) {
      tower.cooldown -= dt; tower.recoil = Math.max(0, tower.recoil - dt * 5);
      const info = stats(tower), position = center(tower.col, tower.row);
      let target: Enemy | undefined, priority = Infinity;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || Math.hypot(enemy.x - position.x, enemy.y - position.y) > info.range * CELL) continue;
        const score = Math.hypot(enemy.x - (BASE.col + 0.5) * CELL, enemy.y - (BASE.row + 0.5) * CELL);
        if (score < priority) { priority = score; target = enemy; }
      }
      if (!target) continue;
      tower.angle = Math.atan2(target.y - position.y, target.x - position.x);
      if (tower.cooldown <= 0) {
        tower.cooldown = info.cooldown; tower.recoil = 1;
        this.projectiles.push({ id: this.sequence++, kind: tower.kind, ...position, targetId: target.id, tx: target.x, ty: target.y, damage: info.damage, splash: info.splash * CELL, towerId: tower.id });
        if (this.events.length < 30) this.events.push({ type: 'shoot' });
      }
    }
    this.projectiles = this.projectiles.filter(projectile => {
      const target = this.enemies.find(enemy => enemy.id === projectile.targetId && enemy.hp > 0);
      if (target) { projectile.tx = target.x; projectile.ty = target.y; }
      else if (!projectile.splash) return false;
      const dx = projectile.tx - projectile.x, dy = projectile.ty - projectile.y;
      const distance = Math.hypot(dx, dy), step = (projectile.kind === 'rapid' ? 650 : 310) * dt;
      if (distance <= step) {
        if (projectile.splash) {
          for (const enemy of this.enemies) if (Math.hypot(enemy.x - projectile.tx, enemy.y - projectile.ty) <= projectile.splash) this.hurt(enemy, projectile.damage, projectile.towerId);
          this.effect({ x: projectile.tx, y: projectile.ty }, 'blast', projectile.splash, 0.42);
          if (this.events.length < 30) this.events.push({ type: 'explosion' });
        } else if (target) { this.hurt(target, projectile.damage, projectile.towerId); this.effect(target, 'hit', 12, 0.15); }
        return false;
      }
      projectile.x += dx / distance * step; projectile.y += dy / distance * step; return true;
    });
    this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
    for (const enemy of this.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt); enemy.attackTimer -= dt; enemy.attacking = false;
      if (enemy.cell === key(BASE.col, BASE.row)) {
        enemy.attacking = true;
        if (enemy.attackTimer <= 0) {
          this.baseHp = Math.max(0, this.baseHp - ENEMIES[enemy.kind].damage);
          enemy.attackTimer = 1; this.effect(center(BASE.col, BASE.row), 'damage', 35, 0.25);
          if (this.baseHp <= 0) { this.end('defeat'); return; }
        }
        continue;
      }
      if (enemy.targetCell < 0) {
        const breach = !Number.isFinite(this.normalField[enemy.cell]);
        enemy.targetCell = nextCell(enemy.cell, breach ? this.breachField : this.normalField, this.occupied, breach);
      }
      if (enemy.targetCell < 0) continue;
      const col = enemy.targetCell % COLS, row = Math.floor(enemy.targetCell / COLS);
      const position = center(col, row), dx = position.x - enemy.x, dy = position.y - enemy.y;
      enemy.angle = Math.atan2(dy, dx);
      const blocker = this.towerAt(col, row);
      if (blocker) {
        // A newly opened detour takes priority over further destruction.
        if (Number.isFinite(this.normalField[enemy.cell])) { enemy.targetCell = -1; continue; }
        enemy.attacking = true;
        if (enemy.attackTimer <= 0) {
          blocker.hp -= ENEMIES[enemy.kind].damage; enemy.attackTimer = 1;
          this.effect(position, 'damage', 20, 0.2);
          if (blocker.hp <= 0) {
            this.towers = this.towers.filter(item => item.id !== blocker.id); this.rebuildPaths();
            this.effect(position, 'blast', 30, 0.5); this.notify('一座炮塔被摧毁，敌人正在突破防线！');
            enemy.targetCell = -1;
          }
        }
        continue;
      }
      const distance = Math.hypot(dx, dy), step = ENEMIES[enemy.kind].speed * CELL * dt;
      if (distance <= step) { enemy.x = position.x; enemy.y = position.y; enemy.cell = enemy.targetCell; enemy.targetCell = -1; }
      else { enemy.x += dx / distance * step; enemy.y += dy / distance * step; }
    }
    if (this.spawned === wave.units.length && this.enemies.length === 0) {
      this.projectiles = [];
      if (this.wave === WAVES.length) this.end('victory');
      else { this.gold += wave.bonus; this.phase = 'planning'; this.events.push({ type: 'wave' }); this.notify(`第 ${this.wave} 波已守住！获得 ${wave.bonus} 金币补给，准备下一波。`); }
    }
  }
  private end(phase: 'victory' | 'defeat') {
    this.phase = phase; this.paused = false; this.events.push({ type: 'end' });
    this.notify(phase === 'victory' ? '五波进攻全部击退，基地守住了！' : '基地失守。调整布防，再试一次。');
  }
  get remaining() { return this.phase === 'combat' ? WAVES[this.wave - 1].units.length - this.spawned + this.enemies.length : 0; }
  get progress() { return this.phase === 'combat' ? 1 - this.remaining / WAVES[this.wave - 1].units.length : this.wave > 0 ? 1 : 0; }
}
