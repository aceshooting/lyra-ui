import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './heatmap.js';
import '../../../translations/fr/data.js';
import '../../../translations/fr/shared.js';
import type { HeatmapSelectionChangeDetail, LyraHeatmap } from './heatmap.class.js';
import type { LyraHeatmapMatrixSource, LyraHeatmapMatrixViewport } from './heatmap-matrix-source.js';

function matrixSource(rows: number, columns: number) {
  const queries: LyraHeatmapMatrixViewport[] = [];
  const reads: [number, number][] = [];
  const source: LyraHeatmapMatrixSource = {
    revision: 1, rowCount: rows, columnCount: columns, domain: { min: 0, max: rows * columns },
    query(request) {
      const { rowStart, rowEnd, columnStart, columnEnd } = request;
      const bounds = { rowStart, rowEnd, columnStart, columnEnd };
      queries.push(bounds);
      const count = (rowEnd - rowStart) * (columnEnd - columnStart);
      return [{ ...bounds, count, validCount: count, min: 0, max: rows * columns, sum: count }];
    },
    getCell(row, column) {
      reads.push([row, column]);
      return { value: row * columns + column, rowLabel: `Row ${row}`, columnLabel: `Column ${column}` };
    },
  };
  return { source, queries, reads };
}

async function sourceReady(el: LyraHeatmap): Promise<void> {
  await waitUntil(() => el.exportData('csv') !== '' &&
    el.shadowRoot?.querySelector('[part="base"]')?.getAttribute('aria-busy') === 'false',
  'Matrix tiles should be ready');
  await el.updateComplete;
}

function exactButton(el: LyraHeatmap, row: number, column: number): HTMLButtonElement {
  const button = el.shadowRoot?.querySelector<HTMLButtonElement>(
    `[data-source-row="${row}"][data-source-col="${column}"]`,
  );
  if (!button) throw new Error(`Missing exact cell ${row},${column}`);
  return button;
}

it('pans an explicit source viewport to reveal an edge cell without selecting it', async () => {
  const { source, queries, reads } = matrixSource(20, 30);
  const viewport = { rowStart: 0, rowEnd: 4, columnStart: 0, columnEnd: 5 };
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px"
    .matrixSource=${source} .matrixViewport=${viewport}></lr-heatmap>`);
  await sourceReady(el);
  const activations: unknown[] = [], selections: unknown[] = [];
  el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
  el.addEventListener('lr-selection-change', event => selections.push(event.detail));

  expect(await el.revealSourceCell(19, 29)).to.equal(true);
  await sourceReady(el);
  expect(el.matrixViewport).to.deep.equal({ rowStart: 16, rowEnd: 20, columnStart: 25, columnEnd: 30 });
  expect(queries).to.deep.equal([viewport, { rowStart: 16, rowEnd: 20, columnStart: 25, columnEnd: 30 }]);
  expect(reads).to.deep.equal([[19, 29]]);
  expect(el.shadowRoot?.activeElement?.getAttribute('part')).to.equal('canvas');
  expect(el.selectedCell).to.equal(null);
  expect(el.selectedCells).to.deep.equal([]);
  expect(activations).to.deep.equal([]);
  expect(selections).to.deep.equal([]);
  await sendKeys({ press: 'Enter' });
  await waitUntil(() => activations.length === 1);
  expect(activations).to.deep.equal([{ row: 19, col: 29, value: 599 }]);
  expect(reads).to.deep.equal([[19, 29]]);
  expect(await el.revealSourceCell(20, 29)).to.equal(false);
  expect(queries.length).to.equal(2);
  expect(selections.length).to.equal(0);
});

it('localizes aggregate hover values and reducer changes without exact reads or tile reloads', async () => {
  const { source, queries, reads } = matrixSource(50, 40);
  const aggregate: LyraHeatmapMatrixSource = {
    ...source, domain: { min: 1000.25, max: 3000.75 },
    query(request) {
      queries.push(request);
      return [{ ...request, count: 2000, validCount: 1000, min: 1000.25, max: 3000.75, sum: 2000500 }];
    },
  };
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap locale="fr" style="width:320px"
    .matrixSource=${aggregate} .strings=${{
      heatmapSourceRangeLabel: 'R {rowStart}–{rowEnd}; C {columnStart}–{columnEnd}; {valid}/{count}; {min}..{max}; {reducer}: {value}',
      heatmapSourceMean: 'Moyenne choisie', heatmapSourceMin: 'Minimum choisi', heatmapSourceMax: 'Maximum choisi',
      heatmapNoDataValue: 'Absent',
    }}></lr-heatmap>`);
  await sourceReady(el);
  const canvas = el.shadowRoot!.querySelector('canvas')!;
  const bounds = canvas.getBoundingClientRect();
  expect(bounds.width).to.be.greaterThan(0);
  expect(bounds.height).to.be.greaterThan(0);
  const hover = () => canvas.dispatchEvent(new MouseEvent('mousemove', {
    clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2,
  }));
  hover();
  const format = new Intl.NumberFormat('fr');
  const prefix = `R 1–50; C 1–40; ${format.format(1000)}/${format.format(2000)}; ${format.format(1000.25)}..${format.format(3000.75)}; `;
  for (const [reducer, label, value] of [
    ['mean', 'Moyenne choisie', 2000.5], ['min', 'Minimum choisi', 1000.25], ['max', 'Maximum choisi', 3000.75],
  ] as const) {
    el.matrixReducer = reducer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]')?.textContent).to.equal(`${prefix}${label}: ${format.format(value)}`);
  }
  expect(queries.length).to.equal(1);
  expect(reads).to.deep.equal([]);
  canvas.dispatchEvent(new MouseEvent('mouseleave'));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]') === null).to.equal(true);

  el.matrixSource = {
    ...aggregate, revision: 2, domain: null,
    query(request) {
      queries.push(request);
      return [{ ...request, count: 2000, validCount: 0, min: null, max: null, sum: 0 }];
    },
  };
  await sourceReady(el);
  hover();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]')?.textContent).to.equal(
    `R 1–50; C 1–40; 0/${format.format(2000)}; Absent..Absent; Maximum choisi: Absent`,
  );
  expect(queries.length).to.equal(2);
  expect(reads).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="source-error"]') === null).to.equal(true);
});

