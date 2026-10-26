import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, stats, sellValue, type Enemy } from '../src/engine.ts';
import { BASE, BUILD_RADIUS, BUILDING_GAP, MAP_BOUNDS, SPAWN_WARNING, SPAWN_DISTANCE, WIDTH, HEIGHT, WAVES, TOWERS, TOWER_KINDS, ENEMIES, TERRAIN, type EnemyKind, type TowerKind } from '../src/data.ts';
import { Navigator, distance, clearSegment, sweepMove, type Point } from '../src/pathfinding.ts';

function enemy(id: number, x: number, y: number, kind: EnemyKind = 'scout'): Enemy {
  return { id, kind, x, y, path: [], revision: -1, targetId: 'base', hp: ENEMIES[kind].hp, maxHp: ENEMIES[kind].hp, attackTimer: 0, angle: 0, hit: 0, attacking: false };
}
function obstacles(game: GameEngine) {
  return [BASE, ...TERRAIN, ...game.towers.map(tower => ({ ...tower, radius: TOWERS[tower.kind].radius }))];
}
function assertBodies(game: GameEngine) {
  const solids = obstacles(game);
  for (const unit of game.enemies) {
    const radius = ENEMIES[unit.kind].radius;
    assert.ok(unit.x >= MAP_BOUNDS.left + radius - 1e-6 && unit.x <= MAP_BOUNDS.right - radius + 1e-6 && unit.y >= MAP_BOUNDS.top + radius - 1e-6 && unit.y <= MAP_BOUNDS.bottom - radius + 1e-6, 'body stays within map');
    for (const solid of solids) assert.ok(distance(unit, solid) >= radius + solid.radius - 1e-5, 'unit cannot enter solid footprint: ' + JSON.stringify({ unit, solid }));
    for (const other of game.enemies) if (other.id > unit.id) assert.ok(distance(unit, other) >= radius + ENEMIES[other.kind].radius - 1e-5, 'units cannot overlap');
  }
}
function run(game: GameEngine, seconds: number, collisions = false) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    const before = game.enemies.map(unit => ({ id: unit.id, x: unit.x, y: unit.y }));
    game.update(1 / 60);
    if (collisions) {
      assertBodies(game);
      for (const unit of game.enemies) {
        const start = before.find(p => p.id === unit.id);
        if (start) assert.ok(clearSegment(start, unit, ENEMIES[unit.kind].radius, obstacles(game)), 'whole motion clears solids');
      }
    }
  }
}
function isolated(game: GameEngine, units: Enemy[]) {
  // Existing combat fixtures start with completed defenses.
  for (const tower of game.towers) tower.work = null;
  game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = units;
}
test('ranged enemy prioritizes the nearest in-range tower over a closer base', () => {
  const game = new GameEngine();
  const far = game.build(430, 380, 'rapid')!, near = game.build(590, 260, 'rapid')!;
  assert.ok(far); assert.ok(near); far.cooldown = near.cooldown = 10000;
  const unit = enemy(1000, 540, 300, 'ranged'); isolated(game, [unit]);
  run(game, 1 / 60, true);
  assert.equal(near.hp, TOWERS.rapid.hp - ENEMIES.ranged.damage);
  assert.equal(far.hp, TOWERS.rapid.hp); assert.equal(game.baseHp, 400);
  assert.equal(unit.x, 540); assert.equal(unit.y, 300); assert.equal(unit.attacking, true);
  near.hp = ENEMIES.ranged.damage;
  run(game, ENEMIES.ranged.cooldown + 0.02, true);
  assert.equal(game.towers.includes(near), false);
  assert.equal(far.hp, TOWERS.rapid.hp); assert.equal(game.baseHp, 400);
  run(game, ENEMIES.ranged.cooldown + 0.02, true);
  assert.equal(far.hp, TOWERS.rapid.hp - ENEMIES.ranged.damage, 'farther tower still outranks the base');
  assert.equal(game.baseHp, 400);
});

