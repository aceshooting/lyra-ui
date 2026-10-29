import assert from 'node:assert/strict';
import test from 'node:test';
import { captureSceneGlyphObservation } from '../src/scene/bridge-glyph.mjs';
import { mapSceneAnchorPixel } from '../src/scene/completion-observation.mjs';
import { createObservationFixture } from './fixtures/scene-completion-observation.mjs';

const calls = (item, name) => item.gpu.calls.filter(call => call[0] === name);
const live = (item, kind) => [...item.gpu.created].filter(value => value.kind === kind && !item.gpu.deleted.has(value));
const mode = draw => draw.uniforms.u_lr_observation_mode?.[0];
const refuse = item => {
  const created = item.gpu.created.size, draws = item.gpu.draws.length;
  assert.doesNotThrow(() => assert.equal(item.issue(), undefined));
  assert.equal(item.gpu.created.size, created); assert.equal(item.gpu.draws.length, draws);
  assert.equal(item.completed.length, 0);
};
const settled = item => { const issue = item.issue(); assert.ok(issue); item.finish(); item.settle(); return issue; };
const allocation = (width = 640, height = 480, backingWidth = width, backingHeight = height) => ({ width, height, backingWidth, backingHeight });

// Admission: six cases. Existing point-envelope baseline tests remain authoritative for ordinary drawing.
test('observation admits the current default target and retains exact native depth range and scissor', () => {
  const item = createObservationFixture(); item.gpu.state.set('DEPTH_RANGE', [0.125, 0.875]); item.begin();
  const before = item.gpu.snapshot(), offset = item.gpu.draws.length; settled(item);
  assert.equal(item.completed.length, 1); assert.deepEqual(item.gpu.snapshot(), before);
  for (const draw of item.gpu.draws.slice(offset)) {
    assert.deepEqual(draw.state.values.find(([key]) => key === 'DEPTH_RANGE')[1], [0.125, 0.875]);
    assert.deepEqual(draw.state.values.find(([key]) => key === 'SCISSOR_BOX')[1], before.values.find(([key]) => key === 'SCISSOR_BOX')[1]);
    assert.deepEqual(draw.state.values.find(([key]) => key === 'COLOR_WRITEMASK')[1], [false, false, false, false]);
    assert.equal(draw.state.values.find(([key]) => key === 'DEPTH_WRITEMASK')[1], false);
  }
  item.stop();
});

test('observation refuses a nondefault draw or read framebuffer before acquisition', () => {
  for (const binding of ['DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING']) {
    const item = createObservationFixture(); item.begin(); item.gpu.state.set(binding, item.gpu.nativeFramebuffer);
    refuse(item); item.finish(); item.stop();
  }
});

test('observation refuses viewport and validated backing disagreement before acquisition', () => {
  const item = createObservationFixture(); item.begin(); item.gpu.state.set('VIEWPORT', [0, 0, 320, 480]);
  refuse(item); item.finish(); item.stop();
});

test('observation refuses changed reversed or nonstandard native depth without changing policy', () => {
  for (const [parameter, value] of [['DEPTH_FUNC', 'ALWAYS'], ['DEPTH_RANGE', [1, 0]], ['DEPTH_RANGE', [0.4, 0.4]], ['DEPTH_RANGE', [0.125, 0.875]]]) {
    const item = createObservationFixture(); item.begin(); item.gpu.state.set(parameter, value);
    const before = item.gpu.snapshot(); refuse(item); assert.deepEqual(item.gpu.snapshot(), before); item.finish(); item.stop();
  }
});

test('foreign sample and timer queries are refused without ending or deleting them', () => {
  for (const target of ['ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE', 'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN', 'timer']) {
    const item = createObservationFixture(); item.begin();
    if (target === 'timer') item.gpu.setTimerQuery(true); else item.gpu.foreignQuery(item.gl[target]);
    refuse(item); assert.equal(calls(item, 'endQuery').length, 0); assert.equal(calls(item, 'deleteQuery').length, 0);
    item.gpu.queries.clear(); item.gpu.setTimerQuery(false); item.finish(); item.stop();
  }
});

