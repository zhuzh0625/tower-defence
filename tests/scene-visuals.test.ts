import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as data from '../src/data.ts';
import * as engine from '../src/engine.ts';
import * as cameraView from '../src/camera-view.ts';
import * as buildingVisuals from '../src/building-visuals.ts';

test('scene scales placed towers and previews while restoring transforms for overlays', () => {
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
  const scales: number[][] = [], outlines: number[][] = [], healthBars: number[][] = [], positions: number[][] = [], arcs: number[][] = [];
  const ink = new Proxy({}, {
    get: (_target, command) => (...args: number[]) => {
      if (command === 'save') depth++;
      if (command === 'restore') depth--;
      assert.ok(depth >= 0, 'graphics restore must have a matching save');
      if (command === 'scaleCanvas') { assert.equal(depth, 1); scales.push(args); }
      if (command === 'strokeCircle') outlines.push(args);
      if (command === 'translateCanvas') positions.push(args);
      if (command === 'arc') arcs.push(args);
      return ink;
    },
  });
  scene.ink = ink;
  scene.healthBar = (...args: number[]) => { assert.equal(depth, 0); healthBars.push(args); };
  scene.cursor = { x: 621.75, y: 339.25 };
  (scene as any).draw();

  assert.deepEqual(scales, [[1, 1], [1.25, 1.25], [1.25, 1.25]]);
  assert.equal(depth, 0);
  assert.ok(outlines.some(circle => circle[0] === cannon.x && circle[2] === data.TOWERS.cannon.radius + 3));
  assert.ok(outlines.some(circle => circle[0] === scene.cursor.x && circle[2] === data.TOWERS.cannon.radius));
  assert.ok(outlines.some(circle => circle[0] === data.BASE.x && circle[2] === data.BASE.radius + data.BUILDING_GAP / 2));
  assert.ok(arcs.some(arc => arc[0] === scene.cursor.x && arc[2] === data.TOWERS.cannon.radius + data.BUILDING_GAP / 2));
  assert.deepEqual(positions, [[420.25, 340.5], [330.5, 320.25], [621.75, 339.25]]);
  assert.equal(healthBars.length, 2);
  assert.equal(healthBars[1][2], 37.5);
  assert.equal(healthBars[1][1], cannon.y + 28.75);
});
