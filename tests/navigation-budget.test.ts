import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, type Enemy } from '../src/engine.ts';
import { Navigator, clearSegment, distance, type Point } from '../src/pathfinding.ts';
import { BASE, ENEMIES, TOWERS, WAVES, TERRAIN } from '../src/data.ts';

function unit(id: number, x: number, y: number): Enemy {
  return { id, kind: 'scout', x, y, path: [], revision: -1, targetId: 'base', hp: 48, maxHp: 48, attackTimer: 0, angle: 0, hit: 0, attacking: false };
}
function combat(game: GameEngine, units: Enemy[]) {
  game.startWave(); game.spawned = WAVES[0].units.length; game.enemies = units;
  for (const tower of game.towers) { tower.work = null; tower.cooldown = 10000; }
}
function assertClear(start: Point, path: Point[], radius: number, nav: Navigator) {
  let from = start;
  for (const point of path) { assert.ok(clearSegment(from, point, radius, nav.obstacles)); from = point; }
}

test('static geometry survives dynamic edits while affected routes avoid the new obstacle', () => {
  const nav = new Navigator([BASE, ...TERRAIN]), start = { x: 132, y: 84.5 };
  // This route crosses the inner rock cluster and must prepare static geometry.
  const before = nav.route(start, 9)!; assert.ok(before); assertClear(start, before, 9, nav);
  const geometry = (nav as any).geometry.get(9); assert.ok(geometry);
  const cachedVisibility = geometry.visibility;
  const point = before[0];
  nav.setDynamicObstacles([{ id: 'new-tower', ...point, radius: 18 }]);
  const after = nav.route(start, 9)!; assert.ok(after); assertClear(start, after, 9, nav);
  assert.equal((nav as any).geometry.get(9), geometry);
  assert.equal(geometry.visibility, cachedVisibility);
  assert.notDeepEqual(after, before);
  nav.setDynamicObstacles([]);
  const removed = nav.route(start, 9)!; assert.ok(removed); assertClear(start, removed, 9, nav);
  assert.equal((nav as any).geometry.get(9), geometry);
});

test('incremental searches yield before expensive work and still find a body-safe detour', () => {
  const nav = new Navigator([BASE, { id: 'blocker', x: 420, y: 380, radius: 22.5 }]);
  const start = { x: 300.25, y: 380.5 }, search = nav.search(start, 20);
  assert.equal(search.next().done, false);
  assert.equal((nav as any).graphs.size, 0, 'no full graph construction in the request');
  let step = search.next(), slices = 1;
  while (!step.done && slices < 10000) { step = search.next(); slices++; }
  assert.ok(step.done && step.value); assert.ok(slices > 2 && slices < 10000);
  assertClear(start, step.value, 20, nav);
  assert.ok(step.value.some(p => Math.abs(p.y - 380) > 40));
});

test('building away from a valid route keeps the route and navigator without scheduling work', () => {
  const game = new GameEngine(), enemy = unit(1000, 720, 400);
  combat(game, [enemy]); game.update(1 / 60);
  const path = enemy.path, nav = (game as any).navigator;
  assert.equal(path.length, 1);
  assert.ok(game.build(420.125, 340.75, 'rapid'));
  assert.equal((game as any).navigator, nav);
  game.update(1 / 60);
  assert.equal(enemy.path, path);
  assert.equal((game as any).pendingPlans.size, 0);
});

test('a pending detour cannot penetrate or attack a tower and selling discards the obsolete search', () => {
  const game = new GameEngine(), enemy = unit(1000, 350, 380);
  combat(game, [enemy]); game.update(1 / 60);
  const nav = (game as any).navigator, originalSearch = nav.search.bind(nav);
  let staleSteps = 0;
  nav.search = function* (...args: any[]) {
    // Emulate a large search spanning many frames without relying on CPU speed.
    for (let i = 0; i < 100000; i++) { staleSteps++; yield; }
    return yield* originalSearch(...args);
  };
  const tower = game.build(420, 380, 'rapid')!; assert.ok(tower);
  for (let i = 0; i < 120; i++) {
    game.update(1 / 60);
    assert.ok(distance(enemy, tower) >= ENEMIES.scout.radius + TOWERS.rapid.radius);
    assert.equal(enemy.targetId, 'base'); assert.equal(tower.hp, TOWERS.rapid.hp);
  }
  assert.ok((game as any).pendingPlans.size > 0);
  assert.ok(game.sell(tower.id)); const steps = staleSteps;
  game.update(1 / 60);
  assert.equal(staleSteps, steps, 'the removed obstacle cannot finish an old job');
  assert.equal(enemy.path.length, 1); assert.equal((game as any).pendingPlans.size, 0);
});

test('the work budget is shared across enemies and 2x substeps, with pause/death/reset cancellation', () => {
  const game = new GameEngine(); game.build(420, 380, 'rapid');
  const units = [unit(1000, 280, 350), unit(1001, 280, 380), unit(1002, 280, 410)];
  combat(game, units);
  const turns = new Map<number, number>();
  (game as any).navigator.search = function* (start: Point) {
    while (true) { turns.set(start.y, (turns.get(start.y) ?? 0) + 1); yield; }
  };
  game.speed = 2; game.update(.1);
  const total = () => [...turns.values()].reduce((a, b) => a + b, 0);
  assert.ok(total() > 0 && total() <= 128, '12 physics substeps share one navigation slice allowance');
  assert.equal(turns.size, 3, 'all pending bodies receive work');
  assert.ok(Math.max(...turns.values()) - Math.min(...turns.values()) <= 1);
  game.paused = true; const paused = total(); game.update(.1); assert.equal(total(), paused);
  game.paused = false; units[0].hp = 0; game.update(.1);
  assert.equal((game as any).pendingPlans.has(units[0].id), false);
  game.reset(); const reset = total(); game.update(.1);
  assert.equal((game as any).pendingPlans.size, 0); assert.equal(total(), reset);
});
