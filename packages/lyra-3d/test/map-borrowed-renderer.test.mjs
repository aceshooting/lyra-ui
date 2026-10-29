import assert from 'node:assert/strict';
import test from 'node:test';
import * as borrowedRenderer from '../dist/map/borrowed-renderer.js';
const { createBorrowedRendererEpoch } = borrowedRenderer;

function fixture(options = {}) {
  const calls = [], leases = new Map(), releases = new Map(); let serial = 0, creations = 0;
  const canvas = { width: 640, height: 480,
    addEventListener() { assert.fail('Three listener escaped to native canvas'); },
    removeEventListener() { assert.fail('Native canvas listener removed'); }, getContext() { assert.fail('New WebGL context'); } };
  const gl = { canvas, drawingBufferWidth: 640, drawingBufferHeight: 480, drawingBufferColorSpace: 'srgb', unpackColorSpace: 'srgb',
    TEXTURE0: 0x84c0, TEXTURE_2D: 0x0de1, TEXTURE_CUBE_MAP: 0x8513, TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515,
    TEXTURE_CUBE_MAP_NEGATIVE_X: 0x8516, TEXTURE_CUBE_MAP_POSITIVE_Y: 0x8517, TEXTURE_CUBE_MAP_NEGATIVE_Y: 0x8518,
    TEXTURE_CUBE_MAP_POSITIVE_Z: 0x8519, TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851a, TEXTURE_2D_ARRAY: 0x8c1a, TEXTURE_3D: 0x806f,
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, NEAREST: 0x2600,
    FRAMEBUFFER: 0x8d40, DRAW_FRAMEBUFFER: 0x8ca9, READ_FRAMEBUFFER: 0x8ca8, BACK: 0x0405,
    VIEWPORT: 0x0ba2, SCISSOR_BOX: 0x0c10, VERSION: 0x1f02, VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
    HIGH_FLOAT: 0x8df2, MEDIUM_FLOAT: 0x8df1, DEPTH_TEST: 0x0b71, CULL_FACE: 0x0b44, BLEND: 0x0be2,
    POLYGON_OFFSET_FILL: 0x8037, SCISSOR_TEST: 0x0c11, STENCIL_TEST: 0x0b90, SAMPLE_ALPHA_TO_COVERAGE: 0x809e,
    LEQUAL: 0x0203, LESS: 0x0201, CCW: 0x0901, FUNC_ADD: 0x8006, ONE: 1, ZERO: 0, ALWAYS: 0x0207, KEEP: 0x1e00,
    PACK_ALIGNMENT: 0x0d05, UNPACK_ALIGNMENT: 0x0cf5, UNPACK_FLIP_Y_WEBGL: 0x9240,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241, UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243, BROWSER_DEFAULT_WEBGL: 0x9244,
    PACK_ROW_LENGTH: 0x0d02, PACK_SKIP_PIXELS: 0x0d04, PACK_SKIP_ROWS: 0x0d03, UNPACK_ROW_LENGTH: 0x0cf2,
    UNPACK_IMAGE_HEIGHT: 0x806e, UNPACK_SKIP_PIXELS: 0x0cf4, UNPACK_SKIP_ROWS: 0x0cf3, UNPACK_SKIP_IMAGES: 0x806d };
  Object.assign(gl, { MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8b4d, MAX_TEXTURE_IMAGE_UNITS: 0x8872, MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8b4c,
    MAX_TEXTURE_SIZE: 0x0d33, MAX_CUBE_MAP_TEXTURE_SIZE: 0x851c, MAX_VERTEX_ATTRIBS: 0x8869,
    MAX_VERTEX_UNIFORM_VECTORS: 0x8dfb, MAX_VARYING_VECTORS: 0x8dfc, MAX_FRAGMENT_UNIFORM_VECTORS: 0x8dfd,
    MAX_SAMPLES: 0x8d57, SAMPLES: 0x80a9, MAX_UNIFORM_BUFFER_BINDINGS: 0x8a2f });
  Object.assign(gl, { FUNC_SUBTRACT: 0x800a, FUNC_REVERSE_SUBTRACT: 0x800b, MIN: 0x8007, MAX: 0x8008,
    SRC_COLOR: 0x0300, ONE_MINUS_SRC_COLOR: 0x0301, SRC_ALPHA: 0x0302, ONE_MINUS_SRC_ALPHA: 0x0303,
    DST_ALPHA: 0x0304, ONE_MINUS_DST_ALPHA: 0x0305, DST_COLOR: 0x0306, ONE_MINUS_DST_COLOR: 0x0307,
    SRC_ALPHA_SATURATE: 0x0308, CONSTANT_COLOR: 0x8001, ONE_MINUS_CONSTANT_COLOR: 0x8002,
    CONSTANT_ALPHA: 0x8003, ONE_MINUS_CONSTANT_ALPHA: 0x8004, REPEAT: 0x2901, CLAMP_TO_EDGE: 0x812f,
    MIRRORED_REPEAT: 0x8370, LINEAR: 0x2601, NEAREST_MIPMAP_NEAREST: 0x2700, LINEAR_MIPMAP_NEAREST: 0x2701,
    NEAREST_MIPMAP_LINEAR: 0x2702, LINEAR_MIPMAP_LINEAR: 0x2703, NEVER: 0x0200, EQUAL: 0x0202,
    GREATER: 0x0204, NOTEQUAL: 0x0205, GEQUAL: 0x0206 });
  for (const property of ['drawingBufferColorSpace', 'unpackColorSpace']) {
    let value = 'srgb';
    Object.defineProperty(gl, property, { enumerable: true, get() { return value; },
      set(next) { calls.push({ method: `set:${property}`, args: [next] }); value = next; } });
  }
  const draw = options.offscreen ? { native: 'draw' } : null, read = { native: 'read' };
  const state = { draw, read, viewport: [3, 4, 300, 200], scissor: [5, 6, 90, 80], scissorTest: true,
    pbo: { native: 'unpack-buffer' }, sampler: { native: 'sampler' }, rasterizerDiscard: true };
  gl.getContextAttributes = function () { assert.equal(this, gl); return { alpha: true, depth: true, stencil: true, antialias: false, premultipliedAlpha: true }; };
  gl.getParameter = function (name) { assert.equal(this, gl);
    if (name === gl.VERSION) return 'WebGL 2.0';
    if (name === gl.VIEWPORT) return new Int32Array(state.viewport);
    if (name === gl.SCISSOR_BOX) return new Int32Array(state.scissor);
    if (name === gl.MAX_TEXTURE_SIZE || name === gl.MAX_CUBE_MAP_TEXTURE_SIZE) return 4096;
    if (name === gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) return 32;
    if (name === gl.MAX_UNIFORM_BUFFER_BINDINGS) return 24;
    if (name === gl.MAX_VERTEX_UNIFORM_VECTORS) return 256;
    if (name === gl.MAX_FRAGMENT_UNIFORM_VECTORS) return 224;
    if (name === gl.MAX_VARYING_VECTORS) return 15;
    if (name === gl.MAX_SAMPLES) return 4;
    if (name === gl.SAMPLES) return 0;
    return 16;
  };
  gl.getShaderPrecisionFormat = function () { assert.equal(this, gl); return { precision: 23, rangeMin: 127, rangeMax: 127 }; };
  gl.getExtension = () => { assert.fail('Constructor profile must not enable native extensions'); };
  gl.isContextLost = function () { assert.equal(this, gl); calls.push({ method: 'isContextLost', args: [] }); return false; };
  for (const method of ['createTexture', 'createFramebuffer', 'deleteTexture', 'deleteFramebuffer', 'deleteBuffer', 'deleteProgram',
    'deleteShader', 'deleteVertexArray', 'bindTexture', 'texParameteri', 'texImage2D', 'texImage3D', 'clearColor', 'clearDepth',
    'clearStencil', 'enable', 'disable', 'depthFunc', 'frontFace', 'cullFace', 'blendEquation', 'blendFunc', 'blendFuncSeparate',
    'blendColor', 'colorMask', 'depthMask', 'stencilMask', 'stencilFunc', 'stencilOp', 'polygonOffset', 'activeTexture',
    'bindFramebuffer', 'useProgram', 'lineWidth', 'scissor', 'viewport', 'pixelStorei', 'bindVertexArray', 'drawBuffers', 'readBuffer', 'depthRange']) {
    gl[method] = function (...args) {
      assert.equal(this, gl); calls.push({ method, args: args.map(value => Array.isArray(value) ? [...value] : value) });
      if (method.startsWith('create')) {
        if (++creations === options.failCreate) throw new Error('Injected constructor failure');
        return { kind: method, id: serial++ };
      }
      if (method === 'texImage2D' || method === 'texImage3D') {
        assert.equal(state.pbo, null, 'upload baseline clears inherited unpack PBO');
        assert.equal(state.sampler, null, 'upload baseline clears inherited samplers');
        assert.equal(state.rasterizerDiscard, false);
      }
      if (method === 'bindFramebuffer') {
        if (args[0] === gl.FRAMEBUFFER || args[0] === gl.DRAW_FRAMEBUFFER) state.draw = args[1];
        if (args[0] === gl.FRAMEBUFFER || args[0] === gl.READ_FRAMEBUFFER) state.read = args[1];
      }
      if (method === 'viewport') state.viewport = [...args];
      if (method === 'scissor') state.scissor = [...args];
      if (method === 'enable' && args[0] === gl.SCISSOR_TEST) state.scissorTest = true;
      if (method === 'disable' && args[0] === gl.SCISSOR_TEST) state.scissorTest = false;
      return undefined;
    };
  }
  const target = { draw, read, width: 640, height: 480, viewport: [3, 4, 300, 200], scissor: [5, 6, 90, 80],
    scissorTest: true, drawBuffers: [draw ? 0x8ce0 : gl.BACK], readBuffer: 0x8ce0, depthRange: [0.1, 0.9], depthFunc: gl.LEQUAL,
    outputPolicy: options.outputPolicy ?? (draw ? 'offscreen-linear-verified' : 'default-srgb') };
  const operations = []; let current = true, expiredEntryCalls = 0;
  const host = { gl, canvas, isCurrent(epoch) { options.publication?.(); return epoch === 1 && current; }, withThreeState(operation, work) {
    if (operation === 'dispose' && options.refuseRecovery?.()) throw new Error('Private recovery refusal');
    operations.push(operation);
    const saved = { ...state, viewport: [...state.viewport], scissor: [...state.scissor] };
    state.pbo = null; state.sampler = null; state.rasterizerDiscard = false;
    let entryOpen = true;
    try { return work({ epoch: 1, target, isCurrent: () => { if (!entryOpen) expiredEntryCalls++; assert.equal(entryOpen, true, 'entry predicate must remain envelope-local'); return current; } }); }
    finally { entryOpen = false; Object.assign(state, saved); if (operation === 'construct') options.afterConstruct?.(() => { current = false; }); }
  } };
  const lease = request => { const key = `lease-${serial++}`; leases.set(key, request); let retired = false;
    return { key, release() { releases.set(key, (releases.get(key) ?? 0) + 1); assert.equal(retired, false, 'lease releases exactly once'); retired = true; leases.delete(key); } }; };
  let payloadBytes = 0;
  const budget = { reserveHandle(kind) { return lease({ kind: 'handle', handleKind: kind }); }, reservePayload(request) {
    const bytes = request.kind === 'texture' ? request.width * request.height * request.layers * request.faces * request.bytesPerPixel : request.byteLength;
    if (payloadBytes + bytes > (options.payloadCap ?? 36)) throw new RangeError('Payload cap');
    payloadBytes += bytes; calls.push({ method: 'reservePayload', args: [bytes] }); return lease(request);
  } };
  return { host, budget, calls, leases, releases, operations, state, target, canvas, get expiredEntryCalls() { return expiredEntryCalls; }, setCurrent(value) { current = value; }, expire() { current = false; } };
}

