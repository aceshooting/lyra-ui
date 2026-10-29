import assert from 'node:assert/strict';
import test from 'node:test';
import { admitPointsData } from '../dist/points/data.js';
import { createLabelFixture, labelData, labelStyle, labelMeshes, inlineLabelMesh, fontFace,
  callbackCount, startLabelPresentation, presentLabels, finishLabelPresentation } from './points-xr-label-fixture.mjs';

const state = extra => ({ selected: new Set(), dimmed: new Set(), hover: -1, focus: -1, ...extra });
const pointMesh = viewport => viewport.world.children.find(mesh => mesh.geometry?.getAttribute('pointPosition'));
const inlineTexts = viewport => inlineLabelMesh(viewport)?.material.uniforms.labels.value.image.drawing.calls
  .filter(call => call[0] === 'fillText').map(call => call[1]) ?? [];
const rejected = (promise, code) => { const result = assert.rejects(promise, { code }); void result.catch(() => {}); return result; };
function preparation(record) {
  const operation = { promise: record.engine.prepareXrPresentation(), status: 'pending', value: undefined, error: undefined };
  void operation.promise.then(value => { operation.status = 'fulfilled'; operation.value = value; }, error => { operation.status = 'rejected'; operation.error = error; });
  return operation;
}
async function loadsPending(f, operation, count = 1) {
  await f.until(() => f.fonts.calls.length >= count || operation.status !== 'pending');
  assert.equal(f.fonts.calls.length, count, `Expected ${count} controlled font operations before completion`);
  assert.equal(operation.status, 'pending', 'Preparation must wait for the controlled font results');
}
function uniqueData(count) {
  const positions = new Float32Array(count * 3);
  for (let row = 0; row < count; row++) positions[row * 3] = row / Math.max(1, count - 1) * 2 - 1;
  return { positions, labels: Array.from({ length: count }, (_, row) => `label-${String(row).padStart(3, '0')}`), mode: '3d' };
}
function assertInlineAlive(f, viewport, overlay) {
  assert.equal(f.record.viewport, viewport); assert.equal(viewport.disposed, false);
  assert.equal(inlineLabelMesh(viewport), overlay); assert.equal(f.record.disposals, 0); assert.equal(f.attempts.length, 0);
  const before = f.record.renderReturns; viewport.renderNow(); assert.ok(f.record.renderReturns > before);
}
function assertAtlasRetired(f) {
  for (const { canvas } of f.text.canvases) assert.deepEqual([canvas.width, canvas.height], [1, 1]);
}

test('ordinary and unlabeled points leave owner-document fonts and XR Canvas primitives untouched', { timeout: 15_000 }, async t => {
  for (const data of [labelData(), { positions: new Float32Array([0, 0, 0]), mode: '3d' }]) {
    const f = await createLabelFixture(t, { data }), r = f.record;
    const initialized = await f.createRecord(data);
    initialized.engine.resize(320, 240); f.browser.flushFrames();
    r.engine.resize(720, 420); f.browser.flushFrames(); r.engine.setState(state({ focus: 0 })); f.browser.flushFrames();
    assert.equal(f.supportQueries.length, 0); assert.equal(f.attempts.length, 0);
    assert.equal(f.text.contextRequests, 0); assert.equal(f.text.directionReads, 0); assert.equal(f.text.fontReads, 0);
    assert.equal(f.fonts.calls.length, 0); assert.equal(f.fonts.checks.length, 0);
    if (data.labels) assert.ok(inlineTexts(r.viewport).includes('left'));
    else {
      const ready = await r.engine.prepareXrPresentation(); assert.equal(ready.state, 'ready'); ready.dispose(); await f.settle();
      assert.equal(f.supportQueries.length, 1); assert.equal(f.text.contextRequests, 0); assert.equal(f.text.directionReads, 0);
      assert.equal(f.text.fontReads, 0); assert.equal(f.fonts.calls.length, 0); assert.equal(f.attempts.length, 0);
    }
    await f.cleanup();
  }
});

