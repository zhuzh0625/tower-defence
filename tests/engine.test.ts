import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, stats, sellValue, type Enemy } from '../src/engine.ts';
import { BASE, COLS, CELL, WAVES, TOWERS, center, key } from '../src/data.ts';
import { distanceField, nextCell } from '../src/pathfinding.ts';

function run(game: GameEngine, seconds: number) { for (let i = 0; i < Math.round(seconds * 60); i++) game.update(1 / 60); }
function completeWave(game: GameEngine) {
  assert.equal(game.startWave(), true);
  for (let i = 0; i < 60 * 180 && game.phase === 'combat'; i++) game.update(1 / 60);
  assert.notEqual(game.phase, 'combat', 'wave must terminate without stuck enemies');
}

test('placement protects base, terrain, radius, occupied cells and budget', () => {
  const game = new GameEngine();
  for (const [col, row] of [[BASE.col, BASE.row], [6, 4], [0, 0], [2, 8]]) assert.equal(game.build(col, row, 'rapid'), null);
  assert.equal(game.gold, 240);
  assert.ok(game.build(10, 8, 'rapid'));
  assert.equal(game.build(10, 8, 'rapid'), null);
  assert.ok(game.build(12, 8, 'cannon'));
  assert.equal(game.gold, 65);
  assert.equal(game.build(15, 10, 'cannon'), null);
  assert.equal(game.gold, 65);
});

test('normal route detours around a tower; sealed base requires breach routing', () => {
  const single = new Set([key(12, 9)]), field = distanceField(single);
  assert.equal(field[key(12, 9)], Infinity);
  assert.ok(Number.isFinite(field[key(0, 9)]));
  assert.notEqual(nextCell(key(11, 9), field, single, false), key(12, 9));
  const sealed = new Set([key(12, 9), key(14, 9), key(13, 8), key(13, 10)]);
  assert.equal(distanceField(sealed)[key(0, 9)], Infinity);
  const breach = distanceField(sealed, true);
  assert.ok(Number.isFinite(breach[key(0, 9)]));
  assert.equal(nextCell(key(11, 9), breach, sealed, true), key(12, 9));
});

test('enemies break a sealed defense and reach the base without becoming stuck', () => {
  const game = new GameEngine(); game.gold = 1000;
  for (const [col, row] of [[12, 9], [14, 9], [13, 8], [13, 10]]) {
    const tower = game.build(col, row, 'rapid')!; tower.cooldown = 10000;
  }
  game.startWave(); run(game, 55);
  assert.ok(game.towers.length < 4, 'a blocking tower must be destroyed');
  assert.ok(game.baseHp < 400, 'enemies continue through the new gap');
});

test('a reachable detour does not damage the blocking tower', () => {
  const game = new GameEngine();
  const tower = game.build(12, 9, 'rapid')!; tower.cooldown = 10000;
  game.startWave(); run(game, 30);
  assert.equal(tower.hp, TOWERS.rapid.hp);
  assert.ok(game.baseHp < 400);
});

test('upgrade caps at level 3, repairs damage, and damaged sales do not mint gold', () => {
  const game = new GameEngine(); game.gold = 1000;
  const tower = game.build(10, 8, 'rapid')!; tower.hp = 20;
  assert.ok(game.upgrade(tower.id)); assert.equal(tower.hp, stats(tower).hp);
  assert.ok(game.upgrade(tower.id)); assert.equal(game.upgrade(tower.id), false);
  const full = sellValue(tower); tower.hp /= 2;
  assert.ok(sellValue(tower) <= full / 2);
  assert.ok(game.sell(tower.id)); assert.ok(game.gold < 1000); assert.equal(game.towers.length, 0);
});