test('active and paused transform feedback refuse observation without resuming or ending it', () => {
  for (const paused of [false, true]) {
    const item = createObservationFixture(); item.begin(); item.gpu.state.set('TRANSFORM_FEEDBACK_ACTIVE', true);
    item.gpu.state.set('TRANSFORM_FEEDBACK_PAUSED', paused); refuse(item);
    assert.equal(item.gpu.state.get('TRANSFORM_FEEDBACK_ACTIVE'), true); assert.equal(item.gpu.state.get('TRANSFORM_FEEDBACK_PAUSED'), paused);
    item.gpu.state.set('TRANSFORM_FEEDBACK_ACTIVE', false); item.gpu.state.set('TRANSFORM_FEEDBACK_PAUSED', false); item.finish(); item.stop();
  }
});

// Exact query lifecycle: eight cases.
test('only the original current glyph plan and native authority can issue closed observation work', () => {
  const item = createObservationFixture(); item.begin(); const before = item.gpu.created.size;
  for (const plan of [{}, { ...item.plan }, Object.create(item.plan)]) assert.equal(item.observation.issue({ plan, authority: item.authority }), undefined);
  assert.equal(item.observation.issue({ plan: item.plan, authority: {} }), undefined);
  const other = createObservationFixture(); other.begin(); const otherBefore = other.gpu.created.size;
  assert.equal(item.issue({ plan: item.plan, authority: other.authority }), undefined);
  assert.equal(item.issue({ plan: other.plan, authority: item.authority }), undefined);
  assert.equal(other.issue({ plan: other.plan, authority: item.authority }), undefined);
  assert.equal(other.issue({ plan: item.plan, authority: other.authority }), undefined);
  assert.equal(other.gpu.created.size, otherBefore); other.finish(); other.stop();
  assert.equal(item.gpu.created.size, before); const oldPlan = item.plan;
  settled(item); assert.equal(item.completed.length, 1);
  item.open();
  assert.throws(() => captureSceneGlyphObservation(item.renderer, item.frame, item.marker, item.authority),
    { name: 'TypeError', message: 'Scene glyph rendering is unavailable.' }, 'a fresh authority cannot relabel an older paint');
  assert.equal(item.issue({ plan: oldPlan, authority: item.authority }), undefined); item.finish();
  item.begin(); const latest = item.gpu.created.size;
  assert.equal(item.issue({ plan: oldPlan, authority: item.authority }), undefined);
  assert.equal(item.gpu.created.size, latest);
  const currentPlan = captureSceneGlyphObservation(item.renderer, item.frame, item.marker, item.authority);
  assert.equal(currentPlan, item.plan, 'capture retrieves the exact last paint record');
  settled(item); assert.equal(item.completed.length, 2); item.stop();
});

test('paired anchor and object queries begin and end sequentially on the exact sample target', () => {
  const item = createObservationFixture(); item.begin(); const offset = item.gpu.calls.length; const issue = settled(item);
  assert.ok(Object.isFrozen(issue)); assert.deepEqual(Reflect.ownKeys(issue), []);
  const sequence = item.gpu.calls.slice(offset).filter(call => ['beginQuery', 'endQuery'].includes(call[0]));
  assert.deepEqual(sequence.map(call => call[0]), ['beginQuery', 'endQuery', 'beginQuery', 'endQuery']);
  assert.ok(sequence.every(call => call[1] === item.gl.ANY_SAMPLES_PASSED));
  assert.notEqual(sequence[0][2], sequence[2][2]); assert.equal(item.gpu.queries.size, 0); item.stop();
});

test('unavailable query results are never read or published synchronously', () => {
  const item = createObservationFixture(); item.begin(); item.issue(); item.finish();
  for (let i = 0; i < 3; i++) item.raf.step();
  assert.ok(calls(item, 'getQueryParameter').some(call => call[2] === item.gl.QUERY_RESULT_AVAILABLE));
  assert.equal(calls(item, 'getQueryParameter').some(call => call[2] === item.gl.QUERY_RESULT), false);
  assert.equal(item.completed.length, 0); item.settle(); assert.equal(item.completed.length, 1); item.stop();
});

test('anchor and object outcomes remain separate in all four query truth-table combinations', () => {
  for (const [anchor, object] of [[true, true], [true, false], [false, true], [false, false]]) {
    const item = createObservationFixture(); item.begin(); const issue = item.issue(); item.finish(); item.settle([anchor, object]);
    assert.equal(item.completed.length, 1); assert.equal(item.completed[0].issue, issue);
    assert.deepEqual(item.completed[0].result, { anchor, object }); assert.ok(Object.isFrozen(item.completed[0].result)); item.stop();
  }
});

