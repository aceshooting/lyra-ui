import { fixture, expect, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge } from './gauge.js';

it('reflects value/min/max as ARIA meter attributes', async () => {
  const el = (await fixture(
    html`<lyra-gauge value="30" min="0" max="50" label="CPU"></lyra-gauge>`,
  )) as LyraGauge;
  expect(el.getAttribute('role')).to.equal('meter');
  expect(el.getAttribute('aria-valuenow')).to.equal('30');
  expect(el.getAttribute('aria-valuemin')).to.equal('0');
  expect(el.getAttribute('aria-valuemax')).to.equal('50');
  expect(el.getAttribute('aria-label')).to.equal('CPU');
});

it('clamps the visual fill to [0,1] of the range', async () => {
  const el = (await fixture(html`<lyra-gauge value="200" max="100"></lyra-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement | HTMLElement;
  expect(fill).to.exist;
});

it('renders a linear track when type is linear', async () => {
  const el = (await fixture(
    html`<lyra-gauge type="linear" value="10" max="100"></lyra-gauge>`,
  )) as LyraGauge;
  expect(el.shadowRoot!.querySelector('[part="track"]')).to.exist;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-gauge value="30" max="100" label="CPU"></lyra-gauge>`,
  )) as LyraGauge;
  await expect(el).to.be.accessible();
});
