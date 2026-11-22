import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-empty.js';

const icon = (el: Element) => getComputedStyle(el.shadowRoot!.querySelector('[part="icon"]')!).color;

it('lr-empty --lr-empty-icon-color recolours the glyph and keeps the quiet tone unset', async () => {
  const wrap = await fixture<HTMLElement>(html`<div>
    <lr-empty heading="None"><span>*</span></lr-empty>
    <lr-empty heading="None" style="--lr-empty-icon-color: rgb(1, 2, 3)"><span>*</span></lr-empty>
  </div>`);
  const [plain, themed] = Array.from(wrap.querySelectorAll('lr-empty'));
  const probe = document.createElement('span');
  probe.style.color = 'var(--lr-color-text-quiet)';
  plain!.shadowRoot!.append(probe);
  expect(icon(plain!)).to.equal(getComputedStyle(probe).color);
  probe.remove();
  expect(icon(themed!)).to.equal('rgb(1, 2, 3)');
});
