import { fixture, expect, html } from '@open-wc/testing';
import './progress-bar.js';
import './progress-ring.js';
import type { LyraProgressBar } from './progress-bar.js';
import { ringStyles } from './progress.styles.js';

it('renders determinate progress with a bounded value', async () => {
  const el = (await fixture(html`<lyra-progress-bar value="25" max="50"></lyra-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-valuenow')).to.equal('25');
  expect(base.querySelector('[part="indicator"]')?.getAttribute('style')).to.contain('50%');
  await expect(el).to.be.accessible();
});

it('shows the computed percent, not the raw value, in the show-value label when max is not 100', async () => {
  const el = (await fixture(
    html`<lyra-progress-bar value="25" max="50" show-value></lyra-progress-bar>`,
  )) as LyraProgressBar;
  const label = el.shadowRoot!.querySelector('[part="label"] span');
  expect(label?.textContent).to.equal('50%');
});

it('omits aria-valuenow for indeterminate progress', async () => {
  const el = (await fixture(html`<lyra-progress-bar indeterminate></lyra-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-valuenow')).to.be.false;
});

it('mirrors the indeterminate bar sweep under dir="rtl" with reversed keyframes', async () => {
  const ltr = (await fixture(html`<lyra-progress-bar indeterminate></lyra-progress-bar>`)) as LyraProgressBar;
  const ltrIndicator = ltr.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(ltrIndicator).animationName).to.equal('lyra-progress-slide');

  // translateX keyframes are physical, so the RTL sweep needs its own mirrored keyframes to
  // travel end-to-start (the indicator's static position is right-anchored under RTL).
  const rtl = (await fixture(
    html`<lyra-progress-bar indeterminate dir="rtl"></lyra-progress-bar>`,
  )) as LyraProgressBar;
  const rtlIndicator = rtl.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(rtlIndicator).animationName).to.equal('lyra-progress-slide-rtl');
});

it('anchors the determinate fill to the inline-start edge, mirroring under dir="rtl"', async () => {
  const wrapper = (await fixture(
    html`<div dir="rtl" style="inline-size:200px"><lyra-progress-bar value="25"></lyra-progress-bar></div>`,
  )) as HTMLDivElement;
  const bar = wrapper.querySelector('lyra-progress-bar') as LyraProgressBar;
  await bar.updateComplete;
  const track = bar.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  const indicator = bar.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  // The determinate indicator is a plain block box sized by inline-size, so it lines up with
  // the track's physical right edge under RTL with no extra CSS.
  expect(
    Math.abs(indicator.getBoundingClientRect().right - track.getBoundingClientRect().right),
  ).to.be.lessThan(1);
  expect(indicator.getBoundingClientRect().width).to.be.closeTo(track.getBoundingClientRect().width * 0.25, 1);
});

it('renders an accessible progress ring', async () => {
  const el = await fixture(html`<lyra-progress-ring value="40"></lyra-progress-ring>`);
  await expect(el).to.be.accessible();
});

it('guards against a non-finite or non-positive max (would otherwise divide by zero / render aria-valuemax="NaN")', async () => {
  const nanMax = (await fixture(html`<lyra-progress-bar max="abc" value="25"></lyra-progress-bar>`)) as LyraProgressBar;
  const nanBase = nanMax.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(nanBase.getAttribute('aria-valuemax')).to.equal('100');
  expect(nanBase.querySelector('[part="indicator"]')?.getAttribute('style')).to.not.contain('NaN');

  const zeroMax = (await fixture(html`<lyra-progress-bar max="0" value="25"></lyra-progress-bar>`)) as LyraProgressBar;
  const zeroBase = zeroMax.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(zeroBase.getAttribute('aria-valuemax')).to.equal('100');

  const ring = await fixture(html`<lyra-progress-ring max="-10" value="25"></lyra-progress-ring>`);
  expect(ring.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuemax')).to.equal('100');
});

it('clamps an out-of-range or non-finite value to [0, max] for progress-bar and progress-ring', async () => {
  const negative = (await fixture(html`<lyra-progress-bar value="-10" max="50"></lyra-progress-bar>`)) as LyraProgressBar;
  expect(negative.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('0');

  const over = (await fixture(html`<lyra-progress-bar value="9999" max="50"></lyra-progress-bar>`)) as LyraProgressBar;
  expect(over.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('50');

  const nan = (await fixture(html`<lyra-progress-bar max="50"></lyra-progress-bar>`)) as LyraProgressBar;
  nan.value = NaN;
  await nan.updateComplete;
  expect(nan.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('0');
  expect(nan.shadowRoot!.querySelector('[part="indicator"]')?.getAttribute('style')).to.not.contain('NaN');

  const ring = await fixture(html`<lyra-progress-ring value="9999" max="50"></lyra-progress-ring>`);
  expect(ring.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('50');
});

it('spins the indeterminate ring indicator and disables the animation under prefers-reduced-motion', async () => {
  const el = await fixture(html`<lyra-progress-ring indeterminate></lyra-progress-ring>`);
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(indicator).animationName).to.equal('lyra-progress-ring-spin');
  expect(ringStyles.cssText).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^}]*\[part='indicator'\][^}]*animation: none !important/,
  );
});
