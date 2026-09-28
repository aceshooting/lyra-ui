import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './source-picker.js';
import type { LyraSourcePicker, LyraSourceEntry } from './source-picker.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

type CheckboxElement = HTMLElement & {
  checked: boolean;
  indeterminate: boolean;
  updateComplete: Promise<unknown>;
};

const selectAllCheckbox = (el: LyraSourcePicker): CheckboxElement =>
  el.shadowRoot!.querySelector<CheckboxElement>(
    'lr-checkbox[part="select-all-control"]'
  )!;

const checkboxControl = (checkbox: CheckboxElement): HTMLElement =>
  checkbox.shadowRoot!.querySelector<HTMLElement>('[role="checkbox"]')!;

const checkboxBox = (checkbox: CheckboxElement): HTMLElement =>
  checkbox.shadowRoot!.querySelector<HTMLElement>('[part~="box"]')!;

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

it('defaults to empty sources/selectedSourceIds, withoutSelectAll=false, withoutSearch=false, omitted label', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(el.sources).to.deep.equal([]);
  expect(el.selectedSourceIds).to.deep.equal([]);
  expect(el.withoutSelectAll).to.be.false;
  expect(el.withoutSearch).to.be.false;
  expect(el.label).to.equal(undefined);
});

it('fails closed for non-array collections and omits entries with blank or non-string labels', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  (el as unknown as { sources: unknown }).sources = [
    { id: 'missing-label' },
    { id: 'blank-label', label: '   ' },
    { id: 'valid', label: 'Valid source' },
  ];
  (el as unknown as { selectedSourceIds: unknown }).selectedSourceIds = null;
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.getAttribute('aria-label')).to.not.equal('');

  (el as unknown as { sources: unknown }).sources = null;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('distinguishes a nonempty wholly malformed source payload from a genuinely empty list', async () => {
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker
      .sources=${[
        { id: 'missing-label' },
        { id: 'blank-label', label: '   ' },
      ] as unknown as LyraSourceEntry[]}
      .strings=${{ valueInvalid: 'Invalid source data' }}
    ></lr-source-picker>
  `);

  const error = el.shadowRoot!.querySelector('[part="error"]');
  expect(error?.getAttribute('role')).to.equal(null);
  expect(error?.textContent?.trim()).to.equal('Invalid source data');
  expect(el.shadowRoot!.querySelector('lr-empty') === null).to.equal(true);
});

it('renders a role="tree" with one treeitem per visible entry (top-level collapsed by default)', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2); // folder1 (collapsed) + doc3
  expect(
    el
      .shadowRoot!.querySelector('[part="tree"]')!
      .getAttribute('aria-multiselectable')
  ).to.equal('true');
});

it('does not derive a file badge token from group labels', async () => {
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker .sources=${[
      { id: 'folder', label: 'docs.python.org', children: [{ id: 'leaf', label: 'report.pdf' }] },
    ] as LyraSourceEntry[]}></lr-source-picker>
  `);
  const icons = [...el.shadowRoot!.querySelectorAll('lr-file-icon')] as HTMLElement[];
  expect(icons).to.have.length(1);
  const groupIcon = icons[0]!;
  expect(groupIcon.shadowRoot!.querySelector('.token') === null).to.be.true;

  (el.shadowRoot!.querySelector('[part="disclosure"]') as HTMLElement).click();
  await el.updateComplete;
  await el.updateComplete;
  const leafIcon = [...el.shadowRoot!.querySelectorAll('lr-file-icon')]
    .find((icon) => icon !== groupIcon) as HTMLElement;
  expect(leafIcon).to.exist;
  expect(leafIcon.shadowRoot!.querySelector('.token')?.textContent).to.equal('PDF');
});

it('uses aria-checked as the sole false, true, and mixed treeitem selection state', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.selectedSourceIds = ['doc1'];
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector('[role="treeitem"]')!;
  expect(folderRow.getAttribute('aria-checked')).to.equal('mixed');
  expect(folderRow.getAttribute('aria-selected')).to.equal(null);

  el.selectedSourceIds = ['doc1', 'doc2'];
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute('aria-checked')
  ).to.equal('true');
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute('aria-selected')
  ).to.equal(null);

  el.selectedSourceIds = [];
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute('aria-checked')
  ).to.equal('false');
  expect(
    el
      .shadowRoot!.querySelector('[role="treeitem"]')!
      .getAttribute('aria-selected')
  ).to.equal(null);
});

it('toggling a folder selects/deselects all of its descendant leaves and emits lr-sources-change', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector(
    '[role="treeitem"]'
  ) as HTMLElement;
  const listener = oneEvent(el, 'lr-sources-change');
  folderRow.click();
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal([
    'doc1',
    'doc2',
  ]);
  expect([...el.selectedSourceIds].sort()).to.deep.equal(['doc1', 'doc2']);
});

it('toggling select-all selects/deselects every leaf', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = selectAllCheckbox(el);
  const listener = oneEvent(el, 'lr-sources-change');
  selectAll.click();
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal([
    'doc1',
    'doc2',
    'doc3',
  ]);
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include('3 of 3');
});

