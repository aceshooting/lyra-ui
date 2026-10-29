import assert from 'node:assert/strict';
import test from 'node:test';
import { createTerrainNativeBatch } from '../src/scene/terrain-native.mjs';
import { createSceneGlEnvelope } from '../src/scene/gl-state.mjs';

const bits = ['BLEND', 'CULL_FACE', 'DEPTH_TEST', 'STENCIL_TEST', 'SCISSOR_TEST', 'POLYGON_OFFSET_FILL',
  'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE', 'RASTERIZER_DISCARD', 'DITHER'];
const pixels = ['PACK_ALIGNMENT', 'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS',
  'UNPACK_ALIGNMENT', 'UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS',
  'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES', 'UNPACK_FLIP_Y_WEBGL', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_COLORSPACE_CONVERSION_WEBGL'];
const bindings = ['ARRAY_BUFFER', 'COPY_READ_BUFFER', 'COPY_WRITE_BUFFER', 'PIXEL_PACK_BUFFER', 'PIXEL_UNPACK_BUFFER', 'UNIFORM_BUFFER'];
const textures = ['TEXTURE_2D', 'TEXTURE_CUBE_MAP', 'TEXTURE_3D', 'TEXTURE_2D_ARRAY'];
const textureBindings = ['TEXTURE_BINDING_2D', 'TEXTURE_BINDING_CUBE_MAP', 'TEXTURE_BINDING_3D', 'TEXTURE_BINDING_2D_ARRAY'];
const handle = name => ({ name });

function fixture({ offscreen = false, colors = true, mirrorDefaultDrawBuffer = false } = {}) {
  const calls = [], values = new Map(Object.entries({
    MAX_DRAW_BUFFERS: 2, MAX_COLOR_ATTACHMENTS: 4, MAX_UNIFORM_BUFFER_BINDINGS: 2, MAX_VERTEX_ATTRIBS: 3, MAX_COMBINED_TEXTURE_IMAGE_UNITS: 2,
    CURRENT_PROGRAM: handle('native-program'), VERTEX_ARRAY_BINDING: handle('native-vao'),
    DRAW_FRAMEBUFFER_BINDING: offscreen ? handle('native-draw') : null,
    READ_FRAMEBUFFER_BINDING: handle('native-read'), RENDERBUFFER_BINDING: handle('native-rbo'),
    READ_BUFFER: 301, ACTIVE_TEXTURE: 101,
    COLOR_WRITEMASK: [true, false, true, false], COLOR_CLEAR_VALUE: [0.2, 0.3, 0.4, 0.5],
    DEPTH_WRITEMASK: false, DEPTH_FUNC: 'GREATER', DEPTH_RANGE: [0.2, 0.8], DEPTH_CLEAR_VALUE: 0.5,
    STENCIL_FUNC: 'LESS', STENCIL_REF: 3, STENCIL_VALUE_MASK: 15, STENCIL_WRITEMASK: 31,
    STENCIL_FAIL: 'INCR', STENCIL_PASS_DEPTH_FAIL: 'DECR', STENCIL_PASS_DEPTH_PASS: 'REPLACE',
    STENCIL_BACK_FUNC: 'GEQUAL', STENCIL_BACK_REF: 7, STENCIL_BACK_VALUE_MASK: 63, STENCIL_BACK_WRITEMASK: 127,
    STENCIL_BACK_FAIL: 'INVERT', STENCIL_BACK_PASS_DEPTH_FAIL: 'ZERO', STENCIL_BACK_PASS_DEPTH_PASS: 'KEEP', STENCIL_CLEAR_VALUE: 5,
    BLEND_EQUATION_RGB: 'FUNC_SUBTRACT', BLEND_EQUATION_ALPHA: 'FUNC_REVERSE_SUBTRACT',
    BLEND_SRC_RGB: 'SRC_ALPHA', BLEND_DST_RGB: 'ONE_MINUS_SRC_ALPHA', BLEND_SRC_ALPHA: 'ONE', BLEND_DST_ALPHA: 'ZERO',
    BLEND_COLOR: [0.1, 0.2, 0.3, 0.4], CULL_FACE_MODE: 'FRONT', FRONT_FACE: 'CW',
    POLYGON_OFFSET_FACTOR: 2, POLYGON_OFFSET_UNITS: 3, SAMPLE_COVERAGE_VALUE: 0.5, SAMPLE_COVERAGE_INVERT: true,
    LINE_WIDTH: 2, VIEWPORT: [13, 17, 211, 123], SCISSOR_BOX: [19, 23, 101, 83],
    TRANSFORM_FEEDBACK_ACTIVE: false, TRANSFORM_FEEDBACK_PAUSED: false
  }));
  for (const name of bindings) values.set(`${name}_BINDING`, handle(`native-${name}`));
  for (const name of pixels) values.set(name, name.endsWith('ALIGNMENT') ? 8 : name.includes('WEBGL') ? true : 2);
  values.set('UNPACK_COLORSPACE_CONVERSION_WEBGL', 'BROWSER_DEFAULT_WEBGL');
  const enabled = new Set(bits.filter((_, index) => index % 2 === 0));
  const units = Array.from({ length: 2 }, (_, index) => ({
    textures: textures.map(name => handle(`unit-${index}-${name}`)), sampler: handle(`sampler-${index}`)
  }));
  const ubos = [{ buffer: handle('ubo-range'), start: 16, size: 48 }, { buffer: null, start: 0, size: 0 }];
  const attributes = [new Float32Array([0.25, 0.5, 0.75, 1]), new Int32Array([-2, 3, 4, 5]), new Uint32Array([2, 3, 4, 5])];
  let drawBuffers = offscreen ? [300, 301] : ['BACK', 'NONE'];
  let lost = false, current = true, timer = null, duringGet;
  const queries = new Map(), gl = { TEXTURE0: 100, DRAW_BUFFER0: 200, COLOR_ATTACHMENT0: 300, COLOR_ATTACHMENT1: 301,
    drawingBufferWidth: 999, drawingBufferHeight: 777 };
  for (const name of [...values.keys(), ...bits, ...pixels, ...bindings, ...textures, ...textureBindings,
    'CURRENT_QUERY', 'CURRENT_VERTEX_ATTRIB', 'ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE',
    'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN', 'UNIFORM_BUFFER_START', 'UNIFORM_BUFFER_SIZE',
    'DRAW_FRAMEBUFFER', 'READ_FRAMEBUFFER', 'FRAMEBUFFER', 'RENDERBUFFER', 'FRONT', 'BACK', 'FRONT_AND_BACK',
    'NONE', 'BROWSER_DEFAULT_WEBGL']) if (!(name in gl)) gl[name] = name;
  let drawingColor = 'srgb', unpackColor = 'display-p3';
  if (colors) for (const name of ['drawingBufferColorSpace', 'unpackColorSpace']) Object.defineProperty(gl, name, {
    configurable: true,
    get() { assert.equal(this, gl); calls.push(['colorGet', name]); return name === 'drawingBufferColorSpace' ? drawingColor : unpackColor; },
    set(value) { assert.equal(this, gl); calls.push(['colorSet', name, value]); if (name === 'drawingBufferColorSpace') drawingColor = value; else unpackColor = value; }
  });
  const method = (name, callback) => { gl[name] = function (...args) {
    calls.push([name, ...args]);
    assert.equal(this, gl, `${name} requires native receiver`); assert.equal(lost, false, `${name} after loss`);
    return callback(...args);
  }; };
  gl.isContextLost = function () { assert.equal(this, gl); calls.push(['isContextLost']); return lost; };
  method('getParameter', name => {
    duringGet?.(name);
    if (textureBindings.includes(name)) return units[values.get('ACTIVE_TEXTURE') - 100].textures[textureBindings.indexOf(name)];
    if (name === 'SAMPLER_BINDING') return units[values.get('ACTIVE_TEXTURE') - 100].sampler;
    if (name === 200 || name === 201) return drawBuffers[mirrorDefaultDrawBuffer && values.get('DRAW_FRAMEBUFFER_BINDING') === null ? 0 : name - 200];
    assert.equal(values.has(name), true, `unknown parameter ${name}`);
    const value = values.get(name); return Array.isArray(value) ? [...value] : value;
  });
  gl.SAMPLER_BINDING = 'SAMPLER_BINDING';
  method('isEnabled', name => enabled.has(name)); method('enable', name => enabled.add(name)); method('disable', name => enabled.delete(name));
  method('getQuery', (target, pname) => { assert.equal(pname, gl.CURRENT_QUERY); return queries.get(target) ?? null; });
  method('getExtension', name => { assert.equal(name, 'EXT_disjoint_timer_query_webgl2'); return timer; });
  for (const name of ['isProgram', 'isVertexArray', 'isBuffer']) method(name, () => true);
  method('getIndexedParameter', (name, index) => name === gl.UNIFORM_BUFFER_BINDING ? ubos[index].buffer : name === gl.UNIFORM_BUFFER_START ? ubos[index].start : ubos[index].size);
  method('getVertexAttrib', (index, name) => { assert.equal(name, gl.CURRENT_VERTEX_ATTRIB); return attributes[index].slice(); });
  method('activeTexture', unit => values.set('ACTIVE_TEXTURE', unit));
  method('bindTexture', (target, value) => { units[values.get('ACTIVE_TEXTURE') - 100].textures[textures.indexOf(target)] = value; });
  method('bindSampler', (index, value) => { units[index].sampler = value; });
  method('bindBuffer', (target, value) => values.set(`${target}_BINDING`, value));
  method('bindBufferBase', (target, index, value) => { assert.equal(target, gl.UNIFORM_BUFFER); ubos[index] = { buffer: value, start: 0, size: 0 }; values.set('UNIFORM_BUFFER_BINDING', value); });
  method('bindBufferRange', (target, index, value, start, size) => { assert.equal(target, gl.UNIFORM_BUFFER); ubos[index] = { buffer: value, start, size }; values.set('UNIFORM_BUFFER_BINDING', value); });
  for (const [name, Type] of [['vertexAttrib4fv', Float32Array], ['vertexAttribI4iv', Int32Array], ['vertexAttribI4uiv', Uint32Array]]) {
    method(name, (index, value) => { attributes[index] = new Type(value); });
  }
  method('bindFramebuffer', (target, value) => {
    if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) values.set('DRAW_FRAMEBUFFER_BINDING', value);
    if (target === gl.FRAMEBUFFER || target === gl.READ_FRAMEBUFFER) values.set('READ_FRAMEBUFFER_BINDING', value);
  });
  method('bindRenderbuffer', (target, value) => { assert.equal(target, gl.RENDERBUFFER); values.set('RENDERBUFFER_BINDING', value); });
  method('drawBuffers', value => {
    if (values.get('DRAW_FRAMEBUFFER_BINDING') === null) {
      assert.equal(value.length, 1, 'default framebuffer has one draw buffer');
      assert.ok(value[0] === gl.BACK || value[0] === gl.NONE);
    } else {
      assert.ok(value.length <= values.get('MAX_DRAW_BUFFERS'));
      value.forEach((selection, index) => assert.ok(selection === gl.NONE || selection === gl.COLOR_ATTACHMENT0 + index,
        'framebuffer draw slot selects only its corresponding color attachment'));
    }
    drawBuffers = [value[0], value[1] ?? gl.NONE];
  });
  method('readBuffer', value => values.set('READ_BUFFER', value)); method('pixelStorei', (key, value) => values.set(key, value));
  const scalar = (name, key) => method(name, value => values.set(key, value));
  const tuple = (name, key) => method(name, (...value) => values.set(key, value));
  scalar('useProgram', 'CURRENT_PROGRAM'); scalar('bindVertexArray', 'VERTEX_ARRAY_BINDING');
  for (const [name, key] of [['depthMask', 'DEPTH_WRITEMASK'], ['depthFunc', 'DEPTH_FUNC'], ['clearDepth', 'DEPTH_CLEAR_VALUE'],
    ['clearStencil', 'STENCIL_CLEAR_VALUE'], ['cullFace', 'CULL_FACE_MODE'], ['frontFace', 'FRONT_FACE'], ['lineWidth', 'LINE_WIDTH']]) scalar(name, key);
  for (const [name, key] of [['colorMask', 'COLOR_WRITEMASK'], ['clearColor', 'COLOR_CLEAR_VALUE'], ['depthRange', 'DEPTH_RANGE'],
    ['blendColor', 'BLEND_COLOR'], ['viewport', 'VIEWPORT'], ['scissor', 'SCISSOR_BOX']]) tuple(name, key);
  method('stencilFuncSeparate', (face, func, ref, mask) => { const prefix = face === gl.FRONT ? 'STENCIL' : 'STENCIL_BACK'; values.set(`${prefix}_FUNC`, func); values.set(`${prefix}_REF`, ref); values.set(`${prefix}_VALUE_MASK`, mask); });
  method('stencilMaskSeparate', (face, mask) => values.set(`${face === gl.FRONT ? 'STENCIL' : 'STENCIL_BACK'}_WRITEMASK`, mask));
  method('stencilOpSeparate', (face, fail, depthFail, pass) => { const prefix = face === gl.FRONT ? 'STENCIL' : 'STENCIL_BACK'; values.set(`${prefix}_FAIL`, fail); values.set(`${prefix}_PASS_DEPTH_FAIL`, depthFail); values.set(`${prefix}_PASS_DEPTH_PASS`, pass); });
  method('blendEquationSeparate', (rgb, alpha) => { values.set('BLEND_EQUATION_RGB', rgb); values.set('BLEND_EQUATION_ALPHA', alpha); });
  method('blendFuncSeparate', (sr, dr, sa, da) => { for (const [key, value] of [['SRC_RGB', sr], ['DST_RGB', dr], ['SRC_ALPHA', sa], ['DST_ALPHA', da]]) values.set(`BLEND_${key}`, value); });
  method('polygonOffset', (factor, unitsValue) => { values.set('POLYGON_OFFSET_FACTOR', factor); values.set('POLYGON_OFFSET_UNITS', unitsValue); });
  method('sampleCoverage', (value, invert) => { values.set('SAMPLE_COVERAGE_VALUE', value); values.set('SAMPLE_COVERAGE_INVERT', invert); });
  for (const name of ['getError', 'clear', 'bufferData', 'bufferSubData', 'texImage2D', 'texImage3D', 'framebufferTexture2D',
    'deleteTexture', 'deleteBuffer', 'deleteFramebuffer', 'beginQuery', 'endQuery', 'beginTransformFeedback', 'endTransformFeedback']) gl[name] = () => assert.fail(`envelope must not call ${name}`);
  const item = { gl, calls, values, enabled, units, ubos, attributes, queries,
    current: () => current, stale() { current = false; }, lose() { lost = true; }, timer() { timer = { TIME_ELAPSED_EXT: 'TIMER' }; },
    duringGet(callback) { duringGet = callback; },
    colors(drawing, unpack) { drawingColor = drawing; unpackColor = unpack; },
    snapshot() { return structuredClone({ values: [...values], enabled: [...enabled].sort(), units, ubos,
      attributes: attributes.map(value => ({ type: value.constructor.name, value: [...value] })), drawBuffers,
      drawingColor, unpackColor }); }
  };
  return item;
}

