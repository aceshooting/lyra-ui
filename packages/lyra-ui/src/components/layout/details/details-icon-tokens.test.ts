import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-details.js';

const icon = (el: Element) => el.shadowRoot!.querySelector('[part~="icon"]')!;

describe('lr-details icon tokens', () => {
  it('colours and sizes the built-in chevron; unset it follows the summary at 1rem', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-details summary="S" style="--lr-details-summary-color: rgb(9, 9, 9)">Body</lr-details>
      <lr-details summary="S" style="--lr-details-icon-color: rgb(1, 2, 3); --lr-details-icon-size: 22px">Body</lr-details>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-details'));
    expect(getComputedStyle(icon(plain!)).color).to.equal('rgb(9, 9, 9)');
    expect(icon(plain!).querySelector('svg')!.getBoundingClientRect().width).to.equal(16);
    expect(getComputedStyle(icon(themed!)).color).to.equal('rgb(1, 2, 3)');
    const svg = icon(themed!).querySelector('svg')!.getBoundingClientRect();
    expect([svg.width, svg.height]).to.deep.equal([22, 22]);
  });
});
