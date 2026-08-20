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

// lr-heatmap's resolveRgb() falls through to a 1x1 getImageData() readback on this shared context
// whenever a colour is one the canvas normalizes into a form neither hexToRgb nor parseRgbString
// accepts -- color-mix(), oklch(), lab(). Chrome then warns, on every page carrying a heatmap, that
// "multiple readback operations using getImageData are faster with the willReadFrequently attribute
// set to true" -- a warning the consumer can do nothing about. A ramp built from color-mix() hits
// the readback per cell, so this is a real per-frame cost there, not only a console nuisance.
it('creates the shared scratch context as read-frequently', () => {
  const created: unknown[] = [];
  const probeDocument = document.implementation.createHTMLDocument('scratch-attrs');
  const canvas = probeDocument.createElement('canvas');
  const originalGetContext = canvas.getContext.bind(canvas);
  canvas.getContext = ((type: string, attributes?: unknown) => {
    created.push(attributes);
    return originalGetContext(type as '2d', attributes as CanvasRenderingContext2DSettings);
  }) as typeof canvas.getContext;
  const originalCreateElement = probeDocument.createElement.bind(probeDocument);
  probeDocument.createElement = ((tag: string) =>
    tag === 'canvas' ? canvas : originalCreateElement(tag)) as typeof probeDocument.createElement;

  getScratchCtx(probeDocument);

  expect(created.length, 'the context is created once per document').to.equal(1);
  expect(
    (created[0] as { willReadFrequently?: boolean } | undefined)?.willReadFrequently,
    'the scratch canvas exists to be read back from',
  ).to.equal(true);
});
