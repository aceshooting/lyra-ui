import { fixture, expect, html } from '@open-wc/testing';
import './stat.js';
import type { LyraStat } from './stat.js';

it('renders label, value, and unit', async () => {
  const el = (await fixture(
    html`<lyra-stat label="Revenue" value="12.4" unit="k€"></lyra-stat>`,
  )) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal('Revenue');
  expect(el.shadowRoot!.querySelector('[part="value"]')!.textContent!.trim()).to.equal('12.4');
  expect(el.shadowRoot!.querySelector('[part="unit"]')!.textContent).to.equal('k€');
});

it('hides the trend pill when trend is NaN, shows it with direction otherwise', async () => {
  const el = (await fixture(html`<lyra-stat label="x" value="1"></lyra-stat>`)) as LyraStat;
  expect(el.shadowRoot!.querySelector('[part="trend"]')).to.not.exist;

  el.trend = -12.5;
  await el.updateComplete;
  const trend = el.shadowRoot!.querySelector('[part="trend"]')!;
  expect(trend.textContent).to.contain('12.5%');
  expect(trend.getAttribute('data-direction')).to.equal('down');
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-stat label="Revenue" value="12.4" trend="3"></lyra-stat>`,
  )) as LyraStat;
  await expect(el).to.be.accessible();
});
