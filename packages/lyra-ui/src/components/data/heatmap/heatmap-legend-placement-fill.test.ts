import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-heatmap.js';
import type { LyraHeatmap } from '../../lr-heatmap.js';
import type { HeatmapMatrixData } from './heatmap-model.js';

const small: HeatmapMatrixData = {
  kind: 'matrix',
  rowLabels: ['Monday', 'Tuesday'],
  colLabels: ['Morning', 'Evening'],
  values: [[1, 2], [3, 4]],
};
const tall: HeatmapMatrixData = {
  kind: 'matrix',
  rowLabels: Array.from({ length: 200 }, (_v, i) => `Row ${i}`),
  colLabels: ['A', 'B', 'C'],
  values: Array.from({ length: 200 }, (_v, i) => [i, i + 1, i + 2]),
};
const shadow = (el: LyraHeatmap, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const order = (el: LyraHeatmap) =>
  Array.from(shadow(el, '[part="base"]').children, (child) => child.classList.contains('surface-frame') ? 'canvas' : child.getAttribute('part'))
    .filter((p) => p === 'legend' || p === 'canvas' || p === 'grid');

describe('lr-heatmap legend placement and tokens', () => {
  it('keeps the legend after the grid by default and moves it first in DOM order for top', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap label="Load" .data=${small}></lr-heatmap>`);
    expect(el.legendPlacement).to.equal('bottom');
    expect(order(el)).to.deep.equal(['canvas', 'legend']);
    el.legendPlacement = 'top';
    await el.updateComplete;
    expect(el.getAttribute('legend-placement')).to.equal('top');
    expect(order(el)).to.deep.equal(['legend', 'canvas']);
    expect(shadow(el, '[part="legend"]').getBoundingClientRect().bottom)
      .to.be.at.most(shadow(el, '[part="canvas"]').getBoundingClientRect().top + 0.5);
    await expect(el).to.be.accessible();
    el.setAttribute('legend-placement', 'sideways');
    await el.updateComplete;
    expect(el.legendPlacement).to.equal('bottom');
    expect(order(el)).to.deep.equal(['canvas', 'legend']);
  });

  it('places a top legend above the grid under dir=rtl and inside a frozen scrollport layout', async () => {
    const wrap = await fixture<HTMLElement>(html`<div dir="rtl">
      <lr-heatmap label="Load" legend-placement="top" sticky-labels="both" .data=${small}></lr-heatmap>
    </div>`);
    const el = wrap.querySelector<LyraHeatmap>('lr-heatmap')!;
    await el.updateComplete;
    expect(order(el)).to.deep.equal(['legend', 'grid']);
    expect(shadow(el, '[part="legend"]').getBoundingClientRect().bottom)
      .to.be.at.most(shadow(el, '[part="grid"]').getBoundingClientRect().top + 0.5);
    await expect(el).to.be.accessible();
  });

  it('routes legend tokens to the row, ramp and swatches and keeps the current defaults unset', async () => {
    const wrap = await fixture<HTMLElement>(html`<div>
      <lr-heatmap label="Plain" .data=${small} .annotations=${[{ row: 0, col: 0, label: 'Peak' }]}></lr-heatmap>
      <lr-heatmap label="Themed" .data=${small} .annotations=${[{ row: 0, col: 0, label: 'Peak' }]} style="
        --lr-heatmap-legend-font-size: 17px; --lr-heatmap-legend-gap: 9px; --lr-heatmap-legend-color: rgb(1, 2, 3);
        --lr-heatmap-legend-padding: 4px; --lr-heatmap-legend-bg: rgb(4, 5, 6); --lr-heatmap-legend-radius: 5px;
        --lr-heatmap-legend-swatch-size: 14px; --lr-heatmap-legend-ramp-inline-size: 150px;
        --lr-heatmap-legend-ramp-block-size: 12px; --lr-heatmap-legend-ramp-radius: 3px"></lr-heatmap>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll<LyraHeatmap>('lr-heatmap')) as [LyraHeatmap, LyraHeatmap];
    await themed.updateComplete;
    const legend = getComputedStyle(shadow(themed, '[part="legend"]'));
    expect([legend.fontSize, legend.columnGap, legend.color, legend.paddingTop, legend.backgroundColor, legend.borderTopLeftRadius])
      .to.deep.equal(['17px', '9px', 'rgb(1, 2, 3)', '4px', 'rgb(4, 5, 6)', '5px']);
    const bar = getComputedStyle(shadow(themed, '[part="legend"] .bar'));
    expect([bar.inlineSize, bar.blockSize, bar.borderTopLeftRadius]).to.deep.equal(['150px', '12px', '3px']);
    expect(getComputedStyle(shadow(themed, '.ring-swatch')).inlineSize).to.equal('14px');

    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const plainLegend = getComputedStyle(shadow(plain, '[part="legend"]'));
    expect(plainLegend.paddingTop).to.equal('0px');
    expect(plainLegend.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(parseFloat(getComputedStyle(shadow(plain, '[part="legend"] .bar')).inlineSize)).to.equal(rootPx * 6);
    expect(parseFloat(getComputedStyle(shadow(plain, '.ring-swatch')).inlineSize)).to.be.closeTo(rootPx * 0.6, 0.5);
  });

  it('applies the swatch size to legendStops swatches', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap label="Load" style="--lr-heatmap-legend-swatch-size: 13px"
      .data=${small} .legendStops=${[{ value: 0, color: '#000000', label: 'Low' }]}></lr-heatmap>`);
    expect(getComputedStyle(shadow(el, '[part="legend-swatch"]')).blockSize).to.equal('13px');
  });
});

describe('lr-heatmap fill', () => {
  it('makes the grid the single scroller inside a definite-height flex parent', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="display: flex; flex-direction: column; block-size: 300px; overflow: auto">
      <lr-heatmap fill label="Tall" .data=${tall}></lr-heatmap>
    </div>`);
    const el = wrap.querySelector<LyraHeatmap>('lr-heatmap')!;
    await el.updateComplete;
    const grid = shadow(el, '[part="grid"]');
    await waitUntil(() => grid.scrollHeight > grid.clientHeight, 'the grid scrolls its own content');
    expect(grid.clientHeight).to.be.at.most(300);
    expect(wrap.scrollHeight).to.be.at.most(wrap.clientHeight);
    expect(Math.round(el.getBoundingClientRect().height)).to.equal(300);
    // The legend stays visible below the scroller.
    expect(shadow(el, '[part="legend"]').getBoundingClientRect().bottom).to.be.at.most(wrap.getBoundingClientRect().bottom + 0.5);
    el.fill = false;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="grid"]') === null).to.equal(true);
    await waitUntil(() => wrap.scrollHeight > wrap.clientHeight, 'without fill the parent scrolls again');
  });

  it('leaves an auto-height parent and calendar mode unchanged', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap fill label="Small" .data=${small}></lr-heatmap>`);
    const canvasHeight = shadow(el, '[part="canvas"]').getBoundingClientRect().height;
    const grid = shadow(el, '[part="grid"]');
    expect(grid.scrollHeight).to.be.at.most(grid.clientHeight);
    expect(grid.getBoundingClientRect().height).to.be.closeTo(canvasHeight, 1);
    el.data = { kind: 'calendar', days: [{ date: '2024-01-01', value: 1 }] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="grid"]') === null).to.equal(true);
  });
});

describe('lr-heatmap legend font and divider tokens', () => {
  it('sets the legend font family and draws the divider on the edge facing the grid', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap label="Load" .data=${small}></lr-heatmap>`);
    const legend = () => shadow(el, '[part="legend"]');
    const edges = () => { const style = getComputedStyle(legend()); return [style.borderTopStyle, style.borderBottomStyle]; };
    const defaultFamily = getComputedStyle(legend()).fontFamily;
    expect(edges(), 'no divider by default').to.deep.equal(['none', 'none']);
    el.style.setProperty('--lr-heatmap-legend-font-family', 'monospace');
    el.style.setProperty('--lr-heatmap-legend-divider', '2px dashed rgb(1, 2, 3)');
    expect(getComputedStyle(legend()).fontFamily).to.equal('monospace');
    expect([getComputedStyle(legend()).borderTopWidth, getComputedStyle(legend()).borderTopColor, ...edges()])
      .to.deep.equal(['2px', 'rgb(1, 2, 3)', 'dashed', 'none']);
    el.legendPlacement = 'top';
    await el.updateComplete;
    expect(edges(), 'a top legend divides on its block end').to.deep.equal(['none', 'dashed']);
    el.style.removeProperty('--lr-heatmap-legend-font-family');
    el.style.removeProperty('--lr-heatmap-legend-divider');
    expect([getComputedStyle(legend()).fontFamily, ...edges()]).to.deep.equal([defaultFamily, 'none', 'none']);
  });
});