it('normalizes selected source ids once per render and once per select-all operation', async () => {
  const entries: LyraSourceEntry[] = Array.from(
    { length: 4 },
    (_unused, index) => ({
      id: `source-${index}`,
      label: `Source ${index}`,
    })
  );
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker
      .sources=${entries}
      .selectedSourceIds=${entries.map((entry) => entry.id)}
    ></lr-source-picker>
  `);
  const boundary = el as unknown as {
    normalizedSelectedSourceIds(): string[];
  };
  const original = boundary.normalizedSelectedSourceIds.bind(el);
  let calls = 0;
  Object.defineProperty(el, 'normalizedSelectedSourceIds', {
    configurable: true,
    value: () => {
      calls += 1;
      return original();
    },
  });

  el.requestUpdate();
  await el.updateComplete;
  expect(calls).to.equal(1);

  calls = 0;
  selectAllCheckbox(el).click();
  expect(calls).to.equal(1);
  await el.updateComplete;
});

it('search filters by label, auto-expanding and keeping visible any matching descendant', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(
    new CustomEvent('lr-input', { detail: { value: 'curie' }, bubbles: true })
  );
  await el.updateComplete;
  const labels = [...el.shadowRoot!.querySelectorAll('[part="label"]')].map(
    (l) => l.textContent
  );
  expect(labels).to.include('curie-bio.pdf');
  expect(labels).to.include('Research papers'); // ancestor stays visible
  expect(labels).to.not.include('nobel-list.csv');
  expect(labels).to.not.include('notes.txt');
});

it('shows noMatches when the filter empties the tree, and noData when sources itself is empty', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'zzz-no-match' },
      bubbles: true,
    })
  );
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.textContent
  ).to.include('No matches');

  el.sources = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-empty')).to.exist;
});

it('keyboard: Space toggles the focused row, ArrowDown moves focus, ArrowRight expands a folder', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  // folder1 expanded: folder1 + its 2 children (doc1, doc2) + doc3 = 4. This matches the `sources`
  // fixture and the tri-state/folder-toggle tests, which also treat both children as visible.
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  const listener = oneEvent(el, 'lr-sources-change');
  tree.dispatchEvent(
    new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
  );
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal([
    'doc1',
    'doc2',
  ]);
});

it('keyboard: the shared select-all checkbox toggles with Space and leaves Enter to the form', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = selectAllCheckbox(el);
  await selectAll.updateComplete;
  const control = checkboxControl(selectAll);

  const selectListener = oneEvent(el, 'lr-sources-change');
  const space = new KeyboardEvent('keydown', {
    key: ' ',
    bubbles: true,
    cancelable: true,
  });
  control.dispatchEvent(space);
  const selected = await selectListener;
  expect([...selected.detail.selectedSourceIds].sort()).to.deep.equal([
    'doc1',
    'doc2',
    'doc3',
  ]);
  expect(space.defaultPrevented).to.be.true; // Space must not scroll

  el.selectedSourceIds = ['doc1', 'doc2', 'doc3'];
  await el.updateComplete;
  let enterChanges = 0;
  el.addEventListener('lr-sources-change', () => enterChanges++);
  control.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(enterChanges).to.equal(0);

  const deselectListener = oneEvent(el, 'lr-sources-change');
  control.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    })
  );
  const deselected = await deselectListener;
  expect(deselected.detail.selectedSourceIds).to.deep.equal([]);
});

it('keeps explicit-empty and dynamic host naming distinct from the source tree', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      aria-label="Grounding sources"
      label="Sources"
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  expect(el.accessibleLabel).to.equal('Grounding sources');
  expect(el.getAttribute('aria-label')).to.equal('Grounding sources');
  const tree = el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(tree.getAttribute('aria-label')).to.equal('Sources');

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('');
  expect(tree.getAttribute('aria-label')).to.equal('Sources');

  el.setAttribute('aria-label', 'Revised sources');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Revised sources');
  expect(tree.getAttribute('aria-label')).to.equal('Sources');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(null);
  expect(
    el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')
  ).to.equal('Sources');
});

it('forwards a JS-only accessibleLabel override onto the internal tree', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.accessibleLabel = 'Grounding sources tree';
  await el.updateComplete;
  expect(el.hasAttribute('aria-label')).to.equal(false);
  expect(
    el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')
  ).to.equal('Grounding sources tree');

  el.setAttribute('aria-label', 'Host name wins');
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[role="tree"]')!.getAttribute('aria-label')
  ).to.not.equal('Grounding sources tree');
});

it('honors an explicitly empty label as genuinely empty, distinct from omitting it', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = () => el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(el.label).to.equal(undefined);
  expect(tree().getAttribute('aria-label')).to.equal('Sources');

  el.label = '';
  await el.updateComplete;
  expect(tree().getAttribute('aria-label')).to.equal('');

  el.label = undefined;
  await el.updateComplete;
  expect(tree().getAttribute('aria-label')).to.equal('Sources');
});

it('honors an explicitly empty label as genuinely empty when the host already has an aria-label', async () => {
  const el = (await fixture(
    html`<lr-source-picker aria-label="Grounding sources"></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = () => el.shadowRoot!.querySelector('[role="tree"]')!;
  expect(el.label).to.equal(undefined);
  expect(tree().getAttribute('aria-label')).to.equal('Sources');

  el.label = '';
  await el.updateComplete;
  expect(tree().getAttribute('aria-label')).to.equal('');

  el.label = undefined;
  await el.updateComplete;
  expect(tree().getAttribute('aria-label')).to.equal('Sources');
});

it('honors a .strings override for the select-all label and the empty/no-matches states', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.strings = {
    selectAllSources: 'Tout sélectionner',
    noMatches: 'Aucun résultat',
    noData: 'Aucune donnée',
  };
  await el.updateComplete;

  const selectAll = selectAllCheckbox(el);
  expect(selectAll.textContent).to.equal('Tout sélectionner');

  const input = el.shadowRoot!.querySelector('[part="search"]')!;
  input.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'zzz-no-match' },
      bubbles: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal(
    'Aucun résultat'
  );

  el.sources = [];
  await el.updateComplete;
  const emptyHeading = el
    .shadowRoot!.querySelector('lr-empty')!
    .getAttribute('heading');
  expect(emptyHeading).to.equal('Aucune donnée');
});

