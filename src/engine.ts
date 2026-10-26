import { BASE, BASE_LEVELS, BUILDING_GAP, INITIAL_PREPARATION, INTERMISSION, constructionTime, MAP_BOUNDS, SPAWN_WARNING, SPAWN_DISTANCE, TOWERS, ENEMIES, FROST, CHAIN, WAVES, TERRAIN, type TowerKind, type EnemyKind, type Side } from './data';
import { Navigator, clearSegment, distance, sweepMove, type Point } from './pathfinding';

export type Phase = 'planning' | 'combat' | 'victory' | 'defeat';
export type GameMode = 'normal' | 'test';
export type TestOption = 'instantBuild' | 'freeBuild';
export interface TowerWork { kind: 'build' | 'upgrade'; remaining: number; duration: number; targetLevel: number; cost: number; damageTaken: number }
export interface Tower { id: number; kind: TowerKind; x: number; y: number; level: number; hp: number; cooldown: number; angle: number; recoil: number; kills: number; work: TowerWork | null }
export interface Enemy { id: number; kind: EnemyKind; x: number; y: number; path: Point[]; revision: number; targetId: string; hp: number; maxHp: number; attackTimer: number; angle: number; hit: number; attacking: boolean; slowRemaining?: number; healTimer?: number }
export interface Projectile { id: number; kind: TowerKind; x: number; y: number; targetId: number; tx: number; ty: number; damage: number; splash: number; towerId: number }
export interface Effect { x: number; y: number; life: number; duration: number; kind: 'blast' | 'hit' | 'death' | 'build' | 'damage' | 'beam' | 'spawn' | 'frost' | 'arc' | 'heal'; size: number; tx?: number; ty?: number; color?: number }
export interface GameEvent { type: 'shoot' | 'explosion' | 'build' | 'wave' | 'end' }
interface RoutePlan { path: Point[]; targetId: string }
interface PendingPlan { revision: number; search: Generator<void, RoutePlan | null> }
// Shared by every enemy and simulation substep in one rendered update.
const NAVIGATION_BUDGET_MS = 2;
const NAVIGATION_SLICES = 128;

export function stats(tower: Tower) {
  const definition = TOWERS[tower.kind], multiplier = 1 + (tower.level - 1) * 0.55;
  return { ...definition, damage: Math.round(definition.damage * multiplier), range: definition.range + (tower.level - 1) * 14, hp: Math.round(definition.hp * (1 + (tower.level - 1) * 0.4)), cooldown: definition.cooldown * (1 - (tower.level - 1) * 0.1) };
}
export function upgradeCost(tower: Tower) { return Math.round(TOWERS[tower.kind].cost * (tower.level === 1 ? 0.8 : 1.2)); }
export function sellValue(tower: Tower) {
  const invested = TOWERS[tower.kind].cost + (tower.level >= 2 ? Math.round(TOWERS[tower.kind].cost * 0.8) : 0) + (tower.level >= 3 ? Math.round(TOWERS[tower.kind].cost * 1.2) : 0);
  const pending = tower.work?.kind === 'upgrade' ? tower.work.cost : 0;
  return Math.floor((invested + pending) * 0.7 * (tower.hp / stats(tower).hp));
}

