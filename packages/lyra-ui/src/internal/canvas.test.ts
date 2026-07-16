import { expect } from '@open-wc/testing';
import { getScratchCtx } from './canvas.js';

it('returns a usable 2D canvas rendering context', () => {
  const ctx = getScratchCtx();
  expect(ctx).to.not.be.null;
  expect(ctx).to.be.instanceOf(CanvasRenderingContext2D);
});

it('memoizes the context across calls instead of allocating a new canvas each time', () => {
  const first = getScratchCtx();
  const second = getScratchCtx();
  expect(first).to.equal(second);
});
