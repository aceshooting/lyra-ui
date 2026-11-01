import assert from 'node:assert/strict';
import test from 'node:test';
import { createOwnedGlEpoch } from '../dist/map/owned-gl-context.js';

function fixture(hooks = {}) {
  const calls = [], leases = new Map(), releaseCounts = new Map(); let serial = 0, owner;
  const canvas = { width: 640, height: 480, addEventListener() { assert.fail('Native listener registered'); },
    removeEventListener() { assert.fail('Native listener removed'); }, getContext() { assert.fail('Context created'); } };
  const gl = { canvas, TEXTURE0: 0x84c0, TEXTURE_2D: 0x0de1, TEXTURE_CUBE_MAP: 0x8513,
    TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515, TEXTURE_2D_ARRAY: 0x8c1a, TEXTURE_3D: 0x806f,
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401, TEXTURE_MIN_FILTER: 0x2801, NEAREST: 0x2600, BACK: 0x0405, FRAMEBUFFER: 0x8d40, DRAW_FRAMEBUFFER: 0x8ca9, READ_FRAMEBUFFER: 0x8ca8,
    VIEWPORT: 0x0ba2, VERSION: 0x1f02, MAX_TEXTURE_SIZE: 0x0d33, drawingBufferWidth: 640, drawingBufferHeight: 480,
    drawingBufferColorSpace: 'srgb', unpackColorSpace: 'srgb' };
  for (const method of ['createTexture', 'createFramebuffer', 'deleteTexture', 'deleteFramebuffer', 'bindTexture',
    'bindFramebuffer', 'texImage2D', 'texImage3D', 'activeTexture', 'bindVertexArray', 'useProgram']) {
    gl[method] = function (...args) { assert.equal(this, gl); calls.push({ method, args });
      if (method.startsWith('delete')) hooks.delete?.(method, args[0]);
      return method.startsWith('create') ? { kind: method, id: serial++ } : undefined; };
  }
  gl.getParameter = function (name) { assert.equal(this, gl); calls.push({ method: 'getParameter', args: [name] });
    return name === gl.VERSION ? 'WebGL 2.0' : name === gl.VIEWPORT ? new Int32Array([0, 0, 640, 480]) : 4096; };
  gl.getContextAttributes = function () { assert.equal(this, gl); return { alpha: true, depth: true, stencil: true, antialias: false, premultipliedAlpha: true }; };
  gl.getShaderPrecisionFormat = function () { assert.equal(this, gl); return { precision: 23, rangeMin: 127, rangeMax: 127 }; };
  for (const method of ['texParameteri', 'clearColor', 'clearDepth', 'clearStencil', 'enable', 'disable', 'depthFunc',
    'frontFace', 'cullFace', 'blendEquation', 'blendFunc', 'blendFuncSeparate', 'blendColor', 'colorMask', 'depthMask',
    'stencilMask', 'stencilFunc', 'stencilOp', 'polygonOffset', 'lineWidth', 'scissor', 'viewport', 'pixelStorei', 'drawBuffers', 'readBuffer', 'depthRange']) {
    gl[method] = function (...args) { assert.equal(this, gl); calls.push({ method, args }); };
  }
  for (const method of ['getError', 'clear', 'createBuffer', 'createQuery', 'fenceSync', 'createTransformFeedback']) {
    gl[method] = function (...args) { assert.equal(this, gl); calls.push({ method, args }); return { forbidden: method }; };
  }
  gl.getExtension = function () { calls.push({ method: 'nativeExtension', args: [] }); return { loseContext() { assert.fail('Context lost'); } }; };
  gl.getSupportedExtensions = () => ['WEBGL_lose_context'];
  gl.isContextLost = function () { assert.equal(this, gl); calls.push({ method: 'isContextLost', args: [] }); return false; };
  const lease = (request, callback) => {
    const key = `lease-${serial++}`; callback?.(request, owner); leases.set(key, request);
    return { key, release() { releaseCounts.set(key, (releaseCounts.get(key) ?? 0) + 1); leases.delete(key); hooks.release?.(request, owner); } };
  };
  const budget = { reserveHandle(kind) { return lease({ kind: 'handle', handleKind: kind }, hooks.handle); },
    reservePayload(request) { calls.push({ method: 'reservePayload', args: [request] }); return lease(request, hooks.payload); } };
  let epochCurrent = true, currentHook;
  const isCurrent = () => { currentHook?.(); return epochCurrent; };
  const draw = { borrowed: 'draw' }, read = { borrowed: 'read' };
  const entry = { epoch: 1, target: { draw, read, width: 640, height: 480, viewport: [3, 4, 300, 200], scissor: [5, 6, 90, 80],
    scissorTest: true, drawBuffers: [0x8ce0], readBuffer: 0x8ce0, depthRange: [0.1, 0.9], depthFunc: 0x0203, outputPolicy: 'offscreen-linear-verified' }, isCurrent };
  owner = createOwnedGlEpoch({ epoch: 1, gl, canvas, isCurrent, budget });
  return { owner, gl, canvas, calls, leases, releaseCounts, entry,
    setHook(value) { currentHook = value; }, expire() { epochCurrent = false; } };
}

