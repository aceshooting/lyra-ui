import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './eval-dataset.js';
import type { LyraEvalDataset, EvalDatasetSource, EvalExample } from './eval-dataset.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import type { LyraSourceRecord } from '../../../data-sources.js';
const entry = (order: number): LyraSourceRecord<EvalExample> => ({ key: `e${order}`, order, value: { id: `e${order}`, input: `Example ${order}`, tags: ['row-tag'] } });
const tags = { total: 1, values: [{ key: 'global', label: 'Global tag' }], unavailableSelected: [] };
function source(): EvalDatasetSource { return { revision: 1,
  query: async ({ page, pageSize }) => ({ total: 1_000_000, rows: Array.from({ length: Math.min(pageSize, 1_000_000 - page * pageSize) }, (_, i) => entry(page * pageSize + i)), tags }),
  lookup: async keys => keys.map(key => entry(Number(key.slice(1)))), locate: async key => Number(key.slice(1)) }; }
async function table(el: LyraEvalDataset, first: string) {
  await waitUntil(() => el.shadowRoot?.querySelector<LyraTable<EvalExample>>('lr-table')?.rows[0]?.id === first);
  const result = el.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!; await result.updateComplete; return result;
}
it('reaches first, middle and final million-source pages and clears selection once per transition', async () => {
  const provider = source(); const calls: number[] = []; const query = provider.query;
  provider.query = request => { calls.push(request.page); return query(request); };
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = await table(el, 'e0'); const selected: (string | null)[] = [];
  el.addEventListener('lr-example-select', e => selected.push(e.detail.exampleId));
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: grid.rows[0] } }));
  const pager = grid.shadowRoot!.querySelector('lr-pagination')!;
  const jump = pager.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
  jump.value = '5001'; jump.dispatchEvent(new Event('change')); await table(el, 'e500000');
  const finalJump = grid.shadowRoot!.querySelector('lr-pagination')!.shadowRoot!.querySelector<HTMLInputElement>('[part="page-input"]')!;
  finalJump.value = '10000'; finalJump.dispatchEvent(new Event('change')); await table(el, 'e999900');
  expect(selected).to.deep.equal(['e0', null]); expect(grid.rows[99]?.id).to.equal('e999999');
  expect(el.sourceTotal).to.equal(1_000_000); expect(el.examples.length).to.equal(0); expect(calls).to.deep.equal([0, 5000, 9999]);
  recordScaleMeasurement('lr-eval-dataset', 'n=1000000 source first middle final pages', {
    sourceTotal: el.sourceTotal!, retainedExamples: el.examples.length, pageRows: grid.rows.length, providerQueries: calls.length,
  });
});
it('uses global facets and server sorting while preserving one existing sort event', async () => {
  const provider = source(); const sorts: (string | null)[] = [];
  provider.query = async ({ query }) => { sorts.push(query.sortKey); return { total: 2, rows: [entry(9), entry(1)], tags }; };
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = await table(el, 'e9'); let events = 0; el.addEventListener('lr-sort', () => events++);
  grid.dispatchEvent(new CustomEvent('lr-sort', { detail: { phase: 'commit', sortKey: 'input', sortDir: 'desc' }, bubbles: true, composed: true }));
  await waitUntil(() => sorts.length === 2); await table(el, 'e9');
  expect(events).to.equal(1); expect(sorts).to.deep.equal([null, 'input']); expect(grid.sortMode).to.equal('server');
  expect(el.shadowRoot!.querySelector('lr-chip')?.textContent).to.include('Global tag');
});
it('retains available active facets and fails missing metadata without clearing selected filters', async () => {
  const provider = source(); const seen: readonly string[][] = [];
  let missing = false;
  provider.query = async ({ query }) => {
    (seen as string[][]).push([...query.tags]);
    return { total: 1, rows: [entry(0)], ...(missing ? {} : { tags }) };
  };
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  await table(el, 'e0'); const chip = el.shadowRoot!.querySelector<LyraChip>('lr-chip')!; await chip.updateComplete; chip.click();
  await waitUntil(() => seen.length === 2); await el.updateComplete;
  expect(seen[1]).to.deep.equal(['global']);
  missing = true; el.dataSource = provider; await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector<LyraTable>('lr-table')!.error);
  expect(seen[seen.length - 1]).to.deep.equal(['global']);
});
it('keeps legacy examples unchanged and restores them when provider is removed', async () => {
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${[{ id: 'legacy', input: 'Legacy' }]}></lr-eval-dataset>`);
  await table(el, 'legacy'); expect(el.dataSource).to.equal(undefined);
  el.dataSource = source(); await table(el, 'e0'); expect(el.examples[0]?.id).to.equal('legacy');
  el.dataSource = undefined; await table(el, 'legacy');
});

it('reserves selected global facets within500 and keeps them removable after catalogue expansion', async () => {
  const provider = source(); let expanded = false; const observed: string[][] = [];
  provider.query = async ({ query }) => {
    observed.push([...query.tags]);
    const values = expanded ? [...Array.from({ length: query.tags.length ? 499 : 500 }, (_, i) => ({ key: `a${i}`, label: `Tag ${i}` })), ...(query.tags.length ? [{ key: 'z', label: 'Last tag' }] : [])] : [{ key: 'z', label: 'Last tag' }];
    return { total: 1, rows: [entry(0)], tags: { total: expanded ? 501 : 1, values, unavailableSelected: [] } };
  };
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  await table(el, 'e0'); let chip = el.shadowRoot!.querySelector<LyraChip>('lr-chip')!; await chip.updateComplete; chip.click();
  await waitUntil(() => observed.length === 2); expanded = true; el.dataSource = provider;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('lr-chip').length === 500);
  chip = [...el.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')].find(value => value.value === 'z')!;
  expect(chip.selected).to.equal(true); await chip.updateComplete; chip.click();
  await waitUntil(() => observed.length === 4); expect(observed[3]).to.deep.equal([]);
});
it('forwards localized page errors/loading and keeps disabled remove and sort actions inert', async () => {
  const provider = source(); let fail = true; let calls = 0;
  provider.query = async () => { calls++; if (fail) throw new Error('Private provider detail'); return { total: 1, rows: [entry(0)], tags }; };
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .strings=${{ tableLoadFailed: 'Localized failure', retry: 'Try again' }} .dataSource=${provider}></lr-eval-dataset>`);
  const grid = el.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  await waitUntil(() => grid.error); await grid.updateComplete;
  expect(grid.shadowRoot!.textContent).not.to.include('Private provider detail');
  expect(grid.shadowRoot!.querySelector('lr-empty')?.getAttribute('heading')).to.equal('Localized failure');
  fail = false; el.requestUpdate(); await table(el, 'e0');
  el.disabled = true; await el.updateComplete;
  grid.dispatchEvent(new CustomEvent('lr-sort', { detail: { phase: 'commit', sortKey: 'input', sortDir: 'desc' }, bubbles: true, composed: true }));
  await el.updateComplete; expect(calls).to.equal(2);
});
it('clears page-local selection once when reconnect replays a changed provider page', async () => {
  const provider = source(); let changed = false; let queries = 0;
  provider.query = async () => { queries++; return { total: 1, rows: [entry(changed ? 1 : 0)], tags }; };
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = await table(el, 'e0');
  grid.dispatchEvent(new CustomEvent('lr-row-activate', { detail: { row: grid.rows[0] } })); await el.updateComplete;
  const selected: (string | null)[] = []; el.addEventListener('lr-example-select', e => selected.push(e.detail.exampleId));
  const parent = el.parentNode!; el.remove(); changed = true; parent.appendChild(el); await table(el, 'e1');
  expect(el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!.disabled).to.equal(true);
  expect(selected).to.deep.equal([null]); expect(queries).to.equal(2);
});

it('stops old row descriptor reads when an early descriptor changes the source page', async () => {
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset></lr-eval-dataset>`);
  const provider = source(); const query = provider.query;
  let invalidated = false; let laterReads = 0;
  const value = new Proxy(entry(0).value, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'id' && !invalidated) { invalidated = true; el.sourcePage = 1; }
      if (key === 'input') laterReads++;
      return Reflect.getOwnPropertyDescriptor(target, key);
    }
  });
  provider.query = request => request.page === 0
    ? Promise.resolve({ total: 1_000_000, rows: [{ ...entry(0), value }, ...Array.from({ length: 99 }, (_, i) => entry(i + 1))], tags })
    : query(request);
  el.dataSource = provider;
  await table(el, 'e100');
  expect(invalidated).to.equal(true); expect(laterReads).to.equal(0);
  expect(el.sourcePage).to.equal(1); expect(el.sourceTotal).to.equal(1_000_000);
});
