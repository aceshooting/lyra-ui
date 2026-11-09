import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './map-owned-gl-context-fixture.mjs';

for (const method of ['createTexture', 'createFramebuffer']) {
  for (const result of [null, 1, () => {}]) {
    test(`${method} rejects a non-handle result and releases its reservation once`, () => {
      const f = fixture(); f.gl[method] = () => result;
      assert.throws(() => f.owner.run(f.entry, gl => gl[method]()));
      assert.equal(f.leases.size, 0); assert.deepEqual([...f.releaseCounts.values()], [1]);
      assert.equal(Object.values(f.owner.handles.created).reduce((a, b) => a + b), 0);
      f.owner.retire();
    });
  }

  test(`${method} retires a handle returned after synchronous context loss without double release`, () => {
    const f = fixture(); f.gl[method] = () => { f.owner.lose(); return {}; };
    assert.throws(() => f.owner.run(f.entry, gl => gl[method]()));
    const kind = method === 'createTexture' ? 'texture' : 'framebuffer';
    assert.equal(f.owner.handles.created[kind], 1); assert.equal(f.owner.handles.live[kind], 0);
    assert.equal(f.owner.handles.invalidatedByLoss[kind], 1);
    assert.equal(f.leases.size, 0); assert.deepEqual([...f.releaseCounts.values()], [1]);
    f.owner.retireAfterLoss([]);
  });
}

test('a missing native method cannot leak its preallocated handle budget', () => {
  const f = fixture(); delete f.gl.createTexture;
  assert.throws(() => f.owner.run(f.entry, gl => gl.createTexture()));
  assert.equal(f.leases.size, 0); assert.deepEqual([...f.releaseCounts.values()], [1]);
  f.owner.retire();
});

for (const [name, value] of [['null', null], ['scalar', 4], ['missing length', {}], ['short', [0, 0, 640]],
  ['fractional', [0, 0, 1.5, 480]], ['nonfinite', [0, 0, Infinity, 480]], ['string member', [0, 0, '640', 480]]]) {
  test(`viewport readback rejects ${name} output and admits a later valid snapshot`, () => {
    const f = fixture(), original = f.gl.getParameter;
    f.gl.getParameter = () => value;
    f.owner.run(f.entry, gl => {
      assert.throws(() => gl.getParameter(gl.VIEWPORT));
      f.gl.getParameter = original;
      const viewport = gl.getParameter(gl.VIEWPORT);
      assert.deepEqual(viewport, [0, 0, 640, 480]); assert.ok(Object.isFrozen(viewport));
    });
    f.owner.retire();
  });
}

test('scalar readbacks reject native objects and expose only copied finite context fields', () => {
  const f = fixture();
  Object.assign(f.gl, { VERTEX_SHADER: 0x8b31, HIGH_FLOAT: 0x8df2 });
  f.owner.run(f.entry, gl => {
    f.gl.getParameter = () => ({});
    assert.throws(() => gl.getParameter(gl.MAX_TEXTURE_SIZE));
    for (const value of [null, { alpha: 'true' }, { depth: Infinity }]) {
      f.gl.getContextAttributes = () => value;
      assert.throws(() => gl.getContextAttributes());
    }
    for (const value of [null, { precision: NaN }, { rangeMin: '127' }]) {
      f.gl.getShaderPrecisionFormat = () => value;
      assert.throws(() => gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT));
    }
    assert.throws(() => gl.getShaderPrecisionFormat(0, gl.HIGH_FLOAT));
    assert.throws(() => gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, 0));
    const raw = { alpha: true, depth: false, ignored: {} };
    f.gl.getContextAttributes = () => raw;
    const copy = gl.getContextAttributes(); raw.alpha = false;
    assert.deepEqual(copy, { alpha: true, depth: false }); assert.ok(Object.isFrozen(copy));
    f.gl.getShaderPrecisionFormat = () => ({ precision: 23, rangeMin: 127, rangeMax: 127, ignored: {} });
    assert.deepEqual(gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT), { precision: 23, rangeMin: 127, rangeMax: 127 });
  });
  f.owner.retire();
});

test('invalid scalar and binding arguments cannot reach the native context', () => {
  const f = fixture();
  f.owner.run(f.entry, gl => {
    const baseline = f.calls.length;
    for (const action of [() => gl.getExtension(1), () => gl.getExtension('x'.repeat(257)),
      () => gl.bindTexture(0, null), () => gl.bindTexture(gl.TEXTURE_2D, 1),
      () => gl.bindFramebuffer(0, null), () => gl.activeTexture(gl.TEXTURE0 + 1),
      () => gl.useProgram({}), () => gl.bindVertexArray({}),
      () => gl.viewport(0, 0, NaN, 20), () => gl.clearColor(0, 0, 0, '1')]) assert.throws(action);
    assert.equal(f.calls.length, baseline);
    gl.deleteTexture(null); gl.deleteFramebuffer(null);
    assert.equal(f.calls.length, baseline);
    gl.bindTexture(gl.TEXTURE_2D, null);
    assert.equal(f.calls.at(-1).method, 'bindTexture');
  });
  f.owner.retire();
});

