import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './eval-dataset.js';
import type { LyraEvalDataset, EvalExample } from './eval-dataset.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraInput } from '../../forms/input/input.class.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import type { LyraFileInput } from '../../media/file-input/file-input.class.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';

// The locale-collation fixture deliberately retains the unregistered English messages.
expectLocaleFallback('de', [
  'evalDatasetAddExample',
  'evalDatasetColumnExpectedOutput',
  'evalDatasetColumnInput',
  'evalDatasetColumnTags',
  'evalDatasetImportLabel',
  'evalDatasetLabel',
  'evalDatasetRemoveExample',
  'evalDatasetTagFilterLabel',
  'exportButtonLabel',
  'exportFormatMenuLabel',
  'fileInputDefaultLabel',
  'tableFilterLabel',
  'tableFilterPlaceholder',
]);

function examples(): EvalExample[] {
  return [
    { id: 'ex-1', input: 'What is 2+2?', expectedOutput: '4', tags: ['math', 'easy'] },
    { id: 'ex-2', input: 'Summarize the report', expectedOutput: 'A short summary', tags: ['summarization'] },
    { id: 'ex-3', input: 'Translate hello to French', expectedOutput: 'Bonjour', tags: ['math', 'translation'] },
  ];
}

function searchHost(el: LyraEvalDataset): LyraInput {
  return el.shadowRoot!.querySelector<LyraInput>('[part="search-input"]')!;
}
function searchField(el: LyraEvalDataset): HTMLInputElement {
  return searchHost(el).shadowRoot!.querySelector<HTMLInputElement>('input')!;
}
async function typeSearch(el: LyraEvalDataset, value: string): Promise<void> {
  await searchHost(el).updateComplete;
  const field = searchField(el);
  field.value = value;
  field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
}

function gridRowCount(el: LyraEvalDataset): number {
  return el.shadowRoot!.querySelector('lr-table')!.shadowRoot!.querySelectorAll('tbody tr[part="row"]').length;
}

it('discloses examples dropped by the public collection boundary', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-eval-dataset', 'examples'));
  const many: EvalExample[] = Array.from({ length: 10_001 }, (_, index) => ({
    id: `example-${index}`, input: `Input ${index}`,
  }));
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${many}></lr-eval-dataset>`);
  expect(el.examples).to.have.length(10_000);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.include('Only the first 10,000 examples');
  el.examples = examples();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('uses one compact localized import instruction with a matching accessible name', async () => {
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .strings=${{
    evalDatasetImportLabel: 'Importer les exemples',
  }}></lr-eval-dataset>`);
  const picker = el.shadowRoot!.querySelector<LyraFileInput>('lr-file-input')!;
  await picker.updateComplete;
  // The tight dropzone density comes from the dropzone hooks, not the deprecated `compact`.
  expect(picker.hasAttribute('compact')).to.equal(false);
  expect(getComputedStyle(picker.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!).paddingTop).to.equal('8px');
  expect(picker.label).to.equal(undefined);
  expect(picker.querySelector('[slot="dropzone"]')!.textContent).to.equal('Importer les exemples');
  expect(picker.shadowRoot!.querySelector<HTMLElement>('[part~="form-control-label"]')!.hidden).to.equal(true);
  expect(picker.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-label')).to.equal('Importer les exemples');
  await expect(picker).to.be.accessible();
});

it('renders every example as a table row', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(3);
});

