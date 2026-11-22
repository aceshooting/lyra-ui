import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-badge.js';
import type { LyraBadge } from '../../lr-badge.js';

const base = (el: LyraBadge) => getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!);

describe('lr-badge type tokens', () => {
  it('keeps medium weight and compact line height unset', async () => {
    const el = await fixture<LyraBadge>(html`<lr-badge>New</lr-badge>`);
    expect(base(el).fontWeight).to.equal('500');
  });

  it('applies --lr-badge-font-weight and --lr-badge-line-height', async () => {
    const el = await fixture<LyraBadge>(
      html`<lr-badge style="--lr-badge-font-weight: 800; --lr-badge-line-height: 30px">New</lr-badge>`,
    );
    expect([base(el).fontWeight, base(el).lineHeight]).to.deep.equal(['800', '30px']);
  });
});
