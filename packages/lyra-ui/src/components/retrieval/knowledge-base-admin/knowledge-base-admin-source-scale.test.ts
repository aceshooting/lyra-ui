import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './knowledge-base-admin.js';
import type { LyraKnowledgeBaseAdmin } from './knowledge-base-admin.class.js';
import type { KnowledgeBaseSource, LyraKnowledgeBase } from '../knowledge-base/knowledge-base.class.js';
import type { IngestionQueueSource, LyraIngestionQueue } from '../ingestion-queue/ingestion-queue.class.js';

it('suppresses only the provider-covered admission notice and restores original legacy provenance', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-knowledge-base-admin', 'sources'));
  expectDevWarning(collectionTruncationWarningKey('lr-knowledge-base-admin', 'ingestionItems'));
  const sources = Array.from({ length: 12_000 }, (_, i) => ({ id: `s${i}`, name: 'Source', syncStatus: 'synced' as const }));
  const items = Array.from({ length: 12_000 }, (_, i) => ({ id: `i${i}`, document: { id: `d${i}`, name: 'Document' }, stage: 'queued' as const }));
  const dataSource: KnowledgeBaseSource = { revision: 1, query: async () => ({ total: 0, rows: [], summary: { total: 0, synced: 0, syncing: 0, attention: 0 } }), lookup: async () => [], locate: async () => null };
  const ingestionSource: IngestionQueueSource = { revision: 1, query: async () => ({ total: 0, rows: [] }), lookup: async () => [], locate: async () => null };
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .sources=${sources} .ingestionItems=${items} .dataSource=${dataSource} .ingestionSource=${ingestionSource}></lr-knowledge-base-admin>`);
  const sourceLoss = publicCollectionTruncation(host, 'sources')!; const itemLoss = publicCollectionTruncation(host, 'ingestionItems')!;
  expect(sourceLoss.source).to.equal(12_000); expect(itemLoss.source).to.equal(12_000); expect(host.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
  host.dataSource = undefined; await host.updateComplete; expect(host.shadowRoot!.querySelector('[part="input-limit"]')!.textContent).to.contain('12,000');
  host.activeTab = 'ingestion'; await host.updateComplete; expect(host.shadowRoot!.querySelector('[part="input-limit"]') === null).to.equal(true);
  host.ingestionSource = undefined; await host.updateComplete; expect(host.shadowRoot!.querySelector('[part="input-limit"]')!.textContent).to.contain('12,000');
  expect(publicCollectionTruncation(host, 'sources')!.retained).to.equal(sourceLoss.retained); expect(publicCollectionTruncation(host, 'ingestionItems')!.retained).to.equal(itemLoss.retained);
  recordScaleMeasurement('lr-knowledge-base-admin', 'provider removal restores n=12000 legacy admission', { sourceRetained: sourceLoss.retained, itemRetained: itemLoss.retained, visibleNotices: host.shadowRoot!.querySelectorAll('[part="input-limit"]').length });
});

it('forwards two logical-million providers without enumerating them or retaining inactive child rows', async () => {
  const total = 1_000_003; let sourceQueries = 0; let ingestionQueries = 0; let lookups = 0; let rowReads = 0;
  const dataSource: KnowledgeBaseSource = new Proxy({ revision: 1,
    query: async ({ page, pageSize }: Parameters<KnowledgeBaseSource['query']>[0]) => {
      sourceQueries++;
      return { total, summary: { total, synced: total, syncing: 0, attention: 0 }, rows: Array.from({ length: Math.min(pageSize, total - page * pageSize) }, (_, i) => {
        const index = page * pageSize + i; const value = { id: `s${index}`, name: `Source ${index}`, syncStatus: 'synced' as const };
        return { key: value.id, order: index, value: new Proxy(value, { getOwnPropertyDescriptor(target, key) { rowReads++; return Reflect.getOwnPropertyDescriptor(target, key); }, ownKeys() { throw new Error('Record walked'); } }) };
      }) };
    }, lookup: async () => { lookups++; return []; }, locate: async () => { lookups++; return null; },
  }, { ownKeys() { throw new Error('Provider enumerated'); } });
  const ingestionSource: IngestionQueueSource = new Proxy({ revision: 1,
    query: async ({ page, pageSize }: Parameters<IngestionQueueSource['query']>[0]) => {
      ingestionQueries++; return { total, rows: Array.from({ length: Math.min(pageSize, total - page * pageSize) }, (_, i) => {
        const index = page * pageSize + i; return { key: `i${index}`, order: index, value: { id: `i${index}`, document: { id: `d${index}`, name: `Document ${index}` }, stage: 'queued' as const } };
      }) };
    }, lookup: async () => { lookups++; return []; }, locate: async () => { lookups++; return null; },
  }, { ownKeys() { throw new Error('Provider enumerated'); } });
  const host = await fixture<LyraKnowledgeBaseAdmin>(html`<lr-knowledge-base-admin .dataSource=${dataSource} .ingestionSource=${ingestionSource}></lr-knowledge-base-admin>`);
  await waitUntil(() => host.shadowRoot?.querySelector<LyraKnowledgeBase>('lr-knowledge-base')?.sourceTotal === total);
  const inventory = host.shadowRoot!.querySelector<LyraKnowledgeBase>('lr-knowledge-base')!; inventory.sourcePage = 10_000;
  await waitUntil(() => inventory.sourceTotal === total && inventory.sourcePage === 10_000); host.activeTab = 'ingestion';
  await waitUntil(() => host.shadowRoot?.querySelector<LyraIngestionQueue>('lr-ingestion-queue')?.sourceTotal === total);
  expect(inventory.isConnected).to.equal(false); expect(inventory.sourceTotal).to.equal(null); expect(host.shadowRoot!.querySelectorAll('lr-knowledge-base').length).to.equal(0);
  expect(sourceQueries).to.equal(2); expect(ingestionQueries).to.equal(1); expect(lookups).to.equal(0); expect(rowReads).to.equal(103 * 9); expect(host.sources.length).to.equal(0); expect(host.ingestionItems.length).to.equal(0);
  recordScaleMeasurement('lr-knowledge-base-admin', 'two lazy logical-million providers, active child only', { logicalTotal: total, sourceQueries, ingestionQueries, lookups, rowReads, activeChildren: host.shadowRoot!.querySelectorAll('lr-knowledge-base,lr-ingestion-queue').length });
});