test('ranged fire respects its boundary, cooldown and pause without melee contact', () => {
  const game = new GameEngine();
  const unit = enemy(1000, BASE.x - ENEMIES.ranged.range - 0.2, BASE.y, 'ranged');
  isolated(game, [unit]); run(game, 1 / 60, true);
  assert.equal(game.baseHp, 400, 'no fire beyond range'); assert.ok(unit.x > 399.8);
  run(game, 1 / 60, true); assert.equal(game.baseHp, 382);
  assert.ok(distance(unit, BASE) > BASE.radius + ENEMIES.ranged.radius + 80);
  const position = { x: unit.x, y: unit.y };
  run(game, 1, true); assert.equal(game.baseHp, 382); assert.equal(distance(unit, position), 0);
  game.paused = true; run(game, 3); assert.equal(game.baseHp, 382);
  game.paused = false; game.speed = 2; run(game, 0.32, true);
  assert.equal(game.baseHp, 364, 'second shot occurs after 1.6 simulated seconds');
});

test('new towers interrupt base targeting and selling them restores base targeting', () => {
  const game = new GameEngine(), unit = enemy(1000, 540, 300, 'ranged');
  isolated(game, [unit]); run(game, 1 / 60); assert.equal(game.baseHp, 382);
  const tower = game.build(430, 380, 'rapid'); assert.ok(tower); tower.cooldown = 10000;
  run(game, ENEMIES.ranged.cooldown + 0.02, true);
  assert.equal(tower.hp, TOWERS.rapid.hp - ENEMIES.ranged.damage); assert.equal(game.baseHp, 382);
  assert.ok(game.sell(tower.id)); run(game, ENEMIES.ranged.cooldown + 0.02, true);
  assert.equal(game.baseHp, 364); assert.equal(game.towers.length, 0);
});

test('ranged enemy ignores out-of-range towers and resumes walking after a sale', () => {
  const game = new GameEngine();
  const far = game.build(750, 380, 'rapid')!; assert.ok(far); far.cooldown = 10000;
  isolated(game, [enemy(1000, 430, 380, 'ranged')]); run(game, 1 / 60, true);
  assert.equal(far.hp, TOWERS.rapid.hp); assert.equal(game.baseHp, 382);
  game.reset();
  const tower = game.build(400, 300, 'rapid')!; tower.cooldown = 10000;
  const unit = enemy(1000, 300, 300, 'ranged'); isolated(game, [unit]); run(game, 1 / 60, true);
  assert.equal(unit.attacking, true); assert.ok(game.sell(tower.id));
  const before = { x: unit.x, y: unit.y }; run(game, 1, true);
  assert.ok(distance(unit, before) > 20); assert.equal(game.baseHp, 400);
});

test('ranged destruction ends the battle and reset clears shot effects', () => {
  const game = new GameEngine(); game.baseHp = ENEMIES.ranged.damage;
  isolated(game, [enemy(1000, 430, 380, 'ranged')]); run(game, 1 / 60);
  assert.equal(game.phase, 'defeat'); assert.equal(game.baseHp, 0);
  assert.ok(game.effects.some(effect => effect.kind === 'beam'));
  game.reset(); assert.equal(game.effects.length, 0); assert.equal(game.enemies.length, 0);
});

test('ranged enemies enter from wave three with the eight-wave roster preserved', () => {
  assert.ok(WAVES.slice(0, 2).every(wave => !wave.units.includes('ranged')));
  assert.ok(WAVES.slice(2).every(wave => wave.units.includes('ranged')));
  assert.deepEqual(WAVES.map(wave => wave.units.length), [10, 14, 18, 24, 29, 28, 32, 36]);
});

test('fractional placement preserves exact coordinates and tests the complete footprint', () => {
  const game = new GameEngine();
  const invalid = [[BASE.x, BASE.y], [BASE.x - 45, BASE.y], [BASE.x + BUILD_RADIUS - 5, BASE.y], [NaN, 200], [0, 0], [655, 616]];
  for (const [x, y] of invalid) assert.equal(game.build(x, y, 'rapid'), null);
  assert.equal(game.gold, 240);
  const first = game.build(419.25, 338.75, 'rapid'); assert.ok(first);
  assert.equal(first.x, 419.25); assert.equal(first.y, 338.75);
  assert.equal(game.towerAt(420.5, 340)?.id, first.id);
  assert.equal(game.towerAt(first.x + 20, first.y), undefined);
  assert.equal(game.build(first.x + 39, first.y, 'cannon'), null, 'larger cannon needs more clearance');
  assert.ok(game.build(first.x - 89.5, first.y, 'cannon'));
  assert.equal(game.gold, 65);
  assert.equal(game.build(620, 420, 'cannon'), null);
});

