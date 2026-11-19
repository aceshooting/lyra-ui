import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { contrastRatio } from '../../../../test/color-contrast.js';
import { sendKeys } from '@web/test-runner-commands';
import './lightbox.js';
import type { LyraLightbox, LyraLightboxSource } from './lightbox.js';

const pixel = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3C/svg%3E';

for (const mode of ['light', 'dark']) {
  it(`paints source-mode status text legibly on the backdrop in ${mode} mode`, async () => {
    const failing: LyraLightboxSource = { revision: 1, images: { count: 1, read: () => Promise.reject(new Error('unavailable')) } };
    const pending: LyraLightboxSource = { revision: 1, images: { count: 1, read: () => new Promise(() => undefined) } };
    const wrapper = await fixture<HTMLElement>(html`<div data-lr-mode=${mode}>
      <lr-lightbox id="failing" open .imageSource=${failing}></lr-lightbox>
      <lr-lightbox id="pending" open .imageSource=${pending}></lr-lightbox>
    </div>`);
    const failingEl = wrapper.querySelector<LyraLightbox>('#failing')!;
    const pendingEl = wrapper.querySelector<LyraLightbox>('#pending')!;
    await waitUntil(() => failingEl.shadowRoot!.querySelector('[part="source-error"]') !== null);
    await waitUntil(() => pendingEl.shadowRoot!.querySelector('[part="source-loading"]') !== null);
    for (const [el, part] of [[failingEl, 'source-error'], [pendingEl, 'source-loading']] as const) {
      const color = getComputedStyle(el.shadowRoot!.querySelector(`[part="${part}"]`)!).color;
      expect(contrastRatio(color, getComputedStyle(el.shadowRoot!.querySelector('[part="backdrop"]')!).backgroundColor) >= 4.5).to.equal(true, `${part} contrast in ${mode}`);
    }
  });
}

it('ignores Alt-modified and composing arrow keys instead of navigating', async () => {
  const el = await fixture<LyraLightbox>(html`<lr-lightbox open .images=${[{ src: pixel, alt: 'a' }, { src: pixel, alt: 'b' }]}></lr-lightbox>`);
  const panel = el.shadowRoot!.querySelector<HTMLElement>('[part="panel"]')!;
  const fire = (init: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true, ...init });
    panel.dispatchEvent(event);
    return event;
  };
  const alt = fire({ altKey: true });
  const composing = fire({ isComposing: true });
  expect(alt.defaultPrevented).to.equal(false);
  expect(composing.defaultPrevented).to.equal(false);
  expect(el.index).to.equal(0);
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'close-button', 'initial modal focus');
  await sendKeys({ press: 'ArrowRight' });
  expect(el.index).to.equal(1);
});

it('emits lr-index-change after the clamped index has rendered', async () => {
  const other = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="9" height="9"%3E%3C/svg%3E';
  const el = await fixture<LyraLightbox>(html`<lr-lightbox open index="1" .images=${[{ src: pixel, alt: 'a' }, { src: other, alt: 'b' }]}></lr-lightbox>`);
  let renderedAtEvent = '';
  el.addEventListener('lr-index-change', () => {
    renderedAtEvent = el.shadowRoot!.querySelector('lr-pan-zoom')?.src ?? '';
  });
  const changed = new Promise<void>((resolve) => el.addEventListener('lr-index-change', () => resolve(), { once: true }));
  el.images = [{ src: pixel, alt: 'a' }];
  await changed;
  expect(el.index).to.equal(0);
  expect(renderedAtEvent).to.equal(pixel);
});
