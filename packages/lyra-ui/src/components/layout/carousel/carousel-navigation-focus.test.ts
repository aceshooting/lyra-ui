import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-carousel.js';
import type { LyraCarousel } from '../../lr-carousel.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const part = (el: LyraCarousel, name: string): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>(`[part~="${name}"]`)!;

const focusedPart = (el: LyraCarousel): string => (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('part') ?? '';

describe('lr-carousel navigation focus rehoming', () => {
  it('moves focus to the enabled navigation button when the focused one becomes disabled', async () => {
    const el = await fixture<LyraCarousel>(html`<lr-carousel navigation current-slide="1">
      <div>One</div>
      <div>Two</div>
      <div>Three</div>
    </lr-carousel>`);
    await el.updateComplete;
    const next = part(el, 'navigation-button-next');
    await focusByKeyboard(next);
    next.click();
    await waitUntil(() => el.currentSlide === 2, 'the carousel advances to the last slide');
    await el.updateComplete;
    expect(next.disabled).to.equal(true);
    expect(focusedPart(el)).to.include('navigation-button-previous');
  });
});