it('delegates select-all interaction semantics to lr-checkbox and maps the component state tokens', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      style="--lr-source-picker-mixed-bg: rgb(1, 2, 3); --lr-source-picker-checked-border: rgb(4, 5, 6)"
      .sources=${sources}
      .selectedSourceIds=${['doc1']}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const checkbox = selectAllCheckbox(el);
  await checkbox.updateComplete;
  expect(checkbox.indeterminate).to.equal(true);
  expect(checkboxControl(checkbox).getAttribute('role')).to.equal('checkbox');
  expect(checkboxControl(checkbox).getAttribute('aria-checked')).to.equal(
    'mixed'
  );
  expect(getComputedStyle(checkboxBox(checkbox)).backgroundColor).to.equal(
    'rgb(1, 2, 3)'
  );
  expect(getComputedStyle(checkboxBox(checkbox)).borderColor).to.equal(
    'rgb(4, 5, 6)'
  );
});

it('is not FormAssociated -- no internals/checkValidity surface', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  expect((el as unknown as { checkValidity?: unknown }).checkValidity).to.equal(
    undefined
  );
});

it('is accessible with a mixed-selection tree', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.selectedSourceIds = ['doc1'];
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('toggling a fully-selected folder deselects all of its descendant leaves', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  el.selectedSourceIds = ['doc1', 'doc2'];
  await el.updateComplete;
  const folderRow = el.shadowRoot!.querySelector(
    '[role="treeitem"]'
  ) as HTMLElement;
  expect(folderRow.getAttribute('aria-checked')).to.equal('true');
  const listener = oneEvent(el, 'lr-sources-change');
  folderRow.click();
  const event = await listener;
  expect(event.detail.selectedSourceIds).to.deep.equal([]);
  expect(el.selectedSourceIds).to.deep.equal([]);
});

it('keyboard: ArrowDown/ArrowUp move the active row and DOM focus between top-level entries', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[1]!.getAttribute('tabindex')).to.equal('0');
  expect(items[0]!.getAttribute('tabindex')).to.equal('-1');
  expect(el.shadowRoot!.activeElement === items[1]).to.equal(true);

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0');
  expect(el.shadowRoot!.activeElement === items[0]).to.equal(true);
});

it('keeps an in-flight keyboard focus target by id when sources reorder before the update', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' },
      ]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  );
  el.sources = [
    { id: 'c', label: 'Gamma' },
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ];
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.textContent).to.include('Beta');
  expect(
    el.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]')
  ).to.have.length(1);
  expect(
    el.shadowRoot!.querySelector('[role="treeitem"][tabindex="0"]')?.textContent
  ).to.include('Beta');
});

it('keyboard: Home/End jump the active row to the first/last visible entry', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  ); // expand folder1
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'End',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[3]!.getAttribute('tabindex')).to.equal('0'); // doc3, the last visible row
  expect(el.shadowRoot!.activeElement === items[3]).to.equal(true);

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Home',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0'); // folder1, the first visible row
  expect(el.shadowRoot!.activeElement === items[0]).to.equal(true);
});

it('keyboard: ArrowRight on an already-expanded, focused folder moves focus into its first child', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  ); // expand
  await el.updateComplete;
  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  ); // move into child
  await el.updateComplete;

  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(4);
  expect(items[1]!.getAttribute('tabindex')).to.equal('0'); // doc1, folder1's first child
  expect(el.shadowRoot!.activeElement === items[1]).to.equal(true);
});

it('keyboard: ArrowLeft collapses an expanded, focused folder', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  ); // expand
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
  ); // collapse
  await el.updateComplete;
  const items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items.length).to.equal(2);
  expect(items[0]!.getAttribute('aria-expanded')).to.equal('false');
});

it('keyboard: ArrowLeft on a focused leaf walks focus back to its ancestor folder', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  ); // expand folder1
  await el.updateComplete;
  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    })
  ); // focus doc1
  await el.updateComplete;
  let items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[1]!.getAttribute('tabindex')).to.equal('0'); // sanity: doc1 is focused, has no children

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  items = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(items[0]!.getAttribute('tabindex')).to.equal('0'); // back to folder1
  expect(el.shadowRoot!.activeElement === items[0]).to.equal(true);
});

it('keyboard: Enter on the focused tree row toggles it, same as Space', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  const listener = oneEvent(el, 'lr-sources-change');
  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
  );
  const event = await listener;
  expect([...event.detail.selectedSourceIds].sort()).to.deep.equal([
    'doc1',
    'doc2',
  ]);
});

