import { expect } from '@open-wc/testing';
import { getScratchCtx } from './canvas.js';

it('returns a usable 2D canvas rendering context', () => {
  const ctx = getScratchCtx();
  expect(ctx !== null).to.equal(true);
  expect(ctx instanceof CanvasRenderingContext2D).to.equal(true);
});

it('memoizes the context across calls instead of allocating a new canvas each time', () => {
  const first = getScratchCtx();
  const second = getScratchCtx();
  expect(first === second).to.equal(true);
});

it('memoizes independently per owner document', () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  try {
    const frameDocument = iframe.contentDocument!;
    const parentContext = getScratchCtx(document);
    const frameContext = getScratchCtx(frameDocument);
    expect(frameContext !== parentContext).to.equal(true);
    expect(frameContext?.canvas.ownerDocument === frameDocument).to.equal(true);
    expect(getScratchCtx(frameDocument) === frameContext).to.equal(true);
  } finally {
    iframe.remove();
  }
});

it('fails closed without an owner document', () => {
  expect(getScratchCtx(null) === null).to.equal(true);
});