const create = (item, change = {}) => createSceneGlEnvelope(item.gl, {
  profile: 'terrain-point', epoch: 7, isCurrent: item.current, ...change
});
function baseline(item) {
  assert.equal(item.values.get('PIXEL_PACK_BUFFER_BINDING'), null); assert.equal(item.values.get('PIXEL_UNPACK_BUFFER_BINDING'), null);
  assert.equal(item.values.get('ACTIVE_TEXTURE'), item.gl.TEXTURE0); assert.equal(item.enabled.has('RASTERIZER_DISCARD'), false);
  assert.deepEqual(item.units.map(unit => unit.sampler), [null, null]);
  assert.equal(item.enabled.has('SCISSOR_TEST'), false);
  for (const key of pixels) {
    const expected = key.endsWith('ALIGNMENT') ? 4 : key === 'UNPACK_COLORSPACE_CONVERSION_WEBGL' ? item.gl.NONE : key.includes('WEBGL') ? false : 0;
    assert.equal(item.values.get(key), expected, key);
  }
}
function perturb(item) {
  const { gl } = item;
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, handle('owned-draw')); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.NONE]); gl.readBuffer('BACK');
  for (const target of bindings) gl.bindBuffer(gl[target], null);
  gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, null); gl.bindBufferRange(gl.UNIFORM_BUFFER, 1, handle('owned-ubo'), 32, 64);
  for (let unit = 0; unit < 2; unit++) {
    gl.activeTexture(gl.TEXTURE0 + unit); for (const target of textures) gl.bindTexture(gl[target], null); gl.bindSampler(unit, handle('owned-sampler'));
  }
  gl.vertexAttrib4fv(0, [1, 1, 1, 1]); gl.vertexAttribI4iv(1, [0, 0, 0, 0]); gl.vertexAttribI4uiv(2, [0, 0, 0, 0]);
  gl.bindVertexArray(null); gl.useProgram(null); gl.viewport(0, 0, 1, 1); gl.scissor(0, 0, 1, 1);
  gl.depthRange(0, 1); gl.depthFunc('ALWAYS'); gl.unpackColorSpace = 'srgb';
  for (const bit of bits) item.enabled.has(bit) ? gl.disable(gl[bit]) : gl.enable(gl[bit]);
  gl.colorMask(false, true, false, true); gl.clearColor(1, 0, 1, 0); gl.depthMask(true); gl.clearDepth(1);
  gl.stencilFuncSeparate(gl.FRONT, 'ALWAYS', 1, 1); gl.stencilFuncSeparate(gl.BACK, 'NEVER', 2, 2);
  gl.stencilMaskSeparate(gl.FRONT, 1); gl.stencilMaskSeparate(gl.BACK, 2);
  gl.stencilOpSeparate(gl.FRONT, 'ZERO', 'KEEP', 'ZERO'); gl.stencilOpSeparate(gl.BACK, 'ZERO', 'ZERO', 'ZERO');
  gl.clearStencil(0); gl.blendEquationSeparate('FUNC_ADD', 'FUNC_ADD');
  gl.blendFuncSeparate('ZERO', 'ONE', 'ZERO', 'ONE'); gl.blendColor(0, 1, 0, 1);
  gl.cullFace('BACK'); gl.frontFace('CCW'); gl.polygonOffset(0, 0); gl.sampleCoverage(1, false); gl.lineWidth(1);
  for (const key of pixels) gl.pixelStorei(gl[key], key.endsWith('ALIGNMENT') ? 1 : key.includes('WEBGL') ? true : 7);
}

