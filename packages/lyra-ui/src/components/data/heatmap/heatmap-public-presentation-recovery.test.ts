import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraHeatmap } from './heatmap.js';
import type { LyraHeatmapMatrixSource, LyraHeatmapTile } from './heatmap-matrix-source.js';
import './heatmap.js';

const data = { kind: 'matrix' as const, rowLabels: ['Row'], colLabels: ['Alpha', 'Beta', 'Gamma', 'Delta'], values: [[1, 2, 3, 4]] };

function canvas(element: LyraHeatmap): HTMLCanvasElement {
  const target = element.shadowRoot?.querySelector<HTMLCanvasElement>('[part="canvas"]');
  if (!target) throw new Error('Heatmap canvas missing');
  return target;
}

async function painted(element: LyraHeatmap): Promise<string> {
  element.scrollIntoView({ block: 'center' });
  await waitUntil(() => element.exportData('png').startsWith('data:image/png'), 'heatmap paint unavailable');
  return element.exportData('png');
}

function matrixSource(): LyraHeatmapMatrixSource {
  return { revision: 'initial', rowCount: 2, columnCount: 2, domain: { min: 1, max: 4 },
    query: request => [{ rowStart: request.rowStart, rowEnd: request.rowEnd, columnStart: request.columnStart, columnEnd: request.columnEnd,
      count: 4, validCount: 4, min: 1, max: 4, sum: 10 }],
    getCell: (row, column) => ({ value: row * 2 + column + 1, rowLabel: `R${row}`, columnLabel: `C${column}` }),
  };
}

afterEach(async () => resetMouse());

it('exports ragged source values with blank missing labels and recovers a labeled matrix', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:340px" .data=${{
    kind: 'matrix', rowLabels: [], colLabels: [], values: [[2, 3], [4]],
  }}></lr-heatmap>`);
  expect(element.exportData('csv')).to.equal('row,column,value\r\n,,2\r\n,,3\r\n,,4');
  element.data = data;
  await element.updateComplete;
  await painted(element);
  expect(element.exportData('csv')).to.include('Row,Alpha,1');
  expect(element.matrixGeometry?.cellSize).to.be.greaterThan(0);
});

it('restores both default label gutters when explicit extent attributes are removed', async () => {
  const reference = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:340px" .data=${data}></lr-heatmap>`);
  await painted(reference);
  const expected = reference.matrixGeometry;
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap row-label-width="40" col-label-height="40"
    style="inline-size:340px" .data=${data}></lr-heatmap>`);
  await painted(element);
  expect(element.matrixGeometry?.padLeft).to.equal(40);
  expect(element.matrixGeometry?.padTop).to.equal(40);
  element.removeAttribute('row-label-width');
  element.removeAttribute('col-label-height');
  await element.updateComplete;
  await waitUntil(() => element.matrixGeometry?.padLeft === expected?.padLeft && element.matrixGeometry?.padTop === expected?.padTop);
  expect(element.rowLabelWidth).to.equal(undefined);
  expect(element.colLabelHeight).to.equal(undefined);
  expect(element.matrixGeometry).to.deep.equal(expected);
});

it('repaints rotated label intervals without thinning cells, changing geometry, or changing CSV', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap col-label-rotation="45" col-label-height="80"
    cell-size="30" style="inline-size:340px" .data=${data}></lr-heatmap>`);
  const before = await painted(element), geometry = element.matrixGeometry, csv = element.exportData('csv');
  element.colLabelInterval = 2;
  await element.updateComplete;
  await waitUntil(() => element.exportData('png').startsWith('data:image/png') && element.exportData('png') !== before, 'rotated interval did not repaint');
  expect(element.matrixGeometry).to.deep.equal(geometry);
  expect(element.exportData('csv')).to.equal(csv);
  element.colLabelInterval = 1;
  await element.updateComplete;
  await waitUntil(() => element.exportData('png') === before, 'restored labels did not match the original paint');
});

