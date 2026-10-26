import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeasurement, validateOracle, createObserverWindow, createFirstMountRecorder } from './measurement.js';
import { copyDiagnostic } from './measurement.js';
const descriptor = { id: 'edit', kind: 'interaction', trigger: 'host', expectedFingerprint: 'expected' };
const oracle = () => ({ generation: 'g1', status: 'committed', fingerprint: 'expected', connected: true, visible: true });
function rig(overrides = {}) {
  let time = 0, frames = 0;
  const measurement = createMeasurement({ now: () => time++, frame: async () => { frames++; time += 16; }, foreground: () => true, fontsReady: async () => {}, ...overrides });
  return { measurement, frames: () => frames };
}

test('host operation starts before trigger and awaits matching semantics before two rendering opportunities', async () => {
  const { measurement, frames } = rig(); let commit;
  const result = await measurement.measureOperation({ operation: descriptor, generation: 'g1', trigger: () => { assert.equal(typeof commit, 'function'); commit(); }, waitForCommit: () => new Promise(resolve => { commit = resolve; }), readOracle: oracle });
  assert.equal(frames(), 2); assert.equal(result.start, 0);
  assert.ok(result.semanticCommit < result.renderOpportunity);
  assert.equal(result.fingerprint, 'expected'); assert.equal(result.censored, false);
});

test('event bridge is armed before synchronous native driver receipt and rejects synthetic events', async () => {
  let listener; const target = { addEventListener: (_type, value) => { listener = value; }, removeEventListener: () => { listener = undefined; } };
  const { measurement } = rig({ now: () => 10 });
  const result = await measurement.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1', event: { target, type: 'input' }, onArmed: () => listener({ isTrusted: true, timeStamp: 8 }), waitForCommit: async () => {}, readOracle: oracle });
  assert.equal(result.start, 8); assert.equal(result.listenerReceipt, 10); assert.equal(listener, undefined);
  await assert.rejects(measurement.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1', event: { target, type: 'input' }, onArmed: () => listener({ isTrusted: false, timeStamp: 8 }), waitForCommit: async () => {}, readOracle: oracle }), /trusted/u);
});

test('stale generation after a frame and missing/hidden semantic result reject', async () => {
  let generation = 'g1'; const { measurement } = rig({ frame: async () => { generation = 'g2'; } });
  await assert.rejects(measurement.measureOperation({ operation: descriptor, generation: 'g1', trigger() {}, waitForCommit: async () => {}, readOracle: () => ({ ...oracle(), generation }) }), /generation/u);
  for (const patch of [{ status: 'pending' }, { visible: false }, { connected: false }, { fingerprint: 'wrong' }]) assert.throws(() => validateOracle({ ...oracle(), ...patch }, 'g1', 'expected'));
});

test('abort settles a noncooperating commit wait and never reports successful late completion', async () => {
  const controller = new AbortController(); const { measurement } = rig();
  const pending = measurement.measureOperation({ operation: descriptor, generation: 'g1', signal: controller.signal, trigger: () => controller.abort(), waitForCommit: () => new Promise(() => {}), readOracle: oracle });
  await assert.rejects(pending, /abort/iu);
  assert.equal(measurement.pendingOperations, 0);
});

test('observer window includes queued records through finish, distinguishes unavailable types and cleans up', () => {
  const instances = [];
  class Observer {
    static supportedEntryTypes = ['longtask'];
    constructor(callback) { this.callback = callback; this.records = []; instances.push(this); }
    observe() {} takeRecords() { return this.records.splice(0); } disconnect() { this.disconnected = true; }
  }
  const times = [0, 5, 100];
  const window = createObserverWindow({ Observer, now: () => times.shift() });
  window.start(); window.phase('interaction');
  instances[0].records.push({ startTime: 10, duration: 70 });
  const result = window.finish();
  assert.equal(result.longTasks.length, 1); assert.equal(result.longTasks[0].phase, 'interaction');
  assert.equal(result.layoutShifts, null); assert.equal(instances[0].disconnected, true);
  assert.throws(() => window.finish());
});

function delayedActivation() {
  let time = 1, listener, ready, frames = 0, acknowledge, rejectActivation, endpoint;
  const controller = new AbortController();
  const endpointReached = new Promise(resolve => { endpoint = resolve; });
  const acknowledgement = new Promise((resolve, reject) => { acknowledge = resolve; rejectActivation = reject; });
  const target = { addEventListener(_type, callback) { listener = callback; }, removeEventListener() {} };
  const measurement = createMeasurement({ now: () => { const timestamp = time; if (frames === 2) endpoint(); return timestamp; },
    frame: async () => { frames++; time += 16; }, foreground: () => true, fontsReady: async () => {} });
  const pending = measurement.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1', signal: controller.signal,
    event: { target, type: 'click' }, waitForCommit: () => new Promise(resolve => { ready = resolve; }), readOracle: oracle,
    onArmed() { listener({ isTrusted: true, timeStamp: 1 }); time = 2; ready(); return acknowledgement; } });
  return { pending, endpointReached, measurement, controller, frames: () => frames,
    acknowledge() { time = 100; acknowledge(); }, reject() { time = 100; rejectActivation(new Error('Activation failed.')); } };
}