test('zero-alpha object observation retains a coverage mode distinct from its anchor query', () => {
  const item = createObservationFixture({ alpha: 0 }); item.begin(); const offset = item.gpu.draws.length;
  assert.deepEqual(item.paintCounts, { created: 0, draws: 0 }, 'transparent paint stays allocation and draw free before opted-in preparation');
  assert.equal(offset, 0, 'completion preparation does not paint color');
  item.issue(); item.finish(); item.settle([true, false]);
  const draws = item.gpu.draws.slice(offset); assert.equal(draws.length, 2);
  assert.deepEqual(draws.map(mode), [1, 2]); assert.equal(draws[1].uniforms.u_lr_color[3], 0);
  assert.deepEqual(item.completed[0].result, { anchor: true, object: false }); item.stop();
  let entered = false, snapshot;
  const failing = createObservationFixture({ alpha: 0, beforeCapture(gpu) {
    snapshot = gpu.snapshot(); gpu.beforeCall = name => {
      if (name === 'compileShader') { entered = true; throw new Error('private shader failure'); }
    };
  } });
  assert.throws(() => failing.begin(), { name: 'TypeError', message: 'Scene glyph rendering is unavailable.' });
  failing.gpu.beforeCall = undefined; assert.equal(entered, true);
  assert.deepEqual(failing.gpu.snapshot(), snapshot); assert.equal(failing.gpu.draws.length, 0);
  failing.finish(false); failing.stop();
});

test('observed loss at query allocation begin draw or end stops every later raw GL operation', () => {
  for (const boundary of ['createQuery', 'beginQuery', 'drawArrays', 'endQuery']) {
    const item = createObservationFixture(); item.begin(); let fired = false;
    item.gpu.afterCall = name => { if (!fired && name === boundary) { fired = true; item.gpu.lose(); } };
    assert.doesNotThrow(() => item.issue()); assert.equal(fired, true); item.gpu.afterCall = undefined;
    const lostAt = item.gpu.calls.findIndex(call => call[0] === 'context-loss');
    item.raf.step(); item.observation.dispose({ contextLost: true });
    assert.ok(item.gpu.calls.slice(lostAt + 1).every(call => call[0] === 'isContextLost'));
    assert.equal(item.completed.length, 0); item.stop();
  }
});

test('live throwing query draw ends only the owned query and independently restores entry state', () => {
  const item = createObservationFixture(); item.begin(); const before = item.gpu.snapshot(); let fired = false;
  item.gpu.beforeCall = name => { if (!fired && name === 'drawArrays') { fired = true; throw new Error('draw refused'); } };
  assert.doesNotThrow(() => item.issue()); item.gpu.beforeCall = undefined;
  assert.equal(fired, true); assert.equal(item.gpu.queries.size, 0); assert.deepEqual(item.gpu.snapshot(), before);
  assert.equal(item.completed.length, 0); assert.equal(item.unavailable.length, 1);
  assert.equal(item.unavailable[0].code, 'completion-unavailable');
  assert.ok(Object.isFrozen(item.unavailable[0].issue)); assert.deepEqual(Reflect.ownKeys(item.unavailable[0].issue), []);
  item.finish(); item.stop(); assert.equal(item.unavailable.length, 1);
});

test('a query ownership mismatch never ends an unrelated active query', () => {
  const item = createObservationFixture(); item.begin(); let foreign, fired = false;
  item.gpu.afterCall = name => {
    if (!fired && name === 'beginQuery') { fired = true; foreign = item.gpu.foreignQuery(); }
  };
  const before = calls(item, 'endQuery').length; assert.doesNotThrow(() => item.issue()); item.gpu.afterCall = undefined;
  assert.equal(item.gpu.queries.get(item.gl.ANY_SAMPLES_PASSED), foreign); assert.equal(calls(item, 'endQuery').length, before);
  assert.equal(item.completed.length, 0); item.gpu.lose(); item.stop();
});

