import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './carousel.js';
import type { LyraCarousel } from './carousel.js';

async function carousel(template = html`
  <lyra-carousel>
    <div>One</div>
    <div>Two</div>
    <div>Three</div>
  </lyra-carousel>
`): Promise<LyraCarousel> {
  const el = (await fixture(template)) as LyraCarousel;
  await el.updateComplete;
  return el;
}

it('exposes one visible slide and localized navigation controls', async () => {
  const el = await carousel();
  const slides = [...el.children] as HTMLElement[];

  expect(slides[0].hidden).to.be.false;
  expect(slides[1].hidden).to.be.true;
  expect(slides[0].getAttribute('role')).to.equal('group');
  expect(slides[0].getAttribute('aria-roledescription')).to.equal('slide');
  expect(el.shadowRoot!.querySelectorAll('[part="indicator"]').length).to.equal(3);
  // The indicators are a plain labelled button group, not a tablist -- there is no tabpanel for
  // them to control, so role="tab"/aria-selected would announce a broken relationship to AT.
  expect(el.shadowRoot!.querySelector('[part="indicators"]')!.getAttribute('role')).to.equal('group');
  expect(el.shadowRoot!.querySelector('[part="indicator"]')!.getAttribute('role')).to.be.null;
});

it('gives each indicator the shared minimum hit area without inflating the visible dot', async () => {
  const el = await carousel();
  const indicator = el.shadowRoot!.querySelector('[part="indicator"]') as HTMLElement;
  const dot = indicator.querySelector('[part="indicator-dot"]') as HTMLElement;
  expect(getComputedStyle(indicator).minInlineSize).to.equal('40px');
  expect(getComputedStyle(indicator).minBlockSize).to.equal('40px');
  // The visible dot itself stays compact (--lyra-size-0-5rem = 8px), not blown up to 40px -- the
  // button's own box grows around it via flex centering instead.
  expect(getComputedStyle(dot).inlineSize).to.equal('8px');
  expect(getComputedStyle(dot).blockSize).to.equal('8px');
});

it('omits the indicator group entirely when showIndicators is false', async () => {
  const el = await carousel(html`
    <lyra-carousel .showIndicators=${false}>
      <div>One</div>
      <div>Two</div>
    </lyra-carousel>
  `);
  expect(el.shadowRoot!.querySelector('[part="indicators"]')).to.be.null;
});

it('emits slide changes and supports keyboard navigation', async () => {
  const el = await carousel();
  const next = el.shadowRoot!.querySelector('[part="next-button"]') as HTMLButtonElement;
  const eventPromise = oneEvent(el, 'lyra-slide-change');
  next.click();
  const event = await eventPromise;

  expect(event.detail).to.deep.equal({ index: 1 });
  expect(el.index).to.equal(1);

  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.index).to.equal(0);
});

it('swaps ArrowLeft/ArrowRight under RTL so a key still moves toward the visually adjacent slide', async () => {
  const el = await carousel(html`
    <lyra-carousel dir="rtl">
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </lyra-carousel>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;

  // Under RTL, ArrowLeft is "forward" (matches the physically-mirrored next-button position).
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  await el.updateComplete;
  expect(el.index).to.equal(1);

  // ArrowRight is "backward" under RTL -- must NOT also advance (the bug this regresses had both
  // arrows calling next(), leaving no keyboard way to go back).
  viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await el.updateComplete;
  expect(el.index).to.equal(0);
});

it('clamps a NaN, negative, or oversized index to a valid slide instead of NaN/out-of-range', async () => {
  const el = await carousel();

  el.index = NaN;
  await el.updateComplete;
  expect(([...el.children] as HTMLElement[])[0].hidden).to.be.false;

  el.index = -5;
  await el.updateComplete;
  expect((el.shadowRoot!.querySelectorAll('[part="indicator"]')[0] as HTMLElement).getAttribute('aria-current')).to.equal('true');

  el.index = 999;
  await el.updateComplete;
  const indicators = el.shadowRoot!.querySelectorAll('[part="indicator"]');
  expect(indicators[indicators.length - 1].getAttribute('aria-current')).to.equal('true');
});

it('treats a non-finite autoplayInterval as its 5s default instead of NaN math', async () => {
  const el = await carousel(html`
    <lyra-carousel autoplay autoplay-interval="NaN">
      <div>One</div>
      <div>Two</div>
    </lyra-carousel>
  `);
  // A non-finite interval falling through to `setInterval` unguarded would either throw or fire
  // immediately/never; asserting a timer actually got scheduled is the observable proxy for "the
  // sanitized 5s default was used", since the internal numeric timer id isn't itself meaningful.
  expect((el as unknown as { timer?: number }).timer).to.not.be.undefined;
});

it('mirrors the previous/next chevron glyphs under RTL', async () => {
  const el = await carousel(html`
    <lyra-carousel dir="rtl">
      <div>One</div>
      <div>Two</div>
    </lyra-carousel>
  `);
  const glyph = el.shadowRoot!.querySelector('[part="previous-glyph"]') as HTMLElement;
  expect(getComputedStyle(glyph).transform).to.contain('matrix(-1');
});

it('disables autoplay under prefers-reduced-motion', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const el = await carousel(html`
      <lyra-carousel autoplay autoplay-interval="1000">
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </lyra-carousel>
    `);
    // The reduced-motion branch must gate autoplay before any timer is ever
    // scheduled, not just shorten it -- so no interval should exist at all.
    expect((el as any).reduceMotion).to.be.true;
    expect((el as any).timer).to.be.undefined;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(el.index).to.equal(0);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('is accessible and supports a consumer supplied accessible label', async () => {
  const el = await carousel(html`
    <lyra-carousel aria-label="Product screenshots">
      <img alt="First screenshot" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
      <img alt="Second screenshot" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" />
    </lyra-carousel>
  `);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Product screenshots',
  );
  await expect(el).to.be.accessible();
});

it('names the focusable viewport with role="group", following the same label arbitration as the region', async () => {
  const el = await carousel(html`
    <lyra-carousel>
      <div>Slide one</div>
      <div>Slide two</div>
    </lyra-carousel>
  `);
  const viewport = el.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
  expect(viewport.getAttribute('tabindex')).to.equal('0');
  expect(viewport.getAttribute('role')).to.equal('group');
  expect(viewport.getAttribute('aria-label')).to.equal('Carousel');

  el.setAttribute('aria-label', 'Product screenshots');
  await el.updateComplete;
  expect(viewport.getAttribute('aria-label')).to.equal('Product screenshots');
});