it('renders the built-in empty state when there are no examples', async () => {
  const el = (await fixture(html`<lr-eval-dataset></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lr-table')!.shadowRoot!.querySelector('[part="empty"]') as
    | (HTMLElement & { heading: string })
    | null;
  expect((empty) != null).to.equal(true);
  expect(empty!.heading).to.equal('No examples yet.');
});

it('emits lr-example-add-request with no detail when Add is clicked', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const listener = oneEvent(el, 'lr-example-add-request');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="add-button"]')!.click();
  const ev = await listener;
  // A `CustomEvent` constructed with `detail: undefined` normalizes to `null` per spec (verified
  // against every browser this suite runs under, not a bug in the component) -- `undefined` never
  // survives the round-trip.
  expect(ev.detail).to.equal(null);
});

it('does not emit an add request while disabled', async () => {
  const el = (await fixture(html`<lr-eval-dataset disabled .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lr-example-add-request', () => (fired = true));
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="add-button"]')!.click();
  expect(fired).to.be.false;
});

it('keeps the remove button disabled until a row is selected, then emits lr-example-remove-request for the selected id', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const removeButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  expect(removeButton.disabled).to.be.true;

  const grid = el.shadowRoot!.querySelector('lr-table')!;
  const secondRow = grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[1] as HTMLElement;
  const selectListener = oneEvent(el, 'lr-example-select');
  secondRow.click();
  const selectEvent = await selectListener;
  expect(selectEvent.detail).to.deep.equal({ exampleId: 'ex-2' });
  await el.updateComplete;
  expect(removeButton.disabled).to.be.false;

  const removeListener = oneEvent(el, 'lr-example-remove-request');
  removeButton.click();
  const removeEvent = await removeListener;
  expect(removeEvent.detail).to.deep.equal({ exampleId: 'ex-2' });
});

it('clamps a stale selection back to null once the selected example is removed from `examples`', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('lr-table')!;
  (grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[0] as HTMLElement).click();
  await el.updateComplete;
  const removeButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  expect(removeButton.disabled).to.be.false;

  const cleared = oneEvent(el, 'lr-example-select');
  el.examples = examples().filter((e) => e.id !== 'ex-1');
  await el.updateComplete;
  expect(removeButton.disabled).to.be.true;
  expect((await cleared).detail).to.deep.equal({ exampleId: null });
});

it('clears a private search filter when searchable becomes false', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await typeSearch(el, 'bonjour');
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(1);
  el.searchable = false;
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(3);
});

it('shows a clear button once the search filter has text, and clears it on click', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  expect(searchHost(el).shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]') === null).to.be.true;

  await typeSearch(el, 'bonjour');
  await el.updateComplete;
  await searchHost(el).updateComplete;
  expect(gridRowCount(el)).to.equal(1);
  const clear = searchHost(el).shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]');
  expect(clear).to.not.equal(null);

  clear!.click();
  await el.updateComplete;
  await searchHost(el).updateComplete;
  expect(searchField(el).value).to.equal('');
  expect(gridRowCount(el)).to.equal(3);
  expect(searchHost(el).shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]') === null).to.be.true;
});

it('forwards native editing-assistance and virtual-keyboard hints to the search input', async () => {
  const el = (await fixture(html`
    <lr-eval-dataset
      searchable
      autocomplete="off"
      spellcheck="false"
      autocapitalize="none"
      autocorrect="off"
      inputmode="search"
      enterkeyhint="search"
    ></lr-eval-dataset>
  `)) as LyraEvalDataset;
  await searchHost(el).updateComplete;
  const search = searchField(el);

  expect(search.getAttribute('autocomplete')).to.equal('off');
  expect(search.spellcheck).to.be.false;
  expect(search.getAttribute('autocapitalize')).to.equal('none');
  expect(search.getAttribute('autocorrect')).to.equal('off');
  expect(search.getAttribute('inputmode')).to.equal('search');
  expect(search.getAttribute('enterkeyhint')).to.equal('search');
});

it('leaves optional search editing-assistance hints unset by default', async () => {
  const el = (await fixture(html`<lr-eval-dataset searchable></lr-eval-dataset>`)) as LyraEvalDataset;
  const host = searchHost(el);

  expect(host.spellcheck).to.be.true;
  expect(host.hasAttribute('autocomplete')).to.be.false;
  expect(host.hasAttribute('autocapitalize')).to.be.false;
  expect(host.hasAttribute('autocorrect')).to.be.false;
  expect(host.hasAttribute('inputmode')).to.be.false;
  expect(host.hasAttribute('enterkeyhint')).to.be.false;
});

