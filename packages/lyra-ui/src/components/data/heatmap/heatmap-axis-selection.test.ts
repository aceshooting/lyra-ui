import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import '../../lr-heatmap.js';
import type { LyraHeatmap } from '../../lr-heatmap.js';
import type { HeatmapMatrixData, HeatmapSelectionChangeDetail } from './heatmap-model.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const data: HeatmapMatrixData = {
  kind: 'matrix',
  rowLabels: ['Monday', 'Tuesday', ''],
  colLabels: ['Morning', 'Noon', 'Evening'],
  values: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
};
const targets = (el: LyraHeatmap, part: string) => Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>(`[part~="${part}"]`));

async function heatmap(attrs = 'axis-selection="both"', wrapperDir = 'ltr'): Promise<{ el: LyraHeatmap; details: HeatmapSelectionChangeDetail[] }> {
  const wrap = await fixture<HTMLElement>(html`<div dir=${wrapperDir}></div>`);
  wrap.innerHTML = `<lr-heatmap label="Load" multiple ${attrs}></lr-heatmap>`;
  const el = wrap.querySelector<LyraHeatmap>('lr-heatmap')!;
  el.data = data;
  const details: HeatmapSelectionChangeDetail[] = [];
  el.addEventListener('lr-selection-change', (event) => {
    const detail = (event as CustomEvent<HeatmapSelectionChangeDetail>).detail;
    details.push(detail);
    el.selectedCells = detail.selectedCells;
  });
  await waitUntil(() => targets(el, 'row-label').length === 3, 'label buttons render after the first draw');
  return { el, details };
}