test('body-aware navigation detours continuously and preserves narrow passages', () => {
  const target = { id: 'base', x: 700, y: 310, radius: 31 };
  // Extend both ends to the map edges so the 20-unit opening is the only route.
  const upperWall = Array.from({ length: Math.ceil((190 - MAP_BOUNDS.top) / 100) + 1 }, (_, i) => 190 - i * 100);
  const lowerWall = Array.from({ length: Math.ceil((MAP_BOUNDS.bottom - 370) / 100) + 1 }, (_, i) => 370 + i * 100);
  const rocks = [...upperWall, 250, ...lowerWall].map((y, i) => ({ id: 'rock-' + i, x: 520, y, radius: 50 }));
  const navigator = new Navigator([target, ...rocks]);
  const start = { x: 360.5, y: 270.25 };
  const route = navigator.route(start, 7); assert.ok(route);
  let previous: Point = start;
  for (const point of route) { assert.ok(clearSegment(previous, point, 7, navigator.obstacles)); previous = point; }
  assert.equal(navigator.route(start, 20), null, 'boss cannot fit through a 20-unit opening');
  const single = new Navigator([target, { id: 'tower', x: 500, y: 310, radius: 22.5 }]);
  const detour = single.route({ x: 300, y: 310 }, 13); assert.ok(detour);
  assert.ok(detour.some(point => Math.abs(point.y - 310) > 30));
});

test('swept circle stops fast motion and allows tangential escape at contact', () => {
  const obstacle = { x: 200, y: 200, radius: 22.5 };
  const start = { x: 50, y: 200 };
  const stopped = sweepMove(start, { x: 400, y: 0 }, 13, [obstacle]);
  assert.ok(stopped.x < 165 && stopped.x > 164);
  assert.ok(clearSegment(start, stopped, 13, [obstacle]));
  const tangent = sweepMove(stopped, { x: 0, y: 10 }, 13, [obstacle]);
  assert.ok(tangent.y > 209);
  assert.ok(sweepMove({ x: MAP_BOUNDS.left + 25, y: MAP_BOUNDS.top + 25 }, { x: -100, y: -100 }, 20, []).x >= MAP_BOUNDS.left + 20);
});

test('all building pairs reserve a largest-unit lane, including the base', () => {
  const kinds = TOWER_KINDS;
  assert.ok(BUILDING_GAP > Math.max(...Object.values(ENEMIES).map(info => info.radius * 2)));
  for (const kind of kinds) {
    const game = new GameEngine(); game.baseLevel = 3;
    const minimum = BASE.radius + TOWERS[kind].radius + BUILDING_GAP;
    assert.equal(game.build(BASE.x + minimum - 0.1, BASE.y, kind), null);
    assert.equal(game.gold, 240);
    const tower = game.build(BASE.x + minimum, BASE.y, kind); assert.ok(tower);
    const start = { x: BASE.x + BASE.radius + BUILDING_GAP / 2, y: BASE.y - 80 };
    const end = sweepMove(start, { x: 0, y: 160 }, ENEMIES.boss.radius, [BASE, { ...tower, radius: TOWERS[kind].radius }]);
    assert.ok(end.y > BASE.y + 79.99, 'largest unit clears the full base/tower corridor');
  }
  for (const a of kinds) for (const b of kinds) {
    const game = new GameEngine(); game.gold = 1000; game.baseLevel = 3;
    const first = game.build(400, 300, a); assert.ok(first);
    const minimum = TOWERS[a].radius + TOWERS[b].radius + BUILDING_GAP;
    const angle = -Math.PI * 0.73;
    const x = first.x + Math.cos(angle) * minimum, y = first.y + Math.sin(angle) * minimum;
    const gold = game.gold;
    assert.equal(game.build(x - Math.cos(angle) * 0.1, y - Math.sin(angle) * 0.1, b), null);
    assert.equal(game.gold, gold);
    assert.ok(game.build(x, y, b), 'exact diagonal boundary is allowed for ' + a + '/' + b);
  }
});

