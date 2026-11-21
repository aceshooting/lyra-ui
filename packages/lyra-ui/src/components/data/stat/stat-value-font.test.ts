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

describe('lr-stat typography, icon chip and fill', () => {
  const part = (el: LyraStat, name: string) => getComputedStyle(el.shadowRoot!.querySelector(`[part="${name}"]`)!);
  const tokens = [
    '--lr-stat-value-font-size: 40px', '--lr-stat-value-font-weight: 300',
    '--lr-stat-label-font-size: 15px', '--lr-stat-label-font-weight: 700', '--lr-stat-label-color: rgb(1, 2, 3)',
    '--lr-stat-label-letter-spacing: 3px', '--lr-stat-label-text-transform: none',
    '--lr-stat-unit-font-size: 13px', '--lr-stat-unit-color: rgb(4, 5, 6)',
    '--lr-stat-caption-font-size: 11px', '--lr-stat-caption-color: rgb(7, 8, 9)',
    '--lr-stat-icon-size: 30px', '--lr-stat-icon-radius: 6px', '--lr-stat-icon-bg: rgb(10, 11, 12)',
    '--lr-stat-icon-color: rgb(13, 14, 15)', '--lr-stat-icon-padding: 5px', '--lr-stat-value-font-family: monospace',
  ].join(';');

  it('routes every token to its part and keeps the current defaults when unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-stat label="Rate" value="2.4" unit="%" caption="Today"><span slot="start">i</span></lr-stat>
      <lr-stat style=${tokens} label="Rate" value="2.4" unit="%" caption="Today"><span slot="start">i</span></lr-stat>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-stat')) as [LyraStat, LyraStat];
    await themed.updateComplete;
    const value = part(themed, 'value');
    expect([value.fontSize, value.fontWeight, value.fontFamily]).to.deep.equal(['40px', '300', 'monospace']);
    const label = part(themed, 'label');
    expect([label.fontSize, label.fontWeight, label.color, label.letterSpacing, label.textTransform])
      .to.deep.equal(['15px', '700', 'rgb(1, 2, 3)', '3px', 'none']);
    const unit = part(themed, 'unit');
    expect([unit.fontSize, unit.color]).to.deep.equal(['13px', 'rgb(4, 5, 6)']);
    const caption = part(themed, 'caption');
    expect([caption.fontSize, caption.color]).to.deep.equal(['11px', 'rgb(7, 8, 9)']);
    const icon = part(themed, 'icon');
    expect([icon.fontSize, icon.borderTopLeftRadius, icon.backgroundColor, icon.color, icon.paddingTop])
      .to.deep.equal(['30px', '6px', 'rgb(10, 11, 12)', 'rgb(13, 14, 15)', '5px']);

    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const defaults = part(plain, 'label');
    expect(defaults.textTransform).to.equal('uppercase');
    expect(defaults.fontWeight).to.equal('600');
    expect(parseFloat(defaults.fontSize)).to.be.below(rootPx);
    expect(part(plain, 'value').fontWeight).to.equal('700');
    expect(parseFloat(part(plain, 'value').fontSize)).to.be.above(rootPx);
    expect(part(plain, 'icon').backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(part(plain, 'icon').paddingTop).to.equal('0px');
    expect(part(plain, 'caption').color).to.equal(part(plain, 'label').color);
  });

  it('fill gives grid tiles one height and pins each caption to the block end, linked or not', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; inline-size: 600px">
      <lr-stat fill label="A" value="1" caption="End"></lr-stat>
      <lr-stat fill label="B" value="2" caption="End" .rows=${[{ label: 'x', value: '1' }, { label: 'y', value: '2' }, { label: 'z', value: '3' }]}></lr-stat>
      <lr-stat fill label="C" value="3" caption="End" href="https://example.com/c"></lr-stat>
    </div>`);
    const stats = Array.from(wrap.querySelectorAll('lr-stat')) as [LyraStat, LyraStat, LyraStat];
    await Promise.all(stats.map((stat) => stat.updateComplete));
    expect(stats.every((stat) => stat.hasAttribute('fill'))).to.equal(true);
    const heights = stats.map((stat) => Math.round(stat.getBoundingClientRect().height));
    expect(new Set(heights).size).to.equal(1);
    const baseHeights = stats.map((stat) => Math.round(stat.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect().height));
    expect(baseHeights).to.deep.equal(heights);
    const bottomGap = (stat: LyraStat) => {
      const host = stat.getBoundingClientRect();
      return host.bottom - stat.shadowRoot!.querySelector('[part="caption"]')!.getBoundingClientRect().bottom;
    };
    const base = part(stats[0], 'base');
    const edge = parseFloat(base.paddingBottom) + parseFloat(base.borderBottomWidth);
    // The short tiles' captions sit at the bottom padding edge, not under their value.
    for (const stat of [stats[0], stats[2]]) {
      expect(bottomGap(stat)).to.be.within(parseFloat(base.paddingBottom) - 1, edge + 1);
    }
  });

  it('keeps the caption under the value and the host at content height without fill', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="display: flex; align-items: flex-start; block-size: 400px">
      <lr-stat label="A" value="1" caption="Under"></lr-stat>
    </div>`);
    const stat = wrap.querySelector('lr-stat')!;
    await stat.updateComplete;
    expect(stat.getBoundingClientRect().height).to.be.below(200);
    expect(part(stat, 'caption').marginTop).to.equal('0px');
  });
});