export class GameEngine {
  mode: GameMode = 'normal';
  testOptions = { instantBuild: false, freeBuild: false };
  get freeBuilding() { return this.mode === 'test' && this.testOptions.freeBuild; }
  get instantBuilding() { return this.mode === 'test' && this.testOptions.instantBuild; }
  buildTime(level: number) { return this.instantBuilding ? 0 : constructionTime(level); }
  setTestOption(option: TestOption, enabled: boolean) {
    if (this.mode !== 'test' || this.phase === 'victory' || this.phase === 'defeat') return false;
    this.testOptions[option] = enabled;
    if (this.instantBuilding) this.updateConstruction(Infinity);
    return true;
  }
  phase: Phase = 'planning';
  preparationRemaining = INITIAL_PREPARATION;
  gold = 240;
  baseHp = 400;
  baseLevel = 1;
  baseWork: { remaining: number; duration: number } | null = null;
  get buildRadius() { return BASE_LEVELS[this.baseLevel - 1].radius; }
  get baseUpgradeCost() { return BASE_LEVELS[this.baseLevel]?.cost ?? 0; }
  upgradeBase() {
    if (this.baseLevel >= BASE_LEVELS.length || this.baseWork || this.paused || this.phase === 'victory' || this.phase === 'defeat') return false;
    if (!this.freeBuilding && this.gold < this.baseUpgradeCost) { this.notify('金币不足'); return false; }
    if (!this.freeBuilding) this.gold -= this.baseUpgradeCost;
    const duration = this.buildTime(this.baseLevel + 1);
    this.baseWork = { remaining: duration, duration }; this.notify('主基地开始升级');
    this.updateConstruction(0); return true;
  }
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
  message = `首波准备中`;
  messageId = 0;
  private sequence = 1;
  pendingSpawn: { kind: EnemyKind; side: Side; x: number; y: number; remaining: number } | null = null;
  get spawnRadius() { return this.buildRadius + SPAWN_DISTANCE; }
  private spawnTimer = 0;
  private revision = 0;
  private navigator = new Navigator([BASE, ...TERRAIN]);
  private pendingPlans = new Map<number, PendingPlan>();
  private navigationMs = 0;
  private navigationSlices = 0;
  private accumulator = 0;