it('parses a literal spellcheck="false" attribute for the searchable input', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable spellcheck="false"></lr-eval-dataset>`,
  )) as LyraEvalDataset;

  expect(el.spellcheck).to.be.false;
  expect(searchHost(el).spellcheck).to.be.false;
});

it('gates search, tags, and row selection while disabled', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset disabled searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  const search = searchHost(el);
  const chip = el.shadowRoot!.querySelector('lr-chip') as LyraChip;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement & { selectionMode: string };
  expect(search.disabled).to.be.true;
  expect(chip.disabled).to.be.true;
  expect(chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!.disabled).to.be.true;
  expect(table.selectionMode).to.equal('none');
  let selected = 0;
  el.addEventListener('lr-example-select', () => selected++);
  table.shadowRoot!.querySelector<HTMLElement>('tbody tr[part="row"]')!.click();
  expect(selected).to.equal(0);
});

it('does not leak raw composed child events alongside its translated request events', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  const rawRows: string[] = [];
  const selectedIds: (string | null)[] = [];
  el.addEventListener('lr-row-activate', () => rawRows.push('lr-row-activate'));
  el.addEventListener('lr-row-click', () => rawRows.push('lr-row-click'));
  el.addEventListener('lr-example-select', (e) =>
    selectedIds.push((e as CustomEvent<{ exampleId: string | null }>).detail.exampleId),
  );
  // A real row activation: the table fires the canonical lr-row-activate and then its deprecated
  // lr-row-click alias, and the wrapper must translate once and contain both.
  const table = el.shadowRoot!.querySelector('lr-table') as LyraTable<EvalExample>;
  table.shadowRoot!.querySelectorAll<HTMLElement>('tbody tr[part="row"]')[1]!.click();
  expect(rawRows).to.deep.equal([]);
  expect(selectedIds).to.deep.equal(['ex-2']);

  // The deprecated row alias is contained even when it arrives on its own.
  table.dispatchEvent(new CustomEvent('lr-row-click', {
    bubbles: true,
    composed: true,
    detail: { row: examples()[0] },
  }));
  expect(rawRows).to.deep.equal([]);
});

it('contains both tag-chip toggle events while still applying the tag filter', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  const leaked: string[] = [];
  for (const type of ['lr-chip-toggle-request', 'lr-chip-select']) {
    el.addEventListener(type, () => leaked.push(type));
  }
  const mathChip = ([...el.shadowRoot!.querySelectorAll('lr-chip')] as LyraChip[]).find((chip) => chip.value === 'math')!;
  mathChip.click();
  await el.updateComplete;
  expect(leaked).to.deep.equal([]);
  expect(gridRowCount(el)).to.equal(2);
  expect(mathChip.selected).to.be.true;

  mathChip.click();
  await el.updateComplete;
  expect(leaked).to.deep.equal([]);
  expect(gridRowCount(el)).to.equal(3);
  expect(mathChip.selected).to.be.false;
});

it('contains auxiliary native/child events while deliberately passing through table sorting', async () => {
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>
  `);
  const leaked: string[] = [];
  for (const type of ['input', 'change', 'lr-invalid', 'lr-show', 'lr-hide', 'lr-selection-change', 'lr-page-change']) {
    el.addEventListener(type, () => leaked.push(type));
  }
  searchField(el).dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  const fileInput = el.shadowRoot!.querySelector('lr-file-input')!;
  fileInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  fileInput.dispatchEvent(new CustomEvent('lr-invalid', { bubbles: true, composed: true }));
  const exportButton = el.shadowRoot!.querySelector('lr-export-button')!;
  exportButton.dispatchEvent(new CustomEvent('lr-show', { bubbles: true, composed: true }));
  exportButton.dispatchEvent(new CustomEvent('lr-hide', { bubbles: true, composed: true }));
  const table = el.shadowRoot!.querySelector('lr-table')!;
  table.dispatchEvent(new CustomEvent('lr-selection-change', {
    bubbles: true,
    composed: true,
    detail: { rowKeys: ['ex-1'] },
  }));
  table.dispatchEvent(new CustomEvent('lr-page-change', {
    bubbles: true,
    composed: true,
    detail: { page: 2 },
  }));
  const sorted = oneEvent(el, 'lr-sort');
  table.dispatchEvent(new CustomEvent('lr-sort', {
    bubbles: true,
    composed: true,
    detail: { phase: 'commit', sortKey: 'input', sortDir: 'asc' },
  }));
  expect((await sorted).detail).to.deep.equal({ phase: 'commit', sortKey: 'input', sortDir: 'asc' });
  expect(leaked).to.deep.equal([]);
});