test('every point axis and tick label reaches actual native geometry beyond the ordinary overlay cap', { timeout: 15_000 }, async t => {
  const data = uniqueData(300); data.labels[0] = ''; data.labels[1] = '   ';
  data.axes = ['x', 'y', 'z'].map(axis => ({ axis, min: -1, max: 1, label: `axis-${axis}`, ticks: [{ value: 0, label: `tick-${axis}` }] }));
  const f = await createLabelFixture(t, { data }), r = f.record, ordinary = inlineLabelMesh(r.viewport), points = pointMesh(r.viewport);
  r.engine.setState(state({ dimmed: new Set([2]) }));
  assert.equal(Object.hasOwn(f.fonts.firstFace, 'variationSettings'), false);
  const globalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const decoy = { createElement: name => f.ownerDocument.createElement(name),
    get fonts() { throw new Error('Preparation must use the mounted owner document, not the global document'); } };
  let prepared;
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: decoy });
  try { prepared = await r.engine.prepareXrPresentation(); }
  finally { Object.defineProperty(globalThis, 'document', globalDocument); }
  const active = await presentLabels(f, { prepared }), meshes = labelMeshes(active.viewport);
  assert.equal(meshes.length, 2); assert.deepEqual(meshes.map(mesh => mesh.geometry.instanceCount), [300, 6]);
  assert.equal(ordinary.parent === undefined || ordinary.parent === null || ordinary.visible === false, true);
  const [pointLabels, axes] = meshes;
  assert.equal(pointLabels.geometry.getAttribute('labelAnchor').array, points.geometry.getAttribute('pointPosition').array);
  assert.equal(pointLabels.geometry.getAttribute('labelRadius').array, points.geometry.getAttribute('pointSize').array);
  const rect = pointLabels.geometry.getAttribute('labelRect');
  for (const row of [0, 1]) assert.deepEqual([rect.getX(row), rect.getY(row), rect.getZ(row), rect.getW(row)], [0, 0, 0, 0]);
  for (let row = 2; row < 300; row++) assert.ok(rect.getZ(row) > rect.getX(row) && rect.getW(row) > rect.getY(row), `Missing label row ${row}`);
  assert.equal(pointLabels.geometry.getAttribute('labelDim').getX(2), Math.fround(.3));
  assert.deepEqual(Array.from(axes.geometry.getAttribute('labelAnchor').array), [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
  const expected = [...data.labels.filter(label => label.trim()), ...data.axes.flatMap(axis => [axis.label, axis.ticks[0].label])].sort();
  assert.deepEqual(f.text.draws.map(draw => draw.text).sort(), expected);
  assert.equal(f.text.draws.every(draw => draw.args.length === 2), true, 'Atlas text is not cropped with fillText maxWidth');
  assert.equal(f.text.draws.every(draw => draw.direction === 'ltr' && draw.textAlign === 'left' && draw.textBaseline === 'middle'), true);
  assert.equal(f.text.canvases.every(entry => entry.canvas.ownerDocument === f.ownerDocument), true);
  assert.equal(f.fonts.readyReads, 0); assert.equal(active.presentation.state, 'presenting'); assert.ok(r.renderReturns > 0);
  await finishLabelPresentation(f, active);
});

test('canonical duplicate labels issue one whole-string font request and atlas draw while retaining all rows', { timeout: 15_000 }, async t => {
  const text = '<b>مرحبا 12 e\u0301 👩‍💻</b>', data = uniqueData(600);
  data.labels.fill(text); data.axes = [{ axis: 'x', min: -1, max: 1, label: text, ticks: [{ value: 0, label: text }] }];
  const f = await createLabelFixture(t, { data }), active = await presentLabels(f), meshes = labelMeshes(active.viewport);
  assert.deepEqual(f.fonts.calls.map(call => call.text), [text]); assert.deepEqual(f.text.measures.map(call => call.text), [text]);
  assert.deepEqual(f.text.draws.map(call => call.text), [text]); assert.equal(f.text.draws[0].args.length, 2);
  assert.deepEqual(meshes.map(mesh => mesh.geometry.instanceCount), [600, 2]);
  const uv = meshes[0].geometry.getAttribute('labelUv');
  for (let row = 1; row < 600; row++) assert.deepEqual([uv.getX(row), uv.getY(row), uv.getZ(row), uv.getW(row)], [uv.getX(0), uv.getY(0), uv.getZ(0), uv.getW(0)]);
  assert.equal(f.fonts.checks.every(call => call.text === text && call.font === f.fonts.calls[0].font), true);
  assert.equal(f.text.measures[0].font, f.fonts.calls[0].font); assert.equal(f.text.draws[0].font, f.fonts.calls[0].font);
  await finishLabelPresentation(f, active);
});

