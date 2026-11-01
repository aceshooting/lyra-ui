import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { completePlugin, src } from '../scripts/complete-transform.mjs';

// Execute the pinned implementations; only imports are supplied by this harness.
// Shader compilation/reflection, scalar state, mesh/VAO and FBO adapters below are
// bounded substitutes. These tests do not prove real cold shader/mesh compilation,
// DEM texture preparation, pixels, or arbitrary reentrant map/style destruction.
async function loadModule(relative, names, dependencies = {}) {
  const id = join(src, relative);
  const original = await readFile(id, 'utf8');
  const transformed = (await completePlugin.transform(original, id))?.code ?? original;
  const javascript = stripTypeScriptTypes(transformed, { mode: 'transform' })
    .replace(/^import[\s\S]*?;\s*/gmu, '')
    .replace(/^export \{[^}]*\};?\s*/gmu, '')
    .replace(/^export (?=(?:class|function|const|let)\b)/gmu, '');
  return new Function(...Object.keys(dependencies), `${javascript}\nreturn {${names.join(',')}};`)(...Object.values(dependencies));
}

const valueNames = ['ClearColor', 'ClearDepth', 'ClearStencil', 'ColorMask', 'DepthMask', 'StencilMask',
  'StencilFunc', 'StencilOp', 'StencilTest', 'DepthRange', 'DepthTest', 'DepthFunc', 'Blend', 'BlendFunc',
  'BlendColor', 'BlendEquation', 'CullFace', 'CullFaceSide', 'FrontFace', 'ProgramValue', 'ActiveTextureUnit',
  'Viewport', 'BindFramebuffer', 'BindRenderbuffer', 'BindTexture', 'BindVertexBuffer', 'BindElementBuffer',
  'BindVertexArray', 'PixelStoreUnpack', 'PixelStoreUnpackPremultiplyAlpha', 'PixelStoreUnpackFlipY'];

// Value/scalar adapters intentionally perform no buffer operations.
class ValueAdapter {
  constructor(context, location) { this.context = context; this.location = location; this.dirty = false; }
  set(value) { this.value = value; this.dirty = false; }
}

async function loadNative() {
  assert.equal(JSON.parse(await readFile(join(src, '../package.json'), 'utf8')).version, '6.15.0');
  const ubo = await loadModule('webgl/uniform_buffer.ts', ['UniformBuffer', 'std140Layout', 'applyUBOBindings', 'UBO_BINDINGS']);
  const projection = await loadModule('webgl/projection_uniform_buffer.ts',
    ['createProjectionUniformBuffer', 'bindProjectionUniformBuffer', 'releaseProjectionUniformBuffers', 'destroyProjectionUniformBuffers'], ubo);
  const terrain = await loadModule('webgl/terrain_uniform_buffer.ts', ['createTerrainUniformBuffer', 'updateTerrainUniformBuffer'], ubo);
  const frame = await loadModule('webgl/frame_uniform_buffer.ts',
    ['createFrameUniformBuffer', 'updateFrameUniformBuffer', 'setFrameUniformWorldSize'], ubo);
  const Color = { transparent: { r: 0, g: 0, b: 0, a: 0 }, white: { r: 1, g: 1, b: 1, a: 1 } };
  const ColorMode = { Replace: ['ONE', 'ZERO'], unblended: { blendFunction: ['ONE', 'ZERO'], mask: [true, true, true, true] } };
  const DepthMode = { disabled: { func: 'ALWAYS', mask: false } };
  const StencilMode = { disabled: { test: { func: 'ALWAYS' }, mask: 0 } };
  const CullFaceMode = { disabled: { enable: false } };
  const uniforms = await loadModule('webgl/program/terrain_program.ts', ['terrainPreludeUniforms', 'terrainHeightUniforms', 'terrainHeightUniformValues'], {
    ...Object.fromEntries(['Uniform1i', 'Uniform1f', 'Uniform4f', 'UniformMatrix4f', 'UniformColor'].map(name => [name, ValueAdapter])),
    Color
  });
  const { Context } = await loadModule('webgl/context.ts', ['Context'], {
    ...Object.fromEntries(valueNames.map(name => [name, ValueAdapter])),
    ...projection, ...terrain, ...frame, ColorMode, deepEqual: isDeepStrictEqual
  });
  class VertexArrayObject {
    bind(context) { context.gl.recordMeshBind(); }
  }
  const shader = { staticAttributes: [], staticUniforms: ['vec4 u_tile_bounds'], vertexSource: '', fragmentSource: '' };
  const shaders = { prelude: { staticUniforms: [], vertexSource: '', fragmentSource: '' }, terrainHeight: shader };
  const { Program } = await loadModule('webgl/program.ts', ['Program'], {
    shaders, VertexArrayObject, ...uniforms, ...ubo, ...projection, ...terrain
  });
  const { ProgramCache } = await loadModule('webgl/program_cache.ts', ['ProgramCache'], {
    shaders, Program, programUniforms: { terrainHeight: uniforms.terrainHeightUniforms }
  });
  const draw = await loadModule('webgl/draw/draw_terrain.ts', ['drawTerrainHeightMap'], {
    ...uniforms, Color, ColorMode, DepthMode, StencilMode, CullFaceMode
  });
  return { ...ubo, ...projection, ...terrain, ...frame, ...draw, Context, ProgramCache };
}

