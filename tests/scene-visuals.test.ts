import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as data from '../src/data.ts';
import * as engine from '../src/engine.ts';
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
  assert.ok(game.build(10, 8, 'rapid'));
  const cannon = game.build(12, 8, 'cannon');
  assert.ok(cannon);
  const scene = new exports.BoardScene(game, { kind: 'cannon', towerId: cannon.id }, () => {}, () => {});
  let depth = 0;
  const scales: number[][] = [], outlines: number[][] = [], healthBars: number[][] = [];
  const ink = new Proxy({}, {
    get: (_target, command) => (...args: number[]) => {
      if (command === 'save') depth++;
      if (command === 'restore') depth--;
      assert.ok(depth >= 0, 'graphics restore must have a matching save');
      if (command === 'scaleCanvas') { assert.equal(depth, 1); scales.push(args); }
      if (command === 'strokeRoundedRect') outlines.push(args);
      return ink;
    },
  });
  scene.ink = ink;
  scene.healthBar = (...args: number[]) => { assert.equal(depth, 0); healthBars.push(args); };
  scene.cursor = { col: 15, row: 8 };
  (scene as any).draw();

  assert.deepEqual(scales, [[1, 1], [1.25, 1.25], [1.25, 1.25]]);
  assert.equal(depth, 0);
  assert.equal(outlines.length, 2);
  assert.equal(outlines[0][2], 47.5);
  assert.equal(outlines[1][2], data.CELL - 4);
  assert.equal(healthBars.length, 2);
  assert.equal(healthBars[1][2], 37.5);
  assert.equal(healthBars[1][1], data.center(cannon.col, cannon.row).y + 28.75);
});
