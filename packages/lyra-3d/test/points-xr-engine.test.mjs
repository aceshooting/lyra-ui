import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { Matrix4, Vector2 } from 'three';
import { DEFAULT_LYRA_3D_STYLE } from '../dist/core/style.js';
import { captureViewportXrPreparation, getViewportXrResources, releaseViewportXrPreparation } from '../dist/core/viewport-xr.js';
import { createFixture, defaultData } from './points-xr-fixture.mjs';

const state = extra => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const pointMesh = viewport => viewport.world.children.find(mesh => mesh.geometry?.getAttribute('pointPosition'));
const count = (record, name) => record.callbacks.filter(value => value[0] === name).length;
async function start(f, options) {
  const record = f.record, presentation = await record.engine.prepareXrPresentation(options);
  const entry = record.enter(presentation); void entry.catch(() => {});
  return { record, presentation, entry, attempt: f.attempts.at(-1) };
}
async function present(f, options) {
  const active = await start(f, options); await active.attempt.bind(); active.attempt.deliver(); await active.entry; return active;
}
async function finish(f, active, recover = true) {
  const { record, presentation, attempt } = active, old = record.viewport, before = record.viewports.length;
  const exit = presentation.exit(); void exit.catch(() => {});
  attempt.ending.resolve(); await f.settle();
  assert.equal(record.viewports.length, before, 'native end promise alone cannot construct a replacement');
  attempt.endEvent(); await f.until(() => old.renderer.getContext().state.releaseRequests === 1);
  assert.equal(record.viewports.length, before); assert.equal(old.renderer.getContext().isContextLost(), false);
  f.lose(record); await exit;
  if (recover) await f.until(() => record.viewports.length === before + 1 && count(record, 'restored') >= before);
  else await f.settle();
  return record.viewport;
}

