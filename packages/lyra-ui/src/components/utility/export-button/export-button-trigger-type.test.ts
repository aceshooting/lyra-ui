import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-export-button.js';

const trigger = (el: Element) => getComputedStyle(el.shadowRoot!.querySelector('[part~="trigger"]')!);
const TOKENS = '--lr-export-button-font-size: 19px; --lr-export-button-font-weight: 700; --lr-export-button-padding-inline: 23px';

describe('lr-export-button trigger typography tokens', () => {
  it('styles the trigger with or without a size tier and leaves the menu rows alone', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="font-size: 13px; font-weight: 400">
      <lr-export-button .formats=${['csv', 'json']}></lr-export-button>
      <lr-export-button size="s" .formats=${['csv', 'json']}></lr-export-button>
      <lr-export-button style=${TOKENS} .formats=${['csv', 'json']}></lr-export-button>
      <lr-export-button size="s" style=${TOKENS} .formats=${['csv', 'json']}></lr-export-button>
    </div>`);
    const [plain, sized, themed, themedSized] = Array.from(wrap.querySelectorAll('lr-export-button'));
    await (themedSized as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    expect([trigger(plain!).fontSize, trigger(plain!).fontWeight]).to.deep.equal(['13px', '400']);
    expect(trigger(plain!).paddingInlineStart).to.not.equal('23px');
    for (const el of [themed, themedSized]) {
      const style = trigger(el!);
      expect([style.fontSize, style.fontWeight, style.paddingInlineStart, style.paddingInlineEnd])
        .to.deep.equal(['19px', '700', '23px', '23px']);
    }
    const row = (el: Element) => el.shadowRoot!.querySelector('[part="menu-item"]');
    const sizedRow = row(sized!);
    const themedRow = row(themedSized!);
    if (sizedRow && themedRow) {
      expect(getComputedStyle(themedRow).fontSize).to.equal(getComputedStyle(sizedRow).fontSize);
      expect(getComputedStyle(themedRow).paddingInlineStart).to.equal(getComputedStyle(sizedRow).paddingInlineStart);
    }
  });
});
