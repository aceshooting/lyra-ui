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

async function imageManagerHarness(renderStyleImage = () => false) {
  class Evented { fire() {} }
  class RGBAImage {
    constructor(size, data = new Uint8Array(size.width * size.height * 4)) { Object.assign(this, size, { data }); }
    clone() { return new RGBAImage(this, this.data.slice()); }
  }
  const module = await moduleHarness('render/image_manager.ts', ['ImageManager'], {
    Evented, ErrorEvent: class {}, MapStyleImageMissingEvent: class {}, RGBAImage,
    renderStyleImage, warnOnce: () => {}
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

test('style image changes drain once and retain special names after each reset', async () => {
  const { Style } = await moduleHarness('style/style.ts', ['Style'], {
    Evented: class {}, emptyStyle: () => ({ version: 8, sources: {}, layers: [] })
  });
  const style = Object.create(Style.prototype), reloads = [];
  style.tileManagers = { tile: { reloadTilesForDependencies: (...args) => reloads.push(args) } };
  style._resetUpdates();
  for (let cycle = 0; cycle < 2; cycle++) {
    assert.equal(Object.getPrototypeOf(style._changedImages), null);
    style._markImagesChanged(specialNames);
    style._updateTilesForChangedImages();
    assert.deepEqual(reloads.at(-1), [['icons', 'patterns'], specialNames]);
    assert.deepEqual(Object.keys(style._changedImages), []);
    style._updateTilesForChangedImages();
    assert.equal(reloads.length, cycle + 1);
  }
});

test('worker tile requests own icon and pattern dependency names', async () => {
  const { WorkerTile } = await moduleHarness('source/worker_tile.ts', ['WorkerTile'], {
    CollisionBoxArray: class {}, FeatureIndex: class {}, EvaluationParameters: class {},
    DictionaryCoder: class { encode() { return 0; } },
    mapObject: (record, map) => Object.fromEntries(Object.entries(record).map(([key, value]) => [key, map(value)])),
    MessageType: { getImages: 'images' },
    GlyphAtlas: class { constructor() { this.positions = {}; } },
    ImageAtlas: class { constructor() { this.iconPositions = {}; this.patternPositions = {}; } }
  });
  const bucket = {
    populate(_features, options) {
      for (const dependencies of [options.iconDependencies, options.patternDependencies]) {
        assert.equal(Object.getPrototypeOf(dependencies), null);
        for (const name of specialNames) dependencies[name] = true;
      }
    },
    isEmpty: () => false
  };
  const layer = { id: 'symbols', source: 'source', isHidden: () => false, recalculate() {}, createBucket: () => bucket };
  const tile = Object.assign(Object.create(WorkerTile.prototype), {
    source: 'source', tileID: { canonical: {} }, zoom: 0, inFlightDependencies: []
  });
  const requests = [];
  const result = await tile.parse({ layers: { places: { version: 2, length: 0 } } }, {
    familiesBySource: { source: { places: [[layer]] } }
  }, specialNames, { async sendAsync(request) { requests.push(request); return {}; } }, {});
  assert.deepEqual(requests.map(request => [request.type, request.data.type, request.data.icons]), [
    ['images', 'icons', specialNames], ['images', 'patterns', specialNames]
  ]);
  assert.deepEqual(result.buckets, [bucket]);
});

test('image atlas allocates independent own-name position dictionaries', async () => {
  const { ImageAtlas } = await moduleHarness('render/image_atlas.ts', ['ImageAtlas'], {
    register() {}, RGBAImage: class { constructor(size) { Object.assign(this, size); } },
    potpack(bins) { assert.equal(bins.length, 0); return { w: 0, h: 0 }; }
  });
  const atlas = new ImageAtlas({}, {});
  const images = Object.fromEntries(specialNames.map(name => [name, { data: { width: 1, height: 1 }, pixelRatio: 1, version: 0 }]));
  for (const positions of [atlas.iconPositions, atlas.patternPositions]) {
    assert.equal(Object.getPrototypeOf(positions), null);
    const bins = [];
    atlas.addImages(images, positions, bins);
    assert.deepEqual(Object.keys(positions), specialNames);
    assert.equal(bins.length, specialNames.length);
    for (const name of specialNames) assert.deepEqual(positions[name].displaySize, [1, 1]);
  }
  assert.notEqual(atlas.iconPositions, atlas.patternPositions);
});

test('worker codec excludes enumerable inherited payload fields', async () => {
  const codec = await codecHarness();
  class Record { constructor() { this.own = 3; } }
  Record.prototype.inherited = 7;
  codec.register('SpriteKeyInheritedRecord', Record);
  const serialized = codec.serialize(new Record());
  assert.equal(Object.hasOwn(serialized, 'inherited'), false);
  assert.equal(serialized.own, 3);
  const result = codec.deserialize(structuredClone(serialized));
  assert.ok(result instanceof Record);
  assert.equal(Object.hasOwn(result, 'inherited'), false);
  assert.equal(result.inherited, 7);
});

test('image manager rejects duplicates and advances replacement versions for special names', async () => {
  const { manager, RGBAImage } = await imageManagerHarness();
  const image = () => ({ data: new RGBAImage({ width: 1, height: 1 }), pixelRatio: 1, sdf: false, version: 0 });
  for (const name of specialNames) {
    const first = image(), replacement = image();
    manager.addImage(name, first);
    assert.throws(() => manager.addImage(name, replacement), /already exist/);
    assert.equal(manager.getImage(name), first);
    manager.updateImage(name, replacement);
    assert.equal(manager.getImage(name), replacement);
    assert.equal(replacement.version, 1);
  }
  assert.equal(manager.updateVersion, specialNames.length);
});

test('image render callbacks run once per name per frame and resume next frame', async () => {
  const calls = [];
  const { manager, RGBAImage } = await imageManagerHarness(image => { calls.push(image); return false; });
  const images = specialNames.map(() => ({ data: new RGBAImage({ width: 1, height: 1 }), pixelRatio: 1, sdf: false, version: 0 }));
  specialNames.forEach((name, index) => manager.addImage(name, images[index]));
  manager.dispatchRenderCallbacks([...specialNames, ...specialNames]);
  manager.dispatchRenderCallbacks(specialNames);
  assert.deepEqual(calls, images);
  manager.beginFrame();
  manager.dispatchRenderCallbacks(specialNames);
  assert.deepEqual(calls, [...images, ...images]);
});
