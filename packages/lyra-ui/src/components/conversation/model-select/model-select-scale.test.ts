import '../../../translations/fr/shared.js';
import '../../../translations/fr/conversation.js';
import { registerLyraLocale, resolveLyraString } from '../../../localization.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraModelSelect } from './model-select.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('keeps closed catalog rows unrendered', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select></lr-model-select>`);
  el.catalog = Array.from({ length: 1000 }, (_, i) => ({ id: `id${i}`, label: `Row ${i}` }));
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]').length;
  recordScaleMeasurement('lr-model-select', 'closed@1000', { rows });
  expect(rows).to.equal(0);
  el.open = true; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.be.greaterThan(0);
  el.open = false;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="option"]').length === 0);
  el.label = 'Closed update'; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it('does not evaluate row templates when moving the active option', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select></lr-model-select>`);
  el.catalog = Array.from({ length: 1000 }, (_, i) => ({ id: `id${i}`, label: `Row ${i}` }));
  el.open = true;
  await el.updateComplete;
  const seam = el as unknown as { renderRows(...args: unknown[]): unknown; activeIndex: number; catalogPicker: { setActiveIndex(index: number): void } };
  const calls = countCalls(seam, 'renderRows');
  try {
    seam.catalogPicker.setActiveIndex(2);
    await el.updateComplete;
    recordScaleMeasurement('lr-model-select', 'focus@1000', { rowPasses: calls.calls });
    expect(calls.calls).to.equal(0);
    expect(el.shadowRoot!.querySelector('[data-active]')?.getAttribute('data-value')).to.equal('id2');
  } finally { calls.restore(); }
});

it('bounds catalog admission to 1,024 rows before normalization', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select></lr-model-select>`);
  expectDevWarning('lyra-collection-truncated:lr-model-select:catalog');
  el.strings = {catalogPickerInputLimit:'Catalog limit'};
  el.catalog = Array.from({length:2000}, (_, i) => ({id:`id${i}`,label:`Row ${i}`}));
  await el.updateComplete;
  expect(el.catalog!.length).to.equal(1024);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Catalog limit');
  el.catalog = []; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('uses a keyed label lookup for 1,000 catalog rows', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select .catalog=${Array.from({length:1000},(_,i)=>({id:`${i}`,label:`Row ${i}`}))}></lr-model-select>`);
  const controller = (el as unknown as {catalogPicker:{effectiveEntries: unknown[];labelFor(id:string):string}}).catalogPicker;
  const calls = countCalls(controller.effectiveEntries,'find');
  try { for(let i=0;i<100;i++) expect(controller.labelFor('999')).to.equal('Row 999'); expect(calls.calls).to.equal(0); }
  finally { calls.restore(); }
});

it('refreshes synthetic badge text after same-locale catalog replacement', async () => {
  const el = await fixture<LyraModelSelect>(html`<lr-model-select open locale="fr" value="missing" .catalog=${[{id:'known',label:'Known'}]}></lr-model-select>`);
  const original = resolveLyraString(el, 'notInCatalog');
  const badge = () => el.shadowRoot!.querySelector('[part="option-badge"]')?.textContent;
  expect(badge()).to.equal(original);
  try {
    registerLyraLocale('fr', {notInCatalog:'Replacement badge'});
    el.label = 'Coalesced named update';
    await el.updateComplete;
    expect(badge()).to.equal('Replacement badge');
  } finally {
    registerLyraLocale('fr', {notInCatalog:original});
    await el.updateComplete;
  }
  expect(badge()).to.equal(original);
});
