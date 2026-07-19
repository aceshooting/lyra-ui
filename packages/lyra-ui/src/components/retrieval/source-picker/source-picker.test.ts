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
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  expect(el.sources).to.deep.equal([]);
  expect(el.selectedIds).to.deep.equal([]);
  expect(el.showSelectAll).to.be.true;
  expect(el.searchable).to.be.true;
  expect(el.label).to.equal('');
});

it('renders a role="tree" with one treeitem per visible entry (top-level collapsed by default)', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2); // folder1 (collapsed) + doc3
  expect(el.shadowRoot!.querySelector('[part="tree"]')!.getAttribute('aria-multiselectable')).to.equal('true');
});

it('reflects tri-state aria-checked: false, true, and mixed', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
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

it('toggling a folder selects/deselects all of its descendant leaves and emits lr-sources-change', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector('[role="treeitem"]') as HTMLElement;
  const listener = oneEvent(el, 'lr-sources-change');
  folderRow.click();
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
  expect(el.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
});

it('toggling select-all selects/deselects every leaf', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = el.shadowRoot!.querySelector('[part="select-all"] [role="checkbox"]') as HTMLElement;
  const listener = oneEvent(el, 'lr-sources-change');
  selectAll.click();
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2', 'doc3']);
  expect(el.shadowRoot!.querySelector('[part="summary"]')!.textContent).to.include('3 of 3');
});

it('search filters by label, auto-expanding and keeping visible any matching descendant', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'curie' }, bubbles: true }));
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="label"]')].map((l) => l.textContent);
  expect(labels).to.include('curie-bio.pdf');
  expect(labels).to.include('Research papers'); // ancestor stays visible
  expect(labels).to.not.include('nobel-list.csv');
  expect(labels).to.not.include('notes.txt');
});

it('shows noMatches when the filter empties the tree, and noData when sources itself is empty', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'zzz-no-match' }, bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.include('No matches');

  el.sources = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('keyboard: Space toggles the focused row, ArrowDown moves focus, ArrowRight expands a folder', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
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

  const listener = oneEvent(el, 'lr-sources-change');
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
});

it('keyboard: Space and Enter on the select-all checkbox toggle every leaf', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = el.shadowRoot!.querySelector('[part="select-all"] [role="checkbox"]') as HTMLElement;

  const selectListener = oneEvent(el, 'lr-sources-change');
  const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  selectAll.dispatchEvent(space);
  const selected = await selectListener;
  expect(selected.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2', 'doc3']);
  expect(space.defaultPrevented).to.be.true; // Space must not scroll

  el.selectedIds = ['doc1', 'doc2', 'doc3'];
  await el.updateComplete;
  const deselectListener = oneEvent(el, 'lr-sources-change');
  selectAll.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const deselected = await deselectListener;
  expect(deselected.detail.selectedIds).to.deep.equal([]);
});

it('forwards a host aria-label to the role="tree" element, winning over label', async () => {
  const el = (await fixture(html`<lr-source-picker aria-label="Grounding sources" label="Sources"></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal('Grounding sources');
  const tree = el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(tree.getAttribute('aria-label')).to.equal('Grounding sources');

  el.accessibleLabel = null;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')).to.equal('Sources');
});

it('is not FormAssociated -- no internals/checkValidity surface', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  expect((el as unknown as { checkValidity?: unknown }).checkValidity).to.equal(undefined);
});

it('is accessible with a mixed-selection tree', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  el.selectedIds = ['doc1'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('toggling a fully-selected folder deselects all of its descendant leaves', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  el.selectedIds = ['doc1', 'doc2'];
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector('[role="treeitem"]') as HTMLElement;
  expect(folderRow.getAttribute('aria-checked')).to.equal('true');
  const listener = oneEvent(el, 'lr-sources-change');
  folderRow.click();
  const event = await listener;
  expect(event.detail.selectedIds).to.deep.equal([]);
  expect(el.selectedIds).to.deep.equal([]);
});

it('keyboard: ArrowDown/ArrowUp move the active row and DOM focus between top-level entries', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[1]!.getAttribute('tabindex')).to.equal('0');
  expect(items[0]!.getAttribute('tabindex')).to.equal('-1');
  expect(el.shadowRoot!.activeElement).to.equal(items[1]);

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);
});

it('keyboard: Home/End jump the active row to the first/last visible entry', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // expand folder1
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(4);

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[3]!.getAttribute('tabindex')).to.equal('0'); // doc3, the last visible row
  expect(el.shadowRoot!.activeElement).to.equal(items[3]);

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0'); // folder1, the first visible row
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);
});

it('keyboard: ArrowRight on an already-expanded, focused folder moves focus into its first child', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // expand
  await el.updateComplete;
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // move into child
  await el.updateComplete;

  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(4);
  expect(items[1]!.getAttribute('tabindex')).to.equal('0'); // doc1, folder1's first child
  expect(el.shadowRoot!.activeElement).to.equal(items[1]);
});

it('keyboard: ArrowLeft collapses an expanded, focused folder', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // expand
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(4);

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })); // collapse
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2);
  expect(items[0]!.getAttribute('aria-expanded')).to.equal('false');
});

it('keyboard: ArrowLeft on a focused leaf walks focus back to its ancestor folder', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); // expand folder1
  await el.updateComplete;
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })); // focus doc1
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[1]!.getAttribute('tabindex')).to.equal('0'); // sanity: doc1 is focused, has no children

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0'); // back to folder1
  expect(el.shadowRoot!.activeElement).to.equal(items[0]);
});

it('keyboard: Enter on the focused tree row toggles it, same as Space', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  const listener = oneEvent(el, 'lr-sources-change');
  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  const event = await listener;
  expect(event.detail.selectedIds.sort()).to.deep.equal(['doc1', 'doc2']);
});

it('keyboard: under dir="rtl", ArrowLeft expands and ArrowRight collapses (expand/collapse keys swap)', async () => {
  const el = (await fixture(html`<lr-source-picker dir="rtl"></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(4);

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(2);
});

it('keyboard: an unrecognized key is a no-op', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  let fired = false;
  el.addEventListener('lr-sources-change', () => {
    fired = true;
  });

  tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')[0]!.getAttribute('tabindex')).to.equal('0');
});

it('focusing a row directly (e.g. via Tab) moves the active/tabindex row to it', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0');

  (items[1] as HTMLElement).focus();
  await el.updateComplete;
  const updated = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(updated[1]!.getAttribute('tabindex')).to.equal('0');
  expect(updated[0]!.getAttribute('tabindex')).to.equal('-1');
});

it('searchable=false omits the built-in filter input', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.searchable = false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search"]')).to.not.exist;
});

it('showSelectAll=false omits the select-all header row', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.showSelectAll = false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="select-all"]')).to.not.exist;
});

it('keyboard: a non-activation key on the select-all checkbox is a no-op', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = el.shadowRoot!.querySelector('[part="select-all"] [role="checkbox"]') as HTMLElement;
  let fired = false;
  el.addEventListener('lr-sources-change', () => {
    fired = true;
  });
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  selectAll.dispatchEvent(tab);
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(tab.defaultPrevented).to.be.false;
});
