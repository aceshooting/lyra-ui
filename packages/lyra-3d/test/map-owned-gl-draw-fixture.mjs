import assert from 'node:assert/strict';
import { createOwnedGlEpoch } from '../dist/map/owned-gl-context.js';

export const DRAW_ENUMS = Object.freeze({
  ARRAY_BUFFER: 0x8892, ELEMENT_ARRAY_BUFFER: 0x8893, STATIC_DRAW: 0x88e4, BUFFER_SIZE: 0x8764,
  FLOAT: 0x1406, UNSIGNED_INT: 0x1405, UNSIGNED_SHORT: 0x1403, UNSIGNED_BYTE: 0x1401,
  TRIANGLES: 0x0004, LINES: 0x0001, VERTEX_SHADER: 0x8b31, FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81, LINK_STATUS: 0x8b82, ACTIVE_UNIFORMS: 0x8b86, ACTIVE_ATTRIBUTES: 0x8b89,
  FLOAT_VEC2: 0x8b50, FLOAT_VEC3: 0x8b51, FLOAT_VEC4: 0x8b52,
  FLOAT_MAT2: 0x8b5a, FLOAT_MAT3: 0x8b5b, FLOAT_MAT4: 0x8b5c, CW: 0x0900, CCW: 0x0901,
  INT: 0x1404, BOOL: 0x8b56, MAX_VERTEX_ATTRIBS: 0x8869,
  FRAMEBUFFER: 0x8d40, DRAW_FRAMEBUFFER: 0x8ca9, READ_FRAMEBUFFER: 0x8ca8,
  BACK: 0x0405, COLOR_ATTACHMENT0: 0x8ce0, LEQUAL: 0x0203, LESS: 0x0201,
  TEXTURE0: 0x84c0, TEXTURE_2D: 0x0de1, TEXTURE_CUBE_MAP: 0x8513,
  TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515, TEXTURE_2D_ARRAY: 0x8c1a, TEXTURE_3D: 0x806f,
  RGBA: 0x1908, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, NEAREST: 0x2600,
  SCISSOR_TEST: 0x0c11, DEPTH_TEST: 0x0b71, VIEWPORT: 0x0ba2, SCISSOR_BOX: 0x0c10, VERSION: 0x1f02,
});

export const DRAW_METHODS = Object.freeze([
  'createBuffer', 'deleteBuffer', 'bindBuffer', 'bufferData', 'bufferSubData', 'getBufferParameter',
  'createVertexArray', 'deleteVertexArray', 'bindVertexArray', 'enableVertexAttribArray',
  'disableVertexAttribArray', 'vertexAttribPointer', 'vertexAttribDivisor',
  'createShader', 'deleteShader', 'shaderSource', 'compileShader', 'getShaderParameter', 'getShaderInfoLog',
  'createProgram', 'deleteProgram', 'attachShader', 'linkProgram',
  'getProgramParameter', 'getProgramInfoLog', 'useProgram',
  'getActiveUniform', 'getUniformLocation', 'getActiveAttrib', 'getAttribLocation', 'bindAttribLocation',
  'uniform1f', 'uniform2f', 'uniform3f', 'uniform4f',
  'uniform1fv', 'uniform2fv', 'uniform3fv', 'uniform4fv', 'uniform1i', 'uniform1iv',
  'uniformMatrix3fv', 'uniformMatrix4fv', 'drawElements',
]);

const vertexSource = 'attribute vec3 position; uniform mat4 matrix; void main(){gl_Position=matrix*vec4(position,1.0);}';
const fragmentSource = 'precision highp float; uniform vec4 color; void main(){gl_FragColor=color;}';

