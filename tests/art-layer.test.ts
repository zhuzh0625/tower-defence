import test from 'node:test';
import assert from 'node:assert/strict';
import { ArtLayer } from '../src/art-layer.ts';
import { ART_FRAMES, ART_TEXTURE } from '../src/art.ts';

test('art nodes are reused, depth follows feet, and removed units release their objects', () => {
  const containers: any[] = [], images: any[] = [], frames: unknown[][] = [];
  const image = () => {
    const state: Record<string, any> = {};
    for (const key of ['setTexture', 'setOrigin', 'setPosition', 'setDisplaySize', 'setAlpha', 'setFlipX', 'setRotation', 'setTint', 'setVisible']) {
      state[key] = (...args: unknown[]) => { state[key + 'Value'] = args; return state; };
    }
    images.push(state); return state;
  };
  const scene = {
    textures: { get(key: string) { assert.equal(key, ART_TEXTURE); return { add(...args: unknown[]) { frames.push(args); } }; } },
    add: { image, graphics: () => ({ clear() {} }), container: (_x: number, _y: number, children: unknown[]) => {
      const node = { children, depth: 0, destroyed: false, setDepth(depth: number) { this.depth = depth; }, destroy() { this.destroyed = true; } };
      containers.push(node); return node;
    } },
  };
  const layer = new ArtLayer(scene as any);
  assert.equal(frames.length, Object.keys(ART_FRAMES).length);
  layer.begin(); layer.select('enemy-7', 120); layer.sprite('scout', 50, 80, 20, 1, true, 1, .03, 0xffc9aa); layer.end();
  const first = images[0]; assert.deepEqual(first.setPositionValue, [50, 79]); assert.deepEqual(first.setFlipXValue, [true]);
  layer.begin(); layer.select('enemy-7', 240); layer.sprite('scout', 60, 100, 20); layer.select('preview', 999999); layer.end();
  assert.equal(images.length, 2, 'a moving enemy must reuse its original image');
  assert.equal(containers[0].depth, 240);
  assert.deepEqual(first.setFlipXValue, [false]); assert.deepEqual(first.setTintValue, [0xffffff]); assert.deepEqual(first.setRotationValue, [0]);
  layer.begin(); layer.select('enemy-7', 245); layer.end();
  assert.equal(containers[1].destroyed, true, 'cancelled previews are destroyed');
  layer.begin(); layer.end(); assert.equal(containers[0].destroyed, true, 'dead or reset units are destroyed');
});