it('makes every built-in column sortable and bubbles a real header sort commit', async () => {
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset .examples=${examples()}></lr-eval-dataset>
  `);
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement & {
    updateComplete: Promise<unknown>;
    shadowRoot: ShadowRoot;
  };
  await table.updateComplete;
  const sortableHeaders = table.shadowRoot.querySelectorAll<HTMLElement>('th[data-sortable]');
  expect(sortableHeaders.length).to.equal(3);

  const sorted = oneEvent(el, 'lr-sort');
  sortableHeaders[0]!.click();
  expect((await sorted).detail).to.deep.equal({
    phase: 'commit',
    sortKey: 'input',
    sortDir: 'asc',
  });
});

it('sorts through the optional-output and multi-tag column accessors', async () => {
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset .examples=${examples()}></lr-eval-dataset>
  `);
  const table = el.shadowRoot!.querySelector('lr-table')!;
  const headers = table.shadowRoot!.querySelectorAll<HTMLElement>('th[data-sortable]');

  headers[1]!.click();
  await table.updateComplete;
  headers[2]!.click();
  await table.updateComplete;

  expect(headers).to.have.length(3);
  expect(table.shadowRoot!.querySelectorAll('tbody tr[part="row"]')).to.have.length(3);
});

it('automatically pages catalogs larger than the component rendering ceiling', async () => {
  const many = Array.from({ length: 250 }, (_, index) => ({
    id: `ex-${index}`,
    input: `Input ${index}`,
  }));
  const el = (await fixture(html`<lr-eval-dataset .examples=${many}></lr-eval-dataset>`)) as LyraEvalDataset;
  const table = el.shadowRoot!.querySelector('lr-table') as HTMLElement & { pageSize: number };
  expect(table.pageSize).to.equal(100);
  expect(table.shadowRoot!.querySelectorAll('tbody tr[part="row"]').length).to.equal(100);
});

it('re-emits an accepted file selection from the internal file-input as lr-import-request', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const fileInput = el.shadowRoot!.querySelector('lr-file-input')!;
  const file = new File(['[]'], 'examples.json', { type: 'application/json' });
  const listener = oneEvent(el, 'lr-import-request');
  fileInput.dispatchEvent(new CustomEvent('lr-files', { detail: { files: [file], rejected: [] } }));
  const ev = await listener;
  expect(ev.detail.files).to.deep.equal([file]);
});

it('does not emit an import request when every dropped file was rejected', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const fileInput = el.shadowRoot!.querySelector('lr-file-input')!;
  let fired = false;
  el.addEventListener('lr-import-request', () => (fired = true));
  const badFile = new File(['x'], 'bad.exe', { type: 'application/x-msdownload' });
  fileInput.dispatchEvent(
    new CustomEvent('lr-files', { detail: { files: [], rejected: [{ file: badFile, reason: 'type' }] } }),
  );
  expect(fired).to.be.false;
});