test('pixel storage admits only each selector’s declared scalar domain', () => {
  const f = fixture();
  Object.assign(f.gl, { PACK_ALIGNMENT: 0x0d05, UNPACK_ALIGNMENT: 0x0cf5, UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241, UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243, BROWSER_DEFAULT_WEBGL: 0x9244,
    UNPACK_ROW_LENGTH: 0x0cf2, UNPACK_SKIP_ROWS: 0x0cf3 });
  const cases = [
    ['PACK_ALIGNMENT', [1, 2, 4, 8], [0, 3, 1.5, '4']],
    ['UNPACK_FLIP_Y_WEBGL', [false, true, 0, 1], [-1, 2, 'false']],
    ['UNPACK_PREMULTIPLY_ALPHA_WEBGL', [false, true, 0, 1], [null, 2]],
    ['UNPACK_COLORSPACE_CONVERSION_WEBGL', [0, f.gl.BROWSER_DEFAULT_WEBGL], [-1, 1]],
    ['UNPACK_ROW_LENGTH', [0, 1, 200], [-1, 0.5, Infinity, '2']],
  ];
  f.owner.run(f.entry, gl => {
    for (const [selector, valid, invalid] of cases) {
      const baseline = f.calls.filter(row => row.method === 'pixelStorei').length;
      for (const value of invalid) assert.throws(() => gl.pixelStorei(gl[selector], value));
      assert.equal(f.calls.filter(row => row.method === 'pixelStorei').length, baseline);
      for (const value of valid) gl.pixelStorei(gl[selector], value);
      assert.equal(f.calls.filter(row => row.method === 'pixelStorei').length, baseline + valid.length);
    }
  });
  f.owner.retire();
});

test('texture upload rejects malformed dimensions, formats and storage before reserving payload', () => {
  const f = fixture();
  f.owner.run(f.entry, gl => {
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    const valid = [gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)];
    for (const [index, value] of [[0, 0], [1, 1], [2, 0], [3, 2], [4, 0], [5, 1], [6, 0], [7, 0], [8, new Uint8Array(3)], [8, new Float32Array(4)]]) {
      const args = [...valid]; args[index] = value;
      assert.throws(() => gl.texImage2D(...args));
    }
    assert.throws(() => gl.texImage2D(...valid, 0));
    assert.equal(f.calls.filter(row => row.method === 'reservePayload').length, 0);
    assert.equal(f.calls.filter(row => row.method === 'texImage2D').length, 0);
    delete f.gl.TEXTURE_CUBE_MAP_POSITIVE_X;
    gl.texImage2D(...valid);
    assert.equal(f.calls.filter(row => row.method === 'texImage2D').length, 1);
    f.owner.sweep();
  });
  assert.equal(f.leases.size, 0); f.owner.retire();
});

test('lost cleanup allows only owned destruction and null bindings and never forwards native work', () => {
  const f = fixture(); let context, texture;
  f.owner.run(f.entry, gl => { context = gl; texture = gl.createTexture(); });
  f.owner.lose(); const baseline = f.calls.length;
  const result = f.owner.retireAfterLoss([() => {
    assert.equal(context.isContextLost(), true);
    context.deleteTexture(texture); context.deleteTexture(null);
    context.useProgram(null); context.bindVertexArray(null); context.bindTexture(f.gl.TEXTURE_2D, null);
    for (const action of [() => context.deleteTexture({}), () => context.deleteFramebuffer(texture),
      () => context.deleteTexture(1), () => context.useProgram({}), () => context.bindTexture(f.gl.TEXTURE_2D, texture)]) assert.throws(action);
  }]);
  assert.equal(result.failed, 0); assert.equal(f.calls.length, baseline); assert.equal(f.leases.size, 0);
});

test('facade metadata exposes immutable allocation while native color spaces remain lease-bound', () => {
  const f = fixture(); let retained;
  f.owner.run(f.entry, gl => {
    retained = gl;
    assert.equal(gl.drawingBufferWidth, 640); assert.equal(gl.drawingBufferHeight, 480);
    assert.equal(gl.drawingBufferColorSpace, 'srgb'); assert.equal(gl.unpackColorSpace, 'srgb');
    gl.drawingBufferColorSpace = 'srgb';
    assert.throws(() => gl[Symbol.toStringTag]);
    assert.throws(() => Object.defineProperty(gl, 'injected', { value: true }));
    assert.throws(() => { delete gl.canvas; });
  });
  assert.throws(() => retained.unpackColorSpace); f.owner.retire();
});
