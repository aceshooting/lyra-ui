import test from 'node:test';
import assert from 'node:assert/strict';
import { hottest, layoutStatus, measurementStatus, parse, summarize } from './run.mjs';
import { measurementFailed } from './acceptance.mjs';

test('frame intervals summarize to a rate, nearest-rank percentiles and long frames', () => {
  const summary = summarize([16, 17, 16, 50, 16]);
  assert.deepEqual(summary, { frames: 5, fps: 43.48, p50Ms: 16, p95Ms: 50, maxMs: 50, over20Ms: 1 });
  assert.deepEqual(summarize([]), { frames: 0, fps: 0, p50Ms: 0, p95Ms: 0, maxMs: 0, over20Ms: 0 });
});

test('a sampling profile ranks functions by self time with their share', () => {
  const frame = (functionName, line) => ({ functionName, url: 'http://127.0.0.1/assets/main.js', lineNumber: line - 1 });
  const profile = {
    nodes: [{ id: 1, callFrame: frame('render', 10) }, { id: 2, callFrame: frame('', 20) }, { id: 3, callFrame: frame('idle', 30) }],
    samples: [1, 1, 2, 3, 1],
    timeDeltas: [1000, 1000, 2000, 1000, 1000],
  };
  assert.deepEqual(hottest(profile, 2), [
    { name: 'render main.js:10', selfMs: 3, share: 0.5 },
    { name: '(anonymous) main.js:20', selfMs: 2, share: 0.33 },
  ]);
});

test('options reject unknown modes, profiles, flags and unbounded durations', () => {
  assert.deepEqual(parse([]), { modes: ['gpu', 'software'], profile: 'quick', durationMs: 5000, warmupMs: 1000, output: null, cpuProfile: false, acceptanceObservations: false, gate: false });
  assert.equal(parse(['--modes', 'gpu', '--cpu-profile']).cpuProfile, true);
  assert.equal(parse(['--acceptance-observations']).acceptanceObservations, true);
  assert.equal(parse(['--gate']).gate, true);
  assert.equal(parse(['--profile', 'scale']).profile, 'scale');
  assert.throws(() => parse(['--modes', 'metal']), /--modes/);
  assert.throws(() => parse(['--profile', 'huge']), /--profile/);
  assert.throws(() => parse(['--duration-ms', '600000']), /durationMs/);
  assert.throws(() => parse(['--fast']), /Unknown option/);
});


test('animation timing without rendered WebGL frames never qualifies as measured', () => {
  const active = { frames: 300, fps: 60, drawnFrameRatio: 1, drawCallsPerFrame: 2, fallbacks: [] };
  assert.equal(measurementStatus(active), 'measured');
  assert.equal(measurementStatus({ ...active, drawnFrameRatio: 0.5 }), 'measured', 'partial drawing remains reported without adding a performance threshold');
  for (const field of ['frames', 'fps', 'drawnFrameRatio', 'drawCallsPerFrame']) {
    for (const value of [0, -1, NaN, Infinity, undefined]) {
      assert.equal(measurementStatus({ ...active, [field]: value }), 'unqualified', `${field}=${value}`);
    }
  }
  assert.equal(measurementStatus({ ...active, drawnFrameRatio: 0, fallbacks: ['unsupported'] }), 'fallback');
});

test('a progressive layout observation qualifies only with drawn frames and a delivered layout output', () => {
  const observed = { frames: 120, fps: 24, drawnFrameRatio: 1, firstOutputMs: 850, outputs: 3, fallbacks: [] };
  assert.equal(layoutStatus(observed), 'measured');
  assert.equal(layoutStatus({ ...observed, outputs: 0, firstOutputMs: null }), 'unqualified', 'no worker output was applied');
  assert.equal(layoutStatus({ ...observed, drawnFrameRatio: 0 }), 'unqualified');
  assert.equal(layoutStatus({ ...observed, fallbacks: ['unsupported'] }), 'fallback');
});

test('an unqualified progressive layout observation fails the run like any other measurement', () => {
  const scenario = { id: 'graph-100k-nodes-300k-edges', status: 'measured' };
  const run = (layout) => ({ modes: [{ scenarios: [{ ...scenario, ...(layout ? { layout } : {}) }] }] });
  assert.equal(measurementFailed(run()), false);
  assert.equal(measurementFailed(run({ status: 'measured' })), false);
  assert.equal(measurementFailed(run({ status: 'unqualified' })), true);
  assert.equal(measurementFailed(run({ status: 'failed' })), true);
});

// Opt-in: builds the fixture and drives Chromium (SwiftShader), so it needs `pnpm build` and takes
// tens of seconds for 100k nodes. Run with LYRA_GPU_SMOKE=1 pnpm test:benchmarks.
test('smoke: the 100k profile measures in software Chromium and stays advisory', { skip: process.env.LYRA_GPU_SMOKE !== '1' }, async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const { run } = await import('./run.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'lyra-gpu-smoke-'));
  try {
    const { result } = await run({ ...parse(['--modes', 'software', '--profile', 'scale', '--duration-ms', '500', '--warmup-ms', '0']), output: join(directory, 'result.json') });
    const [report] = result.modes;
    assert.equal(report.hardware, 'software');
    const [scenario] = report.scenarios;
    assert.equal(scenario.status, 'measured', scenario.error);
    assert.equal(scenario.gate.verdict, 'advisory');
    assert.ok(scenario.heap.mountedDeltaBytes > 0);
    assert.equal(scenario.layout.status, 'measured', scenario.layout.error);
    assert.equal(result.gate, 'advisory');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
