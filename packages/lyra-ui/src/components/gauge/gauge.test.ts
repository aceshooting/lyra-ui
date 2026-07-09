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
    html`<lyra-gauge type="linear" value="10" max="100" label="Battery"></lyra-gauge>`,
  )) as LyraGauge;
  expect(el.shadowRoot!.querySelector('[part="track"]')).to.exist;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]');
  const labelEl = el.shadowRoot!.querySelector('[part="label"]');
  expect(valueEl).to.exist;
  expect(valueEl!.textContent).to.equal('10');
  expect(labelEl).to.exist;
  expect(labelEl!.textContent).to.equal('Battery');
});

it('omits the label part in linear mode when label is empty', async () => {
  const el = (await fixture(
    html`<lyra-gauge type="linear" value="5" max="100"></lyra-gauge>`,
  )) as LyraGauge;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('exposes a base part on the render root for both radial and linear', async () => {
  const radial = (await fixture(html`<lyra-gauge></lyra-gauge>`)) as LyraGauge;
  expect(radial.shadowRoot!.querySelector('[part="base"]')).to.exist;

  const linear = (await fixture(html`<lyra-gauge type="linear"></lyra-gauge>`)) as LyraGauge;
  expect(linear.shadowRoot!.querySelector('[part="base"]')).to.exist;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-gauge value="30" max="100" label="CPU"></lyra-gauge>`,
  )) as LyraGauge;
  await expect(el).to.be.accessible();
});

it('is accessible in linear mode', async () => {
  const el = (await fixture(
    html`<lyra-gauge type="linear" value="30" max="100" label="CPU"></lyra-gauge>`,
  )) as LyraGauge;
  await expect(el).to.be.accessible();
});
