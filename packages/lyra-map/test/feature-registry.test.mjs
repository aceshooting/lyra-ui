import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { completePlugin, src } from '../scripts/complete-transform.mjs';

/**
 * Runs the generated lazy registry of a pinned upstream module with its dynamic imports served by
 * the test. `modules` maps a module suffix to what that import resolves to (or rejects with);
 * `loads` records every import in order. Default imports of generated shader text are stubbed.
 */
async function instantiate(relative, names, modules = {}) {
  const id = join(src, relative);
  const original = await readFile(id, 'utf8');
  const generated = (await completePlugin.transform(original, id))?.code ?? original;
  const defaults = [...generated.matchAll(/^import (\w+) from "[^"]+";$/gmu)].map((match) => match[1]);
  const body = stripTypeScriptTypes(generated, { mode: 'transform' })
    .replace(/^import[\s\S]*?;\n/gmu, '')
    .replace(/\bexport\s+/gu, '')
    .replace(/\bimport\(/gu, 'loadModule(');
  const loads = [];
  const loadModule = async (path) => {
    loads.push(path);
    const key = Object.keys(modules).find((suffix) => path.endsWith(suffix));
    assert.ok(key, `unexpected import of ${path}`);
    const module = typeof modules[key] === 'function' ? modules[key]() : modules[key];
    if (module instanceof Error) throw module;
    return module;
  };
  const exports = new Function('loadModule', ...defaults, `${body}\nreturn {${names.join(',')}};`)(loadModule, ...defaults);
  return { ...exports, loads };
}

/** A module whose named exports are classes, so that families can be told apart. */
const classes = (...names) => Object.fromEntries(names.map((name) => [name, { [name]: class { constructor(layer) { this.layer = layer; } } }[name]]));
const layerModules = {
  'circle_style_layer.ts': classes('CircleStyleLayer'),
  'fill_style_layer.ts': classes('FillStyleLayer'),
  'line_style_layer.ts': classes('LineStyleLayer'),
  'custom_style_layer.ts': classes('CustomStyleLayer'),
};
const inheritedNames = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];

test('layer families load once, on request, and layers need their family prepared', async () => {
  const registry = await instantiate('style/create_style_layer.ts', ['prepareStyleLayers', 'createStyleLayer'], layerModules);
  assert.throws(() => registry.createStyleLayer({ type: 'circle', id: 'dots' }, {}), TypeError, 'native construction before preparation fails');
  await registry.prepareStyleLayers(['circle', 'circle']);
  assert.deepEqual(registry.loads, ['./style_layer/circle_style_layer.ts']);
  const layer = registry.createStyleLayer({ type: 'circle', id: 'dots' }, { theme: 'dark' });
  assert.equal(layer.constructor.name, 'CircleStyleLayer');
  assert.deepEqual(layer.layer, { type: 'circle', id: 'dots' });
  await registry.prepareStyleLayers(['circle']);
  assert.equal(registry.loads.length, 1, 'a prepared family is never imported again');
  assert.throws(() => registry.createStyleLayer({ type: 'fill', id: 'area' }, {}), TypeError, 'other families stay unloaded');
});

test('layer descriptors and type names prepare the same families, and concurrent requests share an import', async () => {
  const registry = await instantiate('style/create_style_layer.ts', ['prepareStyleLayers', 'createStyleLayer'], layerModules);
  await Promise.all([
    registry.prepareStyleLayers([{ type: 'fill', id: 'a' }, 'line', { type: 'fill', id: 'b' }]),
    registry.prepareStyleLayers(['fill']),
    registry.prepareStyleLayers([]),
  ]);
  assert.deepEqual(registry.loads.map((path) => path.split('/').at(-1)).sort(), ['fill_style_layer.ts', 'line_style_layer.ts']);
  assert.equal(registry.createStyleLayer({ type: 'line', id: 'path' }, {}).constructor.name, 'LineStyleLayer');
  await registry.prepareStyleLayers([{ type: 'custom', id: 'user', render() {} }]);
  assert.equal(registry.createStyleLayer({ type: 'custom', id: 'user' }, {}).constructor.name, 'CustomStyleLayer');
});

test('unknown layer types are refused, including names every object inherits', async () => {
  const registry = await instantiate('style/create_style_layer.ts', ['prepareStyleLayers'], layerModules);
  for (const name of ['bogus', ...inheritedNames]) {
    await assert.rejects(registry.prepareStyleLayers([name]), { message: `Unknown feature ${name}` });
    await assert.rejects(registry.prepareStyleLayers([{ type: name }]), { message: `Unknown feature ${name}` });
  }
  assert.deepEqual(registry.loads, [], 'nothing is imported for a refused type');
});

test('a failed layer import is reported, is not remembered, and leaves other families usable', async () => {
  let failing = true;
  const registry = await instantiate('style/create_style_layer.ts', ['prepareStyleLayers', 'createStyleLayer'], {
    ...layerModules,
    'line_style_layer.ts': () => (failing ? new Error('offline') : layerModules['line_style_layer.ts']),
  });
  await assert.rejects(registry.prepareStyleLayers(['line']), { message: 'offline' });
  await registry.prepareStyleLayers(['circle']);
  failing = false;
  await registry.prepareStyleLayers(['line']);
  assert.equal(registry.loads.filter((path) => path.endsWith('line_style_layer.ts')).length, 2, 'the failed import was retried');
  assert.equal(registry.createStyleLayer({ type: 'line', id: 'path' }, {}).constructor.name, 'LineStyleLayer');
});

const sourceModules = {
  'geojson_source.ts': classes('GeoJSONSource'),
  'vector_tile_source.ts': classes('VectorTileSource'),
  'raster_dem_tile_source.ts': classes('RasterDEMTileSource'),
};

test('source families load once, on request', async () => {
  const registry = await instantiate('source/source.ts', ['prepareSources', 'addSourceType'], sourceModules);
  await Promise.all([registry.prepareSources(['geojson', 'vector']), registry.prepareSources(['geojson'])]);
  await registry.prepareSources(['raster-dem', 'vector']);
  assert.deepEqual(registry.loads.map((path) => path.split('/').at(-1)).sort(),
    ['geojson_source.ts', 'raster_dem_tile_source.ts', 'vector_tile_source.ts']);
});

test('custom source types need no import, and inherited names never count as registered types', async () => {
  const registry = await instantiate('source/source.ts', ['prepareSources', 'addSourceType'], sourceModules);
  await assert.rejects(registry.prepareSources(['heatgrid']), { message: 'Unknown feature heatgrid' });
  await registry.addSourceType('heatgrid', class HeatGrid {});
  await registry.prepareSources(['heatgrid']);
  assert.deepEqual(registry.loads, [], 'a registered class is used as is');
  await assert.rejects(registry.addSourceType('heatgrid', class Duplicate {}), { message: 'A source type called "heatgrid" already exists.' });
  for (const name of ['bogus', ...inheritedNames]) {
    await assert.rejects(registry.prepareSources([name]), { message: `Unknown feature ${name}` });
  }
});

test('a failed source import is not remembered', async () => {
  let failing = true;
  const registry = await instantiate('source/source.ts', ['prepareSources'], {
    'geojson_source.ts': () => (failing ? new Error('offline') : sourceModules['geojson_source.ts']),
  });
  await assert.rejects(registry.prepareSources(['geojson']), { message: 'offline' });
  failing = false;
  await registry.prepareSources(['geojson']);
  await registry.prepareSources(['geojson']);
  assert.equal(registry.loads.length, 2);
});

test('drawing functions arrive with their layer type, after the always-needed debug, terrain and sky modules', async () => {
  // Any named export exists as a function that knows its name; `then` must stay absent so the module is not a thenable.
  const drawing = new Proxy({}, { get: (_target, name) => (typeof name === 'string' && name !== 'then' ? Object.assign(() => name, { named: name }) : undefined) });
  const registry = await instantiate('webgl/draw/index.ts', ['prepareDraws', 'webglDrawFunctions'], {
    'draw_debug.ts': drawing, 'draw_terrain.ts': drawing, 'draw_sky.ts': drawing, 'draw_circle.ts': drawing, 'draw_fill.ts': drawing,
  });
  assert.deepEqual(Object.keys(registry.webglDrawFunctions), []);
  await registry.prepareDraws([]);
  assert.deepEqual(registry.loads.map((path) => path.slice(2)).sort(), ['draw_debug.ts', 'draw_sky.ts', 'draw_terrain.ts']);
  assert.deepEqual(Object.keys(registry.webglDrawFunctions).sort(), ['atmosphere', 'debug', 'debugPadding', 'sky', 'terrainDepth']);
  await registry.prepareDraws(['circle', 'fill', 'circle', 'unknown-type']);
  assert.equal(registry.webglDrawFunctions.circle.named, 'drawCircles');
  assert.equal(registry.webglDrawFunctions.fill.named, 'drawFill');
  assert.equal(registry.loads.filter((path) => path === './draw_circle.ts').length, 1);
});

test('shader programs of a family join the shared table once, and unknown groups are ignored', async () => {
  const program = (name) => ({ default: { [name]: { fragmentSource: `${name} fragment` } } });
  const registry = await instantiate('shaders/shaders.ts', ['prepareShaders', 'shaders'], {
    'shader-symbol.ts': program('symbolIcon'), 'shader-sky.ts': program('sky'),
  });
  assert.deepEqual(Object.keys(registry.shaders).sort(), ['clippingMask', 'depth', 'prelude', 'projectionMercator'], 'core programs need no import');
  await Promise.all([registry.prepareShaders(['symbol', 'unknown']), registry.prepareShaders(['symbol'])]);
  assert.equal(registry.shaders.symbolIcon.fragmentSource, 'symbolIcon fragment');
  assert.equal(registry.shaders.sky, undefined, 'unrequested families stay unloaded');
  await registry.prepareShaders(['symbol', 'sky']);
  assert.equal(registry.shaders.sky.fragmentSource, 'sky fragment');
  assert.equal(registry.loads.length, 2);
});

test('uniform setters of a family join the shared table once, and a failed import can be retried', async () => {
  let failing = true;
  const family = () => (failing ? new Error('offline') : { default: { circle: () => ({ opacity: 1 }) } });
  const registry = await instantiate('webgl/program/program_uniforms.ts', ['prepareUniforms', 'programUniforms'], { 'uniform-circle.ts': family });
  assert.deepEqual(Object.keys(registry.programUniforms).sort(), ['clippingMask', 'depth']);
  await assert.rejects(registry.prepareUniforms(['circle']), { message: 'offline' });
  failing = false;
  await registry.prepareUniforms(['circle', 'circle', 'unknown']);
  await registry.prepareUniforms(['circle']);
  assert.deepEqual(registry.programUniforms.circle(), { opacity: 1 });
  assert.equal(registry.loads.length, 2);
});

test('globe and vertical perspective modules load together, once, and never for the mercator default', async () => {
  const modules = classes('GlobeProjection', 'createGlobeTransform', 'GlobeCameraHelper', 'VerticalPerspectiveCameraHelper',
    'createVerticalPerspectiveTransform', 'VerticalPerspectiveProjection');
  const registry = await instantiate('geo/projection/projection_factory.ts', ['prepareProjection'], {
    'globe_projection.ts': modules, 'globe_transform.ts': modules, 'globe_camera_helper.ts': modules,
    'vertical_perspective_camera_helper.ts': modules, 'vertical_perspective_transform.ts': modules,
    'vertical_perspective_projection.ts': modules,
  });
  await registry.prepareProjection('mercator');
  assert.deepEqual(registry.loads, []);
  await Promise.all([registry.prepareProjection('globe'), registry.prepareProjection('vertical-perspective')]);
  await registry.prepareProjection('globe');
  assert.equal(registry.loads.length, 6);
});