test('real pinned Three constructor/reset is borrowed, payload-bounded and fully swept on dispose', () => {
  for (const offscreen of [false, true]) {
    const f = fixture({ offscreen }), original = { ...f.state, viewport: [...f.state.viewport], scissor: [...f.state.scissor] };
    const epoch = createBorrowedRendererEpoch(f.host, f.budget);
    assert.equal(epoch.handles.created.texture, 4); assert.equal(epoch.handles.created.framebuffer, 3);
    assert.equal(f.calls.some(row => row.method === 'set:drawingBufferColorSpace'), false);
    assert.equal(f.calls.filter(row => row.method === 'reservePayload').reduce((sum, row) => sum + row.args[0], 0), 36);
    assert.deepEqual(f.calls.filter(row => row.method === 'reservePayload').map(row => row.args[0]), [4, 24, 4, 4]);
    assert.ok(f.calls.some(row => row.method === 'viewport' && row.args.join(',') === f.target.viewport.join(',')));
    assert.ok(f.calls.some(row => row.method === 'scissor' && row.args.join(',') === f.target.scissor.join(',')));
    assert.ok(f.calls.some(row => row.method === 'bindFramebuffer' && row.args[1] === f.target.read));
    if (offscreen) assert.ok(f.calls.some(row => row.method === 'bindFramebuffer' && row.args[1] === f.target.draw));
    const resetEnd = f.calls.findIndex(row => row.method === 'pixelStorei' && row.args[0] === f.host.gl.UNPACK_SKIP_IMAGES);
    assert.ok(resetEnd >= 0);
    const exitReset = f.calls.findIndex((row, index) => index > resetEnd && row.method === 'disable' && row.args[0] === f.host.gl.BLEND);
    assert.ok(exitReset > resetEnd, 'target setup must complete before the exit reset starts');
    const setup = f.calls.slice(resetEnd + 1, exitReset);
    const bindDraw = setup.findIndex(row => row.method === 'bindFramebuffer' &&
      (row.args[0] === f.host.gl.FRAMEBUFFER || row.args[0] === f.host.gl.DRAW_FRAMEBUFFER) && row.args[1] === f.target.draw);
    const bindRead = setup.findIndex((row, index) => index > bindDraw && row.method === 'bindFramebuffer' &&
      row.args[0] === f.host.gl.READ_FRAMEBUFFER && row.args[1] === f.target.read);
    assert.ok(bindDraw >= 0 && bindRead > bindDraw);
    for (const [method, args] of [['viewport', f.target.viewport], ['scissor', f.target.scissor],
      ['depthRange', f.target.depthRange], ['depthFunc', [f.target.depthFunc]], ['drawBuffers', [f.target.drawBuffers]]]) {
      const index = setup.findIndex((row, index) => index > bindDraw && row.method === method && JSON.stringify(row.args) === JSON.stringify(args));
      assert.ok(index > bindDraw, `${method} must reestablish the granted target after reset`);
    }
    assert.ok(setup.some((row, index) => index > bindRead && row.method === 'readBuffer' && row.args[0] === f.target.readBuffer));
    assert.ok(setup.some((row, index) => index > bindDraw && row.method === 'enable' && row.args[0] === f.host.gl.SCISSOR_TEST));
    assert.deepEqual(f.state, original);
    epoch.dispose(); epoch.dispose();
    assert.deepEqual(f.operations, ['construct', 'dispose']);
    assert.equal(f.leases.size, 0);
    assert.equal(f.calls.filter(row => row.method === 'deleteTexture').length, 4);
    assert.equal(f.calls.filter(row => row.method === 'deleteFramebuffer').length, 3);
    assert.ok(f.calls.filter(row => row.method === 'deleteFramebuffer').every(row => row.args[0] !== f.target.draw && row.args[0] !== f.target.read));
    assert.ok(Object.values(epoch.handles.live).every(value => value === 0));
    assert.deepEqual(f.state, original); assert.deepEqual(f.canvas.width, 640);
  }
});