test('largest unit physically passes through the minimum gap for every tower pair', () => {
  for (const a of TOWER_KINDS) for (const b of TOWER_KINDS) {
    const game = new GameEngine(); game.gold = 1000; game.baseLevel = 3;
    const top = game.build(400, BASE.y - TOWERS[a].radius - BUILDING_GAP / 2, a);
    const bottom = game.build(400, BASE.y + TOWERS[b].radius + BUILDING_GAP / 2, b);
    assert.ok(top); assert.ok(bottom); top.cooldown = bottom.cooldown = 10000;
    const unit = enemy(1000, 300, BASE.y, 'boss'); isolated(game, [unit]);
    let crossed = false;
    for (let i = 0; i < 60 * 13; i++) {
      const x = unit.x; run(game, 1 / 60, true);
      if (x < 400 && unit.x >= 400) {
        crossed = true;
        assert.ok(Math.abs(unit.y - BASE.y) < BUILDING_GAP / 2 - ENEMIES.boss.radius);
      }
    }
    assert.ok(crossed, 'boss uses the gap, not a detour');
    assert.ok(game.baseHp < 400);
    assert.equal(top.hp, TOWERS[a].hp); assert.equal(bottom.hp, TOWERS[b].hp);
  }
});

test('a ring of legal buildings cannot trap the largest unit outside the base', () => {
  const game = new GameEngine(); game.gold = 2000;
  const radius = (TOWERS.cannon.radius * 2 + BUILDING_GAP) / (2 * Math.sin(Math.PI / 8));
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const tower = game.build(BASE.x + Math.cos(angle) * radius, BASE.y + Math.sin(angle) * radius, 'cannon');
    assert.ok(tower); tower.cooldown = 10000;
  }
  isolated(game, [enemy(1000, 300, 380, 'boss')]); run(game, 25, true);
  assert.ok(game.baseHp < 400);
  assert.ok(game.towers.every(tower => tower.hp === TOWERS.cannon.hp), 'no building needs to be breached');
});

test('selling a tower refreshes an active detour', () => {
  const game = new GameEngine(); const tower = game.build(420, 380, 'cannon')!; tower.cooldown = 10000;
  const unit = enemy(1000, 300, 380, 'boss'); isolated(game, [unit]); run(game, 1, true);
  assert.ok(unit.path.length > 1);
  assert.ok(game.sell(tower.id)); run(game, 1 / 60, true);
  assert.equal(unit.targetId, 'base'); assert.equal(unit.path.length, 1);
  run(game, 15, true); assert.ok(game.baseHp < 400);
});

test('a reachable detour never damages a tower and reaches the base surface', () => {
  const game = new GameEngine(); const tower = game.build(430, 380, 'cannon')!; tower.cooldown = 10000;
  const unit = enemy(1000, 340.7, 380.2); isolated(game, [unit]);
  run(game, 15, true);
  assert.equal(tower.hp, TOWERS.cannon.hp); assert.ok(game.baseHp < 400);
  assert.ok(distance(unit, BASE) >= BASE.radius + ENEMIES.scout.radius);
  assert.ok(distance(unit, BASE) < BASE.radius + ENEMIES.scout.radius + 1.1);
});

test('a tower built across an active route causes immediate rerouting without teleporting', () => {
  const game = new GameEngine(); const unit = enemy(1000, 300.25, 380.25);
  isolated(game, [unit]); run(game, 0.2);
  const before = { x: unit.x, y: unit.y };
  const tower = game.build(420.1, 380.2, 'rapid'); assert.ok(tower); tower.cooldown = 10000;
  run(game, 1 / 60, true);
  assert.ok(distance(unit, before) <= ENEMIES.scout.speed / 60 + 1e-5);
  run(game, 14, true); assert.ok(game.baseHp < 400);
  assert.equal(tower.hp, TOWERS.rapid.hp);
});

