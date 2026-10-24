import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './retrieval-results.js';
import type { LyraRetrievalResults, RetrievalResultsSource } from './retrieval-results.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
import type { RetrievalChunk } from '../../../ai/types.js';

const entry = (order: number): LyraSourceRecord<RetrievalChunk> => ({
  key: `c${order}`,
  order,
  value: { id: `c${order}`, text: `Passage ${order}`, score: 0.5, source: { id: 'source', name: 'Source' } },
});

function provider(query: RetrievalResultsSource['query']): RetrievalResultsSource {
  return {
    revision: 1,
    query,
    lookup: async (keys) => keys.map((key) => entry(Number(key.slice(1)))),
    locate: async (key) => Number(key.slice(1)),
  };
}

describe('lr-retrieval-results provider page states', () => {
  it('shows the localized loading status while the provider page is pending, without rows or an empty state', async () => {
    const el = await fixture<LyraRetrievalResults>(html`
      <lr-retrieval-results .dataSource=${provider(() => new Promise(() => undefined))}></lr-retrieval-results>
    `);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="source-status"]') !== null);

    expect(el.shadowRoot!.querySelector('[part="source-status"]')?.textContent?.trim()).to.equal('Loading…');
    expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="empty"]') === null).to.equal(true);
  });

  it('reports a failed provider page generically and retries it from the retry control', async () => {
    let attempts = 0;
    const el = await fixture<LyraRetrievalResults>(html`
      <lr-retrieval-results
        .dataSource=${provider(async () => {
          attempts += 1;
          if (attempts === 1) throw new Error('internal provider detail');
          return { total: 1, rows: [entry(0)], groups: [] };
        })}
      ></lr-retrieval-results>
    `);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="source-retry"]') !== null);

    const status = el.shadowRoot!.querySelector('[part="source-status"]')!;
    expect(status.textContent).not.to.contain('internal provider detail');
    expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);

    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="source-retry"]')!.click();
    await waitUntil(() => el.shadowRoot!.querySelector('lr-virtual-list') !== null);
    expect(attempts).to.equal(2);
    expect(el.shadowRoot!.querySelector('[part="source-retry"]') === null).to.equal(true);
  });

  it('renders the empty state when the provider has no rows', async () => {
    const el = await fixture<LyraRetrievalResults>(html`
      <lr-retrieval-results .dataSource=${provider(async () => ({ total: 0, rows: [], groups: [] }))}></lr-retrieval-results>
    `);
    await waitUntil(() => el.shadowRoot!.querySelector('[part="empty"]') !== null);

    expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="source-status"]') === null).to.equal(true);
  });

  it('puts the authored error text ahead of any provider page state', async () => {
    const el = await fixture<LyraRetrievalResults>(html`
      <lr-retrieval-results
        error-text="Search is unavailable"
        .dataSource=${provider(async () => ({ total: 1, rows: [entry(0)], groups: [] }))}
      ></lr-retrieval-results>
    `);

    expect(el.shadowRoot!.querySelector('[part="error"]')?.textContent?.trim()).to.equal('Search is unavailable');
    expect(el.shadowRoot!.querySelector('[part="source-status"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('lr-virtual-list') === null).to.equal(true);
  });
});
