import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { basePlugin } from '../scripts/base-transform.mjs';
import { changed, completePlugin, src, virtual } from '../scripts/complete-transform.mjs';
import { CHANGED_SOURCE_FILES, upstreamModules } from './pinned-upstream.mjs';

const read = (relative) => readFile(join(src, relative), 'utf8');
const strip = (code) => stripTypeScriptTypes(code, { mode: 'transform' });
const shaderFamilies = ['globe', 'background', 'circle', 'heatmap', 'symbol', 'color-relief', 'debug', 'fill',
  'fill-extrusion', 'hillshade', 'line', 'layer-opacity', 'raster', 'terrain', 'sky'];
const uniformFamilies = shaderFamilies.filter((name) => name !== 'globe');

// Drives the plugin over the whole pinned tree once; every test that needs its results awaits it.
let driven;
function drive() {
  driven ??= (async () => {
    const rewritten = new Map();
    const modules = await upstreamModules();
    assert.ok(modules.length > 600, 'the pinned tree has several hundred modules');
    for (const relative of modules) {
      const original = await read(relative);
      const result = await completePlugin.transform(original, join(src, relative));
      if (result === undefined) continue;
      assert.notEqual(result.code, original, `${relative} is reported only when it changes`);
      rewritten.set(relative, { original, code: result.code });
    }
    return rewritten;
  })();
  return driven;
}

test('rewrites exactly the reviewed set of upstream modules and leaves the rest untouched', async () => {
  const rewritten = await drive();
  assert.deepEqual([...rewritten.keys()].sort(), CHANGED_SOURCE_FILES);
  assert.deepEqual([...changed.keys()].sort(), CHANGED_SOURCE_FILES);
  for (const [relative, { original, code }] of rewritten) {
    assert.deepEqual(changed.get(relative), { original: Buffer.byteLength(original), transformed: Buffer.byteLength(code) });
  }
});

test('every rewritten module is valid once types are stripped', async () => {
  for (const [relative, { code }] of await drive()) {
    assert.doesNotThrow(() => strip(code), relative);
  }
});

test('generates one lazy module per runtime, preparation, shader and uniform family', async () => {
  await drive();
  const generated = [...virtual.keys()].map((id) => id.slice(join(src, 'modular').length + 1)).sort();
  const expected = ['prepare.ts', 'runtime.ts',
    ...shaderFamilies.map((name) => `shader-${name}.ts`), ...uniformFamilies.map((name) => `uniform-${name}.ts`)].sort();
  assert.deepEqual(generated, expected);
  for (const [id, code] of virtual) {
    assert.doesNotThrow(() => strip(code), id);
    assert.doesNotMatch(code, /<\/script>/iu, 'generated text stays safe inside script elements');
  }
});