test('terrain-point establishes numeric transfer baseline and restores the complete raw inventory', () => {
  for (const offscreen of [false, true]) {
    const item = fixture({ offscreen }), guard = create(item), before = item.snapshot();
    const draw = item.values.get('DRAW_FRAMEBUFFER_BINDING'), read = item.values.get('READ_FRAMEBUFFER_BINDING');
    assert.equal(guard.run(() => {
      baseline(item);
      assert.deepEqual(item.values.get('SCISSOR_BOX'), [19, 23, 101, 83]);
      assert.deepEqual(item.values.get('VIEWPORT'), [13, 17, 211, 123]);
      assert.equal(item.values.get('DRAW_FRAMEBUFFER_BINDING'), draw);
      assert.equal(item.values.get('READ_FRAMEBUFFER_BINDING'), read);
      perturb(item); return 23;
    }), 23);
    assert.deepEqual(item.snapshot(), before);
    assert.equal(item.values.get('DRAW_FRAMEBUFFER_BINDING'), draw);
    assert.equal(item.values.get('READ_FRAMEBUFFER_BINDING'), read);
    const last = name => item.calls.findLastIndex(call => call[0] === name);
    const buffer = target => item.calls.findLastIndex(call => call[0] === 'bindBuffer' && call[1] === target);
    assert.ok(last('bindFramebuffer') < last('drawBuffers'));
    assert.ok(last('bindFramebuffer') < last('readBuffer'));
    assert.ok(last('bindBufferRange') < buffer(item.gl.UNIFORM_BUFFER));
    assert.ok(last('bindSampler') < last('vertexAttrib4fv'));
    assert.ok(last('bindVertexArray') < buffer(item.gl.ARRAY_BUFFER));
    assert.ok(last('useProgram') > last('viewport'));
    assert.ok(last('useProgram') > last('pixelStorei'));
    guard.dispose();
  }
});

