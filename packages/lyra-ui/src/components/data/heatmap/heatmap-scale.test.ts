import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.class.js';
import { buildCalendarGrid } from './calendar-grid.js';
import { countCalls, recordScaleMeasurement, renderedNodeCount } from '../../../../test/scale-budgets.js';
import { aggregateMillionObservations } from '../../../../test/aggregate-observations.js';
import { twoFrames } from '../../../../test/frames.js';

it('activates exact daily totals aggregated from every event in a million-observation source', async () => {
  const aggregates = await aggregateMillionObservations();
  const total = aggregates.complete.days.reduce((sum, day) => sum + day.value, 0);
  const tailDay = aggregates.complete.days[364]!;
  expect(total).equal(1_000_000);
  expect(aggregates.prefix.days.reduce((sum, day) => sum + day.value, 0)).equal(999_999);
  expect(tailDay.value).equal(aggregates.prefix.days[364]!.value + 1);
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells lang="en" value-label="events"
    .data=${{ kind: 'calendar', days: aggregates.prefix.days }}></lr-heatmap>`);
  const cell = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[data-cell-identity="2026-12-31"]');
  await waitUntil(() => cell() !== null && el.calendarGeometry !== undefined, 'the real calendar heatmap did not render');
  const before = oneEvent(el, 'lr-cell-activate');
  cell()!.click();
  expect((await before as CustomEvent<{ date: string; value: number }>).detail).deep.equal({ date: tailDay.date, value: tailDay.value - 1 });
  el.data = { kind: 'calendar', days: aggregates.complete.days };
  await el.updateComplete;
  await twoFrames();
  const activated = oneEvent(el, 'lr-cell-activate');
  cell()!.click();
  expect((await activated as CustomEvent<{ date: string; value: number }>).detail).deep.equal({ date: tailDay.date, value: tailDay.value });
  expect(cell()?.getAttribute('aria-label')).contain('2,740');
  expect(el.getAttribute('aria-label')).contain('365 days');
  const retained = el as unknown as { cachedCalendarGrid: { cells: readonly unknown[] } };
  expect(retained.cachedCalendarGrid.cells.length).equal(365);
  const canvas = el.shadowRoot!.querySelector('canvas');
  if (!canvas) throw new Error('Missing calendar heatmap canvas');
  let maxCanvasPixels = canvas.width * canvas.height;
  el.style.inlineSize = '360px';
  el.valueLabel = 'Complete event totals';
  await el.updateComplete;
  await twoFrames();
  maxCanvasPixels = Math.max(maxCanvasPixels, canvas.width * canvas.height);
  expect(aggregates.sourceReads).equal(1_000_000);
  const semanticCells = el.shadowRoot!.querySelectorAll('[part="cell"]').length;
  const domNodes = renderedNodeCount(el);
  expect(semanticCells).at.most(400);
  expect(domNodes).lessThan(600);
  expect(maxCanvasPixels).lessThan(1_000_000);
  expect(el.calendarGeometry!.weekCount).at.most(53);
  recordScaleMeasurement('lr-heatmap', 'calendar-observations@1000000', {
    sourceReads: aggregates.sourceReads, sourceObservations: total, maxHostChunkRecords: aggregates.maxChunkRecords,
    retainedDays: retained.cachedCalendarGrid.cells.length, weekColumns: el.calendarGeometry!.weekCount,
    semanticCells, maxCanvasPixels, domNodes,
  });
});

it('reuses accessible cell labels while moving within an 80 by 80 matrix', async () => {
  const data = { kind: 'matrix', rowLabels: Array.from({ length: 80 }, (_, i) => `${i}`), colLabels: Array.from({ length: 80 }, (_, i) => `${i}`), values: Array.from({ length: 80 }, () => Array(80).fill(1)) };
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap accessible-cells .data=${data}></lr-heatmap>`);
  const probe = el as unknown as { resolveCellText(pos: unknown): string; focusedCell: unknown; extendSelection(previous: unknown, next: unknown, range: boolean): unknown; selectionCoordinates(pos: unknown): unknown };
  const calls = countCalls(probe, 'resolveCellText');
  try {
    for (let i = 1; i <= 10; i++) { probe.focusedCell = { row: 0, col: i }; await el.updateComplete; }
    expect(calls.calls).to.be.at.most(20);
    recordScaleMeasurement('lr-heatmap', 'focus@6400', { labels: calls.calls });
  } finally { calls.restore(); }
});

