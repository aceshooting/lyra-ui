import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-stat.js';
import type { LyraStat } from '../../lr-stat.js';

const valueStyle = (el: LyraStat) => getComputedStyle(el.shadowRoot!.querySelector('[part="value"]')!);

describe('lr-stat value font', () => {
  it('renders the value in the surrounding text font with tabular digits, not a monospace face', async () => {
    const el = await fixture<LyraStat>(html`<div style="font-family: serif"><lr-stat label="Top" value="Housing"></lr-stat></div>`).then(
      (wrap) => wrap.querySelector('lr-stat') as LyraStat,
    );
    await el.updateComplete;
    const style = valueStyle(el);
    expect(style.fontFamily).to.equal(getComputedStyle(el).fontFamily);
    expect(style.fontVariantNumeric).to.equal('tabular-nums');
  });

  it('lets authors opt back into a monospace face through --lr-stat-value-font-family', async () => {
    const el = await fixture<LyraStat>(
      html`<lr-stat style="--lr-stat-value-font-family: monospace" label="Rate" value="2.4"></lr-stat>`,
    );
    await el.updateComplete;
    expect(valueStyle(el).fontFamily).to.equal('monospace');
  });
});