  reset(mode: GameMode = 'normal') {
    this.mode = mode; this.testOptions = { instantBuild: false, freeBuild: false };
    this.baseLevel = 1; this.baseWork = null;
    this.phase = 'planning'; this.gold = 240; this.baseHp = this.maxBaseHp;
    this.preparationRemaining = INITIAL_PREPARATION;
    this.wave = 0; this.spawned = 0; this.kills = 0; this.elapsed = 0;
    this.paused = false; this.speed = 1; this.towers = []; this.enemies = [];
    this.projectiles = []; this.effects = []; this.events = [];
    this.sequence = 1; this.pendingSpawn = null; this.spawnTimer = 0; this.accumulator = 0;
    this.rebuildPaths(); this.notify(`战役开始`);
  }
  notify(message: string) { this.message = message; this.messageId++; }
  towerAt(x: number, y: number) { return this.towers.find(tower => distance({ x, y }, tower) <= TOWERS[tower.kind].radius); }
  canBuild(x: number, y: number, kind: TowerKind): string | null {
    if (this.phase === 'victory' || this.phase === 'defeat') return '战役已结束';
    if (this.paused) return '游戏已暂停';
    if (this.baseLevel < TOWERS[kind].requiredBase) return `需要 ${TOWERS[kind].requiredBase} 级基地`;
    const point = { x, y }, radius = TOWERS[kind].radius;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < MAP_BOUNDS.left + radius || y < MAP_BOUNDS.top + radius || x > MAP_BOUNDS.right - radius || y > MAP_BOUNDS.bottom - radius) return '超出地图边界';
    if (distance(point, BASE) < radius + BASE.radius + BUILDING_GAP - 1e-7) return '建筑间距不足';
    if (distance(point, BASE) + radius > this.buildRadius) return '超出建造范围';
    if (TERRAIN.some(rock => distance(point, rock) < radius + rock.radius + 2)) return '与岩石重叠';
    if (this.towers.some(tower => distance(point, tower) < radius + TOWERS[tower.kind].radius + BUILDING_GAP - 1e-7)) return '建筑间距不足';
    if (this.enemies.some(enemy => enemy.hp > 0 && distance(point, enemy) < radius + ENEMIES[enemy.kind].radius + 2)) return '敌人占据该位置';
    if (!this.freeBuilding && this.gold < TOWERS[kind].cost) return '金币不足';
    return null;
  }
  build(x: number, y: number, kind: TowerKind): Tower | null {
    const error = this.canBuild(x, y, kind);
    if (error) { this.notify(error); return null; }
    if (!this.freeBuilding) this.gold -= TOWERS[kind].cost;
    const duration = this.buildTime(1);
    const tower: Tower = { id: this.sequence++, kind, x, y, level: 1, hp: TOWERS[kind].hp, cooldown: 0, angle: -Math.PI / 2, recoil: 0, kills: 0, work: { kind: 'build', remaining: duration, duration, targetLevel: 1, cost: TOWERS[kind].cost, damageTaken: 0 } };
    this.towers.push(tower); this.rebuildPaths({ x, y, radius: TOWERS[kind].radius });
    this.effect(tower, 'build', 34, 0.5);
    this.events.push({ type: 'build' }); this.notify(`${TOWERS[kind].name}开始建造`);
    this.updateConstruction(0);
    return tower;
  }
  upgrade(id: number): boolean {
    const tower = this.towers.find(item => item.id === id);
    if (!tower || tower.work || tower.level >= 3 || this.paused || this.phase === 'victory' || this.phase === 'defeat') return false;
    const cost = upgradeCost(tower);
    if (!this.freeBuilding && this.gold < cost) { this.notify('金币不足'); return false; }
    if (!this.freeBuilding) this.gold -= cost;
    const targetLevel = tower.level + 1, duration = this.buildTime(targetLevel);
    tower.work = { kind: 'upgrade', remaining: duration, duration, targetLevel, cost, damageTaken: 0 };
    this.effect(tower, 'build', 42, 0.6);
    this.events.push({ type: 'build' }); this.notify(`${TOWERS[tower.kind].name}开始升级`);
    this.updateConstruction(0);
    return true;
  }
  sell(id: number): boolean {
    const tower = this.towers.find(item => item.id === id);
    if (!tower || this.paused || this.phase === 'victory' || this.phase === 'defeat') return false;
    const refund = sellValue(tower); this.gold += refund;
    this.towers = this.towers.filter(item => item.id !== id); this.rebuildPaths();
    this.notify(`炮塔已拆除 +${refund} 金币`); return true;
  }
  startWave(): boolean {
    if (this.phase !== 'planning' || this.paused || this.wave >= WAVES.length) return false;
    this.wave++; this.spawned = 0; this.spawnTimer = 0.7;
    this.phase = 'combat'; this.preparationRemaining = 0;
    this.events.push({ type: 'wave' }); this.notify(`第 ${this.wave} 波 · ${WAVES[this.wave - 1].name}`);
    return true;
  }
  private rebuildPaths(added?: { x: number; y: number; radius: number }) {
    const previous = this.revision;
    this.revision++;
    this.pendingPlans.clear();
    this.navigator.setDynamicObstacles(this.towers.map(tower => ({ id: `tower-${tower.id}`, x: tower.x, y: tower.y, radius: TOWERS[tower.kind].radius })));
    if (added) for (const enemy of this.enemies) {
      if (enemy.revision !== previous || enemy.targetId !== 'base' || !enemy.path.length) continue;
      let from: Point = enemy;
      const unaffected = enemy.path.every(point => {
        const clear = clearSegment(from, point, ENEMIES[enemy.kind].radius, [added]); from = point; return clear;
      });
      if (unaffected) enemy.revision = this.revision;
    }
  }
  private effect(position: { x: number; y: number }, kind: Effect['kind'], size: number, duration: number) {
    this.effects.push({ x: position.x, y: position.y, kind, size, duration, life: duration });
  }
  private spawnFree(position: Point, kind: EnemyKind) {
    const radius = ENEMIES[kind].radius;
    return position.x >= MAP_BOUNDS.left + radius + 1 && position.x <= MAP_BOUNDS.right - radius - 1
      && position.y >= MAP_BOUNDS.top + radius + 1 && position.y <= MAP_BOUNDS.bottom - radius - 1
      && this.navigator.obstacles.every(solid => distance(position, solid) >= radius + solid.radius + 3)
      && this.enemies.every(enemy => distance(position, enemy) >= radius + ENEMIES[enemy.kind].radius + 3);
  }
  private spawnLocation(kind: EnemyKind, side: Side): Point | null {
    const direction = { west: Math.PI, north: -Math.PI / 2, east: 0, south: Math.PI / 2 }[side];
    for (let attempt = 0; attempt < 32; attempt++) {
      const spread = ((this.spawned * 0.381966 + this.wave * 0.137 + attempt * 0.618034) % 1 - 0.5) * 1.2;
      const angle = direction + spread;
      const position = { x: BASE.x + Math.cos(angle) * this.spawnRadius, y: BASE.y + Math.sin(angle) * this.spawnRadius };
      if (this.spawnFree(position, kind)) return position;
    }
    return null;
  }
  spawnTestEnemies(kind: EnemyKind, count: number, side: Side): number {
    if (this.mode !== 'test' || this.phase === 'victory' || this.phase === 'defeat'
      || !Object.hasOwn(ENEMIES, kind) || !Number.isInteger(count) || count < 1 || count > 20
      || !['west', 'north', 'east', 'south'].includes(side)) return 0;
    let created = 0;
    for (; created < count; created++) {
      const position = this.spawnLocation(kind, side);
      if (!position) break;
      this.createEnemy(kind, position);
    }
    this.notify(created ? `已创建 ${created} 名${ENEMIES[kind].name}` : '出生空间不足');
    return created;
  }
  private createEnemy(kind: EnemyKind, position: Point) {
    const maxHp = Math.round(ENEMIES[kind].hp * (1 + Math.max(0, this.wave - 1) * 0.1));
    this.enemies.push({ id: this.sequence++, kind, ...position, path: [], revision: -1, targetId: 'base', hp: maxHp, maxHp, attackTimer: 0, angle: 0, hit: 0, attacking: false });
    this.effect(position, 'spawn', ENEMIES[kind].radius + 26, 0.6);
  }
  private updateSpawning(dt: number) {
    const wave = WAVES[this.wave - 1];
    if (this.spawned >= wave.units.length) return;
    if (!this.pendingSpawn) {
      this.spawnTimer -= dt;
      if (this.spawnTimer > 0) return;
      const kind = wave.units[this.spawned], side = wave.sides[this.spawned % wave.sides.length];
      const position = this.spawnLocation(kind, side);
      if (position) this.pendingSpawn = { kind, side, ...position, remaining: SPAWN_WARNING };
      return;
    }
    const portal = this.pendingSpawn;
    portal.remaining = Math.max(0, portal.remaining - dt);
    if (portal.remaining > 1e-8) return;
    if (!this.spawnFree(portal, portal.kind)) {
      this.pendingSpawn = null; this.spawnTimer = 0; return;
    }
    this.createEnemy(portal.kind, { x: portal.x, y: portal.y });
    this.spawned++; this.pendingSpawn = null; this.spawnTimer = Math.max(0, wave.interval - SPAWN_WARNING);
  }
  private hurt(enemy: Enemy, amount: number, towerId: number, ignoreArmor = false) {
    if (enemy.hp <= 0) return;
    const armor = enemy.kind === 'armored' && !ignoreArmor ? ENEMIES.armored.armor : 0;
    enemy.hp -= Math.max(1, amount - armor); enemy.hit = 0.12;
    if (enemy.hp <= 0) {
      this.gold += ENEMIES[enemy.kind].reward; this.kills++;
      const tower = this.towers.find(item => item.id === towerId); if (tower) tower.kills++;
      this.effect(enemy, 'death', ENEMIES[enemy.kind].radius + 10, 0.35);
    }
  }
  /** Fixed simulation steps keep firing, movement, pause and 2x speed consistent. */
  update(realSeconds: number) {
    if (this.paused || this.phase === 'victory' || this.phase === 'defeat') return;
    this.navigationMs = NAVIGATION_BUDGET_MS; this.navigationSlices = NAVIGATION_SLICES;
    this.accumulator += Math.min(realSeconds, 0.1) * this.speed;
    while (this.accumulator >= 1 / 60) {
      this.tick(1 / 60); this.accumulator -= 1 / 60;
      if (this.phase as Phase === 'victory' || this.phase as Phase === 'defeat') { this.accumulator = 0; break; }
    }
  }
  private updateConstruction(dt: number) {
    if (this.baseWork) {
      this.baseWork.remaining = Math.max(0, this.baseWork.remaining - dt);
      if (this.baseWork.remaining <= 1e-8) {
        this.baseLevel++; this.baseWork = null;
        // Re-warn at the new outer position; existing enemies keep their positions.
        if (this.pendingSpawn) { this.pendingSpawn = null; this.spawnTimer = 0; }
        this.notify('主基地升级完成');
      }
    }
    for (const tower of this.towers) {
      const work = tower.work;
      if (!work) continue;
      work.remaining = Math.max(0, work.remaining - dt);
      if (work.remaining > 1e-8) continue;
      if (work.kind === 'upgrade') {
        tower.level = work.targetLevel;
        // Repair pre-existing damage, but preserve damage suffered during work.
        tower.hp = stats(tower).hp - work.damageTaken;
      }
      tower.work = null;
      this.effect(tower, 'build', 36, 0.4);
      this.notify(`${TOWERS[tower.kind].name}${work.kind === 'build' ? '建造' : '升级'}完成`);
    }
  }
  private tick(dt: number) {
    this.updateConstruction(dt);
    for (const effect of this.effects) effect.life -= dt;
    this.effects = this.effects.filter(effect => effect.life > 0);
    if (this.phase === 'planning') {
      this.preparationRemaining = Math.max(0, this.preparationRemaining - dt);
      if (this.preparationRemaining <= 1e-8) this.startWave();
      if (this.phase === 'planning' && !(this.mode === 'test' && this.enemies.length)) return;
    }
    if (this.phase !== 'combat' && !(this.mode === 'test' && this.phase === 'planning' && this.enemies.length)) return;
    this.elapsed += dt;
    const wave = this.phase === 'combat' ? WAVES[this.wave - 1] : null;
    if (wave) this.updateSpawning(dt);
    for (const enemy of this.enemies) {
      enemy.slowRemaining = Math.max(0, (enemy.slowRemaining ?? 0) - dt);
      enemy.healTimer = Math.max(0, (enemy.healTimer ?? 0) - dt);
    }
    for (const tower of this.towers) {
      if (tower.work) continue;
      tower.cooldown -= dt; tower.recoil = Math.max(0, tower.recoil - dt * 5);
      const info = stats(tower), position = { x: tower.x, y: tower.y };
      let target: Enemy | undefined, priority = Infinity;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || distance(enemy, position) > info.range) continue;
        const score = distance(enemy, BASE) + (tower.kind === 'sniper' ? (enemy.kind === 'armored' ? -1e6 : 0) - enemy.maxHp * 100 : 0);
        if (score < priority) { priority = score; target = enemy; }
      }
      if (!target) continue;
      tower.angle = Math.atan2(target.y - position.y, target.x - position.x);
      if (tower.cooldown <= 0) {
        tower.cooldown = info.cooldown; tower.recoil = 1;
        if (tower.kind === 'sniper') {
          this.hurt(target, info.damage, tower.id, true); this.tracer(tower, target, 'beam', info.color);
        } else if (tower.kind === 'tesla') this.chainAttack(tower, target, info.damage);
        else this.projectiles.push({ id: this.sequence++, kind: tower.kind, ...position, targetId: target.id, tx: target.x, ty: target.y, damage: info.damage, splash: info.splash, towerId: tower.id });
        if (this.events.length < 30) this.events.push({ type: 'shoot' });
      }
    }
    this.projectiles = this.projectiles.filter(projectile => {
      const target = this.enemies.find(enemy => enemy.id === projectile.targetId && enemy.hp > 0);
      if (target) { projectile.tx = target.x; projectile.ty = target.y; }
      else if (!projectile.splash) return false;
      const dx = projectile.tx - projectile.x, dy = projectile.ty - projectile.y;
      const distance = Math.hypot(dx, dy), step = (projectile.kind === 'rapid' ? 650 : projectile.kind === 'frost' ? 450 : 310) * dt;
      if (distance <= step) {
        if (projectile.splash) {
          for (const enemy of this.enemies) if (enemy.hp > 0 && Math.hypot(enemy.x - projectile.tx, enemy.y - projectile.ty) <= projectile.splash) {
            this.hurt(enemy, projectile.damage, projectile.towerId);
            if (projectile.kind === 'frost' && enemy.hp > 0) enemy.slowRemaining = FROST.duration;
          }
          this.effect({ x: projectile.tx, y: projectile.ty }, projectile.kind === 'frost' ? 'frost' : 'blast', projectile.splash, 0.42);
          if (this.events.length < 30) this.events.push({ type: 'explosion' });
        } else if (target) { this.hurt(target, projectile.damage, projectile.towerId); this.effect(target, 'hit', 12, 0.15); }
        return false;
      }
      projectile.x += dx / distance * step; projectile.y += dy / distance * step; return true;
    });
    this.enemies = this.enemies.filter(enemy => enemy.hp > 0);
    for (const enemy of this.enemies) {
      enemy.hit = Math.max(0, enemy.hit - dt); enemy.attackTimer -= dt; enemy.attacking = false;
      const info = ENEMIES[enemy.kind];
      if (enemy.kind === 'medic') this.healAlly(enemy);
      if (enemy.kind === 'ranged' && this.rangedAttack(enemy)) {
        if (this.baseHp <= 0) return;
        continue;
      }
      if (enemy.revision !== this.revision) this.plan(enemy);
      const target = this.navigator.obstacles.find(obstacle => obstacle.id === enemy.targetId);
      if (!target) continue;
      if (distance(enemy, target) <= target.radius + info.radius + 1) {
        enemy.attacking = true;
        enemy.angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = 1; this.effect(target, 'damage', 25, 0.25);
          this.damageBuilding(target.id, info.damage * (this.enraged(enemy) ? 1.5 : 1));
          if (this.baseHp <= 0) return;
        }
        continue;
      }
      this.move(enemy, dt);
    }
    this.advanceNavigation();
    if (wave && this.phase === 'combat' && this.spawned === wave.units.length && this.enemies.length === 0) {
      this.projectiles = [];
      if (this.wave === WAVES.length) this.end('victory');
      else { this.gold += wave.bonus; this.phase = 'planning'; this.preparationRemaining = INTERMISSION; this.events.push({ type: 'wave' }); this.notify(`第 ${this.wave} 波完成`); }
    }
  }
  private enraged(enemy: Enemy) { return enemy.kind === 'berserker' && enemy.hp <= enemy.maxHp / 2; }
  private tracer(from: Point, to: Point, kind: 'beam' | 'arc', color: number) {
    this.effects.push({ x: from.x, y: from.y, tx: to.x, ty: to.y, kind, color, size: 0, duration: 0.2, life: 0.2 });
  }
  private chainAttack(tower: Tower, target: Enemy, damage: number) {
    const hit = new Set<number>(); let from: Point = tower, current: Enemy | undefined = target;
    for (let jump = 0; jump < tower.level + 2 && current; jump++) {
      hit.add(current.id); this.tracer(from, current, 'arc', TOWERS.tesla.color);
      this.hurt(current, Math.round(damage * CHAIN.falloff ** jump), tower.id);
      from = current;
      current = this.enemies.filter(enemy => enemy.hp > 0 && !hit.has(enemy.id) && distance(enemy, from) <= CHAIN.range)
        .sort((a, b) => distance(a, from) - distance(b, from) || a.id - b.id)[0];
    }
  }
  private healAlly(medic: Enemy) {
    if ((medic.healTimer ?? 0) > 0) return;
    const info = ENEMIES.medic;
    const target = this.enemies.filter(enemy => enemy !== medic && enemy.kind !== 'medic' && enemy.hp > 0 && enemy.hp < enemy.maxHp && distance(enemy, medic) <= info.healRange)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
    if (!target) return;
    target.hp = Math.min(target.maxHp, target.hp + info.heal); medic.healTimer = info.healCooldown;
    this.tracer(medic, target, 'beam', info.color); this.effect(target, 'heal', 24, 0.4);
  }
  private damageBuilding(id: string, damage: number) {
    if (id === 'base') {
      this.baseHp = Math.max(0, this.baseHp - damage);
      if (this.baseHp <= 0) this.end('defeat');
      return;
    }
    const tower = this.towers.find(item => `tower-${item.id}` === id);
    if (!tower) return;
    if (tower.work) tower.work.damageTaken += damage;
    tower.hp = Math.max(0, tower.hp - damage);
    if (tower.hp === 0) {
      this.towers = this.towers.filter(item => item !== tower); this.rebuildPaths();
      this.effect(tower, 'blast', 30, 0.5); this.notify('炮塔被摧毁');
    }
  }
  private rangedAttack(enemy: Enemy): boolean {
    const info = ENEMIES.ranged;
    let target: Tower | undefined, nearest = Infinity;
    // Re-evaluate every tick, even during cooldown: newly built towers take
    // priority over the base, and sold/destroyed targets cannot retain a lock.
    for (const tower of this.towers) {
      const separation = distance(enemy, tower);
      if (tower.hp > 0 && separation <= info.range && separation < nearest) { target = tower; nearest = separation; }
    }
    const position = target ?? (distance(enemy, BASE) <= info.range ? BASE : null);
    if (!position) return false;
    enemy.attacking = true;
    enemy.angle = Math.atan2(position.y - enemy.y, position.x - enemy.x);
    if (enemy.attackTimer <= 0) {
      enemy.attackTimer = info.cooldown;
      // Instant ranged hit with a short tracer, like the towers' unobstructed fire.
      this.effects.push({ x: enemy.x, y: enemy.y, tx: position.x, ty: position.y, kind: 'beam', size: 0, duration: 0.18, life: 0.18 });
      this.effect(position, 'damage', 20, 0.25);
      this.damageBuilding(target ? `tower-${target.id}` : 'base', info.damage);
      if (this.events.length < 30) this.events.push({ type: 'shoot' });
    }
    return true;
  }
  private plan(enemy: Enemy) {
    if (this.pendingPlans.has(enemy.id)) return;
    const radius = ENEMIES[enemy.kind].radius;
    const direct = this.navigator.directRoute(enemy, radius);
    if (direct) { enemy.path = direct; enemy.targetId = 'base'; enemy.revision = this.revision; return; }
    // Keep a safe previous base route while waiting. Pending work never means
    // the base is unreachable, and must not trigger attacks on a nearby tower.
    if (enemy.targetId !== 'base') enemy.path = [];
    enemy.targetId = 'base';
    this.pendingPlans.set(enemy.id, { revision: this.revision, search: this.searchPlan({ x: enemy.x, y: enemy.y }, radius) });
  }
  private *searchPlan(start: Point, radius: number): Generator<void, RoutePlan | null> {
    const route = yield* this.navigator.search(start, radius);
    if (route) return { path: route, targetId: 'base' };
    // Only a completed, unsuccessful search may consider breaching towers.
    let best = Infinity, result: RoutePlan | null = null;
    for (const tower of this.towers) {
      const id = `tower-${tower.id}`, path = yield* this.navigator.search(start, radius, id);
      if (!path) continue;
      let length = 0, previous: Point = start;
      for (const point of path) { length += distance(previous, point); previous = point; }
      const score = length + distance(tower, BASE) * 0.25;
      if (score < best) { best = score; result = { path, targetId: id }; }
    }
    return result;
  }
  private advanceNavigation() {
    if (!this.pendingPlans.size || this.navigationMs <= 0 || this.navigationSlices <= 0) return;
    const started = performance.now();
    while (this.pendingPlans.size && this.navigationSlices-- > 0 && performance.now() - started < this.navigationMs) {
      const [id, job] = this.pendingPlans.entries().next().value!;
      this.pendingPlans.delete(id);
      const enemy = this.enemies.find(enemy => enemy.id === id && enemy.hp > 0);
      if (!enemy || job.revision !== this.revision) continue;
      const step = job.search.next();
      if (!step.done) { this.pendingPlans.set(id, job); continue; } // Round-robin, no starvation by body size.
      const plan = step.value;
      if (plan && !clearSegment(enemy, plan.path[0], ENEMIES[enemy.kind].radius, this.navigator.obstacles)) {
        // Crowd avoidance can move the start during a search. Replan from its
        // actual position instead of applying an obsolete first segment.
        enemy.revision = -1; continue;
      }
      enemy.revision = this.revision;
      enemy.path = plan?.path ?? []; enemy.targetId = plan?.targetId ?? 'base';
    }
    this.navigationMs -= performance.now() - started;
  }
  private move(enemy: Enemy, dt: number) {
    const info = ENEMIES[enemy.kind];
    // Local avoidance can displace an enemy off its route; only skip to a later
    // waypoint when its full body has line of sight, including the current leg.
    if (enemy.path.length && !clearSegment(enemy, enemy.path[0], info.radius, this.navigator.obstacles)) this.plan(enemy);
    for (let i = enemy.path.length - 1; i > 0; i--) {
      if (clearSegment(enemy, enemy.path[i], info.radius, this.navigator.obstacles)) { enemy.path.splice(0, i); break; }
    }
    while (enemy.path.length && distance(enemy, enemy.path[0]) < 0.1) enemy.path.shift();
    const waypoint = enemy.path[0];
    if (!waypoint) return;
    const length = distance(enemy, waypoint), step = Math.min(length, info.speed * (this.enraged(enemy) ? 1.5 : 1) * ((enemy.slowRemaining ?? 0) > 0 ? FROST.multiplier : 1) * dt);
    const heading = Math.atan2(waypoint.y - enemy.y, waypoint.x - enemy.x);
    const blockers = [...this.navigator.obstacles, ...this.enemies.filter(other => other !== enemy).map(other => ({ x: other.x, y: other.y, radius: ENEMIES[other.kind].radius }))];
    let best: Point = enemy, score = -Infinity;
    // Ordered preference gives neighbours a consistent passing side. Sweeps
    // include already-moved units, so neither crossing nor pushing can overlap.
    for (const turn of [0, 0.55, -0.55, 1.05, -1.05, Math.PI / 2, -Math.PI / 2]) {
      const angle = heading + turn;
      const point = sweepMove(enemy, { x: Math.cos(angle) * step, y: Math.sin(angle) * step }, info.radius, blockers);
      const moved = distance(enemy, point);
      const progress = length - distance(point, waypoint) + moved * 0.08;
      if (progress > score) { best = point; score = progress; }
      if (turn === 0 && moved >= step * 0.99) break;
    }
    if (distance(enemy, best) > 0.0001) enemy.angle = Math.atan2(best.y - enemy.y, best.x - enemy.x);
    enemy.x = best.x; enemy.y = best.y;
  }
  private end(phase: 'victory' | 'defeat') {
    this.pendingPlans.clear();
    this.phase = phase; this.paused = false; this.events.push({ type: 'end' });
    this.notify(phase === 'victory' ? '防守成功' : '基地失守');
  }
  get remaining() { return this.phase === 'combat' ? WAVES[this.wave - 1].units.length - this.spawned + this.enemies.length : 0; }
  get progress() { return this.phase === 'combat' ? 1 - this.remaining / WAVES[this.wave - 1].units.length : this.wave > 0 ? 1 : 0; }
}
