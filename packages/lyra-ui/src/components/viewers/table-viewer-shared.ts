import type { LyraTabularSource, LyraWorkbookSource, LyraTabularColumn, LyraSourceCell, LyraTabularHit, LyraWorkbookHit, LyraSourceSearchResult } from '../../data-sources.js';
import { SourceRequestController, sourceCount, sourceRevision, type SourceRequestLease } from '../../internal/source-request-controller.js';
import { LyraResourceLimitError, isResourceLimitError } from '../../internal/resource-loader.js';
import type { LyraVirtualList, LyraVirtualListRange } from '../layout/virtual-list/virtual-list.class.js';
import type { LyraAnchor } from './document-viewer/anchors.js';
import { ThemeWatcher } from '../../internal/theme-watcher.js';
import { tag } from '../../internal/prefix.js';
import { resolveCssTokenLength } from '../../internal/css-token-length.js';
import { html, nothing, type ReactiveController, type PropertyValues, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { parseCellRange, type ParsedCellRange } from '../../internal/cell-range.js';
import { prioritizedHighlightCandidates } from '../../internal/anchor-target.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { OwnerAnimationFrameWaiter } from '../../internal/owner-animation-frame.js';
import type { LyraSearchChangeDetail } from '../../internal/text-viewer-target.js';
import { ViewerSearchState } from '../../internal/viewer-search.js';
import { DeferredTeardown } from '../../internal/deferred-teardown.js';
import type { LyraHighlight } from './document-viewer/anchors.js';
import { ViewerAnnouncementController } from './viewer-announcements.js';
import { boundedViewerSearchQuery, ViewerSearchWorkBudget } from './viewer-search-limits.js';

const MAX_TABLE_SEARCH_MATCHES = 1_000;

/** Runs a bounded cell search; `scan` calls `visit(text, match)` per cell in order and stops when it returns false. */
export function collectTableSearchMatches<M>(
  query: string,
  locale: string,
  enabled: boolean,
  scan: (visit: (text: string, match: M) => boolean) => void,
): { matches: M[]; exact: boolean } {
  const bounded = boundedViewerSearchQuery(query, locale);
  const matches: M[] = [];
  let exact = bounded.accepted;
  if (bounded.accepted && bounded.needle && enabled) {
    const budget = new ViewerSearchWorkBudget();
    scan((text, match) => {
      if (budget.includes(text, bounded.needle, locale)) {
        if (matches.length === MAX_TABLE_SEARCH_MATCHES) { exact = false; return false; }
        matches.push(match);
      }
      if (!budget.complete) { exact = false; return false; }
      return true;
    });
  }
  return { matches, exact };
}

interface CellHighlightRange {
  parsed: { startRow: number; endRow: number; startCol: number; endCol: number };
  sheet?: string;
}

export function tableHighlightsForRow<T extends CellHighlightRange>(
  highlights: readonly T[], rawRow: number, sheet?: string,
): T[] {
  if (!highlights.length) return highlights as T[];
  return highlights.filter((entry) =>
    (sheet === undefined || entry.sheet === undefined || entry.sheet === sheet)
    && rawRow - 1 >= entry.parsed.startRow
    && rawRow - 1 <= entry.parsed.endRow);
}

export function tableHighlightsForColumn<T extends CellHighlightRange>(highlights: readonly T[], col: number): T[] {
  if (!highlights.length) return highlights as T[];
  return highlights.filter((entry) => col >= entry.parsed.startCol && col <= entry.parsed.endCol);
}

/** Coordinates virtualized table scrolling with the host's current document realm. */
export class TableViewerScrollController {
  private readonly frames: OwnerAnimationFrameWaiter;
  private generation = 0;

  constructor(private readonly host: HTMLElement) {
    this.frames = new OwnerAnimationFrameWaiter(host);
  }

  cancel(): void { this.generation++; this.frames.cancel(); }

  async scrollColumnIntoView(list: HTMLElement & { updateComplete?: Promise<unknown> } | null, col: number): Promise<void> {
    this.frames.cancel();
    const generation = ++this.generation;
    const ownerDocument = this.host.ownerDocument;
    const isCurrent = () => generation === this.generation &&
      this.host.ownerDocument === ownerDocument && list?.isConnected === true;
    if (list?.updateComplete) await list.updateComplete;
    if (!list || !isCurrent()) return;
    if (!(await this.frames.wait()) || !isCurrent()) return;
    const row = list.shadowRoot?.querySelector('[part="row"][aria-current="true"]');
    this.reveal(row?.querySelector(`[aria-colindex="${col + 1}"]`) as HTMLElement | undefined);
  }

  reveal(target: HTMLElement | undefined): void {
    target?.scrollIntoView({
      behavior: prefersReducedMotion(this.host) ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }
}

/** One `highlights` entry resolved against a parsed grid; `sheet` is set only by sheet-aware viewers. */
export interface ResolvedCellHighlight {
  highlight: LyraHighlight;
  parsed: ParsedCellRange;
  sheet?: string;
}

export interface TableViewerHost extends ReactiveControllerHost, HTMLElement {
  src: string;
  readonly hasUpdated: boolean;
}

/** The element-side operations the controller cannot reach (protected members) or that differ per viewer. */
export interface TableViewerHooks<M> {
  repaint(): void;
  emitSearch(detail: LyraSearchChangeDetail): void;
  emitActivate(highlightId: string): void;
  localize(key: string, fallback?: string, values?: Record<string, string | number>): string;
  locale(): string;
  schedule(callback: () => void, key?: string): void;
  load(): Promise<void>;
  /** Runs the viewer's own `search()` again (locale change). */
  research(query: string): Promise<number>;
  /** Scrolls one match into view. */
  jump(match: M): Promise<unknown>;
  /** Drops pending work on a genuine disconnect or adoption. */
  teardown(): void;
  pageScroll?(): boolean;
}

/** Lifecycle, search state, highlights and scrolling shared by the csv, dataset and spreadsheet viewers. */
export class TableViewerController<M extends { row: number; col: number }> {
  readonly search: ViewerSearchState<M[]>;
  readonly announcements: ViewerAnnouncementController;
  readonly scroll: TableViewerScrollController;
  highlights: ResolvedCellHighlight[] = [];
  /** The virtualized body row last scrolled into view -- bound to `<lr-virtual-list>`'s `active-item-id`. */
  activeRowKey: number | '' = '';
  lastLoadSrc = '';
  private readonly sources = new WeakMap<readonly unknown[], { count: number; itemAt(index: number): unknown; keyAt(index: number): number; indexOfKey(key: string | number): number }>();
  indexedSource(rows: readonly unknown[]): { count: number; itemAt(index: number): unknown; keyAt(index: number): number; indexOfKey(key: string | number): number } | undefined {
    if (rows.length <= 10000) return undefined;
    let source = this.sources.get(rows);
    if (!source) {
      source = Object.freeze({ count: rows.length, itemAt: (index: number) => rows[index], keyAt: (index: number) => index, indexOfKey: (key: string | number) => typeof key === 'number' ? key : -1 });
      this.sources.set(rows, source);
    }
    return source;
  }
  private readonly rowHighlights = new Map<string, ResolvedCellHighlight[]>();
  private readonly columnHighlights = new WeakMap<ResolvedCellHighlight[], Map<number, ResolvedCellHighlight[]>>();
  private readonly windows = new Map<unknown, { start: number; end: number; count: number; width: number; offset: number; columns: number[]; style: string }>();
  private readonly renderers = new Map<unknown, { inputs: readonly unknown[]; render: (row: unknown, index: number) => TemplateResult }>();
  private resize?: ResizeObserver;
  private pageView?: Window;
  private geometryWidth?: number;
  private geometryAllocation?: number;
  private pageOffset = 0;
  private forcedPageOffset?: number;
  private readonly onPageScroll = (): void => {
    if (!this.hooks.pageScroll?.()) return;
    const rect = this.host.getBoundingClientRect();
    const rtl = this.host.ownerDocument.defaultView?.getComputedStyle(this.host).direction === 'rtl';
    const offset = Math.max(0, rtl ? rect.right - (this.pageView?.innerWidth ?? 0) : -rect.left);
    this.pageOffset = offset;
    this.geometryWidth = undefined;
    this.forcedPageOffset = undefined;
    this.hooks.repaint();
  };
  private lastLocale = '';
  private pendingResetEvent = false;
  private readonly detached: DeferredTeardown;
  private searchCorpus?: {
    source: unknown;
    locale: string;
    fields: { text: string | undefined; match: M }[];
    exact: boolean;
  };

  constructor(private readonly host: TableViewerHost, private readonly hooks: TableViewerHooks<M>) {
    this.search = new ViewerSearchState<M[]>(() => [], (detail) => hooks.emitSearch(detail), () => hooks.repaint());
    this.announcements = new ViewerAnnouncementController(host);
    this.scroll = new TableViewerScrollController(host);
    // A same-task DOM move keeps the loaded table; a genuine disconnect cancels pending work.
    this.detached = new DeferredTeardown(() => { hooks.teardown(); this.scroll.cancel(); });
  }

  /** After `super.connectedCallback()`. */
  connected(): void {
    this.announcements.connect();
    const Resize = this.host.ownerDocument.defaultView?.ResizeObserver;
    if (Resize && !this.resize) {
      this.resize = new Resize(() => { this.geometryWidth = undefined; this.hooks.repaint(); });
      this.resize.observe(this.host);
    }
    if (this.hooks.pageScroll && !this.pageView) {
      this.pageView = this.host.ownerDocument.defaultView ?? undefined;
      this.pageView?.addEventListener('scroll', this.onPageScroll, { passive: true });
      this.pageView?.addEventListener('resize', this.onPageScroll, { passive: true });
    }
    if (this.detached.cancel()) return;
    if (this.host.hasUpdated) {
      this.hooks.schedule(() => { void this.hooks.load(); });
    }
  }

  /** Before `super.disconnectedCallback()`. */
  disconnecting(): void {
    this.announcements.disconnect();
    this.resize?.disconnect();
    this.resize = undefined;
    this.pageView?.removeEventListener('scroll', this.onPageScroll);
    this.pageView?.removeEventListener('resize', this.onPageScroll);
    this.pageView = undefined;
  }

  /** After `super.disconnectedCallback()`. */
  disconnected(): void {
    this.detached.schedule();
  }

  /** After `super.adoptedCallback()`. */
  adopted(): void {
    this.detached.flush();
    this.disconnecting();
    if (this.host.isConnected) this.connected();
    this.scroll.cancel();
    this.announcements.adopted();
  }

  /** After `super.willUpdate()`; `sheets` keeps sheet-qualified highlights for a multi-sheet viewer. */
  willUpdate(changed: PropertyValues, highlights: readonly LyraHighlight[], activeHighlightId: string | null, sheets: boolean): void {
    this.geometryWidth = undefined;
    if (changed.has('scrollMode') || changed.has('fetchState')) this.forcedPageOffset = undefined;
    if (changed.has('activeSheetIndex')) this.windows.clear();
    if (changed.has('fetchState')) { this.scroll.cancel(); this.renderers.clear(); this.windows.clear(); this.rowHighlights.clear(); }
    if (changed.has('src') || changed.has('rows') || changed.has('table') || changed.has('workbook')) {
      this.searchCorpus = undefined;
      this.renderers.clear();
      this.windows.clear();
      this.pendingResetEvent ||= this.search.dirty;
      this.search.reset();
      this.activeRowKey = '';
    }
    if (changed.has('highlights') || changed.has('activeHighlightId')) {
      this.rowHighlights.clear();
      this.highlights = prioritizedHighlightCandidates(highlights, activeHighlightId).flatMap((highlight) => {
        if (highlight.anchor.kind !== 'cell-range' || (!sheets && highlight.anchor.sheet)) return [];
        const parsed = parseCellRange(highlight.anchor.range);
        if (!parsed) return [];
        return [sheets ? { highlight, parsed, sheet: highlight.anchor.sheet ?? parsed.sheet } : { highlight, parsed }];
      });
    }
  }

  /** After `super.updated()`. */
  updated(changed: PropertyValues, state: { kind: string; message?: string }): void {
    this.announcements.transition(
      'load',
      state.kind,
      state.kind === 'error' ? state.message : this.hooks.localize('loadingDocument'),
    );
    if (['dataSource', 'src', 'rows', 'table', 'workbook', 'maxRows', 'maxColumns', 'maxBytes'].some(key => changed.has(key))) this.hooks.schedule(() => { void this.hooks.load(); });
    if (this.pendingResetEvent) {
      this.pendingResetEvent = false;
      this.search.emit();
    }
    const locale = this.hooks.locale();
    if (locale !== this.lastLocale) {
      this.lastLocale = locale;
      if (this.search.query) this.hooks.schedule(() => { void this.hooks.research(this.search.query); }, 'search');
    }
  }

  setActiveRow(key: number | ''): void {
    this.activeRowKey = key;
    this.hooks.repaint();
  }

  /** `rawRow` is 1-based, including the header row -- the addressing every `cell-range` anchor uses. */
  highlightsForRow(rawRow: number, sheet?: string): ResolvedCellHighlight[] {
    if (!this.highlights.length) return this.highlights;
    const key = `${sheet ?? ''}:${rawRow}`;
    let result = this.rowHighlights.get(key);
    if (!result) { result = tableHighlightsForRow(this.highlights, rawRow, sheet); this.rowHighlights.set(key, result); if (this.rowHighlights.size > 256) this.rowHighlights.delete(this.rowHighlights.keys().next().value!); }
    return result;
  }

  renderCell(
    text: string,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    role: 'cell' | 'columnheader',
    part: 'cell' | 'header-cell',
    colorVar: string,
    activeHighlightId: string | null,
  ): TemplateResult {
    if (!rowHighlights.length) return html`<div part=${part} role=${role} aria-colindex=${colIndex + 1} style=${`grid-column:${colIndex + 1}`}>${text}</div>`;
    let byColumn = this.columnHighlights.get(rowHighlights);
    if (!byColumn) { byColumn = new Map(); this.columnHighlights.set(rowHighlights, byColumn); }
    let colHighlights = byColumn.get(colIndex);
    if (!colHighlights) { colHighlights = tableHighlightsForColumn(rowHighlights, colIndex); byColumn.set(colIndex, colHighlights); }
    if (!colHighlights.length) return html`<div part=${part} role=${role} aria-colindex=${colIndex + 1} style=${`grid-column:${colIndex + 1}`}>${text}</div>`;
    const active = colHighlights.find((entry) => entry.highlight.id === activeHighlightId);
    const primary = active ?? colHighlights[0]!;
    const accessibleLabel = primary.highlight.label
      ? this.hooks.localize('cellHighlightWithLabel', undefined, { value: text, label: primary.highlight.label })
      : this.hooks.localize('highlightWithLabel', undefined, { label: text });
    // The outer cell keeps its table role; the nested native button carries activation.
    return html`<div
      part="${part} cell-highlight"
      role=${role}
      aria-colindex=${colIndex + 1}
      ?data-active=${!!active}
      style=${`grid-column:${colIndex + 1};${active ? `${colorVar}: var(--lr-color-warning, var(--lr-color-brand))` : ''}`}
    >
      <button
        part="cell-highlight-action"
        type="button"
        aria-label=${accessibleLabel}
        @click=${() => this.hooks.emitActivate(primary.highlight.id)}
      >
        ${text}
      </button>
    </div>`;
  }


  /** Shared geometry bounds both header and body work to the visible inline range. */
  columnWindow(key: unknown, count: number, limit = count): { columns: number[]; style: string } {
    if (this.geometryWidth === undefined) {
      const view = this.host.ownerDocument.defaultView;
      const token = view?.getComputedStyle(this.host).getPropertyValue('--lr-size-8rem').trim() || '8rem';
      this.geometryWidth = Math.max(1, resolveCssTokenLength(token, { host: this.host }) ?? 1);
      if (this.hooks.pageScroll?.() && view) {
        const rect = this.host.getBoundingClientRect();
        const rtl = view.getComputedStyle(this.host).direction === 'rtl';
        const leading = rtl ? view.innerWidth - rect.right : rect.left;
        this.geometryAllocation = Math.max(0, view.innerWidth - Math.max(0, leading));
        this.pageOffset = Math.max(0, -leading);
      } else this.geometryAllocation = this.host.clientWidth;
    }
    const width = this.geometryWidth;
    const allocation = this.geometryAllocation ?? 0;
    let window = this.windows.get(key);
    const offset = this.hooks.pageScroll?.() ? this.forcedPageOffset ?? this.pageOffset : window?.offset ?? 0;
    const start = Math.min(Math.max(0, count - 1), Math.max(0, Math.floor(offset / width) - 2));
    const end = Math.min(count, start + Math.max(1, limit), Math.max(start + 1, Math.ceil((offset + allocation) / width) + 4));
    if (!window || window.count !== count || window.width !== width || window.start !== start || window.end !== end) {
      window = { start, end, count, width, offset, columns: Array.from({ length: end - start }, (_, index) => start + index), style: `grid-template-columns:repeat(${count},minmax(var(--lr-size-8rem),1fr));min-inline-size:calc(${count} * var(--lr-size-8rem))` };
      this.windows.set(key, window);
    }
    return window;
  }

  scrollColumns(key: unknown, target: HTMLElement): void {
    this.setColumnOffset(key, Math.abs(target.scrollLeft));
  }

  private setColumnOffset(key: unknown, offset: number): void {
    const window = this.windows.get(key);
    if (!window || window.offset === offset) return;
    window.offset = offset;
    const previous = window.columns;
    const next = this.columnWindow(key, window.count);
    if (next.columns !== previous) this.hooks.repaint();
  }

  async showColumn(key: unknown, col: number, scroller: HTMLElement | null): Promise<void> {
    const window = this.windows.get(key);
    if (!window || !scroller) return;
    if (col < window.start || col >= window.end) {
      const rtl = this.host.ownerDocument.defaultView?.getComputedStyle(this.host).direction === 'rtl';
      scroller.scrollLeft = (rtl ? -1 : 1) * col * window.width;
      if (this.hooks.pageScroll?.()) { this.forcedPageOffset = col * window.width; this.setColumnOffset(key, this.forcedPageOffset); }
      else this.scrollColumns(key, scroller);
      await this.host.updateComplete;
    }
  }

  /** Changes renderer identity only when its cell output can change. */
  rowRenderer(key: unknown, inputs: readonly unknown[], render: (row: unknown, index: number) => TemplateResult): (row: unknown, index: number) => TemplateResult {
    const dependencies = [...inputs, this.highlights, this.hooks.locale(), this.hooks.localize('highlightWithLabel'), this.hooks.localize('cellHighlightWithLabel')];
    const existing = this.renderers.get(key);
    if (existing && dependencies.length === existing.inputs.length && dependencies.every((value, index) => value === existing.inputs[index])) return existing.render;
    const rows = new Map<number, { row: unknown; result: TemplateResult }>();
    const memo = (row: unknown, index: number): TemplateResult => {
      const existing = rows.get(index);
      if (existing && existing.row === row) return existing.result;
      const result = render(row, index);
      rows.set(index, { row, result });
      if (rows.size > 256) rows.delete(rows.keys().next().value!);
      return result;
    };
    this.renderers.set(key, { inputs: dependencies, render: memo });
    return memo;
  }

  /** Scrolls a header cell into view; resolves whether it exists. */
  revealCell(target: HTMLElement | undefined): boolean {
    this.scroll.reveal(target);
    return !!target;
  }

  scrollColumnIntoView(root: ParentNode, selector: string, col: number): Promise<void> {
    return this.scroll.scrollColumnIntoView(root.querySelector(selector) as (HTMLElement & { updateComplete?: Promise<unknown> }) | null, col);
  }

  /** Stores the query, collects bounded matches via `scan`, publishes them and jumps to the first. */
  async runSearch(
    query: string,
    loaded: boolean,
    scan: (visit: (text: string, match: M) => boolean) => void,
    source: unknown = scan,
  ): Promise<number> {
    this.search.query = query;
    const locale = this.hooks.locale();
    this.lastLocale = locale;
    const bounded = boundedViewerSearchQuery(query, locale);
    const matches: M[] = [];
    let exact = bounded.accepted;
    if (loaded && bounded.accepted && bounded.needle) {
      let corpus = this.searchCorpus;
      if (!corpus || corpus.source !== source || corpus.locale !== locale) {
        const budget = new ViewerSearchWorkBudget();
        const fields: { text: string | undefined; match: M }[] = [];
        scan((text, match) => {
          fields.push({ text: budget.prepare(text, locale), match });
          return budget.complete;
        });
        corpus = { source, locale, fields, exact: budget.complete };
        this.searchCorpus = corpus;
      }
      exact = corpus.exact;
      for (const field of corpus.fields) {
        if (!field.text?.includes(bounded.needle)) continue;
        if (matches.length === MAX_TABLE_SEARCH_MATCHES) { exact = false; break; }
        matches.push(field.match);
      }
    }
    this.search.publish(matches, exact);
    if (matches.length > 0) await this.hooks.jump(matches[0]!);
    return matches.length;
  }

  async step(direction: 1 | -1): Promise<boolean> {
    if (!this.search.step(direction)) return false;
    return (await this.hooks.jump(this.search.matches[this.search.activeIndex]!)) !== false;
  }

  clearSearch(): void {
    this.activeRowKey = '';
    this.search.clear();
  }
}

interface SourceSheet { readonly key: string; readonly name: string; readonly data: LyraTabularSource }
interface CellRectangle {
  readonly key: string;
  readonly channel: 'cells0' | 'cells1';
  readonly row: number;
  readonly rows: number;
  readonly column: number;
  readonly columns: number;
  readonly lease: SourceRequestLease;
  readonly source: LyraTabularSource;
  readonly promise: Promise<boolean>;
  settle(value: boolean): void;
  state: 'queued' | 'loading' | 'ready';
  values?: readonly (readonly string[])[];
  units: number;
}
/** Finite message vocabulary forwarded by the table source adapters. */
export const TABLE_VIEWER_SOURCE_MESSAGE_KEYS = {
  documentPreviewResourceTooLarge: 'documentPreviewResourceTooLarge',
  documentPreviewFailedToLoad: 'documentPreviewFailedToLoad',
  noData: 'noData',
  loadingDocument: 'loadingDocument',
  sourceSearchUnavailable: 'sourceSearchUnavailable',
} as const;

interface TabularSourceHooks {
  source(): LyraTabularSource | LyraWorkbookSource | undefined;
  cancelAnchor(): void;
  readonly workbook: boolean;
  renderSheetTabs?(names: readonly string[], active: number, select: (index: number) => void): TemplateResult;
  header(): boolean;
  columnLimit(): number;
  locale(): string;
  localize(key: keyof typeof TABLE_VIEWER_SOURCE_MESSAGE_KEYS): string;
  repaint(): void;
  error(error: unknown): void;
  emitSearch(detail: LyraSearchChangeDetail): void;
  format(value: LyraSourceCell): string;
  label(rows: number): string;
  colorVar: string;
  headerPart: 'cell' | 'header-cell';
  activeHighlight(): string | null;
  pageScroll?(): boolean;
  scrollContainer?(): HTMLElement | null;
}
type SourceTableChrome = Pick<TableViewerController<{ row: number; col: number }>, 'columnWindow' | 'scrollColumns' | 'showColumn' | 'highlightsForRow' | 'renderCell' | 'rowRenderer' | 'revealCell'>;

/** Bounded rectangular access for the three scalar table viewers; logical rows remain indexed. */
export class TableViewerSourceController implements ReactiveController {
  private readonly authority: SourceRequestController<'cells0' | 'cells1' | 'search' | 'reveal'>;
  readonly searchState: ViewerSearchState<Array<{ sheetIndex: number; row: number; col: number }>>;
  private bound?: LyraTabularSource | LyraWorkbookSource;
  private revision?: string | number;
  private locale = '';
  private limit = 0;
  private dirty = true;
  private bindingIntent = 0;
  private theme?: ThemeWatcher;
  private sheets: readonly SourceSheet[] = [];
  private sheetIndex = 0;
  private sheet?: SourceSheet;
  private sheetRevision?: string | number;
  private rows = 0;
  private columns = 0;
  private slots: CellRectangle[] = [];
  private physicalReads = 0;
  private epoch = 0;
  private paint = 0;
  private firstRow = 0;
  private visibleRows = 0;
  private windowIntent = 0;
  private activeRow: number | '' = '';
  private windowColumns: readonly number[] = [];
  private labels: readonly LyraTabularColumn[] = [];
  private columnStart = 0;
  private labelUnits = 0;
  private failure?: unknown;
  private loaded = false;
  private pendingPaint = false;
  private sourceRows = this.makeRows();
  private searchRunning = false;
  private queuedSearch?: () => Promise<void>;

  constructor(private readonly host: TableViewerHost, private readonly chrome: SourceTableChrome, private readonly hooks: TabularSourceHooks) {
    this.searchState = new ViewerSearchState(() => [], detail => hooks.emitSearch(detail), () => hooks.repaint());
    this.authority = new SourceRequestController(host, { channels: ['cells0', 'cells1', 'search', 'reveal'], onReset: () => this.reset() });
    host.addController(this);
  }

  get enabled(): boolean { return this.hooks.source() !== undefined; }
  get busy(): boolean { return this.enabled && !this.failure && this.slots.some(slot => slot.state !== 'ready'); }
  private makeRows() {
    return { count: this.rows, itemAt: (index: number) => index, keyAt: (index: number) => index,
      indexOfKey: (key: string | number) => typeof key === 'number' && Number.isSafeInteger(key) && key >= 0 && key < this.rows ? key : -1 };
  }
  private notify(): void {
    if (this.pendingPaint) return;
    this.pendingPaint = true;
    const document = this.host.ownerDocument;
    queueMicrotask(() => { this.pendingPaint = false; if (this.host.isConnected && this.host.ownerDocument === document) this.hooks.repaint(); });
  }
  private reset(): void {
    this.epoch++;
    this.dirty = true;
    for (const slot of this.slots) slot.settle(false);
    this.slots = [];
    this.windowColumns = [];
    this.labels = [];
    this.labelUnits = 0;
    this.failure = undefined;
    this.loaded = false;
    this.firstRow = 0; this.visibleRows = 0;
    this.paint++;
    this.queuedSearch = undefined;
    this.notify();
  }
  /** Called synchronously for assignment, same-source rebind and public unnamed refresh. */
  refresh(): void { this.bindingIntent++; this.hooks.cancelAnchor(); this.authority.refresh(); }
  hostConnected(): void { this.dirty = true; this.notify(); }
  hostDisconnected(): void { this.dirty = true; }
  adopted(): void { this.hooks.cancelAnchor(); this.authority.adopted(); }

  update(): void {
    const source = this.hooks.source();
    const intent = this.bindingIntent;
    const locale = this.hooks.locale();
    const limit = this.hooks.columnLimit();
    if (source === this.bound && this.failure && !this.dirty && locale === this.locale && limit === this.limit) return;
    try {
      const revision = source === undefined ? undefined : sourceRevision(source.revision);
      if (source === this.bound && revision === this.revision && locale === this.locale && limit === this.limit && !this.dirty) return;
      if (source !== this.hooks.source() || intent !== this.bindingIntent) return;
      if (source === this.bound && (revision !== this.revision || locale !== this.locale || limit !== this.limit)) this.hooks.cancelAnchor();
      this.authority.setSource(source, revision);
      if (source !== this.hooks.source() || intent !== this.bindingIntent) return;
      if (source === this.bound && revision === this.revision && (locale !== this.locale || limit !== this.limit)) this.authority.refresh();
      const epoch = this.epoch;
      this.bound = source; this.revision = revision; this.locale = locale; this.limit = limit;
      this.dirty = false; this.failure = undefined; this.sheetIndex = 0; this.firstRow = 0; this.activeRow = '';
      if (this.searchState.dirty) this.searchState.clear();
      if (source === undefined) {
        if (this.theme) { this.theme.hostDisconnected(); this.host.removeController(this.theme); this.theme = undefined; }
        this.sheets = []; this.sheet = undefined; return;
      }
      this.theme ??= new ThemeWatcher(this.host, () => this.notify());
      let sheets: SourceSheet[];
      if (this.hooks.workbook) {
        const raw = (source as LyraWorkbookSource).sheets;
        if (!Array.isArray(raw) || raw.length > 256) throw new LyraResourceLimitError();
        const keys = new Set<string>(), names = new Set<string>();
        sheets = raw.map(entry => {
          if (!entry || typeof entry.key !== 'string' || !entry.key || typeof entry.name !== 'string' || !entry.name || keys.has(entry.key) || names.has(entry.name)) throw new TypeError('Invalid source sheet');
          if (entry.key.length > 65536 || entry.name.length > 65536) throw new LyraResourceLimitError();
          keys.add(entry.key); names.add(entry.name);
          return Object.freeze({ key: entry.key, name: entry.name, data: entry.data });
        });
      } else sheets = [{ key: '', name: '', data: source as LyraTabularSource }];
      if (!this.current(epoch)) return;
      this.sheets = Object.freeze(sheets);
      this.selectSheet(0);
    } catch (error) {
      if (this.hooks.source() !== source) return;
      this.bound = source; this.locale = locale; this.limit = limit; this.dirty = false;
      this.fail(error);
    }
  }

  private current(epoch: number): boolean { return epoch === this.epoch && this.hooks.source() === this.bound && this.host.isConnected; }
  private fail(error: unknown): void {
    if (this.failure === error) return;
    this.failure = error;
    this.hooks.error(error);
    this.notify();
  }
  private selectSheet(index: number): void {
    this.authority.invalidate('cells0'); this.authority.invalidate('cells1'); this.authority.invalidate('reveal');
    for (const slot of this.slots) slot.settle(false);
    this.slots = []; this.windowColumns = []; this.labels = []; this.labelUnits = 0;
    this.firstRow = 0; this.visibleRows = 0; this.activeRow = ''; this.sheetIndex = index;
    this.sheet = this.sheets[index]; this.paint++;
    if (!this.sheet) { this.rows = this.columns = 0; this.sourceRows = this.makeRows(); return; }
    const data = this.sheet.data;
    const epoch = this.epoch;
    const revision = sourceRevision(data.revision);
    const rows = sourceCount(data.rowCount), columns = sourceCount(data.columnCount);
    if (rows >= Number.MAX_SAFE_INTEGER || columns > this.limit) throw new LyraResourceLimitError();
    if (typeof data.columnAt !== 'function' || (typeof data.cellAt === 'function') === (typeof data.readCells === 'function')) throw new TypeError('Invalid cell source');
    if (!this.current(epoch)) return;
    this.sheetRevision = revision; this.rows = rows; this.columns = columns;
    this.sourceRows = this.makeRows(); this.loaded = true;
    this.host.shadowRoot?.querySelector<LyraVirtualList>(tag('virtual-list'))?.scrollToIndex(0, { align: 'start', behavior: 'auto' });
  }

  private scalar(value: unknown): string {
    if (value !== undefined && value !== null && typeof value !== 'string' && typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value))) throw new TypeError('Invalid source cell');
    const text = this.hooks.format(value as LyraSourceCell);
    if (text.length > 65536) throw new LyraResourceLimitError();
    return text;
  }
  private prepareColumns(columns: readonly number[]): void {
    if (this.windowColumns === columns || !this.sheet) return;
    const epoch = this.epoch, sheet = this.sheet;
    const labels: LyraTabularColumn[] = [];
    let units = 0;
    for (const index of columns) {
      const column = sheet.data.columnAt(index);
      if (!this.current(epoch) || this.sheet !== sheet) return;
      if (!column || typeof column.key !== 'string' || !column.key || typeof column.label !== 'string') throw new TypeError('Invalid source column');
      if (column.key.length > 65536 || column.label.length > 65536) throw new LyraResourceLimitError();
      units += column.key.length + column.label.length;
      if (units > 2000000) throw new LyraResourceLimitError();
      labels.push(Object.freeze({ key: column.key, label: column.label }));
    }
    this.labels = labels; this.labelUnits = units; this.windowColumns = columns; this.columnStart = columns[0] ?? 0;
    this.paint++;
    this.requestWindow();
  }
  private requestWindow(): void {
    if (!this.sheet || !this.loaded || !this.windowColumns.length || !this.rows || this.failure) return;
    const epoch = this.epoch, intent = ++this.windowIntent;
    const maximum = Math.min(500, Math.floor(10000 / this.windowColumns.length));
    const first = Math.min(this.firstRow, this.rows - 1);
    const demand = Math.min(this.rows - first, this.visibleRows + 12);
    const block = Math.min(maximum, Math.max(64, demand));
    if (demand > maximum * 2) { this.fail(new LyraResourceLimitError()); return; }
    const aligned = Math.floor(first / block) * block;
    const row = first - aligned + demand <= block * 2 ? aligned : first;
    const starts = row + block < this.rows ? [row, row + block] : [row];
    const keys = starts.map(start => `${this.sheetIndex}:${start}:${block}:${this.columnStart}:${this.windowColumns.length}`);
    const previous = this.slots;
    this.slots = previous.filter(slot => keys.includes(slot.key));
    for (const slot of previous) if (!this.slots.includes(slot)) {
      slot.settle(false); this.authority.invalidate(slot.channel);
      if (!this.current(epoch) || intent !== this.windowIntent) return;
    }
    for (let index = 0; index < starts.length; index++) {
      if (this.slots.some(slot => slot.key === keys[index])) continue;
      const channel = this.slots.some(slot => slot.channel === 'cells0') ? 'cells1' : 'cells0';
      const lease = this.authority.begin(channel, this.locale);
      if (!lease || !this.current(epoch) || intent !== this.windowIntent) return;
      let settle!: (value: boolean) => void;
      const promise = new Promise<boolean>(resolve => { settle = resolve; });
      const slot: CellRectangle = { key: keys[index]!, channel, row: starts[index]!, rows: Math.min(block, this.rows - starts[index]!), column: this.columnStart,
        columns: this.windowColumns.length, lease, source: this.sheet.data, promise, settle, state: 'queued', units: 0 };
      lease.context.signal.addEventListener('abort', () => slot.settle(false), { once: true });
      this.slots.push(slot);
    }
    this.paint++;
    queueMicrotask(() => this.pump());
  }
  private pump(): void {
    while (this.physicalReads < 2) {
      const slot = this.slots.find(value => value.state === 'queued' && value.lease.isCurrent());
      if (!slot) return;
      slot.state = 'loading'; this.physicalReads++;
      void this.read(slot);
    }
  }
  private async read(slot: CellRectangle): Promise<void> {
    try {
      const source = slot.source;
      const result = source.readCells
        ? await source.readCells(Object.freeze({ ...slot.lease.context, revision: this.sheetRevision!, row: slot.row, rowCount: slot.rows, column: slot.column, columnCount: slot.columns }))
        : undefined;
      if (!slot.lease.isCurrent() || !this.slots.includes(slot)) return;
      if (result !== undefined && (!Array.isArray(result) || result.length !== slot.rows)) throw new TypeError('Invalid source rectangle');
      const values: string[][] = [];
      let units = this.labelUnits + this.slots.reduce((sum, other) => sum + (other === slot ? 0 : other.units), 0);
      const initialUnits = units;
      for (let row = 0; row < slot.rows; row++) {
        const input = result?.[row];
        if (result !== undefined && (!Array.isArray(input) || input.length !== slot.columns)) throw new TypeError('Invalid source rectangle row');
        const cells: string[] = [];
        for (let col = 0; col < slot.columns; col++) {
          const value = result !== undefined ? input![col] : source.cellAt!(slot.row + row, slot.column + col);
          if (!slot.lease.isCurrent() || !this.slots.includes(slot)) return;
          const text = this.scalar(value); units += text.length;
          if (units > 2000000) throw new LyraResourceLimitError();
          cells.push(text);
        }
        values.push(cells);
      }
      slot.values = values; slot.units = units - initialUnits; slot.state = 'ready'; slot.settle(true); this.paint++; this.notify();
    } catch (error) { if (slot.lease.isCurrent() && this.slots.includes(slot)) this.fail(error); slot.settle(false); }
    finally { this.physicalReads--; this.pump(); }
  }

  scrollColumns(target: HTMLElement): void { this.chrome.scrollColumns(this, target); }

  private onRange = (event: CustomEvent<LyraVirtualListRange>): void => {
    event.stopPropagation();
    if (!this.loaded || (event.currentTarget as LyraVirtualList).source !== this.sourceRows) return;
    const start = Math.min(this.rows, event.detail.start);
    const row = Math.max(0, start - 6);
    const visible = Math.max(0, Math.min(this.rows, event.detail.end) - start);
    if (row === this.firstRow && visible === this.visibleRows) return;
    this.visibleRows = visible; this.firstRow = row; this.requestWindow(); this.notify();
  };
  private row(index: number, style: string, height: number): TemplateResult {
    const slot = this.slots.find(value => index >= value.row && index < value.row + value.rows && value.state === 'ready');
    const rawRow = index + 1 + Number(this.hooks.header());
    const highlights = this.chrome.highlightsForRow(rawRow, this.hooks.workbook ? this.sheet?.name : undefined);
    return html`<div part="data-row" role="presentation" aria-busy=${slot ? 'false' : 'true'} style=${`${style};height:${height}px;overflow:hidden`}>
      ${this.windowColumns.map((column, position) => this.chrome.renderCell(slot?.values?.[index - slot.row]?.[position] ?? '', column, highlights,
        'cell', 'cell', this.hooks.colorVar, this.hooks.activeHighlight()))}
    </div>`;
  }
  render(): TemplateResult {
    if (this.failure) return html`<div part="error">${this.hooks.localize(isResourceLimitError(this.failure) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad')}</div>`;
    if (!this.loaded || !this.sheet || !this.columns) return html`<p class="empty-note">${this.hooks.localize('noData')}</p>`;
    try {
      const epoch = this.epoch;
      const window = this.chrome.columnWindow(this, this.columns, 100);
      this.prepareColumns(window.columns);
      if (!this.current(epoch)) return html``;
      if (this.failure) return html`<div part="error">${this.hooks.localize('documentPreviewFailedToLoad')}</div>`;
      const view = this.host.ownerDocument.defaultView;
      const height = Math.max(1, resolveCssTokenLength(view?.getComputedStyle(this.host).getPropertyValue('--lr-size-3rem').trim() || '3rem', { host: this.host }) ?? 48);
      const header = this.hooks.header();
      const search = this.hooks.workbook ? (this.bound as LyraWorkbookSource).search : this.sheet.data.search;
      return html`
        ${this.hooks.workbook && this.sheets.length > 1 ? this.hooks.renderSheetTabs?.(
          this.sheets.map(sheet => sheet.name), this.sheetIndex, index => {
            if (Number.isInteger(index) && index >= 0 && index < this.sheets.length && index !== this.sheetIndex) {
              try { this.selectSheet(index); this.notify(); } catch (error) { this.fail(error); }
            }
          },
        ) ?? nothing : nothing}
        ${this.busy ? html`<p part="spinner" class="empty-note">${this.hooks.localize('loadingDocument')}</p>` : nothing}
        ${typeof search !== 'function' ? html`<p part="search-status" class="empty-note">${this.hooks.localize('sourceSearchUnavailable')}</p>` : nothing}
        <div part=${this.hooks.headerPart === 'header-cell' ? 'table' : 'sheet'} role="table" aria-label=${this.hooks.workbook ? this.sheet.name : this.hooks.label(this.rows)} aria-rowcount=${this.rows + Number(header)} aria-colcount=${this.columns}
          @scroll=${(event: Event) => { this.chrome.scrollColumns(this, event.currentTarget as HTMLElement); }}>
          ${header ? html`<div part="header-row" role="row" aria-rowindex="1" style=${window.style}>${this.labels.map((column, index) => this.chrome.renderCell(column.label, this.columnStart + index,
            this.chrome.highlightsForRow(1, this.hooks.workbook ? this.sheet?.name : undefined), 'columnheader', this.hooks.headerPart, this.hooks.colorVar, this.hooks.activeHighlight()))}</div>` : nothing}
          <lr-virtual-list part=${this.hooks.headerPart === 'header-cell' ? nothing : 'rows'} exportparts="data-row:data-row, cell:cell, cell-highlight:cell-highlight, cell-highlight-action:cell-highlight-action"
            .source=${this.sourceRows} .rowHeight=${height} .renderItem=${this.chrome.rowRenderer(this, [this.paint, window.columns, height, header, this.hooks.activeHighlight()], (_row, index) => this.row(index, window.style, height))}
            .activeItemId=${this.activeRow} item-role="row" .rowIndexOffset=${Number(header)}
            .scrollElement=${this.hooks.pageScroll?.() ? view ?? undefined : undefined}
            @lr-visible-range-change=${this.onRange} @lr-virtual-scroll=${(event: Event) => event.stopPropagation()} @lr-load-more=${(event: Event) => event.stopPropagation()}
          ></lr-virtual-list>
        </div>`;
    } catch (error) { this.fail(error); return html`<div part="error">${this.hooks.localize(isResourceLimitError(error) ? 'documentPreviewResourceTooLarge' : 'documentPreviewFailedToLoad')}</div>`; }
  }

  async revealAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'cell-range') return false;
    const range = parseCellRange(anchor.range);
    if (!range) return false;
    const name = anchor.sheet ?? range.sheet;
    if (!this.hooks.workbook && name) return false;
    const index = name ? this.sheets.findIndex(sheet => sheet.name === name) : this.sheetIndex;
    return this.reveal(index, range.startRow - Number(this.hooks.header()), range.startCol);
  }
  private async reveal(sheetIndex: number, row: number, column: number): Promise<boolean> {
    if (this.failure || sheetIndex < 0 || sheetIndex >= this.sheets.length) return false;
    if (sheetIndex !== this.sheetIndex) { try { this.selectSheet(sheetIndex); this.notify(); } catch (error) { this.fail(error); return false; } }
    if (!Number.isSafeInteger(row) || row < (this.hooks.header() ? -1 : 0) || row >= this.rows || !Number.isSafeInteger(column) || column < 0 || column >= this.columns) return false;
    const lease = this.authority.begin('reveal', this.locale);
    if (!lease) return false;
    await this.host.updateComplete;
    if (!lease.isCurrent()) return false;
    await this.chrome.showColumn(this, column, this.hooks.scrollContainer?.() ?? this.host.shadowRoot?.querySelector('[part="sheet"]') ?? null);
    if (!lease.isCurrent()) return false;
    if (row < 0) return this.chrome.revealCell(this.host.shadowRoot?.querySelector(`[part="header-row"] [aria-colindex="${column + 1}"]`) as HTMLElement | undefined);
    this.firstRow = row; this.activeRow = row; this.requestWindow(); this.notify();
    await this.host.updateComplete;
    if (!lease.isCurrent()) return false;
    const list = this.host.shadowRoot?.querySelector<LyraVirtualList>(tag('virtual-list'));
    if (!list) return false;
    list.scrollToIndex(row, { align: 'start', behavior: 'auto' });
    await list.updateComplete;
    if (!lease.isCurrent()) return false;
    const slot = this.slots.find(value => row >= value.row && row < value.row + value.rows && column >= value.column && column < value.column + value.columns);
    if (!slot || !(await slot.promise) || !lease.isCurrent()) return false;
    await this.host.updateComplete; await list.updateComplete;
    if (!lease.isCurrent()) return false;
    const target = list.shadowRoot?.querySelector(`[data-row-index="${row}"] [aria-colindex="${column + 1}"]`) as HTMLElement | undefined;
    return this.chrome.revealCell(target) && lease.isCurrent();
  }

  async search(query: string): Promise<number> {
    this.hooks.cancelAnchor();
    this.authority.invalidate('search'); this.authority.invalidate('reveal');
    this.searchState.query = query;
    const bounded = boundedViewerSearchQuery(query, this.locale);
    if (!bounded.needle || !bounded.accepted) { this.searchState.publish([], bounded.accepted); return 0; }
    const source = this.bound;
    const search = this.hooks.workbook ? (source as LyraWorkbookSource | undefined)?.search : this.sheet?.data.search;
    if (!source || !search || this.failure) { this.searchState.publish([], false); return 0; }
    const lease = this.authority.begin('search', this.locale);
    if (!lease) return 0;
    return new Promise<number>(resolve => {
      lease.context.signal.addEventListener('abort', () => resolve(0), { once: true });
      const run = async (): Promise<void> => {
        if (!lease.isCurrent()) { resolve(0); return; }
        this.searchRunning = true;
        try {
          const result = await (search as (request: object) => Promise<LyraSourceSearchResult<LyraTabularHit | LyraWorkbookHit>>).call(source, Object.freeze({ ...lease.context, query, limit: MAX_TABLE_SEARCH_MATCHES }));
          if (!lease.isCurrent()) return;
          if (!result || !Array.isArray(result.hits) || result.hits.length > MAX_TABLE_SEARCH_MATCHES || typeof result.exhaustive !== 'boolean' || (result.total !== null && sourceCount(result.total) < result.hits.length)) throw new TypeError('Invalid source search result');
          if (result.exhaustive && result.total !== null && result.total !== result.hits.length) throw new TypeError('Inconsistent source search total');
          let exact = result.exhaustive;
          const hits: Array<{ sheetIndex: number; row: number; col: number }> = [];
          for (const hit of result.hits) {
            const index = this.hooks.workbook ? this.sheets.findIndex(sheet => sheet.key === (hit as LyraWorkbookHit).sheetKey) : 0;
            if (index < 0 || !Number.isSafeInteger(hit.row) || hit.row < -1 || !Number.isSafeInteger(hit.column) || hit.column < 0) throw new TypeError('Invalid source search hit');
            const data = this.sheets[index]!.data;
            if (hit.row >= sourceCount(data.rowCount) || hit.column >= sourceCount(data.columnCount) || hit.column >= this.limit) throw new TypeError('Source search hit is out of bounds');
            if (!lease.isCurrent()) return;
            if (hit.row === -1 && !this.hooks.header()) { exact = false; continue; }
            hits.push({ sheetIndex: index, row: hit.row, col: hit.column });
          }
          if (!lease.isCurrent()) return;
          this.searchState.publish(hits, exact);
          if (hits.length) await this.reveal(hits[0]!.sheetIndex, hits[0]!.row, hits[0]!.col);
          if (lease.isCurrent()) resolve(hits.length);
        } catch (error) { if (lease.isCurrent()) { this.fail(error); this.searchState.publish([], false); resolve(0); } }
        finally { this.searchRunning = false; const next = this.queuedSearch; this.queuedSearch = undefined; if (next) void next(); }
      };
      if (this.searchRunning) this.queuedSearch = run; else void run();
    });
  }
  async step(direction: 1 | -1): Promise<boolean> {
    if (!this.searchState.step(direction)) return false;
    const hit = this.searchState.matches[this.searchState.activeIndex]!;
    return this.reveal(hit.sheetIndex, hit.row, hit.col);
  }
  clearSearch(): void {
    this.hooks.cancelAnchor(); this.authority.invalidate('search'); this.authority.invalidate('reveal');
    this.activeRow = ''; this.searchState.clear(); this.notify();
  }
}