test('unusable text primitives and exact font texture limits refuse without changing the inline scene', { timeout: 15_000 }, async t => {
  const descriptorKeys = ['family', 'style', 'weight', 'stretch', 'unicodeRange', 'featureSettings', 'variationSettings', 'ascentOverride', 'descentOverride', 'lineGapOverride'];
  const fillDescriptor = (face, target) => {
    const others = descriptorKeys.filter(key => key !== 'family').reduce((sum, key) => sum + (typeof face[key] === 'string' ? face[key].length : 0), 0);
    face.family = 'F'.repeat(target - others);
  };
  const invalid = [
    ['missing load', f => { f.fonts.load = undefined; }], ['missing check', f => { f.fonts.check = undefined; }],
    ['missing iteration', f => { f.fonts[Symbol.iterator] = undefined; }], ['missing context', f => { f.text.noContext = true; }],
    ['invalid font assignment', f => { f.text.rejectFont = font => font.includes('Fixture Sans'); }],
    ['missing metric', f => { f.text.metrics = () => ({ actualBoundingBoxLeft: 0, actualBoundingBoxRight: 2, actualBoundingBoxAscent: 1 }); }],
    ['nonfinite metric', f => { f.text.metrics = () => ({ actualBoundingBoxLeft: NaN, actualBoundingBoxRight: 2, actualBoundingBoxAscent: 1, actualBoundingBoxDescent: 1 }); }],
    ['negative summed ink', f => { f.text.metrics = () => ({ actualBoundingBoxLeft: -3, actualBoundingBoxRight: 2, actualBoundingBoxAscent: 1, actualBoundingBoxDescent: 1 }); }],
    ['too many faces', f => { for (let i = 1; i < 257; i++) f.fonts.add(fontFace({ family: `Face ${i}` })); }],
    ['descriptor text overflow', f => { fillDescriptor(f.fonts.firstFace, 65537); }],
    ['requested font overflow', f => { f.record.engine.setStyle({ ...labelStyle, fontFamily: 'F'.repeat(1020) }); }],
    ['texture capability', f => { f.record.viewport.renderer.capabilities.maxTextureSize = 1023; }],
    ['invalid optional descriptor', f => { f.fonts.firstFace.variationSettings = 7; }],
  ];
  for (const [name, apply] of invalid) {
    const f = await createLabelFixture(t), viewport = f.record.viewport, overlay = inlineLabelMesh(viewport); apply(f);
    await assert.rejects(f.record.engine.prepareXrPresentation(), { code: 'unsupported-scene' }, name);
    assertInlineAlive(f, viewport, overlay); await f.cleanup();
  }
  for (const boundary of ['faces', 'descriptors', 'request', 'texture']) {
    const f = await createLabelFixture(t);
    if (boundary === 'faces') for (let i = 1; i < 256; i++) f.fonts.add(fontFace({ family: `Face ${i}` }));
    if (boundary === 'descriptors') fillDescriptor(f.fonts.firstFace, 65536);
    if (boundary === 'request') f.record.engine.setStyle({ ...labelStyle, fontFamily: 'F'.repeat(1019) });
    if (boundary === 'texture') f.record.viewport.renderer.capabilities.maxTextureSize = 1024;
    const ready = await f.record.engine.prepareXrPresentation(); assert.equal(ready.state, 'ready', boundary);
    ready.dispose(); await f.settle(); assertAtlasRetired(f); await f.cleanup();
  }
});