test('default framebuffer captures and restores only its selectable draw buffer when indexed queries mirror it', () => {
  for (const selection of ['BACK', 'NONE']) {
    const item = fixture({ mirrorDefaultDrawBuffer: true }); item.gl.drawBuffers([selection]);
    const guard = create(item), before = item.snapshot(); let work = 0;
    guard.run(() => { work++; perturb(item); });
    assert.equal(work, 1); assert.deepEqual(item.snapshot(), before);
    assert.deepEqual(item.calls.filter(call => call[0] === 'getParameter' && (call[1] === 200 || call[1] === 201)), [['getParameter', 200]]);
    assert.deepEqual(item.calls.findLast(call => call[0] === 'drawBuffers'), ['drawBuffers', [selection]]);
    guard.dispose();
  }
});

test('draw routing still rejects an invalid default selection and every invalid framebuffer slot', () => {
  for (const offscreen of [false, true]) {
    const item = fixture({ offscreen }), get = item.gl.getParameter;
    item.gl.getParameter = function (name) {
      const value = get.call(this, name);
      return name === item.gl.DRAW_BUFFER0 + (offscreen ? 1 : 0) ? (offscreen ? item.gl.BACK : item.gl.COLOR_ATTACHMENT0) : value;
    };
    const guard = create(item); let work = 0;
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); guard.dispose();
  }
});