it('keyboard: under dir="rtl", ArrowLeft expands and ArrowRight collapses (expand/collapse keys swap)', async () => {
  const el = (await fixture(
    html`<lr-source-picker dir="rtl"></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );

  tree.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    2
  );
});

it('keyboard: an unrecognized key is a no-op', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const tree = el.shadowRoot!.querySelector('[part="tree"]')!;
  let fired = false;
  el.addEventListener('lr-sources-change', () => {
    fired = true;
  });

  tree.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true })
  );
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(
    el
      .shadowRoot!.querySelectorAll('[role="treeitem"]')[0]!
      .getAttribute('tabindex')
  ).to.equal('0');
});

it('focusing a row directly (e.g. via Tab) moves the active/tabindex row to it', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
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

it('moves real DOM focus to the closest survivor when the focused source is removed', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' },
      ]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const rows =
    el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]');
  rows[1]!.focus();
  expect(el.shadowRoot!.activeElement?.textContent).to.include('Beta');

  el.sources = [
    { id: 'a', label: 'Alpha' },
    { id: 'c', label: 'Gamma' },
  ];
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.getAttribute('role')).to.equal(
    'treeitem'
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include('Gamma');
  expect(
    el.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]')
  ).to.have.length(1);
});

it('moves real DOM focus to a stable base when the focused source is removed with the whole tree', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[{ id: 'only', label: 'Only source' }]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  el.shadowRoot!.querySelector<HTMLElement>('[role="treeitem"]')!.focus();

  el.sources = [];
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  expect(
    (el.shadowRoot!.activeElement as HTMLElement | null)?.tabIndex
  ).to.equal(-1);
});

it('moves real DOM focus to the visible survivor when filtering removes the focused source', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' },
      ]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const rows =
    el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]');
  rows[1]!.focus();
  el.shadowRoot!.querySelector('lr-input')!.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'gamma' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  expect(el.shadowRoot!.activeElement?.getAttribute('role')).to.equal(
    'treeitem'
  );
  expect(el.shadowRoot!.activeElement?.textContent).to.include('Gamma');
  expect(
    el.shadowRoot!.querySelectorAll('[role="treeitem"][tabindex="0"]')
  ).to.have.length(1);
});

it('withoutSearch omits the built-in filter input', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.withoutSearch = true;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="search"]').length).to.equal(0);
});

it('without-search set as a plain HTML attribute (not a property binding) also omits the filter input', async () => {
  const el = (await fixture(
    html`<lr-source-picker without-search></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(el.withoutSearch).to.be.true;
  el.sources = sources;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="search"]').length).to.equal(0);
});

it('withoutSelectAll omits the select-all header row', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.withoutSelectAll = true;
  el.sources = sources;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="select-all"]').length
  ).to.equal(0);
});

it('without-select-all set as a plain HTML attribute (not a property binding) also omits the select-all row', async () => {
  const el = (await fixture(
    html`<lr-source-picker without-select-all></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(el.withoutSelectAll).to.be.true;
  el.sources = sources;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="select-all"]').length
  ).to.equal(0);
});

it('keyboard: a non-activation key on the select-all checkbox is a no-op', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = sources;
  await el.updateComplete;
  const selectAll = selectAllCheckbox(el);
  await selectAll.updateComplete;
  let fired = false;
  el.addEventListener('lr-sources-change', () => {
    fired = true;
  });
  const tab = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  checkboxControl(selectAll).dispatchEvent(tab);
  await el.updateComplete;
  expect(fired).to.be.false;
  expect(tab.defaultPrevented).to.be.false;
});

describe('checked-state cssprop escape hatch', () => {
  function resolvedInShadow(
    el: LyraSourcePicker,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function picker(
    selectedSourceIds: string[],
    style = ''
  ): Promise<LyraSourcePicker> {
    const wrapper = (await fixture(
      html`<div style=${style}><lr-source-picker></lr-source-picker></div>`
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-source-picker') as LyraSourcePicker;
    el.sources = sources;
    el.selectedSourceIds = selectedSourceIds;
    await el.updateComplete;
    await selectAllCheckbox(el).updateComplete;
    return el;
  }
  const selectAllControl = (el: LyraSourcePicker) =>
    checkboxControl(selectAllCheckbox(el));
  const selectAllBox = (el: LyraSourcePicker) =>
    checkboxBox(selectAllCheckbox(el));
  const folderCheckbox = (el: LyraSourcePicker) =>
    el.shadowRoot!.querySelector(
      '[role="treeitem"] [part="checkbox"]'
    ) as HTMLElement;

  it('--lr-source-picker-checked-bg recolors both the checked select-all pill and a fully-selected folder box', async () => {
    const el = await picker(
      ['doc1', 'doc2', 'doc3'],
      '--lr-source-picker-checked-bg: rgb(0, 51, 102)'
    );
    expect(selectAllControl(el).getAttribute('aria-checked')).to.equal('true');
    expect(getComputedStyle(selectAllBox(el)).backgroundColor).to.equal(
      'rgb(0, 51, 102)'
    );
    expect(folderCheckbox(el).getAttribute('data-state')).to.equal('true');
    expect(getComputedStyle(folderCheckbox(el)).backgroundColor).to.equal(
      'rgb(0, 51, 102)'
    );
  });

  it('--lr-source-picker-checked-border recolors the checked border', async () => {
    const el = await picker(
      ['doc1', 'doc2', 'doc3'],
      '--lr-source-picker-checked-border: rgb(0, 51, 102)'
    );
    expect(getComputedStyle(selectAllBox(el)).borderTopColor).to.equal(
      'rgb(0, 51, 102)'
    );
    expect(getComputedStyle(folderCheckbox(el)).borderTopColor).to.equal(
      'rgb(0, 51, 102)'
    );
  });

  it('--lr-source-picker-mixed-bg recolors a partially-selected folder box', async () => {
    const el = await picker(
      ['doc1'],
      '--lr-source-picker-mixed-bg: rgb(0, 51, 102)'
    );
    expect(folderCheckbox(el).getAttribute('data-state')).to.equal('mixed');
    expect(getComputedStyle(folderCheckbox(el)).backgroundColor).to.equal(
      'rgb(0, 51, 102)'
    );
  });

  it('renders byte-identical to the pre-hatch tokens when unset', async () => {
    const allSel = await picker(['doc1', 'doc2', 'doc3']);
    expect(getComputedStyle(selectAllBox(allSel)).backgroundColor).to.equal(
      resolvedInShadow(
        allSel,
        'background: var(--lr-color-brand-quiet)',
        'background-color'
      )
    );
    expect(getComputedStyle(selectAllBox(allSel)).borderTopColor).to.equal(
      resolvedInShadow(
        allSel,
        'border-top-color: var(--lr-color-brand)',
        'border-top-color'
      )
    );
    expect(getComputedStyle(folderCheckbox(allSel)).backgroundColor).to.equal(
      resolvedInShadow(
        allSel,
        'background: var(--lr-color-brand)',
        'background-color'
      )
    );
    const mixed = await picker(['doc1']);
    expect(getComputedStyle(folderCheckbox(mixed)).backgroundColor).to.equal(
      resolvedInShadow(
        mixed,
        'background: color-mix(in srgb, var(--lr-color-brand) 50%, var(--lr-color-surface))',
        'background-color'
      )
    );
  });

  // A LIGHT checked background on purpose: the select-all pill carries its own label text in
  // `--lr-color-text`, which this hatch deliberately does not restyle, so the contrast floor there
  // is the consumer's to keep -- the same tradeoff every bg-only cssprop in the library carries.
  it('is accessible with the checked-state props themed', async () => {
    const el = await picker(
      ['doc1', 'doc2', 'doc3'],
      '--lr-source-picker-checked-bg: rgb(255, 243, 205); --lr-source-picker-checked-border: rgb(120, 80, 0)'
    );
    await expect(el).to.be.accessible();
  });
});

it('exposes tree levels and a separate pointer disclosure affordance for folders', async () => {
  const el = (await fixture(
    html`<lr-source-picker .sources=${sources}></lr-source-picker>`
  )) as LyraSourcePicker;
  const folder = el.shadowRoot!.querySelector('[role="treeitem"]')!;
  expect(folder.getAttribute('aria-level')).to.equal('1');
  const disclosure = folder.querySelector('[part="disclosure"]') as HTMLElement;
  expect(disclosure.tagName).to.equal('SPAN');
  expect(disclosure.getAttribute('role')).to.equal(null);
  expect(disclosure.getAttribute('aria-hidden')).to.equal('true');
  expect(getComputedStyle(disclosure).minInlineSize).to.equal('40px');
  expect(getComputedStyle(disclosure).minBlockSize).to.equal('40px');
  disclosure.click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    4
  );
  expect(
    el
      .shadowRoot!.querySelectorAll('[role="treeitem"]')[1]!
      .getAttribute('aria-level')
  ).to.equal('2');
});

it('case-folds source search with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      lang="tr"
      .sources=${[{ id: 'i', label: 'İzmir' }]}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  const input = el.shadowRoot!.querySelector('lr-input') as HTMLElement & {
    value: string;
  };
  input.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'iz' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    1
  );
});

it('suppresses the raw child input event after consuming it', async () => {
  const el = (await fixture(
    html`<lr-source-picker .sources=${sources}></lr-source-picker>`
  )) as LyraSourcePicker;
  let leaked = 0;
  el.addEventListener('lr-input', () => leaked++);
  el.shadowRoot!.querySelector('lr-input')!.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'paper' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(leaked).to.equal(0);
});

it('formats the selection summary counts with the effective locale', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      lang="ar-u-nu-arab"
      .sources=${sources}
    ></lr-source-picker>`
  )) as LyraSourcePicker;
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.contain('٠');
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.contain('٣');
});

