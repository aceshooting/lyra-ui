import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import './heatmap.js';
import type { HeatmapAnnotation, HeatmapSelectedCell, LyraHeatmap } from './heatmap.js';

type SelectionDetail = { selectedCells: readonly HeatmapSelectedCell[]; source: string };

const data = {
  kind: 'matrix' as const,
  rowLabels: ['Monday', 'Tuesday'],
  colLabels: ['Morning', 'Noon', 'Evening'],
  values: [[1, 2, 3], [4, 5, 6]],
};

function cell(el: LyraHeatmap, row: number, col: number): HTMLButtonElement {
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-cell-key="matrix-${row}-${col}"]`);
  if (!button) throw new Error(`Missing cell ${row},${col}`);
  return button;
}

function changes(el: LyraHeatmap): SelectionDetail[] {
  const details: SelectionDetail[] = [];
  el.addEventListener('lr-selection-change', (event) => details.push((event as CustomEvent<SelectionDetail>).detail));
  return details;
}

describe('lr-heatmap input edges', () => {
  it('reflects a pinned row-label width and removes the attribute when it is cleared', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${data}></lr-heatmap>`);
    el.rowLabelWidth = 84;
    await el.updateComplete;
    expect(el.getAttribute('row-label-width')).to.equal('84');
    el.rowLabelWidth = 'auto';
    await el.updateComplete;
    expect(el.getAttribute('row-label-width')).to.equal('auto');

    el.rowLabelWidth = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('row-label-width')).to.equal(false);
  });

  it('renders object row labels as blank and primitive labels as text', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${{
      kind: 'matrix',
      rowLabels: ['Monday', { name: 'object' }, 7],
      colLabels: ['Morning'],
      values: [[1], [2], [3]],
    }}></lr-heatmap>`);
    await el.updateComplete;

    expect(cell(el, 0, 0).getAttribute('aria-label')).to.contain('Monday');
    expect(cell(el, 1, 0).getAttribute('aria-label')).to.not.contain('object');
    expect(cell(el, 2, 0).getAttribute('aria-label')).to.contain('Row 7');
  });

  it('treats a matrix without label arrays as an empty grid', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${{
      kind: 'matrix', values: [[1, 2]],
    } as unknown as typeof data}></lr-heatmap>`);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="cell"]').length).to.equal(0);
  });

  it('skips empty annotation slots while keeping the valid annotation', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${data}
      .annotations=${[null, { row: 0, col: 1, label: 'Check' }] as unknown as HeatmapAnnotation[]}></lr-heatmap>`);
    await el.updateComplete;

    const legendAnnotations = [...el.shadowRoot!.querySelectorAll('[part="legend-annotation"]')];
    expect(legendAnnotations.map((node) => node.textContent?.trim())).to.deep.equal(['Check']);
  });

  it('treats a non-array controlled selection as empty', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple accessible-cells .data=${data}
      .selectedCells=${[{ row: 0, col: 0 }]}></lr-heatmap>`);
    await el.updateComplete;
    expect(cell(el, 0, 0).getAttribute('aria-selected')).to.equal('true');

    el.selectedCells = null as unknown as readonly HeatmapSelectedCell[];
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(0);
  });

  it('proposes nothing for an axis toggle that matches no interactive cell', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple accessible-cells .data=${data}></lr-heatmap>`);
    el.cellInteractive = (pos) => !('row' in pos && pos.row === 1);
    await el.updateComplete;
    const details = changes(el);

    el.toggleRowSelection(1);
    el.toggleColumnSelection(9);
    expect(details.length).to.equal(0);

    el.toggleRowSelection(0);
    expect(details.map((detail) => detail.selectedCells.length)).to.deep.equal([3]);
  });

  it('proposes nothing when a range extension leaves the controlled selection unchanged', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple accessible-cells style="inline-size: 320px"
      .data=${data} .selectedCells=${[{ row: 0, col: 0 }, { row: 0, col: 1 }]}></lr-heatmap>`);
    await el.updateComplete;
    const details = changes(el);
    await focusByKeyboard(cell(el, 0, 0));

    await sendKeys({ press: 'Shift+ArrowRight' });
    await waitUntil(() => el.shadowRoot!.activeElement === cell(el, 0, 1), 'focus moves to the next cell');
    expect(details.length).to.equal(0);

    await sendKeys({ press: 'Shift+ArrowRight' });
    await waitUntil(() => details.length === 1, 'extending past the selection proposes a change');
    expect(details[0]!.selectedCells).to.deep.equal([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }]);
  });

  it('compares unparseable ramp colours verbatim and paints them from the fallback ramp ends', async () => {
    let el!: LyraHeatmap;
    const warnings = await captureDevWarnings(async () => {
      el = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size: 320px" .data=${data}
        .colorSteps=${['not-a-colour', 'also-not-a-colour']}
        .legendStops=${[{ value: 0, color: 'not-a-colour' }, { value: 3, label: 'Caption only' }, { value: 6, color: 'also-not-a-colour' }]}
      ></lr-heatmap>`);
      await el.updateComplete;
      await waitUntil(() => el.exportData('png').startsWith('data:image/png'), 'heatmap paints');
    });

    expect(warnings.filter((message) => message.includes('legendStops'))).to.deep.equal([]);
    expect(el.shadowRoot!.querySelectorAll('[part="legend-stop"]').length).to.equal(3);
  });
});
