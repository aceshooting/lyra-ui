import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './source-picker.js';
import type { LyraSourcePicker, LyraSourceEntry } from './source-picker.js';

const sources: LyraSourceEntry[] = [
  {
    id: 'folder1',
    label: 'Research papers',
    children: [
      { id: 'doc1', label: 'curie-bio.pdf', mimeType: 'application/pdf' },
      { id: 'doc2', label: 'nobel-list.csv', mimeType: 'text/csv' },
    ],
  },
  { id: 'doc3', label: 'notes.txt', mimeType: 'text/plain' },
];

it('defaults to empty sources/selectedIds, showSelectAll=true, searchable=true, empty label', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  expect(el.sources).to.deep.equal([]);
  expect(el.selectedIds).to.deep.equal([]);
  expect(el.showSelectAll).to.be.true;
  expect(el.searchable).to.be.true;
  expect(el.label).to.equal('');
});

it('renders a role="tree" with one treeitem per visible entry (top-level collapsed by default)', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2); // folder1 (collapsed) + doc3
  expect(el.shadowRoot!.querySelector('[part="tree"]')!.getAttribute('aria-multiselectable')).to.equal('true');
});

it('reflects tri-state aria-checked: false, true, and mixed', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  el.selectedIds = ['doc1'];
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector('[role="treeitem"]')!;
  expect(folderRow.getAttribute('aria-checked')).to.equal('mixed');

  el.selectedIds = ['doc1', 'doc2'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="treeitem"]')!.getAttribute('aria-checked')).to.equal('true');

  el.selectedIds = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="treeitem"]')!.getAttribute('aria-checked')).to.equal('false');
});

it('toggling a folder selects/deselects all of its descendant leaves and emits lyra-sources-change', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector('[role="treeitem"]') as HTMLElement;
  const listener = oneEvent(el, 'lyra-sources-change');
  folderRow.click();
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
  expect(el.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
});

it('toggling select-all selects/deselects every leaf', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = el.shadowRoot!.querySelector('[part="select-all"] [role="checkbox"]') as HTMLElement;
  const listener = oneEvent(el, 'lyra-sources-change');
  selectAll.click();
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2', 'doc3']);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include('3 of 3');
});

it('search filters by label, auto-expanding and keeping visible any matching descendant', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(new CustomEvent('lyra-input', { detail: { value: 'curie' }, bubbles: true }));
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="label"]')].map((l) => l.textContent);
  expect(labels).to.include('curie-bio.pdf');
  expect(labels).to.include('Research papers'); // ancestor stays visible
  expect(labels).to.not.include('nobel-list.csv');
  expect(labels).to.not.include('notes.txt');
});

it('shows noMatches when the filter empties the tree, and noData when sources itself is empty', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(new CustomEvent('lyra-input', { detail: { value: 'zzz-no-match' }, bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No matches');

  el.sources = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lyra-empty')).to.exist;
});

it('keyboard: Space toggles the focused row, ArrowDown moves focus, ArrowRight expands a folder', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  await el.updateComplete;
  // folder1 expanded: folder1 + its 2 children (doc1, doc2) + doc3 = 4. (The plan brief's literal
  // test asserted 3 here, which is inconsistent with the same `sources` fixture's folder1 having
  // 2 children -- as verified by every other test in this file, e.g. the tri-state and
  // folder-toggle-selects-both-descendants tests. Corrected to 4 to match the fixture and the
  // brief's own reference implementation, which does produce 4.)
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(4);

  const listener = oneEvent(el, 'lyra-sources-change');
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
});

it('is not FormAssociated -- no internals/checkValidity surface', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  expect((el as unknown as { checkValidity?: unknown }).checkValidity).to.equal(undefined);
});

it('is accessible with a mixed-selection tree', async () => {
  const el = (await fixture(html`<lyra-source-picker></lyra-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  el.selectedIds = ['doc1'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