it('renders and selects only the first source occurrence for duplicate ids', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = [
    { id: 'duplicate', label: 'First occurrence' },
    { id: 'duplicate', label: 'Second occurrence' },
  ];
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[role="treeitem"]');
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent).to.include('First occurrence');
  const pending = oneEvent(el, 'lr-sources-change');
  (rows[0] as HTMLElement).click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['duplicate']);
});

it('rejects empty and whitespace-only source ids before rendering or selection', async () => {
  const el = (await fixture(
    html`<lr-source-picker></lr-source-picker>`
  )) as LyraSourcePicker;
  el.sources = [
    { id: '', label: 'Empty source id' },
    { id: '   ', label: 'Blank source id' },
    { id: 'valid', label: 'Valid source' },
  ];
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelectorAll('[part~="item"]');
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent).to.include('Valid source');

  const pending = oneEvent(el, 'lr-sources-change');
  (rows[0] as HTMLElement).click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['valid']);
});

it('normalizes cyclic and repeated-identity source trees without recursion or duplicate controls', async () => {
  const leaf: LyraSourceEntry = { id: 'leaf', label: 'Leaf' };
  const root: LyraSourceEntry = { id: 'root', label: 'Root', children: [] };
  root.children = [root, leaf, leaf];
  const el = (await fixture(
    html`<lr-source-picker .sources=${[root]}></lr-source-picker>`
  )) as LyraSourcePicker;

  el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'Leaf' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]'),
  ];
  expect(
    rows.map((row) => row.querySelector('[part="label"]')?.textContent)
  ).to.deep.equal(['Root', 'Leaf']);
  const pending = oneEvent(el, 'lr-sources-change');
  rows[1]!.click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['leaf']);
});

