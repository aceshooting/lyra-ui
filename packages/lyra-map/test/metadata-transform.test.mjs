import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { completePlugin, src } from '../scripts/complete-transform.mjs';
import { transformMetadata } from '../scripts/metadata-transform.mjs';

async function loader(path, names, dependencies) {
  const id = join(src, path);
  const original = await readFile(id, 'utf8');
  const result = await completePlugin.transform(original, id);
  const javascript = stripTypeScriptTypes(result?.code ?? original, { mode: 'transform' })
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/^export /gm, '');
  return new Function(...Object.keys(dependencies), javascript + '\nreturn {' + names.join(',') + '};')(...Object.values(dependencies));
}

async function tileLoader(data) {
  return (await loader('source/load_tilejson.ts', ['loadTileJson'], {
    pick: (value, keys) => Object.fromEntries(keys.filter(key => key in value).map(key => [key, value[key]])),
    extend: Object.assign,
    getJSON: async () => ({ data: structuredClone(data) }),
    ResourceType: { Source: 'Source' },
    browser: { frameAsync: async () => {} }
  })).loadTileJson;
}
const requests = { transformRequest: url => ({ url }) };
const tile = () => ({ tiles: ['custom://tiles/{z}/{x}/{y}'], minzoom: 0, maxzoom: 22 });
const tileCases = [
  ['null root', () => null],
  ['array root', () => []],
  ['scalar root', () => 'tiles'],
  ['empty tiles', () => ({ ...tile(), tiles: [] })],
  ['nonarray tiles', () => ({ ...tile(), tiles: 'custom://tile' })],
  ['nonstrings in tiles', () => ({ ...tile(), tiles: [3] })],
  ['sparse templates', () => ({ ...tile(), tiles: new Array(1) })],
  ['blank template', () => ({ ...tile(), tiles: ['  '] })],
  ['zoom type', () => ({ ...tile(), maxzoom: '22' })],
  ['nonfinite zoom', () => ({ ...tile(), minzoom: Infinity })],
  ['reversed zoom range', () => ({ ...tile(), minzoom: 10, maxzoom: 2 })],
  ['range with default minimum', () => ({ tiles: tile().tiles, maxzoom: -1 })],
  ['range with default maximum', () => ({ tiles: tile().tiles, minzoom: 23 })],
  ['scheme enum', () => ({ ...tile(), scheme: 'other' })],
  ['encoding enum', () => ({ ...tile(), encoding: 'other' })],
  ['tileSize nonfinite', () => ({ ...tile(), tileSize: Infinity })],
  ['vector tileSize', () => ({ ...tile(), tileSize: 256 })],
  ['bounds shape', () => ({ ...tile(), bounds: [1, 2] })],
  ['sparse bounds', () => ({ ...tile(), bounds: new Array(4) })],
  ['bounds nonfinite', () => ({ ...tile(), bounds: [0, NaN, 10, 20] })],
  ['reversed latitude bounds', () => ({ ...tile(), bounds: [-180, 40, 180, -40] })],
  ['attribution type', () => ({ ...tile(), attribution: {} })],
  ['vector_layers shape', () => ({ ...tile(), vector_layers: {} })],
  ['vector_layers id', () => ({ ...tile(), vector_layers: [{ id: 7 }] })]
];
for (const [name, value] of tileCases) {
  test('rejects TileJSON ' + name + ' before returning source metadata', async () => {
    const load = await tileLoader(value());
    await assert.rejects(load({ type: 'vector', url: 'custom://metadata' }, requests, new AbortController()), /Invalid TileJSON/);
  });
}

test('keeps custom tile protocols, antimeridian bounds, finite fractional zooms and explicit overrides', async () => {
  const load = await tileLoader({
    ...tile(), bounds: [170, -20, -170, 20], minzoom: 1.5, maxzoom: 23.5,
    encoding: 'mlt', vector_layers: [{ id: 'points' }], attribution: '<b>Data</b>'
  });
  const result = await load({ type: 'vector', url: 'custom://metadata', maxzoom: 24 }, requests, new AbortController());
  assert.deepEqual(result.tiles, tile().tiles);
  assert.deepEqual(result.bounds, [170, -20, -170, 20]);
  assert.equal(result.minzoom, 1.5);
  assert.equal(result.maxzoom, 24);
  assert.equal(result.encoding, 'mlt');
  assert.deepEqual(result.vectorLayerIds, ['points']);
});

test('keeps raster and DEM encoding contracts distinct from vector metadata', async () => {
  const raster = await tileLoader({ ...tile(), tileSize: 256, scheme: 'tms' });
  assert.equal((await raster({ type: 'raster', url: 'custom://metadata' }, requests, new AbortController())).tileSize, 256);
  for (const encoding of ['mapbox', 'terrarium', 'custom']) {
    const dem = await tileLoader({ ...tile(), tileSize: 256, encoding });
    assert.equal((await dem({ type: 'raster-dem', url: 'custom://metadata' }, requests, new AbortController())).encoding, encoding);
  }
  const dem = await tileLoader({ ...tile(), encoding: 'mlt' });
  await assert.rejects(dem({ type: 'raster-dem', url: 'custom://metadata' }, requests, new AbortController()), /Invalid TileJSON encoding/);
});