test('mixed-size crowds avoid each other and obstacles at 2x speed', () => {
  const game = new GameEngine(); const tower = game.build(425, 380, 'cannon')!; tower.cooldown = 10000;
  const units = Array.from({ length: 12 }, (_, i) => enemy(1000 + i, 270 - Math.floor(i / 4) * 55, 315 + i % 4 * 40, i % 3 === 0 ? 'heavy' : i % 3 === 1 ? 'runner' : 'scout'));
  isolated(game, units); game.speed = 2; run(game, 18, true);
  assert.ok(game.baseHp < 400, 'crowd makes progress');
  assert.equal(tower.hp, TOWERS.cannon.hp);
});

test('construction rejects a living unit footprint but allows vacant future route space', () => {
  const game = new GameEngine(); const unit = enemy(1000, 380.25, 330.75, 'heavy');
  isolated(game, [unit]); run(game, 1 / 60);
  const gold = game.gold;
  assert.equal(game.build(unit.x + 28, unit.y, 'rapid'), null);
  assert.equal(game.gold, gold);
  assert.ok(game.build(440.5, 330.5, 'rapid'));
});

test('upgrade caps at level 3, repairs damage, and damaged sales do not mint gold', () => {
  const game = new GameEngine(); game.gold = 1000;
  const tower = game.build(420, 340, 'rapid')!; run(game, 5); tower.hp = 20;
  assert.ok(game.upgrade(tower.id)); run(game, 10); assert.equal(tower.hp, stats(tower).hp);
  assert.ok(game.upgrade(tower.id)); run(game, 15); assert.equal(game.upgrade(tower.id), false);
  const full = sellValue(tower); tower.hp /= 2; assert.ok(sellValue(tower) <= full / 2);
  assert.ok(game.sell(tower.id)); assert.ok(game.gold < 1000); assert.equal(game.towers.length, 0);
});

test('pause freezes the simulation and fixed stepping is independent of frame rate', () => {
  const a = new GameEngine(), b = new GameEngine(); a.startWave(); b.startWave();
  run(a, 4); for (let i = 0; i < 120; i++) b.update(1 / 30);
  assert.equal(a.spawned, b.spawned); assert.ok(distance(a.enemies[0], b.enemies[0]) < 0.001);
  a.paused = true; const before = JSON.stringify({ enemies: a.enemies, gold: a.gold, elapsed: a.elapsed }); run(a, 3);
  assert.equal(JSON.stringify({ enemies: a.enemies, gold: a.gold, elapsed: a.elapsed }), before);
  a.paused = false; a.speed = 2; const elapsed = a.elapsed; run(a, 2);
  assert.ok(Math.abs(a.elapsed - elapsed - 4) < 0.001);
});

test('cannon damages multiple targets in its blast and awards each kill once', () => {
  const game = new GameEngine(); const tower = game.build(450, 300, 'cannon')!;
  const a = enemy(1000, 590, 320), b = enemy(1001, 612, 320); a.hp = b.hp = 40;
  isolated(game, [a, b]); const before = game.gold; run(game, 0.6);
  assert.equal(game.kills, 2); assert.equal(game.gold, before + 18 + WAVES[0].bonus); assert.equal(tower.kills, 2);
  const after = game.gold; run(game, 0.1); assert.equal(game.gold, after);
});

test('unguarded base loses; restart resets economy, bodies, paths and progression', () => {
  const game = new GameEngine(); game.startWave(); run(game, 90, true);
  assert.equal(game.phase, 'defeat'); assert.equal(game.baseHp, 0);
  assert.equal(game.startWave(), false); assert.equal(game.build(480, 320, 'rapid'), null);
  game.reset(); assert.equal(game.phase, 'planning'); assert.equal(game.gold, 240);
  assert.equal(game.wave, 0); assert.equal(game.enemies.length, 0); assert.equal(game.baseHp, 400);
  assert.ok(game.build(450.25, 300.5, 'rapid')); game.startWave(); run(game, 4, true);
});

