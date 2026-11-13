import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { EvalDatasetSource, EvalExample, LyraEvalDataset } from './eval-dataset.class.js';
import './eval-dataset.js';

const rows = [{ key: 'example', order: 0, value: { id: 'example', input: 'Question', tags: ['topic'] } }];
const available = { total: 1, values: [{ key: 'topic', label: 'Topic' }], unavailableSelected: [] };

for (const [name, unavailable] of [
  ['unselected unavailable facet', { ...available, unavailableSelected: ['unselected'] }],
  ['omitted selected facet', { total: 0, values: [], unavailableSelected: [] }],
] as const) {
  it(`rejects provider metadata containing an ${name} and retains the filter for retry`, async () => {
    const queries: string[][] = [];
    let invalid = true;
    const provider: EvalDatasetSource = { revision: 1,
      query: async ({ query }) => {
        queries.push([...query.tags]);
        return { total: 1, rows, tags: invalid && query.tags.length ? unavailable : available };
      }, lookup: async () => [], locate: async () => null };
    const host = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}
      .strings=${{ tableLoadFailed: 'Cannot load examples', retry: 'Try again' }}></lr-eval-dataset>`);
    const grid = host.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
    await waitUntil(() => grid.rows.length === 1);
    const chip = host.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
    await chip.updateComplete;
    chip.click();
    await waitUntil(() => grid.error);
    await grid.updateComplete;
    expect(host.sourceTotal).to.equal(null);
    expect(grid.rows.length).to.equal(0);
    expect(grid.shadowRoot!.querySelector('lr-empty')?.getAttribute('heading')).to.equal('Cannot load examples');
    expect(queries).to.deep.equal([[], ['topic']]);
    invalid = false;
    grid.shadowRoot!.querySelector<HTMLElement>('[part="retry-button"]')!.click();
    await waitUntil(() => grid.rows.length === 1 && !grid.error);
    expect(queries).to.deep.equal([[], ['topic'], ['topic']]);
    expect(host.sourceTotal).to.equal(1);
    expect(grid.rows[0]?.input).to.equal('Question');
    expect(host.shadowRoot!.querySelector<LyraChip>('lr-chip')?.selected).to.equal(true);
    expect(host.examples.length).to.equal(0);
  });
}

it('removes an explicitly unavailable selected facet before reloading the unfiltered provider page', async () => {
  const queries: string[][] = [];
  const provider: EvalDatasetSource = { revision: 1,
    query: async ({ query }) => {
      queries.push([...query.tags]);
      if (query.tags.length) return { total: 0, rows: [], tags: { total: 0, values: [], unavailableSelected: ['topic'] } };
      return queries.length === 1 ? { total: 1, rows, tags: available }
        : { total: 1, rows: [{ key: 'new', order: 0, value: { id: 'new', input: 'Current example', tags: ['current'] } }],
          tags: { total: 1, values: [{ key: 'current', label: 'Current' }], unavailableSelected: [] } };
    }, lookup: async () => [], locate: async () => null };
  const host = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .dataSource=${provider}></lr-eval-dataset>`);
  const grid = host.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  await waitUntil(() => grid.rows[0]?.id === 'example');
  const chip = host.shadowRoot!.querySelector<LyraChip>('lr-chip')!;
  await chip.updateComplete;
  chip.click();
  await waitUntil(() => grid.rows[0]?.id === 'new');
  expect(queries).to.deep.equal([[], ['topic'], []]);
  expect(host.sourceTotal).to.equal(1);
  expect(grid.error).to.equal(false);
  expect(grid.rows[0]?.input).to.equal('Current example');
  const facets = [...host.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')];
  expect(facets.map(value => value.value)).to.deep.equal(['current']);
  expect(facets.map(value => value.selected)).to.deep.equal([false]);
  expect(host.examples.length).to.equal(0);
});
