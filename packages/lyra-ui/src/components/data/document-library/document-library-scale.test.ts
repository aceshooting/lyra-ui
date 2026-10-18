import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { registerLyraLocale } from '../../../internal/localization-runtime.js';
import './document-library.js';
import type { LyraDocumentLibrary, LibraryDocument } from './document-library.js';
import type { LyraTable } from '../table/table.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses sorting and table rows across selection and loading at n=10000', async () => {
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .strings=${{ tagFacetLimit: '+{count} more tags' }}
    .documents=${Array.from({ length: 10000 }, (_, i) => ({ id: `d${i}`, name: `Document ${10000 - i}`, tags: [`tag${i % 1000}`] }))}
  ></lr-document-library>`);
  const seam = el as unknown as { compareDocuments(a: LibraryDocument, b: LibraryDocument): number };
  const original = seam.compareDocuments;
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  const rows = table.rows;
  const columns = table.columns;
  const tableSeam = table as unknown as { admitRows(rows: readonly unknown[], sourceLength: number): void };
  const admitRows = tableSeam.admitRows;
  let rowsAdmissions = 0;
  tableSeam.admitRows = function (value, sourceLength) { rowsAdmissions++; admitRows.call(this, value, sourceLength); };
  let comparisons = 0;
  seam.compareDocuments = function (a, b) { comparisons++; return original.call(this, a, b); };
  try {
    el.loading = true;
    await el.updateComplete;
    const stableColumns = table.columns === columns;
    el.selectedDocumentIds = ['d2'];
    await el.updateComplete;
    const facets = el.shadowRoot!.querySelectorAll('lr-option').length;
    recordScaleMeasurement('lr-document-library', 'n=10000 selection and loading', { comparisons, rowsAdmissions, facets });
    expect(comparisons).to.equal(0);
    expect(rowsAdmissions).to.equal(0);
    expect(table.rows === rows).to.equal(true);
    expect(stableColumns).to.equal(true);
    expect(facets).to.equal(500);
    expect(el.shadowRoot!.textContent).to.include('+500 more tags');
    el.searchTerm = 'tag999';
    await el.updateComplete;
    expect(table.rows.length).to.equal(10);
  } finally { seam.compareDocuments = original; tableSeam.admitRows = admitRows; }
});

it('refreshes custom filter closures when a keyless request coalesces with selection', async () => {
  let accepted = 'alpha';
  let calls = 0;
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library search-term="query"
    .documents=${[{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }]}
    .filter=${(row: LibraryDocument) => { calls++; return row.id === accepted; }}
  ></lr-document-library>`);
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  calls = 0;
  el.selectedDocumentIds = ['beta'];
  accepted = 'beta';
  el.requestUpdate();
  await el.updateComplete;
  await table.updateComplete;
  expect(calls).to.equal(2);
  expect(table.shadowRoot!.textContent).to.include('Beta');
  expect(table.shadowRoot!.textContent).not.to.include('Alpha');
  expect((table.rows as LibraryDocument[]).map(row => row.id)).to.deep.equal(['beta']);
});

it('reuses an event-computed filter result and parses each date once per document', async () => {
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library
    .documents=${Array.from({ length: 1000 }, (_, i) => ({ id: `d${i}`, name: `Document ${i}`, updatedAt: `2024-01-${String(i % 28 + 1).padStart(2, '0')}` }))}
  ></lr-document-library>`);
  const seam = el as unknown as { normalizeDate(value: Date | string | undefined): Date | undefined };
  const original = seam.normalizeDate;
  let parses = 0;
  seam.normalizeDate = function (value) { parses++; return original.call(this, value); };
  try {
    el.sortKey = 'updatedAt';
    await el.updateComplete;
    expect(parses).to.be.at.most(1000);
    parses = 0;
    el.sortDir = 'desc';
    await el.updateComplete;
    expect(parses).to.equal(0);
    let matches = 0;
    el.filter = () => { matches++; return true; };
    await el.updateComplete;
    matches = 0;
    el.shadowRoot!.querySelector('lr-input')!.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'query' } }));
    await el.updateComplete;
    expect(matches).to.equal(1000);
  } finally { seam.normalizeDate = original; }
});

it('refreshes rendered labels after replacing the same locale catalog', async () => {
  const locale = 'en-x-library-scale';
  registerLyraLocale(locale, { documentLibraryNameColumn: 'Original column', documentLibraryFreshnessFresh: 'Original fresh', tagFacetLimit: '+{count} original tags' });
  const el = await fixture<LyraDocumentLibrary>(html`<lr-document-library lang=${locale}
    .documents=${[{ id: 'alpha', name: 'Alpha', freshness: 'fresh', tags: Array.from({ length: 501 }, (_, i) => `tag${i}`) }]}
  ></lr-document-library>`);
  const table = el.shadowRoot!.querySelector<LyraTable>('lr-table')!;
  registerLyraLocale(locale, { documentLibraryNameColumn: 'Replacement column', documentLibraryFreshnessFresh: 'Replacement fresh', tagFacetLimit: '+{count} replacement tags' });
  el.loading = false;
  el.requestUpdate();
  await el.updateComplete;
  await table.updateComplete;
  await waitUntil(() => table.shadowRoot!.textContent!.includes('Replacement column'));
  expect(table.shadowRoot!.textContent).to.include('Replacement fresh');
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal('+1 replacement tags');
});