test('unsupported immersive support precedes every targeted font request and atlas allocation', { timeout: 15_000 }, async t => {
  const f = await createLabelFixture(t, { support: false }), viewport = f.record.viewport, overlay = inlineLabelMesh(viewport);
  await assert.rejects(f.record.engine.prepareXrPresentation(), { code: 'unavailable' });
  assert.equal(f.supportQueries.length, 1); assert.equal(f.fonts.calls.length, 0); assert.equal(f.text.contextRequests, 0);
  assert.equal(f.text.canvases.length, 0); assertInlineAlive(f, viewport, overlay);
});

test('disposing with eight pending font loads clears the job before late completions can schedule more work', { timeout: 15_000 }, async t => {
  const f = await createLabelFixture(t, { fonts: 'pending', data: uniqueData(12) }), r = f.record, operation = preparation(r);
  const failure = rejected(operation.promise, 'aborted'); await loadsPending(f, operation, 8);
  assert.equal(f.fonts.pending.length, 8); assert.equal(f.fonts.maxInFlight, 8);
  const before = { calls: f.fonts.calls.length, measures: f.text.measures.length, draws: f.text.draws.length, callbacks: r.callbacks.length };
  r.engine.dispose(); await f.until(() => operation.status !== 'pending'); await failure;
  assert.equal(f.fonts.pending.length, 8, 'Library cancellation does not pretend to cancel browser font operations');
  f.fonts.resolveAll(); await f.settle();
  assert.equal(f.fonts.calls.length, before.calls); assert.equal(f.text.measures.length, before.measures); assert.equal(f.text.draws.length, before.draws);
  assert.equal(r.callbacks.length, before.callbacks); assert.equal(r.viewports.length, 1); assert.equal(f.attempts.length, 0);
  assert.equal(r.engine.positionOf(0), null); assertAtlasRetired(f);
});

test('accepted data style and state changes cancel a pending original tuple and preserve the newest semantics', { timeout: 15_000 }, async t => {
  for (const kind of ['data', 'style', 'state']) {
    const f = await createLabelFixture(t, { fonts: 'pending' }), r = f.record, operation = preparation(r);
    const initialColors = Array.from(pointMesh(r.viewport).geometry.getAttribute('pointColor').array);
    const failure = rejected(operation.promise, 'unsupported-scene'); await loadsPending(f, operation, 4);
    assert.throws(() => r.engine.setData({ positions: new Float32Array([NaN, 0, 0]) }, 1), RangeError);
    if (kind === 'data') r.engine.setData({ positions: new Float32Array([7, 8, 9]), labels: ['newest'] }, 1);
    if (kind === 'style') r.engine.setStyle({ ...labelStyle, fontSize: 19, foreground: '#ff0000' });
    if (kind === 'state') r.engine.setState(state({ dimmed: new Set([0]), focus: 1 }));
    await f.until(() => operation.status !== 'pending'); await failure;
    const calls = f.fonts.calls.length; f.fonts.resolveAll(); await f.settle();
    assert.equal(f.fonts.calls.length, calls); assert.equal(f.text.draws.length, 0); assert.equal(f.attempts.length, 0);
    assert.equal(r.viewport.disposed, false);
    if (kind === 'data') assert.deepEqual(r.engine.positionOf(0), { x: 7, y: 8, z: 9 });
    if (kind === 'style') assert.equal(r.viewport.style.fontSize, 19);
    if (kind === 'state') {
      const colors = Array.from(pointMesh(r.viewport).geometry.getAttribute('pointColor').array);
      for (let channel = 0; channel < 3; channel++) assert.ok(Math.abs(colors[channel] - initialColors[channel] * .3) < 1e-6);
      assert.notDeepEqual(colors.slice(3, 6), initialColors.slice(3, 6)); assert.equal(colors.every(Number.isFinite), true);
    }
    assertAtlasRetired(f); await f.cleanup();
  }
});

test('direction changes during loading and at ready entry refuse the captured direction without a new request', { timeout: 15_000 }, async t => {
  for (const stage of ['loading', 'ready']) {
    const f = await createLabelFixture(t, { fonts: stage === 'loading' ? 'pending' : undefined }), r = f.record;
    if (stage === 'loading') {
      const operation = preparation(r), failure = rejected(operation.promise, 'unsupported-scene'); await loadsPending(f, operation, 4);
      f.direction = 'rtl'; f.fonts.resolveAll(); await failure;
    } else {
      const ready = await r.engine.prepareXrPresentation(); f.direction = 'rtl';
      await assert.rejects(r.enter(ready), { code: 'unsupported-scene' }); ready.dispose();
    }
    assert.equal(f.attempts.length, 0); assert.equal(r.viewport.disposed, false);
    assert.equal(f.text.draws.every(draw => draw.direction === 'ltr'), true); await f.cleanup();
  }
});

