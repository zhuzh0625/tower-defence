import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, stats } from '../src/engine.ts';
import { BASE, ENEMIES, TERRAIN, WAVES } from '../src/data.ts';
import { distance } from '../src/pathfinding.ts';
const run = (g: GameEngine, seconds: number) => { for (let i = 0; i < seconds * 60; i++) g.update(1 / 60); };

test('test controls cannot affect normal mode and reset clears every override', () => {
  const g = new GameEngine();
  assert.equal(g.setTestOption('freeBuild', true), false);
  assert.equal(g.spawnTestEnemies('armored', 3, 'west'), 0);
  g.testOptions.freeBuild = true; g.testOptions.instantBuild = true;
  g.gold = 0; assert.equal(g.build(420, 340, 'rapid'), null);
  g.reset('test'); g.setTestOption('freeBuild', true); g.setTestOption('instantBuild', true);
  assert.ok(g.build(420, 340, 'rapid'));
  g.reset(); assert.equal(g.mode, 'normal'); assert.equal(g.freeBuilding, false); assert.equal(g.instantBuilding, false);
  const tower = g.build(420, 340, 'rapid')!;
  assert.equal(g.gold, 175); assert.equal(tower.work?.remaining, 5);
  assert.equal(g.wave, 0); assert.equal(g.preparationRemaining, 30);
});
test('free and instant build cover towers and base but preserve collision and unlock requirements', () => {
  const g = new GameEngine(); g.reset('test'); g.gold = 0;
  g.setTestOption('freeBuild', true); g.setTestOption('instantBuild', true);
  assert.equal(g.build(420, 340, 'sniper'), null);
  const tower = g.build(420, 340, 'rapid')!;
  assert.ok(tower); assert.equal(tower.work, null); assert.equal(g.gold, 0);
  assert.equal(g.build(430, 350, 'rapid'), null);
  assert.equal(g.build(BASE.x, BASE.y, 'rapid'), null);
  assert.ok(g.upgrade(tower.id)); assert.equal(tower.level, 2); assert.equal(tower.work, null);
  assert.ok(g.upgradeBase()); assert.equal(g.baseLevel, 2); assert.equal(g.baseWork, null);
  assert.ok(g.build(640, 280, 'sniper')); assert.equal(g.gold, 0);
  g.setTestOption('freeBuild', false); assert.equal(g.upgradeBase(), false);
  g.gold = 300; g.setTestOption('instantBuild', false);
  assert.ok(g.upgradeBase()); assert.equal(g.gold, 100); assert.equal(g.baseWork?.remaining, 15);
});
test('enabling instant mode completes pending construction without erasing damage received during work', () => {
  const g = new GameEngine(); g.reset('test'); g.gold = 1000;
  const tower = g.build(420, 340, 'rapid')!; run(g, 5);
  tower.hp -= 20; assert.ok(g.upgrade(tower.id));
  tower.work!.damageTaken = 30; tower.hp -= 30;
  assert.ok(g.upgradeBase());
  g.paused = true; g.setTestOption('instantBuild', true);
  assert.equal(g.paused, true); assert.equal(tower.level, 2);
  assert.equal(tower.hp, stats(tower).hp - 30); assert.equal(g.baseLevel, 2);
});
test('manual enemies use safe spawn positions, unique ids and active combat during preparation', () => {
  const g = new GameEngine(); g.reset('test');
  for (const count of [0, 21, 1.5, NaN]) assert.equal(g.spawnTestEnemies('armored', count, 'west'), 0);
  assert.equal(g.spawnTestEnemies('armored', 4, 'west'), 4);
  assert.equal(g.spawned, 0); assert.equal(g.wave, 0);
  const solids = [BASE, ...TERRAIN];
  for (const e of g.enemies) {
    assert.ok(Math.abs(distance(e, BASE) - g.spawnRadius) < .001);
    assert.ok(solids.every(s => distance(e, s) >= ENEMIES[e.kind].radius + s.radius));
    assert.ok(g.enemies.every(other => e === other || distance(e, other) >= ENEMIES[e.kind].radius + ENEMIES[other.kind].radius));
  }
  assert.equal(new Set(g.enemies.map(e => e.id)).size, 4);
  const x = g.enemies[0].x; run(g, 1); assert.notEqual(g.enemies[0].x, x);
  assert.equal(g.phase, 'planning'); assert.equal(g.wave, 0);
  g.paused = true; assert.equal(g.spawnTestEnemies('medic', 1, 'east'), 1);
  const positions = g.enemies.map(e => [e.x, e.y]); run(g, 1); assert.deepEqual(g.enemies.map(e => [e.x, e.y]), positions);
  g.paused = false; g.enemies = []; run(g, 1); assert.equal(g.wave, 0);
  g.startWave(); g.spawned = WAVES[0].units.length;
  g.spawnTestEnemies('scout', 1, 'west'); run(g, .1); assert.equal(g.phase, 'combat');
  g.enemies = []; run(g, .1); assert.equal(g.phase, 'planning'); assert.equal(g.wave, 1);
  g.phase = 'victory'; assert.equal(g.spawnTestEnemies('scout', 1, 'west'), 0);
  assert.equal(g.setTestOption('instantBuild', true), false);
});