// Restoration and retained capacity: six cases.
test('the declared raster and binding inventory is restored after completed observation', () => {
  const item = createObservationFixture(); item.begin(); const before = item.gpu.snapshot(); settled(item);
  assert.deepEqual(item.gpu.snapshot(), before); assert.equal(live(item, 'Query').length, 0); assert.equal(live(item, 'Sync').length, 0);
  assert.equal(item.completed.length, 1); item.stop();
});

test('one failed restoration group cannot skip independent later live groups or publish', () => {
  const item = createObservationFixture(); item.begin(); const before = item.gpu.snapshot(); let ended = 0, failed = false;
  const originalMask = before.values.find(([key]) => key === 'COLOR_WRITEMASK')[1];
  item.gpu.afterCall = name => { if (name === 'endQuery') ended++; };
  item.gpu.beforeCall = (name, args) => {
    if (ended === 2 && !failed && name === 'colorMask' && args.every((value, index) => value === originalMask[index])) {
      failed = true; throw new Error('restore refused');
    }
  };
  assert.doesNotThrow(() => item.issue()); item.gpu.beforeCall = undefined; item.gpu.afterCall = undefined;
  assert.equal(failed, true); assert.equal(item.gpu.state.get('CURRENT_PROGRAM'), before.values.find(([key]) => key === 'CURRENT_PROGRAM')[1]);
  assert.equal(item.gpu.state.get('VERTEX_ARRAY_BINDING'), before.values.find(([key]) => key === 'VERTEX_ARRAY_BINDING')[1]);
  assert.equal(item.gpu.state.get('DEPTH_WRITEMASK'), before.values.find(([key]) => key === 'DEPTH_WRITEMASK')[1]);
  item.finish(); item.settle(); assert.equal(item.completed.length, 0); item.stop();
});

test('actual framebuffer drift during query work refuses the candidate without rebinding native targets', () => {
  const item = createObservationFixture(); item.begin(); let changed = false;
  item.gpu.afterCall = name => { if (!changed && name === 'drawArrays') { changed = true; item.gpu.state.set('DRAW_FRAMEBUFFER_BINDING', item.gpu.nativeFramebuffer); } };
  assert.doesNotThrow(() => item.issue()); item.gpu.afterCall = undefined; item.finish(); item.settle();
  assert.equal(item.completed.length, 0); assert.equal(calls(item, 'bindFramebuffer').length, 0);
  item.gpu.state.set('DRAW_FRAMEBUFFER_BINDING', null); item.stop();
});

test('failed query deletion remains charged across replacement attempts and cannot exceed eight handles', () => {
  const item = createObservationFixture(); item.gpu.beforeCall = name => { if (name === 'deleteQuery') throw new Error('delete refused'); };
  for (let i = 0; i < 6; i++) {
    item.begin(); item.issue(); item.finish(); item.observation.invalidate();
    assert.ok(live(item, 'Query').length <= 8, 'failed retirement is included in the handle cap');
    assert.equal(live(item, 'Sync').length, 0, 'query retirement failure cannot skip independent sync cleanup');
    const attempted = new Set(calls(item, 'deleteQuery').map(call => call[1]));
    assert.ok(live(item, 'Query').every(query => attempted.has(query)), 'each independent query retirement is attempted');
  }
  assert.ok(live(item, 'Query').length > 0); const count = calls(item, 'createQuery').length;
  item.begin(); item.issue(); item.finish(); assert.equal(calls(item, 'createQuery').length, count, 'full retained capacity blocks replacement');
  item.gpu.beforeCall = undefined; item.observation.dispose(); assert.equal(item.observation.retired(), true); item.stop();
});

test('failed sync deletion keeps the one-sync capacity occupied across replacement', () => {
  const item = createObservationFixture(); item.begin(); item.issue(); item.finish();
  item.gpu.beforeCall = name => { if (name === 'deleteSync') throw new Error('sync delete refused'); };
  item.observation.invalidate(); assert.equal(live(item, 'Sync').length, 1);
  assert.equal(live(item, 'Query').length, 0, 'sync retirement failure cannot skip independent query cleanup');
  assert.equal(new Set(calls(item, 'deleteQuery').map(call => call[1])).size, 2);
  const queries = calls(item, 'createQuery').length, syncs = calls(item, 'fenceSync').length;
  item.begin(); assert.equal(item.issue(), undefined); item.finish();
  assert.equal(calls(item, 'createQuery').length, queries); assert.equal(calls(item, 'fenceSync').length, syncs);
  item.gpu.beforeCall = undefined; item.observation.dispose(); assert.equal(item.observation.retired(), true); item.stop();
});