test('font changes during targeted loading enter the final inventory only when every current run is ready', { timeout: 15_000 }, async t => {
  for (const status of ['loaded', 'unloaded']) {
    const f = await createLabelFixture(t, { fonts: 'pending' }), r = f.record, operation = preparation(r);
    const failure = status === 'unloaded' ? rejected(operation.promise, 'unsupported-scene') : undefined;
    await loadsPending(f, operation, 4); f.fonts.add(fontFace({ family: 'Fixture Sans', weight: 'bold', status }));
    f.fonts.resolveAll();
    if (failure) { await failure; assert.equal(f.text.draws.length, 0); }
    else { const ready = await operation.promise; assert.equal(ready.state, 'ready'); assert.equal(f.text.draws.length, 4); ready.dispose(); }
    assert.equal(f.fonts.calls.length, 4, 'A changed inventory must not trigger another loading round');
    assert.equal(f.fonts.readyReads, 0); assert.equal(f.attempts.length, 0); assert.equal(r.viewport.disposed, false); await f.cleanup();
  }
});

test('font membership descriptor status and optional-presence changes invalidate raster work and ready entry', { timeout: 15_000 }, async t => {
  const mutations = [f => f.fonts.add(fontFace({ family: 'Added' })), f => { f.fonts.firstFace.weight = 'bold'; },
    f => { f.fonts.firstFace.status = 'loading'; }, f => { f.fonts.firstFace.variationSettings = 'normal'; }];
  for (const mutate of mutations) for (const stage of ['raster', 'ready']) {
    const f = await createLabelFixture(t), r = f.record;
    if (stage === 'raster') {
      f.text.onMeasure = () => { f.text.onMeasure = undefined; mutate(f); };
      await assert.rejects(r.engine.prepareXrPresentation(), { code: 'unsupported-scene' });
      assert.ok(f.text.measures.length > 0, 'Mutation occurs after the targeted-load inventory was captured');
    } else {
      const ready = await r.engine.prepareXrPresentation(); mutate(f);
      await assert.rejects(r.enter(ready), { code: 'unsupported-scene' }); ready.dispose();
    }
    assert.equal(f.attempts.length, 0); assert.equal(r.viewport.disposed, false); await f.cleanup();
  }
});

test('unused presentation disposal followed immediately by engine disposal retires each candidate and inline owner once', { timeout: 15_000 }, async t => {
  const f = await createLabelFixture(t), r = f.record, old = r.viewport, ordinary = inlineLabelMesh(old), observations = f.observeDisposals();
  const ready = await r.engine.prepareXrPresentation();
  assert.equal(ready.state, 'ready'); assert.ok(f.text.draws.length > 0); assert.equal(labelMeshes(old).length, 0);
  ready.dispose(); r.engine.dispose(); await f.settle();
  const candidateGeometries = [...observations.geometry.keys()].filter(geometry => geometry.getAttribute('labelRect'));
  assert.equal(candidateGeometries.length, 2);
  for (const counts of Object.values(observations)) for (const count of counts.values()) assert.equal(count, 1);
  assert.equal(observations.geometry.get(ordinary.geometry), 1); assert.equal(observations.material.get(ordinary.material), 1);
  assert.equal(r.disposals, 1); assert.equal(r.currentGL().state.releaseRequests, 1); assert.equal(r.currentGL().isContextLost(), true);
  assert.equal(f.attempts.length, 0);
  assert.equal(r.viewports.length, 1); assertAtlasRetired(f);
});