test('mid-constructor failure and 35-byte cap release every observed fallback resource', () => {
  for (const options of [{ failCreate: 6 }, { payloadCap: 35 }]) {
    const f = fixture(options), original = { ...f.state, viewport: [...f.state.viewport], scissor: [...f.state.scissor] };
    assert.throws(() => createBorrowedRendererEpoch(f.host, f.budget));
    assert.equal(f.leases.size, 0); assert.ok([...f.releases.values()].every(value => value === 1));
    const createdTextures = f.calls.filter(row => row.method === 'createTexture').length;
    assert.equal(f.calls.filter(row => row.method === 'deleteTexture').length, createdTextures);
    const framebufferAttempts = f.calls.filter(row => row.method === 'createFramebuffer').length;
    assert.equal(f.calls.filter(row => row.method === 'deleteFramebuffer').length,
      framebufferAttempts - (options.failCreate ? 1 : 0), 'every successfully returned scratch FBO retires');
    assert.deepEqual(f.state, original);
  }
});

test('loss performs only terminal CPU cleanup and invalidates constructor resources without raw deletes', () => {
  const f = fixture(), epoch = createBorrowedRendererEpoch(f.host, f.budget);
  const count = f.calls.length, operationCount = f.operations.length; epoch.lose(); epoch.lose(); epoch.dispose();
  assert.equal(f.calls.length, count, 'no native query, reset, unbind or delete after known loss');
  assert.equal(f.operations.length, operationCount, 'loss cannot open a native capture/restoration envelope');
  assert.equal(epoch.handles.invalidatedByLoss.texture, 4); assert.equal(epoch.handles.invalidatedByLoss.framebuffer, 3);
  assert.equal(epoch.handles.deleted.texture, 0); assert.equal(epoch.handles.deleted.framebuffer, 0);
  assert.equal(f.leases.size, 0);
});