it('caps adversarial depth and breadth and exposes a localized visible limit state', async () => {
  let deep: LyraSourceEntry = { id: 'deep-leaf', label: 'Deep leaf' };
  for (let depth = 80; depth >= 0; depth--) {
    deep = { id: `depth-${depth}`, label: `Depth ${depth}`, children: [deep] };
  }
  const wideValues = Array.from({ length: 2_100 }, (_, index) => ({
    id: `wide-${index}`,
    label: `Wide ${index}`,
  }));
  let sourceValueReads = 0;
  const wide = new Proxy(wideValues, {
    get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property))
        sourceValueReads++;
      return Reflect.get(target, property, receiver);
    },
  });
  const el = (await fixture(
    html`<lr-source-picker
      .strings=${{ valueInvalid: 'Source tree limited' }}
    ></lr-source-picker>`
  )) as LyraSourcePicker;

  el.sources = [deep];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal(
    'Source tree limited'
  );

  el.sources = wide;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]').length).to.equal(
    2_000
  );
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include('2,000');
  expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.equal(
    'Source tree limited'
  );
  expect(sourceValueReads).to.equal(0);
});

it('announces post-mount no-match transitions only through the light-DOM sink', async () => {
  const el = (await fixture(
    html`<lr-source-picker .sources=${sources}></lr-source-picker>`
  )) as LyraSourcePicker;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`
  )!;
  const before = sink.children.length;
  const search = el.shadowRoot!.querySelector('[part="search"]')!;

  search.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'no-such-source' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  await waitUntil(() => sink.children.length > before);
  expect(sink.lastElementChild?.textContent).to.equal('No matches');
  expect(
    el.shadowRoot!.querySelector('[part="empty"]')!.getAttribute('role')
  ).to.equal(null);

  search.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: '' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(sink.children.length).to.equal(before + 1);
  expect(
    el.shadowRoot!.querySelectorAll('[role="status"], [role="alert"]').length
  ).to.equal(0);
});

it('canonicalizes and prunes controlled source ids across replacement and emitted toggles', async () => {
  const el = (await fixture(
    html`<lr-source-picker
      .sources=${[
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
      ]}
      .selectedSourceIds=${['a', 'a', 'ghost']}
    ></lr-source-picker>`
  )) as LyraSourcePicker;

  expect(el.selectedSourceIds).to.deep.equal(['a']);
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include('1 of 2');

  const pending = oneEvent(el, 'lr-sources-change');
  el.shadowRoot!.querySelectorAll<HTMLElement>('[role="treeitem"]')[1]!.click();
  expect((await pending).detail.selectedSourceIds).to.deep.equal(['a', 'b']);

  const prunedPending = oneEvent(el, 'lr-sources-change');
  el.sources = [{ id: 'b', label: 'Beta' }];
  expect((await prunedPending).detail.selectedSourceIds).to.deep.equal(['b']);
  expect(el.selectedSourceIds).to.deep.equal(['b']);
  expect(
    el.shadowRoot!.querySelector('[part="summary"]')!.textContent
  ).to.include('1 of 1');
});

describe('depth indent', () => {
  const deep: LyraSourceEntry[] = [
    {
      id: 'l0',
      label: 'Level 0',
      children: [
        {
          id: 'l1',
          label: 'Level 1',
          children: [{ id: 'l2', label: 'Level 2', mimeType: 'text/plain' }],
        },
      ],
    },
  ];

  async function expandedDeepPicker(): Promise<LyraSourcePicker> {
    const el = (await fixture(
      html`<lr-source-picker></lr-source-picker>`
    )) as LyraSourcePicker;
    el.sources = deep;
    await el.updateComplete;
    // Filtering auto-expands every folder, which is the cheapest way to render all three levels
    // without driving two disclosure clicks.
    el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(
      new CustomEvent('lr-input', {
        detail: { value: 'Level' },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    return el;
  }

  function rows(el: LyraSourcePicker): HTMLElement[] {
    return Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('[part="item"]')
    );
  }

  it('drives the per-level indent from a retheme-able token instead of a hardcoded literal', async () => {
    const el = await expandedDeepPicker();
    expect(rows(el).length).to.equal(3);
    const before = rows(el).map((row) =>
      Number.parseFloat(getComputedStyle(row).paddingInlineStart)
    );
    expect(
      before[1]! - before[0]!,
      'one indent step per level'
    ).to.be.greaterThan(0);
    expect(before[2]! - before[1]!, 'and the step is uniform').to.be.closeTo(
      before[1]! - before[0]!,
      0.5
    );

    el.style.setProperty('--lr-source-picker-indent-size', '3rem');
    await el.updateComplete;
    const after = rows(el).map((row) =>
      Number.parseFloat(getComputedStyle(row).paddingInlineStart)
    );
    expect(
      after[1]! - after[0]!,
      'the override reaches the rendered indent'
    ).to.be.closeTo(48, 0.5);
    expect(after[2]! - after[1]!).to.be.closeTo(48, 0.5);
  });

  it('caps runaway nesting so a deep tree cannot push its labels out of view', async () => {
    const el = await expandedDeepPicker();
    // 8rem = 128px is the shared cap; a 20rem step would otherwise indent level 1 by 320px.
    el.style.setProperty('--lr-source-picker-indent-size', '20rem');
    await el.updateComplete;
    const padding = rows(el).map((row) =>
      Number.parseFloat(getComputedStyle(row).paddingInlineStart)
    );
    const base = padding[0]!;
    for (const value of padding) {
      expect(value - base, 'no row indents past the cap').to.be.at.most(128.5);
    }
    expect(
      padding[1]! - base,
      'and the cap is what actually bit'
    ).to.be.closeTo(128, 0.5);
  });
});

it('returns focus to the search control when filtering removes every focused row', async () => {
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker .sources=${sources}></lr-source-picker>
  `);
  el.shadowRoot!.querySelector<HTMLElement>('[role="treeitem"]')!.focus();
  el.shadowRoot!.querySelector('lr-input')!.dispatchEvent(
    new CustomEvent('lr-input', {
      detail: { value: 'no matching source' },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(
    0
  );
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.include(
    'search'
  );
});

it('collapses an expanded folder from its pointer disclosure without toggling selection', async () => {
  const el = await fixture<LyraSourcePicker>(html`
    <lr-source-picker .sources=${sources}></lr-source-picker>
  `);
  const disclosure = () =>
    el.shadowRoot!.querySelector<HTMLElement>(
      '[role="treeitem"] [part="disclosure"]'
    )!;
  disclosure().click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(
    4
  );

  disclosure().click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[role="treeitem"]')).to.have.length(
    2
  );
  expect(el.selectedSourceIds).to.deep.equal([]);
});

describe('select-all checkbox containment', () => {
  const CHECKBOX_EVENTS = ['lr-checkbox-toggle-request', 'input', 'change', 'lr-input', 'lr-change'];

  function trackLeaks(el: HTMLElement): { leaked: string[]; stop: () => void } {
    const leaked: string[] = [];
    const onHost = (event: Event): void => {
      leaked.push(`host:${event.type}`);
    };
    const onDocument = (event: Event): void => {
      leaked.push(`document:${event.type}`);
    };
    for (const name of CHECKBOX_EVENTS) {
      el.addEventListener(name, onHost);
      document.addEventListener(name, onDocument);
    }
    return {
      leaked,
      stop: () => {
        for (const name of CHECKBOX_EVENTS) {
          el.removeEventListener(name, onHost);
          document.removeEventListener(name, onDocument);
        }
      },
    };
  }

  it('keeps the toggle proposal and its input/change aliases inside for native pointer and keyboard activation while lr-sources-change still reports', async () => {
    const el = await fixture<LyraSourcePicker>(
      html`<lr-source-picker .sources=${sources}></lr-source-picker>`
    );
    const selectAll = selectAllCheckbox(el);
    await selectAll.updateComplete;
    const proposals: CustomEvent<{ checked: boolean }>[] = [];
    const onProposal = (event: Event): void => {
      proposals.push(event as CustomEvent<{ checked: boolean }>);
    };
    const changes: string[][] = [];
    const onChange = (event: Event): void => {
      changes.push([
        ...(event as CustomEvent<{ selectedSourceIds: string[] }>).detail.selectedSourceIds,
      ]);
    };
    selectAll.addEventListener('lr-checkbox-toggle-request', onProposal);
    el.addEventListener('lr-sources-change', onChange);
    const { leaked, stop } = trackLeaks(el);
    try {
      await resetMouse();
      selectAll.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = checkboxBox(selectAll).getBoundingClientRect();
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => changes.length === 1, 'native pointer activation did not select every source');
      await selectAll.updateComplete;

      selectAll.focus();
      await sendKeys({ press: 'Space' });
      await waitUntil(() => changes.length === 2, 'keyboard activation did not clear the selection');
    } finally {
      await resetMouse();
      stop();
      selectAll.removeEventListener('lr-checkbox-toggle-request', onProposal);
      el.removeEventListener('lr-sources-change', onChange);
    }

    expect(leaked).to.deep.equal([]);
    expect(proposals.map((event) => event.detail.checked)).to.deep.equal([true, false]);
    expect(
      proposals.map((event) => event.defaultPrevented),
      'containment never cancels the child proposal'
    ).to.deep.equal([false, false]);
    expect([...changes[0]!].sort()).to.deep.equal(['doc1', 'doc2', 'doc3']);
    expect(changes[1]).to.deep.equal([]);
  });

  it('keeps a checkbox-level veto authoritative while containing the proposal', async () => {
    const el = await fixture<LyraSourcePicker>(
      html`<lr-source-picker .sources=${sources}></lr-source-picker>`
    );
    const selectAll = selectAllCheckbox(el);
    await selectAll.updateComplete;
    const vetoes: boolean[] = [];
    const onProposal = (event: Event): void => {
      event.preventDefault();
      vetoes.push(event.defaultPrevented);
    };
    let changes = 0;
    const onChange = (): void => {
      changes += 1;
    };
    selectAll.addEventListener('lr-checkbox-toggle-request', onProposal);
    el.addEventListener('lr-sources-change', onChange);
    const { leaked, stop } = trackLeaks(el);
    try {
      selectAll.focus();
      await sendKeys({ press: 'Space' });
      await waitUntil(() => vetoes.length === 1, 'keyboard activation did not propose a toggle');
      await selectAll.updateComplete;
      await el.updateComplete;
    } finally {
      stop();
      selectAll.removeEventListener('lr-checkbox-toggle-request', onProposal);
      el.removeEventListener('lr-sources-change', onChange);
    }

    expect(vetoes).to.deep.equal([true]);
    expect(leaked).to.deep.equal([]);
    expect(changes).to.equal(0);
    expect(el.selectedSourceIds).to.deep.equal([]);
    expect(selectAll.checked).to.equal(false);
  });
});