it('keeps source multiple selection controlled, filters invalid coordinates, and toggles accepted cells', async () => {
  const { source, queries, reads } = matrixSource(2, 2);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells multiple style="width:320px"
    .matrixSource=${source}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 4);
  const changes: HeatmapSelectionChangeDetail[] = [], activations: unknown[] = [];
  el.addEventListener('lr-selection-change', event => changes.push(event.detail));
  el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
  const supplied = [{ row: 0, col: 0 }, { row: -1, col: 0 }, { row: 2, col: 1 }, { row: 0.5, col: 1 }, { date: '2026-01-01' }];
  el.selectedCells = supplied;
  supplied[0]!.col = 1;
  await el.updateComplete;
  expect(changes.length).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(1);
  expect(exactButton(el, 0, 0).parentElement?.getAttribute('aria-selected')).to.equal('true');
  expect(exactButton(el, 0, 1).parentElement?.getAttribute('aria-selected')).to.equal('false');

  exactButton(el, 0, 1).click();
  await waitUntil(() => changes.length === 1 && activations.length === 1);
  const proposal = changes[0]!;
  expect(proposal).to.deep.equal({ selectedCells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], source: 'pointer' });
  expect(Object.isFrozen(proposal)).to.equal(true);
  expect(Object.isFrozen(proposal.selectedCells)).to.equal(true);
  expect(proposal.selectedCells.every(cell => Object.isFrozen(cell))).to.equal(true);
  await el.updateComplete;
  expect(exactButton(el, 0, 1).parentElement?.getAttribute('aria-selected')).to.equal('false');
  el.selectedCells = proposal.selectedCells;
  await el.updateComplete;
  expect(changes.length).to.equal(1);
  expect(el.shadowRoot!.querySelectorAll('[aria-selected="true"]').length).to.equal(2);

  exactButton(el, 0, 0).click();
  await waitUntil(() => changes.length === 2 && activations.length === 2);
  expect(changes[1]).to.deep.equal({ selectedCells: [{ row: 0, col: 1 }], source: 'pointer' });
  await el.updateComplete;
  expect(exactButton(el, 0, 0).parentElement?.getAttribute('aria-selected')).to.equal('true');
  el.selectedCells = changes[1]!.selectedCells;
  await el.updateComplete;
  expect(exactButton(el, 0, 0).parentElement?.getAttribute('aria-selected')).to.equal('false');
  expect(exactButton(el, 0, 1).parentElement?.getAttribute('aria-selected')).to.equal('true');
  expect(activations).to.deep.equal([{ row: 0, col: 1, value: 1 }, { row: 0, col: 0, value: 0 }]);
  expect(changes.length).to.equal(2);
  expect(queries.length).to.equal(1);
  expect(reads.length).to.equal(4);
});

