import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './source-picker.js';
import type { LyraSourcePicker, LyraSourceEntry } from './source-picker.js';
import { styles } from './source-picker.styles.js';

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

it('honors a .strings override for the select-all label and the empty/no-matches states', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.sources = sources;
  el.strings = {
    selectAllSources: 'Tout sélectionner',
    noMatches: 'Aucun résultat',
    noData: 'Aucune donnée',
  };
  await el.updateComplete;

  const selectAll = el.shadowRoot!.querySelector('[part="select-all"] [role="checkbox"]')!;
  expect(selectAll.textContent).to.equal('Tout sélectionner');

  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'zzz-no-match' }, bubbles: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('Aucun résultat');

  el.sources = [];
  await el.updateComplete;
  const emptyHeading = el.shadowRoot!.querySelector('lr-empty')!.getAttribute('heading');
  expect(emptyHeading).to.equal('Aucune donnée');
});

it('gives the select-all checkbox a :hover treatment matching its keyboard :focus-visible cue', () => {
  // A dispatched pointer event never synthesizes a real `:hover` pseudo-class match in a test
  // runner (mirrors `<lr-switch>`/`<lr-stack-trace>`'s identical stance), so this reads the
  // exported stylesheet's own rules rather than simulating the paint -- `[part='select-all']
  // [role='checkbox']` is the only interactive control in this file that carried `cursor: pointer`
  // with neither rule before this fix.
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='select-all'\] \[role='checkbox'\]:hover\s*\{[^}]+\}/);
  expect(css).to.match(/\[part='select-all'\] \[role='checkbox'\]:focus-visible\s*\{[^}]+\}/);
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
  expect(el.shadowRoot!.querySelectorAll('[part="search"]').length).to.equal(0);
});

it('searchable="false" set as a plain HTML attribute (not a property binding) also omits the filter input', async () => {
  // Unlike the `.searchable = false` property-assignment test above, this proves the *attribute*
  // form actually clears the `true` default too -- the gap a stock `type: Boolean` converter
  // can't close, since removing an attribute that was never present fires no
  // `attributeChangedCallback`.
  const el = (await fixture(html`<lr-source-picker searchable="false"></lr-source-picker>`)) as LyraSourcePicker;
  expect(el.searchable).to.be.false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="search"]').length).to.equal(0);
});

it('showSelectAll=false omits the select-all header row', async () => {
  const el = (await fixture(html`<lr-source-picker></lr-source-picker>`)) as LyraSourcePicker;
  el.showSelectAll = false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="select-all"]').length).to.equal(0);
});

it('show-select-all="false" set as a plain HTML attribute (not a property binding) also omits the select-all row', async () => {
  const el = (await fixture(html`<lr-source-picker show-select-all="false"></lr-source-picker>`)) as LyraSourcePicker;
  expect(el.showSelectAll).to.be.false;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="select-all"]').length).to.equal(0);
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

describe('checked-state cssprop escape hatch', () => {
  function resolvedInShadow(el: LyraSourcePicker, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function picker(selectedIds: string[], style = ''): Promise<LyraSourcePicker> {
    const wrapper = (await fixture(html`<div style=${style}><lr-source-picker></lr-source-picker></div>`)) as HTMLElement;
    const el = wrapper.querySelector('lr-source-picker') as LyraSourcePicker;
    el.sources = sources;
    el.selectedIds = selectedIds;
    await el.updateComplete;
    return el;
  }
  const selectAllBox = (el: LyraSourcePicker) =>
    el.shadowRoot!.querySelector('[part="select-all"] [role="checkbox"]') as HTMLElement;
  const folderCheckbox = (el: LyraSourcePicker) =>
    el.shadowRoot!.querySelector('[role="treeitem"] [part="checkbox"]') as HTMLElement;

  it('--lr-source-picker-checked-bg recolors both the checked select-all pill and a fully-selected folder box', async () => {
    const el = await picker(['doc1', 'doc2', 'doc3'], '--lr-source-picker-checked-bg: rgb(0, 51, 102)');
    expect(selectAllBox(el).getAttribute('aria-checked')).to.equal('true');
    expect(getComputedStyle(selectAllBox(el)).backgroundColor).to.equal('rgb(0, 51, 102)');
    expect(folderCheckbox(el).getAttribute('data-state')).to.equal('true');
    expect(getComputedStyle(folderCheckbox(el)).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('--lr-source-picker-checked-border recolors the checked border', async () => {
    const el = await picker(['doc1', 'doc2', 'doc3'], '--lr-source-picker-checked-border: rgb(0, 51, 102)');
    expect(getComputedStyle(selectAllBox(el)).borderTopColor).to.equal('rgb(0, 51, 102)');
    expect(getComputedStyle(folderCheckbox(el)).borderTopColor).to.equal('rgb(0, 51, 102)');
  });

  it('--lr-source-picker-mixed-bg recolors a partially-selected folder box', async () => {
    const el = await picker(['doc1'], '--lr-source-picker-mixed-bg: rgb(0, 51, 102)');
    expect(folderCheckbox(el).getAttribute('data-state')).to.equal('mixed');
    expect(getComputedStyle(folderCheckbox(el)).backgroundColor).to.equal('rgb(0, 51, 102)');
  });

  it('renders byte-identical to the pre-hatch tokens when unset', async () => {
    const allSel = await picker(['doc1', 'doc2', 'doc3']);
    expect(getComputedStyle(selectAllBox(allSel)).backgroundColor).to.equal(
      resolvedInShadow(allSel, 'background: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(selectAllBox(allSel)).borderTopColor).to.equal(
      resolvedInShadow(allSel, 'border-top-color: var(--lr-color-brand)', 'border-top-color'),
    );
    expect(getComputedStyle(folderCheckbox(allSel)).backgroundColor).to.equal(
      resolvedInShadow(allSel, 'background: var(--lr-color-brand)', 'background-color'),
    );
    const mixed = await picker(['doc1']);
    expect(getComputedStyle(folderCheckbox(mixed)).backgroundColor).to.equal(
      resolvedInShadow(
        mixed,
        'background: color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface))',
        'background-color',
      ),
    );
  });

  // A LIGHT checked background on purpose: the select-all pill carries its own label text in
  // `--lr-color-text`, which this hatch deliberately does not restyle, so the contrast floor there
  // is the consumer's to keep -- the same tradeoff every bg-only cssprop in the library carries.
  it('is accessible with the checked-state props themed', async () => {
    const el = await picker(
      ['doc1', 'doc2', 'doc3'],
      '--lr-source-picker-checked-bg: rgb(255, 243, 205); --lr-source-picker-checked-border: rgb(120, 80, 0)',
    );
    await expect(el).to.be.accessible();
  });
});
