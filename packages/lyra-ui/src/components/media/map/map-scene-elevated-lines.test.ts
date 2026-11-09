import { expect, waitUntil } from '@open-wc/testing';
import type { LyraMapCustomLayerContext, LyraMapCustomLayerFrame, LyraMapGeographicShader,
  LyraMapResolvedPosition } from '../../../internal/map-custom-layer-types.js';
import { createElevatedSceneLineLayer, type ElevatedSceneLine } from './map-scene-elevated-lines.js';

const origin = { key: 'world', tile: { z: 0, x: 0, y: 0, wrap: 0 } };
const shader: LyraMapGeographicShader = {
  key: 'test', defines: '', positionEncoding: 'tile-xy-meters-z', projectFunction: 'lrProjectPosition',
  horizonPositionFunction: 'lrHorizonPosition', horizonOccludedFunction: 'lrHorizonOccluded', horizonMode: 'none',
  vertexPrelude: `vec4 lrProjectPosition(vec3 p) { return vec4(p.x / 4096.0 - 1.0, p.z / 100.0 - 0.5, 0.0, 1.0); }
    vec3 lrHorizonPosition(vec3 p) { return p; }`,
  fragmentPrelude: 'bool lrHorizonOccluded(vec3 p) { return false; }', uniforms: [],
};
const line = (id: string, terrain: readonly number[] = [1, 0, 0.5]): ElevatedSceneLine => ({
  id, coordinates: [[-90, 0, 10], [0, 0, 20], [90, 0, 30]], terrain, rgba: [1, 0, 0, 1], width: 4,
});

before(function () {
  // Headless Firefox can lack a WebGL driver even when WebGL is enabled in its preferences.
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) this.skip();
  gl.getExtension('WEBGL_lose_context')?.loseContext();
});

