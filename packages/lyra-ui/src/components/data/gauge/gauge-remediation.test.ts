import { expect, fixture, html, waitUntil } from '@open-wc/testing';
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

it('keeps the significant digits of a small value in its caption', async () => {
  const el = await fixture<LyraGauge>(html`<lr-gauge min="0" max="0.001" value="0.0004"></lr-gauge>`);
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim()).to.equal('0.0004');
});

it('paints its track from --lr-gauge-track-color', async () => {
  const el = await fixture<LyraGauge>(html`<lr-gauge value="40" style="--lr-gauge-track-color: rgb(1, 2, 3)"></lr-gauge>`);
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part="track"]')!).stroke).to.equal('rgb(1, 2, 3)');
});

it('keeps generating its role and name after hydrating its own server-rendered attributes', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement & { setHTMLUnsafe(value: string): void };
  container.setHTMLUnsafe('<lr-gauge value="50" label="CPU" role="meter" aria-label="CPU" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"><template shadowrootmode="open"></template></lr-gauge>');
  const el = container.firstElementChild as LyraGauge;
  await waitUntil(() => el.hasUpdated);
  el.value = NaN;
  el.label = 'Memory';
  await el.updateComplete;
  expect([el.getAttribute('role'), el.getAttribute('aria-label')]).to.deep.equal(['img', 'Memory']);
});
