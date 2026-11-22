import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-menu-label.js';

const base = (el: Element) => getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);

describe('lr-menu-label typography tokens', () => {
  it('routes font family, line height and text transform, inheriting the family and transform unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="font-family: serif; text-transform: lowercase">
      <lr-menu-label>Group</lr-menu-label>
      <lr-menu-label style="--lr-menu-label-font-family: monospace; --lr-menu-label-line-height: 27px; --lr-menu-label-text-transform: uppercase">Group</lr-menu-label>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-menu-label'));
    expect([base(plain!).fontFamily, base(plain!).textTransform])
      .to.deep.equal([getComputedStyle(plain!).fontFamily, 'lowercase']);
    expect([base(themed!).fontFamily, base(themed!).lineHeight, base(themed!).textTransform])
      .to.deep.equal(['monospace', '27px', 'uppercase']);
  });
});