test('terrain-point accepts float targets without image color metadata or color encoding admission', () => {
  for (const colors of [false, true]) {
    const item = fixture({ offscreen: true, colors }); item.colors('display-p3', 'display-p3');
    const guard = create(item), before = item.snapshot();
    assert.equal(guard.run(() => { baseline(item); return 4; }), 4);
    assert.deepEqual(item.snapshot(), before);
    assert.equal(item.calls.some(call => call[0] === 'colorSet' && call[1] === 'drawingBufferColorSpace'), false);
    if (!colors) assert.equal(Object.hasOwn(item.gl, 'unpackColorSpace'), false);
    guard.dispose();
  }
});

test('terrain-point refuses active core and timer queries and active or paused transform feedback', () => {
  for (const name of ['ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE', 'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN', 'TIMER', 'TF', 'PAUSED_TF']) {
    const item = fixture();
    if (name === 'TIMER') item.timer();
    if (name.endsWith('TF')) {
      item.values.set('TRANSFORM_FEEDBACK_ACTIVE', true); item.values.set('TRANSFORM_FEEDBACK_PAUSED', name === 'PAUSED_TF');
    } else item.queries.set(name, handle('active-query'));
    const guard = create(item), before = item.snapshot(); let work = 0;
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
  }
});

test('terrain-point restores live work after throws, thenables, stale predicates and disposal', async () => {
  for (const reason of ['throw', 'thenable', 'stale', 'dispose']) {
    const item = fixture(), guard = create(item), before = item.snapshot(); let error;
    try { guard.run(() => {
      perturb(item);
      if (reason === 'throw') throw new Error('sensitive diagnostic');
      if (reason === 'thenable') return Promise.resolve();
      if (reason === 'stale') item.stale(); else guard.dispose();
    }); } catch (value) { error = value; }
    assert.equal(error instanceof TypeError, true); assert.equal(error.message.includes('sensitive diagnostic'), false);
    await Promise.resolve(); assert.deepEqual(item.snapshot(), before); guard.dispose();
  }
});