test('actual loss retires retained query and sync ownership without issuing lost-context deletes', () => {
  const item = createObservationFixture(); item.begin(); item.issue(); item.finish();
  item.gpu.beforeCall = name => { if (name === 'deleteQuery' || name === 'deleteSync') throw new Error('retained'); };
  item.observation.dispose(); assert.equal(item.observation.retired(), false); item.gpu.beforeCall = undefined; item.gpu.lose();
  const offset = item.gpu.calls.length; item.observation.dispose({ contextLost: true });
  assert.equal(item.observation.retired(), true); assert.ok(item.gpu.calls.slice(offset).every(call => call[0] === 'isContextLost'));
  assert.equal(item.completed.length, 0); item.stop();
});

// Read-only polling and completed publication: six cases.
test('GPU polling neither draws nor begins another query or native paint', () => {
  const item = createObservationFixture(); item.begin(); item.issue(); item.finish();
  const draws = item.gpu.draws.length, queries = calls(item, 'beginQuery').length, created = item.gpu.created.size;
  for (let i = 0; i < 4; i++) item.raf.step();
  assert.equal(item.gpu.draws.length, draws); assert.equal(calls(item, 'beginQuery').length, queries);
  assert.equal(item.gpu.created.size, created); assert.equal(item.completed.length, 0); item.stop();
});

test('one in-flight issue owns at most one RAF callback and cannot be replaced by repeated issue calls', () => {
  const item = createObservationFixture(); item.begin(); const first = item.issue(); assert.ok(first);
  const queries = calls(item, 'createQuery').length;
  for (let i = 0; i < 5; i++) assert.equal(item.issue(), undefined);
  assert.equal(calls(item, 'createQuery').length, queries); assert.equal(item.raf.pending, 1);
  item.finish(); for (let i = 0; i < 4; i++) { item.raf.step(); assert.ok(item.raf.pending <= 1); }
  item.stop(); assert.equal(item.raf.pending, 0);
});

test('polling does not inspect completion in the issue task and uses zero-timeout sync reads', () => {
  const item = createObservationFixture(); item.begin(); item.issue();
  assert.equal(calls(item, 'getQueryParameter').length, 0); assert.equal(calls(item, 'clientWaitSync').length, 0);
  item.finish(); item.raf.step();
  assert.ok(calls(item, 'clientWaitSync').every(call => call[2] === 0 && call[3] === 0));
  assert.equal(calls(item, 'finish').length, 0); assert.ok(item.raf.pending <= 1); item.stop();
});

test('available paired results cannot bypass an unsignaled completion fence', () => {
  const item = createObservationFixture(); item.begin(); item.issue(); item.finish();
  item.gpu.settleQueries([true, true]); item.gpu.setFenceStatus(item.gl.TIMEOUT_EXPIRED); item.raf.step();
  assert.equal(item.completed.length, 0); item.gpu.setFenceStatus(undefined); item.settle();
  assert.equal(item.completed.length, 1); item.stop();
});

test('timeout and hidden cancellation deliver no frame and cannot autonomously restart observation', () => {
  for (const reason of ['callback-limit', 'time-limit', 'hidden']) {
    const item = createObservationFixture(); item.begin(); const issue = item.issue(); assert.ok(issue); item.finish();
    if (reason === 'hidden') item.observation.setVisible(false);
    else if (reason === 'time-limit') item.raf.step(2001);
    else for (let i = 0; i < 121; i++) item.raf.step(0);
    const queries = calls(item, 'createQuery').length; assert.equal(item.raf.pending, 0); assert.equal(item.completed.length, 0);
    for (let i = 0; i < 4; i++) item.raf.step();
    assert.equal(calls(item, 'createQuery').length, queries);
    assert.deepEqual(item.unavailable, reason === 'hidden' ? [] : [{ issue, code: 'completion-unavailable' }]);
    item.stop(); assert.deepEqual(item.unavailable, reason === 'hidden' ? [] : [{ issue, code: 'completion-unavailable' }]);
  }
});