describe('lr-source-picker deprecated show-select-all alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-source-picker', kind: 'property', name: 'showSelectAll' }];
  const observe = (el: LyraSourcePicker): string => String(el.shadowRoot!.querySelectorAll('[part="select-all"]').length);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraSourcePicker>(markup);

  it('applies without-select-all without a deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-source-picker .sources=${sources} without-select-all></lr-source-picker>`));
      plain = observe(await mount(html`<lr-source-picker .sources=${sources}></lr-source-picker>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });

  it('keeps show-select-all="false" equal to without-select-all, warning once', async () => {
    let canonical = '';
    let alias = '';
    let property = '';
    let readback: unknown[] = [];
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-source-picker .sources=${sources} without-select-all></lr-source-picker>`));
      alias = observe(await mount(html`<lr-source-picker .sources=${sources} show-select-all="false"></lr-source-picker>`));
      const el = await mount(html`<lr-source-picker .sources=${sources}></lr-source-picker>`);
      el.showSelectAll = false;
      await el.updateComplete;
      property = observe(el);
      readback = [el.withoutSelectAll, el.showSelectAll, el.hasAttribute('show-select-all')];
      // The canonical property syncs back into the alias.
      el.withoutSelectAll = false;
      await el.updateComplete;
      readback.push(el.showSelectAll, el.hasAttribute('show-select-all'));
    });
    expect(alias).to.equal(canonical);
    expect(property).to.equal(canonical);
    expect(readback).to.deep.equal([true, false, false, true, false]);
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-source-picker:property:showSelectAll',
    ]);
    expect(warnings[0]!.message).to.contain('without-select-all');
  });

  it('restores the default when show-select-all is true or removed', async () => {
    let plain = '';
    let restored = '';
    let removed = '';
    await captureDeprecationWarnings(ALIAS, async () => {
      plain = observe(await mount(html`<lr-source-picker .sources=${sources}></lr-source-picker>`));
      const el = await mount(html`<lr-source-picker .sources=${sources} show-select-all="false"></lr-source-picker>`);
      el.showSelectAll = true;
      await el.updateComplete;
      restored = observe(el);
      el.showSelectAll = false;
      await el.updateComplete;
      el.removeAttribute('show-select-all');
      await el.updateComplete;
      removed = observe(el);
    });
    expect(restored).to.equal(plain);
    expect(removed).to.equal(plain);
  });

  it('lets the later attribute win when markup carries both spellings', async () => {
    let canonical = '';
    let both = '';
    await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-source-picker .sources=${sources} without-select-all></lr-source-picker>`));
      const el = await mount(html`<lr-source-picker .sources=${sources} show-select-all without-select-all></lr-source-picker>`);
      expect(el.withoutSelectAll).to.equal(true);
      both = observe(el);
      const reversed = await mount(html`<lr-source-picker .sources=${sources} without-select-all show-select-all></lr-source-picker>`);
      expect(reversed.withoutSelectAll, 'the later alias attribute wins').to.equal(false);
    });
    expect(both).to.equal(canonical);
  });
});

describe('lr-source-picker deprecated searchable alias', () => {
  const ALIAS: DeprecatedUsage[] = [{ tag: 'lr-source-picker', kind: 'property', name: 'searchable' }];
  const observe = (el: LyraSourcePicker): string => String(el.shadowRoot!.querySelectorAll('[part="search"]').length);
  const mount = (markup: ReturnType<typeof html>) => fixture<LyraSourcePicker>(markup);

  it('applies without-search without a deprecation warning', async () => {
    let canonical = '';
    let plain = '';
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-source-picker .sources=${sources} without-search></lr-source-picker>`));
      plain = observe(await mount(html`<lr-source-picker .sources=${sources}></lr-source-picker>`));
    });
    expect(canonical).to.not.equal(plain);
    expect(warnings).to.have.length(0);
  });

  it('keeps searchable="false" equal to without-search, warning once', async () => {
    let canonical = '';
    let alias = '';
    let property = '';
    let readback: unknown[] = [];
    const warnings = await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-source-picker .sources=${sources} without-search></lr-source-picker>`));
      alias = observe(await mount(html`<lr-source-picker .sources=${sources} searchable="false"></lr-source-picker>`));
      const el = await mount(html`<lr-source-picker .sources=${sources}></lr-source-picker>`);
      el.searchable = false;
      await el.updateComplete;
      property = observe(el);
      readback = [el.withoutSearch, el.searchable, el.hasAttribute('searchable')];
      // The canonical property syncs back into the alias.
      el.withoutSearch = false;
      await el.updateComplete;
      readback.push(el.searchable, el.hasAttribute('searchable'));
    });
    expect(alias).to.equal(canonical);
    expect(property).to.equal(canonical);
    expect(readback).to.deep.equal([true, false, false, true, false]);
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-source-picker:property:searchable',
    ]);
    expect(warnings[0]!.message).to.contain('without-search');
  });

  it('restores the default when searchable is true or removed', async () => {
    let plain = '';
    let restored = '';
    let removed = '';
    await captureDeprecationWarnings(ALIAS, async () => {
      plain = observe(await mount(html`<lr-source-picker .sources=${sources}></lr-source-picker>`));
      const el = await mount(html`<lr-source-picker .sources=${sources} searchable="false"></lr-source-picker>`);
      el.searchable = true;
      await el.updateComplete;
      restored = observe(el);
      el.searchable = false;
      await el.updateComplete;
      el.removeAttribute('searchable');
      await el.updateComplete;
      removed = observe(el);
    });
    expect(restored).to.equal(plain);
    expect(removed).to.equal(plain);
  });

  it('lets the later attribute win when markup carries both spellings', async () => {
    let canonical = '';
    let both = '';
    await captureDeprecationWarnings(ALIAS, async () => {
      canonical = observe(await mount(html`<lr-source-picker .sources=${sources} without-search></lr-source-picker>`));
      const el = await mount(html`<lr-source-picker .sources=${sources} searchable without-search></lr-source-picker>`);
      expect(el.withoutSearch).to.equal(true);
      both = observe(el);
      const reversed = await mount(html`<lr-source-picker .sources=${sources} without-search searchable></lr-source-picker>`);
      expect(reversed.withoutSearch, 'the later alias attribute wins').to.equal(false);
    });
    expect(both).to.equal(canonical);
  });
});