test('terrain-point closes entry before calling provider predicates and refuses nested work', () => {
  const item = fixture(); let guard, armed = false, predicates = 0;
  guard = create(item, { isCurrent: () => {
    predicates++;
    if (armed) {
      const count = predicates, raw = item.calls.length;
      assert.throws(() => guard.run(() => assert.fail('nested predicate work')), TypeError);
      assert.equal(predicates, count); assert.equal(item.calls.length, raw);
    }
    return true;
  } }); armed = true;
  guard.run(() => {
    const count = item.calls.length;
    assert.throws(() => guard.run(() => assert.fail('nested work')), TypeError);
    assert.equal(item.calls.length, count);
  }); guard.dispose();
});

test('terrain-point rechecks disposal and staleness after provider callbacks and snapshot', () => {
  for (const reason of ['dispose', 'stale', 'throw', 'capture-stale']) {
    const item = fixture(); let guard, armed = false, work = 0;
    guard = create(item, { isCurrent: () => {
      if (armed && reason === 'dispose') guard.dispose();
      if (armed && reason === 'stale') item.stale();
      if (armed && reason === 'throw') throw new Error('provider diagnostic');
      return item.current();
    } }); armed = true;
    if (reason === 'capture-stale') item.duringGet(name => { if (name === 'TEXTURE_BINDING_3D') item.stale(); });
    const before = item.snapshot();
    assert.throws(() => guard.run(() => { work++; }), TypeError);
    assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
  }
});

