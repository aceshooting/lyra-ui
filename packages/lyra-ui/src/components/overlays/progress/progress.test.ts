import { fixture, expect, html } from '@open-wc/testing';
import './progress-bar.js';
import './progress-ring.js';
import type { LyraProgressBar } from './progress-bar.js';
import { ringStyles } from './progress.styles.js';

it('renders determinate progress with a bounded value', async () => {
  const el = (await fixture(html`<lr-progress-bar value="25" max="50"></lr-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-valuenow')).to.equal('25');
  expect(base.querySelector('[part="indicator"]')?.getAttribute('style')).to.contain('50%');
  await expect(el).to.be.accessible();
});

it('shows the computed percent, not the raw value, in the show-value label when max is not 100', async () => {
  const el = (await fixture(
    html`<lr-progress-bar value="25" max="50" show-value></lr-progress-bar>`,
  )) as LyraProgressBar;
  const label = el.shadowRoot!.querySelector('[part="label"] span');
  expect(label?.textContent).to.equal('50%');
});

it('locale-formats visible percentage output and forwards live host naming to both progress roles', async () => {
  const bar = (await fixture(
    html`<lr-progress-bar lang="ar" value="25" max="50" show-value aria-label="Upload"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const barBase = bar.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(bar.shadowRoot!.querySelector('[part="label"] span')?.textContent).to.equal(
    new Intl.NumberFormat('ar', { style: 'percent', maximumFractionDigits: 0 }).format(0.5),
  );
  expect(barBase.getAttribute('aria-label')).to.equal('Upload');
  bar.setAttribute('aria-label', 'Download');
  await bar.updateComplete;
  expect(barBase.getAttribute('aria-label')).to.equal('Download');

  const ring = await fixture(html`<lr-progress-ring lang="de" value="25" max="50" aria-label="Sync"></lr-progress-ring>`);
  const ringBase = ring.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(ring.shadowRoot!.querySelector('[part="label"]')?.textContent).to.equal(
    new Intl.NumberFormat('de', { style: 'percent', maximumFractionDigits: 0 }).format(0.5),
  );
  expect(ringBase.getAttribute('aria-label')).to.equal('Sync');
});

it('applies --lr-progress-height to the track', async () => {
  const el = (await fixture(
    html`<lr-progress-bar style="--lr-progress-height: 10px"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
  expect(getComputedStyle(track).blockSize).to.equal('10px');
});

it('omits aria-valuenow for indeterminate progress', async () => {
  const el = (await fixture(html`<lr-progress-bar indeterminate></lr-progress-bar>`)) as LyraProgressBar;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-valuenow')).to.be.false;
});

it('mirrors the indeterminate bar sweep under dir="rtl" with reversed keyframes', async () => {
  const ltr = (await fixture(html`<lr-progress-bar indeterminate></lr-progress-bar>`)) as LyraProgressBar;
  const ltrIndicator = ltr.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(ltrIndicator).animationName).to.equal('lr-progress-slide');

  // translateX keyframes are physical, so the RTL sweep needs its own mirrored keyframes to
  // travel end-to-start (the indicator's static position is right-anchored under RTL).
  const rtl = (await fixture(
    html`<lr-progress-bar indeterminate dir="rtl"></lr-progress-bar>`,
  )) as LyraProgressBar;
  const rtlIndicator = rtl.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(rtlIndicator).animationName).to.equal('lr-progress-slide-rtl');
});

it('anchors the determinate fill to the inline-start edge, mirroring under dir="rtl"', async () => {
  const wrapper = (await fixture(
    html`<div dir="rtl" style="inline-size:200px"><lr-progress-bar value="25"></lr-progress-bar></div>`,
  )) as HTMLDivElement;
  const bar = wrapper.querySelector('lr-progress-bar') as LyraProgressBar;
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
  const el = await fixture(html`<lr-progress-ring value="40"></lr-progress-ring>`);
  await expect(el).to.be.accessible();
});

it('guards against a non-finite or non-positive max (would otherwise divide by zero / render aria-valuemax="NaN")', async () => {
  const nanMax = (await fixture(html`<lr-progress-bar max="abc" value="25"></lr-progress-bar>`)) as LyraProgressBar;
  const nanBase = nanMax.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(nanBase.getAttribute('aria-valuemax')).to.equal('100');
  expect(nanBase.querySelector('[part="indicator"]')?.getAttribute('style')).to.not.contain('NaN');

  const zeroMax = (await fixture(html`<lr-progress-bar max="0" value="25"></lr-progress-bar>`)) as LyraProgressBar;
  const zeroBase = zeroMax.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(zeroBase.getAttribute('aria-valuemax')).to.equal('100');

  const ring = await fixture(html`<lr-progress-ring max="-10" value="25"></lr-progress-ring>`);
  expect(ring.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuemax')).to.equal('100');
});

it('clamps an out-of-range or non-finite value to [0, max] for progress-bar and progress-ring', async () => {
  const negative = (await fixture(html`<lr-progress-bar value="-10" max="50"></lr-progress-bar>`)) as LyraProgressBar;
  expect(negative.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('0');

  const over = (await fixture(html`<lr-progress-bar value="9999" max="50"></lr-progress-bar>`)) as LyraProgressBar;
  expect(over.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('50');

  const nan = (await fixture(html`<lr-progress-bar max="50"></lr-progress-bar>`)) as LyraProgressBar;
  nan.value = NaN;
  await nan.updateComplete;
  expect(nan.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('0');
  expect(nan.shadowRoot!.querySelector('[part="indicator"]')?.getAttribute('style')).to.not.contain('NaN');

  const ring = await fixture(html`<lr-progress-ring value="9999" max="50"></lr-progress-ring>`);
  expect(ring.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-valuenow')).to.equal('50');
});

it('spins the indeterminate ring indicator and disables the animation under prefers-reduced-motion', async () => {
  const el = await fixture(html`<lr-progress-ring indeterminate></lr-progress-ring>`);
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(indicator).animationName).to.equal('lr-progress-ring-spin');
  expect(ringStyles.cssText).to.match(
    /@media \(prefers-reduced-motion: reduce\) \{[^}]*\[part='indicator'\][^}]*animation: none !important/,
  );
});

it('inherits the shared ambient timing token for indeterminate bar and ring motion', async () => {
  const bar = await fixture(
    html`<lr-progress-bar indeterminate style="--lr-transition-ambient: 3s linear"></lr-progress-bar>`,
  );
  const barIndicator = bar.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(barIndicator).animationDuration).to.equal('3s');
  expect(getComputedStyle(barIndicator).animationTimingFunction).to.equal('linear');

  const ring = await fixture(
    html`<lr-progress-ring indeterminate style="--lr-transition-ambient: 2.5s linear"></lr-progress-ring>`,
  );
  const ringIndicator = ring.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  expect(getComputedStyle(ringIndicator).animationDuration).to.equal('2.5s');
  expect(getComputedStyle(ringIndicator).animationTimingFunction).to.equal('linear');
});