test('semantic and two-frame endpoint finish before delayed automation acknowledgement', async () => {
  const state = delayedActivation(); let returned = false;
  void state.pending.then(() => { returned = true; }, () => {});
  await state.endpointReached; assert.equal(state.frames(), 2); assert.equal(returned, false);
  state.acknowledge(); const result = await state.pending;
  assert.equal(result.semanticCommit, 2); assert.equal(result.renderOpportunity, 34);
  assert.equal(state.measurement.pendingOperations, 0);
});

test('late activation rejection invalidates an already observed two-frame endpoint', async () => {
  const state = delayedActivation(); await state.endpointReached; state.reject();
  await assert.rejects(state.pending, /Activation failed/u); assert.equal(state.frames(), 2); assert.equal(state.measurement.pendingOperations, 0);
});

test('cancellation while awaiting activation acknowledgement cannot return an earlier endpoint', async () => {
  const state = delayedActivation(); await state.endpointReached; state.controller.abort();
  await assert.rejects(state.pending, /abort/iu); state.acknowledge();
  assert.equal(state.frames(), 2); assert.equal(state.measurement.pendingOperations, 0);
});

test('abort during an uncooperative frame or armed bridge cleans up native listeners and permits a later operation', async () => {
  const controller = new AbortController(); let removed = 0;
  const target = { addEventListener() {}, removeEventListener() { removed++; } };
  const { measurement } = rig();
  await assert.rejects(measurement.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1', signal: controller.signal,
    event: { target, type: 'input' }, waitForCommit: () => new Promise(() => {}), readOracle: oracle,
    onArmed: () => { controller.abort(); return new Promise(() => {}); } }), /abort/iu);
  assert.equal(removed, 1); assert.equal(measurement.pendingOperations, 0);
  const result = await measurement.measureOperation({ operation: descriptor, generation: 'g1', trigger() {}, waitForCommit: async () => {}, readOracle: oracle });
  assert.equal(result.censored, false);
});

test('late observer delivery is assigned by entry time, including tasks spanning the mount boundary', () => {
  let observer, time = 10;
  class Observer {
    static supportedEntryTypes = ['longtask'];
    constructor(callback) { this.callback = callback; observer = this; }
    observe() {} takeRecords() { return []; } disconnect() {}
  }
  const window = createObserverWindow({ Observer, now: () => time });
  window.start(); time = 20; window.phase('interaction'); time = 100;
  observer.callback({ getEntries: () => [{ startTime: 5, duration: 60 }, { startTime: 11, duration: 80 }] });
  const result = window.finish();
  assert.deepEqual(result.longTasks.map(item => item.phase), ['spanning-start', 'mount']);
  assert.deepEqual(result.longTasks[1].spansPhases, ['interaction']);
});

test('failure diagnostics copy bounded scalars and reject handles, cycles and getters', () => {
  const original = { phase: 'mount', reason: 'No chart geometry', immediate: { count: 0, rect: { width: 400, height: 240 } }, afterTwoFrames: { count: 125, indices: [0, 1, 2] } };
  const result = copyDiagnostic(original); original.immediate.count = 99;
  assert.equal(result.immediate.count, 0); assert.equal(result.afterTwoFrames.count, 125);
  assert.throws(() => copyDiagnostic(new class NodeHandle {}()));
  const cycle = {}; cycle.self = cycle; assert.throws(() => copyDiagnostic(cycle));
  assert.throws(() => copyDiagnostic({ get value() { throw new Error('Must not execute.'); } }), /accessor/u);
  const accessorArray = []; Object.defineProperty(accessorArray, '0', { get() { throw new Error('Must not execute.'); }, enumerable: true });
  assert.throws(() => copyDiagnostic(accessorArray), /accessor/u);
  assert.throws(() => copyDiagnostic({ values: Array.from({ length: 513 }, () => 1) }));
  assert.throws(() => copyDiagnostic({ reason: 'x'.repeat(4097) }));
});

