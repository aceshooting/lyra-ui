import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spread, heapDifference, measurementFailed } from './acceptance.mjs';

test('retains raw order and spread without mutating observations', () => {
  const values = [9, 2, 5];
  assert.deepEqual(spread(values), { samples: [9, 2, 5], min: 2, median: 5, max: 9 });
  assert.deepEqual(values, [9, 2, 5]);
  for (const input of [[], [NaN], [Infinity]]) assert.throws(() => spread(input));
});

test('heap observations preserve decreases rather than clamping away collection', () => {
  assert.deepEqual(heapDifference(100, 80), { beforeBytes: 100, afterDisposeBytes: 80, retainedDeltaBytes: -20 });
  assert.equal(heapDifference(80, 100).retainedDeltaBytes, 20);
  for (const value of [-1, NaN, Infinity, undefined]) assert.throws(() => heapDifference(value, 100));
});

import { completionReason } from './layout-observation.mjs';
test('completion distinguishes cooling and stability from exhausted iteration budgets', () => {
  const record = { done: true, movable: 10, iteration: 350, alpha: 0.0009, options: {} };
  assert.equal(completionReason(record), 'cooled');
  assert.equal(completionReason({ ...record, iteration: 500 }), 'budget-exhausted');
  assert.equal(completionReason({ ...record, alpha: 0.1 }), 'stable');
  assert.equal(completionReason({ ...record, movable: 0 }), 'no-movable-nodes');
  assert.equal(completionReason({ ...record, done: false }), 'incomplete');
  assert.equal(completionReason({ ...record, iteration: 50, options: { maxSteps: 50 } }), 'budget-exhausted');
});

import { runInNewContext } from 'node:vm';
import { observeGraphWorkers } from './layout-observation.mjs';
test('worker observer forwards messages and transfer lists without retaining position buffers', () => {
  const workers = [];
  class Worker {
    constructor() { this.listeners = []; this.sent = []; workers.push(this); }
    addEventListener(type, listener) { if (type === 'message') this.listeners.push(listener); }
    postMessage(...args) { this.sent.push(args); }
    emit(data) { for (const listener of this.listeners) listener({ data }); }
  }
  const window = { Worker };
  let now = 10;
  runInNewContext(`(${observeGraphWorkers.toString()})()`, { window, performance: { now: () => now }, Uint8Array, structuredClone });
  const worker = new window.Worker();
  const message = { type: 'start', input: { type: 'start', data: { nodeCount: 2, pinned: new Uint8Array([0, 0]), options: {} } } };
  const transfers = [];
  worker.postMessage(message, transfers);
  assert.equal(worker.sent[0][0], message);
  assert.equal(worker.sent[0][1], transfers);
  now = 30;
  worker.emit({ type: 'output', done: true, output: { epoch: 0, iteration: 350, alpha: 0.0009, maxSpeed: 0.01, positions: new Float32Array(6) } });
  const observed = window.__layoutObservation.read();
  assert.equal(observed.elapsedMs, 20);
  assert.equal(observed.done, true);
  assert.equal(observed.movable, 2);
  assert.equal(observed.samples.length, 1);
  assert.equal('positions' in observed.samples[0], false);
  worker.postMessage({ type: 'update', input: { type: 'pins', update: {} } });
  worker.emit({ type: 'output', done: true, output: { epoch: 0, iteration: 500, alpha: 0, maxSpeed: 0 } });
  assert.equal(window.__layoutObservation.read().done, false, 'old epoch cannot settle an updated task');
  worker.emit({ type: 'output', done: true, output: { epoch: 1, iteration: 1, alpha: 0.0001, maxSpeed: 0 } });
  assert.equal(window.__layoutObservation.read().epoch, 1);
  assert.equal(window.__layoutObservation.read().done, false);
  assert.equal(window.__layoutObservation.read().invalidated, 'pin-update');
  window.__layoutObservation.reset();
  worker.emit({ type: 'output', done: true, output: { epoch: 0, iteration: 500, alpha: 0, maxSpeed: 0 } });
  assert.equal(window.__layoutObservation.read(), null, 'retired worker output cannot settle the next observation');
});

