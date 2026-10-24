import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraPreparedCategoryData, LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';
import type { LyraChart } from './chart.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import './chart.js';
import './lite-chart.js';

function categories(): LyraPreparedCategoryData {
  return {
    kind: 'categories', revision: 'valid', aggregation: 'sum',
    counts: { sourceCount: 2, validCount: 2, invalidCount: 0 },
    categories: [{ id: 'a', label: 'Category A' }, { id: 'b', label: 'Category B' }],
    categoryCounts: [1, 1], series: [{ id: 's', label: 'Prepared values', values: [3, 7] }],
  };
}

function series(): LyraPreparedSeriesData {
  return {
    kind: 'series', revision: 'valid', getPoint: ref => ({ x: ref.sourceIndex, y: ref.sourceIndex * 2 }),
    series: [{ id: 's', label: 'Prepared values', counts: { sourceCount: 4, validCount: 4, invalidCount: 0 },
      xDomain: { min: 0, max: 3 }, yDomain: { min: 0, max: 6 },
      samples: [{ x: 0, y: 0, sourceIndex: 0, breakBefore: true }, { x: 3, y: 6, sourceIndex: 3, breakBefore: false }],
    }],
  };
}

const invalid: readonly { name: string; source(): unknown; maxRecords?: number }[] = [
  { name: 'a non-record category', source: () => ({ ...categories(), categories: [null] }) },
  { name: 'a non-array series collection', source: () => ({ ...categories(), series: {} }) },
  { name: 'an empty series collection', source: () => ({ ...categories(), series: [] }) },
  { name: 'a blank category identity', source: () => ({ ...categories(), categories: [{ id: ' ', label: 'A' }] }) },
  { name: 'an oversized category identity', source: () => ({ ...categories(), categories: [{ id: 'x'.repeat(257), label: 'A' }] }) },
  { name: 'non-string category metadata', source: () => ({ ...categories(), categories: [{ id: 'a', label: 5 }] }) },
  { name: 'duplicate category identities', source: () => ({ ...categories(), categories: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }] }) },
  { name: 'a category count length mismatch', source: () => ({ ...categories(), categoryCounts: [2] }) },
  { name: 'category counts that do not conserve observations', source: () => ({ ...categories(), categoryCounts: [2, 2] }) },
  { name: 'an unknown aggregation', source: () => ({ ...categories(), aggregation: 'median' }) },
  { name: 'a category value length mismatch', source: () => ({ ...categories(), series: [{ id: 's', label: 'S', values: [3] }] }) },
  { name: 'duplicate series identities', source: () => {
    const source = categories();
    return { ...source, series: [source.series[0], source.series[0]] };
  } },
  { name: 'aggregate metadata above the text budget', source: () => ({
    ...categories(), counts: { sourceCount: 64, validCount: 64, invalidCount: 0 },
    categories: Array.from({ length: 64 }, (_, index) => ({ id: `c${index}`, label: 'x'.repeat(1024) })),
    categoryCounts: Array<number>(64).fill(1),
    series: [{ id: 's', label: 'S', values: Array<number>(64).fill(1) }],
  }) },
  { name: 'a missing exact series reader', source: () => ({ ...series(), getPoint: null }) },
  { name: 'an insufficient exact-overlay budget', source: series, maxRecords: 4 },
  { name: 'a reversed numeric domain', source: () => {
    const source = series();
    return { ...source, series: [{ ...source.series[0], xDomain: { min: 3, max: 0 } }] };
  } },
  { name: 'a domain on an all-invalid series', source: () => {
    const source = series();
    return { ...source, series: [{ ...source.series[0], counts: { sourceCount: 4, validCount: 0, invalidCount: 4 }, samples: [] }] };
  } },
  { name: 'more samples than valid observations', source: () => {
    const source = series();
    return { ...source, series: [{ ...source.series[0], counts: { sourceCount: 4, validCount: 1, invalidCount: 3 } }] };
  } },
  { name: 'no samples for valid observations', source: () => {
    const source = series();
    return { ...source, series: [{ ...source.series[0], samples: [] }] };
  } },
  { name: 'a missing first path break', source: () => {
    const source = series();
    return { ...source, series: [{ ...source.series[0], samples: [{ x: 0, y: 0, sourceIndex: 0, breakBefore: false }] }] };
  } },
  { name: 'repeated source indices', source: () => {
    const source = series();
    return { ...source, series: [{ ...source.series[0], samples: [source.series[0]!.samples[0], source.series[0]!.samples[0]] }] };
  } },
  { name: 'a ragged series rectangle above the table budget', source: () => ({
    ...series(), series: [600, 1].map((count, index) => ({
      id: `s${index}`, label: `Series ${index}`, counts: { sourceCount: count, validCount: count, invalidCount: 0 },
      xDomain: { min: 0, max: count - 1 }, yDomain: { min: 0, max: count - 1 },
      samples: Array.from({ length: count }, (_, sourceIndex) => ({ x: sourceIndex, y: sourceIndex, sourceIndex, breakBefore: sourceIndex === 0 })),
    })),
  }) },
];

for (const tag of ['lr-chart', 'lr-lite-chart'] as const) {
  describe(`${tag} prepared provider admission`, () => {
    for (const entry of invalid) {
      it(`rejects ${entry.name} and recovers on a valid replacement`, async () => {
        const template = tag === 'lr-chart'
          ? html`<lr-chart type="bar" without-animation with-data-table style="inline-size:360px;block-size:240px"
              .strings=${{ chartPreparedUnavailable: 'Prepared source rejected' }}
              .labels=${['Legacy category']} .datasets=${[{ label: 'Legacy values', data: [91] }]}
            ></lr-chart>`
          : html`<lr-lite-chart type="bar" with-data-table style="inline-size:360px"
              .strings=${{ chartPreparedUnavailable: 'Prepared source rejected' }}
              .labels=${['Legacy category']} .datasets=${[{ label: 'Legacy values', data: [91] }]}
            ></lr-lite-chart>`;
        const element = await fixture<LyraChart | LyraLiteChart>(template);
        element.maxRecords = entry.maxRecords ?? 1000;
        Reflect.set(element, 'preparedData', entry.source());
        await element.updateComplete;
        expect(element.shadowRoot!.textContent).to.include('Prepared source rejected');
        expect(element.shadowRoot!.querySelectorAll('tbody tr, [part="data-list"] li').length).to.equal(0);
        expect(element.exportData('csv')).not.to.include('Legacy values');
        element.maxRecords = 1000;
        element.preparedData = categories();
        await element.updateComplete;
        await waitUntil(() => element.shadowRoot!.textContent?.includes('Category A') === true, 'valid category replacement did not render', { timeout: 5000 });
        expect(element.shadowRoot!.textContent).not.to.include('Prepared source rejected');
        expect(element.exportData('csv')).to.include('Category A,3');
        expect(element.exportData('csv')).to.include('Category B,7');
      });
    }
  });
}