it('enumerates only a two-cell range in an 80 by 80 matrix', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{ kind: 'matrix', rowLabels: Array(80).fill('r'), colLabels: Array(80).fill('c'), values: Array.from({length: 80}, () => Array(80).fill(1)) }}></lr-heatmap>`);
  const probe = el as unknown as { extendSelection(previous: unknown, next: unknown, range: boolean): unknown; selectionCoordinates(pos: unknown): unknown };
  el.multiple = true;
  await el.updateComplete;
  const range = countCalls(probe, 'selectionCoordinates');
  try {
    probe.extendSelection({ row: 0, col: 0 }, { row: 0, col: 1 }, true);
    expect(range.calls).to.be.at.most(10);
    recordScaleMeasurement('lr-heatmap', 'range@6400', { coordinates: range.calls });
  } finally { range.restore(); }
});

it('uses the shared month formatter over a 3,000-day calendar', () => {
  const days = Array.from({ length: 3000 }, (_, i) => ({ date: new Date(Date.UTC(2010, 0, i + 1)).toISOString().slice(0, 10), value: i }));
  const calls = countCalls(Date.prototype, 'toLocaleString');
  try {
    expect(buildCalendarGrid(days).cells.length).to.equal(3000);
    expect(calls.calls).to.equal(0);
    recordScaleMeasurement('lr-heatmap', 'months@3000', { uncachedDateFormats: calls.calls });
  } finally { calls.restore(); }
});

it('skips DOM color probes for a seven-literal ramp', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap></lr-heatmap>`);
  const probe = el as unknown as { resolveColorStep(value: string, fallback: string): string };
  const calls = countCalls(window, 'getComputedStyle');
  try {
    for (const color of ['#123456', '#234567', '#345678', '#456789', '#567890', '#678901', '#789012']) probe.resolveColorStep(color, 'red');
    expect(calls.calls).to.equal(0);
    recordScaleMeasurement('lr-heatmap', 'literal-ramp@7', { styleReads: calls.calls });
  } finally { calls.restore(); }
});

it('resolves calendar spacing a bounded number of times during a 3,000-day paint', async () => {
  const days = Array.from({ length: 3000 }, (_, i) => ({ date: new Date(Date.UTC(2010, 0, i + 1)).toISOString().slice(0, 10), value: i }));
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{ kind: 'calendar', days }}></lr-heatmap>`);
  const probe = el as unknown as { calendarSpacing(): unknown; drawCalendar(): void };
  const calls = countCalls(probe, 'calendarSpacing');
  try {
    probe.drawCalendar();
    expect(calls.calls).to.equal(1);
    recordScaleMeasurement('lr-heatmap', 'calendar-paint@3000', { spacingReads: calls.calls });
  } finally { calls.restore(); }
});

it('retains already-owned decoration record identities', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .annotations=${[{ row: 0, col: 0, label: 'Mark' }]}></lr-heatmap>`);
  expect((el as unknown as { cachedAnnotations: unknown[] }).cachedAnnotations[0] === el.annotations[0]).to.equal(true);
});

it('allows a bounded raised cell budget while leaving its unset projection unchanged', async () => {
  const data = { kind: 'matrix', rowLabels: Array(200).fill('r'), colLabels: Array(100).fill('c'), values: Array.from({ length: 200 }, () => Array(100).fill(1)) };
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${data}></lr-heatmap>`);
  const probe = el as unknown as { maxCells: number; cachedMatrixData: { rowLabels: string[] } };
  expect(probe.maxCells).to.equal(10000);
  expect(probe.cachedMatrixData.rowLabels.length).to.equal(100);
  probe.maxCells = 20000;
  await el.updateComplete;
  expect(probe.cachedMatrixData.rowLabels.length).to.equal(200);
  recordScaleMeasurement('lr-heatmap', 'raised-matrix@20000', { retainedRows: probe.cachedMatrixData.rowLabels.length });
});

it('reuses legend and generated summary work through ten hover updates', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .data=${{ kind: 'matrix', rowLabels: ['r'], colLabels: Array(1000).fill('c'), values: [Array(1000).fill(1)] }} .legendStops=${Array.from({ length: 256 }, (_, i) => ({ value: i, label: `${i}`, color: '#123456' }))}></lr-heatmap>`);
  const probe = el as unknown as { hoverCell: unknown; renderLegendScale(value: unknown): unknown; selectedCellDescription(): string };
  const legend = countCalls(probe, 'renderLegendScale');
  const summary = countCalls(probe, 'selectedCellDescription');
  try {
    for (let i = 0; i < 10; i++) { probe.hoverCell = { row: 0, col: i }; await el.updateComplete; }
    expect(legend.calls).to.equal(0);
    expect(summary.calls).to.equal(0);
    recordScaleMeasurement('lr-heatmap', 'hover@1000', { legends: legend.calls, summaries: summary.calls });
  } finally { legend.restore(); summary.restore(); }
});