test('post-envelope constructor failure retains a sanitized owner through admitted or refused recovery', () => {
  for (const initiallyRefused of [false, true]) {
    let refuseRecovery = initiallyRefused, failure;
    const f = fixture({ refuseRecovery: () => refuseRecovery, afterConstruct() { throw new Error('Private native diagnostic'); } });
    try { createBorrowedRendererEpoch(f.host, f.budget); } catch (error) { failure = error; }
    assert.equal(failure?.name, 'BorrowedRendererConstructionError');
    assert.equal(typeof borrowedRenderer.BorrowedRendererConstructionError, 'function');
    assert.ok(failure instanceof borrowedRenderer.BorrowedRendererConstructionError);
    assert.equal(failure.message.includes('Private'), false); assert.equal('cause' in failure, false);
    const recovery = failure.retirement; assert.ok(recovery); assert.equal(Object.isFrozen(recovery), true);
    assert.deepEqual(Object.keys(recovery).sort(), ['dispose', 'handles', 'lose']);
    assert.equal(recovery.handles.live.texture, initiallyRefused ? 4 : 0);
    assert.equal(recovery.handles.live.framebuffer, initiallyRefused ? 3 : 0);
    refuseRecovery = false;
    try { assert.equal(recovery.handles.releaseFailures, 0); } finally { recovery.dispose(); }
    assert.equal(f.leases.size, 0); assert.equal(recovery.handles.releaseFailures, 0); assert.equal(f.expiredEntryCalls, 0);
    assert.ok(Object.values(recovery.handles.live).every(value => value === 0));
  }
});