it('suppresses the export-button built-in download and re-emits lr-export-request instead', async () => {
  const warnings = await captureDeprecationWarnings(
    [{ tag: 'lr-export-button', kind: 'event', name: 'lr-export' }],
    async () => {
      const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
      await el.updateComplete;
      const exportButton = el.shadowRoot!.querySelector('lr-export-button')!;
      let completed = false;
      let leakedLegacyEvent = false;
      exportButton.addEventListener('lr-export-complete', () => (completed = true));
      el.addEventListener('lr-export', () => (leakedLegacyEvent = true));
      const listener = oneEvent(el, 'lr-export-request');
      // The default `exportFormats` carries more than one entry, so the trigger opens a format menu
      // rather than exporting directly -- open it, then pick the first (csv) menu item.
      const trigger = exportButton.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
      trigger.click();
      await exportButton.updateComplete;
      const csvItem = exportButton.shadowRoot!.querySelector<HTMLButtonElement>('[part="menu-item"]')!;
      csvItem.click();
      const ev = await listener;
      expect(ev.detail).to.deep.equal({ format: 'csv' });
      expect(ev.target === el).to.be.true;
      // wait-reason: asserting no completion event fires after the export event
      await new Promise((r) => setTimeout(r, 10));
      expect(completed).to.be.false;
      expect(leakedLegacyEvent).to.be.false;
    },
  );
  expect(warnings).to.deep.equal([]);
});

it('renders one toggleable tag chip per distinct tag and filters the grid to an OR match of active tags', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const chips = [...el.shadowRoot!.querySelectorAll('lr-chip')] as LyraChip[];
  const tagValues = chips.map((c) => c.value).sort();
  expect(tagValues).to.deep.equal(['easy', 'math', 'summarization', 'translation']);

  const mathChip = chips.find((c) => c.value === 'math')!;
  mathChip.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2); // ex-1 and ex-3 both carry 'math'

  const translationChip = chips.find((c) => c.value === 'translation')!;
  translationChip.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2); // still just ex-1/ex-3 -- OR, not AND

  mathChip.click();
  translationChip.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(3);
});

it('orders tag chips with the effective locale collation', async () => {
  const wrapper = await fixture(html`
    <div lang="de">
      <lr-eval-dataset
        .examples=${[
          { id: 'z', input: 'Z', tags: ['z'] },
          { id: 'umlaut', input: 'Umlaut', tags: ['ä'] },
        ]}
      ></lr-eval-dataset>
    </div>
  `);
  const el = wrapper.querySelector('lr-eval-dataset') as LyraEvalDataset;
  const values = Array.from(el.shadowRoot!.querySelectorAll('lr-chip'), (chip) => chip.value);
  expect(values).to.deep.equal(['ä', 'z']);
});

it('drops an active tag filter that no longer matches any example once `examples` changes', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const summarizationChip = [...el.shadowRoot!.querySelectorAll('lr-chip')].find(
    (c: LyraChip) => c.value === 'summarization',
  )!;
  summarizationChip.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(1);

  el.examples = examples().filter((e) => e.id !== 'ex-2');
  await el.updateComplete;
  // The 'summarization' tag no longer exists anywhere -- the stale filter must not keep
  // silently matching zero rows forever with no visible way back to "no filter".
  expect(gridRowCount(el)).to.equal(2);
  expect(
    ([...el.shadowRoot!.querySelectorAll('lr-chip')] as LyraChip[]).some((c) => c.value === 'summarization'),
  ).to
    .be.false;
});

it('filters by the built-in search field across input, expected output, and tags', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  await typeSearch(el, 'bonjour');
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(1);
});

it('clears selection and emits null when a search filter hides the selected example', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  const grid = el.shadowRoot!.querySelector('lr-table')!;
  (grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[0] as HTMLElement).click();
  await el.updateComplete;
  const removeButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  expect(removeButton.disabled).to.be.false;

  const selectionCleared = oneEvent(el, 'lr-example-select');
  await typeSearch(el, 'summary');
  const event = await selectionCleared;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ exampleId: null });
  expect(gridRowCount(el)).to.equal(1);
  expect(removeButton.disabled).to.be.true;
});

