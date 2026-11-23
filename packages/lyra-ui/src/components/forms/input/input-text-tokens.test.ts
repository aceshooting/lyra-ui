import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-input.js';
import '../../lr-number-input.js';

const field = (el: Element): CSSStyleDeclaration => getComputedStyle(el.shadowRoot!.querySelector('[part="input"]')!);

describe('lr-input line height and numeric direction tokens', () => {
  it('--lr-input-line-height sets the native field line height; unset it inherits the host', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="line-height: 29px">
      <lr-input></lr-input><lr-input style="--lr-input-line-height: 41px"></lr-input>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll<HTMLElement & { updateComplete: Promise<boolean> }>('lr-input'));
    await Promise.all([plain!.updateComplete, themed!.updateComplete]);
    expect([field(plain!).lineHeight, field(themed!).lineHeight]).to.deep.equal(['29px', '41px']);
  });

  it('--lr-input-number-direction sets the direction of numeric content only', async () => {
    const wrap = await fixture<HTMLElement>(html`<div dir="rtl">
      <lr-input type="number"></lr-input>
      <div style="--lr-input-number-direction: rtl">
        <lr-input type="number"></lr-input><lr-number-input localized></lr-number-input><lr-input value="abc"></lr-input>
      </div>
    </div>`);
    const [plain, number, localized, text] = Array.from(wrap.querySelectorAll<HTMLElement & { updateComplete: Promise<boolean> }>('lr-input, lr-number-input'));
    await Promise.all([plain, number, localized, text].map((element) => element!.updateComplete));
    expect(field(plain!).direction).to.equal('ltr');
    expect([field(number!).direction, field(localized!).direction]).to.deep.equal(['rtl', 'rtl']);
    expect(text!.shadowRoot!.querySelector('[part="input"]')!.getAttribute('dir')).to.equal('auto');
  });
});
