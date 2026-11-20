import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import '../../lr-carousel.js';
import '../../lr-carousel-item.js';
import type { LyraCarousel } from '../../lr-carousel.js';

const frame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function make(template = html`<lr-carousel navigation pagination>
  <div>One</div><div>Two</div><div>Three</div>
</lr-carousel>`): Promise<LyraCarousel> {
  const el = await fixture<LyraCarousel>(template);
  await el.updateComplete;
  await frame();
  return el;
}

describe('lr-carousel interactions', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('draws the current page indicator with a heavier border, not only a different colour', async () => {
    const el = await make();
    const dots = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="indicator-dot"]')];
    const border = (dot: HTMLElement): number => parseFloat(getComputedStyle(dot).borderTopWidth);
    expect(border(dots[0]!) > border(dots[1]!), 'active dot border is heavier').to.equal(true);
    expect(border(dots[1]!)).to.equal(border(dots[2]!));
    expect(dots[0]!.getBoundingClientRect().width).to.equal(dots[1]!.getBoundingClientRect().width);
  });

  it('keeps the current indicator paint while the active page indicator is hovered', async () => {
    const el = await make();
    el.style.setProperty('--lr-carousel-indicator-current-bg', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-carousel-pagination-hover-bg', 'rgb(9, 9, 9)');
    const item = el.shadowRoot!.querySelector<HTMLElement>('[part~="pagination-item-active"]')!;
    const dot = item.querySelector<HTMLElement>('[part="indicator-dot"]')!;
    await hoverUntilMatched(item, 'the active indicator never registered :hover');
    await waitUntil(() => getComputedStyle(dot).backgroundColor === 'rgb(1, 2, 3)', 'current paint must hold');
    expect(getComputedStyle(dot).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('keeps the keyboard focus ring on the viewport while it is hovered', async () => {
    const el = await make();
    el.style.setProperty('--lr-focus-ring-color', 'rgb(1, 2, 3)');
    el.style.setProperty('--lr-carousel-scroll-container-hover-outline-color', 'rgb(9, 9, 9)');
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part~="scroll-container"]')!;
    await focusByKeyboard(viewport);
    await hoverUntilMatched(viewport, 'the viewport never registered :hover');
    await waitUntil(() => viewport.matches(':focus-visible'), 'viewport must be focus-visible');
    expect(getComputedStyle(viewport).outlineColor).to.equal('rgb(1, 2, 3)');
  });

  it('paints the current page indicator with a system colour under forced colors', async () => {
    const el = await make();
    await setForcedColors('active');
    try {
      expect(matchMedia('(forced-colors: active)').matches).to.equal(true);
      const dots = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="indicator-dot"]')];
      const active = getComputedStyle(dots[0]!);
      const rest = getComputedStyle(dots[1]!);
      expect(
        `${active.backgroundColor}|${active.outlineStyle}` === `${rest.backgroundColor}|${rest.outlineStyle}`,
        'active and resting dots must differ in forced colors',
      ).to.equal(false);
    } finally {
      await setForcedColors('none');
    }
  });

  for (const init of [
    { key: 'ArrowRight', ctrlKey: true },
    { key: 'ArrowRight', altKey: true },
    { key: 'ArrowRight', metaKey: true },
    { key: 'ArrowRight', shiftKey: true },
    { key: 'End', ctrlKey: true },
    { key: 'ArrowRight', isComposing: true },
  ] as KeyboardEventInit[]) {
    it(`leaves ${JSON.stringify(init)} to the browser`, async () => {
      const el = await make();
      const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part~="scroll-container"]')!;
      const event = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
      viewport.dispatchEvent(event);
      expect(event.defaultPrevented).to.equal(false);
      expect(el.currentSlide).to.equal(0);
    });
  }

  it('still moves on a plain arrow key', async () => {
    const el = await make();
    const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part~="scroll-container"]')!;
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
    viewport.dispatchEvent(event);
    expect(event.defaultPrevented).to.equal(true);
  });

  it('adopts a managed slide attribute change without observing the whole subtree when not looping', async () => {
    const el = await make(html`<lr-carousel><div id="a">One</div><div>Two</div></lr-carousel>`);
    const slide = el.querySelector<HTMLElement>('#a')!;
    slide.setAttribute('aria-label', 'First');
    slide.setAttribute('role', 'group');
    await frame();
    await el.updateComplete;
    expect(slide.getAttribute('role')).to.equal('group');
    const added = document.createElement('div');
    added.textContent = 'Three';
    el.append(added);
    await waitUntil(() => el.slides === 3, 'an appended slide is counted');
    expect(el.slides).to.equal(3);
  });

  it('mirrors slide text into loop clones after loop is switched on later', async () => {
    const el = await make(html`<lr-carousel><div id="a">One</div><div>Two</div></lr-carousel>`);
    el.loop = true;
    await el.updateComplete;
    await frame();
    el.querySelector<HTMLElement>('#a')!.textContent = 'One updated';
    await waitUntil(
      () =>
        el.shadowRoot!
          .querySelector('[data-clone-set="after"] [data-carousel-index="0"]')
          ?.textContent?.trim() === 'One updated',
      'loop clones follow later text edits',
    );
  });

  it('still adopts managed attribute changes after loop is switched off', async () => {
    const el = await make(html`<lr-carousel loop><div id="a">One</div><div>Two</div></lr-carousel>`);
    el.loop = false;
    await el.updateComplete;
    await frame();
    const slide = el.querySelector<HTMLElement>('#a')!;
    slide.hidden = true;
    await frame();
    await el.updateComplete;
    await waitUntil(() => el.slides === 2, 'slides settle');
    expect(slide.hidden).to.equal(true);
  });

  it('does not re-apply a stale current-slide attribute when the element is moved', async () => {
    const el = await make(html`<lr-carousel><div>One</div><div>Two</div><div>Three</div></lr-carousel>`);
    el.currentSlide = 2;
    el.parentElement!.append(el);
    await el.updateComplete;
    await aTimeout(0);
    expect(el.currentSlide).to.equal(2);
  });

  it('treats an empty autoplay-interval attribute as the default', async () => {
    const el = await make(html`<lr-carousel autoplay-interval="">
      <div>One</div><div>Two</div>
    </lr-carousel>`);
    expect(el.autoplayInterval).to.equal(3000);
    el.setAttribute('autoplay-interval', '2500');
    expect(el.autoplayInterval).to.equal(2500);
    el.removeAttribute('autoplay-interval');
    expect(el.autoplayInterval).to.equal(3000);
  });
});