test('all eight waves can be won with ordinary money and continuous collision checks', () => {
  const game = new GameEngine();
  assert.ok(game.build(350.25, 310.75, 'rapid')); assert.ok(game.build(350.5, 450.75, 'rapid')); assert.ok(game.build(430.5, 380.25, 'cannon'));
  const results: object[] = [];
  for (let wave = 0; wave < WAVES.length; wave++) {
    if (wave === 1) { assert.ok(game.build(540.5, 280.25, 'rapid')); assert.ok(game.build(640.75, 380.5, 'rapid')); }
    if (wave === 2) { assert.ok(game.build(540.25, 490.75, 'cannon')); assert.ok(game.build(450.5, 560.5, 'rapid')); }
    if (wave === 3) {
      assert.ok(game.upgradeBase()); run(game, 10, true);
      assert.ok(game.build(650.25, 490.5, 'cannon')); assert.ok(game.build(640.5, 280.25, 'rapid'));
    }
    if (wave === 4) {
      assert.ok(game.build(540, 590, 'sniper')); assert.ok(game.build(740, 380, 'frost'));
      for (const tower of game.towers.filter(t => t.kind === 'cannon').slice(1)) assert.ok(game.upgrade(tower.id));
    }
    if (wave === 5) {
      assert.ok(game.upgradeBase()); run(game, 15, true);
      assert.ok(game.build(450, 280, 'sniper')); assert.ok(game.build(640, 180, 'tesla'));
    }
    if (wave === 6) {
      assert.ok(game.build(540, 180, 'frost')); assert.ok(game.build(740, 500, 'tesla'));
      for (const tower of game.towers.filter(t => t.kind === 'sniper')) assert.ok(game.upgrade(tower.id));
    }
    if (wave === 7) for (const tower of game.towers.filter(t => t.kind === 'sniper' || t.kind === 'tesla')) assert.ok(game.upgrade(tower.id));
    for (let i = 0; i < 60 * 31 && game.phase === 'planning'; i++) run(game, 1 / 60, true);
    assert.equal(game.wave, wave + 1);
    assert.equal(game.phase, 'combat');
    for (let i = 0; i < 60 * 180 && game.phase === 'combat'; i++) run(game, 1 / 60, true);
    results.push({ wave: game.wave, base: game.baseHp, gold: game.gold, kills: game.kills });
    assert.notEqual(game.phase, 'combat', 'no stuck survivors: ' + JSON.stringify(game.enemies));
    assert.notEqual(game.phase, 'defeat', JSON.stringify(results));
  }
  assert.equal(game.phase, 'victory'); assert.equal(game.kills, WAVES.reduce((count, wave) => count + wave.units.length, 0));
  assert.equal(game.startWave(), false);
  console.log('Campaign verification:', JSON.stringify(results));
});


test('automatic preparation and intermission trigger exactly once and respect pause/speed', () => {
  const game = new GameEngine();
  const tower = game.build(420, 340, 'rapid')!;
  game.paused = true; run(game, 10);
  assert.equal(game.preparationRemaining, 30); assert.equal(tower.work!.remaining, 5);
  game.paused = false; game.speed = 2; run(game, 2.5);
  assert.equal(tower.work, null); assert.ok(Math.abs(game.preparationRemaining - 25) < 1e-7);
  game.speed = 1; run(game, 24.9); assert.equal(game.wave, 0);
  run(game, 0.1); assert.equal(game.wave, 1); assert.equal(game.phase, 'combat');
  game.spawned = WAVES[0].units.length; game.enemies = []; run(game, 1 / 60);
  assert.equal(game.phase, 'planning'); assert.equal(game.preparationRemaining, 20);
  const gold = game.gold; run(game, 19.9); assert.equal(game.wave, 1); assert.equal(game.gold, gold);
  run(game, 0.1); assert.equal(game.wave, 2); assert.equal(game.phase, 'combat');
  game.reset(); assert.equal(game.preparationRemaining, 30); assert.equal(game.towers.length, 0);
});

test('construction is vulnerable, silent until complete, and does not heal received damage', () => {
  const game = new GameEngine(); const tower = game.build(430, 380, 'rapid')!;
  game.startWave(); game.spawned = WAVES[0].units.length;
  const unit = enemy(1000, 330, 380, 'ranged'); unit.hp = unit.maxHp = 10000; game.enemies = [unit];
  run(game, 4.9, true);
  assert.equal(unit.hp, 10000); assert.equal(game.projectiles.length, 0);
  assert.ok(tower.hp < TOWERS.rapid.hp); const hp = tower.hp;
  run(game, 0.1); assert.equal(tower.work, null); assert.equal(tower.hp, hp);
  run(game, 0.5); assert.ok(unit.hp < 10000);
});

