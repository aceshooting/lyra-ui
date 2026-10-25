import { createEngine } from '@aceshooting/lyra-3d/model';
import { DEFAULT_LYRA_3D_STYLE } from '@aceshooting/lyra-3d/core';
import { modelAsyncFixtures, plyGpuFixtures } from './model-async-fixtures.mjs';

const width = 320, height = 240;
const NativeWorker = globalThis.Worker;
const workers = [];
let readyHook;
class ObservedWorker extends NativeWorker {
  constructor(url, options) {
    super(url, options);
    const record = { url: String(url), options, messages: [], terminations: 0 };
    workers.push(record); this.record = record;
    this.addEventListener('message', event => {
      record.messages.push(event.data?.type ?? 'unknown');
      if (event.data?.type === 'ready' && readyHook) { const hook = readyHook; readyHook = undefined; hook(); }
    });
  }
  terminate() { this.record.terminations++; return super.terminate(); }
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, message) {
  const deadline = performance.now() + 15000;
  while (!predicate()) { if (performance.now() > deadline) throw new Error(message); await wait(5); }
}
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let active;
async function mount(mode) {
  cleanup(); globalThis.Worker = mode === 'fallback' ? undefined : ObservedWorker;
  const container = document.createElement('div');
  container.style.cssText = `width:${width}px;height:${height}px;position:absolute;inset:0`;
  document.body.append(container);
  const engine = createEngine();
  const calls = { progress: 0, lost: [], rendering: [] };
  active = { engine, container, calls };
  engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, background: '#000000', foreground: '#ffffff', accent: '#ff0000', focus: '#00ff00', palette: ['#ffffff'], devicePixelRatio: 1, reducedMotion: true, pointSize: 20 });
  await engine.mount(container, { hover() {}, pick() {}, camera() {}, progress() { calls.progress++; }, lost(reason, detail) { calls.lost.push({ reason, detail }); }, rendering(info) { calls.rendering.push(info); } });
  engine.resize(width, height);
  active.canvas = container.querySelector('canvas'); active.gl = active.canvas?.getContext('webgl2');
  assert(active.gl, 'Real WebGL2 context is required'); return active;
}
function cleanup() {
  if (active) { const old = active; active = undefined; try { old.engine.dispose(); } finally { old.container.remove(); } }
  readyHook = undefined; globalThis.Worker = NativeWorker;
}
async function install(record, data, mode, revision = 0, options) {
  const progress = record.calls.progress;
  if (mode === 'native') {
    record.engine.setData(data, revision);
    await until(() => record.calls.progress > progress || record.calls.lost.length > 0, 'Native model did not complete');
  } else await record.engine.setDataAsync(data, revision, options);
}
async function rendered(record) {
  const camera = record.engine.fit();
  record.engine.setState({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
  await frame(); await frame();
  // Force another real frame immediately before readback; the context need not preserve its buffer.
  record.engine.setState({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1 });
  const pixels = await new Promise(resolve => requestAnimationFrame(() => {
    const bytes = new Uint8Array(record.canvas.width * record.canvas.height * 4);
    record.gl.readPixels(0, 0, record.canvas.width, record.canvas.height, record.gl.RGBA, record.gl.UNSIGNED_BYTE, bytes);
    resolve(bytes);
  }));
  let visible = 0;
  for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 15) visible++;
  const projected = record.engine.project(0);
  return { pixels, visible, camera, projected, position: record.engine.positionOf(0), picked: projected ? record.engine.pick(projected.x, projected.y) : null, lost: [...record.calls.lost], glError: record.gl.getError(), progress: record.calls.progress };
}
function successful(value, label, progress = 1) {
  assert(value.visible > 0 && value.lost.length === 0 && value.glError === 0 && value.progress === progress, `${label}: model was not successfully rendered`);
  assert(value.position && Object.values(value.position).every(Number.isFinite), `${label}: model has no finite position`);
  assert(value.projected && Number.isFinite(value.projected.x) && Number.isFinite(value.projected.y) && value.picked === 0, `${label}: visible item zero was not pickable`);
}
function doubleMesh(fixture) {
  return fixture.expectedParsed?.primitive === 'mesh' && ['positionArray', 'normalArray', 'uvArray'].some(key => fixture.expectedParsed[key] === 'Float64Array');
}
function compact(value) { const { pixels, ...rest } = value; return rest; }
function compare(reference, candidate) {
  let maxDelta = 0, changed = 0;
  for (let i = 0; i < reference.pixels.length; i++) { const delta = Math.abs(reference.pixels[i] - candidate.pixels[i]); maxDelta = Math.max(maxDelta, delta); if (delta > 3) changed++; }
  return { maxDelta, changed, equal: changed === 0 && same(reference.camera, candidate.camera) && same(reference.position, candidate.position) && reference.picked === candidate.picked && reference.glError === candidate.glError };
}
async function parity(fixture, floatControl) {
  let control;
  if (floatControl) {
    const record = await mount('native'); await install(record, floatControl.data, 'native'); control = await rendered(record);
    successful(control, 'Float mesh render control'); cleanup();
  }
  const results = []; let reference;
  for (const mode of ['native', 'worker', 'fallback']) {
    const start = workers.length; const record = await mount(mode); let outcome, error;
    try { await install(record, fixture.data, mode); outcome = await rendered(record); }
    catch (caught) { error = { name: caught.name, code: caught.code ?? null }; }
    const observed = workers.slice(start);
    if (mode === 'worker') assert(observed.length === 1 && observed[0].messages.includes('ready') && observed[0].messages.includes('result'), `${fixture.name}: production worker did not return a descriptor`);
    if (mode === 'fallback') assert(observed.length === 0, `${fixture.name}: fallback constructed a worker`);
    const result = { mode, error, ...(outcome ? compact(outcome) : {}), workers: observed };
    if (mode === 'native') reference = { outcome, error };
    else if (reference.error || error) assert(same(reference.error, error), `${fixture.name}: parser outcome differs from native`);
    else {
      result.comparison = compare(reference.outcome, outcome);
      assert(result.comparison.equal, `${fixture.name}: rendered output differs from native`);
      assert(same(reference.outcome.lost, outcome.lost), `${fixture.name}: renderer failure differs from native`);
    }
    assert(!error, `${fixture.name}/${mode}: admitted fixture unexpectedly failed to parse`);
    successful(outcome, `${fixture.name}/${mode}`);
    if (control) {
      let maxDelta = 0;
      for (let i = 0; i < control.pixels.length; i++) maxDelta = Math.max(maxDelta, Math.abs(control.pixels[i] - outcome.pixels[i]));
      result.floatControl = { name: floatControl.name, maxDelta, visible: control.visible, picked: control.picked };
      assert(maxDelta <= 3 && outcome.picked === control.picked, `${fixture.name}/${mode}: converted mesh differs from float render control`);
    }
    results.push(result); cleanup();
  }
  return { name: fixture.name, outcome: 'rendered', results };
}
async function workerCancellation(replace) {
  const record = await mount('worker'); const fixture = modelAsyncFixtures().find(value => value.name === 'obj');
  await install(record, fixture.data, 'worker'); const before = await rendered(record); successful(before, 'Cancellation baseline');
  const controller = new AbortController(); let next;
  readyHook = () => { if (replace) next = record.engine.setDataAsync(fixture.data, 2); else controller.abort(); };
  const large = { format: 'xyz', bytes: new TextEncoder().encode('0 0 0\n'.repeat(100000)) };
  const start = workers.length;
  const pending = record.engine.setDataAsync(large, 1, { signal: controller.signal }).then(() => 'resolved', error => error.name);
  assert(await pending === 'AbortError', 'Pending real-worker job must reject on cancellation');
  if (replace) await next;
  const after = await rendered(record); successful(after, 'Cancellation retained scene', replace ? 2 : 1);
  assert(compare(before, after).equal && after.lost.length === 0, 'Cancellation changed the retained scene');
  assert(after.progress === (replace ? 2 : 1), 'Cancelled work emitted completion');
  assert(workers[start].messages.includes('ready') && workers[start].terminations === 1, 'Cancelled production worker was not terminated exactly once');
  const result = { name: replace ? 'worker-replacement' : 'worker-abort', before: compact(before), after: compact(after), workers: workers.slice(start) }; cleanup(); return result;
}
async function lateBitmap(action) {
  const native = globalThis.createImageBitmap, close = ImageBitmap.prototype.close;
  let finish, closed = 0;
  globalThis.createImageBitmap = async (...args) => { const bitmap = await native(...args); return new Promise(resolve => { finish = () => resolve(bitmap); }); };
  ImageBitmap.prototype.close = function () { closed++; return close.call(this); };
  try {
    const record = await mount('worker'), base = modelAsyncFixtures().find(value => value.name === 'obj');
    await install(record, base.data, 'worker'); const before = await rendered(record); successful(before, 'Late-bitmap baseline');
    const controller = new AbortController();
    const pending = record.engine.setDataAsync(modelAsyncFixtures().find(value => value.name === 'gltf-png').data, 1, { signal: controller.signal }).then(() => 'resolved', error => error.name);
    await until(() => Boolean(finish), 'Real embedded bitmap did not decode');
    let next;
    if (action === 'abort') controller.abort();
    else if (action === 'replace') next = record.engine.setDataAsync(base.data, 2);
    else record.engine.dispose();
    assert(await pending === 'AbortError', 'Retired image preparation did not reject');
    finish(); await until(() => closed === 1, 'Late bitmap was not closed exactly once');
    if (next) await next;
    const after = action === 'dispose' ? null : await rendered(record);
    if (after) { successful(after, 'Late-bitmap retained scene', action === 'replace' ? 2 : 1); assert(compare(before, after).equal, 'Late bitmap changed retained or replacement rendering'); }
    await frame(); assert(closed === 1 && record.calls.lost.length === 0 && record.calls.progress === (action === 'replace' ? 2 : 1), 'Late bitmap published or leaked ownership');
    const result = { name: `late-bitmap-${action}`, closed, calls: record.calls }; cleanup(); return result;
  } finally { globalThis.createImageBitmap = native; ImageBitmap.prototype.close = close; cleanup(); }
}
export const modelAsyncCases = [
  ...modelAsyncFixtures().map(value => `parity:${value.name}`),
  'worker-abort', 'worker-replacement', 'late-bitmap-abort', 'late-bitmap-replace', 'late-bitmap-dispose',
  ...plyGpuFixtures().map(value => `ply:${value.name}`),
];
export const runModelAsyncCase = async name => {
  try {
    if (name.startsWith('parity:')) return await parity(modelAsyncFixtures().find(value => value.name === name.slice(7)));
    if (name.startsWith('ply:')) {
      const fixture = plyGpuFixtures().find(value => value.name === name.slice(4));
      return await parity(fixture, doubleMesh(fixture) ? plyGpuFixtures().find(value => value.name === 'float-mesh-ascii') : undefined);
    }
    if (name === 'worker-abort' || name === 'worker-replacement') return await workerCancellation(name === 'worker-replacement');
    return await lateBitmap(name.slice('late-bitmap-'.length));
  } finally { cleanup(); }
};
export const cleanupModelAsync = cleanup;
window.modelAsyncCases = modelAsyncCases;
window.runModelAsyncCase = runModelAsyncCase;
window.cleanupModelAsync = cleanupModelAsync;
document.body.dataset.ready = 'true';
