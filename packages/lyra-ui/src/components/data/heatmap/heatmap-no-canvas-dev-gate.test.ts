import { expect } from '@open-wc/testing';
// Import the side-effect-free class module rather than the `./heatmap.js` registration entry: this
// file must reach `resolveRgb()` without anything else in the page having touched a canvas first
// (see the comment on the single test below).
import { resolveRgb } from './heatmap.class.js';

// This test lives in its own file, and MUST stay the only test in it -- same constraint as
// `heatmap-no-canvas.test.ts`, for the same two reasons: `getScratchCtx()` (src/internal/canvas.ts)
// memoizes its canvas 2D context at module scope for the lifetime of the page once stubbed to null,
// and `warnNoCanvasContext()`'s own `warnedNoCanvasContext` latch fires at most once ever, with no
// reset. Either constraint on its own would make a second `it()` here (or in
// `heatmap-no-canvas.test.ts`) observe a state already consumed by the first, rather than the fresh
// realm this production-mode assertion needs. The same one-shot latch also means this test must
// disable mocha's default single retry (`this.retries(0)`): a failing first attempt would already
// have flipped `warnedNoCanvasContext` to `true`, so a retry's second call would silently skip
// `warnNoCanvasContext()` and report a false pass for the wrong reason.
type LitWarningGlobal = { litIssuedWarnings?: Set<string> };

it('stays silent in production (no Lit dev-mode signal) when no 2D canvas context is available', function () {
  this.retries(0);
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalWarn = console.warn;
  const savedLitIssuedWarnings = (globalThis as LitWarningGlobal).litIssuedWarnings;
  const warnings: unknown[][] = [];
  let result: [number, number, number, number];
  try {
    (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
      function (this: HTMLCanvasElement) {
        return null;
      };
    console.warn = (...args: unknown[]) => warnings.push(args);
    delete (globalThis as LitWarningGlobal).litIssuedWarnings;
    result = resolveRgb('oklch(0.7 0.1 200)', '#123456');
  } finally {
    console.warn = originalWarn;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    (globalThis as LitWarningGlobal).litIssuedWarnings = savedLitIssuedWarnings;
  }

  // Falls back exactly as it does in development -- gating the diagnostic never changes behavior.
  expect(result).to.deep.equal([0x12, 0x34, 0x56, 1]);
  expect(warnings, 'gated behind the shared dev-mode signal, like every sibling diagnostic').to.have.length(0);
});