const nativePromise = loadNative();
const handle = name => ({ name });

function fakeGl(reflected = ['ProjectionUBO', 'TerrainUBO', 'FrameUBO']) {
  const calls = [], buffers = new Map();
  const entryGeneric = handle('entry-generic');
  let generic = entryGeneric, serial = 0, inHook = false, throwOnDraw = false;
  const indexed = Array.from({ length: 8 }, (_, index) => {
    if (index % 3 === 1) return { buffer: null, start: 0, size: 0, range: false };
    const buffer = handle(`entry-slot-${index}`);
    buffers.set(buffer, 256);
    return { buffer, start: index % 3 === 0 ? 16 : 0, size: index % 3 === 0 ? 48 : 256, range: index % 3 === 0 };
  });
  const gl = { drawingBufferWidth: 640, drawingBufferHeight: 480, INVALID_INDEX: 0xffffffff,
    COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100, STENCIL_BUFFER_BIT: 0x400 };
  for (const name of ['UNIFORM_BUFFER', 'UNIFORM_BUFFER_BINDING', 'UNIFORM_BUFFER_START', 'UNIFORM_BUFFER_SIZE',
    'DYNAMIC_DRAW', 'MAX_TEXTURE_SIZE', 'ALWAYS', 'TRIANGLES', 'LINES', 'LINE_STRIP', 'UNSIGNED_SHORT',
    'TEXTURE2', 'TEXTURE3', 'TEXTURE_2D', 'FRAGMENT_SHADER', 'VERTEX_SHADER', 'LINK_STATUS', 'ACTIVE_ATTRIBUTES']) gl[name] = name;
  const method = (name, callback) => {
    gl[name] = function (...args) {
      assert.equal(this, gl, `${name} receiver`);
      const call = { name, args, inHook };
      calls.push(call);
      return callback(call, ...args);
    };
  };
  method('createBuffer', () => { const buffer = handle(`ubo-${++serial}`); buffers.set(buffer, 0); return buffer; });
  method('bindBuffer', (_call, target, buffer) => { assert.equal(target, gl.UNIFORM_BUFFER); generic = buffer; });
  method('bindBufferBase', (_call, target, index, buffer) => {
    assert.equal(target, gl.UNIFORM_BUFFER);
    assert.ok(Number.isInteger(index) && index >= 0 && index < indexed.length);
    generic = buffer;
    indexed[index] = { buffer, start: 0, size: buffer ? buffers.get(buffer) : 0, range: false };
  });
  method('bindBufferRange', (_call, target, index, buffer, start, size) => {
    assert.equal(target, gl.UNIFORM_BUFFER);
    assert.ok(Number.isInteger(index) && index >= 0 && index < indexed.length);
    generic = buffer;
    indexed[index] = { buffer, start, size, range: true };
  });
  method('bufferData', (call, target, data, usage) => {
    assert.equal(target, gl.UNIFORM_BUFFER);
    assert.equal(usage, gl.DYNAMIC_DRAW);
    assert.ok(buffers.has(generic), 'upload must address an allocated buffer');
    call.recipient = generic;
    call.data = typeof data === 'number' ? data : Array.from(data);
    call.byteLength = typeof data === 'number' ? data : data.byteLength;
    buffers.set(generic, call.byteLength);
    for (const binding of indexed) if (binding.buffer === generic && !binding.range) binding.size = call.byteLength;
  });
  method('deleteBuffer', (_call, buffer) => {
    assert.equal(inHook, false, 'buffer destruction is excluded from the height-map hook');
    assert.ok(buffers.delete(buffer), 'delete each allocated buffer once');
    if (generic === buffer) generic = null;
    // Deletion clears every slot holding this object, including untouched slots.
    for (let index = 0; index < indexed.length; index++) if (indexed[index].buffer === buffer) {
      indexed[index] = { buffer: null, start: 0, size: 0, range: false };
    }
  });
  method('getParameter', (_call, parameter) => {
    if (parameter === gl.UNIFORM_BUFFER_BINDING) return generic;
    assert.equal(parameter, gl.MAX_TEXTURE_SIZE);
    return 4096;
  });
  method('getIndexedParameter', (_call, parameter, index) => {
    if (parameter === gl.UNIFORM_BUFFER_BINDING) return indexed[index].buffer;
    if (parameter === gl.UNIFORM_BUFFER_START) return indexed[index].start;
    assert.equal(parameter, gl.UNIFORM_BUFFER_SIZE);
    return indexed[index].size;
  });
  method('getUniformBlockIndex', (_call, _program, name) => reflected.includes(name) ? reflected.indexOf(name) : gl.INVALID_INDEX);
  method('uniformBlockBinding', () => {});
  method('getExtension', () => null);
  method('isContextLost', () => false);
  method('createProgram', () => handle(`program-${++serial}`));
  method('createShader', () => handle(`shader-${++serial}`));
  method('getProgramParameter', (_call, _program, parameter) => {
    if (parameter === gl.LINK_STATUS) return true;
    assert.equal(parameter, gl.ACTIVE_ATTRIBUTES);
    return 0;
  });
  method('getUniformLocation', (_call, _program, name) => handle(name));
  for (const name of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'deleteShader', 'deleteProgram',
    'bindTexture', 'clear', 'recordMeshBind']) method(name, () => {});
  method('drawElements', () => { if (throwOnDraw) throw new Error('draw failure'); });
  return { gl, calls, buffers, indexed, entryGeneric,
    generic: () => generic,
    hook(work) { assert.equal(inHook, false); inHook = true; try { return work(); } finally { inHook = false; } },
    failDraw(value) { throwOnDraw = value; } };
}

