import '../../../translations/fr/shared.js';
import '../../../translations/fr/conversation.js';
import { registerLyraLocale, resolveLyraString } from '../../../localization.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraVoicePicker } from '../../lr-voice-picker.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('keeps closed catalog rows unrendered', async () => {
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker></lr-voice-picker>`);
  el.catalog = Array.from({ length: 1000 }, (_, i) => ({ id: `id${i}`, label: `Row ${i}` }));
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]').length;
  recordScaleMeasurement('lr-voice-picker', 'closed@1000', { rows });
  expect(rows).to.equal(0);
  el.open = true; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.be.greaterThan(0);
  const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  await waitUntil(
    () => !listbox.hidden && getComputedStyle(listbox).visibility === 'visible' &&
      listbox.style.getPropertyValue('--lr-positioner-available-inline-size') !== '',
    'the populated listbox never became visible with live positioner geometry',
    { timeout: 3000 },
  );
  el.open = false;
  await el.updateComplete;
  await waitUntil(
    () => listbox.hidden && el.shadowRoot!.querySelectorAll('[part="option"]').length === 0,
    'the closed listbox never left layout and released its catalog rows',
    { timeout: 3000 },
  );
  el.label = 'Closed update'; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it('does not evaluate row templates when moving the active option', async () => {
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker></lr-voice-picker>`);
  el.catalog = Array.from({ length: 1000 }, (_, i) => ({ id: `id${i}`, label: `Row ${i}` }));
  el.open = true;
  await el.updateComplete;
  const seam = el as unknown as { renderRows(...args: unknown[]): unknown; activeIndex: number; catalogPicker: { setActiveIndex(index: number): void } };
  const calls = countCalls(seam, 'renderRows');
  try {
    seam.catalogPicker.setActiveIndex(2);
    await el.updateComplete;
    recordScaleMeasurement('lr-voice-picker', 'focus@1000', { rowPasses: calls.calls });
    expect(calls.calls).to.equal(0);
    expect(el.shadowRoot!.querySelector('[data-active]')?.getAttribute('data-value')).to.equal('id2');
  } finally { calls.restore(); }
});

it('bounds catalog admission to 1,024 rows before normalization', async () => {
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker></lr-voice-picker>`);
  expectDevWarning('lyra-collection-truncated:lr-voice-picker:catalog');
  el.strings = {catalogPickerInputLimit:'Catalog limit'};
  el.catalog = Array.from({length:2000}, (_, i) => ({id:`id${i}`,label:`Row ${i}`}));
  await el.updateComplete;
  expect(el.catalog!.length).to.equal(1024);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Catalog limit');
  await waitUntil(() => sinkTexts().includes('Catalog limit'));
  el.label = 'Catalog label';
  await el.updateComplete;
  expect(sinkTexts().filter(text => text === 'Catalog limit')).to.have.lengthOf(1);
  el.catalog = []; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('refreshes synthetic badge text after same-locale catalog replacement', async () => {
  const el = await fixture<LyraVoicePicker>(html`<lr-voice-picker open locale="fr" value="missing" .catalog=${[{id:'known',label:'Known'}]}></lr-voice-picker>`);
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
