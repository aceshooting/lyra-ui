import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './ingestion-queue/ingestion-queue.js';
import './memory-panel/memory-panel.js';
import './provenance-panel/provenance-panel.js';
import './retrieval-compare/retrieval-compare.js';
import './retrieval-results/retrieval-results.js';
import type { IngestionQueueItem, IngestionQueueSource } from './ingestion-queue/ingestion-queue.class.js';
import type { RetrievalResultsSource } from './retrieval-results/retrieval-results.class.js';
import type { LyraSourceRecord } from '../../data-sources.js';
import type { RetrievalChunk } from '../../ai/types.js';

interface EmptyStateCase {
  readonly tag: string;
  readonly role: 'group' | 'region';
  readonly mount: (hostLabel: string | null) => Promise<HTMLElement>;
}

/** Each case mounts the component with no data so the empty state, not a populated list, renders. */
const cases: readonly EmptyStateCase[] = [
  {
    tag: 'lr-ingestion-queue',
    role: 'region',
    mount: (label) => fixture<HTMLElement>(label === null
      ? html`<lr-ingestion-queue></lr-ingestion-queue>`
      : html`<lr-ingestion-queue aria-label=${label}></lr-ingestion-queue>`),
  },
  {
    tag: 'lr-memory-panel',
    role: 'group',
    mount: (label) => fixture<HTMLElement>(label === null
      ? html`<lr-memory-panel></lr-memory-panel>`
      : html`<lr-memory-panel aria-label=${label}></lr-memory-panel>`),
  },
  {
    tag: 'lr-provenance-panel',
    role: 'group',
    mount: (label) => fixture<HTMLElement>(label === null
      ? html`<lr-provenance-panel></lr-provenance-panel>`
      : html`<lr-provenance-panel aria-label=${label}></lr-provenance-panel>`),
  },
  {
    tag: 'lr-retrieval-compare',
    role: 'region',
    mount: (label) => fixture<HTMLElement>(label === null
      ? html`<lr-retrieval-compare></lr-retrieval-compare>`
      : html`<lr-retrieval-compare aria-label=${label}></lr-retrieval-compare>`),
  },
];

describe('retrieval empty states under a host-authored name', () => {
  for (const { tag, role, mount } of cases) {
    it(`${tag} keeps one named owner in its empty state`, async () => {
      const unnamed = await mount(null);
      const unnamedBase = unnamed.shadowRoot!.querySelector('[part="base"]')!;
      expect(unnamedBase.getAttribute('role'), 'the shadow shell owns the role without a host name').to.equal(role);
      expect(unnamedBase.getAttribute('aria-label')?.trim().length, 'and carries the localized default name').to.be.greaterThan(0);
      expect(unnamed.shadowRoot!.querySelector('[part="empty"]') === null).to.equal(false);

      const named = await mount('Authored empty name');
      const namedBase = named.shadowRoot!.querySelector('[part="base"]')!;
      expect(named.getAttribute('aria-label')).to.equal('Authored empty name');
      expect(namedBase.getAttribute('role'), 'the host name leaves no second role owner in shadow DOM').to.equal(null);
      expect(namedBase.getAttribute('aria-label'), 'and no duplicate name').to.equal(null);
      expect(named.shadowRoot!.querySelector('[part="empty"]') === null).to.equal(false);
    });
  }
});

const queueEntry = (order: number): LyraSourceRecord<IngestionQueueItem> => ({
  key: `q${order}`,
  order,
  value: { id: `q${order}`, document: { id: `d${order}`, name: `Document ${order}` }, stage: 'queued' },
});
const queueSource: IngestionQueueSource = {
  revision: 1,
  query: async () => ({ total: 2, rows: [queueEntry(0), queueEntry(1)] }),
  lookup: async (keys) => keys.map((key) => queueEntry(Number(key.slice(1)))),
  locate: async (key) => Number(key.slice(1)),
};

const chunkEntry = (order: number): LyraSourceRecord<RetrievalChunk> => ({
  key: `c${order}`,
  order,
  value: { id: `c${order}`, text: `Passage ${order}`, score: 0.5, source: { id: 'source', name: 'Source' } },
});
const resultsSource: RetrievalResultsSource = {
  revision: 1,
  query: async () => ({ total: 2, rows: [chunkEntry(0), chunkEntry(1)], groups: [] }),
  lookup: async (keys) => keys.map((key) => chunkEntry(Number(key.slice(1)))),
  locate: async (key) => Number(key.slice(1)),
};

describe('retrieval source-backed views under a host-authored name', () => {
  it('lr-ingestion-queue names the loaded provider page once', async () => {
    const mount = (label: string | null) => fixture<HTMLElement>(label === null
      ? html`<lr-ingestion-queue .dataSource=${queueSource}></lr-ingestion-queue>`
      : html`<lr-ingestion-queue aria-label=${label} .dataSource=${queueSource}></lr-ingestion-queue>`);
    const unnamed = await mount(null);
    await waitUntil(() => unnamed.shadowRoot!.querySelectorAll('[part="item-name"]').length === 2);
    const unnamedBase = unnamed.shadowRoot!.querySelector('[part="base"]')!;
    expect(unnamedBase.getAttribute('role')).to.equal('region');
    expect(unnamedBase.getAttribute('aria-label')?.trim().length).to.be.greaterThan(0);

    const named = await mount('Authored queue name');
    await waitUntil(() => named.shadowRoot!.querySelectorAll('[part="item-name"]').length === 2);
    const namedBase = named.shadowRoot!.querySelector('[part="base"]')!;
    expect(namedBase.getAttribute('role')).to.equal(null);
    expect(namedBase.getAttribute('aria-label')).to.equal(null);
    expect(namedBase.getAttribute('aria-busy')).to.equal('false');
  });

  it('lr-retrieval-results names the loaded provider page once', async () => {
    const mount = (label: string | null) => fixture<HTMLElement>(label === null
      ? html`<lr-retrieval-results .dataSource=${resultsSource}></lr-retrieval-results>`
      : html`<lr-retrieval-results aria-label=${label} .dataSource=${resultsSource}></lr-retrieval-results>`);
    const unnamed = await mount(null);
    await waitUntil(() => unnamed.shadowRoot!.querySelector('lr-virtual-list') !== null);
    const unnamedBase = unnamed.shadowRoot!.querySelector('[part="base"]')!;
    expect(unnamedBase.getAttribute('role')).to.equal('group');
    expect(unnamedBase.getAttribute('aria-label')?.trim().length).to.be.greaterThan(0);

    const named = await mount('Authored results name');
    await waitUntil(() => named.shadowRoot!.querySelector('lr-virtual-list') !== null);
    const namedBase = named.shadowRoot!.querySelector('[part="base"]')!;
    expect(namedBase.getAttribute('role')).to.equal(null);
    expect(namedBase.getAttribute('aria-label')).to.equal(null);
  });
});
