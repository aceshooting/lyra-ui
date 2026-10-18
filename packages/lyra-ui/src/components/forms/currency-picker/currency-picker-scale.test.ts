import { LyraCurrencyPicker } from './currency-picker.js';
import { expect, fixture, html } from '@open-wc/testing';
import { DEFAULT_CURRENCY_ENTRIES } from './currency-catalog.js';
import { resolveCurrencyPresentation } from './currency-presentation.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('reuses presentation work after resolving all 176 default currencies', () => {
  resolveCurrencyPresentation(DEFAULT_CURRENCY_ENTRIES, 'en');
  const original = Intl.NumberFormat;
  let constructions = 0;
  Intl.NumberFormat = new Proxy(original, {construct(target,args) { constructions++; return Reflect.construct(target,args); }});
  try {
    const rows = resolveCurrencyPresentation(DEFAULT_CURRENCY_ENTRIES, 'en');
    expect(rows.length).to.equal(176);
    recordScaleMeasurement('lr-currency-picker', 'presentation@176', {constructions});
    expect(constructions).to.equal(0);
  } finally { Intl.NumberFormat = original; }
});

it('does not mount the default catalog before interaction', async () => {
 const el=await fixture<LyraCurrencyPicker>(html`<lr-currency-picker></lr-currency-picker>`);
 const rows=el.shadowRoot!.querySelectorAll('lr-option').length;
 recordScaleMeasurement('lr-currency-picker','closed@176',{rows});
 expect(rows).to.equal(0);
});
