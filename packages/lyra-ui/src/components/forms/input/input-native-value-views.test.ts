import { expect, fixture, html } from '@open-wc/testing';
import './input.js';
import type { LyraInput } from './input.class.js';

describe('lr-input native value views', () => {
  it('reads date and number views from a value written before the next render', async () => {
    const el = await fixture<LyraInput>(html`<lr-input type="date" value="2024-01-01"></lr-input>`);
    el.value = '2024-03-09';
    expect(el.valueAsDate?.toISOString()).to.equal('2024-03-09T00:00:00.000Z');
    el.value = '2024-03-10';
    expect(el.valueAsNumber).to.equal(Date.UTC(2024, 2, 10));
  });

  it('reports no UTC date for an empty date input', async () => {
    const el = await fixture<LyraInput>(html`<lr-input type="date"></lr-input>`);
    expect(el.valueAsUTCDate).to.equal(null);
    el.value = '2024-03-09';
    expect(el.valueAsUTCDate?.getTime()).to.equal(Date.UTC(2024, 2, 9));
  });
});
