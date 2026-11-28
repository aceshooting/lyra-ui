import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-badge.js';
import '../../lr-tag.js';
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

describe('lr-badge and lr-tag font-family token', () => {
  it('keeps the inherited family when unset', async () => {
    const host = await fixture<HTMLElement>(
      html`<div style="font-family: Georgia, serif"><lr-badge>New</lr-badge><lr-tag>Tag</lr-tag></div>`,
    );
    for (const el of Array.from(host.querySelectorAll<LyraBadge>('lr-badge, lr-tag'))) {
      expect(base(el).fontFamily).to.equal(getComputedStyle(el).fontFamily);
    }
  });

  it('applies --lr-badge-font-family to both lr-badge and lr-tag', async () => {
    const host = await fixture<HTMLElement>(
      html`<div style="--lr-badge-font-family: monospace"><lr-badge>v1</lr-badge><lr-tag>v2</lr-tag></div>`,
    );
    for (const el of Array.from(host.querySelectorAll<LyraBadge>('lr-badge, lr-tag'))) {
      expect(base(el).fontFamily).to.equal('monospace');
    }
  });
});
