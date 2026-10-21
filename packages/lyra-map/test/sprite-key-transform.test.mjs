import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { completePlugin, src } from '../scripts/complete-transform.mjs';
import { transformSpriteKeys } from '../scripts/sprite-key-transform.mjs';

async function moduleHarness(path, names, dependencies) {
  const id = join(src, path);
  const original = await readFile(id, 'utf8');
  const result = await completePlugin.transform(original, id);
  const javascript = stripTypeScriptTypes(result?.code ?? original, { mode: 'transform' })
    .replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), javascript + '\nreturn {' + names.join(',') + '};')(...Object.values(dependencies));
}

async function codecHarness() {
  const names = ['TransferableGridIndex', 'Color', 'CompoundExpression', 'ResolvedImage', 'StylePropertyFunction',
    'StyleExpression', 'ZoomDependentExpression', 'ZoomConstantExpression', 'AJAXError'];
  const dependencies = Object.fromEntries(names.map(name => [name, class {}]));
  dependencies.expressions = {};
  dependencies.isImageBitmap = () => false;
  dependencies.ImageData = class {};
  return moduleHarness('util/web_worker_transfer.ts', ['register', 'serialize', 'deserialize'], dependencies);
}

const specialNames = ['constructor', 'hasOwnProperty', '__proto__'];
const ownRecord = prototype => Object.create(prototype, Object.fromEntries(specialNames.map((name, index) => [
  name, { value: { index }, enumerable: true, writable: true, configurable: true }
])));

test('worker codec round-trips own dictionary names without changing the output prototype', async () => {
  const codec = await codecHarness();
  for (const prototype of [Object.prototype, null]) {
    const input = ownRecord(prototype);
    const serialized = codec.serialize(input);
    const result = codec.deserialize(structuredClone(serialized));
    assert.equal(Object.getPrototypeOf(result), Object.prototype);
    assert.deepEqual(Object.keys(result), specialNames);
    for (const [index, name] of specialNames.entries()) {
      assert.ok(Object.hasOwn(serialized, name), name + ' serialized own field');
      assert.ok(Object.hasOwn(result, name), name + ' deserialized own field');
      assert.deepEqual(result[name], { index });
    }
  }
});

test('worker codec retains registered class brands even with an own constructor field', async () => {
  const codec = await codecHarness();
  class CustomRecord { constructor() { this.value = 7; } }
  codec.register('SpriteKeyCustomRecord', CustomRecord);
  const input = new CustomRecord();
  for (const name of specialNames) Object.defineProperty(input, name, { value: name, enumerable: true, configurable: true });
  const result = codec.deserialize(structuredClone(codec.serialize(input)));
  assert.ok(result instanceof CustomRecord);
  assert.equal(result.value, 7);
  for (const name of specialNames) assert.equal(result[name], name);
});

test('worker codec preserves custom static serializers, builtins, typed-array transfer and the reserved metadata rule', async () => {
  const codec = await codecHarness();
  class StaticRecord {
    constructor(value) { this.value = value; }
    static serialize(input) { return { value: input.value }; }
    static deserialize(input) { return new StaticRecord(input.value); }
  }
  codec.register('SpriteKeyStaticRecord', StaticRecord);
  const custom = codec.deserialize(structuredClone(codec.serialize(new StaticRecord(9))));
  assert.ok(custom instanceof StaticRecord);
  assert.equal(custom.value, 9);
  const bytes = new Uint8Array([1, 2, 3]);
  const transferables = [];
  const serialized = codec.serialize({ date: new Date(0), pattern: /icons/u, bytes }, transferables);
  assert.deepEqual(transferables, [bytes.buffer]);
  const result = codec.deserialize(structuredClone(serialized));
  assert.equal(result.date.getTime(), 0);
  assert.equal(result.pattern.source, 'icons');
  assert.deepEqual([...result.bytes], [1, 2, 3]);
  assert.throws(() => codec.serialize({ $name: 'Object' }), /reserved/);
});

async function imageManagerHarness() {
  class Evented { fire() {} }
  class RGBAImage {
    constructor(size, data = new Uint8Array(size.width * size.height * 4)) { Object.assign(this, size, { data }); }
    clone() { return new RGBAImage(this, this.data.slice()); }
  }
  const module = await moduleHarness('render/image_manager.ts', ['ImageManager'], {
    Evented, ErrorEvent: class {}, MapStyleImageMissingEvent: class {}, RGBAImage,
    renderStyleImage: () => false, warnOnce: () => {}
  });
  return { manager: new module.ImageManager(), RGBAImage };
}

test('image registries keep own sprite names through add, get, clone, response and removal', async () => {
  const { manager, RGBAImage } = await imageManagerHarness();
  const image = () => ({ data: new RGBAImage({ width: 1, height: 1 }), pixelRatio: 1, sdf: false, version: 0 });
  const images = Object.fromEntries(specialNames.map(name => [name, image()]));
  manager.setSpriteImages('default', images);
  assert.deepEqual(manager.listImages(), specialNames);
  const response = await manager.getImages(specialNames);
  const cloned = manager.cloneImages();
  for (const name of specialNames) {
    assert.ok(Object.hasOwn(response, name));
    assert.ok(Object.hasOwn(cloned, name));
    assert.equal(manager.getImage(name).data.width, 1);
    manager.removeImage(name);
    assert.equal(manager.getImage(name), undefined);
    manager.addImage(name, image());
    manager.removeImage(name);
  }
  manager.beginFrame();
  manager.removeAllSpriteImages();
  manager.destroy();
  for (const value of [manager.images, manager._spriteImagesIds, manager._renderCallbacksDispatchedThisFrame]) {
    assert.equal(Object.getPrototypeOf(value), null);
  }
});

test('image manager ignores inherited entries in supplied sprite records', async () => {
  const { manager, RGBAImage } = await imageManagerHarness();
  const image = { data: new RGBAImage({ width: 1, height: 1 }), pixelRatio: 1, sdf: false, version: 0 };
  const images = Object.create({ inherited: image });
  images.own = image;
  manager.setSpriteImages('default', images);
  assert.deepEqual(manager.listImages(), ['own']);
  assert.equal(manager.getImage('constructor'), undefined);
});

test('sprite key transform source anchors fail closed', async () => {
  for (const path of ['style/load_sprite.ts', 'render/image_manager.ts', 'source/worker_tile.ts', 'render/image_atlas.ts', 'util/web_worker_transfer.ts', 'style/style.ts']) {
    const original = await readFile(join(src, path), 'utf8');
    assert.throws(() => transformSpriteKeys('', path), /anchor changed/);
    assert.throws(() => transformSpriteKeys(original + original, path), /anchor changed/);
  }
  assert.equal(transformSpriteKeys('unrelated', 'unrelated.ts'), undefined);
});
