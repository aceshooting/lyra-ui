import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import {
  isAbortError,
  isResourceLimitError,
  LyraUserFacingError,
  readResponseText,
  resolveOwnerFetchTarget,
} from '../../../internal/resource-loader.js';
import { srOnly } from '../../../internal/a11y.js';
import { loadPapaParseCached } from '../../../internal/papaparse-loader.js';
import { parseCellRange } from '../../../internal/cell-range.js';
import {
  DocumentAnchorTarget,
  type LyraAnchorTargetEventMap,
} from '../../../internal/anchor-target.js';
import type { LyraAnchor, LyraAnchorKind } from '../document-viewer/anchors.js';
import { styles } from './dataset-viewer.styles.js';
import { parseDelimitedRecords } from '../../../internal/delimited-data.js';
import { LatestTask } from '../../../internal/latest-task.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { TableViewerController, type ResolvedCellHighlight } from '../table-viewer-shared.js';
import { sanitizeCssLength } from '../../../internal/safe-css.js';
import type { LyraViewerDiagnosticEventDetail } from '../viewer-diagnostics.js';
export type {
  LyraViewerDiagnostic,
  LyraViewerDiagnosticCode,
  LyraViewerDiagnosticEventDetail,
  LyraViewerDiagnosticSeverity,
} from '../viewer-diagnostics.js';
import { renderViewerLoading, viewerLoadingStyles } from '../viewer-loading.js';
import {
  viewerSemanticLabel,
  viewerSemanticRole,
} from '../viewer-semantic-owner.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';
import { literalSetConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_anchorJumped, LYRA_DEFAULT_anchorJumpedToPage, LYRA_DEFAULT_anchorNotFound, LYRA_DEFAULT_cellHighlightWithLabel, LYRA_DEFAULT_collapse, LYRA_DEFAULT_copy, LYRA_DEFAULT_datasetViewerCaption, LYRA_DEFAULT_datasetViewerCaptionNamed, LYRA_DEFAULT_datasetViewerEmpty, LYRA_DEFAULT_datasetViewerMissingParser, LYRA_DEFAULT_details, LYRA_DEFAULT_documentPreviewEmpty, LYRA_DEFAULT_documentPreviewFailedToLoad, LYRA_DEFAULT_documentPreviewResourceTooLarge, LYRA_DEFAULT_documentPreviewTypeDataset, LYRA_DEFAULT_documentPreviewUrlNotAllowed, LYRA_DEFAULT_highlightWithLabel, LYRA_DEFAULT_loading, LYRA_DEFAULT_loadingDocument, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_viewerSearchActiveMatch, LYRA_DEFAULT_viewerSearchMatchCount, LYRA_DEFAULT_viewerSearchNoMatches } from '../../../internal/default-strings.generated.js';
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

/** Which element scrolls when `<lr-dataset-viewer>` overflows. */
export type DatasetViewerScrollMode = 'self' | 'page';

const DATASET_VIEWER_SCROLL_MODE = literalSetConverter<DatasetViewerScrollMode>(
  ['self', 'page'],
  'self'
);