function environment() {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('Elevated-line tests require WebGL2');
  const uploads: number[][] = [], shaders: WebGLShader[] = [], programs: WebGLProgram[] = [];
  const buffers: WebGLBuffer[] = [], arrays: WebGLVertexArrayObject[] = [];
  const deleted = new Set<WebGLShader | WebGLProgram | WebGLBuffer | WebGLVertexArrayObject>();
  let draws = 0, queries = 0;
  let status: LyraMapResolvedPosition['status'] = 'resolved', altitude = 40;
  const upload = gl.bufferData;
  gl.bufferData = function (...args: Parameters<typeof upload>) {
    if (args[1] instanceof Float32Array) uploads.push(Array.from(args[1]));
    Reflect.apply(upload, gl, args);
  } as typeof upload;
  const draw = gl.drawArrays;
  gl.drawArrays = (...args) => { draws++; draw.apply(gl, args); };
  const createShader = gl.createShader, createProgram = gl.createProgram;
  const createBuffer = gl.createBuffer, createArray = gl.createVertexArray;
  gl.createShader = type => { const value = createShader.call(gl, type); if (value) shaders.push(value); return value; };
  gl.createProgram = () => { const value = createProgram.call(gl); if (value) programs.push(value); return value; };
  gl.createBuffer = () => { const value = createBuffer.call(gl); if (value) buffers.push(value); return value; };
  gl.createVertexArray = () => { const value = createArray.call(gl); if (value) arrays.push(value); return value; };
  const deleteShader = gl.deleteShader, deleteProgram = gl.deleteProgram;
  const deleteBuffer = gl.deleteBuffer, deleteArray = gl.deleteVertexArray;
  gl.deleteShader = value => { if (value) deleted.add(value); deleteShader.call(gl, value); };
  gl.deleteProgram = value => { if (value) deleted.add(value); deleteProgram.call(gl, value); };
  gl.deleteBuffer = value => { if (value) deleted.add(value); deleteBuffer.call(gl, value); };
  gl.deleteVertexArray = value => { if (value) deleted.add(value); deleteArray.call(gl, value); };
  const resolve: LyraMapCustomLayerFrame['geographic']['resolve'] = position => {
    queries++;
    return status === 'resolved' ? { lngLat: position.lngLat, status, altitude } : { lngLat: position.lngLat, status };
  };
  const context: LyraMapCustomLayerContext = {
    gl, signal: new AbortController().signal, requestRender() {}, reportState() {},
    geographic: { limits: {}, resolve, frameFor: () => origin, fromEnu() { throw new Error('Unexpected ENU conversion'); } },
  };
  const frame = (revision: number): LyraMapCustomLayerFrame => ({
    revision, time: revision, width: 64, height: 64, pixelRatio: 1, reducedMotion: true,
    geographic: { resolve, shader: () => shader,
      project() { throw new Error('Unexpected CPU projection'); }, encode() { throw new Error('Unexpected CPU encoding'); } },
  });
  return { gl, context, frame, uploads, shaders, programs, buffers, arrays, deleted,
    get draws() { return draws; }, get queries() { return queries; },
    terrain(value: LyraMapResolvedPosition['status'], height = 40) { status = value; altitude = height; },
    close() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
type Environment = ReturnType<typeof environment>;

function expectReleased(env: Environment): void {
  expect([...env.shaders, ...env.programs, ...env.buffers, ...env.arrays].filter(value => !env.deleted.has(value)).length,
    'every allocation, including unbound objects, was deleted').to.equal(0);
  // The map bridge restores GL bindings around callbacks. Release this test's current program
  // too: WebGL defers deletion of a bound program and its attached shaders until it is unbound.
  env.gl.useProgram(null);
  expect(env.shaders.filter(value => env.gl.isShader(value)).length, 'live shaders').to.equal(0);
  expect(env.programs.filter(value => env.gl.isProgram(value)).length, 'live programs').to.equal(0);
  expect(env.buffers.filter(value => env.gl.isBuffer(value)).length, 'live vertex buffers').to.equal(0);
  expect(env.arrays.filter(value => env.gl.isVertexArray(value)).length, 'live vertex arrays').to.equal(0);
}

function expectPainted(gl: WebGL2RenderingContext): void {
  const pixels = new Uint8Array(64 * 64 * 4);
  gl.readPixels(0, 0, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  expect(pixels.some(value => value !== 0), 'the native framebuffer contains a rendered path').to.equal(true);
  expect(gl.getError()).to.equal(gl.NO_ERROR);
}

it('waits for terrain, skips zero-weight samples, and invalidates only terrain-dependent vertices', () => {
  const env = environment();
  const layer = createElevatedSceneLineLayer('paths', [line('terrain'), line('absolute', [0, 0, 0])]).create(env.context);
  try {
    env.terrain('terrain-pending'); layer.render(env.frame(1));
    expect(env.uploads.length).to.equal(1);
    expect(env.draws).to.equal(1);
    expect(env.queries).to.equal(1);
    env.terrain('resolved', 40); layer.render(env.frame(1));
    expect(env.uploads.length).to.equal(2);
    expect(env.draws).to.equal(3);
    expect(env.queries).to.equal(3);
    expect([env.uploads[1]![2], env.uploads[1]![5], env.uploads[1]![13 * 6 + 5]]).to.deep.equal([50, 20, 50]);
    layer.render(env.frame(1));
    expect(env.uploads.length).to.equal(2); expect(env.queries).to.equal(3);
    env.terrain('terrain-pending'); layer.render(env.frame(2));
    expect(env.uploads.length).to.equal(2);
    expect(env.draws).to.equal(6, 'the terrain path stops drawing stale heights while the new terrain is pending');
    env.terrain('resolved', 100); layer.render(env.frame(2));
    expect(env.uploads.length).to.equal(3);
    expect([env.uploads[2]![2], env.uploads[2]![5], env.uploads[2]![13 * 6 + 5]]).to.deep.equal([110, 20, 80]);
    expect(env.draws).to.equal(8);
    expectPainted(env.gl);
    layer.dispose(); expectReleased(env);
    layer.render(env.frame(3)); layer.dispose();
    expect(env.draws).to.equal(8);
  } finally { layer.dispose(); env.close(); }
});

it('falls back to sea level when terrain is unavailable and rebuilds when terrain arrives', () => {
  const env = environment();
  const layer = createElevatedSceneLineLayer('paths', [line('terrain')]).create(env.context);
  try {
    env.terrain('terrain-unavailable'); layer.render(env.frame(1));
    expect(env.uploads.length).to.equal(1);
    expect([env.uploads[0]![2], env.uploads[0]![5], env.uploads[0]![13 * 6 + 5]]).to.deep.equal([10, 20, 30]);
    env.terrain('resolved', 20); layer.render(env.frame(2));
    expect(env.uploads.length).to.equal(2);
    expect([env.uploads[1]![2], env.uploads[1]![5], env.uploads[1]![13 * 6 + 5]]).to.deep.equal([30, 20, 40]);
    expectPainted(env.gl);
    layer.dispose(); expectReleased(env);
  } finally { layer.dispose(); env.close(); }
});

it('applies geographic float, vector, and matrix uniforms and tolerates optimized-out uniforms', () => {
  const env = environment(), gl = env.gl;
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] as const;
  const geographic: LyraMapGeographicShader = { ...shader,
    vertexPrelude: `uniform float u_factor; uniform vec4 u_shift; uniform mat4 u_matrix;
      vec4 lrProjectPosition(vec3 p) { return u_matrix * vec4((p.x / 4096.0 - 1.0) * u_factor, p.z / 100.0 - 0.5, 0.0, 1.0) + u_shift; }
      vec3 lrHorizonPosition(vec3 p) { return p; }`,
    uniforms: [{ name: 'u_factor', type: 'float', value: 0.5 },
      { name: 'u_shift', type: 'vec4', value: [0.25, 0, 0, 0] },
      { name: 'u_matrix', type: 'mat4', value: matrix },
      { name: 'u_optimized_out', type: 'float', value: 1 }],
  };
  const layer = createElevatedSceneLineLayer('paths', [line('absolute', [0, 0, 0])]).create(env.context);
  try {
    const frame = env.frame(1);
    layer.render({ ...frame, geographic: { ...frame.geographic, shader: () => geographic } });
    expectPainted(gl);
    const program = env.programs[0]!;
    expect(gl.getUniform(program, gl.getUniformLocation(program, 'u_factor')!)).to.equal(0.5);
    expect(Array.from(gl.getUniform(program, gl.getUniformLocation(program, 'u_shift')!) as Float32Array)).to.deep.equal([0.25, 0, 0, 0]);
    expect(Array.from(gl.getUniform(program, gl.getUniformLocation(program, 'u_matrix')!) as Float32Array)).to.deep.equal(matrix);
    expect(gl.getUniformLocation(program, 'u_optimized_out') === null).to.equal(true);
    layer.dispose(); expectReleased(env);
  } finally { layer.dispose(); env.close(); }
});

it('skips transparent and single-point paths before allocating native resources', () => {
  const env = environment();
  const layer = createElevatedSceneLineLayer('paths', [
    { ...line('transparent'), rgba: [1, 0, 0, 0] },
    { ...line('point'), coordinates: [[0, 0, 0]], terrain: [1] },
  ]).create(env.context);
  try {
    layer.render(env.frame(1));
    expect(env.queries).to.equal(0); expect(env.draws).to.equal(0);
    expect(env.buffers.length + env.arrays.length + env.shaders.length + env.programs.length).to.equal(0);
    expect(env.gl.getError()).to.equal(env.gl.NO_ERROR);
    layer.dispose(); expectReleased(env);
  } finally { layer.dispose(); env.close(); }
});

it('releases its ownership after native context loss without calling deletion on lost resources', async () => {
  const env = environment();
  const layer = createElevatedSceneLineLayer('paths', [line('absolute', [0, 0, 0])]).create(env.context);
  try {
    layer.render(env.frame(1)); expectPainted(env.gl);
    env.close();
    await waitUntil(() => env.gl.isContextLost());
    layer.dispose(); layer.dispose(); layer.render(env.frame(2));
    expect(env.deleted.size).to.equal(0);
    expect(env.draws).to.equal(1);
  } finally { layer.dispose(); }
});

for (const failure of ['vertex shader', 'fragment shader', 'shader compile', 'program', 'program link', 'vertex array', 'buffer', 'attribute setup'] as const) {
  it(`releases partial GL allocations after ${failure} fails`, () => {
    const env = environment(), gl = env.gl;
    const layer = createElevatedSceneLineLayer('paths', [line('absolute', [0, 0, 0])]).create(env.context);
    const methods = ['createShader', 'getShaderParameter', 'createProgram', 'getProgramParameter',
      'createVertexArray', 'createBuffer', 'vertexAttribPointer'] as const;
    const originals = new Map(methods.map(name => [name, gl[name]]));
    const createShader = gl.createShader;
    if (failure === 'vertex shader' || failure === 'fragment shader') {
      gl.createShader = type => type === (failure === 'vertex shader' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER) ? null : createShader.call(gl, type);
    } else if (failure === 'shader compile') gl.getShaderParameter = () => false;
    else if (failure === 'program') Object.defineProperty(gl, 'createProgram', { configurable: true, value: () => null });
    else if (failure === 'program link') gl.getProgramParameter = () => false;
    else if (failure === 'vertex array') Object.defineProperty(gl, 'createVertexArray', { configurable: true, value: () => null });
    else if (failure === 'buffer') Object.defineProperty(gl, 'createBuffer', { configurable: true, value: () => null });
    else gl.vertexAttribPointer = () => { throw new Error('Native attribute setup failed'); };
    try {
      expect(() => layer.render(env.frame(1))).to.throw();
      layer.dispose();
      expect(env.draws).to.equal(0);
      expectReleased(env);
      layer.dispose(); expectReleased(env);
      for (const [name, value] of originals) Object.defineProperty(gl, name, { configurable: true, writable: true, value });
      const recovered = createElevatedSceneLineLayer('recovered', [line('absolute', [0, 0, 0])])
        .create({ ...env.context, signal: new AbortController().signal });
      try {
        recovered.render(env.frame(2));
        expect(env.draws).to.equal(1);
        expectPainted(gl);
      } finally { recovered.dispose(); }
      expectReleased(env);
    } finally { layer.dispose(); env.close(); }
  });
}
