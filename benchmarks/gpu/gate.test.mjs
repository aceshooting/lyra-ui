import test from 'node:test';
import assert from 'node:assert/strict';
import { GATE_TOLERANCE, gateOutcome, gateScenario } from './gate.mjs';
import { PROFILES } from './run.mjs';

const measured = { id: 'graph-100k-nodes-300k-edges', targetFps: 60, status: 'measured', fps: 60, drawnFrameRatio: 1 };

test('only a hardware GPU turns a measured frame rate into a pass or a failure', () => {
  assert.deepEqual(gateScenario(measured, 'gpu'), { verdict: 'pass', targetFps: 60, drawnFps: 60 });
  assert.equal(gateScenario({ ...measured, fps: 59.5 }, 'gpu').verdict, 'pass', 'vsync jitter is tolerated');
  assert.equal(gateScenario({ ...measured, fps: 60 * GATE_TOLERANCE - 0.01 }, 'gpu').verdict, 'fail');
  assert.equal(gateScenario({ ...measured, fps: 30 }, 'gpu').verdict, 'fail');
  for (const hardware of ['software', 'none']) {
    for (const fps of [60, 12]) {
      const gate = gateScenario({ ...measured, fps }, hardware);
      assert.equal(gate.verdict, 'advisory', `${hardware} at ${fps} fps neither passes nor fails`);
      assert.match(gate.reason, new RegExp(hardware));
    }
  }
});

test('frames the engine did not draw never count toward the target', () => {
  const gate = gateScenario({ ...measured, drawnFrameRatio: 0.5 }, 'gpu');
  assert.deepEqual(gate, { verdict: 'fail', targetFps: 60, drawnFps: 30 });
});

test('unqualified samples and scenarios without a documented target are classified, not judged', () => {
  for (const status of ['fallback', 'failed', 'unqualified']) {
    assert.deepEqual(gateScenario({ ...measured, status }, 'gpu'), { verdict: 'unmeasured', targetFps: 60, reason: `status ${status}` });
  }
  assert.deepEqual(gateScenario({ ...measured, targetFps: undefined }, 'gpu'), { verdict: 'untargeted' });
  for (const targetFps of [0, -60, Number.NaN]) assert.throws(() => gateScenario({ ...measured, targetFps }, 'gpu'), TypeError);
});

test('targets are the documented ones: graph 10k and 100k, points 100k at 60 fps', () => {
  const targets = Object.fromEntries([...PROFILES.quick, ...PROFILES.stress, ...PROFILES.scale].map((scenario) => [scenario.id, scenario.targetFps]));
  assert.deepEqual(targets, {
    'graph-10k-nodes-30k-edges': 60, 'points-100k': 60,
    'graph-30k-nodes-90k-edges': undefined, 'points-1m': undefined,
    'graph-100k-nodes-300k-edges': 60,
  });
});

test('a run passes only when every targeted scenario passed on a hardware GPU', () => {
  const run = (...modes) => ({ modes: modes.map((scenarios) => ({ scenarios })) });
  const pass = { id: 'a', gate: { verdict: 'pass' } }, advisory = { id: 'a', gate: { verdict: 'advisory' } };
  const untargeted = { id: 'b', gate: { verdict: 'untargeted' } };
  assert.equal(gateOutcome(run([pass, untargeted], [advisory])), 'pass', 'a software mode beside a passing GPU mode stays advisory');
  assert.equal(gateOutcome(run([advisory, untargeted])), 'advisory', 'a software-only run is never a pass');
  assert.equal(gateOutcome(run([untargeted])), 'advisory');
  assert.equal(gateOutcome(run()), 'advisory');
  assert.equal(gateOutcome(run([pass, { id: 'c', gate: { verdict: 'advisory' } }])), 'advisory', 'every targeted scenario needs its own pass');
  assert.equal(gateOutcome(run([pass], [{ id: 'a', gate: { verdict: 'fail' } }])), 'fail');
  assert.equal(gateOutcome(run([pass, { id: 'c', gate: { verdict: 'unmeasured' } }])), 'fail');
});
