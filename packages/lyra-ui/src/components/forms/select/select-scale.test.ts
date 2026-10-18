import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
async function settle(el: LyraSelect) { for (let i = 0; i < 3; i++) { await el.updateComplete; await nextFrame(); } }
async function mount() {
  const el = await fixture<LyraSelect>(html`<lr-select label="Choices" multiple></lr-select>`);
  const options = Array.from({ length: 1000 }, (_, index) => {
    const option = document.createElement('lr-option'); option.value = String(index); option.label = `Option ${index}`; return option;
  });
  el.append(...options); await Promise.all(options.map(option => option.updateComplete)); await settle(el);
  return { el, options };
}
it('caps one thousand select rows while retaining the selected tail', async () => {
  const { el, options } = await mount();
  options[999]!.disabled = true; el.value = ['999']; el.open = true; await settle(el);
  const rows = el.shadowRoot!.querySelectorAll('[role="option"]');
  expect(rows.length).at.most(201);
  expect([...rows].some(row => row.textContent?.includes('Option 999'))).equal(true);
  recordScaleMeasurement('lr-select', 'n=1000 open default cap', { mountedRows: rows.length });
  await el.hide(); await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[role="option"]').length).equal(0);
});
it('batches one hundred live selected writes against one thousand options', async () => {
  const { el, options } = await mount();
  const seam = el as unknown as { setSelection: (...args: unknown[]) => void };
  const original = seam.setSelection; let reconciliations = 0; let changes = 0;
  seam.setSelection = function(...args) { reconciliations++; original.apply(this, args); };
  el.addEventListener('lr-change', () => changes++);
  for (const option of options.slice(0, 100)) option.selected = true;
  expect(options.slice(0, 100).every(option => option.selected)).equal(true);
  expect(reconciliations).equal(0);
  await settle(el);
  expect(el.selectedOptions.length).equal(100);
  expect(reconciliations).equal(1); expect(changes).equal(0);
  recordScaleMeasurement('lr-select', 'n=1000 batch100 selected writes', { reconciliations, changes });
});
it('indexes committed labels in a thousand-option selection', async () => {
  const { el, options } = await mount();
  el.value = options.map(option => option.value); await settle(el);
  let reads = 0;
  for (const option of options) { const value = option.value; Object.defineProperty(option, 'value', { configurable: true, get() { reads++; return value; } }); }
  try {
    const seam = el as unknown as { labelFor(value: string, occurrence: number): string };
    for (let i = 0; i < 1000; i++) seam.labelFor(String(i), -1);
    expect(reads).lessThan(3000);
    recordScaleMeasurement('lr-select', 'n=1000 committed labels', { reads });
  } finally { for (const option of options) Reflect.deleteProperty(option, 'value'); }
});
it('reuses folded type-ahead labels across keys in a thousand-option batch', async () => {
  const { el, options } = await mount();
  const seam = el as unknown as { typeAhead(char: string): void; typeBuffer: { clear(): void } };
  seam.typeAhead('z'); seam.typeBuffer.clear();
  let reads = 0;
  for (const option of options) { const label = option.label; Object.defineProperty(option, 'label', { configurable: true, get() { reads++; return label; } }); }
  try {
    seam.typeAhead('z'); seam.typeBuffer.clear();
    expect(reads).equal(0);
    recordScaleMeasurement('lr-select', 'n=1000 repeated type-ahead', { reads });
  } finally { for (const option of options) Reflect.deleteProperty(option, 'label'); }
});
