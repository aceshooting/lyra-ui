import { expect } from '@open-wc/testing';
// Import the side-effect-free class module rather than the `./heatmap.js` registration entry: this
// file must reach `resolveRgb()` without anything else in the page having touched a canvas first
// (see the comment on the single test below).
import { resolveRgb } from './heatmap.class.js';

// This test lives in its own file, and MUST stay the only test in it.
//
// `getScratchCtx()` (src/internal/canvas.ts) memoizes its canvas 2D context at module scope, on
// first call, for the lifetime of the page -- once any earlier code has resolved it to a real
// context, no later call can ever observe null again. Stubbing `HTMLCanvasElement.prototype
// .getContext` to return null before anything in this page has touched a canvas is therefore the
// only way to exercise `resolveRgb()`'s `!ctx` branch at all, and it poisons the memo to `null`
// for the rest of the page. `heatmap.test.ts` resolves real colors in dozens of tests and could
// not survive that, hence the dedicated file. (Same constraint, same mechanism, as
// `src/components/retrieval/graph/graph.test.ts`'s edgeLabelWidth null-context test.)
it('warns distinctly when no 2D canvas context is available, not the invalid-color warning', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  let result: [number, number, number, number];
  let second: [number, number, number, number];
  try {
    (HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown }).getContext =
      function (this: HTMLCanvasElement) {
        return null;
      };
    console.warn = (...args: unknown[]) => warnings.push(args);
    result = resolveRgb('oklch(0.7 0.1 200)', '#123456');
    // `red` is the load-bearing probe: with a real context it resolves to [255, 0, 0, 1], so its
    // falling back here can only be caused by the missing context, never by the color being
    // unparsable. It also proves this is a second *unresolvable-context* call that must not
    // re-warn -- `resolveRgb()` runs per ramp endpoint on every draw pass, so an un-deduped
    // warning would flood the console once per repaint.
    second = resolveRgb('red', '#123456');
  } finally {
    console.warn = originalWarn;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  }

  expect(result).to.deep.equal([0x12, 0x34, 0x56, 1]);
  expect(second).to.deep.equal([0x12, 0x34, 0x56, 1]);
  expect(warnings).to.have.length(1);
  const message = warnings.flat().join(' ');
  // Distinguishable from `warnInvalidColor()`'s "could not parse ... as a CSS color" message: this
  // one names the missing canvas context as the cause, and names the component so a consumer can
  // tell which element logged it.
  expect(message).to.contain('canvas');
  expect(message).to.contain('<lr-heatmap>');
  expect(message).to.not.contain('could not parse');
});