test('facade forwards with native receiver only in its lease and never exposes native canvas or extensions', () => {
  const f = fixture(); let retained, extracted;
  f.owner.run(f.entry, (gl, canvas) => {
    retained = gl; extracted = gl.getParameter;
    assert.equal(gl.canvas, canvas); assert.notEqual(canvas, f.canvas); assert.notEqual(gl, f.gl);
    assert.deepEqual(gl.getSupportedExtensions(), []);
    for (const name of ['EXT_color_buffer_float', 'WEBGL_clip_cull_distance', 'OES_texture_float_linear',
      'EXT_color_buffer_half_float', 'WEBGL_multisampled_render_to_texture', 'WEBGL_render_shared_exponent',
      'WEBGL_lose_context', 'EXT_clip_control', 'WEBGL_draw_buffers_indexed', 'OES_vertex_array_object']) assert.equal(gl.getExtension(name), null);
    const viewport = gl.getParameter(gl.VIEWPORT); assert.deepEqual([...viewport], [0, 0, 640, 480]); assert.ok(Object.isFrozen(viewport));
    assert.throws(() => { canvas.width = 100; }); assert.throws(() => canvas.getContext('webgl2'));
    assert.equal('setAttribute' in canvas, false);
    assert.throws(() => { canvas.height = 100; }); assert.throws(() => { canvas.style = { width: '1px' }; });
    assert.throws(() => { gl.drawingBufferColorSpace = 'display-p3'; });
    assert.throws(() => gl.clear);
    assert.throws(() => gl.clear(0));
  });
  const count = f.calls.length;
  assert.throws(() => retained.createTexture()); assert.throws(() => extracted(f.gl.MAX_TEXTURE_SIZE));
  assert.equal(f.calls.length, count); assert.equal(f.calls.some(row => row.method === 'nativeExtension'), false);
  f.owner.retire();
});

test('cube storage reserves one complete 24-byte allocation before its first face and reuses it', () => {
  const order = []; const f = fixture({ payload(request) { order.push({ type: 'reserve', request }); } });
  f.owner.run(f.entry, gl => {
    const cube = gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
    for (let face = 0; face < 6; face++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      order.push({ type: 'uploaded', face });
    }
    assert.throws(() => gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)));
    assert.equal(order[0].type, 'reserve'); assert.equal(order.filter(row => row.type === 'reserve').length, 1);
    const request = order[0].request;
    assert.equal(request.kind, 'texture'); assert.equal(request.faces, 6); assert.equal(request.width * request.height * request.layers * request.faces * request.bytesPerPixel, 24);
    assert.equal(request.mipLevels, 1);
    f.owner.sweep();
  });
  assert.equal(f.calls.filter(row => row.method === 'texImage2D').length, 6);
  assert.ok(f.calls.findIndex(row => row.method === 'reservePayload') < f.calls.findIndex(row => row.method === 'texImage2D'));
  assert.equal(f.owner.handles.live.texture, 0); assert.equal(f.leases.size, 0);
  assert.ok([...f.releaseCounts.values()].every(count => count === 1)); f.owner.retire();
});

test('borrowed framebuffer deletion and unowned texture mutation are refused before forwarding', () => {
  const f = fixture();
  f.owner.run(f.entry, gl => {
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f.entry.target.draw);
    assert.throws(() => gl.deleteFramebuffer(f.entry.target.draw));
    assert.throws(() => gl.bindTexture(gl.TEXTURE_2D, { borrowed: true }));
    assert.throws(() => gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, 0, gl.TEXTURE_2D, null, 0));
  });
  assert.equal(f.calls.filter(row => row.method === 'deleteFramebuffer').length, 0); f.owner.retire();
});

