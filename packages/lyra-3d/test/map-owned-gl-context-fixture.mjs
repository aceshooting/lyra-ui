import assert from 'node:assert/strict';
import { createOwnedGlEpoch } from '../dist/map/owned-gl-context.js';

export function fixture(hooks = {}) {
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

