import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import '../../lr-button.js';

const base = (el: Element): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;

describe('lr-button line height and link tokens', () => {
  afterEach(async () => {
    await resetMouse();
  });

  it('--lr-button-line-height sets the line height in every appearance; unset it inherits', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="line-height: 17px">
      <lr-button>A</lr-button><lr-button style="--lr-button-line-height: 29px">A</lr-button>
      <lr-button appearance="link" style="--lr-button-line-height: 29px">A</lr-button>
    </div>`);
    const [plain, themed, link] = Array.from(wrap.querySelectorAll('lr-button'));
    expect([plain, themed, link].map((el) => getComputedStyle(base(el!)).lineHeight)).to.deep.equal(['17px', '29px', '29px']);
  });

  it('a link drops its underline at rest and shows it on hover only, with an opt-in height floor', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-button appearance="link">Plain</lr-button>
      <lr-button appearance="link" style="--lr-button-link-text-decoration: none; --lr-button-link-min-height: 30px">Hover</lr-button>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-button'));
    expect(getComputedStyle(base(plain!)).textDecorationLine).to.equal('underline');
    expect(getComputedStyle(base(plain!)).minBlockSize).to.equal('0px');
    const link = base(themed!);
    expect(getComputedStyle(link).textDecorationLine).to.equal('none');
    expect(getComputedStyle(link).minBlockSize).to.equal('30px');
    await hoverUntilMatched(link, 'the pointer reaches the link');
    await waitUntil(() => getComputedStyle(link).textDecorationLine === 'underline', 'hover shows the underline');
  });

  it('--lr-button-link-hover-text-decoration owns the hover state', async () => {
    const el = await fixture<HTMLElement>(html`<lr-button appearance="link" style="--lr-button-link-hover-text-decoration: none">A</lr-button>`);
    const link = base(el);
    expect(getComputedStyle(link).textDecorationLine).to.equal('underline');
    await hoverUntilMatched(link, 'the pointer reaches the link');
    await waitUntil(() => getComputedStyle(link).textDecorationLine === 'none', 'hover drops the underline');
  });
});
