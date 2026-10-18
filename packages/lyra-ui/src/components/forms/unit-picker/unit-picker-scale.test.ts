import { expect, fixture, html } from '@open-wc/testing';
import { LyraUnitPicker } from './unit-picker.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('does not mount every cold catalog option', async () => {
  const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker .units=${Array.from({length:1000},(_,i)=>`custom-${i}`)}></lr-unit-picker>`);
  const rows=el.shadowRoot!.querySelectorAll('lr-option').length;
  recordScaleMeasurement('lr-unit-picker','closed@1000',{rows});
  expect(rows).to.equal(0);
});

it('does not re-admit an owned catalog during localized resolution', async () => {
  const el = await fixture<LyraUnitPicker>(html`<lr-unit-picker .units=${Array.from({length:1000},(_,i)=>`custom-${i}`)}></lr-unit-picker>`);
  const source=el.units;
  const original=Object.getOwnPropertyDescriptor; let reads=0;
  Object.getOwnPropertyDescriptor = (target,key) => {if(target===source)reads++;return original(target,key);};
  try {
    (el as unknown as {resolveRows():unknown}).resolveRows();
    recordScaleMeasurement('lr-unit-picker','admitted-resolution@1000',{reads});
    expect(reads).to.equal(0);
  } finally {Object.getOwnPropertyDescriptor=original;}
});