test('upgrading takes longer by level, stops fire and retains construction damage', () => {
  const game = new GameEngine(); game.gold = 1000;
  const tower = game.build(430, 380, 'rapid')!; run(game, 5); tower.hp = 190;
  assert.ok(game.upgrade(tower.id)); const paid = game.gold;
  assert.equal(game.upgrade(tower.id), false); assert.equal(game.gold, paid);
  assert.equal(tower.work!.duration, 10); assert.equal(tower.level, 1);
  game.startWave(); game.spawned = WAVES[0].units.length;
  const unit = enemy(1000, 330, 380, 'ranged'); unit.hp = unit.maxHp = 10000; game.enemies = [unit];
  run(game, 9.9); assert.equal(unit.hp, 10000); assert.equal(tower.level, 1);
  const damage = tower.work!.damageTaken; assert.ok(damage > 0);
  run(game, 0.1); assert.equal(tower.level, 2); assert.equal(tower.hp, stats(tower).hp - damage);
  assert.ok(game.upgrade(tower.id)); assert.equal(tower.work!.duration, 15);
  tower.hp = 1; run(game, 2); assert.equal(game.towers.length, 0);
  run(game, 16); assert.equal(game.towers.length, 0, 'destroyed work never resurrects');
});

test('unfinished builds can be destroyed and pending upgrades can be sold without minting gold', () => {
  const game = new GameEngine(); const tower = game.build(430, 380, 'rapid')!; tower.hp = 1;
  game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = [enemy(1000, 330, 380, 'ranged')];
  run(game, 1 / 60); assert.equal(game.towers.length, 0); const gold = game.gold;
  run(game, 6); assert.equal(game.towers.length, 0); assert.equal(game.gold, gold);
  game.reset(); const next = game.build(430, 380, 'rapid')!; run(game, 5); game.upgrade(next.id);
  assert.equal(sellValue(next), Math.floor((65 + 52) * .7));
  assert.ok(game.sell(next.id)); run(game, 12); assert.equal(game.towers.length, 0); assert.ok(game.gold < 240);
});


test('base upgrades unlock build radius only after paid construction, with pause and level cap', () => {
  const game = new GameEngine(); game.gold = 1000;
  assert.equal(game.canBuild(860, 380, 'rapid'), '超出建造范围');
  assert.ok(game.upgradeBase()); assert.equal(game.gold, 880);
  assert.equal(game.upgradeBase(), false); assert.equal(game.gold, 880);
  game.paused = true; run(game, 3); assert.equal(game.baseWork!.remaining, 10);
  game.paused = false; game.speed = 2; run(game, 4.9);
  assert.equal(game.baseLevel, 1); assert.equal(game.buildRadius, 284);
  run(game, .1); assert.equal(game.baseLevel, 2); assert.equal(game.buildRadius, 360);
  assert.equal(game.canBuild(860, 380, 'rapid'), null);
  assert.equal(game.canBuild(950, 380, 'rapid'), '超出建造范围');
  assert.ok(game.upgradeBase()); assert.equal(game.baseWork!.duration, 15);
  run(game, 7.5); assert.equal(game.baseLevel, 3); assert.equal(game.buildRadius, 440);
  assert.equal(game.canBuild(950, 380, 'rapid'), null); assert.equal(game.upgradeBase(), false);
  game.reset(); assert.equal(game.baseLevel, 1); assert.equal(game.baseWork, null); assert.equal(game.buildRadius, 284);
  game.gold = 0; assert.equal(game.upgradeBase(), false); assert.equal(game.message, '金币不足');
});

test('base remains vulnerable during upgrading and defeat stops completion', () => {
  const game = new GameEngine(); game.upgradeBase();
  isolated(game, [enemy(1000, 430, 380, 'ranged')]); run(game, 1 / 60);
  assert.equal(game.baseHp, 382); assert.ok(game.baseWork);
  game.baseHp = 1; run(game, 2); assert.equal(game.phase, 'defeat');
  const remaining = game.baseWork!.remaining; run(game, 20);
  assert.equal(game.baseLevel, 1); assert.equal(game.baseWork!.remaining, remaining);
  game.reset(); assert.equal(game.baseWork, null);
});