test('terrain-point restores temporary active texture changes on live capture failure', () => {
  const item = fixture(), guard = create(item); let failed = false, work = 0;
  item.duringGet(name => {
    if (!failed && name === 'TEXTURE_BINDING_3D' && item.values.get('ACTIVE_TEXTURE') === 100) {
      failed = true; throw new Error('capture failed');
    }
  });
  const before = item.snapshot();
  assert.throws(() => guard.run(() => { work++; }), TypeError);
  assert.equal(work, 0); assert.deepEqual(item.snapshot(), before); guard.dispose();
});

test('terrain-point stops raw operations after loss during capture, work or restoration', () => {
  for (const phase of ['capture', 'work', 'restore']) {
    const item = fixture(), guard = create(item); let lossIndex, work = 0;
    if (phase === 'capture') item.duringGet(name => {
      if (name === 'TEXTURE_BINDING_3D') { item.lose(); lossIndex = item.calls.length; }
    });
    if (phase === 'restore') {
      const bindSampler = item.gl.bindSampler;
      item.gl.bindSampler = function (...args) {
        const result = Reflect.apply(bindSampler, this, args);
        if (args[1]?.name === 'sampler-0') { item.lose(); lossIndex = item.calls.length; }
        return result;
      };
    }
    assert.throws(() => guard.run(() => {
      work++; if (phase === 'work') { item.lose(); lossIndex = item.calls.length; }
    }), TypeError);
    assert.equal(work, phase === 'capture' ? 0 : 1);
    assert.equal(Number.isInteger(lossIndex), true);
    assert.equal(item.calls.slice(lossIndex).some(call => call[0] !== 'isContextLost'), false);
    item.calls.length = 0;
    assert.throws(() => guard.run(() => assert.fail('retired work')), TypeError); guard.dispose();
    assert.equal(item.calls.length, 0);
  }
});

test('terrain-point attempts independent restoration groups after a live setter failure', () => {
  const item = fixture(), guard = create(item); let armed = false;
  const bindSampler = item.gl.bindSampler;
  item.gl.bindSampler = function (...args) {
    if (armed && args[1]?.name === 'sampler-0') throw new Error('restore failed');
    return Reflect.apply(bindSampler, this, args);
  };
  assert.throws(() => guard.run(() => { perturb(item); armed = true; }), TypeError);
  assert.equal(item.values.get('CURRENT_PROGRAM').name, 'native-program');
  assert.equal(item.values.get('VERTEX_ARRAY_BINDING').name, 'native-vao');
  assert.deepEqual(item.values.get('VIEWPORT'), [13, 17, 211, 123]); guard.dispose();
});

