import { expect, fixture, html } from '@open-wc/testing';
import './eval-dataset.js';
import type { LyraEvalDataset } from './eval-dataset.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { registerLyraLocale } from '../../../internal/localization-runtime.js';
import type { LyraTable } from '../../data/table/table.js';

it('reuses filtering and bounds tag facets across unrelated updates at n=10000', async () => {
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset
    .strings=${{ tagFacetLimit: '+{count} more tags' }}
    .examples=${Array.from({ length: 10000 }, (_, i) => ({ id: `e${i}`, input: `Example ${i}`, tags: [`tag${i % 1000}`] }))}
  ></lr-eval-dataset>`);
  const seam = el as unknown as { filterExamples(): unknown[]; allTags(): string[]; selectedId: string | null; searchText: string };
  const original = seam.filterExamples;
  const tags = seam.allTags();
  let filters = 0;
  seam.filterExamples = function () { filters++; return original.call(this); };
  try {
    el.disabled = true;
    await el.updateComplete;
    seam.selectedId = 'e2';
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll('lr-chip').length;
    recordScaleMeasurement('lr-eval-dataset', 'n=10000 selection and disabled', { filterPasses: filters, chips });
    expect(filters).to.equal(0);
    expect(seam.allTags() === tags).to.equal(true);
    expect(chips).to.equal(500);
    expect(el.shadowRoot!.textContent).to.include('+500 more tags');
    seam.searchText = 'tag999';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<LyraTable>('lr-table')!.rows.length).to.equal(10);
  } finally { seam.filterExamples = original; }
});

it('refreshes identity-retained example contents on explicit refresh and a new-array reassignment', async () => {
  const examples = [{ id: 'a', input: 'Alpha', tags: ['first'] }, { id: 'b', input: 'Beta', tags: ['second'] }];
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset searchable .examples=${examples}></lr-eval-dataset>`);
  const seam = el as unknown as { searchText: string };
  seam.searchText = 'Alpha';
  await el.updateComplete;
  examples[0]!.input = 'Changed';
  examples[1]!.input = 'Alpha';
  el.disabled = true;
  el.requestUpdate();
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  await table.updateComplete;
  expect(table.rows.map(row => (row as { id: string }).id)).to.deep.equal(['b']);
  expect(table.shadowRoot!.textContent).to.include('Alpha');
  examples[0]!.input = 'Alpha';
  el.examples = examples;
  await el.updateComplete;
  await table.updateComplete;
  expect(table.rows.map(row => (row as { id: string }).id)).to.deep.equal(['b']);
  el.examples = [...examples];
  await el.updateComplete;
  await table.updateComplete;
  expect(table.rows.map(row => (row as { id: string }).id)).to.deep.equal(['a', 'b']);
});

it('refreshes capped facet labels and table columns on same-locale catalog replacement', async () => {
  const locale = 'en-x-eval-scale';
  registerLyraLocale(locale, { evalDatasetColumnInput: 'Original input', evalDatasetTagFilterLabel: 'Original tags', tagFacetLimit: '+{count} original tags' });
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset lang=${locale}
    .examples=${[{ id: 'a', input: 'Alpha', tags: Array.from({ length: 501 }, (_, i) => `tag${i}`) }]}
  ></lr-eval-dataset>`);
  registerLyraLocale(locale, { evalDatasetColumnInput: 'Replacement input', evalDatasetTagFilterLabel: 'Replacement tags', tagFacetLimit: '+{count} replacement tags' });
  el.disabled = true;
  el.requestUpdate();
  await el.updateComplete;
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  await table.updateComplete;
  expect(table.shadowRoot!.textContent).to.include('Replacement input');
  expect(el.shadowRoot!.querySelector('[part="tag-filter"]')!.getAttribute('aria-label')).to.equal('Replacement tags');
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('+1 replacement tags');
  el.strings = { tagFacetLimit: '{count} extra tags' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('1 extra tags');
});
