import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-card.js';

const part = (el: Element, name: string) => getComputedStyle(el.shadowRoot!.querySelector(`[part="${name}"]`)!);

describe('lr-card min block size and fill-body alignment tokens', () => {
  it('floors the card surface, linked or not, and leaves it content-sized unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-card>B</lr-card>
      <lr-card style="--lr-card-min-block-size: 160px">B</lr-card>
      <lr-card href="#x" style="--lr-card-min-block-size: 160px">B</lr-card>
    </div>`);
    const [plain, floored, linked] = Array.from(wrap.querySelectorAll('lr-card'));
    expect(plain!.getBoundingClientRect().height).to.be.lessThan(120);
    expect(Math.round(floored!.getBoundingClientRect().height)).to.equal(160);
    expect(Math.round(linked!.getBoundingClientRect().height)).to.equal(160);
  });

  it('aligns a fill-body column through --lr-card-body-justify and --lr-card-body-align', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-card fill-body>B</lr-card>
      <lr-card fill-body style="--lr-card-body-justify: center; --lr-card-body-align: center">B</lr-card>
    </div>`);
    const [plain, aligned] = Array.from(wrap.querySelectorAll('lr-card'));
    expect([part(plain!, 'body').justifyContent, part(plain!, 'body').alignItems]).to.deep.equal(['normal', 'normal']);
    expect([part(aligned!, 'body').justifyContent, part(aligned!, 'body').alignItems]).to.deep.equal(['center', 'center']);
  });
});
