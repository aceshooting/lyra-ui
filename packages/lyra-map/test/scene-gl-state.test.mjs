import assert from 'node:assert/strict';
import test from 'node:test';
import { createSceneGlEnvelope } from '../src/scene/gl-state.mjs';

const capabilities = ['BLEND', 'CULL_FACE', 'DEPTH_TEST', 'STENCIL_TEST', 'SCISSOR_TEST',
  'POLYGON_OFFSET_FILL', 'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE', 'RASTERIZER_DISCARD', 'DITHER'];
const parameters = {
  COLOR_WRITEMASK: [true, false, true, false], COLOR_CLEAR_VALUE: [0.25, 0.5, 0.75, 1],
  DEPTH_WRITEMASK: false, DEPTH_FUNC: 'GREATER', DEPTH_RANGE: [0.25, 0.75], DEPTH_CLEAR_VALUE: 0.5,
  STENCIL_FUNC: 'LESS', STENCIL_REF: 3, STENCIL_VALUE_MASK: 15, STENCIL_WRITEMASK: 31,
  STENCIL_FAIL: 'INCR', STENCIL_PASS_DEPTH_FAIL: 'DECR', STENCIL_PASS_DEPTH_PASS: 'REPLACE',
  STENCIL_BACK_FUNC: 'GEQUAL', STENCIL_BACK_REF: 7, STENCIL_BACK_VALUE_MASK: 63, STENCIL_BACK_WRITEMASK: 127,
  STENCIL_BACK_FAIL: 'INVERT', STENCIL_BACK_PASS_DEPTH_FAIL: 'ZERO', STENCIL_BACK_PASS_DEPTH_PASS: 'KEEP',
  STENCIL_CLEAR_VALUE: 5, BLEND_EQUATION_RGB: 'FUNC_SUBTRACT', BLEND_EQUATION_ALPHA: 'FUNC_REVERSE_SUBTRACT',
  BLEND_SRC_RGB: 'SRC_ALPHA', BLEND_DST_RGB: 'ONE_MINUS_SRC_ALPHA', BLEND_SRC_ALPHA: 'ONE', BLEND_DST_ALPHA: 'ZERO',
  BLEND_COLOR: [0.25, 0.5, 0.75, 0.5], CULL_FACE_MODE: 'FRONT', FRONT_FACE: 'CW',
  POLYGON_OFFSET_FACTOR: 2, POLYGON_OFFSET_UNITS: 3, SAMPLE_COVERAGE_VALUE: 0.5,
  SAMPLE_COVERAGE_INVERT: true, LINE_WIDTH: 2, VIEWPORT: [11, 13, 211, 123], SCISSOR_BOX: [17, 19, 101, 83],
  TRANSFORM_FEEDBACK_ACTIVE: false, TRANSFORM_FEEDBACK_PAUSED: false
};

