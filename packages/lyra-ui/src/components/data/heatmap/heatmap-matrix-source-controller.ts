import type { LyraSourceRevision } from '../../../data-sources.js';
import type { ReactiveControllerHost } from 'lit';
import { SourceRequestController, sourceCount, sourceRevision, type SourceRequestLease } from '../../../internal/source-request-controller.js';
import type { LyraNumericDomain } from '../../../utilities/data-preparation.js';
import { matrixContains, matrixDomain, matrixExactCell, matrixRectangle, matrixTiles, type HeatmapSourceCell, type LyraHeatmapMatrixSource, type LyraHeatmapMatrixViewport, type LyraHeatmapTile } from './heatmap-matrix-source.js';

export interface MatrixExactRecord extends HeatmapSourceCell { readonly row: number; readonly col: number }
type ExactIntent = { row: number; col: number; lease: SourceRequestLease; resolve(value: MatrixExactRecord | null): void };
/** Domain-specific bounded scheduling; physical permits survive ignored cancellation. */
export class HeatmapMatrixSourceController {
  readonly requests: SourceRequestController<'tiles' | 'focus' | 'cells'>;
  source: LyraHeatmapMatrixSource | null = null;
  revision?: LyraSourceRevision;
  rows = 0;
  cols = 0;
  domain: LyraNumericDomain | null = null;
  viewport: LyraHeatmapMatrixViewport | null = null;
  tiles: readonly LyraHeatmapTile[] = [];
  cells: readonly MatrixExactRecord[] = [];
  cursor: MatrixExactRecord | null = null;
  selected: MatrixExactRecord | null = null;
  loading = false;
  error = false;
  private tileBusy = false;
  private tileIntent?: { lease: SourceRequestLease; source: LyraHeatmapMatrixSource; viewport: LyraHeatmapMatrixViewport; budget: number; domain: LyraNumericDomain | null };
  private exactBusy = 0;
  private readonly pendingCoordinates = new Set<string>();
  private focusIntent?: ExactIntent;
  private window?: { lease: SourceRequestLease; rectangle: LyraHeatmapMatrixViewport; next: number; results: MatrixExactRecord[]; pending: number; done: Promise<boolean>; finish(value: boolean): void };
  private acceptedInput: LyraHeatmapMatrixViewport | null = null;
  private previousViewport: LyraHeatmapMatrixViewport | null = null;
  private key = '';
  private cancelFocus?: () => void;
  private exactVersion = 0;
  private windowVersion = 0;
  constructor(host: HTMLElement & ReactiveControllerHost, private readonly repaint: () => void, private readonly locale: () => string) {
    this.requests = new SourceRequestController(host, { channels: ['tiles', 'focus', 'cells'], onReset: () => this.clear() });
  }
  cancelExact(): void {
    const version = ++this.exactVersion, epoch = this.requests.epoch;
    const cancel = this.cancelFocus, focus = this.focusIntent, window = this.window;
    this.cancelFocus = undefined; this.focusIntent = undefined; this.window = undefined;
    this.windowVersion++;
    if (window) { window.results.length = 0; window.finish(false); }
    cancel?.(); focus?.resolve(null);
    this.requests.invalidate('focus');
    if (version === this.exactVersion && epoch === this.requests.epoch) this.requests.invalidate('cells');
  }
  retainWindowFor(row: number, col: number): void {
    const window = this.window;
    if (!window || matrixContains(window.rectangle, { rowStart: row, rowEnd: row + 1, columnStart: col, columnEnd: col + 1 })) return;
    this.window = undefined; this.windowVersion++;
    window.results.length = 0; window.finish(false);
    this.requests.invalidate('cells');
  }
  detach(): void { this.requests.setSource(undefined, undefined); this.clear(); this.key = ''; }
  invalidate(): void { this.requests.refresh(); this.key = ''; }
  private clear(): void {
    this.exactVersion++; this.windowVersion++;
    this.source = null; this.rows = 0; this.cols = 0; this.domain = null; this.viewport = null; this.error = false;
    this.cancelFocus?.(); this.cancelFocus = undefined;
    this.focusIntent?.resolve(null); this.focusIntent = undefined;
    this.tileIntent = undefined;
    if (this.window) { this.window.results.length = 0; this.window.finish(false); }
    this.window = undefined;
    this.tiles = []; this.cells = []; this.cursor = null; this.selected = null;
    this.loading = false;
  }
  configure(source: LyraHeatmapMatrixSource, input: LyraHeatmapMatrixViewport | null, explicit: boolean, budget: number): void {
    const epoch = this.requests.epoch;
    try {
      const revision = sourceRevision(source.revision);
      if (this.requests.epoch !== epoch) return;
      const rows = sourceCount(source.rowCount);
      if (this.requests.epoch !== epoch) return;
      const cols = sourceCount(source.columnCount);
      if (this.requests.epoch !== epoch) return;
      if (!Number.isSafeInteger(rows * cols)) throw new RangeError('Invalid matrix size');
      const domain = matrixDomain(source.domain);
      if (this.requests.epoch !== epoch) return;
      const changed = this.requests.setSource(source, revision);
      if (this.requests.epoch !== epoch + (changed ? 1 : 0)) return;
      this.revision = revision;
      this.source = source; this.rows = rows; this.cols = cols; this.domain = domain;
      let viewport: LyraHeatmapMatrixViewport | null = null;
      if (input !== null) {
        const rectangle = matrixRectangle(input);
        if (rows && cols) {
          if (!explicit && input === this.acceptedInput && this.previousViewport) {
            const height = Math.min(rows, this.previousViewport.rowEnd - this.previousViewport.rowStart);
            const width = Math.min(cols, this.previousViewport.columnEnd - this.previousViewport.columnStart);
            const rowStart = Math.min(this.previousViewport.rowStart, rows - height), columnStart = Math.min(this.previousViewport.columnStart, cols - width);
            viewport = Object.freeze({ rowStart, rowEnd: rowStart + height, columnStart, columnEnd: columnStart + width });
          } else viewport = rectangle;
          if (!matrixContains({ rowStart: 0, rowEnd: rows, columnStart: 0, columnEnd: cols }, viewport)) throw new RangeError('Invalid matrix viewport');
        } else if (explicit) throw new RangeError('Invalid empty matrix viewport');
      } else if (rows && cols) viewport = Object.freeze({ rowStart: 0, rowEnd: rows, columnStart: 0, columnEnd: cols });
      this.acceptedInput = input; this.previousViewport = viewport; this.viewport = viewport;
      this.error = false;
      if (!viewport) { this.tiles = []; this.loading = false; return; }
      const key = `${this.requests.epoch}:${viewport.rowStart}:${viewport.rowEnd}:${viewport.columnStart}:${viewport.columnEnd}:${budget}`;
      if (key === this.key) return;
      this.key = key;
      const configuredEpoch = this.requests.epoch;
      this.cancelExact();
      if (configuredEpoch !== this.requests.epoch || this.source !== source) return;
      const lease = this.requests.begin('tiles', this.locale());
      if (!lease) return;
      this.loading = true;
      this.tileIntent = { lease, source, viewport, budget, domain };
      this.pumpTiles();
    } catch { if (this.requests.epoch === epoch || this.source === source) this.fail(); }
  }
  fail(): void { if (this.error) return; this.invalidate(); this.error = true; this.repaint(); }
  private pumpTiles(): void {
    if (this.tileBusy || !this.tileIntent) return;
    const intent = this.tileIntent; this.tileIntent = undefined;
    if (!intent.lease.isCurrent()) return;
    this.tileBusy = true;
    void (async () => {
      try {
        const query = intent.source.query;
        if (!intent.lease.isCurrent()) return;
        const raw = query.call(intent.source, Object.freeze({ ...intent.viewport, maxCells: intent.budget, signal: intent.lease.context.signal }));
        const reply = await raw;
        if (!intent.lease.isCurrent()) return;
        const tiles = matrixTiles(reply, intent.viewport, intent.budget, intent.domain);
        if (!intent.lease.isCurrent()) return;
        this.tiles = tiles; this.loading = false; this.error = false; this.repaint();
      } catch { if (intent.lease.isCurrent()) { this.tiles = []; this.loading = false; this.error = true; this.repaint(); } }
      finally { this.tileBusy = false; this.pumpTiles(); }
    })();
  }
  valid(row: number, col: number): boolean {
    return Number.isSafeInteger(row) && Number.isSafeInteger(col) && row >= 0 && col >= 0 && row < this.rows && col < this.cols;
  }
  cached(row: number, col: number): MatrixExactRecord | undefined {
    if (this.cursor?.row === row && this.cursor.col === col) return this.cursor;
    return this.cells.find(cell => cell.row === row && cell.col === col) ?? this.window?.results.find(cell => cell.row === row && cell.col === col) ?? (this.selected?.row === row && this.selected.col === col ? this.selected : undefined);
  }
  exact(row: number, col: number): Promise<MatrixExactRecord | null> {
    const version = ++this.exactVersion, epoch = this.requests.epoch;
    const cancel = this.cancelFocus, focus = this.focusIntent;
    this.cancelFocus = undefined; this.focusIntent = undefined;
    cancel?.(); focus?.resolve(null);
    this.requests.invalidate('focus');
    if (version !== this.exactVersion || epoch !== this.requests.epoch || !this.valid(row, col) || !this.source || this.error) return Promise.resolve(null);
    const cached = this.cached(row, col);
    if (cached) return Promise.resolve(cached);
    const lease = this.requests.begin('focus', this.locale());
    if (!lease || version !== this.exactVersion) return Promise.resolve(null);
    return new Promise(resolve => {
      let settled = false;
      const finish = (value: MatrixExactRecord | null) => { if (!settled) { settled = true; resolve(value); } };
      this.cancelFocus = () => finish(null);
      this.focusIntent = { row, col, lease, resolve: finish };
      this.pumpExact();
    });
  }
  ensureWindow(row: number, col: number): Promise<boolean> {
    if (!this.valid(row, col) || this.error) return Promise.resolve(false);
    const height = Math.min(20, this.rows), width = Math.min(20, this.cols);
    const rowStart = Math.max(0, Math.min(this.rows - height, row - Math.floor(height / 2)));
    const columnStart = Math.max(0, Math.min(this.cols - width, col - Math.floor(width / 2)));
    const rectangle = Object.freeze({ rowStart, rowEnd: rowStart + height, columnStart, columnEnd: columnStart + width });
    if (this.window && matrixContains(this.window.rectangle, { rowStart: row, rowEnd: row + 1, columnStart: col, columnEnd: col + 1 })) return this.window.done;
    const version = ++this.windowVersion;
    const previous = this.window;
    this.window = undefined;
    if (previous) { previous.results.length = 0; previous.finish(false); }
    if (this.cells.some(cell => cell.row === row && cell.col === col)) {
      this.requests.invalidate('cells');
      return Promise.resolve(version === this.windowVersion);
    }
    const lease = this.requests.begin('cells', this.locale());
    if (!lease || version !== this.windowVersion) return Promise.resolve(false);
    let finish!: (value: boolean) => void;
    const done = new Promise<boolean>(resolve => { finish = resolve; });
    this.window = { lease, rectangle, next: 0, results: [], pending: 0, done, finish };
    this.pumpExact();
    return done;
  }
  private pumpExact(): void {
    while (this.exactBusy < 2) {
      if (this.focusIntent) {
        const intent = this.focusIntent;
        if (this.pendingCoordinates.has(`${this.requests.epoch}:${intent.row}:${intent.col}`)) return;
        this.focusIntent = undefined;
        if (!intent.lease.isCurrent()) { intent.resolve(null); continue; }
        const cached = this.cached(intent.row, intent.col);
        if (cached) { intent.resolve(cached); continue; }
        this.read(intent.row, intent.col, intent.lease, value => intent.resolve(value));
        continue;
      }
      const window = this.window;
      if (!window || !window.lease.isCurrent()) return;
      const width = window.rectangle.columnEnd - window.rectangle.columnStart;
      const count = width * (window.rectangle.rowEnd - window.rectangle.rowStart);
      if (window.next === count) {
        if (window.pending === 0) { this.cells = Object.freeze(window.results.sort((a, b) => a.row - b.row || a.col - b.col)); this.window = undefined; window.finish(true); this.repaint(); }
        return;
      }
      const index = window.next++;
      const row = window.rectangle.rowStart + Math.floor(index / width), col = window.rectangle.columnStart + index % width;
      const cached = this.cached(row, col);
      if (cached) { window.results.push(cached); continue; }
      window.pending++;
      this.read(row, col, window.lease, value => {
        window.pending--;
        if (window !== this.window || !window.lease.isCurrent()) return;
        if (value) window.results.push(value);
        else { window.results.length = 0; window.finish(false); this.window = undefined; this.error = true; this.repaint(); }
      });
    }
  }
  private read(row: number, col: number, lease: SourceRequestLease, complete: (value: MatrixExactRecord | null) => void): void {
    const source = this.source!, domain = this.domain;
    const coordinate = `${this.requests.epoch}:${row}:${col}`;
    this.pendingCoordinates.add(coordinate);
    this.exactBusy++;
    void (async () => {
      try {
        const getCell = source.getCell;
        if (!lease.isCurrent()) { complete(null); return; }
        const raw = getCell.call(source, row, col, { signal: lease.context.signal });
        const reply = await raw;
        if (!lease.isCurrent()) { complete(null); return; }
        const cell = matrixExactCell(reply, domain);
        complete(lease.isCurrent() ? Object.freeze({ row, col, ...cell }) : null);
      } catch { if (lease.isCurrent()) { this.error = true; this.repaint(); } complete(null); }
      finally { this.pendingCoordinates.delete(coordinate); this.exactBusy--; this.pumpExact(); }
    })();
  }
}
