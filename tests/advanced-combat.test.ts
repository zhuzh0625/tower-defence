import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, type Enemy } from '../src/engine.ts';
import { BASE, ENEMIES, TOWERS, TOWER_KINDS, WAVES, type EnemyKind, type TowerKind } from '../src/data.ts';

const run = (game: GameEngine, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60);
};
function enemy(id: number, x: number, y: number, kind: EnemyKind = 'scout'): Enemy {
  return { id, kind, x, y, hp: ENEMIES[kind].hp, maxHp: ENEMIES[kind].hp, path: [], revision: -1, targetId: 'base', attackTimer: 0, angle: 0, hit: 0, attacking: false };
}
function arena(kind: TowerKind, units: Enemy[], level = 1) {
  const game = new GameEngine(); game.baseLevel = 3;
  const tower = game.build(420, 340, kind)!;
  assert.ok(tower); tower.work = null; tower.level = level;
  game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = units;
  return { game, tower };
}

test('advanced towers unlock only after each paid base upgrade completes, and reset relocks them', () => {
  const game = new GameEngine(); game.gold = 1000;
  for (const kind of ['sniper', 'tesla'] as const) assert.equal(game.build(420, 340, kind), null);
  assert.equal(game.gold, 1000);
  assert.ok(game.upgradeBase()); run(game, 9.9);
  assert.equal(game.canBuild(420, 340, 'sniper'), '需要 2 级基地');
  run(game, .1); assert.equal(game.baseLevel, 2);
  assert.equal(game.canBuild(420, 340, 'sniper'), null);
  assert.equal(game.canBuild(420, 340, 'tesla'), '需要 3 级基地');
  assert.ok(game.upgradeBase()); run(game, 14.9);
  assert.equal(game.canBuild(420, 340, 'tesla'), '需要 3 级基地');
  run(game, .1); assert.equal(game.baseLevel, 3);
  for (const kind of TOWER_KINDS) assert.equal(game.canBuild(420, 340, kind), null);
  game.reset(); assert.equal(game.canBuild(420, 340, 'sniper'), '需要 2 级基地');
});

test('frost splash slows multiple bodies, respects armor, refreshes instead of stacking, and expires', () => {
  const units = [enemy(101, 470, 310), enemy(102, 500, 300), enemy(103, 500, 270, 'armored'), enemy(104, 620, 300)];
  const { game, tower } = arena('frost', units);
  run(game, .3);
  assert.equal(units[0].hp, 40); assert.equal(units[1].hp, 40); assert.equal(units[2].hp, 218);
  for (const unit of units.slice(0, 3)) assert.ok(unit.slowRemaining! > 1.8 && unit.slowRemaining! <= 2);
  assert.equal(units[3].slowRemaining, 0);
  const remaining = units[0].slowRemaining;
  game.paused = true; run(game, 3); assert.equal(units[0].slowRemaining, remaining);
  game.paused = false; run(game, 1);
  assert.ok(units[0].slowRemaining! > 1.5 && units[0].slowRemaining! <= 2);
  tower.cooldown = 100; run(game, 2.1);
  assert.equal(units[0].slowRemaining, 0);
});

test('sniper selects armor before a nearer boss and deals its full damage through armor', () => {
  const armor = enemy(101, 310, 340, 'armored'), boss = enemy(102, 480, 380, 'boss');
  const { game, tower } = arena('sniper', [armor, boss]);
  run(game, 1 / 60);
  assert.equal(armor.hp, 115); assert.equal(boss.hp, boss.maxHp);
  run(game, .5); assert.equal(armor.hp, 115, 'shot cooldown applies');
  game.enemies = [boss, enemy(103, 500, 450, 'heavy')]; tower.cooldown = 0;
  run(game, 1 / 60); assert.equal(boss.hp, boss.maxHp - 105);
});

test('armor reduces ordinary weapon damage and never rewards a surviving target', () => {
  const armor = enemy(101, 470, 340, 'armored');
  const { game, tower } = arena('rapid', [armor]);
  run(game, .15); tower.cooldown = 100;
  assert.equal(armor.hp, armor.maxHp - 7); assert.equal(game.kills, 0);
  assert.equal(game.gold, 240 - TOWERS.rapid.cost);
});