function fakeGl() {
  const calls = [], state = new Map(Object.entries(structuredClone(parameters)));
  const enabled = new Set(capabilities.filter((_, index) => index % 2 === 0)), queries = new Map();
  const program = {}, vao = {}, buffer = {}, drawFbo = {}, readFbo = {};
  Object.entries({ CURRENT_PROGRAM: program, VERTEX_ARRAY_BINDING: vao, ARRAY_BUFFER_BINDING: buffer,
    DRAW_FRAMEBUFFER_BINDING: drawFbo, READ_FRAMEBUFFER_BINDING: readFbo }).forEach(([key, value]) => state.set(key, value));
  let lost = false, extension = null;
  const gl = {};
  for (const key of [...Object.keys(parameters), ...capabilities, 'CURRENT_PROGRAM', 'VERTEX_ARRAY_BINDING',
    'ARRAY_BUFFER_BINDING', 'DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING', 'CURRENT_QUERY',
    'ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE', 'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN',
    'ARRAY_BUFFER', 'FRONT', 'BACK', 'FRONT_AND_BACK']) gl[key] = key;
  const record = (name, work) => (...args) => {
    assert.equal(lost, false, `${name} must not be forwarded after loss`);
    calls.push([name, ...args]); return work(...args);
  };
  gl.isContextLost = () => { calls.push(['isContextLost']); return lost; };
  gl.getParameter = record('getParameter', name => {
    assert.equal(state.has(name), true, `unexpected parameter ${name}`);
    const value = state.get(name); return Array.isArray(value) ? [...value] : value;
  });
  gl.isEnabled = record('isEnabled', name => enabled.has(name));
  gl.getQuery = record('getQuery', (target, parameter) => {
    assert.equal(parameter, gl.CURRENT_QUERY); return queries.get(target) ?? null;
  });
  gl.getExtension = record('getExtension', name => {
    assert.equal(name, 'EXT_disjoint_timer_query_webgl2'); return extension;
  });
  gl.isProgram = record('isProgram', value => value === program || value === null);
  gl.isVertexArray = record('isVertexArray', value => value === vao || value === null);
  gl.isBuffer = record('isBuffer', value => value === buffer || value === null);
  gl.enable = record('enable', name => enabled.add(name));
  gl.disable = record('disable', name => enabled.delete(name));
  const scalar = (name, key) => { gl[name] = record(name, value => state.set(key, value)); };
  const tuple = (name, key) => { gl[name] = record(name, (...values) => state.set(key, values)); };
  scalar('useProgram', 'CURRENT_PROGRAM'); scalar('bindVertexArray', 'VERTEX_ARRAY_BINDING');
  gl.bindBuffer = record('bindBuffer', (target, value) => { assert.equal(target, gl.ARRAY_BUFFER); state.set('ARRAY_BUFFER_BINDING', value); });
  tuple('colorMask', 'COLOR_WRITEMASK'); tuple('clearColor', 'COLOR_CLEAR_VALUE');
  scalar('depthMask', 'DEPTH_WRITEMASK'); scalar('depthFunc', 'DEPTH_FUNC'); tuple('depthRange', 'DEPTH_RANGE'); scalar('clearDepth', 'DEPTH_CLEAR_VALUE');
  const faces = face => face === gl.FRONT_AND_BACK ? ['', '_BACK'] : face === gl.FRONT ? [''] : ['_BACK'];
  gl.stencilFuncSeparate = record('stencilFuncSeparate', (face, func, ref, mask) => {
    for (const suffix of faces(face)) for (const [key, value] of [['FUNC', func], ['REF', ref], ['VALUE_MASK', mask]]) state.set(`STENCIL${suffix}_${key}`, value);
  });
  gl.stencilMaskSeparate = record('stencilMaskSeparate', (face, mask) => { for (const suffix of faces(face)) state.set(`STENCIL${suffix}_WRITEMASK`, mask); });
  gl.stencilOpSeparate = record('stencilOpSeparate', (face, fail, depthFail, pass) => {
    for (const suffix of faces(face)) for (const [key, value] of [['FAIL', fail], ['PASS_DEPTH_FAIL', depthFail], ['PASS_DEPTH_PASS', pass]]) state.set(`STENCIL${suffix}_${key}`, value);
  });
  scalar('clearStencil', 'STENCIL_CLEAR_VALUE');
  gl.blendEquationSeparate = record('blendEquationSeparate', (rgb, alpha) => { state.set('BLEND_EQUATION_RGB', rgb); state.set('BLEND_EQUATION_ALPHA', alpha); });
  gl.blendFuncSeparate = record('blendFuncSeparate', (sr, dr, sa, da) => {
    for (const [key, value] of [['SRC_RGB', sr], ['DST_RGB', dr], ['SRC_ALPHA', sa], ['DST_ALPHA', da]]) state.set(`BLEND_${key}`, value);
  });
  tuple('blendColor', 'BLEND_COLOR'); scalar('cullFace', 'CULL_FACE_MODE'); scalar('frontFace', 'FRONT_FACE');
  gl.polygonOffset = record('polygonOffset', (factor, units) => { state.set('POLYGON_OFFSET_FACTOR', factor); state.set('POLYGON_OFFSET_UNITS', units); });
  gl.sampleCoverage = record('sampleCoverage', (value, invert) => { state.set('SAMPLE_COVERAGE_VALUE', value); state.set('SAMPLE_COVERAGE_INVERT', invert); });
  scalar('lineWidth', 'LINE_WIDTH'); tuple('viewport', 'VIEWPORT'); tuple('scissor', 'SCISSOR_BOX');
  for (const name of ['bindFramebuffer', 'bindRenderbuffer', 'bindTexture', 'bindSampler', 'pixelStorei',
    'bufferData', 'bufferSubData', 'texImage2D', 'framebufferTexture2D', 'clear', 'getError',
    'beginQuery', 'endQuery', 'beginTransformFeedback', 'endTransformFeedback', 'pauseTransformFeedback',
    'resumeTransformFeedback', 'deleteProgram', 'deleteVertexArray', 'deleteBuffer']) {
    gl[name] = () => { assert.fail(`point envelope must not call ${name}`); };
  }
  return { gl, calls, state, enabled, queries, program, vao, buffer, drawFbo, readFbo,
    lose() { lost = true; }, timer() { extension = { TIME_ELAPSED_EXT: 'TIME_ELAPSED_EXT' }; return extension; },
    snapshot() { return { state: [...state].map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]), enabled: [...enabled].sort() }; }
  };
}