/** A recording driver, not a pixel renderer or native projection authority. */
export function createDrawFixture(options = {}) {
  const calls = [], leases = new Map(), releases = new Map(), bufferSizes = new Map();
  const bufferBindings = new Map(), elementBindings = new Map(), programs = new Map(), shaders = new Map();
  let serial = 0, current = true, vao = null, draw = null, read = null, program = null, bytes = 0, peakBytes = 0;
  const canvas = { width: 640, height: 480 };
  const gl = { ...DRAW_ENUMS, canvas, drawingBufferWidth: 640, drawingBufferHeight: 480,
    drawingBufferColorSpace: 'srgb', unpackColorSpace: 'srgb' };
  const f = { gl, canvas, calls, leases, releases, bufferSizes,
    get bytes() { return bytes; }, get peakBytes() { return peakBytes; },
    get nativeProgram() { return program; }, get nativeVao() { return vao; },
    expire() { current = false; }, setCurrent(value) { current = value; },
    callsOf(method) { return calls.filter(call => call.method === method); },
    makeEntry(change = {}) {
      return { epoch: 1, isCurrent: () => current, target: {
        draw: null, read: null, width: 640, height: 480, viewport: [3, 4, 300, 200],
        scissor: [5, 6, 90, 80], scissorTest: true, drawBuffers: [gl.BACK], readBuffer: gl.BACK,
        depthRange: [0.1, 0.9], depthFunc: gl.LEQUAL, outputPolicy: 'default-srgb', ...change,
      } };
    },
  };
  const record = (method, args) => { calls.push({ method, args, bytes }); options.before?.(method, args, f); };
  const boundBuffer = target => target === gl.ELEMENT_ARRAY_BUFFER ? elementBindings.get(vao) : bufferBindings.get(target);
  const uniforms = options.uniforms ?? [
    { name: 'matrix', type: gl.FLOAT_MAT4, size: 1 }, { name: 'color', type: gl.FLOAT_VEC4, size: 1 },
  ];
  const attributes = options.attributes ?? [{ name: 'position', type: gl.FLOAT_VEC3, size: 1 }];
  const methods = [...DRAW_METHODS, 'createTexture', 'deleteTexture', 'createFramebuffer', 'deleteFramebuffer',
    'bindFramebuffer', 'drawBuffers', 'readBuffer', 'viewport', 'scissor', 'enable', 'disable',
    'depthRange', 'depthFunc', 'frontFace', 'getParameter', 'isContextLost', 'clear', 'getError',
    'createQuery', 'fenceSync', 'createTransformFeedback', 'drawElementsInstanced', 'copyBufferSubData', 'drawArrays', 'detachShader'];
  for (const method of methods) {
    gl[method] = function (...args) {
      assert.equal(this, gl, `${method} must retain the native receiver`);
      record(method, args);
      let result;
      if (method.startsWith('create')) {
        result = options.nullCreate === method ? null : Object.freeze({ kind: method, id: serial++ });
        if (result && method === 'createShader') shaders.set(result, { compiled: false });
        if (result && method === 'createProgram') programs.set(result, { linked: false, generation: 0, locations: new Map() });
      } else if (method === 'bindBuffer') {
        if (args[0] === gl.ELEMENT_ARRAY_BUFFER) elementBindings.set(vao, args[1]); else bufferBindings.set(args[0], args[1]);
      } else if (method === 'bindVertexArray') vao = args[0];
      else if (method === 'useProgram') program = args[0];
      else if (method === 'bindFramebuffer') {
        if (args[0] === gl.FRAMEBUFFER || args[0] === gl.DRAW_FRAMEBUFFER) draw = args[1];
        if (args[0] === gl.FRAMEBUFFER || args[0] === gl.READ_FRAMEBUFFER) read = args[1];
      } else if (method === 'bufferData') {
        const outcome = options.bufferDataOutcome?.(args, f);
        if (outcome === 'throw') throw new Error('Driver allocation outcome unknown');
        if (outcome !== 'ignore') {
          const source = args[1];
          bufferSizes.set(boundBuffer(args[0]), typeof source === 'number' ? source : source.byteLength);
        }
      } else if (method === 'getBufferParameter') result = bufferSizes.get(boundBuffer(args[0])) ?? 0;
      else if (method === 'compileShader') shaders.get(args[0]).compiled = options.compileOk !== false;
      else if (method === 'getShaderParameter') result = shaders.get(args[0])?.compiled ?? false;
      else if (method === 'getShaderInfoLog') result = options.compileOk === false ? 'fixture compile failure' : '';
      else if (method === 'linkProgram') {
        const state = programs.get(args[0]); state.linked = options.linkOk !== false; state.generation++; state.locations.clear();
      } else if (method === 'getProgramParameter') {
        result = args[1] === gl.LINK_STATUS ? programs.get(args[0])?.linked ?? false :
          args[1] === gl.ACTIVE_UNIFORMS ? uniforms.length : args[1] === gl.ACTIVE_ATTRIBUTES ? attributes.length : 0;
      } else if (method === 'getProgramInfoLog') result = options.linkOk === false ? 'fixture link failure' : '';
      else if (method === 'getActiveUniform') result = uniforms[args[1]] ? { ...uniforms[args[1]] } : null;
      else if (method === 'getActiveAttrib') result = attributes[args[1]] ? { ...attributes[args[1]] } : null;
      else if (method === 'getAttribLocation') result = attributes.findIndex(value => value.name === args[1]);
      else if (method === 'getUniformLocation') {
        const state = programs.get(args[0]);
        if (!uniforms.some(value => value.name === args[1])) result = null;
        else {
          if (!state.locations.has(args[1])) state.locations.set(args[1], Object.freeze({ program: args[0], generation: state.generation, name: args[1] }));
          result = state.locations.get(args[1]);
        }
      } else if (method === 'getParameter') result = args[0] === gl.MAX_VERTEX_ATTRIBS ? 16 : args[0] === gl.VERSION ? 'WebGL 2.0' : 0;
      else if (method === 'isContextLost') result = false;
      options.after?.(method, args, f);
      return result;
    };
  }
  const lease = request => {
    const size = request.kind === 'bytes' ? request.byteLength : 0;
    if (size > (options.cap ?? Number.MAX_SAFE_INTEGER) - bytes) throw new RangeError('Graphics payload cap');
    const key = `lease-${serial++}`;
    leases.set(key, request); bytes += size; peakBytes = Math.max(peakBytes, bytes);
    return { release() {
      releases.set(key, (releases.get(key) ?? 0) + 1);
      assert.equal(releases.get(key), 1, 'reservation released more than once');
      leases.delete(key); bytes -= size; calls.push({ method: 'release', args: [request], bytes });
      options.release?.(request, f);
    } };
  };
  const budget = {
    reserveHandle(kind) {
      calls.push({ method: 'reserveHandle', args: [kind], bytes }); options.handle?.(kind, f);
      return lease({ kind: 'handle', handleKind: kind });
    },
    reservePayload(request) {
      calls.push({ method: 'reservePayload', args: [request], bytes }); options.payload?.(request, f);
      return lease(request);
    },
  };
  const profile = Object.hasOwn(options, 'profile') ? options.profile : 'model-draw';
  f.entry = f.makeEntry();
  f.owner = createOwnedGlEpoch({ epoch: 1, gl, canvas, isCurrent: () => current, budget,
    ...(profile === undefined ? {} : { profile }) });
  f.targetState = () => ({ draw, read });
  return f;
}

