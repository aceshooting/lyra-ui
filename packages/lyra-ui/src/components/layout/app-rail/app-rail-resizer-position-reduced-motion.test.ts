import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames as nextPaint } from '../../../../test/frames.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import './app-rail.js';
import type { LyraAppRail } from './app-rail.js';

const base = (el: LyraAppRail) => el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
const handle = (el: LyraAppRail) => el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
const edgeError = (el: LyraAppRail, direction: 'ltr' | 'rtl') => {
  const rail = base(el).getBoundingClientRect();
  const grip = handle(el).getBoundingClientRect();
  return Math.abs(grip.left + grip.width / 2 - (direction === 'rtl' ? rail.left : rail.right));
};

for (const direction of ['ltr', 'rtl'] as const) {
  it(`tracks live ${direction} width and hit-target changes after reconnect under reduced motion`, async () => {
    await setReducedMotion('reduce');
    try {
      await waitUntil(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
      const parent = await fixture<HTMLDivElement>(html`<div>
        <lr-app-rail dir=${direction} force-mode="full" resizable
          style="inline-size: 500px; block-size: 300px; --lr-app-rail-width: 220px;"></lr-app-rail>
      </div>`);
      const el = parent.querySelector<LyraAppRail>('lr-app-rail')!;
      await el.updateComplete;
      await nextPaint();
      // The shared reduced-motion token is 0.001ms; engines serialize that as zero or 1e-6s.
      await waitUntil(() => parseFloat(getComputedStyle(base(el)).transitionDuration) <= 0.000002);
      el.forceMode = 'icon-only';
      await el.updateComplete;
      await nextPaint();
      el.forceMode = 'full';
      await el.updateComplete;
      await nextPaint();
      expect(edgeError(el, direction)).to.be.lessThan(2);
      el.remove();
      el.style.setProperty('--lr-app-rail-width', '280px');
      parent.append(el);
      await el.updateComplete;
      await nextPaint();
      expect(base(el).getBoundingClientRect().width).to.be.closeTo(280, 1);
      expect(edgeError(el, direction)).to.be.lessThan(2);
      el.style.setProperty('--lr-app-rail-width', '310px');
      el.style.setProperty('--lr-icon-button-size', '48px');
      await nextPaint();
      await nextPaint();
      expect(handle(el).getBoundingClientRect().width).to.be.closeTo(48, 1);
      expect(edgeError(el, direction)).to.be.lessThan(2);
      el.style.setProperty('--lr-app-rail-width', '50%');
      el.style.inlineSize = '400px';
      await nextPaint();
      await nextPaint();
      expect(base(el).getBoundingClientRect().width).to.be.closeTo(200, 1);
      expect(edgeError(el, direction)).to.be.lessThan(2);
      el.style.inlineSize = '320px';
      await nextPaint();
      await nextPaint();
      expect(base(el).getBoundingClientRect().width).to.be.closeTo(160, 1);
      expect(edgeError(el, direction)).to.be.lessThan(2);
    } finally {
      await setReducedMotion('no-preference');
    }
  });

}