const callsNamed = (calls, name) => calls.filter(call => call.name === name);
const indexedWrites = calls => calls.filter(call => call.name === 'bindBufferBase' || call.name === 'bindBufferRange');
const slots = calls => indexedWrites(calls).map(call => call.args[1]);
const uploads = calls => callsNamed(calls, 'bufferData');
const snapshot = bindings => bindings.map(binding => ({ ...binding }));

async function fixture({ reflected, count = 1, missing = [] } = {}) {
  const native = await nativePromise;
  const item = fakeGl(reflected), { gl, calls } = item;
  const initialIndexed = snapshot(item.indexed);
  const context = new native.Context(gl);
  const constructionCalls = [...calls];
  const cache = new native.ProgramCache(context);
  const tiles = Array.from({ length: count }, (_, index) => ({ tileID: { canonical: { z: 2, x: index, y: 1 }, wrap: 0 } }));
  const data = tiles.map((_tile, index) => ({ tile: missing.includes(index) ? {} : { dem: {} },
    depthTexture: handle(`depth-${index}`), texture: handle(`dem-${index}`),
    u_terrain_matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, index, 0, 0, 1],
    u_terrain_unpack: [1, 256, 65536, -10000], u_terrain_dim: 256, u_terrain_exaggeration: 1 }));
  const meshRequests = [], attachmentCalls = [], requestedPrograms = [];
  const segments = { get: () => [{ vertexOffset: 0, primitiveLength: 2, primitiveOffset: 0 }] };
  const terrain = {
    tileManager: { getRenderableTiles: () => tiles },
    getTerrainData: tileID => data[tiles.findIndex(tile => tile.tileID === tileID)],
    getTerrainMesh(tileID) { meshRequests.push(tileID); return { vertexBuffer: {}, indexBuffer: {}, segments }; },
    getHeightMapFramebuffer(texture) {
      attachmentCalls.push(texture);
      return { colorAttachment: { set: value => attachmentCalls.push(value) } };
    }
  };
  const frame = { context, data: { isRenderingGlobe: false }, useProgram(name, configuration, useTerrain) {
    requestedPrograms.push([name, configuration, useTerrain]);
    return cache.getProgram({ name, programConfiguration: configuration, useTerrain, showOverdrawInspector: false,
      projectionShaderVariant: { name: 'mercator', prelude: { vertexSource: '', fragmentSource: '' }, define: '' }, defines: [] });
  } };
  const target = { texture: handle('height-target'), width: 8, height: 8, bounds: [0, 0, 1, 1] };
  return { ...item, native, context, cache, initialIndexed, constructionCalls, data, tiles, frame, target,
    meshRequests, attachmentCalls, requestedPrograms,
    draw() { const start = calls.length; item.hook(() => native.drawTerrainHeightMap(frame, terrain, target)); return calls.slice(start); } };
}

