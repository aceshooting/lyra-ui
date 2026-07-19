import { fixture, expect, html } from '@open-wc/testing';
import './gauge.js';
import type { LyraGauge } from './gauge.js';
import { styles } from './gauge.styles.js';

it('reflects value/min/max as ARIA meter attributes', async () => {
  const el = (await fixture(
    html`<lr-gauge value="30" min="0" max="50" label="CPU"></lr-gauge>`,
  )) as LyraGauge;
  expect(el.getAttribute('role')).to.equal('meter');
  expect(el.getAttribute('aria-valuenow')).to.equal('30');
  expect(el.getAttribute('aria-valuemin')).to.equal('0');
  expect(el.getAttribute('aria-valuemax')).to.equal('50');
  expect(el.getAttribute('aria-label')).to.equal('CPU');
});

it('preserves an explicit host accessible name instead of replacing it with the visible label', async () => {
  const el = (await fixture(html`
    <lr-gauge aria-label="Overall quality score" label="Score" value="82"></lr-gauge>
  `)) as LyraGauge;

  expect(el.getAttribute('aria-label')).to.equal('Overall quality score');
});

it('normalizes a reversed min > max domain in aria-value* so it agrees with the visual fill instead of pinning aria-valuenow', async () => {
  const lowValue = (await fixture(
    html`<lr-gauge value="5" min="100" max="0"></lr-gauge>`,
  )) as LyraGauge;
  expect(lowValue.getAttribute('aria-valuemin')).to.equal('0');
  expect(lowValue.getAttribute('aria-valuemax')).to.equal('100');
  expect(lowValue.getAttribute('aria-valuenow')).to.equal('5');

  const highValue = (await fixture(
    html`<lr-gauge value="70" min="100" max="0"></lr-gauge>`,
  )) as LyraGauge;
  // Previously pinned to `max` (0) regardless of `value` -- now tracks the
  // normalized domain, matching `ratio`'s own normalization.
  expect(highValue.getAttribute('aria-valuenow')).to.equal('70');
});

