import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';
async function settle(el: LyraCombobox) { for (let i = 0; i < 3; i++) { await el.updateComplete; await nextFrame(); } }
async function mount() {
  const el = await fixture<LyraCombobox>(html`<lr-combobox label="Choices" multiple></lr-combobox>`);
  const options = Array.from({ length: 1100 }, (_, index) => {
    const option = document.createElement('lr-option'); option.value = String(index); option.label = `Option ${index}`; return option;
  });
  el.append(...options); await Promise.all(options.map(option => option.updateComplete)); await settle(el);
  return { el, options };
}
it('bounds selected-row exceptions at one thousand mounted options', async () => {
  const { el, options } = await mount(); el.value = options.map(option => option.value); el.open = true; await settle(el);
  const mountedRows = el.shadowRoot!.querySelectorAll('[part="option"]').length;
  expect(mountedRows).at.most(1000);
  expect((el.value as string[]).length).equal(1100);
  recordScaleMeasurement('lr-combobox', 'n=1100 selected render cap', { mountedRows });
  await el.hide(); await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).equal(0);
});
it('reuses folded local labels across query changes', async () => {
  const { el, options } = await mount();
  const seam = el as unknown as { query: string; filtered: unknown[] };
  seam.query = 'Option'; void seam.filtered; await settle(el);
  let reads = 0;
  for (const option of options) { const label = option.label; Object.defineProperty(option, 'label', { configurable: true, get() { reads++; return label; } }); }
  try { seam.query = 'Option 1'; void seam.filtered; expect(reads).lessThan(10); recordScaleMeasurement('lr-combobox', 'n=1100 next query folds', { reads }); }
  finally { for (const option of options) Reflect.deleteProperty(option, 'label'); }
});
it('batches selected writes and does not clone closed adornments', async () => {
  const { el, options } = await mount();
  const seam = el as unknown as { setValue: (...args: unknown[]) => void; adornmentsFor: (...args: unknown[]) => unknown };
  const setValue = seam.setValue; const adornments = seam.adornmentsFor;
  let reconciliations = 0; let clones = 0;
  seam.setValue = function(...args) { reconciliations++; setValue.apply(this, args); };
  seam.adornmentsFor = function(...args) { clones++; return adornments.apply(this, args); };
  try {
    for (const option of options.slice(0, 100)) option.selected = true;
    expect(options.slice(0, 100).every(option => option.selected)).equal(true);
    expect(reconciliations).equal(0);
    await settle(el);
    expect((el.value as string[]).length).equal(100); expect(reconciliations).equal(1); expect(clones).equal(0);
    recordScaleMeasurement('lr-combobox', 'n=1100 batch100 closed selected writes', { reconciliations, clones });
  } finally { seam.setValue = setValue; seam.adornmentsFor = adornments; }
});
it('does not rebind plain option labels or observe their ancestors on selected updates', async () => {
  const observe = MutationObserver.prototype.observe;
  let ancestorObservations = 0;
  MutationObserver.prototype.observe = function(target, options) {
    if (target === document.body) ancestorObservations++;
    return observe.call(this, target, options);
  };
  try {
    const { options } = await mount();
    const initialAncestorObservations = ancestorObservations;
    const controllers = options.map(option => (option as unknown as { labelTextObserver: { bind: () => void } }).labelTextObserver);
    let bindings = 0;
    for (const controller of controllers) { const original = controller.bind; controller.bind = function() { bindings++; original.call(this); }; }
    for (const option of options) option.selected = true;
    await Promise.all(options.map(option => option.updateComplete));
    expect(initialAncestorObservations).lessThan(10); expect(bindings).equal(0);
    recordScaleMeasurement('lr-option', 'n=1100 selected label observers', { ancestorObservations: initialAncestorObservations, bindings });
  } finally { MutationObserver.prototype.observe = observe; }
});
it('does not repeat visible-row layout reads for highlight-only updates', async () => {
  const { el } = await mount(); el.visibleOptions = 5; await el.show(); await settle(el);
  const seam = el as unknown as { activeIndex: number; syncVisibleOptionsCap(): void };
  const original = seam.syncVisibleOptionsCap; let measurements = 0;
  seam.syncVisibleOptionsCap = function() { measurements++; original.call(this); };
  try {
    seam.activeIndex = 1; await settle(el);
    expect(measurements).equal(0);
    recordScaleMeasurement('lr-combobox', 'n=1100 highlight layout', { measurements });
  } finally { seam.syncVisibleOptionsCap = original; }
});