it('repaints only changed selection cells in a 6,400-cell controlled matrix', async () => {
  const { waitUntil } = await import('@open-wc/testing');
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap multiple .data=${{ kind: 'matrix', rowLabels: Array(80).fill('r'), colLabels: Array(80).fill('c'), values: Array.from({ length: 80 }, () => Array(80).fill(1)) }}></lr-heatmap>`);
  const probe = el as unknown as { drawDirty: boolean; canvasHasContent: boolean; requestDraw(): void; repaintCell(pos: unknown): boolean };
  await waitUntil(() => probe.canvasHasContent && !probe.drawDirty);
  const full = countCalls(probe, 'requestDraw');
  const cells = countCalls(probe, 'repaintCell');
  try {
    el.selectedCells = [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    await el.updateComplete;
    expect(full.calls).to.equal(0);
    expect(cells.calls).to.equal(2);
    recordScaleMeasurement('lr-heatmap', 'selection@6400', { fullPaints: full.calls, cellPaints: cells.calls });
  } finally { full.restore(); cells.restore(); }
});

it('shares seven resolved ramp steps between theme signatures and painting', async () => {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .colorSteps=${['#123456', '#234567', '#345678', '#456789', '#567890', '#678901', '#789012']}></lr-heatmap>`);
  const probe = el as unknown as { refreshTheme(): void; themeSignature(): string; colorRamp(count: number, styles: CSSStyleDeclaration): unknown; resolveColorStep(value: string, fallback: string): string };
  probe.refreshTheme();
  (el as unknown as { cachedRamp: unknown }).cachedRamp = null;
  (el as unknown as { resolvedStepsMemo: unknown }).resolvedStepsMemo = undefined;
  const calls = countCalls(probe, 'resolveColorStep');
  try {
    probe.themeSignature();
    probe.colorRamp(5, getComputedStyle(el));
    expect(calls.calls).to.equal(7);
    recordScaleMeasurement('lr-heatmap', 'theme-ramp@7', { colorResolutions: calls.calls });
  } finally { calls.restore(); }
});

it('binary-searches 530 calendar columns for hit testing', async () => {
  const { hitTestCalendar } = await import('./heatmap-grid-navigation.js');
  let reads = 0;
  const columns = new Proxy(Array.from({ length: 531 }, (_, i) => i * 12), { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
  const hit = hitTestCalendar(529 * 12 + 2, 2, 530, columns, () => 10, () => [0,12,24,36,48,60,72], (week, weekday) => ({week, weekday, date: '2026-01-01'}), () => true);
  expect(hit?.week).to.equal(529);
  expect(reads).to.be.at.most(12);
  recordScaleMeasurement('lr-heatmap', 'calendar-hit@530', { columnReads: reads });
});

it('bounds raised budgets and never invokes matrix input accessors', async () => {
  const values = [Array(200).fill(1)];
  let reads = 0;
  Object.defineProperty(values[0], '1', { get() { reads++; return 9; } });
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap max-cells="1000000" .data=${{ kind: 'matrix', rowLabels: ['r'], colLabels: Array(200).fill('c'), values }}></lr-heatmap>`);
  const probe = el as unknown as { cellBudget: number };
  expect(probe.cellBudget).to.equal(100000);
  expect(reads).to.equal(0);
  el.maxCells = Number.NaN;
  expect(probe.cellBudget).to.equal(10000);
  el.maxCells = 0;
  expect(probe.cellBudget).to.equal(1);
});

it('discloses clone-budget loss of selected cells and clears the notice', async () => {
  const { expectDevWarning } = await import('../../../../test/expected-dev-warnings.js');
  expectDevWarning('lyra-collection-truncated:lr-heatmap:selectedCells');
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap .strings=${{ heatmapInputLimit: 'Selection limited' }} .selectedCells=${Array.from({ length: 10001 }, () => ({ row: 0, col: 0 }))}></lr-heatmap>`);
  expect(el.shadowRoot!.querySelector('[part="projection-limit"]')?.textContent?.trim()).to.equal('Selection limited');
  el.selectedCells = [];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="projection-limit"]')).to.equal(null);
});