test('constructor manifest refuses deferred routes, unknown selectors and texture target changes', () => {
  const f = fixture();
  f.owner.run(f.entry, gl => {
    for (const work of [() => gl.getError(), () => gl.createBuffer(), () => gl.createQuery(), () => gl.fenceSync(0, 0),
      () => gl.createTransformFeedback(), () => gl.enable(0xdead), () => gl.pixelStorei(0xdead, 0), () => gl.getParameter(0xdead)]) assert.throws(work);
    const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
    assert.throws(() => gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture));
    f.owner.sweep();
  });
  assert.equal(f.calls.some(row => ['getError', 'createBuffer', 'createQuery', 'fenceSync', 'createTransformFeedback'].includes(row.method)), false);
  const bindings = f.calls.filter(row => row.method === 'bindTexture' && row.args[1] !== null);
  assert.equal(bindings.length, 1); assert.equal(bindings[0].args[0], f.gl.TEXTURE_2D);
  assert.equal(f.calls.some(row => ['enable', 'pixelStorei', 'getParameter'].includes(row.method) && row.args[0] === 0xdead), false);
  f.owner.retire();
});

test('canvas context listeners remain local and cannot register after terminal cleanup', () => {
  const f = fixture(); let canvas, invoked = 0;
  const listener = () => { invoked++; };
  f.owner.run(f.entry, (_gl, local) => {
    canvas = local;
    local.addEventListener('webglcontextrestored', listener, false);
    local.removeEventListener('webglcontextrestored', listener, false);
    local.addEventListener('webglcontextlost', listener, false);
  });
  f.owner.lose();
  const result = f.owner.retireAfterLoss([
    () => canvas.removeEventListener('webglcontextlost', listener, false),
    () => canvas.addEventListener('webglcontextrestored', listener, false)
  ]);
  assert.equal(result.failed, 1); assert.equal(invoked, 0);
  assert.throws(() => canvas.addEventListener('webglcontextlost', listener, false));
});

test('entering predicates cannot admit nested work or reopen a lost, mismatched or stale entry', () => {
  const f = fixture(); let nestedCalls = 0, admissionStarted = false;
  f.setHook(() => {
    if (admissionStarted) return;
    admissionStarted = true;
    assert.throws(() => f.owner.run(f.entry, () => { nestedCalls++; }));
    f.owner.lose();
  });
  assert.throws(() => f.owner.run(f.entry, () => { nestedCalls++; }));
  assert.equal(nestedCalls, 0); assert.equal(f.calls.some(row => row.method.startsWith('create')), false);
  f.owner.retireAfterLoss([]);
  const other = fixture();
  assert.throws(() => other.owner.run({ ...other.entry, epoch: 2 }, () => { nestedCalls++; }));
  assert.throws(() => other.owner.run({ ...other.entry, isCurrent: () => false }, () => { nestedCalls++; }));
  assert.equal(nestedCalls, 0); assert.equal(other.calls.filter(row => row.method !== 'isContextLost').length, 0); other.owner.retire();
});

test('raw delete failure attempts remaining owners and keeps failed storage live and accounted', () => {
  let failed;
  const f = fixture({ delete(method, handle) { if (method === 'deleteTexture' && handle === failed) throw new Error('Delete refused'); } });
  f.owner.run(f.entry, gl => { failed = gl.createTexture(); gl.createTexture(); });
  assert.throws(() => f.owner.run(f.entry, () => f.owner.sweep()));
  assert.equal(f.calls.filter(row => row.method === 'deleteTexture').length, 2);
  assert.equal(f.owner.handles.deleted.texture, 1); assert.equal(f.owner.handles.live.texture, 1);
  assert.equal(f.leases.size, 1); assert.throws(() => f.owner.retire());
  f.owner.lose(); f.owner.retireAfterLoss([]); assert.equal(f.leases.size, 0);
});

test('reservation and isCurrent reentrancy cannot forward a create after epoch loss', () => {
  for (const route of ['reserve', 'predicate']) {
    const f = fixture(route === 'reserve' ? { handle(_request, owner) { owner.lose(); } } : {});
    assert.throws(() => f.owner.run(f.entry, gl => {
      if (route === 'predicate') f.setHook(() => f.owner.lose());
      gl.createTexture();
    }));
    assert.equal(f.calls.filter(row => row.method === 'createTexture').length, 0);
    assert.equal(f.owner.handles.created.texture, 0); assert.equal(f.owner.handles.invalidatedByLoss.texture, 0);
    if (route === 'reserve') assert.equal(f.releaseCounts.size, 1, 'the returned pre-create lease is retired');
    assert.equal(f.leases.size, 0); f.owner.retireAfterLoss([]);
    assert.ok([...f.releaseCounts.values()].every(count => count === 1));
  }
});

