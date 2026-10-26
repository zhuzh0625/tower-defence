import { performance } from 'node:perf_hooks';
import { GameEngine, type Enemy } from '../src/engine.ts';
import { BASE, ENEMIES, TERRAIN, WAVES, type EnemyKind } from '../src/data.ts';

// Synthetic fixtures: funds are unlimited and towers do not fire. This measures
// simulation CPU time, not rendering/GPU performance or real-money balance.
const candidates: { x: number; y: number }[] = [];
for (let ring = 110; ring <= 410; ring += 95) {
  const count = Math.floor(2 * Math.PI * ring / 95);
  for (let i = 0; i < count; i++) {
    const angle = i * 2 * Math.PI / count;
    candidates.push({ x: BASE.x + Math.cos(angle) * ring, y: BASE.y + Math.sin(angle) * ring });
  }
}
const results = [];
for (const priorTowers of [12, 28]) {
  const game = new GameEngine(); game.gold = 100000; game.baseLevel = 3;
  for (const p of candidates) {
    if (game.towers.length === priorTowers) break;
    if (!game.canBuild(p.x, p.y, 'rapid')) game.build(p.x, p.y, 'rapid');
  }
  for (const tower of game.towers) { tower.work = null; tower.cooldown = 100000; }
  game.startWave(); game.spawned = WAVES[0].units.length;
  game.enemies = (Object.keys(ENEMIES) as EnemyKind[]).map((kind, i): Enemy => {
    let x = 0, y = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      const angle = i * Math.PI / 4 + attempt * .01;
      x = BASE.x + Math.cos(angle) * 500; y = BASE.y + Math.sin(angle) * 500;
      if (TERRAIN.every(o => Math.hypot(o.x - x, o.y - y) > o.radius + ENEMIES[kind].radius + 3)) break;
    }
    return { id: 10000 + i, kind, x, y, hp: ENEMIES[kind].hp, maxHp: ENEMIES[kind].hp, path: [], revision: -1, targetId: 'base', attackTimer: 10000, angle: 0, hit: 0, attacking: false };
  });
  game.update(1 / 60);
  const p = candidates.find(p => !game.canBuild(p.x, p.y, 'rapid'))!;
  const started = performance.now(); game.build(p.x, p.y, 'rapid'); const buildMs = performance.now() - started;
  const frames: number[] = [];
  for (let i = 0; i < 241; i++) { const start = performance.now(); game.update(1 / 60); frames.push(performance.now() - start); }
  const firstMs = frames.shift()!; frames.sort((a, b) => a - b);
  results.push({ towers: game.towers.length, enemies: 8, buildMs: +buildMs.toFixed(2), firstUpdateMs: +firstMs.toFixed(2), followingMaxMs: +frames.at(-1)!.toFixed(2), followingP95Ms: +frames[Math.floor(frames.length * .95)].toFixed(2) });
}
console.table(results);