function perturb(item) {
  const { gl } = item;
  for (const name of capabilities) gl[gl.isEnabled(gl[name]) ? 'disable' : 'enable'](gl[name]);
  gl.useProgram({}); gl.bindVertexArray({}); gl.bindBuffer(gl.ARRAY_BUFFER, {});
  gl.colorMask(false, true, false, true); gl.clearColor(0, 0, 0, 0);
  gl.depthMask(true); gl.depthFunc('ALWAYS'); gl.depthRange(0, 1); gl.clearDepth(1);
  for (const face of [gl.FRONT, gl.BACK]) {
    gl.stencilFuncSeparate(face, 'NEVER', 0, 255); gl.stencilMaskSeparate(face, 255);
    gl.stencilOpSeparate(face, 'KEEP', 'KEEP', 'KEEP');
  }
  gl.clearStencil(0); gl.blendEquationSeparate('FUNC_ADD', 'FUNC_ADD');
  gl.blendFuncSeparate('ZERO', 'ONE', 'ZERO', 'ONE'); gl.blendColor(0, 0, 0, 0);
  gl.cullFace('BACK'); gl.frontFace('CCW'); gl.polygonOffset(0, 0); gl.sampleCoverage(1, false);
  gl.lineWidth(1); gl.viewport(0, 0, 1, 1); gl.scissor(0, 0, 1, 1);
}
const envelope = (item, isCurrent = () => true) => createSceneGlEnvelope(item.gl, { profile: 'point', isCurrent });

test('point operations restore the entire admitted scalar and binding inventory on success', () => {
  const item = fakeGl(), guard = envelope(item), before = item.snapshot();
  const result = guard.run(() => { perturb(item); return 37; });
  assert.equal(result, 37); assert.deepEqual(item.snapshot(), before);
  assert.equal(item.state.get('CURRENT_PROGRAM') === item.program, true);
  assert.equal(item.state.get('VERTEX_ARRAY_BINDING') === item.vao, true);
  assert.equal(item.state.get('ARRAY_BUFFER_BINDING') === item.buffer, true);
  assert.equal(item.state.get('DRAW_FRAMEBUFFER_BINDING') === item.drawFbo, true);
  assert.equal(item.state.get('READ_FRAMEBUFFER_BINDING') === item.readFbo, true);
  const vaoRestore = item.calls.findLastIndex(call => call[0] === 'bindVertexArray');
  const bufferRestore = item.calls.findLastIndex(call => call[0] === 'bindBuffer');
  assert.ok(vaoRestore < bufferRestore);
  guard.dispose();
});

test('throwing work restores entry viewport, depth, stencil and bindings before sanitized failure', () => {
  const item = fakeGl(), guard = envelope(item), before = item.snapshot(); let thrown;
  try { guard.run(() => { perturb(item); throw new Error('private callback contents'); }); } catch (error) { thrown = error; }
  assert.equal(thrown instanceof TypeError, true); assert.equal(thrown.message.includes('private callback contents'), false);
  assert.deepEqual(item.snapshot(), before);
  assert.equal(guard.run(() => 11), 11); guard.dispose();
});

test('capture precedes all envelope mutations and preserves native paint policy during a no-op operation', () => {
  const item = fakeGl(), guard = envelope(item), before = item.snapshot();
  guard.run(() => {
    assert.deepEqual(item.snapshot(), before);
    for (const key of Object.keys(parameters)) {
      if (key === 'TRANSFORM_FEEDBACK_PAUSED') continue;
      assert.ok(item.calls.some(call => call[0] === 'getParameter' && call[1] === key), `entry capture omitted ${key}`);
    }
    for (const name of capabilities) assert.ok(item.calls.some(call => call[0] === 'isEnabled' && call[1] === name));
    assert.equal(item.calls.some(call => ['useProgram', 'bindVertexArray', 'bindBuffer', 'viewport', 'depthRange'].includes(call[0])), false);
  });
  guard.dispose();
});