function assertBoundBuffers(item) {
  const { context, indexed, generic } = item;
  assert.equal(indexed[0].buffer, context.projectionUniformBuffer.buffer);
  assert.equal(indexed[1].buffer, context.terrainUniformBuffer.buffer);
  assert.equal(indexed[2].buffer, context.frameUniformBuffer.buffer);
  assert.equal(generic(), context.projectionUniformBuffer.buffer, 'last indexed bind also changes generic UBO binding');
  assert.deepEqual(snapshot(indexed.slice(3)), item.initialIndexed.slice(3), 'higher range/base/null sentinels survive');
}

function assertHookFootprint(calls) {
  assert.ok(indexedWrites(calls).every(call => [0, 1, 2].includes(call.args[1])));
  assert.equal(callsNamed(calls, 'bindBufferRange').length, 0);
  assert.equal(callsNamed(calls, 'deleteBuffer').length, 0);
  assert.ok(calls.every(call => call.inHook));
}

test('pinned cold Context constructs three real std140 UBOs without any indexed binding', async () => {
  const item = await fixture();
  const { context, constructionCalls, initialIndexed, indexed, native } = item;
  for (const buffer of [context.projectionUniformBuffer, context.terrainUniformBuffer, context.frameUniformBuffer]) assert.ok(buffer instanceof native.UniformBuffer);
  assert.deepEqual(slots(constructionCalls), []);
  assert.deepEqual(snapshot(indexed), initialIndexed);
  assert.notEqual(item.generic(), item.entryGeneric);
  assert.equal(item.generic(), context.frameUniformBuffer.buffer);
  assert.deepEqual(uploads(constructionCalls).map(call => [call.recipient, call.byteLength]), [
    [context.projectionUniformBuffer.buffer, 176], [context.terrainUniformBuffer.buffer, 96], [context.frameUniformBuffer.buffer, 64]
  ]);
  assert.deepEqual(uploads(constructionCalls).map(call => call.data), [176, 96, 64]);
});

