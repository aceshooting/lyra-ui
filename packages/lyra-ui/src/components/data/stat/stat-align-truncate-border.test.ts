import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-stat.js';
import type { LyraStat } from '../../lr-stat.js';

const part = (el: Element, name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
const style = (el: Element, name: string) => getComputedStyle(part(el, name));

describe('lr-stat alignment, truncation, label line height and border colour', () => {
  it('centres the stacked tile content through --lr-stat-align and stretches it unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 300px">
      <lr-stat label="Rate" value="2.4" delta-percent="3"></lr-stat>
      <lr-stat label="Rate" value="2.4" delta-percent="3" style="--lr-stat-align: center"></lr-stat>
    </div>`);
    const [plain, centred] = Array.from(wrap.querySelectorAll('lr-stat')) as LyraStat[];
    expect([style(plain!, 'base').alignItems, style(plain!, 'label').textAlign]).to.deep.equal(['normal', 'start']);
    expect([style(centred!, 'base').alignItems, style(centred!, 'label').textAlign, style(centred!, 'value-row').justifyContent])
      .to.deep.equal(['center', 'center', 'center']);
    const base = part(centred!, 'base').getBoundingClientRect();
    const value = part(centred!, 'value').getBoundingClientRect();
    expect(Math.abs(value.left + value.width / 2 - (base.left + base.width / 2))).to.be.below(20);
    expect(style(centred!, 'trend').alignSelf).to.equal('center');
  });

  it('truncate keeps a long value on one ellipsized line; unset it wraps', async () => {
    const long = 'A very long headline value that cannot fit';
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 160px">
      <lr-stat label="L" value=${long}></lr-stat><lr-stat truncate label="L" value=${long}></lr-stat>
    </div>`);
    const [plain, truncated] = Array.from(wrap.querySelectorAll('lr-stat')) as LyraStat[];
    expect(truncated!.truncate).to.equal(true);
    const lineHeight = (el: LyraStat) => part(el, 'value').getBoundingClientRect().height;
    expect(lineHeight(plain!)).to.be.greaterThan(lineHeight(truncated!) * 1.5);
    expect([style(truncated!, 'value').textOverflow, style(truncated!, 'value').whiteSpace]).to.deep.equal(['ellipsis', 'nowrap']);
    expect(part(truncated!, 'value').textContent).to.contain(long);
    const host = await fixture<LyraStat>(html`<lr-stat label="L" value="1"></lr-stat>`);
    expect(host.hasAttribute('truncate')).to.equal(false);
  });

  it('routes --lr-stat-label-line-height and --lr-stat-border-color, linked tiles included', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="line-height: 17px">
      <lr-stat label="L" value="1"></lr-stat>
      <lr-stat label="L" value="1" style="--lr-stat-label-line-height: 29px; --lr-stat-border-color: rgb(1, 2, 3)"></lr-stat>
      <lr-stat label="L" value="1" href="#x" style="--lr-stat-border-color: rgb(4, 5, 6)"></lr-stat>
    </div>`);
    const [plain, themed, linked] = Array.from(wrap.querySelectorAll('lr-stat')) as LyraStat[];
    expect(style(plain!, 'label').lineHeight).to.equal('17px');
    expect([style(themed!, 'label').lineHeight, style(themed!, 'base').borderTopColor]).to.deep.equal(['29px', 'rgb(1, 2, 3)']);
    expect(style(linked!, 'base').borderTopColor).to.equal('rgb(4, 5, 6)');
    const probe = document.createElement('span');
    probe.style.color = 'var(--lr-color-border-subtle)';
    plain!.shadowRoot!.append(probe);
    expect(style(plain!, 'base').borderTopColor).to.equal(getComputedStyle(probe).color);
    probe.remove();
  });
});
