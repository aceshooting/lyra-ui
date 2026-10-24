import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraHeatmap } from './heatmap.class.js';
import type { LyraHeatmapMatrixSource, LyraHeatmapMatrixViewport } from './heatmap-matrix-source.js';
import './heatmap.js';

function provider() {
  const queries: LyraHeatmapMatrixViewport[] = [];
  const reads: [number, number][] = [];
  const valueAt = (row: number, col: number): number | null => row === 0 && col < 2 ? null : row * 3 + col;
  const source: LyraHeatmapMatrixSource = {
    revision: 1, rowCount: 2, columnCount: 3, domain: { min: 2, max: 5 },
    query(request) {
      const { rowStart, rowEnd, columnStart, columnEnd } = request;
      const bounds = { rowStart, rowEnd, columnStart, columnEnd };
      queries.push(bounds);
      const values: number[] = [];
      for (let row = rowStart; row < rowEnd; row++) for (let col = columnStart; col < columnEnd; col++) {
        const value = valueAt(row, col);
        if (value !== null) values.push(value);
      }
      return [{ ...bounds, count: (rowEnd - rowStart) * (columnEnd - columnStart), validCount: values.length,
        min: values.length ? Math.min(...values) : null, max: values.length ? Math.max(...values) : null,
        sum: values.reduce((sum, value) => sum + value, 0) }];
    },
    getCell(row, col) {
      reads.push([row, col]);
      return { value: valueAt(row, col), rowLabel: `Row ${row}`, columnLabel: `Column ${col}` };
    },
  };
  return { source, queries, reads };
}
async function ready(element: LyraHeatmap): Promise<void> {
  await waitUntil(() => element.exportData('csv') !== '' &&
    element.shadowRoot!.querySelectorAll('[part="cell"]').length === 6 &&
    element.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false',
  'the aggregate and exact provider window are ready');
  await element.updateComplete;
}
function cell(element: LyraHeatmap, row: number, col: number): HTMLButtonElement {
  const result = element.shadowRoot!.querySelector<HTMLButtonElement>(`[data-source-row="${row}"][data-source-col="${col}"]`);
  if (!result) throw new Error(`Missing exact cell ${row},${col}`);
  return result;
}
const selected = (element: LyraHeatmap) => [...element.shadowRoot!.querySelectorAll('[role="gridcell"][aria-selected="true"]')]
  .map(entry => {
    const button = entry.querySelector<HTMLButtonElement>('button')!;
    return `${button.dataset['sourceRow']}:${button.dataset['sourceCol']}`;
  });