it('clears selection and emits null when a tag filter hides the selected example', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  const grid = el.shadowRoot!.querySelector('lr-table')!;
  (grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[1] as HTMLElement).click();
  await el.updateComplete;
  const removeButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  expect(removeButton.disabled).to.be.false;

  const selectionCleared = oneEvent(el, 'lr-example-select');
  const mathChip = ([...el.shadowRoot!.querySelectorAll('lr-chip')] as LyraChip[]).find((chip) => chip.value === 'math')!;
  mathChip.click();
  const event = await selectionCleared;
  await el.updateComplete;

  expect(event.detail).to.deep.equal({ exampleId: null });
  expect(gridRowCount(el)).to.equal(2);
  expect(removeButton.disabled).to.be.true;
});

it('shows the no-matches message (not the empty-dataset message) once a filter matches zero of a non-empty dataset', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  await typeSearch(el, 'no such example exists anywhere');
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lr-table')!.shadowRoot!.querySelector('[part="empty"]') as
    | (HTMLElement & { heading: string })
    | null;
  expect(empty!.heading).to.equal('No examples match the current filters.');
});

it('keeps the table columns and selection key set stable across unrelated renders', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  const table = el.shadowRoot!.querySelector('lr-table') as LyraTable<EvalExample>;
  const columns = table.columns;
  const selected = table.selectedRowKeys;
  el.disabled = true;
  await el.updateComplete;
  expect(table.columns).to.equal(columns);
  expect(table.selectedRowKeys).to.equal(selected);
});

it('does not render a search field unless `searchable` is set', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="search-input"]')) == null).to.be.true;
});

it('is accessible with no examples', async () => {
  const el = await fixture(html`<lr-eval-dataset></lr-eval-dataset>`);
  await expect(el).to.be.accessible();
});

it('is accessible fully populated: searchable, tag filters, a selection, and rendered rows', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('lr-table')!;
  (grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[0] as HTMLElement).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('lr-chip').length).to.be.greaterThan(0);
  expect(gridRowCount(el)).to.equal(3);
  await expect(el).to.be.accessible();
});

it('renders correctly under dir="rtl" with tag chips still activatable', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset dir="rtl" .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  const mathChip = ([...el.shadowRoot!.querySelectorAll('lr-chip')] as LyraChip[]).find((c) => c.value === 'math')!;
  mathChip.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2);
});

it('stays within a 320px allocation without the host overflowing it', async () => {
  const container = document.createElement('div');
  container.style.inlineSize = '320px';
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
    { parentNode: container },
  )) as LyraEvalDataset;
  await el.updateComplete;
  expect((el as unknown as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
});