export interface LyraDatasetViewerEventMap
  extends Omit<LyraAnchorTargetEventMap, 'lr-text-select'> {
  'lr-render-error': CustomEvent<{ error: unknown }>;
  'lr-viewer-diagnostic': CustomEvent<LyraViewerDiagnosticEventDetail>;
  /** Fired whenever the search query, match count, or active match index changes, from
   *  `search()`/`searchNext()`/`searchPrevious()`/`clearSearch()`. */
  'lr-search-change': CustomEvent<LyraSearchChangeDetail>;
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
 * @event lr-render-error - Fired when fetching or parsing fails, or the resource guard rejects the
 *   table.
 * @event lr-viewer-diagnostic - Structured, non-fatal PapaParse diagnostics when a recoverable
 *   partial table remains rendered. `detail.diagnostic.cause` contains the bounded diagnostic array.
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
 *   `scrollMode='page'` deliberately ignores the cap and hands both axes to page flow so the
 *   sticky header can use the page scrollport.
 * @cssprop [--lr-dataset-viewer-highlight-color=var(--lr-color-brand)] - Outline color of a
 *   highlighted cell. The active highlight changes a private warning-color default; an inherited
 *   or direct public value remains authoritative.
 * @cssprop [--lr-dataset-viewer-header-row-bg=var(--lr-color-brand-quiet)] - Background of
 *   `[part="header-row"]`, independent of the highlight outline above.
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
    collapse: LYRA_DEFAULT_collapse,
    copy: LYRA_DEFAULT_copy,
    datasetViewerCaption: LYRA_DEFAULT_datasetViewerCaption,
    datasetViewerCaptionNamed: LYRA_DEFAULT_datasetViewerCaptionNamed,
    datasetViewerEmpty: LYRA_DEFAULT_datasetViewerEmpty,
    datasetViewerMissingParser: LYRA_DEFAULT_datasetViewerMissingParser,
    details: LYRA_DEFAULT_details,
    documentPreviewEmpty: LYRA_DEFAULT_documentPreviewEmpty,
    documentPreviewFailedToLoad: LYRA_DEFAULT_documentPreviewFailedToLoad,
    documentPreviewResourceTooLarge: LYRA_DEFAULT_documentPreviewResourceTooLarge,
    documentPreviewTypeDataset: LYRA_DEFAULT_documentPreviewTypeDataset,
    documentPreviewUrlNotAllowed: LYRA_DEFAULT_documentPreviewUrlNotAllowed,
    highlightWithLabel: LYRA_DEFAULT_highlightWithLabel,
    loading: LYRA_DEFAULT_loading,
    loadingDocument: LYRA_DEFAULT_loadingDocument,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    viewerSearchActiveMatch: LYRA_DEFAULT_viewerSearchActiveMatch,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
    viewerSearchNoMatches: LYRA_DEFAULT_viewerSearchNoMatches,
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
  /** CSS length that caps the scrollable body; invalid values are ignored. */
  @property({ attribute: 'max-height' }) maxHeight = '';

  private _scrollMode: DatasetViewerScrollMode = 'self';

  /**
   * Which element scrolls when the table overflows. `'self'` preserves contained horizontal
   * scrolling and applies `maxHeight`. `'page'` removes intervening scroll containers while
   * retaining rounded header corners, making the page the sticky header's scrollport and letting
   * the rows window against the page's own scroll; a wide dataset can consequently overflow its
   * host.
   */
  @property({ reflect: true, attribute: 'scroll-mode', converter: DATASET_VIEWER_SCROLL_MODE })
  get scrollMode(): DatasetViewerScrollMode {
    return this._scrollMode;
  }
  set scrollMode(next: DatasetViewerScrollMode) {
    const normalized = DATASET_VIEWER_SCROLL_MODE.normalizeReflected(
      this,
      'scroll-mode',
      next
    );
    const previous = this._scrollMode;
    if (previous === normalized) return;
    this._scrollMode = normalized;
    this.requestUpdate('scrollMode', previous);
  }

  /** Anchor kinds this viewer resolves via `scrollToAnchor()`. */
  override readonly anchorKinds: readonly LyraAnchorKind[] = ['cell-range'];

  @state() private fetchState: DatasetFetchState = { kind: 'idle' };
  private loadTask = new LatestTask();
  // @renderController TableViewerController
  private readonly table = new TableViewerController<{ row: number; col: number }>(this, {
    emitSearch: (detail) => this.emit('lr-search-change', detail),
    emitActivate: (highlightId) => this.emit('lr-highlight-activate', { highlightId }),
    localize: (key, fallback, values) => this.localize(key, fallback, values),
    locale: () => this.effectiveLocale,
    schedule: (callback, key) => this.scheduleAfterUpdate(callback, key),
    load: () => this.load(),
    research: (query) => this.search(query),
    jump: (match) => this.jumpToCell(match.row, match.col),
    teardown: () => this.loadTask.next(),
  });

  override connectedCallback(): void {
    super.connectedCallback();
    this.table.connected();
  }

  override disconnectedCallback(): void {
    this.table.disconnecting();
    super.disconnectedCallback();
    this.table.disconnected();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.table.adopted();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed); // reaches DocumentAnchorTarget's own willUpdate (declarative `anchor`)
    this.table.willUpdate(changed, this.highlights, this.activeHighlightId, false); // dataset-viewer has no sheets
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.table.updated(changed, this.fetchState);
  }

  private async load(): Promise<void> {
    this.table.lastLoadSrc = this.src;
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
        if (table && this.table.search.query) await this.search(this.table.search.query);
        if (
          parsed.errors.length &&
          this.isConnected &&
          this.loadTask.isCurrent(generation)
        ) {
          this.emit('lr-viewer-diagnostic', {
            diagnostic: Object.freeze({
              code: 'delimited-parse-diagnostic',
              severity: 'warning',
              fatal: false,
              source: 'papaparse',
              cause: parsed.errors,
            } as const),
          });
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

  private renderCell(
    value: string,
    colIndex: number,
    rowHighlights: ResolvedCellHighlight[],
    role: 'cell' | 'columnheader' = 'cell'
  ): TemplateResult {
    return this.table.renderCell(
      value, colIndex, rowHighlights, role, role === 'columnheader' ? 'header-cell' : 'cell',
      '--_lr-dataset-viewer-highlight-color', this.activeHighlightId,
    );
  }

  private renderRow = (
    row: Record<string, string>,
    index: number,
    fields: string[]
  ): TemplateResult => {
    const rawRow = index + 2; // +1 for the always-present header row, +1 to become 1-based
    const rowHighlights = this.table.highlightsForRow(rawRow);
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
      return this.table.revealCell(this.renderRoot
        .querySelector('[part="header-row"]')
        ?.querySelectorAll('[part~="header-cell"]')[col] as HTMLElement | undefined);
    }
    this.table.setActiveRow(bodyIndex);
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
    await this.table.scrollColumnIntoView(this.renderRoot, tag('virtual-list'), col);
  }

  protected override async applyAnchor(anchor: LyraAnchor): Promise<boolean> {
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
    return this.table.runSearch(query, this.fetchState.kind === 'loaded', (visit) => {
      if (this.fetchState.kind !== 'loaded') return;
      const { fields, rows } = this.fetchState.table;
      for (let c = 0; c < fields.length; c++)
        if (!visit(fields[c]!, { row: 1, col: c })) return;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]!;
        for (let c = 0; c < fields.length; c++)
          if (!visit(row[fields[c]!] ?? '', { row: r + 2, col: c })) return;
      }
    });
  }

  /** Advances to the next match, wrapping to the first after the last. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchNext(): Promise<boolean> {
    return this.table.step(1);
  }

  /** Moves to the previous match, wrapping to the last before the first. Resolves `false` (no-op)
   *  when there are no matches. */
  async searchPrevious(): Promise<boolean> {
    return this.table.step(-1);
  }

  /** Clears the query, matches, and active index, and resets `lr-search-change` to a
   *  0-match/no-active-index state. */
  clearSearch(): void {
    this.table.clearSearch();
  }

  private stopInternalEvent = (event: Event): void => {
    event.stopPropagation();
  };

  // Stable across every render (unlike an inline arrow literal in the template), and the
  // composed `<lr-virtual-list>`'s `.items` binding is `guard()`-ed against the same table's
  // `rows` reference -- together these keep an unrelated reactive update (e.g. `searchQuery`,
  // `activeRowKey`) from forcing a full O(n) offset recompute, since `.keyFunction` and `.items`
  // otherwise appear to change identity on every render even when the row data itself did not.
  private readonly virtualListKeyFunction = (_item: unknown, index: number): number => index;

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
        const headerHighlights = this.table.highlightsForRow(1);
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
              .items=${guard([rows], () => rows)}
              .renderItem=${(row: unknown, index: number) =>
                this.renderRow(row as Record<string, string>, index, fields)}
              .keyFunction=${this.virtualListKeyFunction}
              .activeItemId=${this.table.activeRowKey}
              .scrollElement=${this.scrollMode === 'page' ? this.ownerDocument.defaultView ?? undefined : undefined}
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