test('generated shader and uniform families carry only their own programs', async () => {
  await drive();
  const module = (name) => virtual.get(join(src, 'modular', `${name}.ts`));
  assert.match(module('shader-symbol'), /symbolIcon:prepare\(/u);
  assert.match(module('shader-symbol'), /collisionBox:prepare\(/u);
  assert.doesNotMatch(module('shader-symbol'), /circle:prepare\(/u);
  assert.match(module('shader-globe'), /projectionGlobe:prepare\(/u);
  assert.match(module('uniform-circle'), /circle:circleUniforms/u);
  assert.doesNotMatch(module('uniform-circle'), /symbolIcon:/u);
  assert.match(module('uniform-sky'), /sky:skyUniforms/u);
  assert.match(module('uniform-symbol'), /collisionBox:emptyUniforms/u);
  assert.match(module('uniform-symbol'), /const emptyUniforms=/u, 'a family module defines the empty uniform factory it uses');
});

test('lazy loaders mention only modules inside the pinned source tree', async () => {
  for (const [relative, { code }] of await drive()) {
    for (const [, path] of code.matchAll(/import\(("(?:[^"\\]|\\.)*")\)/gu)) {
      const target = JSON.parse(path);
      assert.ok(target.startsWith('./') || target.startsWith('../') || target.startsWith(src), `${relative} loads ${target}`);
    }
  }
});

test('virtual modules are resolved and loaded by identity and are never transformed', async () => {
  await drive();
  const [id] = virtual.keys();
  assert.equal(completePlugin.resolveId(id), id);
  assert.equal(completePlugin.resolveId('./unrelated.ts'), undefined);
  assert.equal(completePlugin.load(id), virtual.get(id));
  assert.equal(completePlugin.load(join(src, 'ui/map.ts')), undefined);
  assert.equal(await completePlugin.transform('export const value = 1;', id), undefined);
});

test('modules outside the pinned source tree are not transformed', async () => {
  assert.equal(await completePlugin.transform('export const value = 1;', '/elsewhere/ui/map.ts'), undefined);
  assert.equal(await basePlugin.transform('export const value = 1;', '/elsewhere/ui/map.ts'), undefined);
  assert.equal(await completePlugin.transform('export const value = 1;', join(src, 'util/unrelated.ts')), undefined);
});

// Each entry removes one reviewed anchor from a pinned module; the patch must refuse the result.
const anchors = [
  ['util/config.ts', '    REGISTERED_PROTOCOLS: {},'],
  ['source/protocol_crud.ts', "    return config.REGISTERED_PROTOCOLS[url.substring(0, url.indexOf('://'))];"],
  ['tile/tile.ts', "import {SymbolBucket} from '../data/bucket/symbol_bucket.ts';"],
  ['tile/tile.ts', 'bucket instanceof SymbolBucket'],
  ['style/style.ts', "import {PauseablePlacement} from './pauseable_placement.ts';"],
  ['style/style.ts', 'this.crossTileSymbolIndex = new CrossTileSymbolIndex();'],
  ['style/style.ts', '_remove(mapRemoved: boolean = true): void {'],
  ['ui/map.ts', 'remove(): void {'],
  ['ui/map.ts', "import {Terrain} from '../render/terrain.ts';"],
  ['ui/map.ts', 'new Terrain('],
  ['ui/map.ts', 'this.style.placement.variableOffsets'],
  ['ui/map.ts', 'if (this.style.setState(style, options)) {'],
];
for (const [relative, anchor] of anchors) {
  test(`refuses ${relative} when the reviewed anchor ${JSON.stringify(anchor.slice(0, 40))} is missing`, async () => {
    const original = await read(relative);
    assert.ok(original.includes(anchor), 'the anchor exists in the pinned source');
    const result = completePlugin.transform(original.replace(anchor, '/* anchor removed */'), join(src, relative));
    await assert.rejects(result, (error) => /^Patch mismatch/u.test(error.message) && error.message.includes(anchor.slice(0, 40)));
  });
}

for (const relative of ['util/config.ts', 'source/protocol_crud.ts', 'tile/tile.ts', 'ui/map.ts']) {
  test(`refuses ${relative} when a reviewed anchor appears twice`, async () => {
    const original = await read(relative);
    await assert.rejects(completePlugin.transform(`${original}\n${original}`, join(src, relative)), /^Error: Patch mismatch/u);
  });
}

test('refuses the shader table when its shape or classification drifts', async () => {
  const id = join(src, 'shaders/shaders.ts');
  const original = await read('shaders/shaders.ts');
  await assert.rejects(completePlugin.transform('', id), /^Error: Shader table drift$/u);
  const entry = /^ {4}projectionGlobe: prepare\(projectionGlobeFrag, projectionGlobeVert\),\n/mu;
  assert.match(original, entry);
  await assert.rejects(completePlugin.transform(original.replace(entry, ''), id), /^Error: Shader entries 36$/u);
  const renamed = original.replace('    circle: prepare(', '    mystery: prepare(');
  await assert.rejects(completePlugin.transform(renamed, id), /^Error: Unclassified program mystery$/u);
});

test('refuses the uniform table when its shape or classification drifts', async () => {
  const id = join(src, 'webgl/program/program_uniforms.ts');
  const original = await read('webgl/program/program_uniforms.ts');
  await assert.rejects(completePlugin.transform('', id), /^Error: Uniform table drift$/u);
  const entry = /^ {4}collisionBox: emptyUniforms,\n/mu;
  assert.match(original, entry);
  await assert.rejects(completePlugin.transform(original.replace(entry, ''), id), /^Error: Uniform entries 33$/u);
  const renamed = original.replace('    circle: circleUniforms,', '    mystery: circleUniforms,');
  await assert.rejects(completePlugin.transform(renamed, id), /^Error: Unclassified program mystery$/u);
});

test('refuses the projection factory when its lazy imports drift', async () => {
  const id = join(src, 'geo/projection/projection_factory.ts');
  const original = await read('geo/projection/projection_factory.ts');
  const loaded = /^import \{(?:GlobeProjection|createGlobeTransform)\} from '[^']+';\n/gmu;
  assert.equal(original.match(loaded).length, 2);
  await assert.rejects(completePlugin.transform(original.replace(loaded, ''), id), /^Error: Projection imports drift$/u);
});

test('imports that are not lazily registered classes or layer predicates stay as written', async () => {
  const original = "import {Other} from './other.ts';\nimport type {Shape} from './shape.ts';\nimport {isMysteryStyleLayer} from '../style/style_layer/mystery_style_layer.ts';\nexport const kept = 1;\n";
  const registry = await basePlugin.transform(original, join(src, 'style/create_style_layer.ts'));
  assert.ok(registry.code.startsWith(original), 'unmapped imports are not rewritten');
  assert.doesNotMatch(registry.code, /let Other;|let Shape;/u);
  assert.match(registry.code, /export async function prepareStyleLayers\(types\)/u, 'the registry itself is still appended');
  assert.equal(await basePlugin.transform(original, join(src, 'render/painter.ts')), undefined, 'nothing else changes outside the registries');
  const predicate = "import {isSymbolStyleLayer} from '../style/style_layer/symbol_style_layer.ts';\nexport const used = isSymbolStyleLayer;\n";
  const rewritten = await basePlugin.transform(predicate, join(src, 'render/painter.ts'));
  assert.equal(rewritten.code, 'const isSymbolStyleLayer=(layer)=>layer.type==="symbol";\nexport const used = isSymbolStyleLayer;\n');
});

test('a uniform table without the always-loaded programs generates an empty core table', async () => {
  await drive();
  const saved = new Map(virtual);
  try {
    const original = await read('webgl/program/program_uniforms.ts');
    const renamed = original.replace('    depth: emptyUniforms,', '    collisionDepth: emptyUniforms,')
      .replace('    clippingMask: emptyUniforms,', '    collisionMask: emptyUniforms,');
    assert.notEqual(renamed, original);
    const result = await completePlugin.transform(renamed, join(src, 'webgl/program/program_uniforms.ts'));
    assert.match(result.code, /export const programUniforms=\{\};/u);
    assert.match(virtual.get(join(src, 'modular/uniform-symbol.ts')), /collisionDepth:emptyUniforms/u, 'the programs join their own family');
  } finally {
    virtual.clear();
    for (const [id, code] of saved) virtual.set(id, code);
  }
});
