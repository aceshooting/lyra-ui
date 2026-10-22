import assert from 'node:assert/strict';
import test from 'node:test';
import { LYRA_3D_CONTRACT, Lyra3dUnsupportedError } from '../dist/core/index.js';
import * as graph from '../dist/graph/index.js';
import * as model from '../dist/model/index.js';
import * as panorama from '../dist/panorama/index.js';
import * as points from '../dist/points/index.js';
import { admitModel, ModelAdmissionError } from '../dist/model/admission.js';
import { MODEL_LIMITS } from '../dist/model/limits.js';
import { installFakeBrowser } from './fake-browser.mjs';
import { waitUntil } from './wait-until.mjs';

const REQUIRED = ['mount', 'setData', 'setStyle', 'setCamera', 'resize', 'dispose'];
const entries = { graph, points, panorama, model };

for (const [name, entry] of Object.entries(entries)) {
  test(`the ${name} entry point creates engines that speak the shared contract`, () => {
    assert.equal(typeof entry.createEngine, 'function');
    const first = entry.createEngine();
    const second = entry.createEngine();
    assert.notEqual(first, second, 'every call creates an independent engine');
    assert.equal(first.contract, LYRA_3D_CONTRACT);
    for (const method of REQUIRED) assert.equal(typeof first[method], 'function', `${name}.${method}`);
    first.dispose();
    second.dispose();
  });

  test(`the ${name} engine mounts into a container, reports its renderer and removes its canvas on dispose`, async (t) => {
    const browser = installFakeBrowser();
    t.after(() => browser.restore());
    const engine = entry.createEngine();
    const reports = [];
    await engine.mount(browser.container, {
      hover() {}, pick() {}, camera() {}, lost: (reason, detail) => assert.fail(`lost ${reason} ${detail}`),
      rendering: (info) => reports.push(info),
    });
    assert.equal(browser.container.children.length, 1);
    assert.deepEqual(reports, [{ software: false }]);
    await assert.rejects(engine.mount(browser.container, {}), /cannot be mounted twice/u);
    engine.resize(320, 240);
    engine.dispose();
    engine.dispose();
    assert.equal(browser.container.children.length, 0);
    assert.equal(browser.gl.loseContextCalls, 1, 'the context is released with the engine');
    await assert.rejects(engine.mount(browser.container, {}), /cannot be mounted twice/u);
  });

  test(`the ${name} engine refuses to mount without WebGL2 and stays disposable`, async (t) => {
    const browser = installFakeBrowser({ noContext: true });
    t.after(() => browser.restore());
    const engine = entry.createEngine();
    await assert.rejects(
      engine.mount(browser.container, { hover() {}, pick() {}, camera() {}, lost() {} }),
      (error) => error instanceof Lyra3dUnsupportedError && error.code === 'webgl-unavailable',
    );
    assert.equal(browser.container.children.length, 0);
    assert.doesNotThrow(() => engine.dispose());
  });
}

test('the model entry point exposes the admission helper, its error and the limits', () => {
  assert.equal(model.admitModel, admitModel);
  assert.equal(model.ModelAdmissionError, ModelAdmissionError);
  assert.equal(model.MODEL_LIMITS, MODEL_LIMITS);
});

test('the graph layout worker serves the layout kernel from its global scope', async (t) => {
  const listeners = [];
  const posted = [];
  const globals = { addEventListener: (type, listener) => { if (type === 'message') listeners.push(listener); }, postMessage: (message) => posted.push(message) };
  const previous = new Map(Object.keys(globals).map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, value });
  t.after(() => {
    listeners[0]?.({ data: { type: 'stop' } });
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  await import('../dist/graph/layout.worker.js');
  assert.equal(listeners.length, 1, 'the worker listens for task messages');
  const data = { nodeCount: 3, source: new Uint32Array([0, 1]), target: new Uint32Array([1, 2]), options: { maxSteps: 2 } };
  listeners[0]({ data: { type: 'start', input: { type: 'start', data } } });
  await waitUntil(() => posted.some((message) => message.type === 'output'), 'the first layout output');
  const output = posted.find((message) => message.type === 'output');
  assert.equal(output.output.epoch, 0);
  assert.equal(output.output.positions.length, 9);
  assert.ok(output.output.positions.every(Number.isFinite));
});