test('both native layer branches transfer labels and request synchronously before application callbacks with no text work at entry', { timeout: 15_000 }, async t => {
  for (const branch of ['legacy', 'projection']) {
    const f = await createLabelFixture(t, { branch }), r = f.record, old = r.viewport, ordinary = inlineLabelMesh(old);
    const ready = await r.engine.prepareXrPresentation({ onStateChange: value => f.trace.push(`state:${value}`) });
    const before = [f.fonts.calls.length, f.fonts.checks.length, f.text.measures.length, f.text.draws.length, f.text.contextRequests];
    const entry = r.enter(ready); void entry.catch(() => {}); const attempt = f.attempts.at(-1);
    assert.equal(f.attempts.length, 1); assert.ok(f.trace.indexOf('native-request') < f.trace.indexOf('state:requesting'));
    assert.equal(old.disposed, true); assert.equal(old.canvas.parent, undefined); assert.equal(labelMeshes(old).length, 2);
    assert.equal(ordinary.parent === undefined || ordinary.parent === null || ordinary.visible === false, true);
    assert.deepEqual([f.fonts.calls.length, f.fonts.checks.length, f.text.measures.length, f.text.draws.length, f.text.contextRequests], before);
    const returns = r.renderReturns; await attempt.bind(); attempt.deliver(false); await f.settle(); assert.equal(r.renderReturns, returns);
    attempt.deliver(); await entry; assert.ok(r.renderReturns > returns); assert.equal(ready.state, 'presenting');
    assert.ok(f.trace.includes(branch === 'legacy' ? 'legacy-layer' : 'projection-layer'));
    await finishLabelPresentation(f, { record: r, presentation: ready, entry, attempt, viewport: old }); await f.cleanup();
  }
});

test('semantic changes during requesting and presenting recover only the latest labels after native retirement', { timeout: 15_000 }, async t => {
  for (const stage of ['requesting', 'presenting']) {
    const f = await createLabelFixture(t), r = f.record; let reentered = false;
    const options = { onStateChange(value) { if (value === 'ending' && !reentered) {
      reentered = true; r.engine.setData({ positions: new Float32Array([.25, 0, 0]), labels: ['latest'] }, 2);
    } } };
    const active = stage === 'presenting' ? await presentLabels(f, options) : await startLabelPresentation(f, options);
    const failure = stage === 'requesting' ? rejected(active.entry, 'aborted') : undefined;
    const renders = r.renderReturns, old = r.viewport;
    r.engine.setData({ positions: new Float32Array([-.25, 0, 0]), labels: ['superseded'] }, 1);
    r.engine.setState(state({ focus: 0 })); r.engine.setStyle({ ...labelStyle, foreground: '#00ff00' }); r.engine.resize(820, 460);
    if (failure) await failure;
    assert.equal(reentered, true); assert.deepEqual(r.engine.positionOf(0), { x: .25, y: 0, z: 0 });
    if (stage === 'requesting') { active.attempt.grant(); await f.until(() => active.attempt.session.endCalls === 1); assert.equal(active.attempt.referenceCalls.length, 0); }
    active.attempt.deliver(); await f.settle(); assert.equal(r.renderReturns, renders); assert.equal(r.disposals, 0);
    const next = await finishLabelPresentation(f, active);
    assert.notEqual(next, old); assert.deepEqual([next.width, next.height], [820, 460]);
    assert.ok(inlineTexts(next).includes('latest')); assert.equal(inlineTexts(next).includes('superseded'), false);
    assert.equal(labelMeshes(next).length, 0); assert.equal(next.renderer.getRenderTarget(), null);
    assert.ok(f.trace.lastIndexOf('renderer-return') < f.trace.lastIndexOf('host:restored')); await f.cleanup();
  }
});