it('revokes exact activation when a multiple-selection listener replaces the source', async () => {
  const first = matrixSource(2, 2), replacement = matrixSource(3, 3);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells multiple style="width:320px"
    .matrixSource=${first.source}></lr-heatmap>`);
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 4);
  const oldButton = exactButton(el, 0, 1);
  const changes: HeatmapSelectionChangeDetail[] = [], activations: unknown[] = [];
  el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
  el.addEventListener('lr-selection-change', event => {
    changes.push(event.detail);
    el.matrixSource = replacement.source;
  });
  oldButton.click();
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length === 9);
  expect(changes).to.deep.equal([{ selectedCells: [{ row: 0, col: 1 }], source: 'pointer' }]);
  expect(activations).to.deep.equal([]);
  expect(el.matrixSource === replacement.source).to.equal(true);
  expect(oldButton.isConnected).to.equal(false);
  oldButton.click();
  await el.updateComplete;
  expect(changes.length).to.equal(1);
  expect(activations.length).to.equal(0);
  expect(el.selectedCells).to.deep.equal([]);
  expect(replacement.queries.length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="source-error"]') === null).to.equal(true);
});

it('clears aggregate hover outside the source viewport without selecting or reading an exact cell', async () => {
  const { source, reads } = matrixSource(20, 20);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px" .matrixSource=${source}></lr-heatmap>`);
  await sourceReady(el);
  const canvas = el.shadowRoot!.querySelector('canvas')!, bounds = canvas.getBoundingClientRect();
  const selections: unknown[] = [];
  el.addEventListener('lr-matrix-range-select', event => selections.push(event.detail));
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: bounds.left + 10, clientY: bounds.top + 10 }));
  await el.updateComplete;
  expect(Boolean(el.shadowRoot!.querySelector('[part="tooltip"]')?.textContent)).to.equal(true);
  canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: bounds.right + 1, clientY: bounds.bottom + 1 }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]') === null).to.equal(true);
  expect(reads).to.deep.equal([]);
  expect(selections).to.deep.equal([]);
});

it('ignores hover and clicks while source tiles are pending or failed, then accepts a working source', async () => {
  const { source, reads } = matrixSource(1, 1);
  let reject!: (error: Error) => void;
  const tiles = new Promise<never>((_resolve, fail) => { reject = fail; });
  const pending: LyraHeatmapMatrixSource = { ...source, query: () => tiles };
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px" .matrixSource=${pending}></lr-heatmap>`);
  const activations: unknown[] = [], ranges: unknown[] = [];
  el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
  el.addEventListener('lr-matrix-range-select', event => ranges.push(event.detail));
  const interact = () => {
    const canvas = el.shadowRoot!.querySelector('canvas')!, bounds = canvas.getBoundingClientRect();
    const position = { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 };
    canvas.dispatchEvent(new MouseEvent('mousemove', position));
    canvas.dispatchEvent(new MouseEvent('click', position));
  };
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-busy')).to.equal('true');
  interact();
  reject(new Error('Source tiles unavailable'));
  await waitUntil(() => el.shadowRoot!.querySelector('[part="source-error"]') !== null, 'source failure rendered');
  interact(); await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="tooltip"]') === null).to.equal(true);
  expect(reads).to.deep.equal([]);
  expect(activations).to.deep.equal([]);
  expect(ranges).to.deep.equal([]);
  el.matrixSource = source;
  await sourceReady(el); interact();
  await waitUntil(() => activations.length === 1, 'replacement source accepts activation');
  expect(activations).to.deep.equal([{ row: 0, col: 0, value: 0 }]);
  expect(reads).to.deep.equal([[0, 0]]);
  expect(el.shadowRoot!.querySelector('[part="source-error"]') === null).to.equal(true);
});

