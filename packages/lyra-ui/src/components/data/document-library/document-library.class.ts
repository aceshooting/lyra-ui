import { activeElementIn } from '../../../internal/active-element.js';
import { compareNullable } from '../../../internal/sort-compare.js';
import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { createInputMemo } from '../../../internal/input-memo.js';
import type { LyraPageResult, LyraSourceRecord, LyraCursorNavigationState } from '../../../data-sources.js';
import { SourceCursorController } from '../../../internal/source-cursor-controller.js';
import { setSourcePageScope, sourcePageScope, shareSourcePageQueries } from '../../../internal/source-page-scope.js';
import { cursorIds } from './document-library-cursor.js';
import type { LibraryDocument, LibraryDocumentFreshness, LibraryDocumentSortKey } from './document-library-types.js';
export type { LibraryDocument, LibraryDocumentFreshness, LibraryDocumentSortKey } from './document-library-types.js';
import { SourcePageController, resolveSourceSelection } from '../../../internal/source-page-controller.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { displayedSourcePage, normalizeSourcePage, normalizeSourcePageSize, SourceQueryInputs } from '../../../internal/source-paging.js';
import { indexByKey } from '../../../internal/keyed-index.js';
import { lyraLocaleCatalogVersion } from '../../../internal/localization-runtime.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { createRetryForwarder } from '../../../internal/retry-forwarder.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import { foldSearchText, prepareNeedle } from '../../../internal/search-haystack.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  getCollator,
  getListFormat,
  getDateTimeFormat,
} from '../../../internal/intl-cache.js';
import {
  getOwnDataDescriptor,
  readOwnArrayLength,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import type {
  TableColumn,
  TableSortCommitDetail,
  TableSortDirection,
  TableSortRequestDetail,
} from '../table/table.class.js';
import type { LyraCombobox } from '../../forms/combobox/combobox.class.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { styles } from './document-library.styles.js';
import {
  writeOptionalSize,
  optionalSizeConverter,
  type LyraSize,
} from '../../../internal/variants.js';
import { cursorQuery, FRESHNESS_RANK, MAX_LIBRARY_COLLECTION_ENTRIES, MAX_TAG_FACETS, documentKey, FRESHNESS_TONE, projectLibraryDocument, type DocumentLibrarySourceQuery, type DocumentLibrarySource, type DocumentLibraryCursorSource, type LyraDocumentLibraryEventMap } from './document-library-support.js';
import { blankNumberConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_documentLibraryClearSelection, LYRA_DEFAULT_documentLibraryCursorEmptyBatch, LYRA_DEFAULT_documentLibraryCursorEnd, LYRA_DEFAULT_documentLibraryCursorFailed, LYRA_DEFAULT_documentLibraryCursorHistoryLimit, LYRA_DEFAULT_documentLibraryCursorNavigation, LYRA_DEFAULT_documentLibraryCursorRestart, LYRA_DEFAULT_documentLibraryEmptyHeading, LYRA_DEFAULT_documentLibraryFilterByTag, LYRA_DEFAULT_documentLibraryFreshnessAging, LYRA_DEFAULT_documentLibraryFreshnessColumn, LYRA_DEFAULT_documentLibraryFreshnessFresh, LYRA_DEFAULT_documentLibraryFreshnessStale, LYRA_DEFAULT_documentLibraryLabel, LYRA_DEFAULT_documentLibraryNameColumn, LYRA_DEFAULT_documentLibraryNoMatchesHeading, LYRA_DEFAULT_documentLibraryOmitted, LYRA_DEFAULT_documentLibraryOwnerColumn, LYRA_DEFAULT_documentLibrarySearchPlaceholder, LYRA_DEFAULT_documentLibrarySelectAll, LYRA_DEFAULT_documentLibrarySelectColumn, LYRA_DEFAULT_documentLibrarySelectDocument, LYRA_DEFAULT_documentLibrarySelectPage, LYRA_DEFAULT_documentLibrarySelectedCount, LYRA_DEFAULT_documentLibraryTagsColumn, LYRA_DEFAULT_documentLibraryTypeColumn, LYRA_DEFAULT_documentLibraryUpdatedColumn, LYRA_DEFAULT_documentLibraryVersionColumn } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_next, LYRA_DEFAULT_previous, LYRA_DEFAULT_retry, LYRA_DEFAULT_sourceSelectionFailed, LYRA_DEFAULT_sourceSelectionLoading, LYRA_DEFAULT_tagFacetLimit, LYRA_DEFAULT_viewerSearchMatchCount } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END
export type { DocumentLibrarySourceQuery, DocumentLibrarySource, DocumentLibraryCursorSource, DocumentLibraryQueryChangeDetail, DocumentLibraryFilterChangeDetail, DocumentLibrarySortRequestDetail, DocumentLibrarySortCommitDetail, DocumentLibrarySortDetail, DocumentLibrarySelectionChangeDetail, DocumentLibraryOpenDetail, LyraDocumentLibraryEventMap } from './document-library-support.js';
/**
 * `<lr-document-library>` — a searchable, filterable inventory of documents with versions, tags,
 * owners, freshness, and bulk selection. A controlled data view: it performs no upload, sync, or
 * mutation of its own, only presents `documents` and emits request/notification events, mirroring
 * this package's other orchestration-level list surfaces (`<lr-thread-list>`'s
 * `lr-thread-pin`/`-archive`/`-delete` convention).
 *
 * Composes `<lr-table>` for the inventory grid itself, since bulk selection, tags, and per-row
 * type icons all need arbitrary cell content rather than a stringified value.
 * `<lr-table>` supports arbitrary `cell()`/`headerCell()` content and `priority`-driven responsive
 * column hiding, which this component relies on for its 320px-allocation behavior. Search
 * (`<lr-input type="search">`) and the tag facet (`<lr-combobox multiple>`) are both self-managed
 * (client-side filtering against `documents`, like `<lr-thread-list>`'s own `searchable` field) —
 * override matching entirely via `filter`. Row selection uses `<lr-checkbox>` per cell. The
 * composed table stays in multiple-selection semantics so `selectedDocumentIds` reaches row
 * `aria-selected`, but its click-anywhere selection event is contained and rolled back because row
 * activation opens the document; checkbox controls remain the sole selection interaction.
 * `<lr-table>` is set to `sort-mode="server"` because this component owns ordering:
 * it already sorts against real values (timestamps for `updatedAt`, a rank for
 * `freshness`). Client mode would order the rows a second time from `String(cell(row))`, and these
 * `cell()`s render formatted dates and templates — which made the Updated column come out
 * alphabetical by month name rather than chronological. `sortKey`/`sortDir` are still passed
 * down: they drive the header's sort affordance, not the order.
 * Each selection change the user makes announces the selected count through the document's
 * shared light-DOM polite sink; property assignments stay silent. The visible selection bar
 * remains ordinary, non-live content.
 * Document identity is a unique nonempty `id`: malformed records (including a missing/non-string
 * `name` or non-string `tags` entry), blank ids, and later duplicate records are omitted at
 * assignment, so the first valid occurrence owns filtering, counts, selection, rows, and events.
 * Internal search, tag-filter, and checkbox native/prefixed value-event aliases, the tag
 * combobox's show/hide lifecycle, plus table selection/pagination events, are consumed at their
 * translation boundary; hosts receive only the documented library-level events.
 *
 * A separate `error` state reports a failed load without discarding the toolbar/selection-bar
 * context around it: while `error` is set, the nested `<lr-table>` shows its own built-in
 * failed-load state (the same `error`-prefixed exported parts and `[part='retry-button']` as
 * `<lr-table>` itself) in place of the document rows, behind this component's own `error` slot.
 * `error` beats the empty state, matching `<lr-table>`'s own precedence. This component forwards
 * `error`/`errorHeading`/`errorDescription` to the nested table but owns the retry commit itself,
 * the same intercept-and-re-propose shape `onTableSortRequest` already uses for sort.
 *
 * Tag facets show the first 500 locale-sorted distinct tags, with a localized count of omitted tags.
 * Search and filtering continue to use the complete admitted inventory.
 *
 * With dataSource, the provider owns global filtering (AND tags), ordering and catalogue facets.
 * Source pages contain at most 500 rows; sourceTotal is the exact current-query total. Provider
 * records have at most 500 tags and 65,536 total display-text UTF-16 units per record. Source row
 * tags render as complete text lists, keeping tag-cell DOM bounded independently of tag count. Invalid
 * rows, keys, totals or missing facets fail visibly. Query callbacks are forwarded to the provider.
 * Page select-all selects only the loaded page and preserves off-page selected IDs. Up to 10,000
 * selected IDs resolve in batches of 500; pending lookup disables selection changes. Only global
 * lookup absence prunes IDs, and only unavailableSelected prunes controlled tag filters. Source
 * replacement, explicit refresh and teardown revoke old work; ordinary named paints reuse it.
 *
 * With cursorSource, batches have unknown totals and opaque continuation tokens. This input is
 * mutually exclusive with dataSource. sourceTotal stays null; sourcePage is inactive. The provider
 * owns the entire query and sort; no facet catalogue is inferred. Select page preserves off-page
 * selected-ID intent. A different scope clears selection; assign restored IDs after the source.
 * Cursor tag/selection inputs scan at most 10,000 raw entries and deduplicate stably, admitting
 * at most 500 unique tags or 10,000 unique selected IDs with 2,000,000 owned text units. Invalid
 * or oversized input fails atomically rather than truncating.
 * Previous refetches at most 32 retained visited cursors; Start over discards them. Retry repeats
 * the failed request. A callback ignoring abort holds the shared page permit until it settles.
 *
 * @event lr-query-change - Cursor-mode user search edit. Frozen readonly detail: { searchTerm, tags },
 *   without a match count. Programmatic assignments are silent.
 * @csspart cursor-navigation - Named cursor navigation region.
 * @csspart cursor-previous - Refetch the preceding retained batch.
 * @csspart cursor-next - Fetch the next available batch.
 * @csspart cursor-restart - Discard continuation history and start over.
 * @csspart cursor-status - End-of-results and retained-history boundary text.
 * @csspart selection-status - Provider selection loading/error text.
 * @csspart selection-retry - Retry the current provider selection lookup.
 * @customElement lr-document-library
 * @event lr-filter-change - The search term or tag facet changed. Frozen readonly
 *   `detail: { searchTerm, tags, matchCount }`.
 *   The translated child `lr-input`/`change` event does not escape the library.
 * @event lr-sort-request - Cancelable sort proposal translated from the composed table. Frozen
 *   readonly `detail: { phase: 'request', sortKey, sortDir }`.
 * @event lr-sort - Accepted sort transaction. Frozen readonly
 *   `detail: { phase: 'commit', sortKey, sortDir }`.
 * @event lr-selection-change - The bulk selection changed (a row checkbox, the header
 *   select-all checkbox, or "Clear selection"). Frozen readonly
 *   `detail: { documentIds: readonly string[], selectedRowKeys: readonly string[] }`. Translated checkbox
 *   `lr-change` events do not escape the library.
 * @event lr-open - A document was activated (its name, or Enter/Space/click elsewhere on its
 *   row). Frozen readonly `detail: { documentId }`.
 * @event lr-retry-request - Cancelable retry proposal, `detail: null`, re-emitted by this
 *   component from the nested table's retry action. Vetoing it keeps both the parent and nested
 *   table in the error state.
 * @slot error - Replaces the nested table's built-in failed-load state, including its retry
 *   button, while `error` is set.
 * @csspart base - The root region.
 * @csspart toolbar - Wraps the search field and tag filter.
 * @csspart search - The `<lr-input>` search field.
 * @csspart tag-filter - The `<lr-combobox>` tag facet filter. Only rendered while at least one
 *   document declares a `tags` entry.
 * @csspart limit - The count of distinct tags omitted from the facet.
 * @csspart selection-bar - The ordinary, non-live "N selected" / "Clear selection" bar. Only
 *   rendered while `selectedDocumentIds` is non-empty; selection announcements use the shared light-DOM
 *   polite sink.
 * @csspart selection-count - The selected-count text inside `selection-bar`.
 * @csspart clear-selection - The "Clear selection" button inside `selection-bar`.
 * @csspart table - The `<lr-table>` inventory grid.
 * @csspart document-name - Each row's clickable document-name button.
 * @csspart row - Exported from `<lr-table>`'s own `row` part.
 * @csspart cell - Exported from `<lr-table>`'s own `cell` part.
 * @csspart header-cell - Exported from `<lr-table>`'s own `header-cell` part.
 * @csspart error-row - The nested table's single full-width row that replaces the document rows
 *   while `error` is set.
 * @csspart error-cell - The cell inside `error-row` that holds the failed-load content.
 * @csspart error - The nested table's built-in `<lr-empty>` host rendered while `error` is set.
 * @csspart error-base - Exported from the built-in error `<lr-empty>`'s own `base` part.
 * @csspart error-icon - Exported from the built-in error `<lr-empty>`'s `icon` part.
 * @csspart error-heading - Exported from the built-in error `<lr-empty>`'s `heading` part.
 * @csspart error-description - Exported from the built-in error `<lr-empty>`'s `description` part.
 * @csspart error-actions - Exported from the built-in error `<lr-empty>`'s `actions` part.
 * @csspart retry-button - The built-in retry control rendered into the error state's `actions`.
 * @status stable
 * @since 4.1.0
 */
