import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-segmented.js';
import type { LyraSegmented } from '../../lr-segmented.js';

const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];

describe('lr-segmented --lr-segmented-segment-min-size', () => {
  it('keeps the 24px floor unset and raises both axes when set', async () => {
    const plain = await fixture<LyraSegmented>(html`<lr-segmented label="L" .items=${items}></lr-segmented>`);
    const seg = plain.shadowRoot!.querySelector('[part="segment"]') as HTMLElement;
    expect([getComputedStyle(seg).minWidth, getComputedStyle(seg).minHeight]).to.deep.equal(['24px', '24px']);
    const big = await fixture<LyraSegmented>(html`<lr-segmented label="L" .items=${items} style="--lr-segmented-segment-min-size: 60px"></lr-segmented>`);
    const s2 = big.shadowRoot!.querySelector('[part="segment"]') as HTMLElement;
    expect(s2.getBoundingClientRect().width).to.be.at.least(60);
    expect(s2.getBoundingClientRect().height).to.be.at.least(60);
  });
});