for (const interruption of ['disconnect', 'replace'] as const) {
  it(`drops pending exact activation after ${interruption} without publishing a stale selection`, async () => {
    const first = matrixSource(1, 1), replacement = matrixSource(1, 1);
    let resolve!: (value: { value: number; rowLabel: string; columnLabel: string }) => void;
    let started = false;
    const cell = new Promise<{ value: number; rowLabel: string; columnLabel: string }>(done => { resolve = done; });
    const source: LyraHeatmapMatrixSource = { ...first.source, getCell() { started = true; return cell; } };
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-heatmap multiple style="width:320px" .matrixSource=${source}></lr-heatmap></div>`);
    const el = wrapper.querySelector<LyraHeatmap>('lr-heatmap')!;
    await sourceReady(el);
    const activations: unknown[] = [], selections: unknown[] = [];
    el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
    el.addEventListener('lr-selection-change', event => selections.push(event.detail));
    const canvas = el.shadowRoot!.querySelector('canvas')!, bounds = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', { clientX: bounds.left + 10, clientY: bounds.top + 10 }));
    await waitUntil(() => started, 'exact value requested');
    if (interruption === 'disconnect') el.remove(); else el.matrixSource = replacement.source;
    resolve({ value: 99, rowLabel: 'Old row', columnLabel: 'Old column' });
    await nextFrame();
    expect(activations).to.deep.equal([]);
    expect(selections).to.deep.equal([]);
    el.matrixSource = replacement.source;
    if (interruption === 'disconnect') wrapper.append(el);
    await sourceReady(el);
    const current = el.shadowRoot!.querySelector('canvas')!, currentBounds = current.getBoundingClientRect();
    current.dispatchEvent(new MouseEvent('click', { clientX: currentBounds.left + 10, clientY: currentBounds.top + 10 }));
    await waitUntil(() => activations.length === 1, 'current exact value accepted');
    expect(activations).to.deep.equal([{ row: 0, col: 0, value: 0 }]);
    expect(selections).to.deep.equal([{ selectedCells: [{ row: 0, col: 0 }], source: 'pointer' }]);
    expect(el.selectedCells).to.deep.equal([]);
  });
}

for (const [edge, row, column] of [
  ['above', 3, 7], ['below', 8, 7], ['left', 6, 4], ['right', 6, 10],
] as const) {
  it(`reveals a source cell ${edge} the viewport while preserving its dimensions`, async () => {
    const { source, queries, reads } = matrixSource(20, 30);
    const viewport = { rowStart: 4, rowEnd: 8, columnStart: 5, columnEnd: 10 };
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px"
      .matrixSource=${source} .matrixViewport=${viewport}></lr-heatmap>`);
    await sourceReady(el);
    const activations: unknown[] = [];
    el.addEventListener('lr-cell-activate', event => activations.push(event.detail));
    expect(await el.revealSourceCell(row, column)).to.equal(true);
    await sourceReady(el);
    const shown = el.matrixViewport!;
    expect(shown.rowEnd - shown.rowStart).to.equal(4);
    expect(shown.columnEnd - shown.columnStart).to.equal(5);
    expect(row >= shown.rowStart && row < shown.rowEnd).to.equal(true);
    expect(column >= shown.columnStart && column < shown.columnEnd).to.equal(true);
    expect(queries.length).to.equal(2);
    expect(queries[1]).to.deep.equal(shown);
    expect(reads).to.deep.equal([[row, column]]);
    expect(el.shadowRoot?.activeElement?.getAttribute('part')).to.equal('canvas');
    expect(activations.length).to.equal(0);
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => activations.length === 1);
    expect(activations).to.deep.equal([{ row, col: column, value: row * 30 + column }]);
  });
}

for (const viewport of [null, { rowStart: 1, rowEnd: 3, columnStart: 1, columnEnd: 4 }]) {
  it(`retains cached exact cells when an equivalent ${viewport ? 'explicit' : 'full'} viewport is assigned`, async () => {
    const { source, queries, reads } = matrixSource(5, 5);
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px"
      .matrixSource=${source} .matrixViewport=${viewport}></lr-heatmap>`);
    await sourceReady(el);
    expect(await el.revealSourceCell(1, 1)).to.equal(true);
    for (const next of [el.matrixViewport, viewport && { ...viewport }]) {
      el.matrixViewport = next;
      await el.updateComplete;
      expect(await el.revealSourceCell(1, 1)).to.equal(true);
      expect(queries.length).to.equal(1);
      expect(reads).to.deep.equal([[1, 1]]);
    }
  });
}

for (const callback of ['cellInteractive', 'cellText'] as const) {
  for (const retirement of ['replace', 'disconnect'] as const) {
    it(`does not invoke ${callback} after its getter causes source ${retirement} during reveal`, async () => {
      const first = matrixSource(3, 3), next = matrixSource(4, 4);
      const el = await fixture<LyraHeatmap>(html`<lr-heatmap style="width:320px"
        .matrixSource=${first.source}></lr-heatmap>`);
      await sourceReady(el);
      const parent = el.parentNode!;
      let calls = 0;
      Object.defineProperty(el, callback, { configurable: true, get() {
        if (retirement === 'replace') el.matrixSource = next.source;
        else el.remove();
        return () => { calls++; return callback === 'cellInteractive' ? true : 'Obsolete label'; };
      } });
      try {
        expect(await el.revealSourceCell(1, 1)).to.equal(false);
        expect(calls, 'a retired callback cannot publish cell presentation').to.equal(0);
      } finally { Reflect.deleteProperty(el, callback); }
      if (retirement === 'disconnect') {
        el.matrixSource = next.source;
        parent.appendChild(el);
      }
      await sourceReady(el);
      expect(await el.revealSourceCell(2, 2)).to.equal(true);
      expect(next.reads).to.deep.equal([[2, 2]]);
      expect(el.shadowRoot?.textContent).not.to.contain('Obsolete label');
    });
  }
}
