import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraDocumentLibrary, DocumentLibrarySource, LibraryDocument } from './document-library.class.js';
import type { LyraTable } from '../table/table.class.js';
import './document-library.js';

const documentRecord = (): LibraryDocument => ({ id: 'd0', name: 'Document', tags: ['topic'] });
const facets = { total: 1, values: [{ key: 'topic', label: 'Topic' }], unavailableSelected: [] };
async function rejectedDocument(value: unknown): Promise<void> {
  let invalid = true;
  const provider: DocumentLibrarySource = { revision: 1,
    query: async () => ({ total: 1, rows: [{ key: 'd0', order: 0, value: (invalid ? value : documentRecord()) as LibraryDocument }], tags: facets }),
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = viewer.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!;
  await waitUntil(() => grid.error);
  await grid.updateComplete;
  expect(viewer.sourceTotal).to.equal(null);
  expect(grid.rows.length).to.equal(0);
  expect(grid.shadowRoot!.textContent).not.to.contain('Private provider detail');
  invalid = false;
  grid.shadowRoot!.querySelector<HTMLElement>('[part="retry-button"]')!.click();
  await waitUntil(() => grid.rows[0]?.id === 'd0' && !grid.error);
  expect(viewer.sourceTotal).to.equal(1);
  expect(grid.rows[0]?.name).to.equal('Document');
  expect(viewer.documents.length).to.equal(0);
}

for (const [name, value] of [
  ['null record', null], ['array record', []], ['primitive record', 7],
  ['missing identity', { name: 'Document' }], ['missing name', { id: 'd0' }],
  ['mismatched identity', { ...documentRecord(), id: 'd1' }],
  ['non-array tags', { ...documentRecord(), tags: 'topic' }],
  ['excessive tag count', { ...documentRecord(), tags: Array.from({ length: 501 }, () => 'tag') }],
  ['sparse tags', { ...documentRecord(), tags: new Array(1) }],
  ['non-text tag', { ...documentRecord(), tags: [1] }],
  ['oversized name', { id: 'd0', name: 'x'.repeat(65_535) }],
  ['oversized combined text', { id: 'd0', name: 'x'.repeat(32_767), owner: 'y'.repeat(32_767), tags: ['z'] }],
] as const) {
  it(`rejects a provider document with ${name} and recovers from the visible retry`, async () => {
    await rejectedDocument(value);
  });
}

for (const field of ['id', 'name', 'mimeType', 'uri', 'version', 'tags', 'owner', 'updatedAt', 'freshness'] as const) {
  it(`rejects a provider document ${field} accessor without evaluating it`, async () => {
    let reads = 0;
    const value = Object.defineProperty(documentRecord(), field, { get() { reads++; throw new Error('Private provider detail'); } });
    await rejectedDocument(value);
    expect(reads).to.equal(0);
  });
}

it('rejects an accessor document tag without evaluating it', async () => {
  let reads = 0;
  const tags = Object.defineProperty(['topic'], '0', { get() { reads++; throw new Error('Private provider detail'); } });
  await rejectedDocument({ ...documentRecord(), tags });
  expect(reads).to.equal(0);
});

it('accepts exactly the document text budget and the complete per-record tag limit', async () => {
  const tags = Array.from({ length: 500 }, (_, index) => `tag${index}`);
  const name = 'x'.repeat(65_536 - 2 - tags.reduce((sum, tag) => sum + tag.length, 0));
  const provider: DocumentLibrarySource = { revision: 1,
    query: async () => ({ total: 1, rows: [{ key: 'd0', order: 0, value: { id: 'd0', name, tags } }], tags: facets }),
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${provider}></lr-document-library>`);
  const grid = viewer.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!;
  await waitUntil(() => grid.rows[0]?.id === 'd0');
  expect(grid.rows[0]?.name).to.equal(name);
  expect(grid.rows[0]?.tags).to.deep.equal(tags);
  expect(grid.error).to.equal(false);
});

for (const problem of ['missing facets', 'unrequested unavailable facet'] as const) {
  it(`rejects ${problem} and recovers when the visible retry returns valid facets`, async () => {
    let invalid = true;
    const source: DocumentLibrarySource = { revision: 1,
      query: async () => ({ total: 1, rows: [{ key: 'd0', order: 0, value: documentRecord() }],
        ...(invalid && problem === 'missing facets' ? {} : { tags: invalid
          ? { ...facets, unavailableSelected: ['unrequested'] } : facets }) }),
      lookup: async () => [], locate: async () => null };
    const viewer = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${source}></lr-document-library>`);
    const grid = viewer.shadowRoot!.querySelector<LyraTable<LibraryDocument>>('lr-table')!;
    await waitUntil(() => grid.error);
    await grid.updateComplete;
    expect(viewer.sourceTotal).to.equal(null);
    expect(grid.rows.length).to.equal(0);
    expect(grid.shadowRoot!.textContent).not.to.include('Invalid document source facets');
    invalid = false;
    grid.shadowRoot!.querySelector<HTMLElement>('[part="retry-button"]')!.click();
    await waitUntil(() => !grid.error && grid.rows[0]?.id === 'd0');
    expect(viewer.sourceTotal).to.equal(1);
    expect(viewer.tagFilter).to.deep.equal([]);
  });
}

it('shows omitted source tag counts and provider labels without refetching for localized summary text', async () => {
  let requests = 0;
  const source: DocumentLibrarySource = { revision: 1,
    query: async () => { requests++; return { total: 1, rows: [{ key: 'd0', order: 0, value: documentRecord() }],
      tags: { total: 1202, values: [{ key: 'topic', label: 'Research topic' }, { key: 'guide', label: 'Guides' }], unavailableSelected: [] } }; },
    lookup: async () => [], locate: async () => null };
  const viewer = await fixture<LyraDocumentLibrary>(html`<lr-document-library .dataSource=${source}></lr-document-library>`);
  await waitUntil(() => viewer.sourceTotal === 1);
  await viewer.updateComplete;
  const summary = () => viewer.shadowRoot!.querySelector('[part="limit"]')?.textContent;
  expect(summary()).to.equal('+1,200 more tags');
  expect([...viewer.shadowRoot!.querySelectorAll('lr-option')].map(option => option.textContent)).to.deep.equal(['Research topic', 'Guides']);
  viewer.strings = { tagFacetLimit: 'Additional categories: {count}' };
  await viewer.updateComplete;
  expect(summary()).to.equal('Additional categories: 1,200');
  expect(requests).to.equal(1);
  expect(viewer.documents.length).to.equal(0);
});
