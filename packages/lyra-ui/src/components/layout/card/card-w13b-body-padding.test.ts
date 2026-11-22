import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-card.js';
import type { LyraCard } from '../../lr-card.js';

const pad = (el: LyraCard, part: string) => getComputedStyle(el.shadowRoot!.querySelector(`[part="${part}"]`)!).paddingTop;

describe('lr-card --lr-card-body-padding', () => {
  it('pads only the body, leaving header and footer on --spacing', async () => {
    const el = await fixture<LyraCard>(html`<lr-card style="--spacing: 20px; --lr-card-body-padding: 3px">
      <span slot="header">H</span>B<span slot="footer">F</span>
    </lr-card>`);
    expect([pad(el, 'body'), pad(el, 'header'), pad(el, 'footer')]).to.deep.equal(['3px', '20px', '20px']);
  });

  it('keeps the body on --spacing while the token is unset', async () => {
    const el = await fixture<LyraCard>(html`<lr-card style="--spacing: 20px">B</lr-card>`);
    expect(pad(el, 'body')).to.equal('20px');
  });
});