export class LyraDocumentLibrary extends LyraElement<LyraDocumentLibraryEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    documentLibraryClearSelection: LYRA_DEFAULT_documentLibraryClearSelection,
    documentLibraryCursorEmptyBatch: LYRA_DEFAULT_documentLibraryCursorEmptyBatch,
    documentLibraryCursorEnd: LYRA_DEFAULT_documentLibraryCursorEnd,
    documentLibraryCursorFailed: LYRA_DEFAULT_documentLibraryCursorFailed,
    documentLibraryCursorHistoryLimit: LYRA_DEFAULT_documentLibraryCursorHistoryLimit,
    documentLibraryCursorNavigation: LYRA_DEFAULT_documentLibraryCursorNavigation,
    documentLibraryCursorRestart: LYRA_DEFAULT_documentLibraryCursorRestart,
    documentLibraryEmptyHeading: LYRA_DEFAULT_documentLibraryEmptyHeading,
    documentLibraryFilterByTag: LYRA_DEFAULT_documentLibraryFilterByTag,
    documentLibraryFreshnessAging: LYRA_DEFAULT_documentLibraryFreshnessAging,
    documentLibraryFreshnessColumn: LYRA_DEFAULT_documentLibraryFreshnessColumn,
    documentLibraryFreshnessFresh: LYRA_DEFAULT_documentLibraryFreshnessFresh,
    documentLibraryFreshnessStale: LYRA_DEFAULT_documentLibraryFreshnessStale,
    documentLibraryLabel: LYRA_DEFAULT_documentLibraryLabel,
    documentLibraryNameColumn: LYRA_DEFAULT_documentLibraryNameColumn,
    documentLibraryNoMatchesHeading: LYRA_DEFAULT_documentLibraryNoMatchesHeading,
    documentLibraryOmitted: LYRA_DEFAULT_documentLibraryOmitted,
    documentLibraryOwnerColumn: LYRA_DEFAULT_documentLibraryOwnerColumn,
    documentLibrarySearchPlaceholder: LYRA_DEFAULT_documentLibrarySearchPlaceholder,
    documentLibrarySelectAll: LYRA_DEFAULT_documentLibrarySelectAll,
    documentLibrarySelectColumn: LYRA_DEFAULT_documentLibrarySelectColumn,
    documentLibrarySelectDocument: LYRA_DEFAULT_documentLibrarySelectDocument,
    documentLibrarySelectPage: LYRA_DEFAULT_documentLibrarySelectPage,
    documentLibrarySelectedCount: LYRA_DEFAULT_documentLibrarySelectedCount,
    documentLibraryTagsColumn: LYRA_DEFAULT_documentLibraryTagsColumn,
    documentLibraryTypeColumn: LYRA_DEFAULT_documentLibraryTypeColumn,
    documentLibraryUpdatedColumn: LYRA_DEFAULT_documentLibraryUpdatedColumn,
    documentLibraryVersionColumn: LYRA_DEFAULT_documentLibraryVersionColumn,
    next: LYRA_DEFAULT_next,
    previous: LYRA_DEFAULT_previous,
    retry: LYRA_DEFAULT_retry,
    sourceSelectionFailed: LYRA_DEFAULT_sourceSelectionFailed,
    sourceSelectionLoading: LYRA_DEFAULT_sourceSelectionLoading,
    tagFacetLimit: LYRA_DEFAULT_tagFacetLimit,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-filter-change',
    'lr-query-change',
    'lr-selection-change',
  ]);

  @state() private sourceStateVersion = 0;
  private _dataSource?: DocumentLibrarySource;
  private sourceEpoch = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private readonly sourceQueryInputs = new SourceQueryInputs();
  private sourceFailure: unknown;
  private sourceResult?: LyraPageResult<LibraryDocument>;
  private sourceRows: LibraryDocument[] = [];
  private sourceTags: string[] = [];
  private sourceFacetLabels = new Map<string, string>();
  private sourceSelectionInputs?: readonly unknown[];
  private sourceSelectionEvent?: readonly string[];
  private sourceLifecycleVersion = 0;
  private sourceFilterEvent = false;
  private sourceSelectionAnnouncement = '';
  private readonly sourcePages = new SourcePageController<LibraryDocument, DocumentLibrarySourceQuery>(this, {
    normalizeRecord: (record, isCurrent) => this.projectSourceDocument(record, isCurrent),
    validateMetadata: (result, query) => {
      if (!result.tags || query.tagFilter.length > MAX_TAG_FACETS || result.tags.unavailableSelected.some(key => !query.tagFilter.includes(key))) throw new TypeError('Invalid document source facets');
    },
    onChange: () => { this.sourceStateVersion++; },
  });

  private _cursorSource?: DocumentLibraryCursorSource;
  private cursorEpoch = 0;
  private cursorBindingVersion = 0;
  private cursorSelectionVersion = 0;
  private cursorInputs?: readonly unknown[];
  private cursorScope?: string;
  private cursorRows: LibraryDocument[] = [];
  private readonly cursorDocuments = new WeakSet<LibraryDocument>();
  private readonly cursorBatches = new WeakSet<LibraryDocument[]>();
  private cursorAcceptedRows?: object;
  private cursorSelectionInvalid = false;
  private cursorTagInvalid = false;
  private cursorRequest: Promise<boolean> = Promise.resolve(false);
  private cursorAnnounceTransition = false;
  private cursorRetryActive = false;
  private cursorSortVersion = 0;
  private cursorSortBatch = false;
  private cursorSortProposal?: { readonly version: number; readonly binding: number; readonly owner: Document;
    readonly table: EventTarget | null; readonly key: LibraryDocumentSortKey; readonly direction: TableSortDirection };
  private readonly cursorPages = new SourceCursorController<LibraryDocument, DocumentLibrarySourceQuery>(this, {
    normalizeRecord: (key, raw, current) => {
      const projected = this.projectSourceValue(key, raw, current);
      const date = projected.value.updatedAt;
      if (date instanceof Date) {
        const updatedAt = Number.isFinite(date.getTime()) ? date.toISOString() : '';
        return { value: Object.freeze({ ...projected.value, updatedAt }), textUnits: projected.textUnits + updatedAt.length };
      }
      return projected;
    },
    onChange: () => { this.sourceStateVersion++; },
  });

  /** Unknown-total, opaque-cursor batches. Mutually exclusive with dataSource. Reassignment or
   * keyless requestUpdate starts over. A new scope clears selection; assign restored IDs afterward. */
  @property({ attribute: false })
  get cursorSource(): DocumentLibraryCursorSource | undefined { return this._cursorSource; }
  set cursorSource(value: DocumentLibraryCursorSource | undefined) {
    const previous = this._cursorSource;
    this._cursorSource = value;
    this.cursorEpoch = (this.cursorEpoch ?? 0) + 1;
    this.requestUpdate('cursorSource', previous);
  }
  private get cursorMode(): boolean { return this._cursorSource !== undefined; }

  /** Frozen navigation capabilities without totals, positions or continuation tokens. */
  get cursorNavigation(): LyraCursorNavigationState {
    const state = this.cursorPages.state.navigation;
    if (!this.cursorMode) return state;
    if (this.error || this.loading) return Object.freeze({ ...state,
      status: this.error ? 'error' : 'loading', canGoBack: false, canGoForward: false, atEnd: false });
    return state;
  }

  /** Fetch the next batch. Resolves true only when this operation commits. */
  nextCursorPage(): Promise<boolean> {
    if (!this.cursorMode || !this.cursorNavigation.canGoForward) return Promise.resolve(false);
    if (!this.prepareCursorTransition()) return Promise.resolve(false);
    return this.cursorPages.next();
  }
  /** Refetch the preceding retained batch; at most 32 visited cursors are retained. */
  previousCursorPage(): Promise<boolean> {
    if (!this.cursorMode || !this.cursorNavigation.canGoBack) return Promise.resolve(false);
    if (!this.prepareCursorTransition()) return Promise.resolve(false);
    return this.cursorPages.previous();
  }
  /** Discard continuation history and request the first batch. External loading/error blocks it. */
  restartCursorSource(): Promise<boolean> {
    if (!this.cursorMode || this.dataSource !== undefined || this.loading || this.error || !this.isConnected) return Promise.resolve(false);
    if (!this.prepareCursorTransition()) return Promise.resolve(false);
    const transaction = this.cursorBindingVersion + 1;
    this.cursorEpoch++;
    this.syncCursor();
    if (this.cursorBindingVersion !== transaction) return Promise.resolve(false);
    this.cursorAnnounceTransition = true;
    return this.cursorRequest;
  }

  private ensurePageScope(): void {
    if (!sourcePageScope(this)) setSourcePageScope(this, this);
    shareSourcePageQueries(this);
  }

  private prepareCursorTransition(): boolean {
    const transaction = this.cursorBindingVersion;
    const owner = this.ownerDocument;
    this.rehomeCursorFocus();
    if (transaction !== this.cursorBindingVersion || !this.isConnected || this.ownerDocument !== owner) return false;
    this.cursorAnnounceTransition = true;
    this.cursorRows = [];
    this.cursorAcceptedRows = undefined;
    return true;
  }

  private rehomeCursorFocus(): void {
    const table = this.renderRoot?.querySelector<HTMLElement>('[part="table"]');
    const active = activeElementIn(table?.shadowRoot);
    if (active) {
      this.renderRoot.querySelector<HTMLElement>('[part="cursor-navigation"]')?.focus();
    }
  }

  private syncCursor(): void {
    if (!this.cursorPages) return;
    const source = this._cursorSource;
    if (source === undefined && this.cursorInputs?.[0] === undefined) return;
    const inputs = [source, this.dataSource, this.cursorEpoch, this.explicitRefresh, this.effectiveLocale,
      this.searchTerm, this.tagFilter, this.sortKey, this.sortDir, this.filter,
      normalizeSourcePageSize(this.sourcePageSize), this.loading, this.error];
    if (this.cursorInputs && inputs.every((value, index) => value === this.cursorInputs![index])) return;
    const transaction = ++this.cursorBindingVersion;
    const selectionVersion = this.cursorSelectionVersion;
    const current = (): boolean => transaction === this.cursorBindingVersion && this._cursorSource === source;
    this.cursorInputs = inputs;
    this.cursorAnnounceTransition = false;
    this.rehomeCursorFocus();
    if (!current()) return;
    this.cursorRows = []; this.cursorAcceptedRows = undefined;
    this.cursorPages.invalidate();
    if (!current()) return;
    if (source === undefined) return;
    // Retire the counted route before a cursor request can acquire its shared page permit.
    this.sourcePages.bind(undefined);
    if (!current()) return;
    this.sourceInputs = undefined; this.sourceSelectionInputs = undefined;
    this.sourceRows = []; this.sourceTags = []; this.sourceResult = undefined;
    this.sourceSelectionEvent = undefined; this.sourceFilterEvent = false;
    try {
      if (this.dataSource !== undefined || source === null || (typeof source !== 'object' && typeof source !== 'function')) throw new TypeError('Conflicting or invalid cursor source');
      const revision = source.revision;
      if (!current()) return;
      const scope = source.scope;
      if (!current()) return;
      if (typeof scope !== 'string' || scope.length === 0 || scope.length > 8192) throw new TypeError('Invalid cursor scope');
      if (this.cursorScope !== undefined && this.cursorScope !== scope && selectionVersion === this.cursorSelectionVersion) {
        this.cursorSelectionVersion++;
        this._selectedDocumentIds = Object.freeze([]); this.selectionSource = this._selectedDocumentIds;
        this.cursorSelectionInvalid = false;
      }
      if (!current()) return;
      this.cursorScope = scope;
      if (this.cursorSelectionInvalid || this.cursorTagInvalid) throw new TypeError('Invalid cursor input');
      const selectedVersion = this.cursorSelectionVersion;
      let selected: readonly string[];
      try {
        selected = cursorIds(this.selectionSource ?? this._selectedDocumentIds, MAX_LIBRARY_COLLECTION_ENTRIES,
          () => current() && selectedVersion === this.cursorSelectionVersion);
      } catch (error) {
        if (!current()) return;
        if (selectedVersion === this.cursorSelectionVersion) throw error;
        // A controlled assignment made by reflection already admitted its own detached snapshot.
        selected = this._selectedDocumentIds;
      }
      const query = cursorQuery({ searchTerm: this.searchTerm ?? '', tagFilter: this.tagFilterSource ?? this.tagFilter,
        sortKey: this.sortKey, sortDir: this.sortDir, filter: this.filter } as DocumentLibrarySourceQuery, current);
      if (!current()) return;
      if (this.cursorSelectionInvalid) throw new TypeError('Invalid cursor selection');
      if (selectedVersion === this.cursorSelectionVersion) {
        this._selectedDocumentIds = selected; this.selectionSource = selected;
      }
      this._tagFilter = query.tagFilter; this.tagFilterSource = query.tagFilter;
      // Keep the fingerprints aligned with the owned snapshots without scheduling another query.
      this.cursorInputs = [source, this.dataSource, this.cursorEpoch, this.explicitRefresh, this.effectiveLocale,
        this.searchTerm, this._tagFilter, this.sortKey, this.sortDir, this.filter,
        normalizeSourcePageSize(this.sourcePageSize), this.loading, this.error];
      this.ensurePageScope();
      this.cursorPages.bind({ source, revision, scope, epoch: transaction, locale: this.effectiveLocale });
      if (!current()) return;
      if (this.loading || this.error || !this.isConnected) return;
      this.cursorRequest = this.cursorPages.request(query, normalizeSourcePageSize(this.sourcePageSize));
    } catch {
      if (current()) { this.cursorPages.fail(); this.cursorRequest = Promise.resolve(false); }
    }
  }

  private acceptCursorPage(): void {
    const state = this.cursorPages.state;
    if (state.navigation.status !== 'ready' || this.loading || this.error) {
      this.cursorRows = []; this.cursorAcceptedRows = undefined; return;
    }
    if (this.cursorAcceptedRows !== state.rows) {
      this.cursorAcceptedRows = state.rows;
      this.cursorRows = state.rows.map(record => record.value);
      this.cursorBatches.add(this.cursorRows);
      for (const document of this.cursorRows) this.cursorDocuments.add(document);
    }
  }

  private renderCursorNavigation(): TemplateResult {
    const navigation = this.cursorNavigation;
    const blocked = this.loading || this.error || this.dataSource !== undefined;
    return html`<nav part="cursor-navigation" tabindex="-1" aria-label=${this.localize('documentLibraryCursorNavigation')}>
      <button type="button" part="cursor-previous" aria-disabled=${String(!navigation.canGoBack)}
        @click=${() => { void this.previousCursorPage(); }}>${this.localize('previous')}</button>
      <button type="button" part="cursor-next" aria-disabled=${String(!navigation.canGoForward)}
        @click=${() => { void this.nextCursorPage(); }}>${this.localize('next')}</button>
      <button type="button" part="cursor-restart" aria-disabled=${String(blocked)}
        @click=${() => { void this.restartCursorSource(); }}>${this.localize('documentLibraryCursorRestart')}</button>
      <span part="cursor-status">${navigation.atEnd ? this.localize('documentLibraryCursorEnd') : ''}${navigation.historyTruncated ? this.localize('documentLibraryCursorHistoryLimit') : ''}</span>
    </nav>`;
  }

  /** Host-owned full-source pages. Takes precedence over documents, including when invalid.
   * Reassign the same provider or call requestUpdate() to refresh; undefined restores documents. */
  @property({ attribute: false })
  get dataSource(): DocumentLibrarySource | undefined { return this._dataSource; }
  set dataSource(value: DocumentLibrarySource | undefined) {
    const previous = this._dataSource; this._dataSource = value;
    this.sourceEpoch = (this.sourceEpoch ?? 0) + 1;
    this.requestUpdate('dataSource', previous);
  }
  /** Zero-based provider page; legacy table paging is unchanged. */
  @property({ converter: blankNumberConverter(0), attribute: 'source-page' }) sourcePage = 0;
  /** Provider rows per page, normalized to 1..500. */
  @property({ converter: blankNumberConverter(100), attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact current-query total, or null while pending, invalid or outside provider mode. */
  get sourceTotal(): number | null { return this.cursorMode || this.dataSource === undefined ? null : this.sourcePages.state.result?.total ?? null; }
  private get sourceMode(): boolean { return !this.cursorMode && this.dataSource !== undefined; }
  private get providerMode(): boolean { return this.cursorMode || this.sourceMode; }
  private get sourceBlocked(): boolean { if (this.cursorMode) return !this.isConnected || this.loading || this.error || this.cursorNavigation.status !== 'ready'; return this.sourceMode && (this.loading || this.error || this.sourcePages.state.pending || !!this.sourcePages.state.error || !!this.sourceFailure); }
  private get sourceSelectionBlocked(): boolean { return this.sourceBlocked || (this.sourceMode && (this.sourcePages.state.selectionPending || !!this.sourcePages.state.selectionError)); }

  private projectSourceDocument(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<LibraryDocument> {
    const projected = this.projectSourceValue(record.key, record.value, isCurrent);
    return { key: record.key, order: record.order, value: projected.value };
  }

  private projectSourceValue(key: string, raw: unknown, isCurrent: () => boolean): { value: LibraryDocument; textUnits: number } {
    const assertCurrent = (): void => { if (!isCurrent()) throw new TypeError('Obsolete source record'); };
    const descriptorOf = (target: object, key: PropertyKey) => {
      assertCurrent();
      const descriptor = getOwnDataDescriptor(target, key);
      assertCurrent();
      return descriptor;
    };
    assertCurrent();
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid source document');
    const snapshot: Record<string, unknown> = {};
    for (const key of ['id', 'name', 'mimeType', 'uri', 'version', 'tags', 'owner', 'updatedAt', 'freshness']) {
      const descriptor = descriptorOf(raw, key);
      if (descriptor === UNSAFE_OWN_DATA_DESCRIPTOR) throw new TypeError('Invalid source document');
      if (descriptor !== MISSING_OWN_DATA_DESCRIPTOR) snapshot[key] = descriptor.value;
    }
    if (snapshot['tags'] !== undefined) {
      if (!Array.isArray(snapshot['tags'])) throw new TypeError('Invalid source document tags');
      const rawTags = snapshot['tags'];
      const length = descriptorOf(rawTags, 'length');
      if (length === MISSING_OWN_DATA_DESCRIPTOR || length === UNSAFE_OWN_DATA_DESCRIPTOR || typeof length.value !== 'number' || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > MAX_TAG_FACETS) throw new RangeError('Invalid source document tags');
      const tags: string[] = [];
      for (let index = 0; index < length.value; index++) {
        const descriptor = descriptorOf(rawTags, String(index));
        if (descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR || typeof descriptor.value !== 'string') throw new TypeError('Invalid source document tag');
        tags.push(descriptor.value);
      }
      snapshot['tags'] = tags;
    }
    const value = projectLibraryDocument(snapshot);
    assertCurrent();
    if (!value || value.id !== key || (value.tags?.length ?? 0) > MAX_TAG_FACETS) throw new TypeError('Invalid source document');
    let units = 0;
    for (const text of [value.id, value.name, value.owner, value.mimeType, value.uri, value.version,
      typeof value.updatedAt === 'string' ? value.updatedAt : undefined, ...(value.tags ?? [])]) {
      if (text !== undefined) { units += text.length; if (text.length > 65_536 || units > 65_536) throw new RangeError('Source document too large'); }
    }
    assertCurrent();
    return { value, textUnits: units };
  }

  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) this.sourcePages.bind(undefined);
        this.sourceInputs = undefined; this.sourceQueryInputs.clear(); this.sourceSelectionInputs = undefined;
        this.sourceSelectionEvent = undefined; this.sourceFilterEvent = false;
        this.sourceResult = undefined; this.sourceRows = []; this.sourceTags = []; this.sourceFailure = undefined;
        return;
      }
      this.ensurePageScope();
      const source = this.dataSource!;
      const epoch = this.sourceEpoch + this.explicitRefresh;
      const size = normalizeSourcePageSize(this.sourcePageSize);
      let page = normalizeSourcePage(this.sourcePage, size);
      const queryInputs = [this.searchTerm, this.tagFilter, this.sortKey, this.sortDir, this.filter, size];
      if (this.sourceQueryInputs.changed(queryInputs)) {
        page = 0; this.sourcePage = 0;
      }
      const revision = source.revision;
      const inputs = [source, revision, epoch, this.effectiveLocale, ...queryInputs, page];
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      if (this.sourceInputs && inputs.slice(0, 3).some((value, index) => value !== this.sourceInputs![index])) { this.sourceSelectionEvent = undefined; this.sourceFilterEvent = false; }
      this.sourceInputs = inputs; this.sourceFailure = undefined;
      this.sourceRows = []; this.sourceTags = []; this.sourceResult = undefined;
      this.sourcePages.bind({ source, revision, epoch, locale: this.effectiveLocale });
      if (this.tagFilter.length > MAX_TAG_FACETS) throw new RangeError('Too many source facets');
      const query: DocumentLibrarySourceQuery = Object.freeze({ searchTerm: this.searchTerm ?? '', tagFilter: this.tagFilter,
        sortKey: this.sortKey, sortDir: this.sortDir, filter: this.filter });
      void this.sourcePages.request(query, page, size);
      this.syncSourceSelection();
    } catch (error) {
      this.sourcePages.bind(undefined); this.sourceRows = []; this.sourceTags = []; this.sourceResult = undefined; this.sourceFailure = error;
    } finally { this.sourceSyncing = false; }
  }

  private syncSourceSelection(): void {
    if (!this.sourceMode || this.sourceFailure) return;
    const ids = this._selectedDocumentIds;
    const source = this.dataSource;
    const epoch = this.sourceEpoch + this.explicitRefresh;
    const inputs = [source, source?.revision, epoch, ids];
    if (this.sourceSelectionInputs && inputs.every((value, index) => value === this.sourceSelectionInputs![index])) return;
    this.sourceSelectionInputs = inputs;
    const owner = this.ownerDocument;
    const lifecycle = this.sourceLifecycleVersion;
    void resolveSourceSelection(this.sourcePages, ids).then(records => {
      if (!records || lifecycle !== this.sourceLifecycleVersion || !this.isConnected || this.ownerDocument !== owner || this.dataSource !== source || epoch !== this.sourceEpoch + this.explicitRefresh || this._selectedDocumentIds !== ids) return;
      const retained = new Set(records.map(record => record.key));
      const accepted = Object.freeze(ids.filter(id => retained.has(id)));
      if (accepted.length !== ids.length) { this._selectedDocumentIds = accepted; this.selectionSource = accepted; this.sourceSelectionInputs = undefined; }
      if (this.sourceSelectionEvent === ids) {
        this.sourceSelectionEvent = undefined;
        this.announcements.announcePolite(this.selectionCountText());
        const documentIds = Object.freeze([...this._selectedDocumentIds]);
        this.emit('lr-selection-change', Object.freeze({ documentIds, selectedRowKeys: documentIds }));
      }
      this.sourceStateVersion++;
    });
  }

  private acceptSourcePage(): void {
    const result = this.sourcePages.state.result;
    if (!result || result === this.sourceResult) return;
    this.sourceResult = result;
    this.sourceRows = result.rows.map(record => record.value);
    this.sourceTags = result.tags!.values.map(facet => facet.key);
    this.sourceFacetLabels = new Map(result.tags!.values.map(facet => [facet.key, facet.label]));
    const removed = new Set(result.tags!.unavailableSelected);
    if (this.tagFilter.some(key => removed.has(key))) { this.tagFilter = this.tagFilter.filter(key => !removed.has(key)); return; }
    if (this.sourcePage !== this.sourcePages.state.page) {
      this.sourceSyncing = true; this.sourcePage = this.sourcePages.state.page; this.sourceSyncing = false;
      this.sourceInputs = this.sourceInputs ? [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page] : undefined;
    }
    if (this.sourceFilterEvent) {
      this.sourceFilterEvent = false;
      this.announcements.announcePolite(this.localize('viewerSearchMatchCount', undefined, { count: result.total }));
      this.emit('lr-filter-change', Object.freeze({ searchTerm: this.searchTerm, tags: Object.freeze([...this.tagFilter]), matchCount: result.total }));
    }
  }

  private onSourcePage = (event: CustomEvent<{ page: number }>): void => {
    event.stopPropagation();
    if (this.isCurrentTableEvent(event) && this.sourceMode) this.sourcePage = event.detail.page - 1;
  };

  private documentLimit = MAX_LIBRARY_COLLECTION_ENTRIES;
  private omittedDocuments = 0;
  /**
   * Maximum source positions inspected per assignment. Raising the limit re-admits the source.
   * @default 10000
   */
  @property({ converter: blankNumberConverter(MAX_LIBRARY_COLLECTION_ENTRIES), attribute: 'max-documents' })
  get maxDocuments(): number { return this.documentLimit; }
  set maxDocuments(value: number) {
    const limit = finiteInteger(value, MAX_LIBRARY_COLLECTION_ENTRIES, 0, 100_000);
    const previous = this.documentLimit;
    if (previous === limit) return;
    this.documentLimit = limit;
    if (this.documentsSource) this.admitDocuments(this.documentsSource);
    this.requestUpdate('maxDocuments', previous);
  }

  /** Source positions omitted by the limit, invalid records and duplicate document IDs. */
  get documentsTruncated(): number { return this.omittedDocuments; }

  private _documents: readonly LibraryDocument[] = Object.freeze([]);
  /** Clone-owned readonly inventory, bounded to the first maxDocuments source positions and 10,000 tags
   * per document. Document records, nested tag arrays, and dates are snapshotted at assignment
   * time; records without a string name or with non-string tag entries, blank ids, and later
   * duplicate ids are omitted first-wins before filters, counts, selection, rows, and events. Reads
   * return one stable detached snapshot per assignment, so even `Date` mutators cannot reach
   * retained state. Reassign a new collection to update. */
  @property({ attribute: false })
  get documents(): readonly LibraryDocument[] {
    return (this.documentsView ??= this.snapshotDocuments(this._documents).rows);
  }
  set documents(value: readonly LibraryDocument[]) {
    if (value === this.documentsSource || value === this.documentsView) return;
    this.documentsSource = value;
    this.admitDocuments(value);
  }
  private documentAssignment = 0;
  private admitDocuments(value: unknown): void {
    const assignment = ++this.documentAssignment;
    const previous = this._documents;
    const { rows, omitted } = this.snapshotDocuments(value);
    if (assignment !== this.documentAssignment) return;
    this.omittedDocuments = omitted;
    this._documents = rows;
    this.documentsView = undefined;
    this.requestUpdate('documents', previous);
  }
  private documentsSource?: unknown;
  private documentsView?: readonly LibraryDocument[];

  /** Bulk-selected document ids. Settable up front (pre-selection) and mutated internally by the
   *  row/select-all checkboxes and "Clear selection" — read it back, or listen for
   *  `lr-selection-change`, to persist the current selection. Automatically pruned of any id no
   *  longer present in `documents` (no event fires for that pruning -- only an actual selection
   *  interaction does, mirroring `<lr-chip-group>`'s identical silent-resync convention for its
   *  own `expanded` state). Assignment snapshots at most 10,000 unique ids; reassign to update. */
  private _selectedDocumentIds: readonly string[] = Object.freeze([]);
  private selectionSource?: unknown;
  /** Selected document IDs, including selections outside the current page. */
  @property({ attribute: false })
  get selectedDocumentIds(): readonly string[] {
    return this._selectedDocumentIds;
  }
  set selectedDocumentIds(value: readonly string[]) {
    if (value === this.selectionSource || value === this._selectedDocumentIds) return;
    if (this.cursorMode && this.cursorPages) {
      const version = ++this.cursorSelectionVersion;
      const binding = this.cursorBindingVersion;
      const current = (): boolean => version === this.cursorSelectionVersion && binding === this.cursorBindingVersion;
      try {
        const snapshot = cursorIds(value, MAX_LIBRARY_COLLECTION_ENTRIES, current);
        if (!current()) return;
        const previous = this._selectedDocumentIds;
        this.selectionSource = snapshot; this._selectedDocumentIds = snapshot;
        const recovering = this.cursorSelectionInvalid;
        this.cursorSelectionInvalid = false;
        if (recovering) { this.cursorInputs = undefined; this.syncCursor(); }
        this.requestUpdate('selectedDocumentIds', previous);
      } catch {
        if (current()) { this.cursorSelectionInvalid = true; this.cursorPages.fail(); this.sourceStateVersion++; }
      }
      return;
    }
    this.sourceSelectionEvent = undefined;
    this.selectionSource = value;
    const previous = this._selectedDocumentIds;
    this._selectedDocumentIds = this.snapshotIds(Array.isArray(value) ? value : []);
    this.requestUpdate('selectedDocumentIds', previous);
  }

  /** Currently-applied tag facet (`AND` semantics -- a document must carry every listed tag).
   *  Settable up front and mutated internally by the tag filter combobox. Assignment snapshots at
   *  most 10,000 unique tags; reassign to update. */
  private _tagFilter: readonly string[] = Object.freeze([]);
  private tagFilterSource?: unknown;
  /** Tags that constrain the document query. */
  @property({ attribute: false })
  get tagFilter(): readonly string[] {
    return this._tagFilter;
  }
  set tagFilter(value: readonly string[]) {
    if (value === this.tagFilterSource || value === this._tagFilter) return;
    if (this.cursorMode && this.cursorPages) {
      const version = ++this.cursorBindingVersion;
      try {
        const snapshot = cursorIds(value, MAX_TAG_FACETS, () => version === this.cursorBindingVersion);
        if (version !== this.cursorBindingVersion) return;
        const previous = this._tagFilter;
        this.tagFilterSource = snapshot; this._tagFilter = snapshot; this.cursorTagInvalid = false;
        this.requestUpdate('tagFilter', previous);
      } catch {
        if (version === this.cursorBindingVersion) { this.cursorTagInvalid = true; this.cursorPages.fail(); this.sourceStateVersion++; }
      }
      return;
    }
    this.tagFilterSource = value;
    const previous = this._tagFilter;
    this._tagFilter = this.snapshotIds(Array.isArray(value) ? value : []);
    this.requestUpdate('tagFilter', previous);
  }

  /** Overrides the default case-insensitive name/owner/tag substring match. Receives the already
   *  trimmed, lowercased search text, mirroring `<lr-thread-list>`'s identical `filter` contract. */
  @property({ attribute: false }) filter?: (
    document: LibraryDocument,
    query: string
  ) => boolean;

  /** Controlled sortable column key. */
  @property({ attribute: 'sort-key' }) sortKey: LibraryDocumentSortKey = 'name';
  /** Controlled canonical sort direction shared with `<lr-table>`. */
  @property({ attribute: 'sort-dir' }) sortDir: TableSortDirection = 'asc';

  /** Controlled search query applied to document names, owners, and tags. Removing the
   * attribute clears filtering while retaining the native null property readback. */
  @property({ attribute: 'search-term' }) searchTerm = '';

  /** Shows the library's loading state. */
  @property({ type: Boolean, reflect: true }) loading = false;

  /** Reports a failed document-list load. Forwarded to the nested `<lr-table>`, whose own
   *  built-in failed-load state renders in place of the document rows; `<lr-table>`'s own
   *  precedence applies (`error` beats the empty state). Reflected so `[error]` is selectable
   *  from outside. */
  @property({ type: Boolean, reflect: true }) error = false;

  /** Failed-load heading override, forwarded to the nested table. Omitted localizes the table's
   *  own `tableLoadFailed` default. */
  @property({ attribute: 'error-heading' }) errorHeading?: string;

  /** Failed-load supporting copy, forwarded to the nested table. */
  @property({ attribute: 'error-description' }) errorDescription = '';

  private readonly slotPresence = new SlotPresenceController(this, { observeLightDom: true });
  private get hasErrorSlot(): boolean { return this.slotPresence.has('error'); }

  /** Forward the nested table's retry as this component's request; a veto keeps both error states. */
  private onTableRetry = (event: CustomEvent<null>): void => {
    if (!this.isCurrentTableEvent(event)) { event.stopPropagation(); event.preventDefault(); return; }
    if (!this.cursorMode) { this.onCountedTableRetry(event); return; }
    event.stopPropagation();
    event.preventDefault();
    if (this.cursorRetryActive || this.loading || !this.isConnected) return;
    this.cursorRetryActive = true;
    const transaction = this.cursorBindingVersion;
    const owner = this.ownerDocument;
    try {
      const proposal = this.emit('lr-retry-request', null, { cancelable: true });
      if (proposal.defaultPrevented || transaction !== this.cursorBindingVersion || !this.isConnected || this.ownerDocument !== owner) return;
      if (!this.prepareCursorTransition()) return;
      if (this.error) this.error = false;
      else if (this.cursorPages.state.navigation.status === 'error') void this.cursorPages.retry();
    } finally { this.cursorRetryActive = false; }
  };

  private onCountedTableRetry = createRetryForwarder(
    (init) => this.emit('lr-retry-request', null, init),
    () => {
      this.error = false;
      if (this.sourceMode) { this.sourceInputs = undefined; this.syncSource(); this.sourceStateVersion++; }
    },
  );

  private _size?: LyraSize;

  /** Density tier for the toolbar's own search field and tag filter, on the library's one size
   *  ladder, in either spelling -- `2xs`/`xs`/`s`/`m`/`l`/`xl`, or Web Awesome's and Shoelace's
   *  `small`/`medium`/`large`. Forwarded verbatim to the composed `<lr-input>` and `<lr-combobox>`,
   *  which is the only way to reach them: each resolves its tier inside its own shadow root, so no
   *  custom property this component could publish would get there. Opt-in: with no size both keep
   *  their own `m` default, exactly what they rendered before, and the two stay on the same tier as
   *  each other at every setting so the toolbar row never goes ragged. Forwarded as a property
   *  rather than an attribute, because removing an already-written `size` attribute again would
   *  leave each child's own `size` at `null` instead of back at its own default. Unsupported
   *  values normalize to the omitted state and remove the attribute. */
  @property({ reflect: true, converter: optionalSizeConverter })
  get size(): LyraSize | undefined {
    return this._size;
  }
  set size(next: LyraSize | undefined) {
    writeOptionalSize(this, this._size, next, size => { this._size = size; });
  }

  /** Accessible name for the region and the inner grid. Defaults to the localized
   *  `documentLibraryLabel` when unset. An explicitly empty string renders as an empty label
   *  rather than falling back. */
  @property() label?: string;

  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.cursorMode) { this.cursorInputs = undefined; this.syncCursor(); }
    if (this.hasUpdated && this.sourceMode) {
      this.sourceSelectionInputs = undefined;
      this.syncSourceSelection();
    }
  }

  private invalidateSourceSelection(): void {
    this.sourceLifecycleVersion++;
    this.sourceSelectionInputs = undefined;
    this.sourceSelectionEvent = undefined;
    this.sourceFilterEvent = false;
    this.sourceAnnouncementInitialized = false;
  }

  override disconnectedCallback(): void {
    this.invalidateSourceSelection();
    this.cursorBindingVersion++; this.cursorInputs = undefined; this.cursorRows = []; this.cursorPages.invalidate();
    this.cursorAnnounceTransition = false;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    this.invalidateSourceSelection();
    super.adoptedCallback();
    this.announcements.adopted();
    this.sourcePages.adopted();
    this.cursorBindingVersion++; this.cursorInputs = undefined; this.cursorRows = []; this.cursorPages.invalidate();
    this.syncCursor();
  }

  private sourceAnnouncementInitialized = false;
  private childRegistration?: Promise<unknown>;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.childRegistration;
    return complete;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.childRegistration = loadLazyChildren('document-library', this.renderRoot) ?? this.childRegistration;
    if (this.sourceAnnouncementInitialized && !this.providerMode && this.documentsTruncated > 0 &&
      (changed.has('documents') || changed.has('maxDocuments'))) {
      this.announcements.announcePolite(this.localize('documentLibraryOmitted', undefined, { count: this.documentsTruncated }));
    }
    if (this.cursorMode) {
      const state = this.cursorPages.state;
      if (this.cursorAnnounceTransition &&
        (state.navigation.status === 'error' || state.navigation.atEnd)) {
        this.cursorAnnounceTransition = false;
        this.announcements.announcePolite(this.localize(state.navigation.status === 'error' ? 'documentLibraryCursorFailed' : 'documentLibraryCursorEnd'));
      }
      if (state.navigation.status === 'ready') this.cursorAnnounceTransition = false;
    }
    const status = this.sourceMode && this.sourcePages.state.selectionError ? this.localize('sourceSelectionFailed')
      : this.sourceMode && this.sourcePages.state.selectionPending ? this.localize('sourceSelectionLoading') : '';
    if (this.sourceAnnouncementInitialized && status && status !== this.sourceSelectionAnnouncement) this.announcements.announcePolite(status);
    this.sourceAnnouncementInitialized = true; this.sourceSelectionAnnouncement = status;
  }

  private snapshotDocuments(documents: unknown): { rows: readonly LibraryDocument[]; omitted: number } {
    const rows: LibraryDocument[] = [];
    const seen = new Set<string>();
    let length = 0;
    try {
      if (Array.isArray(documents)) length = readOwnArrayLength(documents) ?? 0;
      const limit = Math.min(length, this.documentLimit);
      for (let index = 0; index < limit; index++) {
        const entry = getOwnDataDescriptor(documents as object, String(index));
        if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
        const document = projectLibraryDocument(entry.value);
        if (!document || seen.has(document.id)) continue;
        seen.add(document.id);
        rows.push(document);
      }
    } catch {
      // Revoked arrays cannot supply a length.
    }
    return { rows: Object.freeze(rows), omitted: length - rows.length };
  }

  private snapshotIds(ids: Iterable<string>): readonly string[] {
    const snapshot: string[] = [];
    const seen = new Set<string>();
    try {
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id);
        snapshot.push(id);
        if (snapshot.length >= MAX_LIBRARY_COLLECTION_ENTRIES) break;
      }
    } catch {
      // Retain the safe prefix when an untyped iterable throws.
    }
    return Object.freeze(snapshot);
  }

  private explicitRefresh = 0;
  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) this.explicitRefresh = (this.explicitRefresh ?? 0) + 1;
    super.requestUpdate(...args);
    if (!(this.cursorSortBatch && (args[0] === 'sortKey' || args[0] === 'sortDir')) &&
      (args[0] === undefined || ['cursorSource', 'dataSource', 'sourcePageSize', 'searchTerm', 'tagFilter', 'sortKey', 'sortDir', 'filter', 'locale', 'lang', 'loading', 'error'].includes(String(args[0])))) this.syncCursor();
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize', 'searchTerm', 'tagFilter', 'sortKey', 'sortDir', 'filter'].includes(String(args[0]))) this.syncSource();
    if (args[0] === 'selectedDocumentIds') this.syncSourceSelection();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncCursor();
    this.syncSource();
    if (this.cursorMode) { this.acceptCursorPage(); return; }
    if (this.sourceMode) { this.acceptSourcePage(); this.syncSourceSelection(); return; }
    if (
      (changed.has('documents') || changed.has('selectedDocumentIds') || changed.has('dataSource')) &&
      this.selectedDocumentIds.length > 0
    ) {
      const existing = indexByKey(this._documents, documentKey);
      const normalized = this.snapshotIds(this.selectedDocumentIds.filter((id) => existing.has(id)));
      if (
        normalized.length !== this.selectedDocumentIds.length ||
        normalized.some((id, index) => id !== this.selectedDocumentIds[index])
      ) {
        this.selectedDocumentIds = normalized;
      }
    }
    if (
      (changed.has('documents') || changed.has('tagFilter') || changed.has('dataSource')) &&
      this.tagFilter.length > 0
    ) {
      const availableTags = this.tagSet;
      const normalized = this.snapshotIds(this.tagFilter.filter((tag) => availableTags.has(tag)));
      if (
        normalized.length !== this.tagFilter.length ||
        normalized.some((tag, index) => tag !== this.tagFilter[index])
      ) {
        this.tagFilter = normalized;
      }
    }
  }

  private selectionCountText(): string {
    return this.localize('documentLibrarySelectedCount', undefined, {
      count: this.formatLocaleNumber(this.selectedDocumentIds.length), pluralCount: this.selectedDocumentIds.length,
    });
  }

  private normalizeDate(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private corpusMemo?: { documents: readonly LibraryDocument[]; locale: string; fields: ReadonlyMap<LibraryDocument, readonly string[]> };
  private defaultFilter = (document: LibraryDocument, query: string): boolean => {
    const locale = this.effectiveLocale;
    if (this.corpusMemo?.documents !== this._documents || this.corpusMemo.locale !== locale) {
      const fields = new Map<LibraryDocument, readonly string[]>();
      for (const row of this._documents) fields.set(row,
        [row.name, row.owner ?? '', ...(row.tags ?? [])].map(value => foldSearchText(value, locale)));
      this.corpusMemo = { documents: this._documents, locale, fields };
    }
    return this.corpusMemo.fields.get(document)!.some(value => value.includes(query));
  };

  private readonly documentTags = new WeakMap<LibraryDocument, ReadonlySet<string>>();
  private matchesTagFilter(document: LibraryDocument): boolean {
    if (this.tagFilter.length === 0) return true;
    let tags = this.documentTags.get(document);
    if (!tags) {
      tags = new Set(document.tags ?? []);
      this.documentTags.set(document, tags);
    }
    return this.tagFilter.every(tag => tags.has(tag));
  }

  private readonly documentDates = new WeakMap<LibraryDocument, Date | undefined>();
  private documentDate(document: LibraryDocument): Date | undefined {
    if (!this.documentDates.has(document)) this.documentDates.set(document, this.normalizeDate(document.updatedAt));
    return this.documentDates.get(document);
  }

  private sortValue(document: LibraryDocument): string | number {
    switch (this.sortKey) {
      case 'freshness': return document.freshness ? FRESHNESS_RANK[document.freshness] : 3;
      case 'updatedAt': return this.documentDate(document)?.getTime() ?? 0;
      default: return document[this.sortKey] ?? '';
    }
  }

  private sortLocale = this.effectiveLocale;
  private compareDocuments = (a: LibraryDocument, b: LibraryDocument): number =>
    compareNullable(this.sortValue(a), this.sortValue(b), this.sortDir === 'asc' ? 1 : -1, this.sortLocale);

  private readonly matchDocuments = createInputMemo((
    documents: readonly LibraryDocument[], query: string, _tags: readonly string[],
    filter: LyraDocumentLibrary['filter'], _locale: string, _refresh: number
  ): LibraryDocument[] => {
    const match = filter ?? this.defaultFilter;
    return documents.filter(document => (query === '' || match(document, query)) && this.matchesTagFilter(document));
  });

  /** The current search+tag-facet-filtered view, in input order. */
  private get matchingDocuments(): LibraryDocument[] {
    const term = this.searchTerm ?? '';
    const query = this.filter ? term.trim().toLocaleLowerCase(this.effectiveLocale) : prepareNeedle(term, this.effectiveLocale);
    return this.matchDocuments(this._documents, query, this.tagFilter, this.filter, this.effectiveLocale,
      this.filter ? this.explicitRefresh : 0);
  }

  private readonly sortDocuments = createInputMemo((
    rows: LibraryDocument[], key: LibraryDocumentSortKey, _direction: TableSortDirection, locale: string
  ): LibraryDocument[] => {
    this.sortLocale = locale;
    if (key === 'updatedAt') for (const row of rows) this.documentDate(row);
    return [...rows].sort(this.compareDocuments);
  });

  private get sortedDocuments(): LibraryDocument[] {
    return this.sortDocuments(this.matchingDocuments, this.sortKey, this.sortDir, this.effectiveLocale);
  }

  private readonly documentTagIndex = createInputMemo((documents: readonly LibraryDocument[], locale: string) => {
    const tags = new Set<string>();
    for (const document of documents)
      for (const tag of document.tags ?? []) tags.add(tag);
    return { sorted: [...tags].sort(getCollator(locale).compare), tags };
  });

  private get allTags(): string[] {
    return this.documentTagIndex(this._documents, this.effectiveLocale).sorted;
  }

  private get tagSet(): ReadonlySet<string> {
    return this.documentTagIndex(this._documents, this.effectiveLocale).tags;
  }

  private readonly selectedIdSetFor = createInputMemo((ids: readonly string[]) => new Set(ids));

  private get selectedIdSet(): ReadonlySet<string> {
    return this.selectedIdSetFor(this._selectedDocumentIds);
  }

  private emitFilterChange(): void {
    if (this.cursorMode) {
      this.emit('lr-query-change', Object.freeze({ searchTerm: this.searchTerm, tags: Object.freeze([...this.tagFilter]) }));
      return;
    }
    if (this.sourceMode) { this.sourceFilterEvent = true; return; }
    const tags = Object.freeze([...this.tagFilter]);
    this.announcements.announcePolite(this.localize('viewerSearchMatchCount', undefined, { count: this.matchingDocuments.length }));
    this.emit(
      'lr-filter-change',
      Object.freeze({ searchTerm: this.searchTerm, tags, matchCount: this.matchingDocuments.length })
    );
  }

  private onSearchInput = (event: CustomEvent<{ value: string }>): void => {
    event.stopPropagation();
    this.searchTerm = event.detail.value;
    if (this.cursorMode) this.cursorAnnounceTransition = true;
    this.emitFilterChange();
  };

  private onTagFilterChange = (event: Event): void => {
    event.stopPropagation();
    const combobox = event.target as LyraCombobox;
    this.tagFilter = Array.isArray(combobox.value) ? combobox.value : [];
    this.emitFilterChange();
  };

  private isSortKey(value: string): value is LibraryDocumentSortKey {
    return value === 'name' || value === 'version' || value === 'owner' || value === 'freshness' || value === 'updatedAt';
  }

  private onTableSortRequest = (event: CustomEvent<TableSortRequestDetail>): void => {
    event.stopPropagation();
    if (!this.isCurrentTableEvent(event)) { event.preventDefault(); return; }
    if (!this.isSortKey(event.detail.sortKey)) {
      event.preventDefault();
      return;
    }
    const detail = Object.freeze({
      phase: 'request',
      sortKey: event.detail.sortKey,
      sortDir: event.detail.sortDir,
    } as const);
    if (this.cursorMode) {
      const version = ++this.cursorSortVersion;
      const binding = this.cursorBindingVersion;
      const owner = this.ownerDocument;
      this.cursorSortProposal = undefined;
      if (!this.isConnected) { event.preventDefault(); return; }
      const proposal = this.emit('lr-sort-request', detail, { cancelable: true });
      if (proposal.defaultPrevented || version !== this.cursorSortVersion || binding !== this.cursorBindingVersion ||
        !this.isConnected || this.ownerDocument !== owner || !sourcePageScope(this)?.isCurrent()) {
        event.preventDefault(); return;
      }
      this.cursorSortProposal = { version, binding, owner, table: event.currentTarget, key: detail.sortKey, direction: detail.sortDir };
      return;
    }
    if (this.emit('lr-sort-request', detail, { cancelable: true }).defaultPrevented) event.preventDefault();
  };

  private onTableSortCommit = (event: CustomEvent<TableSortCommitDetail>): void => {
    event.stopPropagation();
    if (!this.isCurrentTableEvent(event)) return;
    if (!this.isSortKey(event.detail.sortKey)) return;
    if (this.cursorMode || this.cursorSortProposal) {
      const proposal = this.cursorSortProposal;
      this.cursorSortProposal = undefined;
      if (!proposal || proposal.version !== this.cursorSortVersion || proposal.binding !== this.cursorBindingVersion ||
        proposal.table !== event.currentTarget || proposal.key !== event.detail.sortKey || proposal.direction !== event.detail.sortDir ||
        !this.isConnected || proposal.owner !== this.ownerDocument || !sourcePageScope(this)?.isCurrent()) return;
      this.cursorSortBatch = true;
      try {
        this.sortKey = proposal.key;
        if (proposal.binding !== this.cursorBindingVersion || !this.isConnected || proposal.owner !== this.ownerDocument) return;
        this.sortDir = proposal.direction;
      } finally { this.cursorSortBatch = false; }
      if (proposal.binding !== this.cursorBindingVersion || !this.isConnected || proposal.owner !== this.ownerDocument) return;
      const expected = proposal.binding + (this.cursorInputs?.[7] !== this.sortKey || this.cursorInputs?.[8] !== this.sortDir ? 1 : 0);
      this.syncCursor();
      if (this.cursorBindingVersion !== expected || !this.isConnected || proposal.owner !== this.ownerDocument ||
        this.sortKey !== proposal.key || this.sortDir !== proposal.direction) return;
      this.cursorAnnounceTransition = true;
      this.emit('lr-sort', Object.freeze({ phase: 'commit', sortKey: proposal.key, sortDir: proposal.direction } as const));
      return;
    }
    this.sortKey = event.detail.sortKey;
    this.sortDir = event.detail.sortDir;
    this.emit(
      'lr-sort',
      Object.freeze({ phase: 'commit', sortKey: this.sortKey, sortDir: this.sortDir } as const)
    );
  };

  private isCurrentTableEvent(event: Event): boolean {
    return this.isConnected && event.currentTarget === this.renderRoot.querySelector('[part="table"]');
  }

  private stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  /** Row activation opens a document; checkbox controls own selection. Keep the composed table in
   * multiple-selection semantics for truthful `aria-selected`, but contain and roll back its
   * click-anywhere selection behavior at this wrapper boundary. */
  private onTableSelectionChange = (event: CustomEvent): void => {
    event.stopPropagation();
    if (!this.isCurrentTableEvent(event)) return;
    const table = event.currentTarget as HTMLElement & {
      selectedRowKeys: ReadonlySet<string | number>;
    };
    table.selectedRowKeys = new Set(this.selectedDocumentIds);
  };

  private openDocument(document: LibraryDocument): void {
    if (this.cursorDocuments.has(document) && (!this.cursorMode || !this.cursorRows.includes(document))) return;
    if (this.sourceBlocked || (this.sourceMode && !this.sourceRows.includes(document)) || (this.cursorMode && !this.cursorRows.includes(document))) return;
    this.emit('lr-open', Object.freeze({ documentId: document.id }));
  }

  private setSelected(ids: Iterable<string>): void {
    if (this.sourceSelectionBlocked) return;
    const previous = this._selectedDocumentIds;
    this.selectedDocumentIds = [...ids];
    if (this.cursorMode && (this.cursorSelectionInvalid || this._selectedDocumentIds === previous)) return;
    if (this.sourceMode) { this.sourceSelectionEvent = this._selectedDocumentIds; return; }
    this.announcements.announcePolite(this.selectionCountText());
    const eventIds = Object.freeze([...this.selectedDocumentIds]);
    this.emit('lr-selection-change', Object.freeze({ documentIds: eventIds, selectedRowKeys: eventIds }));
  }

  private toggleSelection(document: LibraryDocument, checked: boolean): void {
    if ((this.cursorMode || this.cursorDocuments.has(document)) && !this.cursorRows.includes(document)) return;
    const next = new Set(this.selectedDocumentIds);
    if (checked) next.add(document.id);
    else next.delete(document.id);
    this.setSelected(next);
  }

  private toggleSelectAll(checked: boolean, visible: LibraryDocument[]): void {
    if ((this.cursorMode || this.cursorBatches.has(visible)) && visible !== this.cursorRows) return;
    const next = new Set(this.selectedDocumentIds);
    for (const document of visible) {
      if (checked) next.add(document.id);
      else next.delete(document.id);
    }
    this.setSelected(next);
  }

  private clearSelection = (): void => {
    this.setSelected([]);
  };

  private freshnessLabel(freshness: LibraryDocumentFreshness): string {
    switch (freshness) {
      case 'fresh':
        return this.localize('documentLibraryFreshnessFresh');
      case 'aging':
        return this.localize('documentLibraryFreshnessAging');
      case 'stale':
        return this.localize('documentLibraryFreshnessStale');
    }
  }

  private renderSelectAllCheckbox(visible: LibraryDocument[], selected: ReadonlySet<string>): TemplateResult {
    const allSelected =
      visible.length > 0 &&
      visible.every((document) => selected.has(document.id));
    const someSelected =
      !allSelected &&
      visible.some((document) => selected.has(document.id));
    return html`<lr-checkbox
      .checked=${allSelected}
      .indeterminate=${someSelected}
      aria-label=${this.localize(this.providerMode ? 'documentLibrarySelectPage' : 'documentLibrarySelectAll')}
      .disabled=${this.sourceSelectionBlocked}
      @lr-checkbox-toggle-request=${this.stopOwnedEvent}
      @input=${this.stopOwnedEvent}
      @lr-input=${this.stopOwnedEvent}
      @change=${this.stopOwnedEvent}
      @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
        event.stopPropagation();
        this.toggleSelectAll(event.detail.checked, visible);
      }}
    ></lr-checkbox>`;
  }

  private renderRowCheckbox(document: LibraryDocument, selected: ReadonlySet<string>): TemplateResult {
    return html`<lr-checkbox
      .checked=${selected.has(document.id)}
      .disabled=${this.sourceSelectionBlocked}
      aria-label=${this.localize('documentLibrarySelectDocument', undefined, {
        name: normalizeLabel(document.name) ?? document.id,
      })}
      @lr-checkbox-toggle-request=${this.stopOwnedEvent}
      @input=${this.stopOwnedEvent}
      @lr-input=${this.stopOwnedEvent}
      @change=${this.stopOwnedEvent}
      @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
        event.stopPropagation();
        this.toggleSelection(document, event.detail.checked);
      }}
    ></lr-checkbox>`;
  }

  private renderNameCell(document: LibraryDocument): TemplateResult {
    return html`<button
      type="button"
      part="document-name"
      @click=${() => this.openDocument(document)}
      ?disabled=${this.sourceBlocked}
    >
      ${normalizeLabel(document.name) ?? document.id}
    </button>`;
  }

  private renderTagsCell(
    document: LibraryDocument
  ): TemplateResult | typeof nothing {
    const tags = document.tags ?? [];
    if (tags.length === 0) return nothing;
    if (this.providerMode) return html`<span>${getListFormat(this.effectiveLocale, { type: 'unit' }).format(tags)}</span>`;
    return html`<lr-chip-group
      >${tags.map((tag) => html`<lr-chip>${tag}</lr-chip>`)}</lr-chip-group
    >`;
  }

  private renderFreshnessCell(
    document: LibraryDocument
  ): TemplateResult | typeof nothing {
    if (!document.freshness) return nothing;
    return html`<lr-chip variant=${FRESHNESS_TONE[document.freshness]}
      >${this.freshnessLabel(document.freshness)}</lr-chip
    >`;
  }

  private renderUpdatedCell(document: LibraryDocument): string {
    const date = this.documentDate(document);
    return date
      ? getDateTimeFormat(this.effectiveLocale, { dateStyle: 'medium' }).format(
          date
        )
      : '';
  }

  private columnsMemo?: { inputs: unknown[]; columns: TableColumn<LibraryDocument>[] };
  private buildColumns(visible: LibraryDocument[], selected: ReadonlySet<string>): TableColumn<LibraryDocument>[] {
    const inputs = [visible, selected, this.effectiveLocale, this.strings,
      lyraLocaleCatalogVersion(this.effectiveLocale), this.explicitRefresh, this.sourceSelectionBlocked];
    if (!this.columnsMemo || inputs.some((input, index) => input !== this.columnsMemo!.inputs[index])) {
      this.columnsMemo = { inputs, columns: this.createColumns(visible, selected) };
    }
    return this.columnsMemo.columns;
  }

  private createColumns(
    visible: LibraryDocument[],
    selected: ReadonlySet<string>
  ): TableColumn<LibraryDocument>[] {
    return [
      {
        key: 'select',
        label: this.localize('documentLibrarySelectColumn'),
        headerCell: () => this.renderSelectAllCheckbox(visible, selected),
        cell: (document) => this.renderRowCheckbox(document, selected),
      },
      {
        key: 'type',
        label: this.localize('documentLibraryTypeColumn'),
        cell: (document) =>
          html`<lr-file-icon
            mime-type=${document.mimeType ?? ''}
            name=${document.name}
            decorative
          ></lr-file-icon>`,
      },
      {
        key: 'name',
        label: this.localize('documentLibraryNameColumn'),
        sortable: true,
        cell: (document) => this.renderNameCell(document),
      },
      {
        key: 'version',
        label: this.localize('documentLibraryVersionColumn'),
        sortable: true,
        priority: 'medium',
        cell: (document) => document.version ?? '',
      },
      {
        key: 'owner',
        label: this.localize('documentLibraryOwnerColumn'),
        sortable: true,
        priority: 'medium',
        cell: (document) => document.owner ?? '',
      },
      {
        key: 'tags',
        label: this.localize('documentLibraryTagsColumn'),
        priority: 'low',
        cell: (document) => this.renderTagsCell(document),
      },
      {
        key: 'freshness',
        label: this.localize('documentLibraryFreshnessColumn'),
        sortable: true,
        priority: 'low',
        cell: (document) => this.renderFreshnessCell(document),
      },
      {
        key: 'updatedAt',
        label: this.localize('documentLibraryUpdatedColumn'),
        sortable: true,
        priority: 'low',
        cell: (document) => this.renderUpdatedCell(document),
      },
    ];
  }

  private tagOptionsMemo?: { tags: string[]; options: TemplateResult[] };
  private renderTagOptions(tags: string[]): TemplateResult[] {
    if (this.tagOptionsMemo?.tags !== tags) this.tagOptionsMemo = {
      tags, options: tags.slice(0, MAX_TAG_FACETS).map(tag => html`<lr-option value=${tag}>${this.sourceMode ? this.sourceFacetLabels.get(tag) ?? tag : tag}</lr-option>`),
    };
    return this.tagOptionsMemo.options;
  }

  override render(): TemplateResult {
    const authoredLabel = hostAriaLabel(this) ?? this.label;
    const label = authoredLabel === '' ? '' : normalizeLabel(authoredLabel) ?? this.localize('documentLibraryLabel');
    const visible = this.cursorMode ? this.cursorRows : this.sourceMode ? this.sourceRows : this.sortedDocuments;
    // A cursor batch owns its composed row DOM, including the table's delegated activation.
    // Legacy routes keep their existing stable table identity; paints retain the accepted batch.
    const tableIdentity = this.cursorMode ? this.cursorAcceptedRows ?? this._cursorSource : undefined;
    const selected = this.selectedIdSet;
    const tags = this.cursorMode ? [] : this.sourceMode ? this.sourceTags : this.allTags;
    const facetTotal = this.sourceMode ? this.sourceResult?.tags?.total ?? 0 : tags.length;
    const emptyHeading = this.cursorMode && !(this.cursorPages.state.initial && this.cursorNavigation.atEnd)
      ? this.localize(this.cursorNavigation.atEnd ? 'documentLibraryCursorEnd' : 'documentLibraryCursorEmptyBatch')
      : (this.providerMode ? !this.searchTerm && this.tagFilter.length === 0 : this._documents.length === 0)
        ? this.localize('documentLibraryEmptyHeading')
        : this.localize('documentLibraryNoMatchesHeading');

    const omittedTags = this.sourceMode ? facetTotal - tags.length : tags.length - MAX_TAG_FACETS;
    return html`
      <div part="base" role="region" aria-label=${label}>
        <div part="toolbar">
          <lr-input
            part="search"
            type="search"
            .size=${this.size ?? 'm'}
            .value=${this.searchTerm}
            placeholder=${this.localize('documentLibrarySearchPlaceholder')}
            aria-label=${this.localize('documentLibrarySearchPlaceholder')}
            @input=${this.stopOwnedEvent}
            @change=${this.stopOwnedEvent}
            @lr-input=${this.onSearchInput}
            @lr-change=${this.stopOwnedEvent}
          ></lr-input>
          ${tags.length > 0 || (this.sourceMode && this.tagFilter.length > 0)
            ? html`<lr-combobox
                part="tag-filter"
                multiple
                .size=${this.size ?? 'm'}
                .value=${this.tagFilter}
                placeholder=${this.localize('documentLibraryFilterByTag')}
                aria-label=${this.localize('documentLibraryFilterByTag')}
                @input=${this.stopOwnedEvent}
                @lr-input=${this.stopOwnedEvent}
                @lr-activate=${this.stopOwnedEvent}
                @change=${this.onTagFilterChange}
                @lr-change=${this.stopOwnedEvent}
                @lr-show=${this.stopOwnedEvent}
                @lr-after-show=${this.stopOwnedEvent}
                @lr-hide=${this.stopOwnedEvent}
                @lr-after-hide=${this.stopOwnedEvent}
                @lr-filter=${this.stopOwnedEvent}
                @lr-clear=${this.stopOwnedEvent}
                @lr-invalid=${this.stopOwnedEvent}
              >
                ${this.renderTagOptions(tags)}
              </lr-combobox>`
            : nothing}
        </div>
        ${!this.providerMode && this.documentsTruncated > 0
          ? html`<p part="limit" role="note">${this.localize('documentLibraryOmitted', undefined, { count: this.documentsTruncated })}</p>` : nothing}
        ${omittedTags > 0
          ? html`<p part="limit" role="note">${this.localize('tagFacetLimit', undefined, {
              count: this.formatLocaleNumber(omittedTags), pluralCount: omittedTags,
            })}</p>` : nothing}
        ${this.selectedDocumentIds.length > 0
          ? html`<div part="selection-bar">
              <span part="selection-count">${this.selectionCountText()}</span>
              <button
                type="button"
                part="clear-selection"
                ?disabled=${this.sourceSelectionBlocked}
                @click=${this.clearSelection}
              >
                ${this.localize('documentLibraryClearSelection')}
              </button>
            </div>`
          : nothing}
        ${this.sourceMode && (this.sourcePages.state.selectionPending || this.sourcePages.state.selectionError) ? html`<p part="selection-status">${this.localize(this.sourcePages.state.selectionPending ? 'sourceSelectionLoading' : 'sourceSelectionFailed')}${this.sourcePages.state.selectionError ? html` <button type="button" part="selection-retry" @click=${() => { this.sourceSelectionInputs = undefined; this.syncSourceSelection(); }}>${this.localize('retry')}</button>` : nothing}</p>` : nothing}
        ${keyed(tableIdentity, html`<lr-table
          part="table"
          exportparts="row, cell, header-cell, document-name, error-row, error-cell, error, error-base, error-icon, error-heading, error-description, error-actions, retry-button"
          aria-label=${label}
          .strings=${this.strings}
          .paginationMode=${this.sourceMode ? 'server' : 'client'}
          .page=${this.sourceMode ? displayedSourcePage(this.sourcePage) : 1}
          .pageSize=${this.providerMode ? normalizeSourcePageSize(this.sourcePageSize) : 100}
          .totalItems=${this.sourceMode ? this.sourceTotal ?? 0 : -1}
          .unknownTotal=${this.sourceMode && this.sourceTotal === null}
          .hasNext=${!this.sourceMode || this.sourceTotal !== null}
          .columns=${this.buildColumns(visible, selected)}
          .rows=${visible}
          .rowKey=${documentKey}
          .selectedRowKeys=${selected}
          selection-mode="multiple"
          .sortKey=${this.sortKey}
          .sortDir=${this.sortDir}
          sort-mode="server"
          ?loading=${this.loading || (this.cursorMode && this.cursorNavigation.status === 'loading') || (this.sourceMode && this.sourcePages.state.pending)}
          empty-heading=${emptyHeading}
          ?error=${this.error || (this.cursorMode && this.cursorNavigation.status === 'error') || (this.sourceMode && !!(this.sourceFailure || this.sourcePages.state.error))}
          error-heading=${this.errorHeading ?? nothing}
          error-description=${this.errorDescription}
          @lr-sort-request=${this.onTableSortRequest}
          @lr-sort=${this.onTableSortCommit}
          @lr-page-change=${this.onSourcePage}
          @lr-priority-columns-visibility-change=${this.stopOwnedEvent}
          @lr-selection-change=${this.onTableSelectionChange}
          @lr-retry-request=${this.onTableRetry}
          @lr-row-activate=${(event: CustomEvent<{ row: LibraryDocument }>) => {
            event.stopPropagation();
            if (this.isCurrentTableEvent(event)) this.openDocument(event.detail.row);
          }}
          @lr-row-click=${this.stopOwnedEvent}
        >${this.hasErrorSlot
          ? html`<div slot="error"><slot name="error"></slot></div>`
          : nothing}</lr-table>`)}
        ${this.cursorMode ? this.renderCursorNavigation() : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-document-library': LyraDocumentLibrary;
  }
}
