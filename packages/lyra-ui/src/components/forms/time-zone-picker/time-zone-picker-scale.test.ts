import { expect, fixture, html } from '@open-wc/testing';
import { LyraTimeZonePicker } from './time-zone-picker.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('does not mount every cold catalog option', async () => {
  const el = await fixture<LyraTimeZonePicker>(html`<lr-time-zone-picker .timeZones=${Array.from({length:1000},(_,i)=>`Custom/Zone${i}`)}></lr-time-zone-picker>`);
  const rows=el.shadowRoot!.querySelectorAll('lr-option').length;
  recordScaleMeasurement('lr-time-zone-picker','closed@1000',{rows});
  expect(rows).to.equal(0);
});
