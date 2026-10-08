import { html, type PropertyValues, type ReactiveControllerHost, type TemplateResult } from 'lit';
import { parseCellRange, type ParsedCellRange } from '../../internal/cell-range.js';
import { prioritizedHighlightCandidates } from '../../internal/anchor-target.js';
import { prefersReducedMotion } from '../../internal/motion.js';
import { OwnerAnimationFrameWaiter } from '../../internal/owner-animation-frame.js';
import type { LyraSearchChangeDetail } from '../../internal/text-viewer-target.js';
import { ViewerSearchState } from '../../internal/viewer-search.js';
import { DeferredTeardown } from './document-viewer/deferred-teardown.js';
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
  return highlights.filter((entry) =>
    (sheet === undefined || entry.sheet === undefined || entry.sheet === sheet)
    && rawRow - 1 >= entry.parsed.startRow
    && rawRow - 1 <= entry.parsed.endRow);
}

export function tableHighlightsForColumn<T extends CellHighlightRange>(highlights: readonly T[], col: number): T[] {
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
    this.reveal(row?.querySelectorAll('[part~="cell"]')[col] as HTMLElement | undefined);
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
  private lastLocale = '';
  private pendingResetEvent = false;
  private readonly detached: DeferredTeardown;

  constructor(private readonly host: TableViewerHost, private readonly hooks: TableViewerHooks<M>) {
    this.search = new ViewerSearchState<M[]>(() => [], (detail) => hooks.emitSearch(detail), () => host.requestUpdate());
    this.announcements = new ViewerAnnouncementController(host);
    this.scroll = new TableViewerScrollController(host);
    // A same-task DOM move keeps the loaded table; a genuine disconnect cancels pending work.
    this.detached = new DeferredTeardown(() => { hooks.teardown(); this.scroll.cancel(); });
  }

  /** After `super.connectedCallback()`. */
  connected(): void {
    this.announcements.connect();
    if (this.detached.cancel()) return;
    if (this.host.hasUpdated && this.host.src && this.host.src === this.lastLoadSrc) {
      this.hooks.schedule(() => { void this.hooks.load(); });
    }
  }

  /** Before `super.disconnectedCallback()`. */
  disconnecting(): void {
    this.announcements.disconnect();
  }

  /** After `super.disconnectedCallback()`. */
  disconnected(): void {
    this.detached.schedule();
  }

  /** After `super.adoptedCallback()`. */
  adopted(): void {
    this.detached.flush();
    this.scroll.cancel();
    this.announcements.adopted();
  }

  /** After `super.willUpdate()`; `sheets` keeps sheet-qualified highlights for a multi-sheet viewer. */
  willUpdate(changed: PropertyValues, highlights: readonly LyraHighlight[], activeHighlightId: string | null, sheets: boolean): void {
    if (changed.has('src')) {
      this.pendingResetEvent ||= this.search.dirty;
      this.search.reset();
      this.activeRowKey = '';
    }
    if (changed.has('highlights') || changed.has('activeHighlightId')) {
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
    if (changed.has('src')) this.hooks.schedule(() => { void this.hooks.load(); });
    if (changed.has('src') && this.pendingResetEvent) {
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
    this.host.requestUpdate();
  }

  /** `rawRow` is 1-based, including the header row -- the addressing every `cell-range` anchor uses. */
  highlightsForRow(rawRow: number, sheet?: string): ResolvedCellHighlight[] {
    return tableHighlightsForRow(this.highlights, rawRow, sheet);
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
    const colHighlights = tableHighlightsForColumn(rowHighlights, colIndex);
    if (!colHighlights.length) return html`<div part=${part} role=${role}>${text}</div>`;
    const active = colHighlights.find((entry) => entry.highlight.id === activeHighlightId);
    const primary = active ?? colHighlights[0]!;
    const accessibleLabel = primary.highlight.label
      ? this.hooks.localize('cellHighlightWithLabel', undefined, { value: text, label: primary.highlight.label })
      : this.hooks.localize('highlightWithLabel', undefined, { label: text });
    // The outer cell keeps its table role; the nested native button carries activation.
    return html`<div
      part="${part} cell-highlight"
      role=${role}
      ?data-active=${!!active}
      style=${active ? `${colorVar}: var(--lr-color-warning, var(--lr-color-brand))` : ''}
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
  ): Promise<number> {
    this.search.query = query;
    const locale = this.hooks.locale();
    this.lastLocale = locale;
    const { matches, exact } = collectTableSearchMatches<M>(query, locale, loaded, scan);
    this.search.publish(matches, exact);
    if (matches.length > 0) await this.hooks.jump(matches[0]!);
    return matches.length;
  }

  async step(direction: 1 | -1): Promise<boolean> {
    if (!this.search.step(direction)) return false;
    await this.hooks.jump(this.search.matches[this.search.activeIndex]!);
    return true;
  }

  clearSearch(): void {
    this.activeRowKey = '';
    this.search.clear();
  }
}
