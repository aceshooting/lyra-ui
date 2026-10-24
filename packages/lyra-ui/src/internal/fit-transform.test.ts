import { expect } from '@open-wc/testing';
import { fitTransform } from './fit-transform.js';

describe('fitTransform', () => {
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
  const zoomBounds = { min: 0.1, max: 4 };

  it('fits an extent into the padded viewport and centers it', () => {
    // Available 200 x 100 for a 100 x 50 extent: zoom 2, extent centre (50, 25) lands on the view centre.
    expect({ ...fitTransform(bounds, { width: 300, height: 200 }, 50, zoomBounds) }).to.deep.equal({ x: 50, y: 50, zoom: 2 });
  });

  it('clamps the fitted zoom into the allowed range', () => {
    expect(fitTransform(bounds, { width: 10_000, height: 10_000 }, 0, zoomBounds).zoom).to.equal(4);
    expect(fitTransform({ ...bounds, maxX: 100_000 }, { width: 100, height: 100 }, 0, zoomBounds).zoom).to.equal(0.1);
  });

  it('falls back to the minimum zoom when the viewport leaves no usable size', () => {
    const noRoom = { width: 10, height: 10 };
    const wideRange = { min: 0.001, max: 4 };
    expect(fitTransform(bounds, noRoom, 20, wideRange).zoom, 'the default keeps one pixel available').to.be.closeTo(0.01, 1e-9);
    expect(fitTransform(bounds, noRoom, 20, wideRange, { minimumAvailableSize: 0 }).zoom).to.equal(0.001);
    expect(fitTransform(bounds, { width: Number.NaN, height: 100 }, 0, wideRange).zoom).to.equal(0.001);
  });

  it('uses the caller fallback, clamped into range, for an unusable fit', () => {
    const noRoom = { width: 10, height: 10 };
    expect(fitTransform(bounds, noRoom, 20, zoomBounds, { minimumAvailableSize: 0, invalidZoomFallback: 2 }).zoom).to.equal(2);
    expect(fitTransform(bounds, noRoom, 20, zoomBounds, { minimumAvailableSize: 0, invalidZoomFallback: 100 }).zoom).to.equal(4);
  });

  it('centers a degenerate extent on its own point unless the minimum extent is requested', () => {
    const point = { minX: 10, minY: 20, maxX: 10, maxY: 20 };
    const fixedZoom = { min: 1, max: 1 };
    expect({ ...fitTransform(point, { width: 100, height: 100 }, 0, fixedZoom) }).to.deep.equal({ x: 40, y: 30, zoom: 1 });
    expect({ ...fitTransform(point, { width: 100, height: 100 }, 0, fixedZoom, { centerWithMinimumExtent: true }) }).to.deep.equal({ x: 39.5, y: 29.5, zoom: 1 });
  });
});
