import { fixture, expect, html } from '@open-wc/testing';
import './skeleton.js';
import type { LyraSkeleton } from './skeleton.js';
import { styles } from './skeleton.styles.js';

it('defaults to a text variant with a status role', async () => {
  const el = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  expect(el.variant).to.equal('text');
  expect(el.getAttribute('role')).to.equal('status');
});

it('applies explicit width/height as inline custom properties on the host', async () => {
  const el = (await fixture(
    html`<lr-skeleton variant="circle" width="3rem" height="3rem"></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(el.style.getPropertyValue('--lr-skeleton-w')).to.equal('3rem');
  expect(el.style.getPropertyValue('--lr-skeleton-h')).to.equal('3rem');

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rect = el.getBoundingClientRect();
  expect(rect.width).to.be.closeTo(3 * rootFontSize, 1);
  expect(rect.height).to.be.closeTo(3 * rootFontSize, 1);
});

it('clears the width/height custom properties when width/height are unset', async () => {
  const el = (await fixture(
    html`<lr-skeleton width="3rem" height="3rem"></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(el.style.getPropertyValue('--lr-skeleton-w')).to.equal('3rem');
  expect(el.style.getPropertyValue('--lr-skeleton-h')).to.equal('3rem');

  el.width = undefined;
  el.height = undefined;
  await el.updateComplete;

  expect(el.style.getPropertyValue('--lr-skeleton-w')).to.equal('');
  expect(el.style.getPropertyValue('--lr-skeleton-h')).to.equal('');

  const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const rect = el.getBoundingClientRect();
  expect(rect.height).to.be.closeTo(rootFontSize, 1);
  expect(rect.width).to.be.greaterThan(3 * rootFontSize);
});

it('reflects variant onto the host attribute and gives each variant a distinct border-radius', async () => {
  const text = (await fixture(html`<lr-skeleton variant="text"></lr-skeleton>`)) as LyraSkeleton;
  expect(text.getAttribute('variant')).to.equal('text');
  const textRadius = getComputedStyle(text.shadowRoot!.querySelector('[part="base"]')!).borderRadius;

  const circle = (await fixture(
    html`<lr-skeleton variant="circle"></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(circle.getAttribute('variant')).to.equal('circle');
  const circleRadius = getComputedStyle(circle.shadowRoot!.querySelector('[part="base"]')!).borderRadius;
  expect(circleRadius).to.equal('50%');
  expect(circleRadius).to.not.equal(textRadius);

  const rect = (await fixture(html`<lr-skeleton variant="rect"></lr-skeleton>`)) as LyraSkeleton;
  expect(rect.getAttribute('variant')).to.equal('rect');
  const rectRadius = getComputedStyle(rect.shadowRoot!.querySelector('[part="base"]')!).borderRadius;
  expect(rectRadius).to.equal(textRadius);
  expect(rectRadius).to.not.equal(circleRadius);
});

it('reflects effect onto the host attribute', async () => {
  const pulse = (await fixture(html`<lr-skeleton effect="pulse"></lr-skeleton>`)) as LyraSkeleton;
  expect(pulse.getAttribute('effect')).to.equal('pulse');

  const sheen = (await fixture(html`<lr-skeleton effect="sheen"></lr-skeleton>`)) as LyraSkeleton;
  expect(sheen.getAttribute('effect')).to.equal('sheen');
});

it('gives pulse and sheen distinct keyframe animations, disabled under reduced motion', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include(
    "[part='base'] { animation: lr-skeleton-pulse var(--lr-transition-ambient) infinite; }",
  );
  expect(css).to.include('background-image: linear-gradient(');
  expect(css).to.include(
    'animation: lr-skeleton-sheen var(--lr-transition-ambient) infinite;',
  );
  expect(css).to.include(
    "@media (prefers-reduced-motion: reduce) { [part='base'] { animation: none !important; } " +
      ":host([effect='sheen']) [part='base'] { background-image: none; } }",
  );
});

it('allows the shared ambient-motion token to retime the animation', async () => {
  const el = (await fixture(
    html`<lr-skeleton
      effect="sheen"
      style="--lr-transition-ambient: 3s linear"
    ></lr-skeleton>`,
  )) as LyraSkeleton;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;

  expect(getComputedStyle(base).animationDuration).to.equal('3s');
  expect(getComputedStyle(base).animationTimingFunction).to.equal('linear');
});

it('reverses the sheen sweep under dir="rtl" so it travels in the reading direction', async () => {
  const ltr = (await fixture(html`<lr-skeleton effect="sheen"></lr-skeleton>`)) as LyraSkeleton;
  const ltrBase = ltr.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(ltrBase).animationDirection).to.equal('normal');

  // background-position percentages are physical, so the RTL variant plays the same keyframes
  // backwards instead of always sweeping left-to-right.
  const rtl = (await fixture(
    html`<lr-skeleton effect="sheen" dir="rtl"></lr-skeleton>`,
  )) as LyraSkeleton;
  const rtlBase = rtl.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(rtlBase).animationDirection).to.equal('reverse');
});

it('defaults the accessible name to "Loading…" and reflects a custom label', async () => {
  const defaulted = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  expect(defaulted.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading…');

  const labeled = (await fixture(
    html`<lr-skeleton label="Loading chart"></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(labeled.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading chart');
});

it('localizes the default accessible name via this.localize() when .strings overrides the shared loading key', async () => {
  const el = (await fixture(
    html`<lr-skeleton .strings=${{ loading: 'Chargement…' }}></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Chargement…');
});

it('can render as an unannounced decorative placeholder', async () => {
  const el = (await fixture(
    html`<lr-skeleton .announce=${false}></lr-skeleton>`,
  )) as LyraSkeleton;

  expect(el.hasAttribute('role')).to.equal(false);
  expect(el.shadowRoot!.querySelector('.sr-only')).to.equal(null);
});

it('announce="false" (plain HTML attribute) also renders as an unannounced decorative placeholder', async () => {
  const el = (await fixture(html`<lr-skeleton announce="false"></lr-skeleton>`)) as LyraSkeleton;

  expect(el.announce).to.be.false;
  expect(el.hasAttribute('role')).to.equal(false);
  expect(el.shadowRoot!.querySelector('.sr-only')).to.equal(null);
});

it('removes status semantics when announce is disabled after rendering', async () => {
  const el = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  expect(el.getAttribute('role')).to.equal('status');

  el.announce = false;
  await el.updateComplete;

  expect(el.hasAttribute('role')).to.equal(false);
  expect(el.shadowRoot!.querySelector('.sr-only')).to.equal(null);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  await expect(el).to.be.accessible();
});

it('renders a visible, nonzero box -- [part=base] uses display:block, not inline', async () => {
  const el = (await fixture(html`<lr-skeleton width="120px" height="40px"></lr-skeleton>`)) as LyraSkeleton;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(base).display).to.equal('block');
  const rect = base.getBoundingClientRect();
  expect(rect.width).to.be.greaterThan(0);
  expect(rect.height).to.be.greaterThan(0);
});
