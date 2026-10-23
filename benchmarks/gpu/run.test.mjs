import test from 'node:test';
import assert from 'node:assert/strict';
import { hottest, measurementStatus, parse, summarize } from './run.mjs';

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
  assert.deepEqual(parse([]), { modes: ['gpu', 'software'], profile: 'quick', durationMs: 5000, warmupMs: 1000, output: null, cpuProfile: false, acceptanceObservations: false });
  assert.equal(parse(['--modes', 'gpu', '--cpu-profile']).cpuProfile, true);
  assert.equal(parse(['--acceptance-observations']).acceptanceObservations, true);
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
