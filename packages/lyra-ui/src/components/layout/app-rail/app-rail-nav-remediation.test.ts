import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse, settlePointer } from '../../../../test/wtr-mouse.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import type { LyraAppRail } from './app-rail.class.js';
import type { LyraAppRailItem } from './app-rail-item.class.js';
import './app-rail.js';
import './app-rail-item.js';

describe('lr-app-rail-item current row', () => {
  it('shows hover feedback on the current row', async () => {
    const el = await fixture<LyraAppRailItem>(
      html`<lr-app-rail-item href="/a" current>Inbox</lr-app-rail-item>`,
    );
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const resting = getComputedStyle(base).backgroundColor;
    try {
      await hoverUntilMatched(el, 'the current row never matched :hover');
      await waitUntil(() => getComputedStyle(base).backgroundColor !== resting, 'current hover fill never differed from the resting fill');
      expect(getComputedStyle(base).backgroundColor).not.to.equal(resting);
    } finally {
      await resetMouse();
    }
    await settlePointer();
  });

  it('keeps a distinguishable current row under forced colors, including icon-only', async () => {
    try {
      await setForcedColors('active');
      const el = await fixture<LyraAppRailItem>(html`<div>
        <lr-app-rail-item href="/a" current icon-only>A</lr-app-rail-item>
        <lr-app-rail-item href="/b" icon-only>B</lr-app-rail-item>
      </div>`).then((host) => [...host.querySelectorAll<LyraAppRailItem>('lr-app-rail-item')]);
      const [current, other] = el.map((item) => item.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!);
      expect(getComputedStyle(current!).outlineStyle).to.equal('solid');
      expect(getComputedStyle(other!).outlineStyle).to.equal('none');
    } finally {
      await setForcedColors('none');
    }
  });
});

describe('lr-app-rail resizer direction', () => {
  it('reads an inherited direction the same as a host dir attribute', async () => {
    const widths: number[] = [];
    for (const wrapperDir of [true, false]) {
      const markup = wrapperDir
        ? html`<div dir="rtl"><lr-app-rail force-mode="full" resizable rail-width="240" min-rail-width="190" max-rail-width="320"></lr-app-rail></div>`
        : html`<lr-app-rail dir="rtl" force-mode="full" resizable rail-width="240" min-rail-width="190" max-rail-width="320"></lr-app-rail>`;
      const root = await fixture<HTMLElement>(markup);
      const el = (root.localName === 'lr-app-rail' ? root : root.querySelector('lr-app-rail')) as LyraAppRail;
      const resizer = el.shadowRoot!.querySelector<HTMLElement>('[part="resizer"]')!;
      await focusByKeyboard(resizer);
      await sendKeys({ press: 'ArrowRight' });
      await el.updateComplete;
      widths.push(el.railWidth as number);
    }
    expect(widths[0]).to.equal(widths[1]);
    expect(widths[0]).not.to.equal(240);
  });
});
