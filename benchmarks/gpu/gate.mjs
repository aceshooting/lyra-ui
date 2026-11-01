// The frame-rate gate of the GPU benchmarks. A verdict compares a measured scenario against its
// documented target only when a hardware GPU drew it; software and unidentified renderers record
// the same numbers as advisory observations, never as a pass or a failure.

/**
 * Share of the target rate the drawn frames must reach. A display-synchronized animation clock
 * jitters around its period, so a run that draws every 60 Hz frame measures slightly under 60.
 */
export const GATE_TOLERANCE = 0.98;

/**
 * Verdict for one scenario rendered on `hardware` (`gpu`, `software` or `none`):
 * - `untargeted`: no documented frame-rate target; reported only.
 * - `unmeasured`: the sample did not qualify (fallback, failed, or no drawn WebGL frames).
 * - `advisory`: measured, but not on a hardware GPU, so it can neither pass nor fail.
 * - `pass` / `fail`: drawn frames per second (fps x drawn-frame ratio) against the target.
 * A pass qualifies only the recorded renderer and environment.
 */
export function gateScenario(scenario, hardware) {
  const target = scenario.targetFps;
  if (target === undefined) return { verdict: 'untargeted' };
  if (!Number.isFinite(target) || target <= 0) throw new TypeError('targetFps must be a positive number');
  if (scenario.status !== 'measured') return { verdict: 'unmeasured', targetFps: target, reason: `status ${scenario.status}` };
  const drawnFps = Math.round(scenario.fps * scenario.drawnFrameRatio * 100) / 100;
  if (hardware !== 'gpu') {
    return { verdict: 'advisory', targetFps: target, drawnFps, reason: `rendered by ${hardware} hardware; only a hardware GPU qualifies` };
  }
  return { verdict: drawnFps >= target * GATE_TOLERANCE ? 'pass' : 'fail', targetFps: target, drawnFps };
}

/**
 * Outcome of the whole run: `fail` when a targeted scenario failed or did not measure; `pass` when
 * every targeted scenario passed in at least one hardware-GPU mode (a software mode alongside it
 * stays advisory); otherwise `advisory`, for example a software-only run. `--gate` exits 1 on
 * `fail` and 2 on `advisory`, so an unqualified run never reads as a pass.
 */
export function gateOutcome(result) {
  const targeted = new Map();
  for (const report of result.modes) for (const scenario of report.scenarios) {
    const verdict = scenario.gate?.verdict ?? 'untargeted';
    if (verdict === 'untargeted') continue;
    if (verdict === 'fail' || verdict === 'unmeasured') return 'fail';
    targeted.set(scenario.id, targeted.get(scenario.id) === true || verdict === 'pass');
  }
  return targeted.size > 0 && [...targeted.values()].every(Boolean) ? 'pass' : 'advisory';
}
