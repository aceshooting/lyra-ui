import { expect, fixture, html } from '@open-wc/testing';
import type { LyraAppRail } from './app-rail.class.js';
import '../../lr-app-rail.js';

function mobile(rail: LyraAppRail): void {
  (rail as unknown as { onMobileChange(event: { matches: boolean }): void }).onMobileChange({ matches: true });
}
const toggle = (rail: LyraAppRail): HTMLElement => rail.shadowRoot!.querySelector<HTMLElement>('[part="toggle"]')!;

// --lr-icon-button-size at the default root size.
const FLOOR_PX = 35.5;
const PLACED =
  '--lr-transition-base: 0ms; --lr-app-rail-toggle-position: fixed; --lr-app-rail-toggle-inset-block-start: 11px; --lr-app-rail-toggle-inset-inline-start: 13px; --lr-app-rail-toggle-size: 48px; --lr-app-rail-toggle-radius: 7px';

async function mount(dir: string, style: string): Promise<LyraAppRail> {
  const el = await fixture<LyraAppRail>(html`<lr-app-rail dir=${dir} style=${style}><button>One</button></lr-app-rail>`);
  mobile(el);
  await el.updateComplete;
  await el.updateComplete;
  return el;
}

describe('app rail mobile toggle placement', () => {
  for (const dir of ['ltr', 'rtl'] as const) {
    it(`floats, sizes and rounds the collapsed toggle from its tokens in ${dir}`, async () => {
      const el = await mount(dir, PLACED);
      const button = toggle(el);
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      expect([style.position, style.borderTopLeftRadius]).to.deep.equal(['fixed', '7px']);
      expect([Math.round(rect.width), Math.round(rect.height), Math.round(rect.top)]).to.deep.equal([48, 48, 11]);
      if (dir === 'ltr') expect(Math.round(rect.left)).to.equal(13);
      else expect(Math.round(document.documentElement.clientWidth - rect.right)).to.equal(13);
    });
  }

  it('keeps the hit-area floor and the in-flow defaults when unset or undersized', async () => {
    const plain = await mount('ltr', '--lr-transition-base: 0ms');
    const plainStyle = getComputedStyle(toggle(plain));
    expect([plainStyle.position, plainStyle.top, plainStyle.insetInlineStart]).to.deep.equal(['static', 'auto', 'auto']);
    expect(toggle(plain).getBoundingClientRect().width).to.be.at.least(FLOOR_PX);
    const tiny = await mount('ltr', '--lr-app-rail-toggle-size: 8px');
    const rect = toggle(tiny).getBoundingClientRect();
    expect(rect.width).to.be.at.least(FLOOR_PX);
    expect(rect.height).to.be.at.least(FLOOR_PX);
  });

  it('drops the floating placement once the toggle moves into the open panel', async () => {
    const el = await mount('ltr', PLACED);
    el.open = true;
    await el.updateComplete;
    const button = toggle(el);
    expect(button.parentElement?.getAttribute('part')).to.equal('panel');
    const style = getComputedStyle(button);
    // A relatively positioned auto inset resolves to 0px: no offset from its panel row.
    expect([style.position, style.top, style.insetInlineStart]).to.deep.equal(['relative', '0px', '0px']);
  });
});