test('transferred atlases remain immutable after document typography changes until an engine setter ends presentation', { timeout: 15_000 }, async t => {
  const f = await createLabelFixture(t), active = await presentLabels(f), r = f.record, meshes = labelMeshes(active.viewport);
  const arrays = meshes.map(mesh => Array.from(mesh.geometry.getAttribute('labelRect').data.array));
  const before = [f.text.fontReads, f.text.directionReads, f.fonts.calls.length, f.fonts.checks.length, f.text.draws.length, f.text.measures.length];
  f.direction = 'rtl'; f.fonts.firstFace.family = 'Changed'; f.fonts.add(fontFace({ family: 'Later', status: 'unloaded' }));
  const renders = r.renderReturns; active.attempt.deliver(); await f.settle();
  assert.equal(active.presentation.state, 'presenting'); assert.equal(active.attempt.session.endCalls, 0); assert.ok(r.renderReturns > renders);
  assert.deepEqual([f.text.fontReads, f.text.directionReads, f.fonts.calls.length, f.fonts.checks.length, f.text.draws.length, f.text.measures.length], before);
  assert.deepEqual(meshes.map(mesh => Array.from(mesh.geometry.getAttribute('labelRect').data.array)), arrays);
  r.engine.setState(state({ dimmed: new Set([0]) })); assert.equal(active.presentation.state, 'ending');
  await finishLabelPresentation(f, active); assert.ok(inlineLabelMesh(r.viewport));
});

test('handoff binding and retirement failures keep sole label ownership and preserve quarantine on incomplete cleanup', { timeout: 15_000 }, async t => {
  for (const phase of ['handoff', 'binding', 'retirement']) {
    const f = await createLabelFixture(t), r = f.record, old = r.viewport, observations = f.observeDisposals();
    const ready = await r.engine.prepareXrPresentation(); let injected = 0;
    const add = old.world.add;
    if (phase === 'handoff') old.world.add = function (...objects) {
      const result = add.apply(this, objects);
      if (objects.some(object => object.geometry?.getAttribute('labelRect'))) { injected++; throw new Error('Controlled label attachment failure'); }
      return result;
    };
    const entry = r.enter(ready); void entry.catch(() => {});
    if (phase === 'handoff') {
      await rejected(entry, 'failed'); old.world.add = add; assert.equal(injected, 1); assert.equal(f.attempts.length, 0);
      const exit = ready.exit(); void exit.catch(() => {});
      await f.until(() => old.renderer.getContext().state.releaseRequests === 1); assert.equal(r.viewports.length, 1);
      f.lose(); await exit; await f.until(() => r.viewports.length === 2);
    } else {
      const attempt = f.attempts.at(-1);
      if (phase === 'binding') {
        const failure = rejected(entry, 'failed'); attempt.grant(); await f.settle(); attempt.compatibility.reject(new Error('Controlled compatibility failure'));
        await failure; await f.until(() => attempt.session.endCalls === 1);
        await finishLabelPresentation(f, { record: r, presentation: ready, entry, attempt, viewport: old });
      } else {
        await attempt.bind(); attempt.deliver(); await entry;
        const labels = labelMeshes(old); assert.equal(labels.length, 2);
        labels[0].geometry.addEventListener('dispose', () => { injected++; throw new Error('Controlled label retirement failure'); });
        const exit = ready.exit(), failure = rejected(exit, 'failed'); attempt.ending.resolve(); attempt.endEvent();
        await f.until(() => old.renderer.getContext().state.releaseRequests === 1); assert.equal(r.viewports.length, 1);
        f.lose(); await failure; await f.settle(); assert.equal(injected, 1); assert.equal(r.viewports.length, 1);
        for (const mesh of labels) { assert.equal(observations.geometry.get(mesh.geometry), 1); assert.equal(observations.material.get(mesh.material), 1); }
        const other = await f.createRecord({ positions: new Float32Array([0, 0, 0]) }), prepared = await other.engine.prepareXrPresentation();
        await assert.rejects(other.enter(prepared), { code: 'busy' }); assert.equal(other.viewport.disposed, false); prepared.dispose();
      }
    }
    for (const [geometry, count] of observations.geometry) if (geometry.getAttribute('labelRect')) assert.equal(count, 1);
    assertAtlasRetired(f); await f.cleanup();
  }

  // Exercise the private job's exact error boundary only after the real engine paths above.
  const f = await createLabelFixture(t), r = f.record;
  const { preparePointsXrLabels } = await import('../dist/points/xr-labels.js');
  const { createPointsXrAllocationAccount } = await import('../dist/points/xr-label-layout.js');
  for (const fault of ['validate', 'schedule', 'cancel']) {
    const original = new Error(`Controlled ${fault} callback failure`), reporting = new Error('Controlled reporter failure'), reports = [], queued = [];
    const account = createPointsXrAllocationAccount();
    const data = admitPointsData({ positions: new Float32Array(), axes: [{ axis: 'x', min: 0, max: 1,
      ticks: Array.from({ length: 24 }, (_, index) => ({ value: index / 24, label: `fault-${index}` })) }] });
    const job = preparePointsXrLabels({ identity: Object.freeze({}), data, style: r.viewport.style, state: state(),
      pointResources: undefined, ownerDocument: f.ownerDocument, container: r.container, maxTextureSize: 4096, account,
      validate() { if (fault === 'validate') throw original; return null; },
      schedule(callback) { if (fault === 'schedule') throw original; queued.push(callback); return () => { if (fault === 'cancel') throw original; }; },
      report(error) { reports.push(error); throw reporting; },
    });
    const failure = rejected(job.done, fault === 'cancel' ? 'aborted' : 'failed');
    if (fault === 'validate') {
      let settled = false;
      void job.done.then(() => { settled = true; }, () => { settled = true; });
      for (let turn = 0; turn < 8 && !settled; turn++) {
        for (let step = 0; step < 8 && queued.length && !settled; step++) queued.shift()();
        await f.settle();
      }
      assert.equal(settled, true, 'Validation may run synchronously or in the first scheduled task');
    }
    if (fault === 'cancel') { await f.until(() => queued.length > 0); job.cancel('aborted'); }
    await failure; assert.equal(reports.filter(error => error === original).length, 1); assert.equal(account.usedBytes, 0);
    const before = [f.fonts.calls.length, f.text.measures.length, f.text.draws.length];
    for (const callback of queued) callback(); await f.settle();
    assert.deepEqual([f.fonts.calls.length, f.text.measures.length, f.text.draws.length], before);
  }
});

