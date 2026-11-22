import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-sequence-playback.js';

describe('lr-sequence-playback full-width', () => {
  for (const withValue of [false, true]) {
    it(`stretches across the container with the slider taking the slack (with-value=${withValue})`, async () => {
      const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 500px">
        <lr-sequence-playback item-count="5" ?with-value=${withValue}></lr-sequence-playback>
        <lr-sequence-playback full-width item-count="5" ?with-value=${withValue}></lr-sequence-playback>
      </div>`);
      const [plain, full] = Array.from(wrap.querySelectorAll('lr-sequence-playback'));
      expect(plain!.getBoundingClientRect().width).to.be.lessThan(400);
      expect(Math.round(full!.getBoundingClientRect().width)).to.equal(500);
      const slider = full!.shadowRoot!.querySelector('[part="slider"]')!.getBoundingClientRect();
      expect(slider.width).to.be.greaterThan(350);
    });
  }
});