test('terrain-point validates its epoch and synchronous callback contract', () => {
  for (const epoch of [0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const item = fixture(); assert.throws(() => create(item, { epoch }), TypeError);
  }
  const item = fixture(), guard = create(item);
  assert.throws(() => guard.run('frame', () => assert.fail('phase overload')), TypeError);
  assert.throws(() => guard.run(null), TypeError); guard.dispose();
  item.calls.length = 0;
  assert.throws(() => guard.run(() => assert.fail('disposed work')), TypeError);
  assert.equal(item.calls.length, 0);
});

function nativeFixture() {
  const item = fixture({ offscreen: true }), { gl } = item, guard = create(item);
  let entered = false, signaled = false, released = 0, completed = 0;
  for (const name of ['RGBA32F', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'NEAREST', 'FRAMEBUFFER_COMPLETE',
    'STREAM_READ', 'RGBA', 'FLOAT', 'SYNC_GPU_COMMANDS_COMPLETE', 'TIMEOUT_EXPIRED', 'CONDITION_SATISFIED']) gl[name] = name;
  const extension = gl.getExtension;
  gl.getExtension = function (name) {
    if (name === 'EXT_color_buffer_float') { assert.equal(entered, true); return {}; }
    return Reflect.apply(extension, this, [name]);
  };
  const operation = (name, callback = () => {}) => {
    gl[name] = function (...args) {
      item.calls.push([name, ...args]);
      assert.equal(this, gl); assert.equal(entered, true, `${name} outside terrain envelope`);
      assert.equal(gl.isContextLost(), false); return callback(...args);
    };
  };
  for (const kind of ['Texture', 'Framebuffer', 'Buffer', 'Sync']) {
    operation(`create${kind}`, () => handle(`owned-${kind}`)); operation(`delete${kind}`);
  }
  for (const name of ['texStorage2D', 'texParameteri', 'framebufferTexture2D', 'copyTexSubImage2D', 'bufferData', 'readPixels', 'flush']) operation(name);
  operation('checkFramebufferStatus', () => gl.FRAMEBUFFER_COMPLETE);
  operation('fenceSync', () => handle('owned-fence'));
  operation('clientWaitSync', (_fence, flags, timeout) => {
    assert.equal(flags, 0); assert.equal(timeout, 0); return signaled ? gl.CONDITION_SATISFIED : gl.TIMEOUT_EXPIRED;
  });
  operation('getBufferSubData', (_target, _offset, output) => { output.set([42, 0, 0, 1]); });
  const service = createTerrainNativeBatch({ gl, withState: work => guard.run(() => {
    assert.equal(entered, false); entered = true;
    try { baseline(item); return work(); } finally { entered = false; }
  }), reserve: () => ({ release() { released++; } }), isCurrent: item.current, now: () => 0,
  requestRender() {}, onComplete(_token, value) { completed++; assert.equal(value.rgba[0], 42); } });
  const native = { renderTerrainHeightMap() {
    assert.equal(entered, true); baseline(item); perturb(item);
  } };
  return { ...item, guard, service, native, batch: () => ({ token: {}, span: .001, points: [[.5, .5]] }),
    signal() { signaled = true; }, released: () => released, completed: () => completed };
}

test('actual native service uses terrain envelope for allocation, hook, fence polls, readback and disposal', () => {
  const item = nativeFixture(), before = item.snapshot();
  assert.equal(item.service.submit(item.batch()), true);
  item.service.prerender(item.native); assert.deepEqual(item.snapshot(), before);
  item.service.prerender(item.native); assert.equal(item.completed(), 0); assert.deepEqual(item.snapshot(), before);
  item.signal(); item.service.prerender({}); assert.equal(item.completed(), 1); assert.deepEqual(item.snapshot(), before);
  item.service.dispose(); assert.equal(item.released(), 1); assert.deepEqual(item.snapshot(), before); item.guard.dispose();
});

test('actual native callback cancellation retires within one terrain lease and restores live state', () => {
  const item = nativeFixture(), before = item.snapshot();
  item.service.submit(item.batch());
  item.service.prerender({ renderTerrainHeightMap() { baseline(item); perturb(item); item.service.cancel(); } });
  assert.equal(item.completed(), 0); assert.equal(item.released(), 1); assert.deepEqual(item.snapshot(), before);
  item.service.dispose(); item.guard.dispose();
});

test('actual native hook context loss prevents all subsequent raw state or deletion calls', () => {
  const item = nativeFixture(); let boundary;
  item.service.submit(item.batch());
  assert.throws(() => item.service.prerender({ renderTerrainHeightMap() {
    baseline(item); item.lose(); boundary = item.calls.length;
  } }));
  item.service.dispose({ contextLost: true }); item.guard.dispose();
  assert.equal(item.completed(), 0); assert.equal(item.released(), 1);
  assert.equal(item.calls.slice(boundary).some(call => call[0] !== 'isContextLost'), false);
});