describe('lr-heatmap axisSelection', () => {
  it('renders named toggle buttons over the painted labels and toggles a whole column', async () => {
    const { el, details } = await heatmap();
    const rows = targets(el, 'row-label');
    const cols = targets(el, 'col-label');
    expect(rows.map((b) => b.getAttribute('aria-label'))).to.deep.equal(['Monday', 'Tuesday', 'row 3']);
    expect(cols.map((b) => b.getAttribute('aria-pressed'))).to.deep.equal(['false', 'false', 'false']);
    const geometry = el.matrixGeometry!;
    const canvas = el.shadowRoot!.querySelector('[part="canvas"]')!.getBoundingClientRect();
    const noon = cols[1]!.getBoundingClientRect();
    expect(noon.left - canvas.left).to.be.closeTo(geometry.padLeft + geometry.cellSize, 1);
    expect(noon.top).to.be.closeTo(canvas.top, 1);
    cols[1]!.click();
    expect(details.at(-1)!.source).to.equal('column');
    expect(details.at(-1)!.selectedCells).to.deep.equal([{ row: 0, col: 1 }, { row: 1, col: 1 }, { row: 2, col: 1 }]);
    await el.updateComplete;
    expect(targets(el, 'col-label').map((b) => b.getAttribute('aria-pressed'))).to.deep.equal(['false', 'true', 'false']);
    expect(targets(el, 'col-label-pressed').length).to.equal(1);
    await expect(el).to.be.accessible();
    targets(el, 'col-label')[1]!.click();
    expect(details.at(-1)!.selectedCells).to.deep.equal([]);
  });

  it('roves one tab stop per axis and activates with Enter, also under dir=rtl', async () => {
    const { el, details } = await heatmap('axis-selection="both"', 'rtl');
    const rows = targets(el, 'row-label');
    expect(rows.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
    await focusByKeyboard(rows[0]!);
    await sendKeys({ press: 'ArrowDown' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('Tuesday');
    await sendKeys({ press: 'Enter' });
    expect(details.at(-1)!.source).to.equal('row');
    expect(details.at(-1)!.selectedCells.every((pos) => pos.row === 1)).to.equal(true);
    await sendKeys({ press: 'End' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('row 3');
    await sendKeys({ press: 'Home' });
    await sendKeys({ press: 'ArrowUp' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('Monday');
    await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.not.equal('Tuesday');
    const cols = targets(el, 'col-label');
    await focusByKeyboard(cols[0]!);
    await sendKeys({ press: 'ArrowRight' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('Noon');
    await sendKeys({ press: 'ArrowLeft' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('Morning');
    await sendKeys({ press: 'x' });
    expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).to.equal('Morning');
  });

  it('keeps one enabled tab stop per axis when the leading label is disabled or the data shrinks', async () => {
    const { el } = await heatmap();
    el.cellInteractive = (pos) => !('row' in pos) || (pos.row !== 0 && pos.col !== 0);
    await waitUntil(() => targets(el, 'row-label')[0]!.disabled, 'the empty leading row disables its button');
    const tabStops = (part: string) => targets(el, part).map((b) => (b.disabled ? 'x' : b.tabIndex));
    expect(tabStops('row-label')).to.deep.equal(['x', 0, -1]);
    expect(tabStops('col-label')).to.deep.equal(['x', 0, -1]);
    el.cellInteractive = undefined;
    await focusByKeyboard(targets(el, 'row-label')[2]!);
    await waitUntil(() => targets(el, 'row-label').length === 3 && !targets(el, 'row-label')[0]!.disabled);
    targets(el, 'row-label')[2]!.click();
    el.data = { ...data, rowLabels: ['Monday', 'Tuesday'], values: [[1, 2, 3], [4, 5, 6]] };
    await waitUntil(() => targets(el, 'row-label').length === 2, 'the shrink re-renders the buttons');
    expect(tabStops('row-label')).to.deep.equal([0, -1]);
  });

  it('draws the pressed label state with a border in forced colors', async () => {
    await setForcedColors('active');
    try {
      const { el } = await heatmap();
      targets(el, 'col-label')[1]!.click();
      await waitUntil(() => targets(el, 'col-label-pressed').length === 1);
      const pressed = getComputedStyle(targets(el, 'col-label-pressed')[0]!);
      expect(pressed.borderTopStyle).to.equal('solid');
      expect(parseFloat(pressed.borderTopWidth)).to.be.greaterThan(0);
      expect(parseFloat(getComputedStyle(targets(el, 'col-label')[0]!).borderTopWidth)).to.equal(0);
    } finally {
      await setForcedColors('none');
    }
  });

  it('offers only the requested axis, keeps frozen labels with their buttons, and stays off by default', async () => {
    const { el } = await heatmap('axis-selection="rows" sticky-labels="both"');
    expect(targets(el, 'col-label').length).to.equal(0);
    expect(el.shadowRoot!.querySelector('.grid-stack .axis-targets[data-frozen-rows]') !== null).to.equal(true);
    el.axisSelection = 'cols';
    await el.updateComplete;
    expect([targets(el, 'row-label').length, targets(el, 'col-label').length]).to.deep.equal([0, 3]);
    el.setAttribute('axis-selection', 'diagonal');
    await el.updateComplete;
    expect(el.axisSelection).to.equal('none');
    expect(targets(el, 'col-label').length).to.equal(0);
    el.axisSelection = 'both';
    el.multiple = false;
    await el.updateComplete;
    expect(targets(el, 'row-label').length + targets(el, 'col-label').length).to.equal(0);
  });

  it('keeps overlays aligned with the canvas when the legend sits on top', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap label="Load" accessible-cells legend-placement="top" .data=${data}></lr-heatmap>`);
    await waitUntil(() => el.matrixGeometry !== undefined && el.shadowRoot!.querySelector('[part="cell"]') !== null);
    await el.updateComplete;
    const geometry = el.matrixGeometry!;
    const canvas = el.shadowRoot!.querySelector('[part="canvas"]')!.getBoundingClientRect();
    const first = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"]')!;
    expect(parseFloat(first.style.insetBlockStart)).to.be.closeTo(geometry.padTop, 1);
    expect(first.offsetParent === null ? -1 : first.getBoundingClientRect().top - canvas.top).to.be.closeTo(geometry.padTop, 12);
    expect(el.shadowRoot!.querySelector('.surface-frame [part="tooltip"]') !== null).to.equal(true);
  });
});