for (const reflected of [['ProjectionUBO', 'TerrainUBO', 'FrameUBO'], ['TerrainUBO'], []]) {
  test(`pinned cold ProgramCache height draw with reflected blocks ${reflected.join(',') || 'absent'}`, async () => {
    const item = await fixture({ reflected });
    const calls = item.draw();
    assertHookFootprint(calls);
    assert.deepEqual(slots(calls), [1, 2, 1, 0]);
    assert.deepEqual(uploads(calls).map(call => call.recipient), [item.context.terrainUniformBuffer.buffer]);
    assert.deepEqual(callsNamed(calls, 'getUniformBlockIndex').map(call => call.args[1]), ['ProjectionUBO', 'TerrainUBO', 'FrameUBO']);
    const expectedBindings = { ProjectionUBO: 0, TerrainUBO: 1, FrameUBO: 2 };
    assert.deepEqual(callsNamed(calls, 'uniformBlockBinding').map(call => call.args.slice(1)),
      reflected.map((name, index) => [index, expectedBindings[name]]));
    assert.equal(callsNamed(calls, 'createProgram').length, 1);
    assert.equal(callsNamed(calls, 'drawElements').length, 1);
    assert.deepEqual(item.requestedPrograms, [['terrainHeight', null, true]]);
    assert.deepEqual(item.attachmentCalls, [item.target.texture, null]);
    assertBoundBuffers(item);
    assert.equal(item.context.terrainUniformBuffer.hasData, true);
    assert.equal(item.context.projectionUniformBuffer.hasData, false, 'height-map passes null projection data');
  });
}

test('pinned hot height draw executes Context.setDirty and rebinds unchanged UBOs without uploading', async () => {
  const item = await fixture();
  item.draw();
  const previousBindings = item.context.boundUniformBuffers;
  assert.equal(previousBindings.length, 3);
  // External rendering changed GL while the native cache still describes the previous draw.
  const foreign = handle('external-ubo');
  item.buffers.set(foreign, 512);
  for (const index of [0, 1, 2]) item.gl.bindBufferRange(item.gl.UNIFORM_BUFFER, index, foreign, 32, 64);
  assert.equal(item.context.boundUniformBuffers, previousBindings);
  const calls = item.draw();
  assert.notEqual(item.context.boundUniformBuffers, previousBindings, 'actual setDirty replaces the indexed cache');
  assert.equal(item.context.clearDepth.dirty, true, 'actual setDirty invalidates unused scalar caches too');
  assertHookFootprint(calls);
  assert.deepEqual(slots(calls), [1, 2, 0]);
  assert.equal(uploads(calls).length, 0);
  assert.equal(callsNamed(calls, 'createProgram').length, 0);
  assertBoundBuffers(item);
});

test('changed terrain uploads only to the terrain buffer after an unrelated generic bind', async () => {
  const item = await fixture();
  item.draw();
  const foreign = item.gl.createBuffer();
  item.gl.bindBuffer(item.gl.UNIFORM_BUFFER, foreign);
  item.data[0].u_terrain_exaggeration = 3;
  const calls = item.draw();
  assertHookFootprint(calls);
  assert.deepEqual(slots(calls), [1, 2, 1, 0]);
  assert.equal(uploads(calls).length, 1);
  assert.equal(uploads(calls)[0].recipient, item.context.terrainUniformBuffer.buffer);
  assert.notEqual(uploads(calls)[0].recipient, foreign);
  assert.equal(uploads(calls)[0].data[21], 3);
  assertBoundBuffers(item);
});

