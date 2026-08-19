import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseText,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { loadPapaParseCached } from '../../../internal/papaparse-loader.js';
import {
  parseCellRange,
  type ParsedCellRange,
} from '../../../internal/cell-range.js';
import {
  DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import type {
  LyraAnchor,
  LyraAnchorKind,
  LyraHighlight,
} from '../document-viewer/anchors.js';
import { styles } from './dataset-viewer.styles.js';
import { parseDelimitedRecords } from '../../../internal/delimited-data.js';
import { LatestTask } from '../../../internal/latest-task.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import { ViewerAnnouncementController } from '../viewer-announcements.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import {
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import {
  boundedViewerSearchQuery,
  ViewerSearchWorkBudget,
} from '../viewer-search-limits.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_datasetViewerCaption, LYRA_DEFAULT_datasetViewerCaptionNamed, LYRA_DEFAULT_datasetViewerEmpty, LYRA_DEFAULT_datasetViewerMissingParser, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDataset, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loadingDocument } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface DatasetTable {
  fields: string[];
  rows: Record<string, string>[];
}
interface DatasetParseResult {
  table: DatasetTable | null;
  errors: unknown[];
}
type DatasetFetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; table: DatasetTable }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };
type OwnedAnimationFrameWait = {
  owner: Window;
  handle?: number;
  resolve: (isCurrent: boolean) => void;
};
const MAX_SEARCH_MATCHES = 1_000;

export interface LyraDatasetViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
}

/** One `highlights` entry resolved against the parsed grid, alongside its parsed `cell-range`. */
interface ResolvedCellHighlight {
  highlight: LyraHighlight;
  parsed: ParsedCellRange;
}

class LyraDatasetViewerBase extends LyraElement<LyraDatasetViewerEventMap> {}

/**
 * Fetches delimited text and renders a virtualized, accessible data table: a `role="table"`
 * container with a sticky `role="row"` header, composed with `<lr-virtual-list item-role="row">`
 * for the body so files far larger than a real synchronous `<table>` can render without locking the
 * main thread.
 *
 * Adopts `DocumentAnchorTarget`: a `cell-range` anchor addresses the raw file grid, 1-based, with
 * the header row always occupying row 1 (this component always parses with PapaParse's `header:
 * true`, so the first row is never part of the virtualized body) -- `scrollToAnchor()` scrolls the
 * addressed row into view via the virtualized list's `active-item-id`. A `sheet`-qualified anchor never
 * resolves here -- this viewer has no sheets. `highlights` paint as a `part="cell-highlight"` cell
 * wrapping a focusable `part="cell-highlight-action"` native button (keeping the ARIA table tree
 * intact) on membership, recomputed per row inside `renderRow()` so a row scrolled out and back
 * in reconstructs its highlight for free, with no persistent DOM to keep in sync. `search()` is a
 * locale-aware case-insensitive substring match over the header followed by every body cell's raw
 * string value, ordered row then column.
 *
 * A quote-aware structural scan enforces the 10,000-data-row, 1,000-field, 1,000,000-cell, and
 * 100-diagnostic ceilings before PapaParse can materialize an amplified result. The peer then runs
 * with streaming record callbacks and the same limits as a second boundary.
 *
 * @customElement lr-dataset-viewer
 * @event lr-render-error - Fired when fetching or parsing fails, the resource guard rejects the
 *   table, or PapaParse returns up to the bounded diagnostic ceiling alongside a recoverable
 *   partial table.
 * @event lr-highlight-activate - A `highlights` cell was clicked, or activated via Enter/Space
 *   while focused. `detail: { highlightId }`.
 * @event lr-anchor-result - Fired after an `anchor` property assignment or a `scrollToAnchor()`
 *   call is applied. `detail: { found }`.
 * @event lr-search-change - Fired whenever the search query, match count, or active match index
 *   changes, including source-reset and effective-locale re-evaluation. `detail: { query,
 *   matchCount, matchCountExact, activeIndex }`. Search accepts at most 4,096 query code units,
 *   scans at most 4,000,000 cell code units, and retains at most 1,000 matches;
 *   `matchCountExact=false` identifies a ceiling-truncated lower bound.
 * @csspart base - The stable root wrapper with explicit `aria-busy` across every fetch state. `name` supplies its shadow
 *   region name; a non-empty host `aria-label` instead leaves ownership on the host, while an
 *   explicitly empty label remains explicit on this shadow owner. With neither source it stays a
 *   plain wrapper rather than an unnamed region.
 * @csspart body - The scrollable body wrapper.
 * @csspart table - The `role="table"` container, named by the display name plus localized row
 *   count or by the localized row count alone; it never copies the host's overall name.
 * @csspart header-row - The sticky header row (`role="row"`).
 * @csspart header-cell - A header cell (`role="columnheader"`).
 * @csspart data-row - One virtualized data row.
 * @csspart cell - One rendered cell (`role="cell"`).
 * @csspart cell-highlight - A cell (`role="cell"`) covered by a `highlights` entry; wraps the
 *   `cell-highlight-action` button.
 * @csspart cell-highlight-action - The native button filling a highlighted cell -- focusable,
 *   emits `lr-highlight-activate` on click or Enter/Space. Its accessible name localizes the
 *   complete cell-value and annotation message through separate `{value}` and `{label}`
 *   placeholders.
 * @csspart spinner - The visible tokenized loading treatment and ordinary text label.
 * @csspart error - The error message region.
 * @cssprop [--lr-dataset-viewer-max-height=none] - Maximum block size of `[part="body"]` before it
 *   scrolls internally. The `maxHeight` property sets this token inline on `[part="base"]`.
 * @cssprop [--lr-dataset-viewer-highlight-color=var(--lr-color-brand)] - Outline color of a
 *   highlighted cell. The active highlight changes a private warning-color default; an inherited
 *   or direct public value remains authoritative.
 * @status stable
 * @since 4.0.0
 */