describe('heatmap provider presentation', () => {
  it('passes null exact values as NaN to caller presentation and interaction callbacks', async () => {
    const input = provider();
    const calls: Record<string, Array<{ row: number; col: number; value: number }>> = { text: [], color: [], interactive: [] };
    const text: NonNullable<LyraHeatmap['cellText']> = (position, value) => {
      if (!('row' in position)) throw new Error('Expected a matrix coordinate');
      calls['text']!.push({ ...position, value });
      return `${position.row},${position.col}: ${Number.isNaN(value) ? 'Unavailable reading' : value}`;
    };
    const color: NonNullable<LyraHeatmap['cellColor']> = (position, value) => {
      if (!('row' in position)) throw new Error('Expected a matrix coordinate');
      calls['color']!.push({ ...position, value });
      return Number.isNaN(value) ? 'rgb(40, 50, 60)' : undefined;
    };
    const interactive: NonNullable<LyraHeatmap['cellInteractive']> = (position, value) => {
      if (!('row' in position)) throw new Error('Expected a matrix coordinate');
      calls['interactive']!.push({ ...position, value });
      return position.row !== 0 || position.col !== 1;
    };
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells style="width:320px"
      .matrixSource=${input.source} .cellText=${text} .cellColor=${color} .cellInteractive=${interactive}
      .strings=${{ heatmapNoDataValue: 'No reading', heatmapMatrixCellLabel: '{row}; {col}; {value}' }}></lr-heatmap>`);
    await ready(element);
    expect(cell(element, 0, 0).textContent).to.equal('0,0: Unavailable reading');
    expect(cell(element, 0, 0).disabled).to.equal(false);
    expect(cell(element, 0, 1).disabled).to.equal(true);
    expect(getComputedStyle(cell(element, 0, 0)).backgroundColor).to.equal('rgb(40, 50, 60)');
    for (const records of Object.values(calls)) {
      for (const col of [0, 1]) expect(records.some(entry => entry.row === 0 && entry.col === col && Number.isNaN(entry.value))).to.equal(true);
      expect(records.some(entry => entry.row === 1 && entry.col === 2 && entry.value === 5)).to.equal(true);
    }
    expect(await element.revealSourceCell(0, 1)).to.equal(false);
    expect(await element.revealSourceCell(0, 0)).to.equal(true);
    const activated = oneEvent(element, 'lr-cell-activate');
    await sendKeys({ press: 'Enter' });
    const detail = (await activated).detail;
    expect([detail.row, detail.col]).to.deep.equal([0, 0]);
    expect(Number.isNaN(detail.value)).to.equal(true);
    expect(element.exportData('csv').split('\r\n')[1]).to.equal('0,2,0,3,6,4,2,5,14,mean,3.5');
    element.cellText = undefined;
    await element.updateComplete;
    expect(cell(element, 0, 0).textContent).to.equal('Row 0; Column 0; No reading');
    expect(input.queries.length).to.equal(1);
  });

  it('keeps the provider domain and export intact while changing paint domain and legend visibility', async () => {
    const input = provider();
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells style="width:320px"
      .matrixSource=${input.source} .domain=${[-10, 10]} .cellColor=${() => 'rgb(12, 34, 56)'}></lr-heatmap>`);
    await ready(element);
    const summary = element.shadowRoot!.querySelector('[part="source-summary"]')!.textContent;
    const csv = element.exportData('csv');
    expect(element.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('-10');
    expect(element.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('10');
    expect(getComputedStyle(cell(element, 1, 2)).backgroundColor).to.equal('rgb(12, 34, 56)');
    element.withoutLegend = true;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[part="legend"]').length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="source-summary"]')!.textContent).to.equal(summary);
    expect(element.exportData('csv')).to.equal(csv);
    element.domain = undefined;
    element.withoutLegend = false;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="legend-lo"]')!.textContent).to.equal('2');
    expect(element.shadowRoot!.querySelector('[part="legend-hi"]')!.textContent).to.equal('5');
    expect(element.shadowRoot!.querySelector('[part="source-summary"]')!.textContent).to.equal(summary);
    expect(element.exportData('csv')).to.equal(csv);
    expect(input.queries.length).to.equal(1);
  });

  it('repaints controlled single selection silently and navigates the next exact row without selecting it', async () => {
    const input = provider();
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells style="width:320px"
      .matrixSource=${input.source} .selectedCell=${{ row: 0, col: 2 }}></lr-heatmap>`);
    await ready(element);
    const selections: unknown[] = [], activations: unknown[] = [];
    element.addEventListener('lr-selection-change', event => selections.push(event.detail));
    element.addEventListener('lr-cell-activate', event => activations.push(event.detail));
    expect(selected(element)).to.deep.equal(['0:2']);
    element.selectedCell = { row: 1, col: 1 };
    await element.updateComplete;
    expect(selected(element)).to.deep.equal(['1:1']);
    expect(selections).to.deep.equal([]);
    expect(activations).to.deep.equal([]);
    await focusByKeyboard(cell(element, 0, 2));
    await sendKeys({ press: 'ArrowDown' });
    await waitUntil(() => element.shadowRoot!.activeElement === cell(element, 1, 2), 'ArrowDown retains the source column');
    expect(selected(element)).to.deep.equal(['1:1']);
    expect(selections).to.deep.equal([]);
    expect(activations).to.deep.equal([]);
    const activated = oneEvent(element, 'lr-cell-activate');
    await sendKeys({ press: 'Enter' });
    expect((await activated).detail).to.deep.equal({ row: 1, col: 2, value: 5 });
    expect(selected(element)).to.deep.equal(['1:1']);
    expect(selections).to.deep.equal([]);
    expect(input.reads.some(([row, col]) => row === 1 && col === 2)).to.equal(true);
    expect(input.queries.length).to.equal(1);
  });
});