it('clamps the visual fill to [0,1] of the range and stops the arc at the sweep end', async () => {
  const el = (await fixture(html`<lr-gauge value="200" max="100"></lr-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement | HTMLElement;
  expect(fill).to.exist;
  // ratio clamps to 1, so the dash pattern must be fully revealed (offset 0) —
  // i.e. the fill arc actually stops at the sweep's end point, not just "exists".
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.equal(0);
  // aria-valuenow must stay within [aria-valuemin, aria-valuemax] like the visual fill —
  // an out-of-range value announced verbatim is an invalid ARIA meter state.
  expect(el.getAttribute('aria-valuenow')).to.equal('100');
});

it('accounts for a nonzero min when computing the fill ratio', async () => {
  const el = (await fixture(html`<lr-gauge value="30" min="20" max="40"></lr-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement;
  const arcLength = (270 / 360) * 2 * Math.PI * 40;

  // ratio = (30 - 20) / (40 - 20) = 0.5
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(arcLength * 0.5, 0.001);

  el.value = 15; // below min -> ratio clamps to 0, not a negative/overshot dashoffset
  await el.updateComplete;
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(arcLength, 0.001);
});

it('guards against a degenerate min===max range instead of a NaN/Infinity dashoffset', async () => {
  const el = (await fixture(html`<lr-gauge value="50" min="50" max="50"></lr-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement;

  const dashoffset = Number(fill.getAttribute('stroke-dashoffset'));
  expect(dashoffset).to.not.be.NaN;
  expect(Number.isFinite(dashoffset)).to.be.true;
});

it('guards against a NaN/undefined value instead of leaking "NaN" into aria-valuenow and stroke-dashoffset', async () => {
  const el = (await fixture(html`<lr-gauge value="30" max="100"></lr-gauge>`)) as LyraGauge;
  el.value = undefined as unknown as number;
  await el.updateComplete;

  expect(el.hasAttribute('aria-valuenow')).to.be.false;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGPathElement;
  expect(fill.getAttribute('stroke-dashoffset')).to.not.equal('NaN');
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.not.be.NaN;
});

it('renders a finite dashoffset instead of NaN when max is Infinity', async () => {
  const el = (await fixture(html`<lr-gauge value="5" max="Infinity"></lr-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]')!;
  expect(fill.getAttribute('stroke-dashoffset')).to.not.include('NaN');
});

it('blanks the value part instead of printing the literal word when value is Infinity or -Infinity', async () => {
  const positive = (await fixture(html`<lr-gauge value="Infinity" max="100"></lr-gauge>`)) as LyraGauge;
  const positiveValue = positive.shadowRoot!.querySelector('[part="value"]')!;
  expect(positiveValue.textContent).to.equal('');

  const negative = (await fixture(html`<lr-gauge value="-Infinity" max="100"></lr-gauge>`)) as LyraGauge;
  const negativeValue = negative.shadowRoot!.querySelector('[part="value"]')!;
  expect(negativeValue.textContent).to.equal('');
});

it('does not emit an Infinity aria-valuemax', async () => {
  const el = (await fixture(html`<lr-gauge value="5" max="Infinity"></lr-gauge>`)) as LyraGauge;
  expect(el.getAttribute('aria-valuemax')).to.not.equal('Infinity');
});

it('treats a reversed min > max as an empty/zero ratio instead of a negative one', async () => {
  const el = (await fixture(html`<lr-gauge value="5" min="100" max="0"></lr-gauge>`)) as LyraGauge;
  const fill = el.shadowRoot!.querySelector('[part="fill"]')!;
  const dashoffset = Number(fill.getAttribute('stroke-dashoffset'));
  expect(dashoffset).to.be.at.least(0);
});

it('drives the radial fill via a fixed-length dasharray with dashoffset derived from ratio', async () => {
  const el = (await fixture(
    html`<lr-gauge value="0" min="0" max="100"></lr-gauge>`,
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
    html`<lr-gauge type="linear" value="0" min="0" max="100"></lr-gauge>`,
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
  expect(css).to.include('transition: stroke-dashoffset var(--lr-transition-base);');
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='fill'] { transition: none !important; } }",
  );
});

it('renders a linear track when type is linear', async () => {
  const el = (await fixture(
    html`<lr-gauge type="linear" value="10" max="100" label="Battery"></lr-gauge>`,
  )) as LyraGauge;
  expect(el.shadowRoot!.querySelector('[part="track"]')).to.exist;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]');
  const labelEl = el.shadowRoot!.querySelector('[part="label"]');
  expect(valueEl).to.exist;
  expect(valueEl!.textContent).to.equal('10');
  expect(labelEl).to.exist;
  expect(labelEl!.textContent).to.equal('Battery');
});

it('renders a full-circle ring with circumference-based progress when type is ring', async () => {
  const el = (await fixture(
    html`<lr-gauge type="ring" value="25" max="100" label="Score"></lr-gauge>`,
  )) as LyraGauge;
  const track = el.shadowRoot!.querySelector('[part="track"]') as SVGCircleElement;
  const fill = el.shadowRoot!.querySelector('[part="fill"]') as SVGCircleElement;
  const circumference = 2 * Math.PI * 40;
  expect(track.tagName.toLowerCase()).to.equal('circle');
  expect(Number(fill.getAttribute('stroke-dasharray'))).to.be.closeTo(circumference, 0.001);
  expect(Number(fill.getAttribute('stroke-dashoffset'))).to.be.closeTo(circumference * 0.75, 0.001);
  expect(fill.getAttribute('transform')).to.equal('rotate(-90 50 50)');
});

it('exposes a per-instance gauge fill token for radial, ring, and linear variants', () => {
  expect(styles.cssText).to.include('stroke: var(--lr-gauge-fill, var(--lr-color-brand))');
});

it('omits the label part in linear mode when label is empty', async () => {
  const el = (await fixture(
    html`<lr-gauge type="linear" value="5" max="100"></lr-gauge>`,
  )) as LyraGauge;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('exposes a base part on the render root for both radial and linear', async () => {
  const radial = (await fixture(html`<lr-gauge></lr-gauge>`)) as LyraGauge;
  expect(radial.shadowRoot!.querySelector('[part="base"]')).to.exist;

  const linear = (await fixture(html`<lr-gauge type="linear"></lr-gauge>`)) as LyraGauge;
  expect(linear.shadowRoot!.querySelector('[part="base"]')).to.exist;
});

it('sets aria-valuetext from valueLabel and clears it when unset', async () => {
  const el = (await fixture(html`<lr-gauge value="72" max="100"></lr-gauge>`)) as LyraGauge;
  expect(el.hasAttribute('aria-valuetext')).to.be.false;

  el.valueLabel = '72°F';
  await el.updateComplete;
  expect(el.getAttribute('aria-valuetext')).to.equal('72°F');

  el.valueLabel = undefined;
  await el.updateComplete;
  expect(el.hasAttribute('aria-valuetext')).to.be.false;
});

it('falls back to the numeric value when valueLabel is cleared to an empty string', async () => {
  const el = (await fixture(html`<lr-gauge value="72" max="100"></lr-gauge>`)) as LyraGauge;
  el.valueLabel = '72°F';
  await el.updateComplete;

  el.valueLabel = '';
  await el.updateComplete;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]')!;
  expect(valueEl.textContent).to.equal('72');
  expect(el.hasAttribute('aria-valuetext')).to.be.false;
});

it('hides the SVG value/label text from the accessibility tree in both radial and linear modes', async () => {
  const radial = (await fixture(
    html`<lr-gauge value="30" max="100" label="CPU"></lr-gauge>`,
  )) as LyraGauge;
  const radialValue = radial.shadowRoot!.querySelector('[part="value"]')!;
  const radialLabel = radial.shadowRoot!.querySelector('[part="label"]')!;
  expect(radialValue.getAttribute('aria-hidden')).to.equal('true');
  expect(radialLabel.getAttribute('aria-hidden')).to.equal('true');

  const linear = (await fixture(
    html`<lr-gauge type="linear" value="30" max="100" label="CPU"></lr-gauge>`,
  )) as LyraGauge;
  const linearValue = linear.shadowRoot!.querySelector('[part="value"]')!;
  const linearLabel = linear.shadowRoot!.querySelector('[part="label"]')!;
  expect(linearValue.getAttribute('aria-hidden')).to.equal('true');
  expect(linearLabel.getAttribute('aria-hidden')).to.equal('true');
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-gauge value="30" max="100" label="CPU"></lr-gauge>`,
  )) as LyraGauge;
  await expect(el).to.be.accessible();
});

it('is accessible in linear mode', async () => {
  const el = (await fixture(
    html`<lr-gauge type="linear" value="30" max="100" label="CPU"></lr-gauge>`,
  )) as LyraGauge;
  await expect(el).to.be.accessible();
});

it('keeps the linear label/value text inside the 0..100 x range under RTL instead of double-flipping text-anchor', async () => {
  const wrapper = (await fixture(html`
    <div dir="rtl"><lr-gauge type="linear" label="Battery" value="50" max="100"></lr-gauge></div>
  `)) as HTMLElement;
  const el = wrapper.querySelector('lr-gauge') as LyraGauge;
  await el.updateComplete;
  const labelEl = el.shadowRoot!.querySelector('[part="label"]') as unknown as SVGTextElement;
  const valueEl = el.shadowRoot!.querySelector('[part="value"]') as unknown as SVGTextElement;

  // The stylesheet's text-anchor already mirrors via the inherited `direction` --
  // an inline style here would double-flip it and push the text outside the viewBox.
  expect(labelEl.getAttribute('style')).to.be.null;
  expect(valueEl.getAttribute('style')).to.be.null;

  const labelBox = labelEl.getBBox();
  const valueBox = valueEl.getBBox();
  // A double-flipped text-anchor pushes the whole string (tens of units wide) off
  // the 0..100 viewBox; a 1-unit margin only tolerates ordinary glyph-metrics
  // overshoot (side bearings/anti-aliasing) at the anchor point itself.
  expect(labelBox.x).to.be.at.least(-1);
  expect(labelBox.x + labelBox.width).to.be.at.most(101);
  expect(valueBox.x).to.be.at.least(-1);
  expect(valueBox.x + valueBox.width).to.be.at.most(101);
});
