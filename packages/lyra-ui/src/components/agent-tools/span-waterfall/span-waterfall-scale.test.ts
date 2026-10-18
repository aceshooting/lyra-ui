import { expect, fixture, html } from '@open-wc/testing';
import './span-waterfall.js';
import type { LyraSpanWaterfall } from './span-waterfall.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
expectDevWarning(collectionTruncationWarningKey('lr-span-waterfall', 'spans'));

it('reuses the sorted projection for active changes inside the retained window at n=10001', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall
    .strings=${{ spanWaterfallLimit: 'Showing {shown} of {total} spans.' }}
    .spans=${Array.from({ length: 10001 }, (_, i) => ({ id: `s${i}`, name: `Span ${i}`, startMs: i, endMs: i + 1, kind: 'tool', status: 'success' }))}
  ></lr-span-waterfall>`);
  const seam = el as unknown as { sortedSpans(): unknown[] };
  const initial = seam.sortedSpans();
  el.activeSpanId = 's10';
  await el.updateComplete;
  recordScaleMeasurement('lr-span-waterfall', 'n=10001 active change', { sortedProjectionReused: Number(initial === seam.sortedSpans()) });
  expect(initial === seam.sortedSpans()).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('Showing 500 of 10,001 spans.');
});

it('reserves an active span beyond the rendered window without shrinking the trace extent', async () => {
  const el = await fixture<LyraSpanWaterfall>(html`<lr-span-waterfall
    .spans=${Array.from({ length: 1000 }, (_, i) => ({ id: `s${i}`, name: `Span ${i}`, startMs: i, endMs: i + 1, kind: 'tool', status: 'success' }))}
  ></lr-span-waterfall>`);
  el.activeSpanId = 's999';
  await el.updateComplete;
  const seam = el as unknown as { sortedSpans(): { id: string }[]; sortedCacheExtentEndMs: number };
  expect(seam.sortedSpans().length).to.equal(500);
  expect(seam.sortedSpans().some(span => span.id === 's999')).to.equal(true);
  expect(seam.sortedCacheExtentEndMs).to.equal(1000);
});