describe('lr-heatmap fit-block', () => {
  it('fits within its own max-block-size inside an auto-height parent and scrolls the grid', async () => {
    const wrap = await fixture<HTMLElement>(html`<div><lr-heatmap fit-block label="Tall" style="max-block-size: 240px" .data=${tall}></lr-heatmap></div>`);
    const el = wrap.querySelector<LyraHeatmap>('lr-heatmap')!;
    await el.updateComplete;
    expect(el.fitBlock).to.equal(true);
    const grid = shadow(el, '[part="grid"]');
    await waitUntil(() => grid.scrollHeight > grid.clientHeight, 'the grid scrolls its own content');
    expect(Math.round(el.getBoundingClientRect().height)).to.equal(240);
    const legend = shadow(el, '[part="legend"]').getBoundingClientRect();
    expect(legend.height).to.be.above(0);
    expect(legend.bottom, 'the legend stays inside the ceiling').to.be.at.most(el.getBoundingClientRect().bottom + 0.5);
    el.fitBlock = false;
    await el.updateComplete;
    expect(el.hasAttribute('fit-block')).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="grid"]') === null, 'unset removes the scrollport').to.equal(true);
  });

  it('keeps a short matrix at its content height and a calendar unchanged', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap fit-block label="Small" style="max-block-size: 600px" .data=${small}></lr-heatmap>`);
    const grid = shadow(el, '[part="grid"]');
    const canvasHeight = shadow(el, '[part="canvas"]').getBoundingClientRect().height;
    expect(grid.scrollHeight).to.be.at.most(grid.clientHeight);
    expect(grid.getBoundingClientRect().height).to.be.closeTo(canvasHeight, 1);
    expect(el.getBoundingClientRect().height).to.be.below(600);
    el.data = { kind: 'calendar', days: [{ date: '2024-01-01', value: 1 }] };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="grid"]') === null).to.equal(true);
  });
});