test('multiple tiles update the same terrain UBO and skip missing DEM before mesh/draw', async () => {
  const item = await fixture({ count: 4, missing: [1] });
  const calls = item.draw();
  assertHookFootprint(calls);
  assert.deepEqual(slots(calls), [1, 2, 1, 0, 1, 1]);
  assert.deepEqual(uploads(calls).map(call => call.recipient), Array(3).fill(item.context.terrainUniformBuffer.buffer));
  assert.deepEqual(uploads(calls).map(call => call.data[12]), [0, 2, 3]);
  assert.deepEqual(item.meshRequests, [item.tiles[0].tileID, item.tiles[2].tileID, item.tiles[3].tileID]);
  assert.equal(callsNamed(calls, 'drawElements').length, 3);
  assert.equal(callsNamed(calls, 'createBuffer').length, 0);
  // Projection binds once, before later terrain uploads change the generic binding.
  assert.equal(item.generic(), item.context.terrainUniformBuffer.buffer);
  assert.deepEqual(snapshot(item.indexed.slice(3)), item.initialIndexed.slice(3));
});

test('all missing DEM leaves indexed and generic bindings unchanged after cold program reflection', async () => {
  const item = await fixture({ count: 2, missing: [0, 1] });
  const before = snapshot(item.indexed), generic = item.generic();
  const calls = item.draw();
  assertHookFootprint(calls);
  assert.deepEqual(slots(calls), []);
  assert.equal(uploads(calls).length, 0);
  assert.equal(item.meshRequests.length, 0);
  assert.equal(callsNamed(calls, 'drawElements').length, 0);
  assert.deepEqual(snapshot(item.indexed), before);
  assert.equal(item.generic(), generic);
  assert.deepEqual(item.attachmentCalls, [item.target.texture, null]);
});

test('actual frame/projection helpers upload through their own fixed slots and keyed reuse stays on slot zero', async () => {
  const item = await fixture(), { native, context, gl } = item;
  const start = item.calls.length;
  native.updateFrameUniformBuffer(context.frameUniformBuffer, {
    pixelsToGLUnits: [0.01, -0.01], cameraToCenterDistance: 20, width: 640, height: 480, pitch: 30
  }, { fadeDuration: 0, symbolFadeChange: 0.5, pixelRatio: 2 });
  native.setFrameUniformWorldSize(context.frameUniformBuffer, 16, 8);
  const projection = { mainMatrix: Array(16).fill(1), fallbackMatrix: Array(16).fill(2),
    tileMercatorCoords: [0, 0, 1, 1], clippingPlane: [0, 0, 0, 1], projectionTransition: 0.5, clipAntimeridian: true };
  native.bindProjectionUniformBuffer(context, projection);
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'tile-a' });
  const keyed = context.keyedProjectionUniformBuffers.get('tile-a');
  assert.ok(keyed instanceof native.UniformBuffer);
  const beforeReuse = item.calls.length;
  context.setDirty();
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'tile-a' });
  assert.deepEqual(slots(item.calls.slice(beforeReuse)), [0]);
  assert.equal(uploads(item.calls.slice(beforeReuse)).length, 0);
  native.releaseProjectionUniformBuffers(context);
  assert.equal(context.keyedProjectionUniformBuffers.size, 0);
  const beforeUnchangedReuse = item.calls.length;
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'tile-b' });
  assert.equal(context.keyedProjectionUniformBuffers.get('tile-b'), keyed);
  assert.equal(uploads(item.calls.slice(beforeUnchangedReuse)).length, 0, 'unchanged free-buffer reuse does not upload');
  assert.deepEqual(slots(item.calls.slice(beforeUnchangedReuse)), [], 'reused buffer is already bound');
  const calls = item.calls.slice(start);
  assert.deepEqual(slots(calls), [2, 2, 0, 0, 0]);
  assert.deepEqual(uploads(calls).filter(call => typeof call.data === 'number').map(call => [call.recipient, call.data]), [[keyed.buffer, 176]]);
  assert.deepEqual(uploads(calls).filter(call => Array.isArray(call.data)).map(call => call.recipient), [context.frameUniformBuffer.buffer,
    context.frameUniformBuffer.buffer, context.projectionUniformBuffer.buffer, keyed.buffer]);
  assert.equal(item.generic(), keyed.buffer);
  assert.deepEqual(snapshot(item.indexed.slice(3)), item.initialIndexed.slice(3));
  assert.equal(callsNamed(calls, 'deleteBuffer').length, 0);
  assert.equal(gl.getIndexedParameter(gl.UNIFORM_BUFFER_START, 0), 0);
  assert.equal(gl.getIndexedParameter(gl.UNIFORM_BUFFER_SIZE, 0), 176);
});