it('renders the built-in English default strings unchanged with no locale registered', async () => {
  const el = (await fixture(html`<lr-eval-dataset></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="add-button"]')!.textContent!.trim()).to.equal('Add example');
  expect(el.shadowRoot!.querySelector('[part="remove-button"]')!.textContent!.trim()).to.equal('Remove example');
});

it('honors a `.strings` override for the add-button label', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset .strings=${{ evalDatasetAddExample: 'Ajouter un exemple' }}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="add-button"]')!.textContent!.trim()).to.equal('Ajouter un exemple');
});

it('honors a `.strings` override for the search field label', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .strings=${{ evalDatasetSearchLabel: 'Rechercher' }}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  const search = searchHost(el);
  expect(search.getAttribute('aria-label')).to.equal('Rechercher');
  expect(search.getAttribute('placeholder')).to.equal('Rechercher');
});

it('bridges native focus/blur on the search field to the host element', async () => {
  const el = (await fixture(html`<lr-eval-dataset searchable></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  await searchHost(el).updateComplete;
  const input = searchField(el);

  const focusListener = oneEvent(el, 'focus');
  input.dispatchEvent(new FocusEvent('focus'));
  await focusListener;

  const blurListener = oneEvent(el, 'blur');
  input.dispatchEvent(new FocusEvent('blur'));
  await blurListener;
});

it('uses `label` or the localized fallback for the grid without cloning a host aria-label', async () => {
  const defaultEl = (await fixture(html`<lr-eval-dataset></lr-eval-dataset>`)) as LyraEvalDataset;
  await defaultEl.updateComplete;
  expect(defaultEl.shadowRoot!.querySelector('lr-table')!.getAttribute('aria-label')).to.equal(
    'Evaluation examples',
  );

  const labeled = (await fixture(html`<lr-eval-dataset label="My dataset"></lr-eval-dataset>`)) as LyraEvalDataset;
  await labeled.updateComplete;
  expect(labeled.shadowRoot!.querySelector('lr-table')!.getAttribute('aria-label')).to.equal('My dataset');

  const hostLabeled = (await fixture(
    html`<lr-eval-dataset label="My dataset" aria-label="Pairwise eval run 3"></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await hostLabeled.updateComplete;
  expect(hostLabeled.getAttribute('aria-label')).to.equal('Pairwise eval run 3');
  expect(hostLabeled.shadowRoot!.querySelector('lr-table')!.getAttribute('aria-label')).to.equal('My dataset');

  hostLabeled.setAttribute('aria-label', '');
  await hostLabeled.updateComplete;
  expect(hostLabeled.shadowRoot!.querySelector('lr-table')!.getAttribute('aria-label')).to.equal('My dataset');
});

it('contains the nested table sort-request proposal while preserving the documented sort commit', async () => {
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset .examples=${[{ id: 'one', input: 'Prompt' }]}></lr-eval-dataset>
  `);
  const table = el.shadowRoot!.querySelector('lr-table')!;
  let proposals = 0;
  let commits = 0;
  el.addEventListener('lr-sort-request', () => proposals++);
  el.addEventListener('lr-sort', () => commits++);

  table.dispatchEvent(new CustomEvent('lr-sort-request', {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: { phase: 'request', sortKey: 'input', sortDir: 'asc' },
  }));
  table.dispatchEvent(new CustomEvent('lr-sort', {
    bubbles: true,
    composed: true,
    detail: { phase: 'commit', sortKey: 'input', sortDir: 'asc' },
  }));

  expect(proposals).to.equal(0);
  expect(commits).to.equal(1);
});

it('applies a consumer ::part(add-button):hover override in the rendered cascade', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <style>
        lr-eval-dataset.consumer-hover::part(add-button):hover { border-color: rgb(1, 2, 3); }
      </style>
      <lr-eval-dataset class="consumer-hover"></lr-eval-dataset>
    </div>
  `);
  const el = wrapper.querySelector('lr-eval-dataset') as LyraEvalDataset;
  const add = el.shadowRoot!.querySelector('[part="add-button"]') as HTMLButtonElement;
  const rect = add.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(() => getComputedStyle(add).borderTopColor === 'rgb(1, 2, 3)');
    expect(getComputedStyle(add).borderTopColor).to.equal('rgb(1, 2, 3)');
  } finally {
    await resetMouse();
  }
});

it('deepens the Add and Remove borders while pressed', async () => {
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset .examples=${examples()}></lr-eval-dataset>
  `);
  const table = el.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  table.shadowRoot!.querySelector<HTMLElement>('tbody tr[part="row"]')!.click();
  await el.updateComplete;
  for (const part of ['add-button', 'remove-button']) {
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${part}"]`)!;
    expect(button.disabled).to.equal(false);
    button.style.transition = 'none';
    try {
      await hoverUntilMatched(button, `${part} never reached hover`);
      const hovered = getComputedStyle(button).borderTopColor;
      await sendMouse({ type: 'down', button: 'left' });
      await waitUntil(
        () => button.matches(':active') && getComputedStyle(button).borderTopColor !== hovered,
        `${part} never painted a distinct pressed border`,
      );
    } finally {
      await resetMouse();
    }
  }
});

it('normalizes duplicate example ids first-wins before the nested grid', async () => {
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset .examples=${[
      { id: 'same', input: 'First example' },
      { id: 'same', input: 'Later example' },
    ]}></lr-eval-dataset>
  `);
  expect(gridRowCount(el)).to.equal(1);
  const table = el.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table');
  if (!table) throw new Error('Expected the normalized examples table to render.');
  expect(table.rows[0]!.input).to.equal('First example');
});

it('tolerates a non-array `tags` field on one example without blanking the rest of the dataset', async () => {
  const el = (await fixture(html`<lr-eval-dataset></lr-eval-dataset>`)) as LyraEvalDataset;
  el.examples = [
    { id: 'bad', input: 'malformed row', tags: 5 as unknown as readonly string[] },
    { id: 'good', input: 'well-formed row', tags: ['ok'] },
  ];
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2);
});

it('tolerates a bare-string `tags` field on one example without blanking the grid', async () => {
  const el = (await fixture(html`<lr-eval-dataset></lr-eval-dataset>`)) as LyraEvalDataset;
  el.examples = [
    { id: 'bad', input: 'malformed row', tags: 'oops' as unknown as readonly string[] },
    { id: 'good', input: 'well-formed row', tags: ['ok'] },
  ];
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2);
});

it('keeps every row of a large dataset whose metadata would exhaust a per-field budget', async () => {
  const rows: EvalExample[] = Array.from({ length: 5000 }, (_, index) => ({
    id: `ex-${index}`,
    input: `in ${index}`,
    tags: ['a', 'b', 'c'],
    metadata: index === 0 ? { blob: new Uint8Array(2) } : { p: 1, q: 2, r: 3, s: 4 },
  }));
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${rows}></lr-eval-dataset>`);
  expect(el.examples).to.have.lengthOf(5000);
});

