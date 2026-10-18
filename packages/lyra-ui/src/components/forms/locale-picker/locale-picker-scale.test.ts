import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraLocalePicker } from './locale-picker.js';
import { countCalls, recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('keeps closed catalog rows unrendered', async () => {
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags></lr-locale-picker>`);
  el.locales = Array.from({ length: 512 }, (_, i) => ({ tag: `en-x-${i}`, label: `Row ${i}` }));
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]').length;
  recordScaleMeasurement('lr-locale-picker', 'closed@512', { rows });
  expect(rows).to.equal(0);
  el.open = true; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.be.greaterThan(0);
  el.open = false;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="option"]').length === 0);
  el.label = 'Closed update'; await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it('does not evaluate row templates when moving the active option', async () => {
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags></lr-locale-picker>`);
  el.locales = Array.from({ length: 512 }, (_, i) => ({ tag: `en-x-${i}`, label: `Row ${i}` }));
  el.open = true;
  await el.updateComplete;
  const seam = el as unknown as { renderRows(...args: unknown[]): unknown; activeIndex: number; catalogPicker: { setActiveIndex(index: number): void } };
  const calls = countCalls(seam, 'renderRows');
  try {
    seam.activeIndex = 2;
    await el.updateComplete;
    recordScaleMeasurement('lr-locale-picker', 'focus@512', { rowPasses: calls.calls });
    expect(calls.calls).to.equal(0);
    expect(el.shadowRoot!.querySelector('[data-active]')?.getAttribute('data-value')).to.equal('en-x-2');
  } finally { calls.restore(); }
});

it('folds 512 locale search rows once across successive queries', async () => {
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker searchable without-flags .locales=${Array.from({length:512}, (_, i) => ({tag:`en-x-${i}`,label:`Café ${i}`}))}></lr-locale-picker>`);
  const seam = el as unknown as {searchQuery: string; visibleEntries: unknown[]; normalizeSearch(text: string, locale: string): string};
  seam.searchQuery = 'cafe'; void seam.visibleEntries;
  const calls = countCalls(seam, 'normalizeSearch');
  try {
    for (const query of ['1','12','123']) { seam.searchQuery = query; void seam.visibleEntries; }
    recordScaleMeasurement('lr-locale-picker', 'search@512', {folds:calls.calls});
    expect(calls.calls).to.be.at.most(6);
  } finally { calls.restore(); }
});

it('discloses the explicit locale ceiling and clears it for unset discovery', async () => {
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags .strings=${{localePickerInputLimit:'Locale limit'}}></lr-locale-picker>`);
  el.locales = Array.from({length:513}, (_, i) => `en-x-${i}`);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Locale limit');
  el.locales = undefined; await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('uses a keyed lookup for 512 normalized locale entries', async () => {
  const el = await fixture<LyraLocalePicker>(html`<lr-locale-picker without-flags .locales=${Array.from({length:512}, (_, i) => ({tag:`en-x-${i}`,label:`Row ${i}`}))}></lr-locale-picker>`);
  const seam = el as unknown as {normalizedEntries: unknown[]; entryFor(tag:string): unknown};
  const calls = countCalls(seam.normalizedEntries, 'find');
  try { for(let i=0;i<100;i++) seam.entryFor('en-x-511'); expect(calls.calls).to.equal(0); }
  finally { calls.restore(); }
});
