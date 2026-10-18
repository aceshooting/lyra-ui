import { expect, fixture, html } from '@open-wc/testing';
import './sequence-strip.js';
import type { LyraSequenceStrip } from './sequence-strip.class.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses category and bucket derivations across hover updates of 600 items', async () => {
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip with-legend .items=${Array.from({ length: 600 }, (_, i) => ({ id: `${i}`, categoryId: `${i % 50}` }))} .categories=${Array.from({ length: 50 }, (_, i) => ({ id: `${i}`, label: `${i}`, color: '#123456' }))}></lr-sequence-strip>`);
  const probe = el as unknown as { categoryMap(): unknown; bucketSummary(): unknown; hoverIndex: number };
  const categories = countCalls(probe, 'categoryMap');
  const buckets = countCalls(probe, 'bucketSummary');
  try {
    for (let i = 0; i < 10; i++) { probe.hoverIndex = i; await el.updateComplete; }
    expect(categories.calls).to.equal(0);
    expect(buckets.calls).to.equal(0);
    recordScaleMeasurement('lr-sequence-strip', 'hover@600', { categoryMaps: categories.calls, summaries: buckets.calls });
  } finally { categories.restore(); buckets.restore(); }
});

it('shares category lookup and one bucket summary during content refresh', async () => {
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip .items=${Array.from({ length: 600 }, (_, i) => ({ id: `${i}`, categoryId: 'a' }))} .categories=${[{ id: 'a', label: 'Alpha' }]}></lr-sequence-strip>`);
  const probe = el as unknown as { categoryMap(): unknown; bucketSummary(): unknown };
  const first = probe.categoryMap();
  const repeated = probe.categoryMap();
  const calls = countCalls(probe, 'bucketSummary');
  try {
    el.markerLabel = 'Marked';
    await el.updateComplete;
    expect(calls.calls).to.equal(1);
    expect(repeated === first).to.equal(true);
  } finally { calls.restore(); }
});