export function uploadBuffer(gl, target, data) {
  const buffer = gl.createBuffer(); gl.bindBuffer(target, buffer); gl.bufferData(target, data, gl.STATIC_DRAW); return buffer;
}

export function createProgram(gl) {
  const vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(vertex, vertexSource); gl.compileShader(vertex);
  gl.shaderSource(fragment, fragmentSource); gl.compileShader(fragment);
  const program = gl.createProgram(); gl.attachShader(program, vertex); gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, 'position'); gl.linkProgram(program);
  assert.equal(gl.getProgramParameter(program, gl.LINK_STATUS), true);
  gl.useProgram(program);
  return { program, vertex, fragment };
}

export function applyTarget(gl, target) {
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.draw); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, target.read);
  gl.drawBuffers([...target.drawBuffers]); gl.readBuffer(target.readBuffer);
  gl.viewport(...target.viewport); gl.scissor(...target.scissor);
  if (target.scissorTest) gl.enable(gl.SCISSOR_TEST); else gl.disable(gl.SCISSOR_TEST);
  gl.depthRange(...target.depthRange); gl.depthFunc(target.depthFunc);
}

export function prepareTriangle(gl, entry, options = {}) {
  const linked = createProgram(gl), vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vertices = uploadBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(options.vertices ?? [0, 0, 0, 1, 0, 0, 0, 1, 0]));
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
  const indices = uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(options.indices ?? [0, 1, 2]));
  applyTarget(gl, entry.target);
  return { ...linked, vao, vertices, indices };
}

export function retireFixture(f) {
  f.owner.run(f.entry, () => f.owner.sweep()); f.owner.retire();
  assert.equal(f.leases.size, 0); assert.equal(f.bytes, 0);
  assert.ok([...f.releases.values()].every(count => count === 1));
}
