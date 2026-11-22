import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-chart.js';
import '../../lr-doughnut-chart.js';
import '../../lr-lite-chart.js';

const TOKENS = [
  '--lr-chart-legend-gap: 7px',
  '--lr-chart-legend-padding: 5px',
  '--lr-chart-legend-font-size: 11px',
  '--lr-chart-legend-item-min-height: 22px',
  '--lr-chart-legend-item-padding: 3px',
  '--lr-chart-legend-swatch-size: 9px',
  '--lr-chart-legend-swatch-radius: 6px',
].join(';');

interface LegendStyle {
  gap: string; padding: string; fontSize: string; minHeight: string; itemPadding: string;
  swatch: string; swatchHeight: string; radius: string;
}

function legendStyle(root: ShadowRoot): LegendStyle {
  const legend = getComputedStyle(root.querySelector('[part="legend"]')!);
  const item = getComputedStyle(root.querySelector('[part~="legend-item"]')!);
  const swatch = getComputedStyle(root.querySelector('[part="legend-swatch"]')!);
  return {
    gap: legend.columnGap, padding: legend.paddingBlockStart, fontSize: item.fontSize,
    minHeight: item.minBlockSize, itemPadding: item.paddingInlineStart,
    swatch: swatch.inlineSize, swatchHeight: swatch.blockSize, radius: swatch.borderTopLeftRadius,
  };
}

async function mountCanvas(tag: 'lr-chart' | 'lr-doughnut-chart', style: string): Promise<ShadowRoot> {
  const host = await fixture<HTMLElement>(html`<div style=${style}></div>`);
  const chart = document.createElement(tag) as HTMLElement & { chart?: unknown; updateComplete: Promise<boolean> };
  Object.assign(chart, { labels: ['A', 'B'], datasets: [{ label: 'First', data: [1, 2] }], withoutAnimation: true });
  chart.style.inlineSize = '320px';
  host.append(chart);
  await waitUntil(() => !!chart.shadowRoot?.querySelector('[part="legend-swatch"]'), 'legend renders', { timeout: 5000 });
  await chart.updateComplete;
  return chart.shadowRoot!;
}

describe('chart legend tokens', () => {
  for (const tag of ['lr-chart', 'lr-doughnut-chart'] as const) {
    it(`${tag} applies every legend token and keeps the defaults when unset`, async () => {
      const themed = legendStyle(await mountCanvas(tag, TOKENS));
      expect(themed).to.deep.equal({
        gap: '7px', padding: '5px', fontSize: '11px', minHeight: '22px', itemPadding: '3px',
        swatch: '9px', swatchHeight: '9px', radius: '6px',
      });
      const defaults = legendStyle(await mountCanvas(tag, 'font-size:16px'));
      expect(defaults.fontSize).to.equal('16px');
      expect(defaults.minHeight).to.equal('36px');
      expect(defaults.swatch).to.equal(defaults.swatchHeight);
      expect(defaults.gap).to.not.equal('7px');
      expect(defaults.radius).to.not.equal('6px');
    });
  }

  it('lr-lite-chart applies the shared legend tokens and keeps its own defaults when unset', async () => {
    const mount = async (style: string): Promise<ShadowRoot> => {
      const host = await fixture<HTMLElement>(html`<div style=${style}><lr-lite-chart with-legend style="inline-size:320px"
        .labels=${['A', 'B']} .datasets=${[{ label: 'First', data: [1, 2] }]}></lr-lite-chart></div>`);
      const chart = host.firstElementChild as HTMLElement & { updateComplete: Promise<boolean> };
      await chart.updateComplete;
      return chart.shadowRoot!;
    };
    const themed = legendStyle(await mount(TOKENS));
    expect([themed.gap, themed.padding, themed.fontSize, themed.swatch, themed.swatchHeight, themed.radius])
      .to.deep.equal(['7px', '5px', '11px', '9px', '9px', '6px']);
    const defaults = legendStyle(await mount(''));
    expect(defaults.fontSize).to.equal('12px');
    expect(defaults.gap).to.equal('8px');
  });
});

describe('chart legend justify and item line height tokens', () => {
  const layout = (root: ShadowRoot) => ({
    justify: getComputedStyle(root.querySelector('[part="legend"]')!).justifyContent,
    lineHeight: getComputedStyle(root.querySelector('[part~="legend-item"]')!).lineHeight,
  });
  const THEMED = 'line-height: 15px; --lr-chart-legend-justify: space-between; --lr-chart-legend-item-line-height: 23px';

  for (const tag of ['lr-chart', 'lr-doughnut-chart'] as const) {
    it(`${tag} justifies the legend row and sets the item line height; unset it keeps normal and inherits`, async () => {
      expect(layout(await mountCanvas(tag, THEMED))).to.deep.equal({ justify: 'space-between', lineHeight: '23px' });
      expect(layout(await mountCanvas(tag, 'line-height: 15px'))).to.deep.equal({ justify: 'normal', lineHeight: '15px' });
    });
  }

  it('lr-lite-chart keeps its centred legend unset and follows the same tokens', async () => {
    const mount = async (style: string): Promise<ShadowRoot> => {
      const host = await fixture<HTMLElement>(html`<div style=${style}><lr-lite-chart with-legend style="inline-size:320px"
        .labels=${['A', 'B']} .datasets=${[{ label: 'First', data: [1, 2] }]}></lr-lite-chart></div>`);
      const chart = host.firstElementChild as HTMLElement & { updateComplete: Promise<boolean> };
      await chart.updateComplete;
      return chart.shadowRoot!;
    };
    expect(layout(await mount(THEMED))).to.deep.equal({ justify: 'space-between', lineHeight: '23px' });
    expect(layout(await mount('line-height: 15px'))).to.deep.equal({ justify: 'center', lineHeight: '15px' });
  });
});
