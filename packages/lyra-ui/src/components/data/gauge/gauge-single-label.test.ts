import { expect, fixture, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge } from './gauge.js';

it('preserves the complete tooltip when only the value or label is present', async () => {
  const full = 'A deliberately long descriptive measurement';
  for (const shape of ['radial', 'ring', 'linear'] as const) {
    const element = await fixture<LyraGauge>(html`<lr-gauge shape=${shape} .valueText=${full}></lr-gauge>`);
    expect(element.shadowRoot!.querySelector('svg title')?.textContent).to.equal(full);
    element.valueText = '';
    element.value = NaN;
    element.label = full;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('svg title')?.textContent).to.equal(full);
  }
});
