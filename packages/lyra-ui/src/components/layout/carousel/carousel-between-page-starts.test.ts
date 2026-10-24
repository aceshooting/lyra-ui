import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraCarousel } from './carousel.class.js';
import './carousel.js';

afterEach(async () => { await resetMouse(); });

for (const [current, expectedPage, expectedStart] of [[1, 0, 0], [2, 1, 3], [4, 1, 3]] as const) {
  it(`keeps an exact slide start ${current} while marking its nearest page indicator`, async () => {
    const el = await fixture<LyraCarousel>(html`<lr-carousel pagination slides-per-page="3" slides-per-move="3"
      style="inline-size:480px;block-size:180px">
      ${Array.from({ length: 8 }, (_, index) => html`<div>Slide ${index + 1}</div>`)}
    </lr-carousel>`);
    await el.updateComplete;
    const slides = [...el.children] as HTMLElement[];
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part~="pagination-item"]').length === 3);
    const changes: number[] = [];
    el.addEventListener('lr-slide-change', event => { changes.push(event.detail.index); });
    el.goToSlide(current, 'instant');
    await el.updateComplete;
    const indicators = [...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part~="pagination-item"]')];
    expect(el.currentSlide).to.equal(current);
    expect(indicators.map(button => button.getAttribute('aria-current'))).to.deep.equal(
      indicators.map((_, index) => index === expectedPage ? 'true' : 'false'));
    expect(slides.map(slide => slide.inert)).to.deep.equal(slides.map((_, index) => index < current || index >= current + 3));
    expect(changes).to.deep.equal([current]);

    await focusByKeyboard(indicators[expectedPage]!);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.currentSlide === expectedStart);
    await el.updateComplete;
    expect(changes).to.deep.equal([current, expectedStart]);
    expect(indicators.filter(button => button.getAttribute('aria-current') === 'true').length).to.equal(1);
  });
}
