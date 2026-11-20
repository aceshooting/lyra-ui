import { html, nothing, type PropertyValues, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { activeElementIn, shadowFocusTarget } from '../../../internal/active-element.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { csvRow } from '../../../internal/csv.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { isRepeatedActivationKey } from '../../../internal/list-navigation.js';
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { sqrtStep } from './heatmap-scale.js';
import { MAX_HEATMAP_CELLS } from './heatmap-limits.js';
import { HeatmapMatrixSourceController, type MatrixExactRecord } from './heatmap-matrix-source-controller.js';
import type { LyraHeatmapMatrixReducer, LyraHeatmapMatrixSource, LyraHeatmapMatrixViewport, LyraHeatmapTile } from './heatmap-matrix-source.js';
import type { HeatmapData, HeatmapSelectedCell, HeatmapSelectionSource, MatrixCellPos, CalendarCellPos } from './heatmap-model.js';
import { FALLBACK_FOCUS_RING_COLOR, FALLBACK_NO_DATA_FILL, FALLBACK_SELECTED_COLOR, MAX_CANVAS_DIMENSION, RAMP_STEPS, ignoresGridKey } from './heatmap-config.js';

type CellCallback<R> = (pos: MatrixCellPos | CalendarCellPos, value: number) => R;

/** The heatmap members the matrix-source view drives. The heatmap passes itself; the members it
 *  keeps private are named here so the lazily loaded view has one reviewed contract with its owner. */
export interface HeatmapSourceHost extends HTMLElement, ReactiveControllerHost {
  readonly matrixSource: LyraHeatmapMatrixSource | null;
  matrixViewport: LyraHeatmapMatrixViewport | null;
  readonly matrixReducer: LyraHeatmapMatrixReducer;
  readonly data: HeatmapData;
  readonly domain: readonly number[] | undefined;
  readonly cellBudget: number;
  readonly effectiveLocale: string;
  readonly multiple: boolean;
  readonly selectedCells: readonly HeatmapSelectedCell[];
  readonly selectedCell: HeatmapSelectedCell | null;
  readonly accessibleCells: boolean;
  readonly cellInteractive: CellCallback<boolean> | undefined;
  readonly cellText: CellCallback<string> | undefined;
  readonly cellColor: CellCallback<string | undefined> | undefined;
  readonly scale: string;
  readonly valueLabel: string | undefined;
  readonly withoutLegend: boolean;
  readonly updateComplete: Promise<boolean>;
  readonly announcements: { announcePolite(text: string): void };
  cachedValueRange: [number, number] | null;
  drawDirty: boolean;
  canvasHasContent: boolean;
  sourceResult: number;
  sourceTooltip: { tile: LyraHeatmapTile; x: number; y: number } | null;
  sourceNeedsConfigure: boolean;
  sourceViewportInvalid: boolean;
  sourceViewportExplicit: boolean;
  sourceRevealIntent: number;
  sourceNavigationIntent: number;
  sourceBindingGeneration: number;
  localize(key: keyof LyraLocaleStrings, fallback?: string, values?: Record<string, string | number>): string;
  emit(type: string, detail: unknown): void;
  formatNumericValue(value: number): string;
  rampBucket(value: number, lo: number, hi: number, steps: number): number;
  colorRamp(steps: number, cs: CSSStyleDeclaration): { colors: string[] };
  readToken(cs: CSSStyleDeclaration, name: string, fallback: string): string;
  sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null;
  scheduleAfterUpdate(callback: () => void, key: string): void;
  renderLegend(range: [number, number] | null): TemplateResult;
  rebuildBoundedDecorations(): void;
  matrixController: HeatmapMatrixSourceController | undefined;
  sourceFocusVersion: number;
  sourceRestoringFocus: boolean;
  sourceHasSucceeded: boolean;
  sourceFailureAnnounced: boolean;
  sourceSelectedKeys: Set<string>;
  sourceSelectionKey: string;
  sourceSelectedCellsInput: unknown;
  sourceSelectedCellsEpoch: number;
  sourceWidth: number;
}

/** Matrix-source mode: provider-backed tiles, exact cell windows and their interaction. Loaded only
 *  once a `matrixSource` is assigned. */
  /** The source-mode share of the heatmap's `willUpdate()`. */
export function sourceWillUpdate(h: HeatmapSourceHost, changed: PropertyValues): void {
  const controller = h.matrixController!;
  if (changed.has('locale') || changed.has('strings')) { h.sourceRevealIntent++; h.sourceNavigationIntent++; controller.cancelExact(); }
  if (changed.has('data') || changed.has('maxCells')) h.sourceNeedsConfigure = true;
  if (!['mean', 'min', 'max'].includes(h.matrixReducer)) { controller.fail(); return; }
  if (changed.has('matrixReducer') && controller.error) h.sourceNeedsConfigure = true;
  configureSource(h);
  if (h.sourceSelectedCellsInput !== h.selectedCells || h.sourceSelectedCellsEpoch !== controller.requests.epoch) {
    h.sourceSelectedCellsInput = h.selectedCells; h.sourceSelectedCellsEpoch = controller.requests.epoch;
    h.sourceSelectedKeys.clear();
    for (let index = 0; index < Math.min(h.selectedCells.length, MAX_HEATMAP_CELLS); index++) {
      const cell = h.selectedCells[index];
      if (cell?.row !== undefined && cell.col !== undefined && controller.valid(cell.row, cell.col)) h.sourceSelectedKeys.add(`${cell.row}:${cell.col}`);
    }
  }
  const domain = controller.domain;
  h.cachedValueRange = h.domain && h.domain.length === 2 && h.domain.every(Number.isFinite) && h.domain[0]! <= h.domain[1]! ? [h.domain[0]!, h.domain[1]!] : domain ? [domain.min, domain.max] : null;
  h.rebuildBoundedDecorations();
  const focused = shadowFocusTarget(h) as HTMLElement | null;
  if (focused?.dataset['sourceRow'] !== undefined && !controller.cells.some(cell => String(cell.row) === focused.dataset['sourceRow'] && String(cell.col) === focused.dataset['sourceCol'])) {
    h.sourceRestoringFocus = true;
    try { h.shadowRoot?.querySelector<HTMLElement>('[part="source-exact-window"]')?.focus(); }
    finally { h.sourceRestoringFocus = false; }
  }
}

/** The source-mode share of the heatmap's `updated()`. */
export function sourceUpdated(h: HeatmapSourceHost): void {
  const controller = h.matrixController!;
  if (controller.error) {
    if (h.sourceHasSucceeded && !h.sourceFailureAnnounced) h.announcements.announcePolite(h.localize('heatmapSourceError'));
    h.sourceFailureAnnounced = true;
  } else if (!controller.loading) { h.sourceHasSucceeded = true; h.sourceFailureAnnounced = false; }
  paintSource(h);
  const selected = h.selectedCell;
  const selectionKey = `${controller.requests.epoch}:${selected?.row}:${selected?.col}`;
  if (selectionKey !== h.sourceSelectionKey) {
    h.sourceSelectionKey = selectionKey;
    controller.selected = null;
    if (selected?.row !== undefined && selected.col !== undefined && controller.valid(selected.row, selected.col)) {
      const epoch = controller.requests.epoch, source = h.matrixSource;
      void controller.exact(selected.row, selected.col).then(cell => {
        if (cell && sourceCurrent(h, source, epoch) && h.sourceSelectionKey === selectionKey) {
          controller.selected = cell; h.sourceResult++;
        }
      });
    }
  }
  if (h.accessibleCells && controller.viewport && !controller.error) {
    const cursor = controller.cursor;
    void controller.ensureWindow(cursor?.row ?? controller.viewport.rowStart, cursor?.col ?? controller.viewport.columnStart);
  }
}

/** Focus an exact source coordinate without selecting it. Pans an explicit viewport when needed. */
export async function revealSource(h: HeatmapSourceHost, row: number, col: number): Promise<boolean> {
  const controller = h.matrixController!;
  const source = h.matrixSource, intent = ++h.sourceRevealIntent;
  if (!source || !h.isConnected) return false;
  const owner = h.ownerDocument, generation = h.sourceBindingGeneration;
  const currentIntent = () => intent === h.sourceRevealIntent && generation === h.sourceBindingGeneration && h.matrixSource === source && h.isConnected && h.ownerDocument === owner;
  if (!h.matrixController) {
    await h.updateComplete;
    if (!currentIntent() || !h.matrixController) return false;
  }
  controller.retainWindowFor(row, col);
  if (!currentIntent()) return false;
  await h.updateComplete;
  if (!currentIntent()) return false;
  if (h.matrixSource !== source || !controller.valid(row, col) || controller.error) return false;
  const viewport = controller.viewport;
  if (viewport && h.matrixViewport && (row < viewport.rowStart || row >= viewport.rowEnd || col < viewport.columnStart || col >= viewport.columnEnd)) {
    const height = viewport.rowEnd - viewport.rowStart, width = viewport.columnEnd - viewport.columnStart;
    const rowStart = Math.max(0, Math.min(controller.rows - height, row)), columnStart = Math.max(0, Math.min(controller.cols - width, col));
    h.matrixViewport = Object.freeze({ rowStart, rowEnd: rowStart + height, columnStart, columnEnd: columnStart + width });
    await h.updateComplete;
    if (!currentIntent()) return false;
  }
  const focusBefore = activeElementIn(h.ownerDocument);
  const focusVersion = h.sourceFocusVersion;
  const epoch = controller.requests.epoch;
  const current = () => currentIntent() && sourceCurrent(h, source, epoch) && focusVersion === h.sourceFocusVersion;
  const cell = await controller.exact(row, col);
  if (!cell || !current()) return false;
  const cellInteractive = h.cellInteractive;
  if (!current()) return false;
  const interactive = cellInteractive?.call(h, { row, col }, cell.value ?? Number.NaN) ?? true;
  if (!interactive || !current()) return false;
  const label = sourceCellLabel(h, cell, current);
  if (!current()) return false;
  controller.cursor = cell;
  if (h.accessibleCells && !await controller.ensureWindow(row, col)) return false;
  if (!current()) return false;
  h.sourceResult++;
  await h.updateComplete;
  if (!current()) return false;
  const control = h.shadowRoot?.querySelector<HTMLElement>(`[data-source-row="${row}"][data-source-col="${col}"]`) ?? h.shadowRoot?.querySelector<HTMLElement>('[data-source-entry]');
  if (activeElementIn(h.ownerDocument) !== focusBefore) return false;
  h.sourceRestoringFocus = true;
  try { control?.focus(); } finally { h.sourceRestoringFocus = false; }
  if (current()) h.announcements.announcePolite(label);
  return Boolean(control) && current();
}
function sourceCurrent(h: HeatmapSourceHost, source: LyraHeatmapMatrixSource | null, epoch: number): boolean {
  return h.isConnected && h.matrixSource === source && h.matrixController!.requests.epoch === epoch;
}
function configureSource(h: HeatmapSourceHost): void {
  const controller = h.matrixController!;
  if (!h.matrixSource || !controller) return;
  const width = Math.floor(Math.min(MAX_CANVAS_DIMENSION, Math.max(0, h.getBoundingClientRect().width)));
  if (width <= 0) return;
  if (!h.sourceNeedsConfigure && width === h.sourceWidth) return;
  h.sourceWidth = width; h.sourceNeedsConfigure = false;
  h.sourceTooltip = null;
  if (h.sourceViewportInvalid || h.data.kind !== 'matrix' || !['mean', 'min', 'max'].includes(h.matrixReducer)) { controller.fail(); return; }
  controller.configure(h.matrixSource, h.matrixViewport, h.sourceViewportExplicit,
    Math.min(h.cellBudget, Math.max(1, width * width)));
  h.sourceViewportExplicit = false;
}
function sourceValueLabel(h: HeatmapSourceHost, value: number | null): string {
  return value === null ? h.localize('heatmapNoDataValue') : h.formatNumericValue(value);
}

function sourceRangeLabel(h: HeatmapSourceHost, tile: LyraHeatmapTile): string {
  const number = getNumberFormat(h.effectiveLocale);
  return h.localize('heatmapSourceRangeLabel', undefined, {
    rowStart: number.format(tile.rowStart + 1),
    rowEnd: number.format(tile.rowEnd),
    columnStart: number.format(tile.columnStart + 1),
    columnEnd: number.format(tile.columnEnd),
    valid: number.format(tile.validCount),
    count: number.format(tile.count),
    min: sourceValueLabel(h, tile.min),
    max: sourceValueLabel(h, tile.max),
    reducer: sourceReducerLabel(h),
    value: sourceValueLabel(h, sourceTileValue(h, tile)),
  });
}
function sourceHover(h: HeatmapSourceHost, event: MouseEvent): void {
  const controller = h.matrixController!;
  const viewport = controller.viewport;
  if (!viewport || controller.loading || controller.error) return;
  const canvas = event.currentTarget as HTMLCanvasElement;
  const bounds = canvas.getBoundingClientRect();
  const fx = (event.clientX - bounds.left) / bounds.width;
  const fy = (event.clientY - bounds.top) / bounds.height;
  const row = viewport.rowStart + Math.floor(fy * (viewport.rowEnd - viewport.rowStart));
  const col = viewport.columnStart + Math.floor(fx * (viewport.columnEnd - viewport.columnStart));
  const tile = sourceTileAt(h, row, col);
  h.sourceTooltip = tile ? {
    tile,
    x: canvas.offsetLeft + fx * canvas.offsetWidth,
    y: canvas.offsetTop + fy * canvas.offsetHeight,
  } : null;
}
function sourceReducerLabel(h: HeatmapSourceHost): string {
  return h.localize(h.matrixReducer === 'min' ? 'heatmapSourceMin' : h.matrixReducer === 'max' ? 'heatmapSourceMax' : 'heatmapSourceMean');
}
function sourceTileValue(h: HeatmapSourceHost, tile: LyraHeatmapTile): number | null {
  return tile.validCount === 0 ? null : h.matrixReducer === 'mean' ? tile.sum / tile.validCount : tile[h.matrixReducer];
}
function sourceRange(h: HeatmapSourceHost, tile: LyraHeatmapTile): void {
  const controller = h.matrixController!;
  if (!h.matrixSource || controller.error || controller.loading || controller.revision === undefined) return;
  h.emit('lr-matrix-range-select', Object.freeze({ ...tile, revision: controller.revision }));
}
async function sourceActivate(h: HeatmapSourceHost, row: number, col: number, origin: HeatmapSelectionSource = 'keyboard'): Promise<void> {
  const controller = h.matrixController!;
  const source = h.matrixSource, epoch = controller.requests.epoch;
  if (!source) return;
  const cell = await controller.exact(row, col);
  if (!cell || !sourceCurrent(h, source, epoch)) return;
  const cellInteractive = h.cellInteractive;
  if (!sourceCurrent(h, source, epoch)) return;
  const interactive = cellInteractive?.call(h, { row, col }, cell.value ?? Number.NaN) ?? true;
  if (!interactive || !sourceCurrent(h, source, epoch)) return;
  controller.cursor = cell; h.sourceResult++;
  if (h.multiple) {
    const cells = h.selectedCells.slice(0, MAX_HEATMAP_CELLS).filter(cell => cell.row !== undefined && cell.col !== undefined && controller.valid(cell.row, cell.col));
    const found = cells.some(cell => cell.row === row && cell.col === col);
    const next = found ? cells.filter(cell => cell.row !== row || cell.col !== col) : [...cells.slice(0, MAX_HEATMAP_CELLS - 1), { row, col }];
    if (!sourceCurrent(h, source, epoch)) return;
    h.emit('lr-selection-change', { selectedCells: next, source: origin });
    if (!sourceCurrent(h, source, epoch)) return;
  }
  h.emit('lr-cell-activate', Object.freeze({ row, col, value: cell.value ?? Number.NaN }));
}
function sourceTileAt(h: HeatmapSourceHost, row: number, col: number): LyraHeatmapTile | undefined {
  return h.matrixController!.tiles.find(tile => row >= tile.rowStart && row < tile.rowEnd && col >= tile.columnStart && col < tile.columnEnd);
}
function sourceClick(h: HeatmapSourceHost, event: MouseEvent): void {
  const controller = h.matrixController!, viewport = controller.viewport;
  if (!viewport || controller.loading || controller.error) return;
  const bounds = (event.currentTarget as HTMLCanvasElement).getBoundingClientRect();
  const row = Math.min(viewport.rowEnd - 1, viewport.rowStart + Math.floor((event.clientY - bounds.top) / bounds.height * (viewport.rowEnd - viewport.rowStart)));
  const col = Math.min(viewport.columnEnd - 1, viewport.columnStart + Math.floor((event.clientX - bounds.left) / bounds.width * (viewport.columnEnd - viewport.columnStart)));
  const tile = sourceTileAt(h, row, col);
  if (tile?.count === 1) void sourceActivate(h, row, col, 'pointer');
  else if (tile) sourceRange(h, tile);
}
async function sourceKeydown(h: HeatmapSourceHost, event: KeyboardEvent): Promise<void> {
  if (ignoresGridKey(event)) return;
  const controller = h.matrixController!, viewport = controller.viewport;
  const source = h.matrixSource, epoch = controller.requests.epoch, navigation = ++h.sourceNavigationIntent;
  if (!source || !viewport || controller.error) return;
  const cursor = controller.cursor;
  let row = cursor?.row ?? viewport.rowStart, col = cursor?.col ?? viewport.columnStart;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (isRepeatedActivationKey(event)) return;
    if (event.shiftKey) { const tile = sourceTileAt(h, row, col); if (tile) sourceRange(h, tile); }
    else await sourceActivate(h, row, col);
    return;
  }
  let dr = 0, dc = 0;
  if (event.key === 'ArrowDown') dr = 1;
  else if (event.key === 'ArrowUp') dr = -1;
  else if (event.key === 'ArrowRight') dc = 1;
  else if (event.key === 'ArrowLeft') dc = -1;
  else if (event.key === 'PageDown') dr = Math.min(20, controller.rows);
  else if (event.key === 'PageUp') dr = -Math.min(20, controller.rows);
  else if (event.key === 'Home') { col = 0; if (event.ctrlKey) row = 0; }
  else if (event.key === 'End') { col = controller.cols - 1; if (event.ctrlKey) row = controller.rows - 1; }
  else return;
  event.preventDefault();
  for (let attempt = 0; attempt < 32; attempt++) {
    row = Math.max(0, Math.min(controller.rows - 1, row + dr)); col = Math.max(0, Math.min(controller.cols - 1, col + dc));
    const reveal = revealSource(h, row, col), intent = h.sourceRevealIntent;
    if (await reveal) return;
    if (navigation !== h.sourceNavigationIntent || intent !== h.sourceRevealIntent || !sourceCurrent(h, source, epoch)) return;
    if (!dr && !dc) return;
  }
}
function sourceCellLabel(h: HeatmapSourceHost, cell: MatrixExactRecord, current: () => boolean): string {
  const cellText = h.cellText;
  if (!current()) return '';
  return cellText?.call(h, { row: cell.row, col: cell.col }, cell.value ?? Number.NaN) ??
    h.localize('heatmapMatrixCellLabel', undefined, { row: cell.rowLabel, col: cell.columnLabel, value: sourceValueLabel(h, cell.value) });
}
export function sourceCsv(h: HeatmapSourceHost): string {
  const controller = h.matrixController!;
  if (controller.loading || controller.error || !controller.tiles.length) return '';
  const header = 'rowStart,rowEnd,columnStart,columnEnd,count,validCount,min,max,sum,reducer,value';
  const rows = controller.tiles.map(tile => csvRow([
    tile.rowStart, tile.rowEnd, tile.columnStart, tile.columnEnd, tile.count, tile.validCount,
    tile.min, tile.max, tile.sum, h.matrixReducer, sourceTileValue(h, tile),
  ]));
  return [header, ...rows].join('\r\n');
}
export function paintSource(h: HeatmapSourceHost): void {
  const controller = h.matrixController!;
  if (!controller) return;
  configureSource(h);
  const viewport = controller.viewport;
  const canvas = h.shadowRoot?.querySelector<HTMLCanvasElement>('canvas');
  if (!canvas || !viewport || controller.loading || controller.error) return;
  const source = h.matrixSource!, epoch = controller.requests.epoch;
  const width = h.sourceWidth, ctx = h.sizeCanvas(canvas, width, width);
  const cs = h.ownerDocument.defaultView?.getComputedStyle(h);
  if (!ctx || !cs) {
    h.scheduleAfterUpdate(() => {
      if (sourceCurrent(h, source, epoch)) controller.fail();
    }, 'heatmap-source-canvas-failure');
    return;
  }
  const ramp = h.colorRamp(RAMP_STEPS, cs).colors, noData = h.readToken(cs, 'no-data-fill', FALLBACK_NO_DATA_FILL);
  const lo = h.cachedValueRange?.[0] ?? 0, hi = h.cachedValueRange?.[1] ?? 1;
  ctx.clearRect(0, 0, width, width);
  for (const tile of controller.tiles) {
    const value = sourceTileValue(h, tile);
    const magnitude = Math.max(1, Math.abs(lo), Math.abs(hi), Math.abs(value ?? 0));
    const normalized = value === null || lo === hi ? 0 : (value / magnitude - lo / magnitude) / (hi / magnitude - lo / magnitude);
    ctx.fillStyle = value === null ? noData : ramp[h.scale === 'sqrt' ? Math.max(0, sqrtStep(Math.max(0, normalized), 1, ramp.length)) : h.rampBucket(value, lo, hi, ramp.length)]!;
    ctx.fillRect((tile.columnStart - viewport.columnStart) / (viewport.columnEnd - viewport.columnStart) * width,
      (tile.rowStart - viewport.rowStart) / (viewport.rowEnd - viewport.rowStart) * width,
      (tile.columnEnd - tile.columnStart) / (viewport.columnEnd - viewport.columnStart) * width,
      (tile.rowEnd - tile.rowStart) / (viewport.rowEnd - viewport.rowStart) * width);
  }
  const cursor = controller.cursor;
  if (cursor && cursor.row >= viewport.rowStart && cursor.row < viewport.rowEnd && cursor.col >= viewport.columnStart && cursor.col < viewport.columnEnd) {
    ctx.strokeStyle = h.readToken(cs, 'focus-ring-color', FALLBACK_FOCUS_RING_COLOR);
    ctx.strokeRect((cursor.col - viewport.columnStart) / (viewport.columnEnd - viewport.columnStart) * width,
      (cursor.row - viewport.rowStart) / (viewport.rowEnd - viewport.rowStart) * width,
      Math.max(1, width / (viewport.columnEnd - viewport.columnStart)), Math.max(1, width / (viewport.rowEnd - viewport.rowStart)));
  }
  const selected = h.selectedCell;
  if (selected?.row !== undefined && selected.col !== undefined && controller.valid(selected.row, selected.col) &&
      selected.row >= viewport.rowStart && selected.row < viewport.rowEnd && selected.col >= viewport.columnStart && selected.col < viewport.columnEnd) {
    ctx.strokeStyle = h.readToken(cs, 'selected-color', FALLBACK_SELECTED_COLOR);
    ctx.strokeRect((selected.col - viewport.columnStart) / (viewport.columnEnd - viewport.columnStart) * width,
      (selected.row - viewport.rowStart) / (viewport.rowEnd - viewport.rowStart) * width,
      Math.max(1, width / (viewport.columnEnd - viewport.columnStart)), Math.max(1, width / (viewport.rowEnd - viewport.rowStart)));
  }
  if (!sourceCurrent(h, source, epoch)) return;
  h.drawDirty = false;
  h.canvasHasContent = true;
}
export function renderSource(h: HeatmapSourceHost): TemplateResult {
  const controller = h.matrixController!, viewport = controller.viewport;
  const number = (value: number) => getNumberFormat(h.effectiveLocale).format(value);
  const summary = viewport ? h.localize('heatmapSourceSummary', undefined, { rows: number(controller.rows), cols: number(controller.cols), rowStart: number(viewport.rowStart + 1), rowEnd: number(viewport.rowEnd), columnStart: number(viewport.columnStart + 1), columnEnd: number(viewport.columnEnd), tiles: number(controller.tiles.length) }) : h.localize('noData');
  const completeSummary = h.localize('heatmapMatrixLabel', undefined, { rows: number(controller.rows), cols: number(controller.cols), label: h.valueLabel || h.localize('heatmapValueLabel'), range: controller.domain ? `${number(controller.domain.min)}–${number(controller.domain.max)}` : h.localize('heatmapNoDataValue') });
  const cells = controller.cells;
  const rows = [...new Set(cells.map(cell => cell.row))];
  const cursor = controller.cursor;
  const source = h.matrixSource!, epoch = controller.requests.epoch;
  const presentation = new Map<MatrixExactRecord, { label: string; interactive: boolean; color: string | undefined }>();
  const current = () => sourceCurrent(h, source, epoch);
  for (const cell of cells) {
    const cellInteractive = h.cellInteractive;
    if (!current()) return html``;
    const interactive = cellInteractive?.call(h, { row: cell.row, col: cell.col }, cell.value ?? Number.NaN) ?? true;
    if (!current()) return html``;
    const label = sourceCellLabel(h, cell, current);
    if (!current()) return html``;
    const cellColor = h.cellColor;
    if (!current()) return html``;
    const color = cellColor?.call(h, { row: cell.row, col: cell.col }, cell.value ?? Number.NaN);
    if (!sourceCurrent(h, source, epoch)) return html``;
    presentation.set(cell, { label, interactive, color: color ? sanitizeCssColor(color) ?? undefined : undefined });
  }
  const entry = cells.find(cell => presentation.get(cell)?.interactive && cell.row === cursor?.row && cell.col === cursor.col) ?? cells.find(cell => presentation.get(cell)?.interactive);
  const windowLabel = cells.length ? h.localize('heatmapSourceExactWindow', undefined, { rowStart: number(cells[0]!.row + 1), rowEnd: number(cells[cells.length - 1]!.row + 1), columnStart: number(Math.min(...cells.map(cell => cell.col)) + 1), columnEnd: number(Math.max(...cells.map(cell => cell.col)) + 1) }) : h.localize('loading');
  return html`<div part="base" aria-busy=${String(controller.loading)} @focusin=${() => { if (!h.sourceRestoringFocus) h.sourceFocusVersion++; }}>
    <p part="source-summary">${summary} ${completeSummary}</p>
    <p id="source-help">${h.localize('heatmapSourceKeyboardHelp')}</p>
    ${controller.error ? html`<p part="source-error">${h.localize('heatmapSourceError')}</p>` : nothing}
    ${viewport ? html`<div class="source-axes" aria-hidden="true"><span>${number(viewport.columnStart + 1)}</span><span>${number(viewport.columnStart + Math.floor((viewport.columnEnd - viewport.columnStart - 1) / 2) + 1)}</span><span>${number(viewport.columnEnd)}</span></div>` : nothing}
    <canvas part="canvas" data-source-entry tabindex=${h.accessibleCells ? '-1' : '0'} role=${h.accessibleCells ? nothing : 'application'}
      aria-hidden=${h.accessibleCells ? 'true' : nothing} aria-label=${h.accessibleCells ? nothing : normalizeLabel(h.getAttribute('aria-label')) ?? summary} aria-describedby="source-help"
      @click=${(e: MouseEvent) => sourceClick(h, e)} @mousemove=${(e: MouseEvent) => sourceHover(h, e)} @mouseleave=${() => { h.sourceTooltip = null; }} @keydown=${(e: KeyboardEvent) => sourceKeydown(h, e)}></canvas>
    ${h.sourceTooltip ? html`<p part="tooltip" style=${styleMap({
      left: `${h.sourceTooltip.x}px`, top: `${h.sourceTooltip.y}px`,
    })}>${sourceRangeLabel(h, h.sourceTooltip.tile)}</p>` : nothing}
    ${h.accessibleCells ? html`<p>${windowLabel}</p><div part="source-exact-window" role="grid" aria-label=${normalizeLabel(h.getAttribute('aria-label')) ?? windowLabel}
      aria-rowcount=${controller.rows} aria-colcount=${controller.cols} tabindex=${entry ? '-1' : '0'} data-source-entry @keydown=${(e: KeyboardEvent) => sourceKeydown(h, e)}>
      ${rows.map(row => html`<div role="row" aria-rowindex=${row + 1}>${cells.filter(cell => cell.row === row).map(cell => html`<div role="gridcell" aria-colindex=${cell.col + 1} aria-selected=${String(h.multiple ? h.sourceSelectedKeys.has(`${cell.row}:${cell.col}`) : h.selectedCell?.row === cell.row && h.selectedCell.col === cell.col)}><button part="cell" data-source-row=${cell.row} data-source-col=${cell.col}
        ?disabled=${!presentation.get(cell)?.interactive} style=${styleMap({ backgroundColor: presentation.get(cell)?.color })}
        tabindex=${entry?.row === cell.row && entry?.col === cell.col ? '0' : '-1'}
        @focus=${() => { if (sourceCurrent(h, source, epoch) && controller.cells === cells) { controller.cursor = cell; controller.retainWindowFor(cell.row, cell.col); h.sourceResult++; } }}
        @click=${() => { if (sourceCurrent(h, source, epoch) && controller.cells === cells) void sourceActivate(h, cell.row, cell.col, 'pointer'); }}>${presentation.get(cell)?.label}</button></div>`)}</div>`)}
    </div>` : nothing}
    ${h.withoutLegend ? nothing : h.renderLegend(h.cachedValueRange)}
    <div part="source-status">${controller.loading ? h.localize('loading') : nothing}</div>
  </div>`;
}
