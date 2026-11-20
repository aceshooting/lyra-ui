import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { setForcedColors } from '../../../test/wtr-media.js';
import { focusByKeyboard } from '../../../test/wtr-focus.js';
import '../lr-callout.js';
import '../lr-chip.js';
import '../lr-kbd.js';
import '../lr-progress-bar.js';
import '../lr-progress-ring.js';
import '../lr-drawer.js';
import '../lr-popup.js';
import '../lr-rating.js';
import '../lr-toast.js';
import '../lr-toast-item.js';
import type { LyraCallout } from '../lr-callout.js';
import type { LyraPopup } from '../lr-popup.js';
import type { LyraRating } from '../lr-rating.js';

describe('overlays remediation', () => {
  it('returns null from public render-root getters before first connection', () => {
    expect((document.createElement('lr-rating') as LyraRating).rating === null).to.equal(true);
    expect((document.createElement('lr-toast') as unknown as { stack: unknown }).stack === null).to.equal(true);
    expect(
      (document.createElement('lr-toast-item') as unknown as { toastItemElement: unknown }).toastItemElement === null
    ).to.equal(true);
  });

  it('restores the declared arrow-padding default when the attribute is removed', async () => {
    const el = await fixture<LyraPopup>(html`<lr-popup arrow-padding="30"><span>x</span></lr-popup>`);
    expect(el.arrowPadding).to.equal(30);
    el.removeAttribute('arrow-padding');
    expect(el.arrowPadding).to.equal(10);
  });

  it('does not step the rating on modified arrow keys', async () => {
    const el = await fixture<LyraRating>(html`<lr-rating value="2" max="5"></lr-rating>`);
    await focusByKeyboard(el);
    await sendKeys({ press: 'Control+ArrowRight' });
    await sendKeys({ press: 'Alt+ArrowRight' });
    expect(el.value).to.equal(2);
    await sendKeys({ press: 'ArrowRight' });
    expect(el.value).to.equal(3);
  });

  it('skips lr-close when a close-request listener already removed the callout', async () => {
    const host = await fixture<HTMLDivElement>(html`<div><lr-callout closable>Message</lr-callout></div>`);
    const el = host.querySelector('lr-callout') as LyraCallout;
    let closed = 0;
    el.addEventListener('lr-close', () => closed++);
    el.addEventListener('lr-close-request', () => el.remove());
    (el.renderRoot.querySelector('[part="close-button"]') as HTMLElement).click();
    await Promise.resolve();
    expect(closed).to.equal(0);
  });
});

describe('drawer safe-area insets', () => {
  const cases: Array<[string, string, string]> = [
    ['bottom', 'paddingBottom', '34px'],
    ['top', 'paddingTop', '34px'],
    ['end', 'paddingRight', '34px'],
    ['start', 'paddingLeft', '34px'],
  ];
  for (const [placement, side, value] of cases) {
    it(`pads the ${placement} drawer panel on the edge it touches`, async () => {
      const el = await fixture<HTMLElement>(html`
        <lr-drawer
          open
          placement=${placement}
          style="--lr-safe-area-top:34px;--lr-safe-area-bottom:34px;--lr-safe-area-inline-start:34px;--lr-safe-area-inline-end:34px"
          >Body</lr-drawer
        >
      `);
      const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
      expect(getComputedStyle(panel)[side as 'paddingBottom']).to.equal(value);
    });
  }
  it('keeps the inward edge of a bottom drawer flush', async () => {
    const el = await fixture<HTMLElement>(
      html`<lr-drawer open placement="bottom" style="--lr-safe-area-top:34px">Body</lr-drawer>`
    );
    const panel = el.shadowRoot!.querySelector('[part~="panel"]') as HTMLElement;
    expect(getComputedStyle(panel).paddingTop).to.equal('0px');
  });
});

describe('forced-colors data and selected paint', () => {
  afterEach(async () => {
    await setForcedColors('none');
  });

  it('keeps the progress fill, rating fill and selected chip distinguishable', async () => {
    await setForcedColors('active');
    const host = await fixture<HTMLDivElement>(html`<div style="--lr-border-width-thin: 1px">
      <lr-progress-bar value="40"></lr-progress-bar>
      <lr-progress-ring value="40"></lr-progress-ring>
      <lr-rating value="2" max="3"></lr-rating>
      <lr-chip toggleable selected>On</lr-chip>
      <lr-chip toggleable>Off</lr-chip>
    </div>`);
    const q = (tag: string, part: string, n = 0) =>
      host.querySelectorAll(tag)[n]!.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement;
    const canvas = getComputedStyle(host).backgroundColor;
    expect(getComputedStyle(q('lr-progress-bar', 'indicator')).backgroundColor).to.not.equal(canvas);
    expect(getComputedStyle(q('lr-progress-bar', 'track')).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(q('lr-progress-ring', 'indicator')).stroke).to.not.equal(
      getComputedStyle(q('lr-progress-ring', 'track')).stroke
    );
    expect(getComputedStyle(q('lr-rating', 'star-fill')).color).to.not.equal(
      getComputedStyle(q('lr-rating', 'star')).color
    );
    expect(getComputedStyle(q('lr-chip', 'base', 0)).backgroundColor).to.not.equal(
      getComputedStyle(q('lr-chip', 'base', 1)).backgroundColor
    );
  });
});

describe('kbd bidi isolation', () => {
  it('isolates key caps as left-to-right under dir=rtl', async () => {
    const host = await fixture<HTMLDivElement>(html`<div dir="rtl"><lr-kbd keys="Ctrl+K"></lr-kbd></div>`);
    const key = host.querySelector('lr-kbd')!.shadowRoot!.querySelector('[part="key"]') as HTMLElement;
    const cs = getComputedStyle(key);
    expect(cs.direction).to.equal('ltr');
    expect(cs.unicodeBidi).to.equal('isolate');
  });
});

describe('callout close hover', () => {
  it('does not wash the close glyph out with a brand fill on a non-brand variant', async () => {
    const el = await fixture<LyraCallout>(html`<lr-callout variant="danger" closable>Message</lr-callout>`);
    const hover = getComputedStyle(el.renderRoot.querySelector('[part="close-button"]')!)
      .getPropertyValue('--_lr-icon-button-background-hover-default');
    expect(hover.includes('brand')).to.equal(false);
    const host = getComputedStyle(el).getPropertyValue('--_lr-callout-close-hover-bg');
    expect(host.includes('brand')).to.equal(false);
  });
});