it('lets a reader pause rotation until they explicitly resume', async () => {
  const el = await make(html`<lr-carousel autoplay loop><p>One</p><p>Two</p></lr-carousel>`);
  const timer = (): number | undefined => (el as unknown as { timer?: number }).timer;
  const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="autoplay-button"]');
  expect(toggle?.textContent?.trim()).to.equal('Pause rotation');
  toggle!.click();
  await el.updateComplete;
  el.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
  expect(toggle!.textContent?.trim()).to.equal('Resume rotation');
  expect(timer()).to.equal(undefined);
  toggle!.click();
  await el.updateComplete;
  expect(toggle!.textContent?.trim()).to.equal('Pause rotation');
  expect(typeof timer()).to.equal('number');
  el.strings = { carouselPauseRotation: 'Anhalten', carouselResumeRotation: 'Fortsetzen' };
  await el.updateComplete;
  expect(toggle!.textContent?.trim()).to.equal('Anhalten');
  toggle!.click();
  await el.updateComplete;
  expect(toggle!.textContent?.trim()).to.equal('Fortsetzen');
  el.autoplay = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part~="autoplay-button"]') === null).to.equal(true);
});

it('inherits carousel surface and spacing overrides', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="--lr-carousel-gap: 15px; --lr-carousel-controls-gap: 17px">
    <lr-carousel navigation pagination><p>One</p><p>Two</p></lr-carousel>
  </div>`);
  const el = wrapper.querySelector('lr-carousel')!;
  await el.updateComplete;
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!).columnGap).to.equal('15px');
  expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="navigation"]')!).columnGap).to.equal('17px');
});

it('aligns to the requested slide in layout pixels inside a scaled container', async () => {
  const el = await make(html`<lr-carousel style="inline-size: 300px;transform:scale(.5);--slide-gap:0px">
    <div>One</div><div>Two</div>
  </lr-carousel>`);
  const viewport = el.shadowRoot!.querySelector<HTMLElement>('[part="scroll-container"]')!;
  let left = 0;
  viewport.scrollBy = (options?: ScrollToOptions | number) => {
    left = typeof options === 'number' ? options : options?.left ?? 0;
  };
  el.goToSlide(1, 'instant');
  await el.updateComplete;
  expect(left).to.be.closeTo(viewport.clientWidth, 1);
});
