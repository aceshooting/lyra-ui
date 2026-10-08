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
  it(`keeps the resizer on the actual ${direction} edge throughout collapse and expansion`, async () => {
    await setReducedMotion('no-preference');
    const el = await fixture<LyraAppRail>(html`
      <lr-app-rail dir=${direction} collapsible resizable icon-only-breakpoint="1px" mobile-breakpoint="0px"
        style="inline-size: 500px; block-size: 300px; --lr-app-rail-width: 220px; --lr-app-rail-icon-width: 52px; --lr-transition-base: 240ms linear;">
        <a href="#section">Section</a>
      </lr-app-rail>
    `);
    await nextPaint();
    const expandedWidth = base(el).getBoundingClientRect().width;
    el.toggle();
    await el.updateComplete;
    expect(el.mode).to.equal('icon-only');
    expect(el.shadowRoot!.querySelector('[part="resizer"]') === null).to.equal(true);
    await waitUntil(() => base(el).getBoundingClientRect().width < 54);
    const errors: number[] = [];
    const widths: number[] = [];
    // Inspect the delivered layout before paint, rather than forcing a fresh animation layout
    // from a later timer while the previous frame's observers have already finished.
    el.toggle();
    await el.updateComplete;
    const observer = new ResizeObserver(() => {
      if (el.mode !== 'full') return;
      errors.push(edgeError(el, direction));
      widths.push(base(el).getBoundingClientRect().width);
    });
    observer.observe(base(el), { box: 'border-box' });
    try {
      await waitUntil(() => base(el).getBoundingClientRect().width >= expandedWidth - 0.5);
      await nextPaint();
      expect(widths.some(width => width > 60 && width < expandedWidth - 10)).to.equal(true);
      expect(base(el).getBoundingClientRect().width).to.be.closeTo(expandedWidth, 0.5);
      expect(Math.max(...errors)).to.be.lessThan(2);
      expect(edgeError(el, direction)).to.be.lessThan(2);
    } finally {
      observer.disconnect();
    }
  });

  it(`tracks the ${direction} edge in the destination document after adoption before first render`, async () => {
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Rail adoption test"></iframe>`);
    const frameDocument = frame.contentDocument;
    if (!frameDocument) throw new Error('The iframe document was unavailable.');
    const el = document.createElement('lr-app-rail') as LyraAppRail;
    el.dir = direction;
    el.forceMode = 'full';
    el.resizable = true;
    el.style.cssText = 'inline-size: 400px; block-size: 300px; --lr-app-rail-width: 220px; --lr-transition-base: 0ms;';
    try {
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await el.updateComplete;
      await waitUntil(() => Math.abs(base(el).getBoundingClientRect().width - 220) < 1 && edgeError(el, direction) < 2);
      el.style.setProperty('--lr-app-rail-width', '310px');
      await waitUntil(() => Math.abs(base(el).getBoundingClientRect().width - 310) < 1 && edgeError(el, direction) < 2);
    } finally {
      el.remove();
      document.adoptNode(el);
    }
  });
}
