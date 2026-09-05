import { expect, fixture, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge } from './gauge.js';

for (const shape of ['radial', 'linear', 'ring'] as const) {
  it(`removes label safely from the ${shape} SVG and semantic owner with localized fallback`, async () => {
    const element = await fixture<LyraGauge>(html`<lr-gauge shape=${shape} label="Before" value="42"></lr-gauge>`);
    expect(element.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('Before');
    element.removeAttribute('label');
    await element.updateComplete;
    expect(element.label as unknown).to.equal(null);
    expect(element.shadowRoot!.querySelectorAll('[part="label"]').length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="value"]')?.textContent).to.equal('42');
    expect(element.shadowRoot!.querySelectorAll('svg title').length).to.equal(0);
    expect(element.getAttribute('role')).to.equal('meter');
    expect(element.getAttribute('aria-label')).to.equal('Gauge');
    element.strings = { gaugeLabel: 'Localized gauge' };
    await element.updateComplete;
    expect(element.getAttribute('aria-label')).to.equal('Localized gauge');
    element.setAttribute('label', '');
    await element.updateComplete;
    expect(element.label).to.equal('');
    expect(element.shadowRoot!.querySelectorAll('[part="label"]').length).to.equal(0);
    element.setAttribute('label', 'After');
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal('After');
    expect(element.getAttribute('aria-label')).to.equal('After');
    element.setAttribute('aria-label', 'Author name');
    element.removeAttribute('label');
    await element.updateComplete;
    expect(element.getAttribute('aria-label')).to.equal('Author name');
  });
}