test('requested acceptance observations fail closed when absent or incomplete', () => {
  const report = { scenarios: [{ status: 'measured' }] };
  assert.equal(measurementFailed({ modes: [report] }), false);
  assert.equal(measurementFailed({ modes: [report] }, true), true);
  const complete = { ...report, acceptance: { summaries: [{ complete: true }, { complete: true }] } };
  assert.equal(measurementFailed({ modes: [complete] }, true), false);
  assert.equal(measurementFailed({ modes: [{ ...complete, acceptance: { summaries: [{ complete: true }, { complete: false }] } }] }, true), true);
  assert.equal(measurementFailed({ modes: [{ ...complete, scenarios: [{ status: 'failed' }] }] }, true), true);
  assert.equal(measurementFailed({ modes: [] }, true), true);
});


test('input observation precedes engine target interception and attributes only trusted canvas input/draws', () => {
  const source = readFileSync(new URL('./fixture/main.js', import.meta.url), 'utf8');
  const methods = source.slice(source.indexOf('function clearInputObservation()'), source.indexOf('async function readInputObservation()'));
  const listeners = new Map();
  const surface = {
    addEventListener(type, listener, capture) { assert.equal(type, 'pointermove'); assert.equal(capture, true); listeners.set(listener, capture); },
    removeEventListener(type, listener, capture) { assert.equal(type, 'pointermove'); assert.equal(capture, true); listeners.delete(listener); },
  };
  const targetListeners = [];
  const canvas = { parentElement: surface,
    addEventListener(type, listener) { assert.equal(type, 'pointermove'); targetListeners.push(listener); },
    removeEventListener(type, listener) { assert.equal(type, 'pointermove'); const index = targetListeners.indexOf(listener); if (index >= 0) targetListeners.splice(index, 1); },
  };
  // The graph engine owns this earlier target listener and suppresses later target listeners.
  canvas.addEventListener('pointermove', event => event.stopImmediatePropagation());
  let now = 0, draws = 0;
  class WebGL2RenderingContext {}
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
    WebGL2RenderingContext.prototype[name] = () => { draws++; };
  }
  const originalDraw = WebGL2RenderingContext.prototype.drawArrays;
  const context = { engineElement: () => canvas, WebGL2RenderingContext, performance: { now: () => ++now } };
  runInNewContext(`let inputObservation; ${methods}; globalThis.probe = { armInputObservation, clearInputObservation, read: () => inputObservation };`, context);
  const { probe } = context;
  const dispatch = ({ trusted = true, target = canvas } = {}) => {
    let stopped = false;
    const event = { isTrusted: trusted, buttons: 1, composedPath: () => [target, surface], stopImmediatePropagation() { stopped = true; } };
    // Native ancestor capture precedes target capture, irrespective of listener installation order.
    for (const listener of listeners.keys()) { listener(event); if (stopped) return; }
    for (const listener of targetListeners) { listener(event); if (stopped) return; }
  };
  probe.armInputObservation();
  dispatch({ trusted: false });
  dispatch({ target: {} });
  WebGL2RenderingContext.prototype.drawArrays.call({ canvas });
  assert.equal(probe.read().inputAt, null);
  assert.equal(probe.read().drawAt, null);
  dispatch();
  assert.equal(probe.read().inputAt, 1, 'trusted input survives later graph target interception');
  WebGL2RenderingContext.prototype.drawArrays.call({ canvas: {} });
  assert.equal(probe.read().drawAt, null, 'another context cannot satisfy this canvas observation');
  WebGL2RenderingContext.prototype.drawArrays.call({ canvas });
  assert.equal(probe.read().drawAt, 2);
  assert.equal(draws, 3, 'draw wrappers preserve actual submission');
  probe.clearInputObservation();
  assert.equal(listeners.size, 0);
  assert.equal(WebGL2RenderingContext.prototype.drawArrays, originalDraw);
});