test('recovery waits for a successful nonzero default-target draw and disposal prevents all late remounts', { timeout: 15_000 }, async t => {
  const f = await createLabelFixture(t), r = f.record;
  for (let cycle = 0; cycle < 10; cycle++) {
    const active = await presentLabels(f), old = active.viewport;
    if (cycle === 0) r.engine.resize(0, 0);
    const next = await finishLabelPresentation(f, active, { recover: cycle !== 0 });
    if (cycle === 0) {
      await f.until(() => r.viewports.length === 2); assert.equal(callbackCount(r, 'restored'), 0);
      await assert.rejects(r.engine.prepareXrPresentation(), { code: 'busy' });
      r.engine.resize(640, 480); await f.until(() => callbackCount(r, 'restored') === 1);
    }
    assert.notEqual(r.viewport, old); assert.equal(next.renderer.getRenderTarget(), null); assert.equal(labelMeshes(r.viewport).length, 0);
    assert.ok(inlineTexts(r.viewport).includes('left')); assert.ok(inlineTexts(r.viewport).includes('axis'));
    assert.equal(callbackCount(r, 'restored'), cycle + 1); assert.equal(active.attempt.session.endListeners.size, 0);
    assert.equal(active.attempt.session.frames.size, 0); assertAtlasRetired(f);
  }
  assert.equal(r.viewports.length, 11); assert.equal(r.disposals, 10);
  const states = [], active = await startLabelPresentation(f, { onStateChange: value => states.push(value) });
  const failure = rejected(active.entry, 'aborted'), callbacks = r.callbacks.length, stateCount = states.length;
  r.engine.dispose(); await failure; const exit = active.presentation.exit(); void exit.catch(() => {});
  active.attempt.grant(); await f.until(() => active.attempt.session.endCalls === 1);
  active.attempt.ending.resolve(); active.attempt.endEvent(); await f.until(() => active.viewport.renderer.getContext().state.releaseRequests === 1);
  f.lose(); await exit; await f.settle();
  assert.equal(r.viewports.length, 11); assert.equal(r.callbacks.length, callbacks); assert.equal(states.length, stateCount);
  assert.equal(r.container.children.length, 0); assert.equal(r.engine.positionOf(0), null); assertAtlasRetired(f);
  assert.deepEqual(f.queues(), { inline: 0, native: 0 });
});