test('ordinary points engine imports no optional controller or native adapter and makes no XR query', () => {
  const engineUrl = new URL('../dist/points/engine.js', import.meta.url).href;
  const browserUrl = new URL('./fake-browser.mjs', import.meta.url).href;
  const script = `import assert from 'node:assert/strict'; import { registerHooks } from 'node:module';
    let queries = 0; registerHooks({ resolve(specifier, context, next) {
      const result = next(specifier, context);
      if (/\\/(?:xr\\/(?:controller|three-native-owner)|points\\/xr)\\.js$/u.test(result.url)) throw new Error('Optional XR module loaded during ordinary use');
      return result;
    } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { get xr() { queries++; return {}; } } });
    Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, get() { queries++; return true; } });
    const { installFakeBrowser } = await import(${JSON.stringify(browserUrl)}); const browser = installFakeBrowser();
    const { createPointsEngine } = await import(${JSON.stringify(engineUrl)}); const engine = createPointsEngine();
    try { engine.setData({ positions: new Float32Array([0,0,0]) }, 0);
      await engine.mount(browser.container, { hover(){}, pick(){}, camera(){}, lost(){} });
      engine.resize(320,240); browser.flushFrames(); engine.dispose(); assert.equal(queries,0);
    } finally { engine.dispose(); browser.restore(); }`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('unused points presentation disposal leaves actual inline resources input and rendering owned by the engine', async t => {
  const f = await createFixture(t), r = f.record, viewport = r.viewport, mesh = pointMesh(viewport);
  const presentation = await r.engine.prepareXrPresentation();
  assert.equal(presentation.state, 'ready'); assert.equal(f.attempts.length, 0);
  const before = r.renderReturns; presentation.dispose(); await f.settle();
  r.engine.resize(720, 420); f.browser.flushFrames();
  assert.equal(r.viewport, viewport); assert.equal(pointMesh(viewport), mesh); assert.ok(r.renderReturns > before);
  assert.equal(viewport.disposed, false); assert.equal(viewport.canvas.parent, r.container);
  assert.equal(r.disposals, 0); assert.equal(r.currentGL().state.releaseRequests, 0); assert.equal(r.viewports.length, 1);
  const next = await r.engine.prepareXrPresentation(); next.dispose();
});

test('real points preparation refuses every unsupported scene without removing inline content or requesting a session', async t => {
  const variants = [
    { ...defaultData(), mode: '2d' }, { ...defaultData(), labels: ['label', ''] },
    { ...defaultData(), axes: [{ axis: 'x', min: -1, max: 1, label: 'axis', ticks: [] }] },
    { ...defaultData(), axes: [{ axis: 'x', min: -1, max: 1, ticks: [{ value: 0, label: 'tick' }] }] },
    { positions: new Float32Array(100001 * 3) }, { ...defaultData(), sizes: new Float32Array([749, 0]) },
  ];
  for (const data of variants) {
    const f = await createFixture(t, { data }), r = f.record, viewport = r.viewport;
    await assert.rejects(r.engine.prepareXrPresentation(), { code: 'unsupported-scene' });
    assert.equal(f.attempts.length, 0); assert.equal(r.viewport, viewport); assert.equal(viewport.disposed, false);
    assert.equal(viewport.canvas.parent, r.container); assert.equal(r.disposals, 0);
    const before = r.renderReturns; viewport.renderNow(); assert.ok(r.renderReturns > before);
    await f.cleanup();
  }
  const f = await createFixture(t), r = f.record, token = captureViewportXrPreparation(r.viewport, false);
  const resources = getViewportXrResources(token); releaseViewportXrPreparation(token);
  const glow = { render(scene, camera) { r.viewport.renderer.render(scene, camera); }, resize() {}, prepare() {}, dispose() {} };
  resources.glow = glow;
  await assert.rejects(r.engine.prepareXrPresentation(), { code: 'unsupported-scene' });
  assert.equal(resources.glow, glow); assert.equal(r.viewport.disposed, false); assert.equal(f.attempts.length, 0);
});

test('unavailable native support retains the mounted inline viewport and creates no attempt', async t => {
  const f = await createFixture(t, { support: false }), r = f.record;
  await assert.rejects(r.engine.prepareXrPresentation(), { code: 'unavailable' });
  assert.equal(f.supportQueries.length, 1); assert.equal(f.attempts.length, 0);
  assert.equal(r.viewports.length, 1); assert.equal(r.viewport.disposed, false); assert.equal(r.disposals, 0);
});

test('prepared entry invokes the native request synchronously before state callbacks and refuses duplicate entry', async t => {
  const f = await createFixture(t), r = f.record;
  const presentation = await r.engine.prepareXrPresentation({ onStateChange(value) { f.trace.push(`state:${value}`); } });
  assert.equal(f.attempts.length, 0); const entry = r.enter(presentation), rejected = assert.rejects(entry, { code: 'aborted' });
  assert.equal(f.attempts.length, 1); assert.equal(r.viewport.disposed, true); assert.equal(r.viewport.canvas.parent, undefined);
  assert.ok(f.trace.indexOf('native-request') < f.trace.indexOf('state:requesting'));
  await assert.rejects(presentation.enter(), { code: 'busy' }); assert.equal(f.attempts.length, 1);
  presentation.dispose(); await rejected;
});

for (const branch of ['legacy', 'projection']) {
  test(`actual points ${branch} submits after a valid pose and keeps the first placement fixed across head motion`, async t => {
    const f = await createFixture(t, { branch }), active = await start(f), r = active.record;
    const old = r.viewport, before = r.renderReturns; await active.attempt.bind();
    active.attempt.deliver(false); await f.settle(); assert.equal(r.renderReturns, before); assert.equal(active.presentation.state, 'requesting');
    active.attempt.deliver(); await active.entry; assert.equal(active.presentation.state, 'presenting'); assert.ok(r.renderReturns > before);
    assert.ok(f.trace.includes(branch === 'legacy' ? 'legacy-layer' : 'projection-layer'));
    const placed = old.world.matrix.toArray(), hostCamera = count(r, 'camera');
    active.attempt.deliver(true, new Matrix4().makeRotationY(.3).setPosition(1, 1.6, -.5).toArray());
    assert.deepEqual(old.world.matrix.toArray(), placed); assert.equal(count(r, 'camera'), hostCamera);
    assert.deepEqual(old.renderer.xr.getCamera().cameras.map(camera => camera.viewport.toArray()), [[0, 0, 900, 700], [900, 0, 700, 650]]);
    const restored = await finish(f, active); assert.notEqual(restored, old); assert.equal(restored.renderer.getRenderTarget(), null);
    assert.equal(old.renderer.getContext().isContextLost(), true); assert.equal(restored.renderer.getContext().isContextLost(), false);
    assert.equal(active.attempt.session.endListeners.size, 0); assert.equal(active.attempt.session.frames.size, 0);
  });
}

test('engine and document preparation leases never steal another live attempt and a busy ready controller can retry later', async t => {
  const f = await createFixture(t), r = f.record, one = await r.engine.prepareXrPresentation();
  await assert.rejects(r.engine.prepareXrPresentation(), { code: 'busy' });
  const other = await f.createRecord(), two = await other.engine.prepareXrPresentation();
  const entry = r.enter(one), cancelled = assert.rejects(entry, { code: 'aborted' });
  await assert.rejects(other.enter(two), { code: 'busy' }); assert.equal(two.state, 'ready'); assert.equal(other.viewport.disposed, false);
  const attempt = f.attempts[0], exit = one.exit(); await cancelled; attempt.request.reject(new DOMException('Denied', 'NotAllowedError'));
  await f.until(() => r.currentGL().state.releaseRequests === 1); f.lose(r); await exit;
  const secondEntry = other.enter(two), secondCancelled = assert.rejects(secondEntry, { code: 'aborted' });
  assert.equal(f.attempts.length, 2); two.dispose(); await secondCancelled;
});

test('prepared capability facts become stale after a data commit and fail before request while inline replacement remains usable', async t => {
  const f = await createFixture(t), r = f.record, prepared = await r.engine.prepareXrPresentation(), viewport = r.viewport;
  r.engine.setData({ positions: new Float32Array([3, 4, 5]) }, 1);
  await assert.rejects(r.enter(prepared), { code: 'unsupported-scene' });
  assert.equal(f.attempts.length, 0); assert.equal(viewport.disposed, false); assert.equal(r.disposals, 0);
  assert.deepEqual(r.engine.positionOf(0), { x: 3, y: 4, z: 5 });
  const next = await r.engine.prepareXrPresentation(); next.dispose();
});

test('engine disposal clears a pending support preparation without late native work or reconstruction', async t => {
  const f = await createFixture(t, { support: 'pending' }), r = f.record, states = [];
  const pending = r.engine.prepareXrPresentation({ onStateChange: value => states.push(value) }), rejected = assert.rejects(pending, { code: 'aborted' });
  await f.until(() => f.supportQueries.length === 1); r.engine.dispose(); f.supportQueries[0].resolve(true); await rejected; await f.settle();
  assert.deepEqual(states, []); assert.equal(f.attempts.length, 0); assert.equal(r.viewports.length, 1);
  assert.equal(r.engine.positionOf(0), null); assert.equal(r.container.children.length, 0); assert.equal(r.currentGL().isContextLost(), true);
});

test('immediate disposal before optional import continuation cannot query support or revive an engine', async t => {
  const f = await createFixture(t), r = f.record;
  const pending = r.engine.prepareXrPresentation(), rejected = assert.rejects(pending, { code: 'aborted' });
  r.engine.dispose(); await rejected; await f.settle();
  assert.equal(f.supportQueries.length, 0); assert.equal(f.attempts.length, 0); assert.equal(r.viewports.length, 1); assert.equal(r.container.children.length, 0);
});

test('accepted updates during a pending native request recover only the newest semantic state after late grant and observed release', async t => {
  const f = await createFixture(t), active = await start(f), r = active.record, old = r.viewport;
  const rejected = assert.rejects(active.entry, { code: 'aborted' }), before = r.renderReturns, callbacks = r.callbacks.length;
  r.engine.setData({ positions: new Float32Array([3, 4, 5]) }, 1);
  r.engine.setData({ positions: new Float32Array([7, 8, 9, -2, 0, 1]) }, 2);
  r.engine.setState(state({ selected: new Set([1]), focus: 0 })); r.engine.setStyle({ ...DEFAULT_LYRA_3D_STYLE, pointSize: 14, focus: '#ff0000' });
  const camera = { yaw: .4, pitch: .2, distance: 40, target: { x: 2, y: 3, z: 4 } };
  r.engine.setCamera(camera); r.engine.resize(820, 460); await rejected; await f.settle();
  assert.equal(r.renderReturns, before); assert.equal(r.callbacks.length, callbacks); assert.equal(r.disposals, 0);
  assert.deepEqual(r.engine.positionOf(0), { x: 7, y: 8, z: 9 }); assert.equal(r.engine.pick(1, 1), null); assert.equal(r.engine.project(0), null);
  active.attempt.grant(); await f.until(() => active.attempt.session.endCalls === 1);
  assert.equal(active.attempt.referenceCalls.length, 0); const next = await finish(f, active);
  assert.notEqual(next, old); assert.deepEqual([next.width, next.height], [820, 460]); assert.deepEqual(next.orbit, camera);
  const mesh = pointMesh(next); assert.deepEqual([...mesh.geometry.getAttribute('pointPosition').array], [7, 8, 9, -2, 0, 1]);
  assert.deepEqual([...mesh.geometry.getAttribute('pointSize').array], [14, 14]);
  assert.deepEqual([...mesh.geometry.getAttribute('pointColor').array.slice(0, 3)], [1, 0, 0]);
  assert.equal(next.renderer.getRenderTarget(), null); assert.equal(count(r, 'restored'), 1);
  assert.ok(f.trace.lastIndexOf('context-loss-observed') < f.trace.lastIndexOf('viewport-created'));
  assert.ok(f.trace.lastIndexOf('renderer-return') < f.trace.lastIndexOf('host:restored'));
});

test('invalid data and visual state writes preserve active presentation revisions and native resources', async t => {
  const f = await createFixture(t), active = await present(f), r = active.record, old = r.viewport, mesh = pointMesh(old);
  assert.throws(() => r.engine.setData({ positions: new Float32Array([NaN, 0, 0]) }, 1), RangeError);
  assert.throws(() => r.engine.setState({ selected: 42, dimmed: new Set(), hover: -1, focus: -1 }));
  assert.equal(active.presentation.state, 'presenting'); assert.equal(pointMesh(old), mesh); assert.equal(active.attempt.session.endCalls, 0);
  const before = r.renderReturns; active.attempt.deliver(); assert.ok(r.renderReturns > before);
  r.engine.setData({ positions: new Float32Array([2, 3, 4]) }, 1); assert.deepEqual(r.engine.positionOf(0), { x: 2, y: 3, z: 4 });
  await finish(f, active);
});

test('ending callbacks may accept a newer data revision without the outer setter overwriting it', async t => {
  const f = await createFixture(t), r = f.record; let reentered = false;
  const active = await present(f, { onStateChange(value) {
    if (value === 'ending' && !reentered) { reentered = true; r.engine.setData({ positions: new Float32Array([9, 8, 7]) }, 2); }
  } });
  r.engine.setData({ positions: new Float32Array([1, 2, 3]) }, 1);
  assert.equal(reentered, true); assert.deepEqual(r.engine.positionOf(0), { x: 9, y: 8, z: 7 });
  const next = await finish(f, active); assert.deepEqual([...pointMesh(next).geometry.getAttribute('pointPosition').array], [9, 8, 7]);
});

test('end during pending real reference binding cannot retire or reconstruct before binding settles', async t => {
  const f = await createFixture(t), active = await start(f), r = active.record;
  active.attempt.grant(); await f.settle(); active.attempt.compatibility.resolve();
  await f.until(() => active.attempt.referenceCalls.length === 1);
  const rejected = assert.rejects(active.entry, { code: 'aborted' }), exit = active.presentation.exit(); await rejected;
  active.attempt.ending.resolve(); active.attempt.endEvent(); await f.settle();
  assert.equal(r.disposals, 0); assert.equal(r.viewports.length, 1);
  active.attempt.referenceReady.resolve(active.attempt.reference); await f.until(() => r.currentGL().state.releaseRequests === 1);
  assert.equal(r.disposals, 1); assert.equal(r.viewports.length, 1); f.lose(); await exit;
  await f.until(() => r.viewports.length === 2); assert.equal(active.attempt.session.frames.size, 0);
});

test('a renderer retirement failure still observes context loss but quarantines recovery and the document lease', async t => {
  const f = await createFixture(t), active = await present(f), r = active.record, old = r.viewport;
  const dispose = old.renderer.dispose; old.renderer.dispose = () => { dispose(); throw new Error('Controlled renderer retirement failure'); };
  t.after(() => { old.renderer.dispose = dispose; });
  const exit = active.presentation.exit(), rejected = assert.rejects(exit, { code: 'failed' });
  active.attempt.ending.resolve(); active.attempt.endEvent(); await f.until(() => old.renderer.getContext().state.releaseRequests === 1);
  assert.equal(r.viewports.length, 1); f.lose(); await rejected; await f.settle(); assert.equal(r.viewports.length, 1);
  const other = await f.createRecord(), prepared = await other.engine.prepareXrPresentation();
  await assert.rejects(other.enter(prepared), { code: 'busy' }); assert.equal(other.viewport.disposed, false); prepared.dispose();
});

test('engine disposal during a request is callback silent and late native release cannot reconstruct it', async t => {
  const f = await createFixture(t), states = [], active = await start(f, { onStateChange: value => states.push(value) }), r = active.record;
  const rejected = assert.rejects(active.entry, { code: 'aborted' }), callbacks = r.callbacks.length, stateCount = states.length;
  r.engine.dispose(); await rejected; const exit = active.presentation.exit();
  active.attempt.grant(); await f.until(() => active.attempt.session.endCalls === 1);
  active.attempt.ending.resolve(); active.attempt.endEvent(); await f.until(() => r.currentGL().state.releaseRequests === 1);
  f.lose(); await exit; await f.settle();
  assert.equal(r.callbacks.length, callbacks); assert.equal(states.length, stateCount); assert.equal(r.viewports.length, 1);
  assert.equal(r.container.children.length, 0); assert.equal(r.engine.positionOf(0), null); assert.deepEqual(f.queues(), { inline: 0, native: 0 });
});

test('camera fit focus and resize during presentation affect only the latest inline return view', async t => {
  const f = await createFixture(t), active = await present(f), r = active.record, old = r.viewport;
  const oldRoot = old.world.matrix.toArray(), oldSize = old.renderer.getSize(new Vector2()).toArray();
  r.engine.setCamera({ yaw: .4, pitch: .2, distance: 10, target: { x: 0, y: 0, z: 0 } });
  r.engine.resize(888, 444); r.engine.fit(20); const returning = r.engine.focus(1, 5);
  assert.equal(active.presentation.state, 'presenting'); assert.equal(active.attempt.session.endCalls, 0);
  assert.deepEqual(old.world.matrix.toArray(), oldRoot); assert.deepEqual(old.renderer.getSize(new Vector2()).toArray(), oldSize);
  assert.deepEqual([old.width, old.height], [640, 480]);
  const next = await finish(f, active); assert.deepEqual(next.orbit, returning); assert.deepEqual([next.width, next.height], [888, 444]);
});

test('a missing pose skips submission but a present out-of-range pose fails the attempted presentation', async t => {
  const f = await createFixture(t), active = await start(f), r = active.record, before = r.renderReturns;
  await active.attempt.bind(); active.attempt.deliver(false); await f.settle(); assert.equal(r.renderReturns, before);
  const rejected = assert.rejects(active.entry, { code: 'failed' });
  active.attempt.deliver(true, new Matrix4().makeTranslation(65, 1.6, 0).toArray()); await rejected;
  assert.equal(active.presentation.state, 'ending'); assert.equal(r.renderReturns, before);
  await finish(f, active);
});

test('throwing application state callbacks do not turn into renderer failure across ten complete recovery cycles', async t => {
  const f = await createFixture(t), r = f.record, failure = new Error('Controlled application state callback failure');
  for (let cycle = 0; cycle < 10; cycle++) {
    const active = await present(f, { onStateChange() { throw failure; } });
    assert.equal(active.presentation.state, 'presenting'); await finish(f, active);
    assert.equal(active.attempt.session.frames.size, 0); assert.equal(active.attempt.session.endListeners.size, 0);
  }
  assert.equal(r.viewports.length, 11); assert.equal(r.disposals, 10); assert.equal(count(r, 'restored'), 10); assert.equal(count(r, 'lost'), 0);
  assert.ok(f.errors.length >= 30); assert.equal(f.errors.every(error => error === failure), true);
  r.engine.dispose(); assert.equal(r.disposals, 11); assert.deepEqual(f.queues(), { inline: 0, native: 0 });
});
