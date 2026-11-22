import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-sequence-playback.js';
import type { LyraSequencePlayback } from '../../lr-sequence-playback.js';

const value = (el: LyraSequencePlayback) => el.shadowRoot!.querySelector('[part="value"]') as HTMLElement;

describe('lr-sequence-playback value readout tokens', () => {
  it('keeps the small inherited readout while the tokens are unset', async () => {
    const el = await fixture<LyraSequencePlayback>(
      html`<lr-sequence-playback aria-label="Playback" with-value item-count="3"></lr-sequence-playback>`,
    );
    const style = getComputedStyle(value(el));
    expect(style.fontFamily).to.equal(getComputedStyle(el).fontFamily);
    expect(style.fontWeight).to.equal(getComputedStyle(el).fontWeight);
    expect(style.minWidth).to.equal('0px');
  });

  it('applies font, size, weight, min-width and alignment tokens', async () => {
    const el = await fixture<LyraSequencePlayback>(html`<lr-sequence-playback
      aria-label="Playback" with-value item-count="3"
      style="--lr-sequence-playback-value-font-family: monospace; --lr-sequence-playback-value-font-size: 22px; --lr-sequence-playback-value-font-weight: 700; --lr-sequence-playback-value-min-width: 120px; --lr-sequence-playback-value-text-align: end"
    ></lr-sequence-playback>`);
    const style = getComputedStyle(value(el));
    expect([style.fontFamily, style.fontSize, style.fontWeight, style.minWidth, style.textAlign])
      .to.deep.equal(['monospace', '22px', '700', '120px', 'end']);
    expect(value(el).getBoundingClientRect().width).to.be.at.least(120);
  });
});