const icon = () => ({ x: 0, y: 0, width: 16, height: 16, pixelRatio: 1, sdf: false });
async function spriteLoader(data) {
  const urls = [];
  const image = { width: 64, height: 32 };
  const context = { canvas: image, getImageData() { throw new Error('sprite extraction is lazy'); } };
  const result = await loader('style/load_sprite.ts', ['loadSprite'], {
    getJSON: async request => { urls.push(request.url); return { data }; },
    ImageRequest: { getImage: async request => { urls.push(request.url); return { data: image }; } },
    ResourceType: { SpriteJSON: 'SpriteJSON', SpriteImage: 'SpriteImage' },
    browser: { getImageCanvasContext: () => context },
    coerceSpriteToArray: value => [{ id: 'default', url: value }]
  });
  return { load: () => result.loadSprite('custom://sprites/sheet', requests, 2, new AbortController()), urls };
}
const spriteCases = [
  ['null root', () => null],
  ['array root', () => []],
  ['null entry', () => ({ item: null })],
  ['array entry', () => ({ item: [] })],
  ['width type', () => ({ item: { ...icon(), width: '16' } })],
  ['nonfinite width', () => ({ item: { ...icon(), width: Infinity } })],
  ['fractional width', () => ({ item: { ...icon(), width: 1.5 } })],
  ['zero height', () => ({ item: { ...icon(), height: 0 } })],
  ['negative x', () => ({ item: { ...icon(), x: -1 } })],
  ['nonfinite y', () => ({ item: { ...icon(), y: NaN } })],
  ['sheet overflow', () => ({ item: { ...icon(), x: 60 } })],
  ['pixelRatio zero', () => ({ item: { ...icon(), pixelRatio: 0 } })],
  ['pixelRatio nonfinite', () => ({ item: { ...icon(), pixelRatio: Infinity } })],
  ['sdf type', () => ({ item: { ...icon(), sdf: 'yes' } })],
  ['stretch pair shape', () => ({ item: { ...icon(), stretchX: [[0, 1, 2]] } })],
  ['sparse stretch pair', () => ({ item: { ...icon(), stretchX: [new Array(2)] } })],
  ['stretch nonfinite', () => ({ item: { ...icon(), stretchX: [[0, NaN]] } })],
  ['stretch overlap', () => ({ item: { ...icon(), stretchY: [[2, 6], [5, 8]] } })],
  ['content shape', () => ({ item: { ...icon(), content: [0, 1, 2] } })],
  ['sparse content', () => ({ item: { ...icon(), content: new Array(4) } })],
  ['content nonfinite', () => ({ item: { ...icon(), content: [0, 0, Infinity, 2] } })],
  ['content bounds', () => ({ item: { ...icon(), content: [10, 0, 5, 10] } })],
  ['textFit enum', () => ({ item: { ...icon(), textFitWidth: 'other' } })]
];
for (const [name, value] of spriteCases) {
  test('rejects sprite ' + name + ' before returning metadata for extraction', async () => {
    const { load } = await spriteLoader(value());
    await assert.rejects(load(), /Invalid sprite metadata/);
  });
}

test('keeps high-DPR and stretched sprites in sheet bounds with supported text-fit modes', async () => {
  const metadata = { item: { ...icon(), x: 32, y: 16, pixelRatio: 2, sdf: true,
    stretchX: [[0, 4], [8, 16]], stretchY: [[2, 14]], content: [1, 1, 15, 15],
    textFitWidth: 'stretchOnly', textFitHeight: 'proportional' } };
  const { load, urls } = await spriteLoader(metadata);
  const result = await load();
  assert.equal(result.default.item.pixelRatio, 2);
  assert.equal(result.default.item.sdf, true);
  assert.deepEqual(result.default.item.content, metadata.item.content);
  assert.equal(result.default.item.spriteData.x, 32);
  assert.equal(result.default.item.spriteData.y, 16);
  assert.equal(result.default.item.data, null, 'icon pixels remain lazy');
  assert.deepEqual(urls, ['custom://sprites/sheet@2x.json', 'custom://sprites/sheet@2x.png']);
});

test('keeps an empty but valid sprite metadata object', async () => {
  const { load } = await spriteLoader({});
  assert.deepEqual(Object.keys((await load()).default), []);
});

test('uses optional sprite metadata defaults and ignores inherited icon entries', async () => {
  const metadata = Object.create({ inherited: icon() });
  metadata.item = { x: 0, y: 0, width: 16, height: 16, textFitWidth: 'stretchOrShrink' };
  const { load } = await spriteLoader(metadata);
  const result = await load();
  assert.deepEqual(Object.keys(result.default), ['item']);
  assert.equal(result.default.item.pixelRatio, 1);
  assert.equal(result.default.item.sdf, false);
});

test('metadata transforms reject missing or duplicate pinned source anchors', async () => {
  for (const path of ['source/load_tilejson.ts', 'style/load_sprite.ts']) {
    const original = await readFile(join(src, path), 'utf8');
    assert.throws(() => transformMetadata('', path), /anchor changed/);
    assert.throws(() => transformMetadata(original + original, path), /anchor changed/);
  }
  assert.equal(transformMetadata('unrelated', 'source/unrelated.ts'), undefined);
});