it('contains the import control value events while exposing the import request', async () => {
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset></lr-eval-dataset>`);
  const picker = el.shadowRoot!.querySelector<LyraFileInput>('lr-file-input')!;
  await picker.updateComplete;
  const seen: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-files', 'lr-import-request']) {
    el.addEventListener(name, () => seen.push(name));
  }
  const transfer = new DataTransfer();
  transfer.items.add(new File(['[]'], 'examples.json', { type: 'application/json' }));
  const input = picker.shadowRoot!.querySelector<HTMLInputElement>('input[type="file"]')!;
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(seen).to.deep.equal(['lr-import-request']);
});

it('gates the search clear action immediately when disabled changes', async () => {
  const el = await fixture<LyraEvalDataset>(html`<lr-eval-dataset searchable></lr-eval-dataset>`);
  await typeSearch(el, 'pending');
  await el.updateComplete;
  await searchHost(el).updateComplete;
  const clear = searchHost(el).shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]')!;
  el.disabled = true;
  clear.click();
  expect(searchField(el).value).to.equal('pending');
  await el.updateComplete;
  await searchHost(el).updateComplete;
  expect(searchField(el).value).to.equal('pending');
  expect(searchHost(el).disabled).to.equal(true);
});

it('announces newly truncated example ownership in the adopted document and stays quiet on an unchanged render', async () => {
  expectDevWarning(collectionTruncationWarningKey('lr-eval-dataset', 'examples'));
  const el = await fixture<LyraEvalDataset>(html`
    <lr-eval-dataset lang="en" .examples=${examples()} .strings=${{ evalDatasetLimit: 'Dataset window {count}' }}></lr-eval-dataset>
  `);
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const destination = frame.contentDocument!;
  const message = 'Dataset window ' + new Intl.NumberFormat(el.lang).format(10_000);
  const count = (owner: Document) => [...owner.querySelectorAll('[data-lr-live-region="polite"] > div')]
    .filter((node) => node.textContent === message).length;
  try {
    destination.body.append(destination.adoptNode(el));
    await el.updateComplete;
    el.examples = Array.from({ length: 10_001 }, (_, index) => ({ id: `example-${index}`, input: `Input ${index}` }));
    await el.updateComplete;
    expect(el.ownerDocument === destination).to.equal(true);
    expect(el.examples.length).to.equal(10_000);
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(message);
    expect(count(destination)).to.equal(1);
    expect(count(document)).to.equal(0);
    el.requestUpdate();
    await el.updateComplete;
    expect(count(destination)).to.equal(1);
  } finally {
    document.adoptNode(el);
    el.remove();
    frame.remove();
  }
});
