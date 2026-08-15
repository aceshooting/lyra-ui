import { fixture, expect, html } from '@open-wc/testing';
import './skeleton.js';
import type { LyraSkeleton, LyraSkeletonEffect } from './skeleton.js';

it('defaults to a decorative text shape like the mirrored upstream skeletons', async () => {
  const el = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  expect(el.shape).to.equal('text');
  expect(el.effect).to.equal('none');
  expect(el.announce).to.be.false;
  expect(el.hasAttribute('role')).to.equal(false);
  expect(el.shadowRoot!.querySelectorAll('.sr-only').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part~="indicator"]')).to.exist;
});

it('applies explicit width/height as inline custom properties on the host', async () => {
  const el = (await fixture(
    html`<lr-skeleton shape="circle" width="3rem" height="3rem"></lr-skeleton>`,
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

it('reflects shape onto the host attribute and gives each shape a distinct border-radius', async () => {
  const text = (await fixture(html`<lr-skeleton shape="text"></lr-skeleton>`)) as LyraSkeleton;
  expect(text.getAttribute('shape')).to.equal('text');
  const textRadius = getComputedStyle(text.shadowRoot!.querySelector('[part~="base"]')!).borderRadius;

  const circle = (await fixture(
    html`<lr-skeleton shape="circle"></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(circle.getAttribute('shape')).to.equal('circle');
  const circleRadius = getComputedStyle(circle.shadowRoot!.querySelector('[part~="base"]')!).borderRadius;
  expect(circleRadius).to.equal('50%');
  expect(circleRadius).to.not.equal(textRadius);

  const rect = (await fixture(html`<lr-skeleton shape="rect"></lr-skeleton>`)) as LyraSkeleton;
  expect(rect.getAttribute('shape')).to.equal('rect');
  const rectRadius = getComputedStyle(rect.shadowRoot!.querySelector('[part~="base"]')!).borderRadius;
  expect(rectRadius).to.equal(textRadius);
  expect(rectRadius).to.not.equal(circleRadius);
});

it('does not expose the removed variant property or let its former attribute select geometry', async () => {
  const el = (await fixture(
    html`<lr-skeleton variant="circle"></lr-skeleton>`,
  )) as LyraSkeleton;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="indicator"]')!;

  expect('variant' in el).to.equal(false);
  expect(el.shape).to.equal('text');
  expect(getComputedStyle(indicator).borderRadius).to.not.equal('50%');
});

it('accepts the effect attribute without reflecting property writes', async () => {
  const el = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  const indicator = el.shadowRoot!.querySelector('[part~="indicator"]')!;

  const pulse: LyraSkeletonEffect = 'pulse';
  el.effect = pulse;
  await el.updateComplete;
  expect(el.hasAttribute('effect')).to.equal(false);
  expect(indicator.getAttribute('data-effect')).to.equal('pulse');
  expect(getComputedStyle(indicator).animationName).to.equal('lr-skeleton-pulse');

  el.setAttribute('effect', 'none');
  await el.updateComplete;
  expect(el.effect).to.equal('none');
  expect(getComputedStyle(indicator).animationName).to.equal('none');
});

it('gives pulse and sheen distinct rendered animations, disabled under reduced motion', async () => {
  const pulse = (await fixture(html`<lr-skeleton effect="pulse"></lr-skeleton>`)) as LyraSkeleton;
  const pulseIndicator = pulse.shadowRoot!.querySelector<HTMLElement>('[part~="indicator"]')!;
  expect(getComputedStyle(pulseIndicator).animationName).to.equal('lr-skeleton-pulse');

  const sheen = (await fixture(html`<lr-skeleton effect="sheen"></lr-skeleton>`)) as LyraSkeleton;
  const sheenIndicator = sheen.shadowRoot!.querySelector<HTMLElement>('[part~="indicator"]')!;
  expect(getComputedStyle(sheenIndicator).animationName).to.equal('lr-skeleton-sheen');
  expect(getComputedStyle(sheenIndicator).backgroundImage).to.not.equal('none');

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    expect(getComputedStyle(sheenIndicator).animationName).to.equal('none');
    return;
  }
  const reducedRule = sheen.shadowRoot!.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === '(prefers-reduced-motion: reduce)' &&
        [...rule.cssRules].some(
          (nested) =>
            nested instanceof CSSStyleRule &&
            nested.selectorText.includes('indicator') &&
            nested.style.getPropertyPriority('animation') === 'important',
        ),
    );
  expect(reducedRule).to.exist;
  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(sheenIndicator).animationName).to.equal('none');
    expect(getComputedStyle(sheenIndicator).backgroundImage).to.equal('none');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
  }
});

it('applies mapped color, sheen, and border-radius custom-property aliases', async () => {
  const el = (await fixture(html`
    <lr-skeleton
      effect="sheen"
      style="
        --lr-skeleton-color: rgb(1, 2, 3);
        --lr-skeleton-sheen-color: rgb(4, 5, 6);
        --lr-skeleton-border-radius: 9px;
      "
    ></lr-skeleton>
  `)) as LyraSkeleton;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="indicator"]')!;
  const computed = getComputedStyle(indicator);
  expect(computed.borderRadius).to.equal('9px');
  expect(computed.backgroundImage).to.include('rgb(1, 2, 3)');
  expect(computed.backgroundImage).to.include('rgb(4, 5, 6)');
});

it('accepts the unprefixed upstream skeleton hooks', async () => {
  const el = (await fixture(html`
    <lr-skeleton
      effect="sheen"
      style="--color: rgb(1, 2, 3); --sheen-color: rgb(4, 5, 6); --border-radius: 9px"
    ></lr-skeleton>
  `)) as LyraSkeleton;
  const indicator = el.shadowRoot!.querySelector<HTMLElement>('[part~="indicator"]')!;
  const computed = getComputedStyle(indicator);
  expect(computed.borderRadius).to.equal('9px');
  expect(computed.backgroundImage).to.include('rgb(1, 2, 3)');
  expect(computed.backgroundImage).to.include('rgb(4, 5, 6)');
});

it('allows the shared ambient-motion token to retime the animation', async () => {
  const el = (await fixture(
    html`<lr-skeleton
      effect="sheen"
      style="--lr-transition-ambient: 3s linear"
    ></lr-skeleton>`,
  )) as LyraSkeleton;
  const base = el.shadowRoot!.querySelector('[part~="base"]')!;

  expect(getComputedStyle(base).animationDuration).to.equal('3s');
  expect(getComputedStyle(base).animationTimingFunction).to.equal('linear');
});

it('reverses the sheen sweep under dir="rtl" so it travels in the reading direction', async () => {
  const ltr = (await fixture(html`<lr-skeleton effect="sheen"></lr-skeleton>`)) as LyraSkeleton;
  const ltrBase = ltr.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(getComputedStyle(ltrBase).animationDirection).to.equal('normal');

  // background-position percentages are physical, so the RTL variant plays the same keyframes
  // backwards instead of always sweeping left-to-right.
  const rtl = (await fixture(
    html`<lr-skeleton effect="sheen" dir="rtl"></lr-skeleton>`,
  )) as LyraSkeleton;
  const rtlBase = rtl.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(getComputedStyle(rtlBase).animationDirection).to.equal('reverse');
});

it('defaults an opted-in accessible name to "Loading…" and reflects a custom label', async () => {
  const defaulted = (await fixture(html`<lr-skeleton announce></lr-skeleton>`)) as LyraSkeleton;
  expect(defaulted.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading…');

  const labeled = (await fixture(
    html`<lr-skeleton announce label="Loading chart"></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(labeled.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading chart');
});

it('localizes the default accessible name via this.localize() when .strings overrides the shared loading key', async () => {
  const el = (await fixture(
    html`<lr-skeleton announce .strings=${{ loading: 'Chargement…' }}></lr-skeleton>`,
  )) as LyraSkeleton;
  expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Chargement…');
});

it('keeps an explicit label="Loading…" ahead of a strings override', async () => {
  const el = (await fixture(html`
    <lr-skeleton announce label="Loading…" .strings=${{ loading: 'Chargement…' }}></lr-skeleton>
  `)) as LyraSkeleton;
  expect(el.shadowRoot!.querySelector('.sr-only')!.textContent).to.equal('Loading…');
});

it('remains decorative after an explicit false property write', async () => {
  const el = (await fixture(html`<lr-skeleton .announce=${false}></lr-skeleton>`)) as LyraSkeleton;

  expect(el.hasAttribute('role')).to.equal(false);
  expect((el.shadowRoot!.querySelector('.sr-only')) === (null)).to.equal(true);
});

it('the announce attribute opts into status semantics and localized hidden text', async () => {
  const el = (await fixture(html`<lr-skeleton announce></lr-skeleton>`)) as LyraSkeleton;

  expect(el.announce).to.be.true;
  expect(el.getAttribute('role')).to.equal('status');
  expect(el.shadowRoot!.querySelector('.sr-only')?.textContent).to.equal('Loading…');
});

it('removes status semantics when announce is disabled after rendering', async () => {
  const el = (await fixture(html`<lr-skeleton announce></lr-skeleton>`)) as LyraSkeleton;
  expect(el.getAttribute('role')).to.equal('status');

  el.announce = false;
  await el.updateComplete;

  expect(el.hasAttribute('role')).to.equal(false);
  expect((el.shadowRoot!.querySelector('.sr-only')) === (null)).to.equal(true);
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-skeleton></lr-skeleton>`)) as LyraSkeleton;
  await expect(el).to.be.accessible();
});

it('renders a visible, nonzero box -- [part=base] uses display:block, not inline', async () => {
  const el = (await fixture(html`<lr-skeleton width="120px" height="40px"></lr-skeleton>`)) as LyraSkeleton;
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  expect(getComputedStyle(base).display).to.equal('block');
  const rect = base.getBoundingClientRect();
  expect(rect.width).to.be.greaterThan(0);
  expect(rect.height).to.be.greaterThan(0);
});
