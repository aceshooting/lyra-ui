import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-heatmap.js';
import type { LyraHeatmap } from '../../lr-heatmap.js';
import type { HeatmapMatrixData } from './heatmap-model.js';

const data: HeatmapMatrixData = { kind: 'matrix', rowLabels: ['A', 'B'], colLabels: ['X', 'Y'], values: [[1, 2], [3, 4]] };
const stops = [{ value: 1, color: 'rgb(1, 2, 3)' }, { value: 4, color: 'rgb(4, 5, 6)' }];
const q = (el: LyraHeatmap, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;
const distance = (el: LyraHeatmap) => {
  const surface = q(el, '[part="canvas"]').getBoundingClientRect();
  const legend = q(el, '[part="legend"]').getBoundingClientRect();
  return Math.round(el.legendPlacement === 'top' ? surface.top - legend.bottom : legend.top - surface.bottom);
};

describe('lr-heatmap legend layout tokens', () => {
  it('sets the grid-to-legend distance on either edge, justify and swatch radius; defaults unchanged', async () => {
    const wrap = await fixture<HTMLElement>(html`<div style="inline-size: 480px">
      <lr-heatmap label="Load" .data=${data} .legendStops=${stops}></lr-heatmap>
      <lr-heatmap label="Load" .data=${data} .legendStops=${stops}
        style="--lr-heatmap-legend-offset: 20px; --lr-heatmap-legend-justify: space-between; --lr-heatmap-legend-swatch-radius: 50%"></lr-heatmap>
    </div>`);
    const [plain, themed] = Array.from(wrap.querySelectorAll('lr-heatmap')) as LyraHeatmap[];
    await themed!.updateComplete;
    expect(distance(plain!)).to.equal(4);
    expect(getComputedStyle(q(plain!, '[part="legend"]')).justifyContent).to.equal('normal');
    const probe = document.createElement('span');
    probe.style.borderRadius = 'var(--lr-radius-xs)';
    plain!.shadowRoot!.append(probe);
    expect(getComputedStyle(q(plain!, '[part="legend-swatch"]')).borderTopLeftRadius).to.equal(getComputedStyle(probe).borderTopLeftRadius);
    probe.remove();
    expect(distance(themed!)).to.equal(20);
    expect(getComputedStyle(q(themed!, '[part="legend"]')).justifyContent).to.equal('space-between');
    expect(getComputedStyle(q(themed!, '[part="legend-swatch"]')).borderTopLeftRadius).to.equal('50%');
    themed!.legendPlacement = 'top';
    await themed!.updateComplete;
    expect(distance(themed!)).to.equal(20);
  });
});
