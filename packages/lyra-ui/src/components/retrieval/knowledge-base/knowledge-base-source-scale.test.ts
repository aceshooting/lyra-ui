import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './knowledge-base.js';
import type { KnowledgeBaseSource, KnowledgeSource, LyraKnowledgeBase } from './knowledge-base.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraDropdown } from '../../overlays/overlay/dropdown.class.js';

it('keeps million-source middle and final pages, global summaries and actions bounded', async () => {
  const total = 1_000_003;
  const values: KnowledgeSource[] = Array.from({ length: total }, (_, index) => ({ id: `s${index}`, name: `Source ${index}`, syncStatus: 'synced' }));
  let fieldReads = 0; let queries = 0; let lookups = 0; let active = 0; let peak = 0;
  const pages: number[] = [];
  const source: KnowledgeBaseSource = {
    revision: 1,
    query: async ({ page, pageSize }) => {
      queries++; pages.push(page); active++; peak = Math.max(peak, active);
      await Promise.resolve(); active--;
      return { total, summary: { total, synced: total, syncing: 0, attention: 0 }, rows: values.slice(page * pageSize, (page + 1) * pageSize).map((value, offset) => ({
        key: value.id, order: page * pageSize + offset,
        value: new Proxy(value, { ownKeys() { throw new Error('Source dictionary walked'); }, getOwnPropertyDescriptor(target, key) { fieldReads++; return Reflect.getOwnPropertyDescriptor(target, key); } }),
      })) };
    },
    lookup: async () => { lookups++; return []; },
    locate: async () => { lookups++; return null; },
  };
  const started = performance.now();
  const el = await fixture<LyraKnowledgeBase>(html`<lr-knowledge-base .strings=${{ loading: 'Loading', tableLoadFailed: 'Load failed' }} .dataSource=${source} .sourcePageSize=${100}></lr-knowledge-base>`);
  const loaded = async (id: string) => {
    await waitUntil(() => el.sourceTotal === total && el.shadowRoot?.querySelector<LyraTable<KnowledgeSource>>('lr-table')?.rows[0]?.id === id);
    const table = el.shadowRoot!.querySelector<LyraTable<KnowledgeSource>>('lr-table')!; await table.updateComplete; return table;
  };
  let grid = await loaded('s0'); el.sourcePage = 5_000; grid = await loaded('s500000');
  expect(grid.rows.length).to.equal(100); expect(grid.shadowRoot!.querySelectorAll('[part="row"]').length).to.be.at.most(100);
  grid.dispatchEvent(new CustomEvent('lr-page-change', { detail: { page: 10_001 }, bubbles: true, composed: true }));
  grid = await loaded('s1000000'); expect(grid.rows.length).to.equal(3);
  const dropdown = grid.shadowRoot!.querySelector<LyraDropdown>('lr-dropdown')!; await dropdown.show();
  let selected = ''; el.addEventListener('lr-source-delete', event => { selected = event.detail.sourceId; });
  dropdown.querySelector('lr-menu')!.dispatchEvent(new CustomEvent('lr-select', { detail: { item: { value: 'delete' } }, bubbles: true, composed: true }));
  expect(selected).to.equal('s1000000'); expect(pages).to.deep.equal([0, 5_000, 10_000]); expect(queries).to.equal(3); expect(lookups).to.equal(0); expect(peak).to.equal(1); expect(fieldReads).to.equal(203 * 9);
  expect([...el.shadowRoot!.querySelectorAll('lr-stat')].map(stat => stat.getAttribute('value'))).to.deep.equal(['1,000,003', '1,000,003', '0', '0']);
  recordScaleMeasurement('lr-knowledge-base', 'n=1000003 allocated sources first middle final pages', { sources: total, queries, lookups, peak, fieldReads, pageRows: grid.rows.length }, { elapsedMs: Math.round(performance.now() - started) });
});