test('first-face payload refusal and reentrant loss never forward storage allocation', () => {
  for (const route of ['refuse', 'lose']) {
    const f = fixture({ payload(_request, owner) { if (route === 'refuse') throw new RangeError('Payload cap'); owner.lose(); } });
    assert.throws(() => f.owner.run(f.entry, gl => {
      const cube = gl.createTexture(); gl.bindTexture(gl.TEXTURE_CUBE_MAP, cube);
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    }));
    assert.equal(f.calls.filter(row => row.method === 'texImage2D').length, 0);
    assert.equal(f.calls.filter(row => row.method === 'createTexture').length, 1);
    if (route === 'refuse') { f.owner.run(f.entry, () => f.owner.sweep()); f.owner.retire(); }
    else f.owner.retireAfterLoss([]);
    assert.equal(f.leases.size, 0);
  }
});

test('lease entry refuses nested work and asynchronous results without reopening forwarding', () => {
  const f = fixture();
  f.owner.run(f.entry, () => assert.throws(() => f.owner.run(f.entry, () => {})));
  assert.throws(() => f.owner.run(f.entry, () => Promise.resolve(1)));
  assert.equal(f.owner.handles.created.texture, 0); f.owner.retire();
});

test('lost cleanup absorbs owned destruction only, with no native call or duplicate cleanup', () => {
  const f = fixture(); let gl, texture;
  f.owner.run(f.entry, context => { gl = context; texture = gl.createTexture(); });
  f.owner.lose(); const count = f.calls.length; let cleanups = 0;
  const result = f.owner.retireAfterLoss([
    () => { cleanups++; gl.deleteTexture(texture); gl.bindTexture(gl.TEXTURE_2D, null); },
    () => { gl.getParameter(gl.VIEWPORT); },
    () => { cleanups++; }
  ]);
  assert.equal(result.failed, 1); assert.equal(cleanups, 2); assert.equal(f.calls.length, count);
  assert.equal(f.owner.handles.invalidatedByLoss.texture, 1); assert.equal(f.owner.handles.deleted.texture, 0);
  f.owner.retireAfterLoss([() => { cleanups++; }]); assert.equal(cleanups, 2);
  assert.equal(f.leases.size, 0); assert.ok([...f.releaseCounts.values()].every(value => value === 1));
});

test('release reentrancy detaches the deleted owner and invalidates remaining pending handles once', () => {
  let triggered = false;
  const f = fixture({ release(request, owner) { if (request.kind === 'handle' && !triggered) { triggered = true; owner.lose(); } } });
  f.owner.run(f.entry, gl => { gl.createTexture(); gl.createTexture(); });
  assert.throws(() => f.owner.run(f.entry, () => f.owner.sweep()));
  assert.equal(f.calls.filter(row => row.method === 'deleteTexture').length, 1);
  assert.equal(f.owner.handles.deleted.texture, 1); assert.equal(f.owner.handles.invalidatedByLoss.texture, 1);
  assert.equal(f.leases.size, 0); assert.ok([...f.releaseCounts.values()].every(value => value === 1));
  f.owner.retireAfterLoss([]);
});

test('reentrant terminal cleanup and live sweep cannot repeat already detached owned work', () => {
  let reentered = false;
  const f = fixture({ release(_request, owner) {
    if (!reentered) { reentered = true; try { owner.sweep(); } catch { /* Nested cleanup may refuse. */ } }
  } });
  f.owner.run(f.entry, gl => { gl.createTexture(); gl.createTexture(); f.owner.sweep(); });
  assert.equal(f.calls.filter(row => row.method === 'deleteTexture').length, 2);
  assert.equal(f.leases.size, 0); assert.ok([...f.releaseCounts.values()].every(value => value === 1)); f.owner.retire();
  const lost = fixture(); let gl, texture, cleanups = 0;
  lost.owner.run(lost.entry, context => { gl = context; texture = gl.createTexture(); }); lost.owner.lose();
  const count = lost.calls.length;
  lost.owner.retireAfterLoss([() => {
    cleanups++;
    try { lost.owner.retireAfterLoss([() => { cleanups++; }]); } catch { /* Reentrant terminal entry may refuse. */ }
    gl.deleteTexture(texture);
  }, () => { cleanups++; }]);
  assert.equal(cleanups, 2); assert.equal(lost.calls.length, count); assert.equal(lost.leases.size, 0);
});