test('first-mount evidence includes import/cadence prefix without changing required-input timestamps', async () => {
  let time = 2; const run = createFirstMountRecorder({ generation: 'g1', now: () => time });
  const operation = { id: 'mount-data' };
  const result = await run(operation, async () => { time = 1800; return { id: operation.id, generation: 'g1', start: time, semanticCommit: 1810, renderOpportunity: 1842 }; });
  assert.equal(result.start, 1800); assert.equal(result.firstMount.start, 2);
  assert.equal(result.firstMount.semanticCommit, result.semanticCommit); assert.equal(result.firstMount.renderOpportunity, result.renderOpportunity);
  const second = await run({ id: 'edit' }, async () => ({ id: 'edit', generation: 'g1', start: 1900, semanticCommit: 1910, renderOpportunity: 1942 }));
  assert.equal(second.firstMount, undefined);
});

test('first-mount wrapper rejects late disposed generations and fixture-supplied timing', async () => {
  let current = true; const run = createFirstMountRecorder({ generation: 'g1', now: () => 0, isCurrent: () => current });
  await assert.rejects(run({ id: 'mount' }, async () => { current = false; return { id: 'mount', generation: 'g1', start: 1, semanticCommit: 2, renderOpportunity: 3 }; }), /stale/u);
  const spoof = createFirstMountRecorder({ generation: 'g1', now: () => 0 });
  await assert.rejects(spoof({ id: 'mount' }, async () => ({ id: 'mount', generation: 'g1', firstMount: {} })), /cannot supply/u);
});

test('font barrier precedes native listener arming and ready commit includes newly loaded fonts', async () => {
  const order = []; let listener, releaseFonts;
  const target = { addEventListener(_type, callback) { listener = callback; order.push('listener'); }, removeEventListener() {} };
  const native = rig({ now: () => 10, fontsReady: () => new Promise(resolve => { releaseFonts = resolve; order.push('fonts'); }) }).measurement;
  const pending = native.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1', event: { target, type: 'click' },
    onArmed() { order.push('armed'); listener({ isTrusted: true, timeStamp: 9 }); }, waitForCommit: async () => {}, readOracle: oracle });
  assert.deepEqual(order, ['fonts']); releaseFonts(); await pending; assert.deepEqual(order, ['fonts', 'listener', 'armed']);
  let time = 0, fontCalls = 0, commit;
  const ready = rig({ now: () => time, frame: async () => { time += 16; }, fontsReady: async () => { if (++fontCalls === 2) time = 50; } }).measurement;
  const result = await ready.measureOperation({ operation: { ...descriptor, kind: 'ready' }, generation: 'g1', trigger() { time = 10; commit(); },
    waitForCommit: () => new Promise(resolve => { commit = resolve; }), readOracle: oracle });
  assert.equal(fontCalls, 2); assert.equal(result.start, 0); assert.equal(result.semanticCommit, 50); assert.equal(result.renderOpportunity, 82);
});

test('abort settles a pending font barrier without arming a native action', async () => {
  const controller = new AbortController(); let armed = false;
  const measurement = rig({ fontsReady: () => new Promise(() => {}) }).measurement;
  const pending = measurement.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1', signal: controller.signal,
    event: { target: { addEventListener() {}, removeEventListener() {} }, type: 'click' }, onArmed() { armed = true; }, waitForCommit: async () => {}, readOracle: oracle });
  controller.abort(); await assert.rejects(pending, /abort/iu); assert.equal(armed, false); assert.equal(measurement.pendingOperations, 0);
});

test('an earlier capture-listener commit waits for trusted native receipt before its semantic timestamp', async () => {
  let time = 1, listener, ready, receiptObserved = false, reads = 0, prematureReads = 0;
  const target = { addEventListener(_type, callback) { listener = callback; }, removeEventListener() {} };
  const { measurement } = rig({ now: () => time, frame: async () => { time += 16; } });
  const result = await measurement.measureOperation({ operation: { ...descriptor, trigger: 'event' }, generation: 'g1',
    event: { target, type: 'input' }, waitForCommit: () => new Promise(resolve => { ready = resolve; }),
    readOracle() { if (++reads > 1 && !receiptObserved) prematureReads++; return oracle(); },
    async onArmed() {
      time = 5; ready();
      await Promise.resolve(); await Promise.resolve();
      assert.equal(prematureReads, 0, 'Semantic oracle must not be admitted before trusted input receipt.');
      time = 20; receiptObserved = true; listener({ isTrusted: true, timeStamp: 2 });
    } });
  assert.equal(result.start, 2); assert.equal(result.listenerReceipt, 20);
  assert.ok(result.semanticCommit >= result.listenerReceipt);
  assert.equal(prematureReads, 0);
});