export class LyraDatasetViewer extends DocumentAnchorTarget(
  LyraDatasetViewerBase
) {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    anchorJumped: LYRA_DEFAULT_anchorJumped,
    anchorJumpedToPage: LYRA_DEFAULT_anchorJumpedToPage,
    anchorNotFound: LYRA_DEFAULT_anchorNotFound,
    cellHighlightWithLabel: LYRA_DEFAULT_cellHighlightWithLabel,
    datasetViewerCaption: LYRA_DEFAULT_datasetViewerCaption,
    datasetViewerCaptionNamed: LYRA_DEFAULT_datasetViewerCaptionNamed,
    datasetViewerEmpty: LYRA_DEFAULT_datasetViewerEmpty,
    datasetViewerMissingParser: LYRA_DEFAULT_datasetViewerMissingParser,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDataset: LYRA_DEFAULT_documentPreviewTypeDataset,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [
    LyraElement.styles,
    styles,
    srOnly,
    viewerLoadingStyles,
  ];
  /** URL to fetch and parse as delimited text. */
  @property() src = '';
  /** Display name used for the table's row-count caption and for `[part="base"]` when host
   *  `aria-label` is absent. A non-empty host label remains on the host; an explicitly empty one
   *  stays explicit on the shadow owner. */
  @property() name = '';
  /** CSS length that caps the scrollable body. */
  /** A CSS `max-height`; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: DatasetFetchState = { kind: 'idle' };
  /** The virtualized body row currently scrolled into view via `scrollToAnchor()` or search
   *  navigation -- bound to `<lr-virtual-list>`'s own `active-item-id`. */
  @state() private activeRowKey: number | '' = '';
  @state() private searchMatches: { row: number; col: number }[] = [];
  private searchMatchCountExact = true;
  @state() private searchActiveIndex = -1;
  private searchQuery = '';
  private lastSearchLocale = '';
  private pendingSearchResetEvent = false;
  private loadTask = new LatestTask();
  private lastLoadSrc = '';
  private readonly announcements = new ViewerAnnouncementController(this);
  private readonly pendingAnimationFrames = new Set<OwnedAnimationFrameWait>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.announcements.connect();
    if (this.hasUpdated && this.src && this.src === this.lastLoadSrc) {
      this.scheduleAfterUpdate(() => {
        void this.load();
      });
    }
  }

  override disconnectedCallback(): void {
    this.loadTask.next();
    this.cancelPendingAnimationFrames();
    this.announcements.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.cancelPendingAnimationFrames();
    this.announcements.adopted();
  }

  private waitForOwnerAnimationFrame(): Promise<boolean> {
    const owner = this.ownerDocument.defaultView;
    if (!owner || !this.isConnected) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const pending: OwnedAnimationFrameWait = { owner, resolve };
      this.pendingAnimationFrames.add(pending);
      pending.handle = owner.requestAnimationFrame(() => {
        if (!this.pendingAnimationFrames.delete(pending)) return;
        resolve(this.isConnected && this.ownerDocument.defaultView === owner);
      });
    });
  }

  private cancelPendingAnimationFrames(): void {
    const pendingFrames = [...this.pendingAnimationFrames];
    this.pendingAnimationFrames.clear();
    for (const pending of pendingFrames) {
      if (pending.handle !== undefined)
        pending.owner.cancelAnimationFrame(pending.handle);
      pending.resolve(false);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    if (changed.has('src')) {
      this.pendingSearchResetEvent ||= this.searchQuery !== ''
        || this.searchMatches.length > 0
        || !this.searchMatchCountExact
        || this.searchActiveIndex !== -1;
      this.searchQuery = '';
      this.searchMatches = [];
      this.searchMatchCountExact = true;
      this.searchActiveIndex = -1;
      this.activeRowKey = '';
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.announcements.transition(
      'load',
      this.fetchState.kind,
      this.fetchState.kind === 'error'
        ? this.fetchState.message
        : this.localize('loadingDocument')
    );
    if (changed.has('src'))
      this.scheduleAfterUpdate(() => {
        void this.load();
      });
    if (changed.has('src') && this.pendingSearchResetEvent) {
      this.pendingSearchResetEvent = false;
      this.emitSearchChange();
    }
    const locale = this.effectiveLocale;
    if (locale !== this.lastSearchLocale) {
      const shouldRecompute = !!this.searchQuery;
      this.lastSearchLocale = locale;
      if (shouldRecompute)
        this.scheduleAfterUpdate(() => {
          void this.search(this.searchQuery);
        }, 'search');
    }
  }

  private async load(): Promise<void> {
    this.lastLoadSrc = this.src;
    const generation = this.loadTask.next();
    const signal = this.beginAbortableLoad();
    if (!this.src) {
      this.fetchState = { kind: 'idle' };
      return;
    }
    const fetchTarget = resolveOwnerFetchTarget(this, this.src);
    if (!fetchTarget) {
      const error = new LyraUserFacingError(
        this.localize('documentPreviewUrlNotAllowed')
      );
      this.fetchState = { kind: 'error', message: error.message };
      this.emit('lr-render-error', { error });
      return;
    }
    this.fetchState = { kind: 'loading' };
    try {
      const response = await fetchTarget.view.fetch(
        fetchTarget.url,
        signal ? { signal } : undefined
      );
      if (!response.ok)
        throw new Error(`${response.status} ${response.statusText}`);
      const source = await readResponseText(response);
      if (!this.isConnected || !this.loadTask.isCurrent(generation)) return;
      const parsed = await this.parse(source, generation);
      if (parsed === undefined) return;
      if (this.isConnected && this.loadTask.isCurrent(generation)) {
        const { table } = parsed;
        this.fetchState = table ? { kind: 'loaded', table } : { kind: 'empty' };
        if (table && this.searchQuery) await this.search(this.searchQuery);
        if (
          parsed.errors.length &&
          this.isConnected &&
          this.loadTask.isCurrent(generation)
        ) {
          this.emit('lr-render-error', { error: parsed.errors });
        }
      }
    } catch (error) {
      if (
        isAbortError(error) ||
        !this.isConnected ||
        !this.loadTask.isCurrent(generation)
      )
        return;
      this.fetchState = {
        kind: 'error',
        message:
          error instanceof LyraUserFacingError
            ? error.message
            : this.localize(
                isResourceLimitError(error)
                  ? 'documentPreviewResourceTooLarge'
                  : 'documentPreviewFailedToLoad'
              ),
      };
      this.emit('lr-render-error', { error });
    }
  }

  /** Resolves `null` (not a thrown error) for a well-formed file that parses to zero fields/rows --
   *  that is a distinct, non-error "empty" state, not the same failure as a missing parser library
   *  or an oversized file, and must not be funneled into the same error chrome/assertive announcement as those
   *  genuine failures (matching `<lr-calendar-viewer>`'s identical zero-events handling). */
  private async parse(
    text: string,
    generation: number
  ): Promise<DatasetParseResult | undefined> {
    const papa = await loadPapaParseCached();
    if (!this.isConnected || !this.loadTask.isCurrent(generation))
      return undefined;
    if (!papa)
      throw new LyraUserFacingError(
        this.localize('datasetViewerMissingParser')
      );
    const result = parseDelimitedRecords(papa, text);
    if (!result.fields.length || !result.rows.length) {
      return { table: null, errors: result.errors };
    }
    return {
      table: { fields: result.fields, rows: result.rows },
      errors: result.errors,
    };
  }

  // -- cell highlights -----------------------------------------------------------------------------

  /** `rawRow` is 1-based, always including the header row -- the same raw-file-grid addressing
   *  convention every `cell-range` anchor uses. */
  private cellHighlightsForRow(rawRow: number): ResolvedCellHighlight[] {
    const seen = new Set<string>();
    return this.highlights
      .filter((highlight) => {
        if (seen.has(highlight.id)) return false;
        seen.add(highlight.id);
        return true;
      })
      .flatMap((highlight) => {
        if (highlight.anchor.kind !== 'cell-range' || highlight.anchor.sheet)
          return []; // dataset-viewer has no sheets
        const parsed = parseCellRange(highlight.anchor.range);
        if (!parsed) return [];
        return rawRow - 1 >= parsed.startRow && rawRow - 1 <= parsed.endRow
          ? [{ highlight, parsed }]
          : [];
      });
  }

  private renderCell(
    value: string,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    role: 'cell' | 'columnheader' = 'cell'
  ): TemplateResult {
    const colHighlights = rowHighlights.filter(
      (entry) =>
        colIndex >= entry.parsed.startCol && colIndex <= entry.parsed.endCol
    );
    const part = role === 'columnheader' ? 'header-cell' : 'cell';
    if (!colHighlights.length)
      return html`<div part=${part} role=${role}>${value}</div>`;
    const active = colHighlights.find(
      (entry) => entry.highlight.id === this.activeHighlightId
    );
    const primary = active ?? colHighlights[0]!;
    const accessibleLabel = primary.highlight.label
      ? this.localize('cellHighlightWithLabel', undefined, {
          value,
          label: primary.highlight.label,
        })
      : this.localize('highlightWithLabel', undefined, { label: value });
    const activate = (): void => {
      this.emit('lr-highlight-activate', { highlightId: primary.highlight.id });
    };
    // The outer element must stay a plain `role="cell"` so the ARIA table tree (table > row >
    // cell) remains valid; the activation affordance is a nested native <button>, which carries
    // the button role plus Enter/Space activation on its own, without disturbing that structure.
    return html`<div
      part="${part} cell-highlight"
      role=${role}
      ?data-active=${!!active}
      style=${active
        ? '--_lr-dataset-viewer-highlight-color: var(--lr-color-warning, var(--lr-color-brand))'
        : ''}
    >
      <button
        part="cell-highlight-action"
        type="button"
        aria-label=${accessibleLabel}
        @click=${activate}
      >
        ${value}
      </button>
    </div>`;
  }

  private renderRow = (
    row: Record<string, string>,
    index: number,
    fields: string[]
  ): TemplateResult => {
    const rawRow = index + 2; // +1 for the always-present header row, +1 to become 1-based
    const rowHighlights = this.cellHighlightsForRow(rawRow);
    return html`<div part="data-row" role="presentation">
      ${fields.map((field, col) =>
        this.renderCell(row[field] ?? '', col, rowHighlights)
      )}
    </div>`;
  };

  // -- anchor resolution ---------------------------------------------------------------------------

  /** Scrolls raw-grid `(rawRow, col)` into view -- shared by `applyAnchor()` and every search
   *  navigation method, so both stay byte-identical in how a coordinate becomes a scroll. */
  private async jumpToCell(rawRow: number, col: number): Promise<boolean> {
    const loadedState = this.fetchState;
    if (loadedState.kind !== 'loaded') return false;
    const { fields, rows } = loadedState.table;
    if (
      rawRow < 1 ||
      rawRow > rows.length + 1 ||
      col < 0 ||
      col >= fields.length
    )
      return false;
    const bodyIndex = rawRow - 2; // -1 raw(1-based) -> 0-based, -1 for the always-present header row
    if (bodyIndex < 0) {
      const target = this.renderRoot
        .querySelector('[part="header-row"]')
        ?.querySelectorAll('[part~="header-cell"]')[col] as
        | HTMLElement
        | undefined;
      target?.scrollIntoView({
        behavior: prefersReducedMotion(this.ownerDocument.defaultView)
          ? 'auto'
          : 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      return !!target;
    }
    this.activeRowKey = bodyIndex;
    await this.updateComplete;
    await this.scrollColumnIntoView(col);
    // `fetchState` is only ever reassigned by load(), so an identity change across the awaits above
    // means a concurrent `src` reassignment replaced the document mid-jump (a citation/file-tab
    // click landing on top of a still-resolving jump). The coordinate this call resolved belongs to
    // the previous document and nothing was scrolled into view for the current one, so report the
    // failure rather than letting the shared retry loop accept a phantom success and fire
    // `lr-anchor-result: { found: true }`.
    return this.fetchState === loadedState;
  }

  private async scrollColumnIntoView(col: number): Promise<void> {
    const list = this.renderRoot.querySelector('lr-virtual-list') as
      | (HTMLElement & { updateComplete?: Promise<unknown> })
      | null;
    if (list?.updateComplete) await list.updateComplete;
    if (!(await this.waitForOwnerAnimationFrame())) return;
    const row = list?.shadowRoot?.querySelector(
      '[part="row"][aria-current="true"]'
    );
    const target = row?.querySelectorAll('[part~="cell"]')[col] as
      | HTMLElement
      | undefined;
    target?.scrollIntoView({
      behavior: prefersReducedMotion(this.ownerDocument.defaultView)
        ? 'auto'
        : 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }

  protected async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
    if (anchor.kind !== 'cell-range' || anchor.sheet) return false; // dataset-viewer has no sheets
    const parsed = parseCellRange(anchor.range);
    if (!parsed) return false;
    return this.jumpToCell(parsed.startRow + 1, parsed.startCol);
  }

  // -- search ---------------------------------------------------------------------------------------

  /** Locale-aware case-insensitive substring search over the header fields followed by every body
   *  cell's raw string value, ordered row then column. An empty/whitespace-only query behaves like
   *  `clearSearch()` and resolves `0`. Returns at most 1,000 retained matches;
   *  `lr-search-change.detail.matchCountExact=false` identifies that return as a lower bound. */
  async search(query: string): Promise<number> {
    this.searchQuery = query;
    this.lastSearchLocale = this.effectiveLocale;
    const boundedQuery = boundedViewerSearchQuery(query, this.effectiveLocale);
    const trimmed = boundedQuery.needle;
    const matches: { row: number; col: number }[] = [];
    let matchCountExact = boundedQuery.accepted;
    if (boundedQuery.accepted && trimmed && this.fetchState.kind === 'loaded') {
      const budget = new ViewerSearchWorkBudget();
      const { fields, rows } = this.fetchState.table;
      searchCells: {
        for (let c = 0; c < fields.length; c++) {
          if (budget.includes(fields[c]!, trimmed, this.effectiveLocale)) {
            if (matches.length === MAX_SEARCH_MATCHES) {
              matchCountExact = false;
              break searchCells;
            }
            matches.push({ row: 1, col: c });
          }
          if (!budget.complete) {
            matchCountExact = false;
            break searchCells;
          }
        }
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r]!;
          for (let c = 0; c < fields.length; c++) {
            if (
              budget.includes(
                row[fields[c]!] ?? '',
                trimmed,
                this.effectiveLocale
              )
            ) {
              if (matches.length === MAX_SEARCH_MATCHES) {
                matchCountExact = false;
                break searchCells;
              }
              matches.push({ row: r + 2, col: c });
            }
            if (!budget.complete) {
              matchCountExact = false;
              break searchCells;
            }
          }
        }
      }
    }
    this.searchMatches = matches;
    this.searchMatchCountExact = matchCountExact;
    this.searchActiveIndex = matches.length > 0 ? 0 : -1;
    this.emitSearchChange();
    if (this.searchActiveIndex >= 0)
      await this.jumpToCell(matches[0]!.row, matches[0]!.col);
    return matches.length;
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex =
      (this.searchActiveIndex + 1) % this.searchMatches.length;
    this.emitSearchChange();
    await this.jumpToCell(
      this.searchMatches[this.searchActiveIndex]!.row,
      this.searchMatches[this.searchActiveIndex]!.col
    );
    return true;
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    if (!this.searchMatches.length) return false;
    this.searchActiveIndex =
      (this.searchActiveIndex - 1 + this.searchMatches.length) %
      this.searchMatches.length;
    this.emitSearchChange();
    await this.jumpToCell(
      this.searchMatches[this.searchActiveIndex]!.row,
      this.searchMatches[this.searchActiveIndex]!.col
    );
    return true;
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.searchQuery = '';
    this.searchMatches = [];
    this.searchMatchCountExact = true;
    this.searchActiveIndex = -1;
    this.emit('lr-search-change', {
      query: '',
      matchCount: 0,
      matchCountExact: true,
      activeIndex: -1,
    });
  }

  private emitSearchChange(): void {
    this.emit('lr-search-change', {
      query: this.searchQuery,
      matchCount: this.searchMatches.length,
      matchCountExact: this.searchMatchCountExact,
      activeIndex: this.searchActiveIndex,
    });
  }

  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private renderBody(): TemplateResult {
    switch (this.fetchState.kind) {
      case 'loaded': {
        const { fields, rows } = this.fetchState.table;
        const localizedCount = getNumberFormat(this.effectiveLocale).format(
          rows.length
        );
        const label = this.name
          ? this.localize('datasetViewerCaptionNamed', undefined, {
              name: this.name,
              count: localizedCount,
            })
          : this.localize('datasetViewerCaption', undefined, {
              count: localizedCount,
            });
        const headerHighlights = this.cellHighlightsForRow(1);
        return html`
          <div
            part="table"
            role="table"
            aria-label=${label}
            aria-rowcount=${rows.length + 1}
            aria-colcount=${fields.length}
          >
            <div part="header-row" role="row" aria-rowindex="1">
              ${fields.map((field, col) =>
                this.renderCell(field, col, headerHighlights, 'columnheader')
              )}
            </div>
            <lr-virtual-list
              exportparts="data-row:data-row, cell:cell, cell-highlight:cell-highlight, cell-highlight-action:cell-highlight-action"
              .items=${rows}
              .renderItem=${(row: unknown, index: number) =>
                this.renderRow(row as Record<string, string>, index, fields)}
              .keyFunction=${(_item: unknown, index: number) => index}
              .activeItemId=${this.activeRowKey}
              item-role="row"
              row-index-offset="1"
              @lr-load-more=${this.stopInternalEvent}
              @lr-visible-range-change=${this.stopInternalEvent}
              @lr-virtual-scroll=${this.stopInternalEvent}
            ></lr-virtual-list>
          </div>
        `;
      }
      case 'loading':
        return renderViewerLoading(this.localize('loadingDocument'));
      case 'empty':
        return html`<p class="empty-note">${this.localize(
          'datasetViewerEmpty'
        )}</p>`;
      case 'error':
        return html`<div part="error">${this.fetchState.message}</div>`;
      case 'idle':
      default:
        return html`<p class="empty-note">${this.localize(
          'documentPreviewEmpty',
          undefined,
          { type: this.localize('documentPreviewTypeDataset') }
        )}</p>`;
    }
  }

  override render(): TemplateResult {
    const maxHeight = sanitizeCssLength(this.maxHeight);
    // `name` names the dataset region in EVERY fetch state, not just
    // once a table exists -- otherwise a landmark-navigating screen-reader user finds nothing at
    // all while the viewer is idle, loading, empty, or in error, which is every state except a
    // successful non-empty load. The richer row-count caption stays on the inner [part='table'].
    // A non-empty host name owns the overall semantics and is never copied to either shadow owner;
    // with neither name source there is no unnamed region (mirroring <lr-archive-viewer>).
    const label = viewerSemanticLabel(this, this.name || null);
    const role = label === null ? null : viewerSemanticRole(this, 'region');
    const style = maxHeight
      ? styleMap({ '--lr-dataset-viewer-max-height': maxHeight })
      : nothing;
    return html`<div
      part="base"
      role=${role ?? nothing}
      aria-label=${label ?? nothing}
      aria-busy=${this.fetchState.kind === 'loading' ? 'true' : 'false'}
      style=${style}
    >
      <div part="body">${this.renderBody()}</div>
      ${this.renderAnchorLiveRegion()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dataset-viewer': LyraDatasetViewer;
  }
}
