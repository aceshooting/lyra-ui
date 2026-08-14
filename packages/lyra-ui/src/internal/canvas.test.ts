import { expect } from '@open-wc/testing';
import { getScratchCtx, resolveBoundedCanvasAllocation } from './canvas.js';

describe('resolveBoundedCanvasAllocation', () => {
  it('preserves the requested scale when it is within both limits', () => {
    const allocation = resolveBoundedCanvasAllocation({
      cssWidth: 320,
      cssHeight: 180,
      desiredScale: 2,
      maxDimension: 4096,
      maxPixels: 8_388_608,
    });

    expect(allocation).to.deep.equal({
      cssWidth: 320,
      cssHeight: 180,
      pixelWidth: 640,
      pixelHeight: 360,
      scale: 2,
      scaleX: 2,
      scaleY: 2,
    });
    expect(Object.isFrozen(allocation)).to.equal(true);
  });

  it('reduces one uniform scale before integer rounding to satisfy both caps', () => {
    const allocation = resolveBoundedCanvasAllocation({
      cssWidth: 4_000,
      cssHeight: 2_000,
      desiredScale: 4,
      maxDimension: 4_096,
      maxPixels: 2_000_000,
    });

    expect(allocation.pixelWidth <= 4_096).to.equal(true);
    expect(allocation.pixelHeight <= 4_096).to.equal(true);
    expect(
      allocation.pixelWidth * allocation.pixelHeight <= 2_000_000
    ).to.equal(true);
    expect(allocation.scale).to.be.closeTo(0.5, Number.EPSILON);
    expect(allocation.scaleX).to.equal(allocation.pixelWidth / 4_000);
    expect(allocation.scaleY).to.equal(allocation.pixelHeight / 2_000);
  });

  it('normalizes invalid numeric inputs and never returns a zero-sized backing store', () => {
    const allocation = resolveBoundedCanvasAllocation({
      cssWidth: Number.NaN,
      cssHeight: 0,
      desiredScale: Number.POSITIVE_INFINITY,
      maxDimension: Number.NaN,
      maxPixels: -1,
    });

    expect(allocation).to.deep.equal({
      cssWidth: 1,
      cssHeight: 1,
      pixelWidth: 1,
      pixelHeight: 1,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
    });
  });
});

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