test('pause freezes the simulation, fixed stepping is independent of frame rate', () => {
  const a = new GameEngine(), b = new GameEngine(); a.startWave(); b.startWave();
  run(a, 4); for (let i = 0; i < 120; i++) b.update(1 / 30);
  assert.equal(a.spawned, b.spawned);
  assert.ok(Math.abs(a.enemies[0].x - b.enemies[0].x) < 0.001);
  a.paused = true;
  const before = JSON.stringify({ enemies: a.enemies, gold: a.gold, elapsed: a.elapsed }); run(a, 3);
  assert.equal(JSON.stringify({ enemies: a.enemies, gold: a.gold, elapsed: a.elapsed }), before);
  a.paused = false; a.speed = 2; const elapsed = a.elapsed; run(a, 2);
  assert.ok(Math.abs(a.elapsed - elapsed - 4) < 0.001);
});

test('cannon damages multiple targets in its blast and awards each kill once', () => {
  const game = new GameEngine(); const tower = game.build(12, 8, 'cannon')!;
  game.startWave();
  const position = center(14, 8);
  const makeEnemy = (id: number, x: number): Enemy => ({ id, kind: 'scout', x, y: position.y, cell: key(14, 8), targetCell: -1, hp: 40, maxHp: 40, attackTimer: 999, angle: 0, hit: 0, attacking: false });
  game.enemies.push(makeEnemy(1000, position.x), makeEnemy(1001, position.x + 20));
  const before = game.gold; run(game, 0.5);
  assert.equal(game.kills, 2); assert.equal(game.gold, before + 18); assert.equal(tower.kills, 2);
  run(game, 0.1); assert.equal(game.gold, before + 18);
});

test('enemy current and destination cells cannot be built over', () => {
  const game = new GameEngine(); game.startWave(); run(game, 8);
  const enemy = game.enemies[0];
  assert.ok(game.canBuild(Math.floor(enemy.x / CELL), Math.floor(enemy.y / CELL), 'rapid'));
  if (enemy.targetCell >= 0) assert.ok(game.canBuild(enemy.targetCell % COLS, Math.floor(enemy.targetCell / COLS), 'rapid'));
});

test('unguarded base loses; restart resets economy, entities, pause and progression', () => {
  const game = new GameEngine(); game.startWave(); run(game, 90);
  assert.equal(game.phase, 'defeat'); assert.equal(game.baseHp, 0);
  assert.equal(game.startWave(), false); assert.equal(game.build(12, 8, 'rapid'), null);
  game.reset(); assert.equal(game.phase, 'planning'); assert.equal(game.gold, 240);
  assert.equal(game.wave, 0); assert.equal(game.enemies.length, 0); assert.equal(game.baseHp, 400);
});

test('all five waves can be won using only starting money, kill rewards and wave bonuses', () => {
  const game = new GameEngine();
  // This is an ordinary player's reproducible plan, with no injected gold or damage.
  assert.ok(game.build(10, 8, 'rapid')); assert.ok(game.build(10, 10, 'rapid')); assert.ok(game.build(12, 9, 'cannon'));
  const results: object[] = [];
  for (let wave = 0; wave < WAVES.length; wave++) {
    if (wave === 1) { assert.ok(game.build(14, 7, 'rapid')); assert.ok(game.build(15, 9, 'rapid')); }
    if (wave === 2) { assert.ok(game.build(13, 11, 'cannon')); assert.ok(game.build(11, 11, 'rapid')); }
    if (wave === 3) { assert.ok(game.build(14, 8, 'cannon')); assert.ok(game.build(15, 11, 'rapid')); }
    if (wave === 4) { for (const tower of game.towers.filter(t => t.kind === 'cannon')) assert.ok(game.upgrade(tower.id)); }
    completeWave(game); results.push({ wave: game.wave, base: game.baseHp, gold: game.gold, kills: game.kills, towers: game.towers.length });
    assert.notEqual(game.phase, 'defeat', JSON.stringify(results));
  }
  assert.equal(game.phase, 'victory'); assert.equal(game.kills, WAVES.reduce((count, wave) => count + wave.units.length, 0));
  assert.equal(game.startWave(), false);
  console.log('Campaign verification:', JSON.stringify(results));
});
