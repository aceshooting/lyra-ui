import { expect, fixture, html } from '@open-wc/testing';
import './virtual-list.js';
import type { LyraVirtualList } from './virtual-list.class.js';

interface MeasurementSeam {
  rowResizeObserver?: ResizeObserver;
  identityAt(index: number): string;
  pendingRowMeasurements: Map<string, { index: number; height: number }>;
  measuredIndices: Map<string, number>;
  measuredHeights: Map<string, number>;
  applyPendingRowMeasurements(): void;
}

async function measuredSourceFixture(readyHeight = 60) {
  let ready = false;
  const source = { count: 2, itemAt: (index: number) => index,
    keyAt: (index: number) => ready ? `row-${index}` : index };
  const el = await fixture<LyraVirtualList>(html`<lr-virtual-list row-height="auto"
    style="--lr-virtual-list-height:120px" .source=${source}
    .renderItem=${() => html`<div style=${`height:${ready ? readyHeight : 24}px`}></div>`}></lr-virtual-list>`);
  const seam = el as unknown as MeasurementSeam;
  // Deliver the actual observation-fold seam deterministically, before or after key replacement.
  // Native observer timing is tested separately; no global observer or clock is replaced here.
  const observer = seam.rowResizeObserver;
  observer?.disconnect();
  seam.rowResizeObserver = undefined;
  seam.pendingRowMeasurements.clear();
  const loadingKey = seam.identityAt(0);
  const measure = (key: string, height: number) => {
    seam.pendingRowMeasurements.set(key, { index: 0, height });
    seam.applyPendingRowMeasurements();
  };
  measure(loadingKey, 24);
  await el.updateComplete;
  expect(el.offsetForIndex(1)).to.equal(24);
  return { el, seam, loadingKey, measure,
    async resolve() { ready = true; el.requestUpdate('renderItem'); await el.updateComplete; return seam.identityAt(0); },
    restore() { seam.rowResizeObserver = observer; },
  };
}

for (const readyHeight of [24, 60]) it(`replaces an indexed placeholder measurement with a ${readyHeight}px semantic row`, async () => {
  const test = await measuredSourceFixture(readyHeight);
  try {
    const readyKey = await test.resolve();
    expect(readyKey).not.to.equal(test.loadingKey);
    test.measure(readyKey, readyHeight);
    await test.el.updateComplete;
    const keys = [...test.seam.measuredIndices].filter(([, index]) => index === 0).map(([key]) => key);
    expect(keys).to.deep.equal([readyKey]);
    expect(test.seam.measuredHeights.has(test.loadingKey)).to.equal(false);
    expect(test.el.offsetForIndex(1)).to.equal(readyHeight);
    expect(test.el.offsetForIndex(2)).to.be.greaterThan(test.el.offsetForIndex(1));
  } finally { test.restore(); }
});

it('ignores a queued indexed placeholder observation after the ready identity replaces it', async () => {
  const test = await measuredSourceFixture();
  try {
    const readyKey = await test.resolve();
    test.measure(readyKey, 60);
    await test.el.updateComplete;
    test.measure(test.loadingKey, 8);
    await test.el.updateComplete;
    expect(test.seam.measuredHeights.has(test.loadingKey)).to.equal(false);
    expect(test.seam.measuredHeights.get(readyKey)).to.equal(60);
    expect(test.el.offsetForIndex(1)).to.equal(60);
  } finally { test.restore(); }
});
