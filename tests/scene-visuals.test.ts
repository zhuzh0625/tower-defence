import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as data from '../src/data.ts';
import * as engine from '../src/engine.ts';
import * as cameraView from '../src/camera-view.ts';
import * as buildingVisuals from '../src/building-visuals.ts';
import * as projection from '../src/projection.ts';
import * as art from '../src/art.ts';
import * as terrain from '../src/terrain.ts';
import * as weaponArt from '../src/weapon-art.ts';

test('scene sorts solids by projected feet and keeps health bars outside ground transforms', () => {
  const source = readFileSync(new URL('../src/scene.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const exports: Record<string, any> = {};
  const modules: Record<string, unknown> = {
    phaser: { Scene: class {} },
    './data': data,
    './camera-view': cameraView,
    './engine': engine,
    './building-visuals': buildingVisuals,
    './projection': projection,
    './art': art,
    './art-layer': {},
    './terrain': terrain,
    './terrain-renderer': {},
    './weapon-art': weaponArt,
  };
  vm.runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      assert.ok(Object.hasOwn(modules, name), `unexpected scene dependency: ${name}`);
      return modules[name];
    },
  }, { filename: 'scene.js' });

  const game = new engine.GameEngine();
  assert.ok(game.build(420.25, 340.5, 'rapid'));
  const cannon = game.build(330.5, 320.25, 'cannon');
  assert.ok(cannon);
  for (const tower of game.towers) tower.work = null;
  const scene = new exports.BoardScene(game, { kind: 'cannon', towerId: cannon.id }, () => {}, () => {});
  let depth = 0;
  const outlines: number[][] = [], healthBars: number[][] = [], solids: number[] = [], arcs: number[][] = [];
  const ink = new Proxy({}, {
    get: (_target, command) => (...args: number[]) => {
      if (command === 'save') depth++;
      if (command === 'restore') depth--;
      assert.ok(depth >= 0, 'graphics restore must have a matching save');
      if (command === 'strokeCircle') { assert.equal(depth, 1); outlines.push(args); }
      if (command === 'arc') arcs.push(args);
      return ink;
    },
  });
  scene.ink = ink;
  scene.groundInk = ink; scene.overlayInk = ink;
  const layers: { id: string; depth: number }[] = [];
  scene.art = { begin() {}, end() {}, select(id: string, depth: number) { layers.push({ id, depth }); return ink; } };
  const solid = (p: { x: number; y: number }) => { assert.equal(depth, 0); solids.push(projection.project(p.x, p.y).y); };
  scene.drawBase = () => solid(data.BASE); scene.drawRock = solid; scene.drawTower = solid; scene.drawEnemy = solid;
  scene.turret = () => assert.equal(depth, 0);
  scene.healthBar = (...args: number[]) => { assert.equal(depth, 0); healthBars.push(args); };
  scene.cursor = { x: 621.75, y: 339.25 };
  (scene as any).draw();

  assert.equal(solids.length, data.TERRAIN.length + 3);
  assert.ok(solids.every((y, i) => i === 0 || y >= solids[i - 1]));
  assert.equal(layers.length, solids.length + 1);
  assert.ok(layers.slice(0, -1).every((layer, i) => layer.depth === solids[i]));
  assert.equal(layers.at(-1)?.id, 'preview');
  assert.equal(depth, 0);
  assert.ok(outlines.some(circle => circle[0] === cannon.x && circle[2] === data.TOWERS.cannon.radius + 3));
  assert.ok(outlines.some(circle => circle[0] === scene.cursor.x && circle[2] === data.TOWERS.cannon.radius));
  assert.ok(outlines.some(circle => circle[0] === data.BASE.x && circle[2] === data.BASE.radius + data.BUILDING_GAP / 2));
  assert.ok(arcs.some(arc => arc[0] === scene.cursor.x && arc[2] === data.TOWERS.cannon.radius + data.BUILDING_GAP / 2));
  assert.equal(healthBars.length, 2);
  assert.equal(healthBars[1][2], 37.5);
  const top = projection.project(cannon.x, cannon.y, buildingVisuals.towerHeight('cannon'));
  assert.equal(healthBars[1][0], top.x);
  assert.equal(healthBars[1][1], top.y - 23);
  scene.cameras = { main: { width: 1200, height: 800, zoom: 2.3, scrollX: -100, scrollY: 20 } };
  const p = projection.project(621.75, 339.25), c = scene.cameras.main;
  const point = scene.worldPoint({ x: (p.x - c.scrollX - c.width / 2) * c.zoom + c.width / 2, y: (p.y - c.scrollY - c.height / 2) * c.zoom + c.height / 2 });
  assert.ok(Math.hypot(point.x - 621.75, point.y - 339.25) < 1e-9);
  const picked = scene.pickBuilding(projection.project(cannon.x, cannon.y, buildingVisuals.towerHeight('cannon')));
  assert.equal(picked.x, cannon.x); assert.equal(picked.y, cannon.y);
});
