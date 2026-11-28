import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-button.js';

const base = (el: Element): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;

describe('lr-button --lr-button-min-inline-size', () => {
  it('unset keeps min-inline-size 0 and shrink-wraps the label', async () => {
    const el = await fixture<HTMLElement>(html`<lr-button>Hi</lr-button>`);
    expect(getComputedStyle(base(el)).minInlineSize).to.equal('0px');
    expect(el.getBoundingClientRect().width).to.be.lessThan(120);
  });

  it('a short and a long label end equal width when the token is set, and the host grows', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="--lr-button-min-inline-size: 400px">
      <lr-button>No</lr-button><lr-button>Save changes</lr-button>
    </div>`);
    const [a, b] = Array.from(wrap.querySelectorAll('lr-button'));
    expect(getComputedStyle(base(a!)).minInlineSize).to.equal('400px');
    expect(a!.getBoundingClientRect().width).to.be.at.least(399.5);
    expect(Math.abs(a!.getBoundingClientRect().width - b!.getBoundingClientRect().width)).to.be.lessThan(1);
    expect(Math.abs(base(a!).getBoundingClientRect().width - a!.getBoundingClientRect().width)).to.be.lessThan(1);
  });
});
