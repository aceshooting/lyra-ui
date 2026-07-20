import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './eval-dataset.js';
import type { LyraEvalDataset, EvalExample } from './eval-dataset.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import { styles } from './eval-dataset.styles.js';

function examples(): EvalExample[] {
  return [
    { id: 'ex-1', input: 'What is 2+2?', expectedOutput: '4', tags: ['math', 'easy'] },
    { id: 'ex-2', input: 'Summarize the report', expectedOutput: 'A short summary', tags: ['summarization'] },
    { id: 'ex-3', input: 'Translate hello to French', expectedOutput: 'Bonjour', tags: ['math', 'translation'] },
  ];
}

function gridRowCount(el: LyraEvalDataset): number {
  return el.shadowRoot!.querySelector('lr-data-grid')!.shadowRoot!.querySelectorAll('tbody tr[part="row"]').length;
}

it('renders every example as a data-grid row', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(3);
});

it('renders the built-in empty state when there are no examples', async () => {
  const el = (await fixture(html`<lr-eval-dataset></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lr-data-grid')!.shadowRoot!.querySelector('[part="empty"]');
  expect(empty).to.exist;
  expect(empty!.textContent).to.equal('No examples yet.');
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

  const grid = el.shadowRoot!.querySelector('lr-data-grid')!;
  const secondRow = grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[1] as HTMLElement;
  const selectListener = oneEvent(el, 'lr-example-select');
  secondRow.click();
  const selectEvent = await selectListener;
  expect(selectEvent.detail).to.deep.equal({ id: 'ex-2' });
  await el.updateComplete;
  expect(removeButton.disabled).to.be.false;

  const removeListener = oneEvent(el, 'lr-example-remove-request');
  removeButton.click();
  const removeEvent = await removeListener;
  expect(removeEvent.detail).to.deep.equal({ id: 'ex-2' });
});

it('clamps a stale selection back to null once the selected example is removed from `examples`', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('lr-data-grid')!;
  (grid.shadowRoot!.querySelectorAll('tbody tr[part="row"]')[0] as HTMLElement).click();
  await el.updateComplete;
  const removeButton = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!;
  expect(removeButton.disabled).to.be.false;

  el.examples = examples().filter((e) => e.id !== 'ex-1');
  await el.updateComplete;
  expect(removeButton.disabled).to.be.true;
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
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const exportButton = el.shadowRoot!.querySelector('lr-export-button')!;
  let completed = false;
  exportButton.addEventListener('lr-export-complete', () => (completed = true));
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
  await new Promise((r) => setTimeout(r, 10));
  expect(completed).to.be.false;
});

it('renders one toggleable tag chip per distinct tag and filters the grid to an OR match of active tags', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const chips = [...el.shadowRoot!.querySelectorAll('lr-chip')] as LyraChip[];
  const tagValues = chips.map((c) => c.value).sort();
  expect(tagValues).to.deep.equal(['easy', 'math', 'summarization', 'translation']);

  const mathChip = chips.find((c) => c.value === 'math')!;
  mathChip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2); // ex-1 and ex-3 both carry 'math'

  const translationChip = chips.find((c) => c.value === 'translation')!;
  translationChip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(2); // still just ex-1/ex-3 -- OR, not AND

  mathChip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
  translationChip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(3);
});

it('drops an active tag filter that no longer matches any example once `examples` changes', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  const summarizationChip = [...el.shadowRoot!.querySelectorAll('lr-chip')].find(
    (c: LyraChip) => c.value === 'summarization',
  )!;
  summarizationChip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
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
  const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  search.value = 'bonjour';
  search.dispatchEvent(new Event('input'));
  await el.updateComplete;
  expect(gridRowCount(el)).to.equal(1);
});

it('shows the no-matches message (not the empty-dataset message) once a filter matches zero of a non-empty dataset', async () => {
  const el = (await fixture(
    html`<lr-eval-dataset searchable .examples=${examples()}></lr-eval-dataset>`,
  )) as LyraEvalDataset;
  await el.updateComplete;
  const search = el.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  search.value = 'no such example exists anywhere';
  search.dispatchEvent(new Event('input'));
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('lr-data-grid')!.shadowRoot!.querySelector('[part="empty"]');
  expect(empty!.textContent).to.equal('No examples match the current filters.');
});

it('does not render a search field unless `searchable` is set', async () => {
  const el = (await fixture(html`<lr-eval-dataset .examples=${examples()}></lr-eval-dataset>`)) as LyraEvalDataset;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="search-input"]')).to.not.exist;
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
  const grid = el.shadowRoot!.querySelector('lr-data-grid')!;
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
  mathChip.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!.click();
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
  const search = el.shadowRoot!.querySelector('[part="search-input"]')!;
  expect(search.getAttribute('aria-label')).to.equal('Rechercher');
  expect(search.getAttribute('placeholder')).to.equal('Rechercher');
});

it("colors the search-input's placeholder and undoes Firefox's reduced default opacity", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='search-input'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)[^}]*opacity:\s*1/);
});