test('native draw failure does not destroy UBOs; actual Context.destroy is a separate teardown', async () => {
  const item = await fixture();
  item.failDraw(true);
  const start = item.calls.length;
  assert.throws(() => item.draw(), /draw failure/u);
  const calls = item.calls.slice(start);
  assertHookFootprint(calls);
  assert.deepEqual(slots(calls), [1, 2, 1, 0]);
  assertBoundBuffers(item);
  assert.deepEqual(item.attachmentCalls, [item.target.texture], 'throw bypasses native trailing attachment detach');
  const buffers = [item.context.projectionUniformBuffer.buffer, item.context.terrainUniformBuffer.buffer, item.context.frameUniformBuffer.buffer];
  const teardownStart = item.calls.length;
  item.context.destroy();
  item.cache.destroy();
  const teardown = item.calls.slice(teardownStart);
  assert.deepEqual(callsNamed(teardown, 'deleteBuffer').map(call => call.args[0]), buffers);
  assert.ok(teardown.every(call => !call.inHook));
  assert.deepEqual(item.indexed.slice(0, 3).map(binding => binding.buffer), [null, null, null]);
  assert.deepEqual(snapshot(item.indexed.slice(3)), item.initialIndexed.slice(3));
  assert.equal(item.generic(), null);
});

test('separate native projection teardown can clear a higher slot alias through buffer deletion', async () => {
  const item = await fixture(), { native, context, gl } = item;
  const projection = { mainMatrix: Array(16).fill(1), fallbackMatrix: Array(16).fill(2),
    tileMercatorCoords: [0, 0, 1, 1], clippingPlane: [0, 0, 0, 1], projectionTransition: 0, clipAntimeridian: false };
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'reusable' });
  const free = context.keyedProjectionUniformBuffers.get('reusable');
  native.releaseProjectionUniformBuffers(context);
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'current' });
  assert.equal(context.keyedProjectionUniformBuffers.get('current'), free);
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'second' });
  const second = context.keyedProjectionUniformBuffers.get('second');
  native.releaseProjectionUniformBuffers(context);
  native.bindProjectionUniformBuffer(context, { ...projection, uniformBufferKey: 'active' });
  assert.equal(context.keyedProjectionUniformBuffers.size, 1);
  assert.equal(context.freeProjectionUniformBuffers.length, 1);
  const owned = [context.projectionUniformBuffer.buffer, free.buffer, second.buffer,
    context.terrainUniformBuffer.buffer, context.frameUniformBuffer.buffer];
  gl.bindBufferRange(gl.UNIFORM_BUFFER, 6, free.buffer, 16, 32);
  const start = item.calls.length;
  context.destroy();
  const calls = item.calls.slice(start);
  assert.deepEqual(new Set(callsNamed(calls, 'deleteBuffer').map(call => call.args[0])), new Set(owned));
  assert.equal(callsNamed(calls, 'deleteBuffer').length, owned.length);
  assert.deepEqual(slots(calls), [], 'teardown need not explicitly bind a slot to clear its deleted buffer');
  assert.equal(item.indexed[6].buffer, null);
  assert.ok(calls.every(call => !call.inHook));
});
