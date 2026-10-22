import { createEngine } from '@aceshooting/lyra-3d/model';
import { DEFAULT_LYRA_3D_STYLE } from '@aceshooting/lyra-3d/core';

const WIDTH = 640; const HEIGHT = 480;
const utf8 = (value) => new TextEncoder().encode(value);
const base64 = (bytes) => btoa(String.fromCharCode(...bytes));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const jpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAJgABAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAAPwA//9k=';
let active;
const state = (extra = {}) => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate, message) {
  const deadline = performance.now() + 10000;
  while (!predicate()) { if (performance.now() > deadline) throw new Error(message); await wait(20); }
}
function triangle(texture) {
  const data = new Uint8Array(new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 1]).buffer);
  const json = {
    asset: { version: '2.0' }, buffers: [{ byteLength: data.length, uri: `data:application/octet-stream;base64,${base64(data)}` }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 24 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5126, count: 3, type: 'VEC2' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { metallicFactor: 0, roughnessFactor: 1 }, doubleSided: true }],
    nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0,
  };
  if (texture) { json.images = [{ uri: texture }]; json.textures = [{ source: 0 }]; json.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 }; }
  return json;
}
function glb() {
  const json = triangle(); const binary = Uint8Array.from(atob(json.buffers[0].uri.split(',')[1]), (character) => character.charCodeAt(0)); delete json.buffers[0].uri;
  const source = JSON.stringify(json); const text = utf8(source.padEnd(Math.ceil(source.length / 4) * 4, ' '));
  const result = new Uint8Array(28 + text.length + binary.length); const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, result.length, true);
  view.setUint32(12, text.length, true); view.setUint32(16, 0x4e4f534a, true); result.set(text, 20);
  view.setUint32(20 + text.length, binary.length, true); view.setUint32(24 + text.length, 0x004e4942, true); result.set(binary, 28 + text.length); return result;
}
const fixtures = () => [
  { format: 'gltf', bytes: utf8(JSON.stringify(triangle())) }, { format: 'glb', bytes: glb() },
  { format: 'obj', bytes: utf8('v -1 -1 0\nv 1 -1 0\nv 0 1 0\nf 1 2 3\n') },
  { format: 'stl', bytes: utf8('solid triangle\nfacet normal 0 0 1\nouter loop\nvertex -1 -1 0\nvertex 1 -1 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle\n') },
  { format: 'ply', bytes: utf8('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n-1 -1 0\n1 -1 0\n0 1 0\n3 0 1 2\n') },
  { format: 'xyz', bytes: utf8('-1 -1 0 255 0 0\n1 -1 0 0 255 0\n0 1 0 0 0 255\n') },
  { format: 'pcd', bytes: utf8('VERSION .7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n-1 -1 0\n1 -1 0\n0 1 0\n') },
];
export function cleanupModel() { const old = active; active = undefined; if (old) { try { old.engine.dispose(); } finally { old.container.remove(); } } }
async function mount(input = fixtures()[0]) {
  cleanupModel(); const container = document.createElement('div');
  container.style.cssText = `position:absolute;left:0;top:0;width:${WIDTH}px;height:${HEIGHT}px`;
  document.body.replaceChildren(container); const engine = createEngine();
  const calls = { progress: 0, lost: [], restored: 0, rendering: [], camera: [] };
  const style = { ...DEFAULT_LYRA_3D_STYLE, background: '#000000', foreground: '#ffffff', accent: '#ff0000', focus: '#00ff00', palette: ['#ffffff'], devicePixelRatio: 1, reducedMotion: true, pointSize: 20 };
  const record = { container, engine, calls, style }; active = record;
  engine.setStyle(style);
  await engine.mount(container, { hover() {}, pick() {}, camera(value) { calls.camera.push(value); }, progress() { calls.progress++; }, lost(reason, detail) { calls.lost.push({ reason, detail }); }, restored() { calls.restored++; }, rendering(value) { calls.rendering.push(value); } });
  engine.resize(WIDTH, HEIGHT); record.canvas = container.querySelector('canvas'); record.gl = record.canvas?.getContext('webgl2');
  if (!record.gl) throw new Error('Model did not mount a WebGL2 canvas');
  engine.setData(input, 0); await until(() => calls.progress === 1 || calls.lost.length, 'Model parse did not complete');
  if (calls.lost.length) throw new Error('Model parse failed'); engine.fit(); return record;
}
async function pixels(record, next = state()) {
  record.engine.setState(next);
  return new Promise((resolve) => requestAnimationFrame(() => {
    const result = new Uint8Array(record.canvas.width * record.canvas.height * 4);
    record.gl.readPixels(0, 0, record.canvas.width, record.canvas.height, record.gl.RGBA, record.gl.UNSIGNED_BYTE, result); resolve(result);
  }));
}
function pixel(record, bytes, point) {
  if (!point) throw new Error('Model item was not projected');
  const x = Math.round(point.x * record.canvas.width / WIDTH); const y = record.canvas.height - 1 - Math.round(point.y * record.canvas.height / HEIGHT);
  return Array.from(bytes.subarray((y * record.canvas.width + x) * 4, (y * record.canvas.width + x) * 4 + 4));
}
const visible = (value) => value.slice(0, 3).some((channel) => channel > 15);
export const modelCases = {
  async 'model-all-formats-render-and-pick'() {
    const results = [];
    for (const input of fixtures()) {
      const record = await mount(input); const image = await pixels(record); const point = record.engine.project(0);
      const picked = point && record.engine.pick(point.x, point.y); const sample = pixel(record, image, point);
      results.push({ format: input.format, picked, sample, passed: picked === 0 && visible(sample) });
    }
    return { passed: results.every((result) => result.passed), results };
  },
  async 'model-mesh-state-and-fit'() {
    const record = await mount({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(png))) }); const fit = record.engine.fit(); const point = record.engine.project(0);
    const selected = pixel(record, await pixels(record, state({ selected: new Set([0]) })), point);
    const focus = pixel(record, await pixels(record, state({ focus: 0 })), point);
    return { passed: selected[0] > 40 && selected[1] < 10 && focus[1] > 40 && focus[0] < 10 && fit.target.x === 0 && fit.target.y === 0 && record.calls.camera.length === 0, selected, focus, fit };
  },
  async 'model-native-texture-no-network'() {
    const original = globalThis.fetch; let requests = 0;
    globalThis.fetch = () => { requests++; throw new Error('Model attempted a network fetch'); };
    try {
      const control = await mount({ format: 'gltf', bytes: utf8(JSON.stringify(triangle())) });
      const untextured = pixel(control, await pixels(control), control.engine.project(0));
      const record = await mount({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(png))) }); const point = record.engine.project(0);
      const sample = pixel(record, await pixels(record), point);
      // Dielectric highlights remain neutral even when the base-color texture is pure red.
      const textureApplied = untextured.slice(0, 3).every(channel => channel > 100) && sample[0] > 100 && Math.abs(sample[0] - untextured[0]) <= 3 && sample[1] < untextured[1] / 4 && sample[2] < untextured[2] / 4;
      return { passed: requests === 0 && textureApplied && record.engine.pick(point.x, point.y) === 0, requests, untextured, sample };
    } finally { globalThis.fetch = original; }
  },
  async 'model-native-jpeg-texture'() {
    const record = await mount({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(jpeg))) });
    const sample = pixel(record, await pixels(record), record.engine.project(0));
    return { passed: sample[0] > 25 && Math.abs(sample[0] - sample[1]) < 3 && Math.abs(sample[0] - sample[2]) < 3, sample };
  },
  async 'model-rejected-replacement-preserves-scene'() {
    const record = await mount(); const before = record.engine.positionOf(0); let rejected = false;
    try { record.engine.setData({ format: 'obj', bytes: utf8('mtllib external.mtl\n') }, 1); } catch { rejected = true; }
    const point = record.engine.project(0); const sample = pixel(record, await pixels(record), point);
    return { passed: rejected && JSON.stringify(before) === JSON.stringify(record.engine.positionOf(0)) && record.engine.pick(point.x, point.y) === 0 && visible(sample) && record.calls.lost.length === 0, rejected, sample };
  },
  async 'model-texture-context-restore'() {
    const record = await mount({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(png))) });
    const before = pixel(record, await pixels(record), record.engine.project(0));
    const extension = record.gl.getExtension('WEBGL_lose_context'); if (!extension) return { passed: false, skipped: 'WEBGL_lose_context unavailable' };
    extension.loseContext(); await until(() => record.calls.lost.length === 1, 'Model did not report context loss');
    const lostPick = record.engine.pick(320, 240); await wait(100); extension.restoreContext();
    await until(() => record.calls.restored === 1, 'Model did not report context restoration');
    const point = record.engine.project(0); const sample = pixel(record, await pixels(record), point);
    return { passed: lostPick === null && record.engine.pick(point.x, point.y) === 0 && before[0] > 100 && before[1] < before[0] / 4 && before[2] < before[0] / 4 && sample.every((channel, index) => Math.abs(channel - before[index]) <= 3) && record.calls.lost.length === 1, lostPick, before, sample };
  },
  async 'model-neutral-light-and-forced-colors'() {
    const record = await mount(); record.engine.setStyle({ ...record.style, foreground: '#000000' });
    const point = record.engine.project(0); const lit = pixel(record, await pixels(record), point);
    record.engine.setStyle({ ...record.style, background: '#ffffff', foreground: '#000000', forcedColors: true });
    const forced = pixel(record, await pixels(record), point);
    return { passed: lit[0] > 60 && lit[1] > 60 && lit[2] > 60 && forced[0] < 5 && forced[1] < 5 && forced[2] < 5, lit, forced };
  },
  async 'model-current-native-image-dispose-once'() {
    const close = ImageBitmap.prototype.close; let closed = 0;
    ImageBitmap.prototype.close = function () { closed++; return close.call(this); };
    try {
      const record = await mount({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(png))) }); await pixels(record);
      const before = closed; cleanupModel(); record.engine.dispose(); await wait(30);
      return { passed: before === 0 && closed === 1 && !record.container.isConnected, before, closed };
    } finally { ImageBitmap.prototype.close = close; }
  },
  async 'model-dispose-during-native-image-decode'() {
    const native = globalThis.createImageBitmap; const close = ImageBitmap.prototype.close; let finish; let closed = 0;
    globalThis.createImageBitmap = async (...args) => { const bitmap = await native.apply(globalThis, args); return new Promise((resolve) => { finish = () => resolve(bitmap); }); };
    ImageBitmap.prototype.close = function () { closed++; return close.call(this); };
    try {
      const record = await mount(); record.engine.setData({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(png))) }, 1);
      await until(() => Boolean(finish), 'Native image did not decode'); cleanupModel(); const calls = JSON.stringify(record.calls); finish();
      await until(() => closed === 1, 'Disposed decode did not release'); await wait(30);
      return { passed: closed === 1 && JSON.stringify(record.calls) === calls && !record.container.isConnected, closed };
    } finally { globalThis.createImageBitmap = native; ImageBitmap.prototype.close = close; }
  },
  async 'model-native-image-stale-and-dispose'() {
    const native = globalThis.createImageBitmap; const close = ImageBitmap.prototype.close; let finish; let closed = 0; let decoded = 0;
    globalThis.createImageBitmap = async (...args) => { const bitmap = await native.apply(globalThis, args); decoded++; return new Promise((resolve) => { finish = () => resolve(bitmap); }); };
    ImageBitmap.prototype.close = function () { closed++; return close.call(this); };
    try {
      const record = await mount(); const before = record.calls.progress;
      record.engine.setData({ format: 'gltf', bytes: utf8(JSON.stringify(triangle(png))) }, 1);
      await until(() => Boolean(finish), 'Native image did not decode'); record.engine.setData(fixtures()[2], 2); finish();
      await until(() => closed === 1 && record.calls.progress === before + 1, 'Stale image did not release');
      const point = record.engine.project(0); const sample = pixel(record, await pixels(record), point);
      cleanupModel(); await wait(30);
      return { passed: decoded === 1 && closed === 1 && record.calls.lost.length === 0 && visible(sample) && !record.container.isConnected, decoded, closed, sample };
    } finally { globalThis.createImageBitmap = native; ImageBitmap.prototype.close = close; }
  },
};
