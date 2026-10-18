import { expect, fixture, html } from '@open-wc/testing';
import { LyraCountryPicker } from './country-picker.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
it('does not mount every cold catalog option', async () => {
  const el = await fixture<LyraCountryPicker>(html`<lr-country-picker .countries=${Array.from({length:512},(_,i)=>String.fromCharCode(65+Math.floor(i/26),65+i%26))}></lr-country-picker>`);
  const rows=el.shadowRoot!.querySelectorAll('lr-option').length;
  recordScaleMeasurement('lr-country-picker','closed@512',{rows});
  expect(rows).to.equal(0);
});

it('does not re-admit an owned catalog during localized resolution', async () => {
  const el = await fixture<LyraCountryPicker>(html`<lr-country-picker .countries=${Array.from({length:512},(_,i)=>String.fromCharCode(65+Math.floor(i/26),65+i%26))}></lr-country-picker>`);
  const source=el.countries;
  const original=Object.getOwnPropertyDescriptor; let reads=0;
  Object.getOwnPropertyDescriptor = (target,key) => {if(target===source)reads++;return original(target,key);};
  try {
    (el as unknown as {resolveRows():unknown}).resolveRows();
    recordScaleMeasurement('lr-country-picker','admitted-resolution@512',{reads});
    expect(reads).to.equal(0);
  } finally {Object.getOwnPropertyDescriptor=original;}
});
it('keeps the selected label while cold and refreshes a callback closure during a named update', async () => {
 const el=await fixture<LyraCountryPicker>(html`<lr-country-picker value="FR" .countries=${['FR','GB']}></lr-country-picker>`);
 expect(el.shadowRoot!.querySelectorAll('lr-option').length).to.equal(1);
 expect(el.shadowRoot!.querySelector('lr-option')?.textContent).to.contain('France');
 const seam=el as unknown as {optionDisplay(row: {label:string;code:string}):{label:string;sub:string}};
 const original=seam.optionDisplay;let suffix=' first';
 seam.optionDisplay=function(row){const display=original.call(this,row);return {...display,label:display.label+suffix};};
 el.requestUpdate();await el.updateComplete;
 const option=el.shadowRoot!.querySelector('lr-option') as HTMLElement & {label:string};
 expect(option.label).to.equal('France first');
 suffix=' latest';el.label='Changed';el.requestUpdate();await el.updateComplete;
 expect(option.label).to.equal('France latest');
});