test('nested entry rejects before changing state and the outer operation still restores', () => {
  const item = fakeGl(), guard = envelope(item), before = item.snapshot(); let nestedRuns = 0;
  guard.run(() => {
    perturb(item); const count = item.calls.length;
    assert.throws(() => guard.run(() => { nestedRuns++; }), TypeError);
    assert.equal(item.calls.length, count);
  });
  assert.equal(nestedRuns, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
});

test('every active query target refuses work without ending or altering another owner operation', () => {
  for (const target of ['ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE',
    'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN', 'TIME_ELAPSED_EXT']) {
    const item = fakeGl(); if (target === 'TIME_ELAPSED_EXT') item.timer();
    const query = {}; item.queries.set(target, query); const before = item.snapshot(), guard = envelope(item); let work = 0;
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); assert.equal(item.queries.get(target) === query, true);
    guard.dispose();
  }
});

test('active transform feedback is refused even while paused; ended query work is allowed', () => {
  for (const paused of [false, true]) {
    const item = fakeGl(); item.state.set('TRANSFORM_FEEDBACK_ACTIVE', true); item.state.set('TRANSFORM_FEEDBACK_PAUSED', paused);
    const guard = envelope(item), before = item.snapshot(); let work = 0;
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
  }
  const item = fakeGl(), guard = envelope(item);
  assert.equal(guard.run(() => 'ended query is not active'), 'ended query is not active'); guard.dispose();
});

test('lost baseline and disposed envelope reject without forwarding capture or work', () => {
  for (const lost of [false, true]) {
    const item = fakeGl(), guard = envelope(item); let work = 0;
    if (lost) item.lose(); else guard.dispose();
    item.calls.length = 0;
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.equal(item.calls.some(call => call[0] !== 'isContextLost'), false);
    guard.dispose(); guard.dispose();
  }
});

test('context loss during work skips every restoration GL forward', () => {
  const item = fakeGl(), guard = envelope(item); let afterLoss;
  assert.throws(() => guard.run(() => { perturb(item); item.lose(); afterLoss = item.calls.length; }), TypeError);
  assert.equal(item.calls.slice(afterLoss).some(call => call[0] !== 'isContextLost'), false);
  guard.dispose();
});

test('stale ownership guards client work and restores when cancellation occurs after mutation', () => {
  const item = fakeGl(); let current = false, work = 0;
  const guard = envelope(item, () => current), before = item.snapshot();
  assert.throws(() => guard.run(() => { work++; }), TypeError); assert.equal(work, 0);
  current = true;
  assert.throws(() => guard.run(() => { perturb(item); current = false; work++; }), TypeError);
  assert.equal(work, 1); assert.deepEqual(item.snapshot(), before); guard.dispose();
});

test('reentrant currency cancellation and throwing currency checks cannot publish success', () => {
  for (const throws of [false, true]) {
    const item = fakeGl(); let guard, ready = false, work = 0;
    guard = envelope(item, () => {
      if (!ready) return true;
      if (throws) throw new Error('host detail');
      guard.dispose(); return true;
    });
    ready = true; const before = item.snapshot();
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
  }
});

test('deleted entry-bound handles are refused before any restoration could resurrect them', () => {
  for (const method of ['isProgram', 'isVertexArray', 'isBuffer']) {
    const item = fakeGl(), guard = envelope(item), before = item.snapshot(); let work = 0;
    item.gl[method] = () => false;
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
  }
});

test('the point envelope owns CPU bookkeeping only and rejects asynchronous operation results', async () => {
  const item = fakeGl(), guard = envelope(item), before = item.snapshot();
  assert.throws(() => guard.run(() => { perturb(item); return Promise.resolve(1); }), TypeError);
  await Promise.resolve(); assert.deepEqual(item.snapshot(), before);
  guard.dispose(); guard.dispose();
  assert.deepEqual(item.snapshot(), before);
  assert.throws(() => createSceneGlEnvelope(item.gl, { profile: 'three-model', isCurrent: () => true }), TypeError);
});