for (const sticky of ['rows', 'cols'] as const) {
  it(`keeps tooltip and keyboard endpoints visible when only ${sticky} are frozen`, async () => {
    const cellText: NonNullable<LyraHeatmap['cellText']> = pos => 'row' in pos ? `Cell ${pos.row},${pos.col}` : pos.date;
    const element = await fixture<LyraHeatmap>(html`<lr-heatmap without-legend sticky-labels=${sticky}
      cell-size="30" style="inline-size:200px;--lr-heatmap-grid-max-block-size:140px"
      .cellText=${cellText}
      .data=${{ kind: 'matrix', rowLabels: Array.from({ length: 10 }, (_, index) => `R${index}`),
        colLabels: Array.from({ length: 10 }, (_, index) => `C${index}`),
        values: Array.from({ length: 10 }, (_, row) => Array.from({ length: 10 }, (_, col) => row * 10 + col)) }}
    ></lr-heatmap>`);
    await painted(element);
    const grid = element.shadowRoot!.querySelector<HTMLElement>('[part="grid"]')!;
    const geometry = element.matrixGeometry!;
    grid.scrollLeft = 100;
    grid.scrollTop = 60;
    const point = (box: DOMRect): [number, number] => [
      box.left + geometry.padLeft + 5 * geometry.cellSize + (geometry.cellSize - 1) / 2,
      box.top + geometry.padTop + 3 * (geometry.rowHeight ?? geometry.cellSize) + (geometry.cellSize - 1) / 2,
    ];
    await hoverUntilMatched(canvas(element), 'single-axis frozen canvas receives hover', point);
    const tooltip = element.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
    await waitUntil(() => !tooltip.hidden && tooltip.textContent === 'Cell 3,5');
    await waitUntil(() => {
      const port = grid.getBoundingClientRect(), tip = tooltip.getBoundingClientRect();
      return tip.width > 0 && tip.left >= port.left + (sticky === 'rows' ? geometry.padLeft : 0) - 1 &&
        tip.top >= port.top + (sticky === 'cols' ? geometry.padTop : 0) - 1 &&
        tip.right <= port.right + 1 && tip.bottom <= port.bottom + 1;
    }, 'tooltip crossed the visible unfrozen window');
    const activations: unknown[] = [];
    element.addEventListener('lr-cell-activate', event => activations.push(event.detail));
    await focusByKeyboard(canvas(element));
    await sendKeys({ press: 'End' });
    await waitUntil(() => {
      const box = canvas(element).getBoundingClientRect(), port = grid.getBoundingClientRect();
      const left = box.left + geometry.padLeft + 9 * geometry.cellSize;
      const top = box.top + geometry.padTop + 9 * (geometry.rowHeight ?? geometry.cellSize);
      return left >= port.left + (sticky === 'rows' ? geometry.padLeft : 0) - 1 &&
        top >= port.top + (sticky === 'cols' ? geometry.padTop : 0) - 1 &&
        left + geometry.cellSize - 1 <= port.right + 1 && top + geometry.cellSize - 1 <= port.bottom + 1;
    }, 'keyboard endpoint did not scroll clear of the frozen band');
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => activations.length === 1);
    expect(activations[0]).to.deep.equal({ row: 9, col: 9, value: 99 });
    expect(element.matrixGeometry).to.deep.equal(geometry);
  });
}

it('hides a previous PNG while source configuration and tile loading are pending, then publishes the current paint', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:240px" .data=${data}></lr-heatmap>`);
  await painted(element);
  let requested = false;
  let finish: (tiles: readonly LyraHeatmapTile[]) => void = () => { throw new Error('Tile query not started'); };
  element.matrixSource = { ...matrixSource(), query: () => {
    requested = true;
    return new Promise(resolve => { finish = resolve; });
  } };
  expect(element.exportData('png')).to.equal('');
  await element.updateComplete;
  await waitUntil(() => requested);
  expect(element.exportData('png')).to.equal('');
  expect(element.exportData('csv')).to.equal('');
  finish([{ rowStart: 0, rowEnd: 2, columnStart: 0, columnEnd: 2, count: 4, validCount: 4, min: 1, max: 4, sum: 10 }]);
  await waitUntil(() => element.exportData('csv').includes('0,2,0,2,4,4,1,4,10,mean,2.5'), 'current tiles were not admitted');
  await painted(element);
  expect(element.exportData('csv')).to.include('0,2,0,2,4,4,1,4,10,mean,2.5');
});

it('keeps a current source PNG exportable after a public theme refresh repaints it', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:240px" .matrixSource=${matrixSource()}></lr-heatmap>`);
  element.scrollIntoView({ block: 'center' });
  await waitUntil(() => element.exportData('csv').includes('0,2,0,2,4,4,1,4,10,mean,2.5'), 'source tiles were not admitted');
  const csv = element.exportData('csv');
  element.refreshTheme();
  await element.updateComplete;
  await painted(element);
  expect(element.exportData('csv')).to.equal(csv);
});

it('fails visibly for an unsupported source reducer and recovers when a supported reducer is restored', async () => {
  const element = await fixture<LyraHeatmap>(html`<lr-heatmap style="inline-size:240px" .matrixSource=${matrixSource()}
    .strings=${{ heatmapSourceError: 'Matrix reducer unavailable' }}></lr-heatmap>`);
  await painted(element);
  element.setAttribute('matrix-reducer', 'median');
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.textContent?.includes('Matrix reducer unavailable') === true);
  expect(element.exportData('csv')).to.equal('');
  expect(element.exportData('png')).to.equal('');
  element.setAttribute('matrix-reducer', 'max');
  await element.updateComplete;
  await painted(element);
  expect(element.exportData('csv')).to.include('0,2,0,2,4,4,1,4,10,max,4');
  expect(element.shadowRoot!.textContent).not.to.include('Matrix reducer unavailable');
});
