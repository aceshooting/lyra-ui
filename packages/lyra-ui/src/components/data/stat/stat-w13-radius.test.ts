import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-stat.js';
import type { LyraStat } from '../../lr-stat.js';

const base = (el: LyraStat) => getComputedStyle(el.shadowRoot!.querySelector('[part="base"]')!);

describe('lr-stat --lr-stat-radius', () => {
  it('keeps --lr-radius while unset and takes the token when set', async () => {
    const plain = await fixture<LyraStat>(html`<lr-stat label="A" value="1"></lr-stat>`);
    const probe = document.createElement('div');
    probe.style.borderRadius = 'var(--lr-radius)';
    plain.shadowRoot!.append(probe);
    const expected = getComputedStyle(probe).borderTopLeftRadius;
    probe.remove();
    expect(base(plain).borderTopLeftRadius).to.equal(expected);
    const el = await fixture<LyraStat>(html`<lr-stat style="--lr-stat-radius: 17px" label="A" value="1"></lr-stat>`);
    expect(base(el).borderTopLeftRadius).to.equal('17px');
  });
});
