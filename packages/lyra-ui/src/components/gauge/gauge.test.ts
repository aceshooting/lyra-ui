import { fixture, expect, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge } from './gauge.js';
import { styles } from './gauge.styles.js';

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

it('clamps the visual fill to [0,1] of the range and stops the arc at the sweep end', async () => {
  const el = (await fixture(html`<lyra-gauge value="200" max="100"></lyra-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement | HTMLElement;
  expect(fill).to.exist;
  // ratio clamps to 1, so the dash pattern must be fully revealed (offset 0) —
  // i.e. the fill arc actually stops at the sweep's end point, not just "exists".
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.equal(0);
});

it('drives the radial fill via a fixed-length dasharray with dashoffset derived from ratio', async () => {
  const el = (await fixture(
    html`<lyra-gauge value="0" min="0" max="100"></lyra-gauge>`,
  )) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement;
  const arcLength = (270 / 360) * 2 * Math.PI * 40;

  // At ratio 0 the fill must be fully hidden (offset == full arc length).
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(arcLength, 0.001);
  expect(Number(fill.getAttribute('stroke-dasharray'))).to.be.closeTo(arcLength, 0.001);

  el.value = 50;
  await el.updateComplete;
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(arcLength * 0.5, 0.001);
  // the `d` geometry itself must stay constant across value updates —
  // only stroke-dashoffset should change.
  const dAtHalf = fill.getAttribute('d');

  el.value = 90;
  await el.updateComplete;
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(arcLength * 0.1, 0.001);
  expect(fill.getAttribute('d')).to.equal(dAtHalf);
});

it('drives the linear fill via a fixed-length dasharray with dashoffset derived from ratio', async () => {
  const el = (await fixture(
    html`<lyra-gauge type="linear" value="0" min="0" max="100"></lyra-gauge>`,
  )) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGLineElement;

  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(100, 0.001);
  expect(Number(fill.getAttribute('stroke-dasharray'))).to.be.closeTo(100, 0.001);

  el.value = 25;
  await el.updateComplete;
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(75, 0.001);
  const x2AtQuarter = fill.getAttribute('x2');

  el.value = 60;
  await el.updateComplete;
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(40, 0.001);
  // x2 stays fixed now — the dashoffset carries the animated progress instead.
  expect(fill.getAttribute('x2')).to.equal(x2AtQuarter);
});

it('transitions the fill stroke-dashoffset using the shared transition token, disabled under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include('transition: stroke-dashoffset var(--lyra-transition-base);');
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='fill'] { transition: none !important; } }",
  );
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

it('sets aria-valuetext from valueLabel and clears it when unset', async () => {
  const el = (await fixture(html`<lyra-gauge value="72" max="100"></lyra-gauge>`)) as LyraGauge;
  expect(el.hasAttribute('aria-valuetext')).to.be.false;

  el.valueLabel = '72°F';
  await el.updateComplete;
  expect(el.getAttribute('aria-valuetext')).to.equal('72°F');

  el.valueLabel = undefined;
  await el.updateComplete;
  expect(el.hasAttribute('aria-valuetext')).to.be.false;
});

it('hides the SVG value/label text from the accessibility tree in both radial and linear modes', async () => {
  const radial = (await fixture(
    html`<lyra-gauge value="30" max="100" label="CPU"></lyra-gauge>`,
  )) as LyraGauge;
  const radialValue = radial.shadowRoot!.querySelector('[part="value"]')!;
  const radialLabel = radial.shadowRoot!.querySelector('[part="label"]')!;
  expect(radialValue.getAttribute('aria-hidden')).to.equal('true');
  expect(radialLabel.getAttribute('aria-hidden')).to.equal('true');

  const linear = (await fixture(
    html`<lyra-gauge type="linear" value="30" max="100" label="CPU"></lyra-gauge>`,
  )) as LyraGauge;
  const linearValue = linear.shadowRoot!.querySelector('[part="value"]')!;
  const linearLabel = linear.shadowRoot!.querySelector('[part="label"]')!;
  expect(linearValue.getAttribute('aria-hidden')).to.equal('true');
  expect(linearLabel.getAttribute('aria-hidden')).to.equal('true');
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
