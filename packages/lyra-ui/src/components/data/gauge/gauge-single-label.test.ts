import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-gauge.js';
import type { LyraGauge } from '../../lr-gauge.js';

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

it('uses the localized default name for a whitespace-only label', async () => {
  const names: string[] = [];
  for (const shape of ['radial', 'linear'] as const) {
    const element = await fixture<LyraGauge>(html`<lr-gauge shape=${shape} value="40" label="   "></lr-gauge>`);
    names.push(element.getAttribute('aria-label') ?? '');
  }
  expect(names.filter((name) => name.trim() === '')).to.deep.equal([]);
  const reference = await fixture<LyraGauge>(html`<lr-gauge value="40"></lr-gauge>`);
  expect(names[0]).to.equal(reference.getAttribute('aria-label'));
});