test('callback fences reject texture mutation during budget and predicate admission', () => {
  for (const route of ['payload', 'predicate']) {
    let context, first, second, inHook = false;
    const mutate = () => {
      if (inHook) return;
      inHook = true;
      try {
        assert.throws(() => context.deleteTexture(first));
        assert.throws(() => context.bindTexture(0x0de1, second));
      } finally { inHook = false; }
    };
    const f = fixture(route === 'payload' ? { payload: mutate } : {});
    f.owner.run(f.entry, gl => {
      context = gl; first = gl.createTexture(); second = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, first);
      if (route === 'predicate') f.setHook(mutate);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      f.setHook(undefined); f.owner.sweep();
    });
    const uploads = f.calls.filter(row => row.method === 'texImage2D'); assert.equal(uploads.length, 1);
    const binds = f.calls.filter(row => row.method === 'bindTexture' && row.args[1] !== null);
    assert.equal(binds.length, 1); assert.equal(binds[0].args[1], first); assert.equal(f.leases.size, 0); f.owner.retire();
  }
});

test('framebuffer selections require the currently granted draw and read identities', () => {
  const f = fixture();
  f.owner.run(f.entry, gl => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    assert.throws(() => gl.drawBuffers(f.entry.target.drawBuffers));
    assert.throws(() => gl.readBuffer(f.entry.target.readBuffer));
    gl.drawBuffers([0x0405]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f.entry.target.draw);
    assert.throws(() => gl.drawBuffers([0x0405])); gl.drawBuffers(f.entry.target.drawBuffers);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, f.entry.target.read); gl.readBuffer(f.entry.target.readBuffer);
    const scratch = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, scratch);
    assert.throws(() => gl.drawBuffers(f.entry.target.drawBuffers)); assert.throws(() => gl.readBuffer(f.entry.target.readBuffer));
    f.owner.sweep();
  });
  assert.equal(f.calls.filter(row => row.method === 'drawBuffers').length, 2);
  assert.equal(f.calls.filter(row => row.method === 'readBuffer').length, 1); f.owner.retire();
});

test('canvas facade does not expose inherited object properties', () => {
  const f = fixture();
  f.owner.run(f.entry, (_gl, canvas) => {
    for (const key of ['constructor', 'toString', 'valueOf', '__proto__']) {
      assert.equal(key in canvas, false); assert.throws(() => canvas[key]);
    }
  });
  f.owner.retire();
});

test('release failures persist in handle receipts and terminal cleanup without retries', () => {
  for (const lossFirst of [false, true]) {
    const f = fixture({ release() { throw new Error('Private release diagnostic'); } });
    f.owner.run(f.entry, gl => { gl.createTexture(); gl.createTexture(); });
    if (!lossFirst) {
      assert.throws(() => f.owner.run(f.entry, () => f.owner.sweep()));
      assert.equal(f.owner.handles.deleted.texture, 2); assert.equal(f.owner.handles.live.texture, 0);
      assert.equal(f.owner.handles.releaseFailures, 2); assert.throws(() => f.owner.retire());
    }
    f.owner.lose();
    assert.equal(f.owner.handles.releaseFailures, 2);
    let callbacks = 0;
    const result = f.owner.retireAfterLoss([() => { callbacks++; throw new Error('Private CPU diagnostic'); }, () => { callbacks++; }]);
    assert.equal(result.failed, 3); assert.equal(callbacks, 2);
    assert.equal(f.owner.retireAfterLoss([() => { callbacks++; }]).failed, 3); assert.equal(callbacks, 2);
    assert.equal(f.leases.size, 0); assert.ok([...f.releaseCounts.values()].every(value => value === 1));
  }
});

test('host predicate loss fences the next entry predicate before known-loss native health work', () => {
  const f = fixture(); let entryPredicates = 0;
  f.setHook(() => f.owner.lose());
  const entry = { ...f.entry, isCurrent() { entryPredicates++; return true; } };
  assert.throws(() => f.owner.run(entry, () => assert.fail('Lost work admitted')));
  assert.equal(entryPredicates, 0); assert.equal(f.calls.length, 0); f.owner.retireAfterLoss([]);
});

test('texture parameters require a live owned binding in this entry', () => {
  const f = fixture(); let texture;
  f.owner.run(f.entry, gl => {
    texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); gl.deleteTexture(texture);
    assert.throws(() => gl.texParameteri(gl.TEXTURE_2D, 0x2801, 0x2600));
  });
  f.owner.run(f.entry, gl => { texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture); });
  f.owner.run(f.entry, gl => {
    assert.throws(() => gl.texParameteri(gl.TEXTURE_2D, 0x2801, 0x2600));
    assert.throws(() => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)));
    f.owner.sweep();
  });
  assert.equal(f.calls.filter(row => row.method === 'texParameteri' || row.method === 'texImage2D').length, 0);
  assert.equal(f.leases.size, 0); f.owner.retire();
});
