import { expect } from '@open-wc/testing';
import {
  WEBGL2_REQUIRED_MESSAGE,
  createWebgl2Guard,
  requireWebgl2,
  webgl2Outcome,
  webgl2Present,
  webgl2RequiredByRun,
} from '../test/webgl2.js';

/** A stand-in for Mocha's context that records a skip instead of aborting this case. */
function recordingContext(): { context: Mocha.Context; skipped: () => boolean } {
  let skipped = false;
  const context = { skip: () => { skipped = true; } } as unknown as Mocha.Context;
  return { context, skipped: () => skipped };
}

function guardResult(available: boolean, required: boolean): string {
  const { context, skipped } = recordingContext();
  try {
    createWebgl2Guard(available, () => required).call(context);
  } catch (error) {
    return `threw: ${(error as Error).message}`;
  }
  return skipped() ? 'skipped' : 'ran';
}

describe('WebGL2 test guard', () => {
  it('runs with WebGL2, skips without it, and fails without it when the run requires it', () => {
    expect(webgl2Outcome(true, false)).to.equal('run');
    expect(webgl2Outcome(true, true)).to.equal('run');
    expect(webgl2Outcome(false, false)).to.equal('skip');
    expect(webgl2Outcome(false, true)).to.equal('fail');
    expect(guardResult(true, true)).to.equal('ran');
    expect(guardResult(true, false)).to.equal('ran');
    expect(guardResult(false, false)).to.equal('skipped');
    expect(guardResult(false, true)).to.equal(`threw: ${WEBGL2_REQUIRED_MESSAGE}`);
  });

  it('reads the run policy from the page and never probes again per case', () => {
    expect(webgl2RequiredByRun()).to.equal(globalThis.__LYRA_WTR_REQUIRE_WEBGL2__ === true);
    expect(typeof webgl2Present).to.equal('boolean');
    const original = HTMLCanvasElement.prototype.getContext;
    let probes = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      probes += 1;
      return original.apply(this, args);
    } as typeof original;
    const { context, skipped } = recordingContext();
    let outcome: string;
    try {
      requireWebgl2.call(context);
      requireWebgl2.call(context);
      outcome = skipped() ? 'skip' : 'run';
    } catch (error) {
      outcome = (error as Error).message === WEBGL2_REQUIRED_MESSAGE ? 'fail' : 'other';
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
    expect(probes).to.equal(0);
    expect(outcome).to.equal(webgl2Outcome(webgl2Present, webgl2RequiredByRun()));
  });
});