test('host epoch invalidation after envelope suppresses publication without using expired entry lease', () => {
  let failure;
  const f = fixture({ refuseRecovery: () => true, afterConstruct(expire) { expire(); } });
  try { createBorrowedRendererEpoch(f.host, f.budget); } catch (error) { failure = error; }
  assert.equal(failure?.name, 'BorrowedRendererConstructionError');
    assert.equal(typeof borrowedRenderer.BorrowedRendererConstructionError, 'function');
    assert.ok(failure instanceof borrowedRenderer.BorrowedRendererConstructionError);
  const recovery = failure.retirement;
  assert.equal(recovery.handles.live.texture, 4); assert.equal(recovery.handles.invalidatedByLoss.texture, 0);
  assert.throws(() => recovery.dispose());
  const count = f.calls.length;
  try { recovery.lose(); } finally { recovery.dispose(); }
  assert.equal(f.calls.length, count); assert.equal(recovery.handles.invalidatedByLoss.texture, 4); assert.equal(f.leases.size, 0); assert.equal(f.expiredEntryCalls, 0);
});

test('post-envelope host predicate invalidation cannot publish stale ownership', () => {
  let attempts = 0, failure;
  const f = fixture({ publication() { attempts++; f.expire(); }, refuseRecovery: () => true });
  try { createBorrowedRendererEpoch(f.host, f.budget); } catch (error) { failure = error; }
  assert.equal(failure?.name, 'BorrowedRendererConstructionError');
    assert.equal(typeof borrowedRenderer.BorrowedRendererConstructionError, 'function');
    assert.ok(failure instanceof borrowedRenderer.BorrowedRendererConstructionError); assert.ok(attempts > 0); assert.equal(f.expiredEntryCalls, 0);
  const recovery = failure.retirement;
  try { recovery.lose(); } finally { recovery.dispose(); }
  assert.equal(f.leases.size, 0);
});


test('unsupported offscreen color policy permits constructor target proof without a model draw', () => {
  const f = fixture({ offscreen: true, outputPolicy: 'unsupported' });
  const epoch = createBorrowedRendererEpoch(f.host, f.budget);
  try {
    assert.equal(epoch.handles.created.texture, 4); assert.equal(epoch.handles.created.framebuffer, 3);
    assert.ok(f.calls.some(row => row.method === 'bindFramebuffer' && row.args[1] === f.target.draw));
    assert.equal('render' in epoch, false); assert.equal(f.expiredEntryCalls, 0);
  } finally { epoch.dispose(); }
  assert.equal(f.leases.size, 0);
});


test('failed renderer CPU teardown remains failed across admitted recovery and loss cleanup', () => {
  let armed = false, probes = 0;
  const f = fixture({ publication() { if (armed && ++probes === 2) f.expire(); } });
  const epoch = createBorrowedRendererEpoch(f.host, f.budget);
  armed = true;
  assert.throws(() => epoch.dispose());
  assert.equal(probes >= 2, true, 'invalidation occurs after run admission, in the first listener teardown predicate');
  armed = false; f.setCurrent(true);
  assert.throws(() => epoch.dispose(), 'retry must preserve the original CPU teardown failure');
  assert.ok(Object.values(epoch.handles.live).every(value => value === 0));
  const count = f.calls.length;
  epoch.lose();
  assert.throws(() => epoch.dispose()); assert.throws(() => epoch.dispose());
  assert.equal(f.calls.length, count); assert.equal(f.leases.size, 0); assert.equal(f.expiredEntryCalls, 0);
});