test('GPU availability cannot publish without normal native tail sealing and final currentness', () => {
  for (const reason of ['unsealed', 'native-abort', 'stale-input']) {
    const item = createObservationFixture(); item.begin(); item.issue();
    if (reason === 'native-abort') item.finish(false);
    else if (reason === 'stale-input') { item.finish(); item.expire(); }
    item.settle(); assert.equal(item.completed.length, 0);
    if (reason === 'unsealed') item.finish(false); item.stop();
  }
});

// Physical mapping specification and closed scope: six cases.
test('anchor mapping uses actual rounded backing dimensions rather than nominal DPR', () => {
  assert.deepEqual(mapSceneAnchorPixel([640, 240], allocation(641, 480, 801, 600)), [799, 299]);
  assert.deepEqual(mapSceneAnchorPixel([0.5, 0.5], allocation(640, 480, 1280, 960)), [1, 958]);
  assert.ok(Object.isFrozen(mapSceneAnchorPixel([10, 10], allocation())));
});

test('anchor mapping preserves top-origin half-open boundaries without clamping', () => {
  assert.deepEqual(mapSceneAnchorPixel([0, 0], allocation(4, 4, 8, 8)), [0, 7]);
  assert.deepEqual(mapSceneAnchorPixel([1, 1], allocation(4, 4, 8, 8)), [2, 5]);
  for (const point of [[4, 0], [0, 4], [-0.001, 0], [0, -0.001], [Infinity, 0], [0, NaN]]) {
    assert.equal(mapSceneAnchorPixel(point, allocation(4, 4, 8, 8)), undefined);
  }
});

test('an outside anchor remains clipped while its larger marker can retain object coverage', () => {
  const item = createObservationFixture({ position: [-1.125, 0, 0], radiusCss: 100 }); item.begin(); item.issue(); item.finish(); item.settle([false, true]);
  assert.deepEqual(item.completed[0].result, { anchor: false, object: true });
  assert.equal(mapSceneAnchorPixel([-40, 240], allocation()), undefined);
  assert.equal(item.gpu.draws.some(draw => mode(draw) === 2), true); item.stop();
});

test('paint anchor and object modes share the exact owned linked program and anchor packet', () => {
  const item = createObservationFixture(); item.begin(); const paint = item.gpu.draws.at(-1), offset = item.gpu.draws.length;
  settled(item); const observed = item.gpu.draws.slice(offset); assert.equal(observed.length, 2);
  assert.ok(observed.every(draw => draw.program === paint.program && draw.vao === paint.vao));
  assert.deepEqual(observed.map(mode), [1, 2]);
  assert.ok(observed.every(draw => JSON.stringify(draw.uniforms.u_lr_anchor) === JSON.stringify(paint.uniforms.u_lr_anchor)));
  item.stop();
});

test('later native layers or multiple opaque marker plans cannot gain single-marker scope', () => {
  const item = createObservationFixture();
  item.begin({ orderedLayers: [{ id: 'base', type: 'background' }, { id: 'scene', type: 'custom' }, { id: 'later', type: 'fill-extrusion' }] });
  refuse(item); item.finish(); item.stop();
  const multiple = createObservationFixture();
  const front = Object.freeze({ ...multiple.marker, id: 'front' });
  multiple.begin({}, [multiple.marker, front]);
  assert.equal(multiple.gpu.draws.length, 2, 'the eligible native scope contains two actual painted markers');
  refuse(multiple); multiple.finish(); multiple.stop();
});

test('terrain custom debug transition and unknown native phases refuse positive scope', () => {
  for (const options of [{ terrain: true }, { reference: 'terrain' }, { debug: true }, { tailDraws: true }, { projection: 'vertical-perspective', transition: 1 },
    { uploadedTransition: 'missing' }, { uploadedTransition: 0.25 }, { horizonMode: 'sphere' }]) {
    const item = createObservationFixture(options); item.begin(); refuse(item); item.finish(); item.stop();
  }
  const item = createObservationFixture();
  item.begin({ orderedLayers: [{ id: 'foreign', type: 'custom' }, { id: 'scene', type: 'custom' }] }); refuse(item); item.finish();
  assert.equal(item.observation.issue({ plan: item.plan, authority: undefined }), undefined); item.stop();
});