test('expanded terrain occupies every outer quadrant and stays within world bounds', () => {
  assert.ok(TERRAIN.length > 16);
  for (const rock of TERRAIN) {
    assert.ok(rock.x - rock.radius >= MAP_BOUNDS.left && rock.x + rock.radius <= MAP_BOUNDS.right);
    assert.ok(rock.y - rock.radius >= MAP_BOUNDS.top && rock.y + rock.radius <= MAP_BOUNDS.bottom);
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    assert.ok(TERRAIN.some(rock => (rock.x - BASE.x) * sx > 300 && (rock.y - BASE.y) * sy > 400));
  }
});

test('all enemy sizes and directions warn outside the build zone at each base level', () => {
  for (const level of [1, 2, 3]) for (const side of ['west', 'north', 'east', 'south'] as const) for (const kind of Object.keys(ENEMIES) as EnemyKind[]) {
    const game = new GameEngine(); game.baseLevel = level;
    const point = (game as any).spawnLocation(kind, side); assert.ok(point, `${level}/${side}/${kind}`);
    assert.ok(Math.abs(distance(point, BASE) - (game.buildRadius + SPAWN_DISTANCE)) < 1e-7);
    assert.ok(distance(point, BASE) - ENEMIES[kind].radius > game.buildRadius);
    assert.ok((game as any).spawnFree(point, kind));
    if (side === 'west') assert.ok(point.x < BASE.x);
    if (side === 'east') assert.ok(point.x > BASE.x);
    if (side === 'north') assert.ok(point.y < BASE.y);
    if (side === 'south') assert.ok(point.y > BASE.y);
  }
});

test('spawn warning precedes appearance, freezes when paused, and restarts outward after an upgrade', () => {
  const game = new GameEngine(); game.startWave();
  for (let i = 0; i < 60 && !game.pendingSpawn; i++) run(game, 1 / 60);
  assert.ok(game.pendingSpawn); assert.equal(game.enemies.length, 0);
  const first = { ...game.pendingSpawn }; game.paused = true; run(game, 2);
  assert.deepEqual(game.pendingSpawn, first);
  game.paused = false; run(game, SPAWN_WARNING - .05); assert.equal(game.enemies.length, 0);
  run(game, .05); assert.equal(game.enemies.length, 1); assert.equal(game.spawned, 1);
  assert.ok(game.effects.some(effect => effect.kind === 'spawn'));
  assertBodies(game);
  for (let i = 0; i < 60 && !game.pendingSpawn; i++) run(game, 1 / 60);
  assert.ok(game.pendingSpawn); const before = { ...game.enemies[0] };
  game.upgradeBase(); game.baseWork!.remaining = 1 / 60; run(game, 1 / 60);
  assert.equal(game.baseLevel, 2); assert.ok(game.pendingSpawn);
  assert.ok(Math.abs(distance(game.pendingSpawn, BASE) - game.spawnRadius) < 1e-7);
  assert.ok(game.pendingSpawn.remaining > .7, 'new position gets a full warning');
  assert.ok(distance(game.enemies[0], before) <= ENEMIES.scout.speed / 60 + .001, 'existing enemy does not teleport');
  game.reset(); assert.equal(game.pendingSpawn, null); assert.equal(game.effects.length, 0);
});


test('blocked spawn locations are avoided, including newly occupied warning positions', () => {
  const game = new GameEngine(); game.startWave();
  for (let i = 0; i < 60 && !game.pendingSpawn; i++) run(game, 1 / 60);
  const portal = game.pendingSpawn!; assert.ok(portal);
  game.enemies = [enemy(1000, portal.x, portal.y, 'boss')];
  (game as any).updateSpawning(SPAWN_WARNING);
  assert.equal(game.spawned, 0); assert.equal(game.enemies.length, 1);
  assert.equal(game.pendingSpawn, null);
  (game as any).updateSpawning(1 / 60);
  assert.ok(game.pendingSpawn); assert.ok(distance(game.pendingSpawn, portal) > 30);
  assert.equal(game.pendingSpawn.remaining, SPAWN_WARNING);
});
