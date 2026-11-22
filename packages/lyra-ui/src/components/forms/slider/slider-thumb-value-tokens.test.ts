import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-slider.js';

const part = (el: Element, name: string): CSSStyleDeclaration =>
  getComputedStyle(el.shadowRoot!.querySelector(`[part~="${name}"]`)!);

describe('lr-slider thumb and value tokens', () => {
  it('styles the thumb border width and elevation, and the readout colour and font', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-slider with-value value="4"></lr-slider>
      <lr-slider with-value value="4" style="--lr-slider-thumb-border-width: 5px; --lr-slider-thumb-shadow: 0 0 0 3px rgb(1, 2, 3); --lr-slider-value-color: rgb(4, 5, 6); --lr-slider-value-font-family: monospace"></lr-slider>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-slider'));
    await (themed as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    const probe = document.createElement('div');
    probe.style.cssText = 'border-top: var(--lr-border-width-medium) solid; box-shadow: var(--lr-shadow-s); color: var(--lr-color-text-quiet)';
    plain!.shadowRoot!.append(probe);
    const expected = getComputedStyle(probe);
    expect([part(plain!, 'thumb').borderTopWidth, part(plain!, 'thumb').boxShadow, part(plain!, 'value').color])
      .to.deep.equal([expected.borderTopWidth, expected.boxShadow, expected.color]);
    probe.remove();
    expect(part(themed!, 'thumb').borderTopWidth).to.equal('5px');
    expect(part(themed!, 'thumb').boxShadow).to.equal('rgb(1, 2, 3) 0px 0px 0px 3px');
    expect([part(themed!, 'value').color, part(themed!, 'value').fontFamily]).to.deep.equal(['rgb(4, 5, 6)', 'monospace']);
  });
});