test('electric chain hits distinct nearby targets with falloff and scales from three to five', () => {
  for (const level of [1, 3]) {
    const units = [enemy(101, 500, 280, 'heavy'), enemy(102, 450, 240, 'armored'), enemy(103, 400, 210, 'heavy'), enemy(104, 350, 180, 'heavy'), enemy(105, 300, 150, 'heavy')];
    const far = enemy(106, 190, 150, 'heavy');
    const dead = enemy(107, 470, 260); dead.hp = 0;
    const { game } = arena('tesla', [...units, far, dead], level);
    run(game, 1 / 60);
    const damages = level === 1 ? [24, 11, 12, 0, 0] : [50, 29, 24, 17, 12];
    units.forEach((unit, index) => assert.equal(unit.maxHp - unit.hp, damages[index]));
    assert.equal(far.hp, far.maxHp); assert.equal(dead.hp, 0);
    assert.equal(game.effects.filter(effect => effect.kind === 'arc').length, level + 2);
  }
});

test('new towers remain silent during construction and upgrades and keep incoming damage', () => {
  for (const kind of ['frost', 'sniper', 'tesla'] as const) {
    const game = new GameEngine(); game.baseLevel = 3; game.gold = 1000;
    const tower = game.build(420, 340, kind)!;
    const attacker = enemy(101, 320, 340, 'ranged');
    attacker.hp = attacker.maxHp = 10000;
    game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = [attacker];
    run(game, 4.9); assert.equal(attacker.hp, attacker.maxHp); assert.ok(tower.hp < TOWERS[kind].hp);
    attacker.attackTimer = 100;
    const hp = tower.hp; run(game, .1); assert.equal(tower.work, null); assert.equal(tower.hp, hp);
    assert.ok(game.upgrade(tower.id)); game.projectiles = [];
    const targetHp = attacker.hp; run(game, 9.9); assert.equal(attacker.hp, targetHp);
    assert.ok(tower.work); run(game, .1); assert.equal(tower.level, 2);
  }
});

test('medics prioritize injured allies, exclude medics and dead bodies, cap healing and honor cooldown', () => {
  const game = new GameEngine();
  const medic = enemy(101, 300, 380, 'medic'); medic.hp = 10;
  const heavy = enemy(102, 340, 380, 'heavy'); heavy.hp = 40;
  const scout = enemy(103, 300, 430); scout.hp = 47;
  const otherMedic = enemy(104, 260, 380, 'medic'); otherMedic.hp = 5; otherMedic.healTimer = 100;
  const dead = enemy(105, 300, 340); dead.hp = 0;
  const distant = enemy(106, 300, 500); distant.hp = 1;
  game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = [medic, heavy, scout, otherMedic, dead, distant];
  run(game, 1 / 60);
  assert.equal(heavy.hp, 56); assert.equal(scout.hp, 47); assert.equal(distant.hp, 1);
  assert.equal(medic.hp, 10); assert.equal(otherMedic.hp, 5); assert.equal(dead.hp, 0);
  run(game, .1); assert.equal(heavy.hp, 56);
  const timer = medic.healTimer; game.paused = true; run(game, 3); assert.equal(medic.healTimer, timer);
  game.paused = false; game.enemies = [medic, scout]; medic.healTimer = 0;
  run(game, 1 / 60); assert.equal(scout.hp, 48);
});

test('half-health berserkers gain speed and melee damage while frost multiplies their movement', () => {
  for (const [hp, slow, multiplier] of [[80, 0, 1], [40, 0, 1.5], [40, 2, .825]]) {
    const game = new GameEngine(), unit = enemy(101, 350, 380, 'berserker');
    unit.hp = hp; unit.slowRemaining = slow;
    game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = [unit];
    run(game, 1 / 60);
    assert.ok(Math.abs(Math.hypot(unit.x - 350, unit.y - 380) - 52 * multiplier / 60) < 1e-5);
    unit.x = BASE.x - BASE.radius - ENEMIES.berserker.radius; unit.y = BASE.y; unit.attackTimer = 0;
    run(game, 1 / 60); assert.equal(game.baseHp, 400 - (hp <= 40 ? 24 : 16));
  }
});
