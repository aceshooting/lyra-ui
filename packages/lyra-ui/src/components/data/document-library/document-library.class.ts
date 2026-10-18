import type { LyraPageSource, LyraPageResult, LyraSourceRecord } from '../../../data-sources.js';
import { SourcePageController } from '../../../internal/source-page-controller.js';
import { finiteInteger } from '../../../internal/numbers.js';
import { indexByKey } from '../../../internal/keyed-index.js';
import { lyraLocaleCatalogVersion } from '../../../internal/localization-runtime.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { createRetryForwarder } from '../../../internal/retry-forwarder.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import {
  getCollator,
  getDateTimeFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import type { DocumentRef } from '../../../ai/types.js';
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
  normalizeReflectedOptionalSize,
  optionalSizeConverter,
  type LyraSize,
} from '../../../internal/variants.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_documentLibraryClearSelection, LYRA_DEFAULT_documentLibraryEmptyHeading, LYRA_DEFAULT_documentLibraryFilterByTag, LYRA_DEFAULT_documentLibraryFreshnessAging, LYRA_DEFAULT_documentLibraryFreshnessColumn, LYRA_DEFAULT_documentLibraryFreshnessFresh, LYRA_DEFAULT_documentLibraryFreshnessStale, LYRA_DEFAULT_documentLibraryLabel, LYRA_DEFAULT_documentLibraryNameColumn, LYRA_DEFAULT_documentLibraryNoMatchesHeading, LYRA_DEFAULT_documentLibraryOwnerColumn, LYRA_DEFAULT_documentLibrarySearchPlaceholder, LYRA_DEFAULT_documentLibrarySelectAll, LYRA_DEFAULT_documentLibrarySelectColumn, LYRA_DEFAULT_documentLibrarySelectDocument, LYRA_DEFAULT_documentLibrarySelectPage, LYRA_DEFAULT_documentLibrarySelectedCount, LYRA_DEFAULT_documentLibraryTagsColumn, LYRA_DEFAULT_documentLibraryTypeColumn, LYRA_DEFAULT_documentLibraryUpdatedColumn, LYRA_DEFAULT_documentLibraryVersionColumn } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_retry, LYRA_DEFAULT_sourceSelectionFailed, LYRA_DEFAULT_sourceSelectionLoading, LYRA_DEFAULT_tagFacetLimit } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** How recently a document's content was verified/updated, consumer-computed (this component
 *  performs no staleness calculation of its own -- it only renders whichever bucket the host
 *  already assigned). Ordered fresh -> aging -> stale for `freshness`-column sorting. */
export type LibraryDocumentFreshness = 'fresh' | 'aging' | 'stale';

/**
 * One inventory row. Extends the shared `DocumentRef` (`src/ai/types.ts`) -- `id`/`name`/
 * `mimeType`/`uri`/`version` assign directly onto/from it with no adapter -- with the
 * tags/owner/freshness fields specific to an inventory view that the provider-neutral
 * `DocumentRef` deliberately doesn't carry. `updatedAt` reuses
 * `ChatMessage.timestamp`'s own `Date | string` shape from the same `src/ai/types.ts` module for
 * consistency across this component family.
 */
export interface LibraryDocument extends DocumentRef {
  /** Optional tags. An own undefined value is treated like omission. */
  tags?: readonly string[];
  owner?: string;
  /** Last-updated timestamp. `Date | string` (ISO-8601), matching `ChatMessage.timestamp`. */
  updatedAt?: Date | string;
  freshness?: LibraryDocumentFreshness;
}

/** Column keys `sortKey` accepts. Not every column is sortable (`type`/`tags`/`select` are not). */
export type LibraryDocumentSortKey =
  | 'name'
  | 'version'
  | 'owner'
  | 'freshness'
  | 'updatedAt';

/** Full-source document query; tags use AND semantics and filter receives folded search text. */
export interface DocumentLibrarySourceQuery {
  readonly searchTerm: string;
  readonly tagFilter: readonly string[];
  readonly sortKey: LibraryDocumentSortKey;
  readonly sortDir: 'asc' | 'desc';
  readonly filter: LyraDocumentLibrary['filter'];
}
export type DocumentLibrarySource = LyraPageSource<LibraryDocument, DocumentLibrarySourceQuery>;

export interface DocumentLibraryFilterChangeDetail {
  readonly searchTerm: string;
  readonly tags: readonly string[];
  readonly matchCount: number;
}
export interface DocumentLibrarySortRequestDetail {
  readonly phase: 'request';
  readonly sortKey: LibraryDocumentSortKey;
  readonly sortDir: TableSortDirection;
}
export interface DocumentLibrarySortCommitDetail {
  readonly phase: 'commit';
  readonly sortKey: LibraryDocumentSortKey;
  readonly sortDir: TableSortDirection;
}
/** Canonical request/commit sort transaction detail. */
export type DocumentLibrarySortDetail =
  | DocumentLibrarySortRequestDetail
  | DocumentLibrarySortCommitDetail;
export interface DocumentLibrarySelectionChangeDetail {
  readonly documentIds: readonly string[];
}
export interface DocumentLibraryOpenDetail {
  readonly documentId: string;
}

export interface LyraDocumentLibraryEventMap {
  'lr-filter-change': CustomEvent<LyraEventDetailSnapshot<DocumentLibraryFilterChangeDetail>>;
  'lr-sort-request': CustomEvent<DocumentLibrarySortRequestDetail>;
  'lr-sort': CustomEvent<DocumentLibrarySortCommitDetail>;
  'lr-selection-change': CustomEvent<LyraEventDetailSnapshot<DocumentLibrarySelectionChangeDetail>>;
  'lr-open': CustomEvent<DocumentLibraryOpenDetail>;
  /** Cancelable retry proposal. The default action clears the parent and nested table error. */
  'lr-retry-request': CustomEvent<null>;
}

const FRESHNESS_RANK: Record<LibraryDocumentFreshness, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
};
const MAX_LIBRARY_COLLECTION_ENTRIES = 10_000;
const MAX_TAG_FACETS = 500;
const documentKey = (document: LibraryDocument): string => document.id;
const INVALID_DOCUMENT_DATE = Symbol('invalid-document-date');
const FRESHNESS_TONE: Record<
  LibraryDocumentFreshness,
  'success' | 'warning' | 'danger'
> = {
  fresh: 'success',
  aging: 'warning',
  stale: 'danger',
};

function projectLibraryStringArray(value: unknown): readonly string[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const length = getOwnDataDescriptor(value, 'length');
    if (
      length === MISSING_OWN_DATA_DESCRIPTOR ||
      length === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof length.value !== 'number' ||
      !Number.isSafeInteger(length.value) ||
      length.value < 0
    )
      return undefined;
    const tags: string[] = [];
    for (let index = 0; index < Math.min(length.value, MAX_LIBRARY_COLLECTION_ENTRIES); index += 1) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (
        entry === MISSING_OWN_DATA_DESCRIPTOR ||
        entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof entry.value !== 'string'
      )
        return undefined;
      tags.push(entry.value);
    }
    return Object.freeze(tags);
  } catch {
    return undefined;
  }
}

function projectLibraryDate(value: unknown): Date | string | typeof INVALID_DOCUMENT_DATE {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value);
  try {
    return new Date(Date.prototype.getTime.call(value));
  } catch {
    return INVALID_DOCUMENT_DATE;
  }
}

function projectLibraryDocument(candidate: unknown): LibraryDocument | undefined {
  try {
    if (
      candidate === null ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    )
      return undefined;
    const id = getOwnDataDescriptor(candidate, 'id');
    const name = getOwnDataDescriptor(candidate, 'name');
    const mimeType = getOwnDataDescriptor(candidate, 'mimeType');
    const uri = getOwnDataDescriptor(candidate, 'uri');
    const version = getOwnDataDescriptor(candidate, 'version');
    const tags = getOwnDataDescriptor(candidate, 'tags');
    const owner = getOwnDataDescriptor(candidate, 'owner');
    const updatedAt = getOwnDataDescriptor(candidate, 'updatedAt');
    const freshness = getOwnDataDescriptor(candidate, 'freshness');
    if (
      id === MISSING_OWN_DATA_DESCRIPTOR ||
      id === UNSAFE_OWN_DATA_DESCRIPTOR ||
      name === MISSING_OWN_DATA_DESCRIPTOR ||
      name === UNSAFE_OWN_DATA_DESCRIPTOR ||
      mimeType === UNSAFE_OWN_DATA_DESCRIPTOR ||
      uri === UNSAFE_OWN_DATA_DESCRIPTOR ||
      version === UNSAFE_OWN_DATA_DESCRIPTOR ||
      tags === UNSAFE_OWN_DATA_DESCRIPTOR ||
      owner === UNSAFE_OWN_DATA_DESCRIPTOR ||
      updatedAt === UNSAFE_OWN_DATA_DESCRIPTOR ||
      freshness === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof id.value !== 'string' ||
      id.value.trim().length === 0 ||
      typeof name.value !== 'string'
    )
      return undefined;

    const mimeTypeValue = mimeType === MISSING_OWN_DATA_DESCRIPTOR ? undefined : mimeType.value;
    const uriValue = uri === MISSING_OWN_DATA_DESCRIPTOR ? undefined : uri.value;
    const versionValue = version === MISSING_OWN_DATA_DESCRIPTOR ? undefined : version.value;
    const ownerValue = owner === MISSING_OWN_DATA_DESCRIPTOR ? undefined : owner.value;
    const freshnessValue = freshness === MISSING_OWN_DATA_DESCRIPTOR ? undefined : freshness.value;
    if (
      (mimeTypeValue !== undefined && typeof mimeTypeValue !== 'string') ||
      (uriValue !== undefined && typeof uriValue !== 'string') ||
      (versionValue !== undefined && typeof versionValue !== 'string') ||
      (ownerValue !== undefined && typeof ownerValue !== 'string') ||
      (freshnessValue !== undefined &&
        freshnessValue !== 'fresh' &&
        freshnessValue !== 'aging' &&
        freshnessValue !== 'stale')
    )
      return undefined;

    const tagsValue = tags === MISSING_OWN_DATA_DESCRIPTOR ? undefined : tags.value;
    const tagValues = tagsValue === undefined ? undefined : projectLibraryStringArray(tagsValue);
    if (tagsValue !== undefined && !tagValues) return undefined;
    const updatedAtValue = updatedAt === MISSING_OWN_DATA_DESCRIPTOR || updatedAt.value === undefined
      ? undefined
      : projectLibraryDate(updatedAt.value);
    if (updatedAtValue === INVALID_DOCUMENT_DATE) return undefined;

    return Object.freeze({
      id: id.value,
      name: name.value,
      ...(mimeTypeValue === undefined ? {} : { mimeType: mimeTypeValue }),
      ...(uriValue === undefined ? {} : { uri: uriValue }),
      ...(versionValue === undefined ? {} : { version: versionValue }),
      ...(tagValues === undefined ? {} : { tags: tagValues }),
      ...(ownerValue === undefined ? {} : { owner: ownerValue }),
      ...(updatedAtValue === undefined ? {} : { updatedAt: updatedAtValue }),
      ...(freshnessValue === undefined ? {} : { freshness: freshnessValue }),
    });
  } catch {
    return undefined;
  }
}

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
 *   `detail: { documentIds: readonly string[] }`. Translated checkbox
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
    documentLibraryEmptyHeading: LYRA_DEFAULT_documentLibraryEmptyHeading,
    documentLibraryFilterByTag: LYRA_DEFAULT_documentLibraryFilterByTag,
    documentLibraryFreshnessAging: LYRA_DEFAULT_documentLibraryFreshnessAging,
    documentLibraryFreshnessColumn: LYRA_DEFAULT_documentLibraryFreshnessColumn,
    documentLibraryFreshnessFresh: LYRA_DEFAULT_documentLibraryFreshnessFresh,
    documentLibraryFreshnessStale: LYRA_DEFAULT_documentLibraryFreshnessStale,
    documentLibraryLabel: LYRA_DEFAULT_documentLibraryLabel,
    documentLibraryNameColumn: LYRA_DEFAULT_documentLibraryNameColumn,
    documentLibraryNoMatchesHeading: LYRA_DEFAULT_documentLibraryNoMatchesHeading,
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
    retry: LYRA_DEFAULT_retry,
    sourceSelectionFailed: LYRA_DEFAULT_sourceSelectionFailed,
    sourceSelectionLoading: LYRA_DEFAULT_sourceSelectionLoading,
    tagFacetLimit: LYRA_DEFAULT_tagFacetLimit,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = eventCollectionSupport;
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-filter-change',
    'lr-selection-change',
  ]);

  @state() private sourceStateVersion = 0;
  private _dataSource?: DocumentLibrarySource;
  private sourceEpoch = 0;
  private sourceSyncing = false;
  private sourceInputs?: readonly unknown[];
  private sourceQueryInputs?: readonly unknown[];
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
  @property({ type: Number, attribute: 'source-page' }) sourcePage = 0;
  /** Provider rows per page, normalized to 1..500. */
  @property({ type: Number, attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact current-query total, or null while pending, invalid or outside provider mode. */
  get sourceTotal(): number | null { return this.dataSource === undefined ? null : this.sourcePages.state.result?.total ?? null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }
  private get sourceBlocked(): boolean { return this.sourceMode && (this.loading || this.error || this.sourcePages.state.pending || !!this.sourcePages.state.error || !!this.sourceFailure); }
  private get sourceSelectionBlocked(): boolean { return this.sourceBlocked || (this.sourceMode && (this.sourcePages.state.selectionPending || !!this.sourcePages.state.selectionError)); }

  private projectSourceDocument(record: LyraSourceRecord<unknown>, isCurrent: () => boolean): LyraSourceRecord<LibraryDocument> {
    const assertCurrent = (): void => { if (!isCurrent()) throw new TypeError('Obsolete source record'); };
    const descriptorOf = (target: object, key: PropertyKey) => {
      assertCurrent();
      const descriptor = getOwnDataDescriptor(target, key);
      assertCurrent();
      return descriptor;
    };
    assertCurrent();
    if (record.value === null || typeof record.value !== 'object' || Array.isArray(record.value)) throw new TypeError('Invalid source document');
    const snapshot: Record<string, unknown> = {};
    for (const key of ['id', 'name', 'mimeType', 'uri', 'version', 'tags', 'owner', 'updatedAt', 'freshness']) {
      const descriptor = descriptorOf(record.value, key);
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
    if (!value || value.id !== record.key || (value.tags?.length ?? 0) > MAX_TAG_FACETS) throw new TypeError('Invalid source document');
    let units = 0;
    for (const text of [value.id, value.name, value.owner, value.mimeType, value.uri, value.version,
      typeof value.updatedAt === 'string' ? value.updatedAt : undefined, ...(value.tags ?? [])]) {
      if (text !== undefined) { units += text.length; if (text.length > 65_536 || units > 65_536) throw new RangeError('Source document too large'); }
    }
    assertCurrent();
    return { key: record.key, order: record.order, value };
  }

  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) this.sourcePages.bind(undefined);
        this.sourceInputs = undefined; this.sourceQueryInputs = undefined; this.sourceSelectionInputs = undefined;
        this.sourceSelectionEvent = undefined; this.sourceFilterEvent = false;
        this.sourceResult = undefined; this.sourceRows = []; this.sourceTags = []; this.sourceFailure = undefined;
        return;
      }
      const source = this.dataSource!;
      const epoch = this.sourceEpoch + this.explicitRefresh;
      const size = finiteInteger(this.sourcePageSize, 100, 1, 500);
      let page = finiteInteger(this.sourcePage, 0, 0, Math.floor(Number.MAX_SAFE_INTEGER / size));
      const queryInputs = [this.searchTerm, this.tagFilter, this.sortKey, this.sortDir, this.filter, size];
      if (this.sourceQueryInputs && queryInputs.some((value, index) => value !== this.sourceQueryInputs![index])) {
        page = 0; this.sourcePage = 0;
      }
      this.sourceQueryInputs = queryInputs;
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
    void this.sourcePages.resolveSelection(ids).then(records => {
      if (!records || lifecycle !== this.sourceLifecycleVersion || !this.isConnected || this.ownerDocument !== owner || this.dataSource !== source || epoch !== this.sourceEpoch + this.explicitRefresh || this._selectedDocumentIds !== ids) return;
      const retained = new Set(records.map(record => record.key));
      const accepted = Object.freeze(ids.filter(id => retained.has(id)));
      if (accepted.length !== ids.length) { this._selectedDocumentIds = accepted; this.selectionSource = accepted; this.sourceSelectionInputs = undefined; }
      if (this.sourceSelectionEvent === ids) {
        this.sourceSelectionEvent = undefined;
        this.announcements.announcePolite(this.selectionCountText());
        this.emit('lr-selection-change', Object.freeze({ documentIds: Object.freeze([...this._selectedDocumentIds]) }));
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
      this.emit('lr-filter-change', Object.freeze({ searchTerm: this.searchTerm, tags: Object.freeze([...this.tagFilter]), matchCount: result.total }));
    }
  }

  private onSourcePage = (event: CustomEvent<{ page: number }>): void => {
    event.stopPropagation();
    if (this.sourceMode) this.sourcePage = event.detail.page - 1;
  };

  private _documents: readonly LibraryDocument[] = Object.freeze([]);
  /** Clone-owned readonly inventory, bounded to the first 10,000 source documents and 10,000 tags
   * per document. Document records, nested tag arrays, and dates are snapshotted at assignment
   * time; records without a string name or with non-string tag entries, blank ids, and later
   * duplicate ids are omitted first-wins before filters, counts, selection, rows, and events. Reads
   * return one stable detached snapshot per assignment, so even `Date` mutators cannot reach
   * retained state. Reassign a new collection to update. */
  @property({ attribute: false })
  get documents(): readonly LibraryDocument[] {
    return (this.documentsView ??= this.snapshotDocuments(this._documents));
  }
  set documents(value: readonly LibraryDocument[]) {
    if (value === this.documentsSource || value === this.documentsView) return;
    this.documentsSource = value;
    const previous = this._documents;
    this._documents = this.snapshotDocuments(value);
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
  @property({ attribute: false })
  get selectedDocumentIds(): readonly string[] {
    return this._selectedDocumentIds;
  }
  set selectedDocumentIds(value: readonly string[]) {
    if (value === this.selectionSource || value === this._selectedDocumentIds) return;
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
  @property({ attribute: false })
  get tagFilter(): readonly string[] {
    return this._tagFilter;
  }
  set tagFilter(value: readonly string[]) {
    if (value === this.tagFilterSource || value === this._tagFilter) return;
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
  private onTableRetry = createRetryForwarder(
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
    const normalized = normalizeReflectedOptionalSize(this, next);
    const old = this._size;
    if (old === normalized) return;
    this._size = normalized;
    this.requestUpdate('size', old);
  }

  /** Accessible name for the region and the inner grid. Defaults to the localized
   *  `documentLibraryLabel` when unset. An explicitly empty string renders as an empty label
   *  rather than falling back. */
  @property() label?: string;

  private readonly announcements = new AnnouncementSinkController(this, { eager: ['polite'] });

  override connectedCallback(): void {
    super.connectedCallback();
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
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    this.invalidateSourceSelection();
    super.adoptedCallback();
    this.announcements.adopted();
    this.sourcePages.adopted();
  }

  private sourceAnnouncementInitialized = false;
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const status = this.sourceMode && this.sourcePages.state.selectionError ? this.localize('sourceSelectionFailed')
      : this.sourceMode && this.sourcePages.state.selectionPending ? this.localize('sourceSelectionLoading') : '';
    if (this.sourceAnnouncementInitialized && status && status !== this.sourceSelectionAnnouncement) this.announcements.announcePolite(status);
    this.sourceAnnouncementInitialized = true; this.sourceSelectionAnnouncement = status;
  }

  private snapshotDocuments(documents: unknown): readonly LibraryDocument[] {
    const snapshot: LibraryDocument[] = [];
    const seen = new Set<string>();
    try {
      if (!Array.isArray(documents)) return Object.freeze(snapshot);
      const length = getOwnDataDescriptor(documents, 'length');
      if (
        length === MISSING_OWN_DATA_DESCRIPTOR ||
        length === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof length.value !== 'number' ||
        !Number.isSafeInteger(length.value) ||
        length.value < 0
      )
        return Object.freeze(snapshot);
      for (let index = 0; index < Math.min(length.value, MAX_LIBRARY_COLLECTION_ENTRIES); index += 1) {
        const entry = getOwnDataDescriptor(documents, String(index));
        if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
        const document = projectLibraryDocument(entry.value);
        if (!document || seen.has(document.id)) continue;
        seen.add(document.id);
        snapshot.push(document);
      }
    } catch {
      // A malformed record cannot reserve its id or suppress a later valid occurrence.
    }
    return Object.freeze(snapshot);
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
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize', 'searchTerm', 'tagFilter', 'sortKey', 'sortDir', 'filter'].includes(String(args[0]))) this.syncSource();
    if (args[0] === 'selectedDocumentIds') this.syncSourceSelection();
    super.requestUpdate(...args);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncSource();
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
      count: getNumberFormat(this.effectiveLocale).format(
        this.selectedDocumentIds.length
      ),
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
        [row.name, row.owner ?? '', ...(row.tags ?? [])].map(value => value.toLocaleLowerCase(locale)));
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

  private sortCollator?: Intl.Collator;
  private compareDocuments = (
    a: LibraryDocument,
    b: LibraryDocument
  ): number => {
    const collator = this.sortCollator!;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    let result = 0;
    switch (this.sortKey) {
      case 'name':
        result = collator.compare(a.name, b.name);
        break;
      case 'version':
        result = collator.compare(a.version ?? '', b.version ?? '');
        break;
      case 'owner':
        result = collator.compare(a.owner ?? '', b.owner ?? '');
        break;
      case 'freshness':
        result =
          (a.freshness ? FRESHNESS_RANK[a.freshness] : 3) -
          (b.freshness ? FRESHNESS_RANK[b.freshness] : 3);
        break;
      case 'updatedAt':
        result =
          (this.documentDate(a)?.getTime() ?? 0) -
          (this.documentDate(b)?.getTime() ?? 0);
        break;
    }
    return result * dir;
  };

  private matchingMemo?: { inputs: unknown[]; rows: LibraryDocument[] };
  /** The current search+tag-facet-filtered view, in input order. */
  private get matchingDocuments(): LibraryDocument[] {
    const query = (this.searchTerm ?? '').trim().toLocaleLowerCase(this.effectiveLocale);
    const inputs = [this._documents, query, this.tagFilter, this.filter, this.effectiveLocale,
      this.filter ? this.explicitRefresh : 0];
    if (!this.matchingMemo || inputs.some((input, index) => input !== this.matchingMemo!.inputs[index])) {
      const matchFn = this.filter ?? this.defaultFilter;
      const rows = this._documents.filter(document =>
        (query === '' || matchFn(document, query)) && this.matchesTagFilter(document));
      this.matchingMemo = { inputs, rows };
    }
    return this.matchingMemo.rows;
  }

  private sortedMemo?: { rows: LibraryDocument[]; key: LibraryDocumentSortKey; dir: TableSortDirection; locale: string; sorted: LibraryDocument[] };
  private get sortedDocuments(): LibraryDocument[] {
    const rows = this.matchingDocuments;
    const locale = this.effectiveLocale;
    const previous = this.sortedMemo;
    if (previous?.rows === rows && previous.key === this.sortKey && previous.dir === this.sortDir && previous.locale === locale) return previous.sorted;
    this.sortCollator = getCollator(locale, { numeric: true });
    if (this.sortKey === 'updatedAt') for (const row of rows) this.documentDate(row);
    const sorted = [...rows].sort(this.compareDocuments);
    this.sortedMemo = { rows, key: this.sortKey, dir: this.sortDir, locale, sorted };
    return sorted;
  }

  /** Every distinct tag across `documents`, sorted for stable combobox ordering. Empty when no
   *  document declares any tag -- the tag-filter combobox itself is only rendered while this is
   *  non-empty. */
  private tagsMemo?: { documents: readonly LibraryDocument[]; locale: string; tags: string[]; set: ReadonlySet<string> };
  private get allTags(): string[] {
    const locale = this.effectiveLocale;
    if (this.tagsMemo?.documents === this._documents && this.tagsMemo.locale === locale) return this.tagsMemo.tags;
    const tags = new Set<string>();
    for (const document of this._documents)
      for (const tag of document.tags ?? []) tags.add(tag);
    const sorted = [...tags].sort(getCollator(locale).compare);
    this.tagsMemo = { documents: this._documents, locale, tags: sorted, set: tags };
    return sorted;
  }

  private get tagSet(): ReadonlySet<string> {
    void this.allTags;
    return this.tagsMemo!.set;
  }

  private selectedMemo?: { ids: readonly string[]; set: ReadonlySet<string> };
  /** The selection as a Set, rebuilt only when `selectedDocumentIds` is replaced. */
  private get selectedIdSet(): ReadonlySet<string> {
    if (this.selectedMemo?.ids !== this._selectedDocumentIds) {
      this.selectedMemo = { ids: this._selectedDocumentIds, set: new Set(this._selectedDocumentIds) };
    }
    return this.selectedMemo.set;
  }

  private emitFilterChange(): void {
    if (this.sourceMode) { this.sourceFilterEvent = true; return; }
    const tags = Object.freeze([...this.tagFilter]);
    this.emit(
      'lr-filter-change',
      Object.freeze({ searchTerm: this.searchTerm, tags, matchCount: this.matchingDocuments.length })
    );
  }

  private onSearchInput = (event: CustomEvent<{ value: string }>): void => {
    event.stopPropagation();
    this.searchTerm = event.detail.value;
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
    if (!this.isSortKey(event.detail.sortKey)) {
      event.preventDefault();
      return;
    }
    const detail = Object.freeze({
      phase: 'request',
      sortKey: event.detail.sortKey,
      sortDir: event.detail.sortDir,
    } as const);
    if (this.emit('lr-sort-request', detail, { cancelable: true }).defaultPrevented) event.preventDefault();
  };

  private onTableSortCommit = (event: CustomEvent<TableSortCommitDetail>): void => {
    event.stopPropagation();
    if (!this.isSortKey(event.detail.sortKey)) return;
    this.sortKey = event.detail.sortKey;
    this.sortDir = event.detail.sortDir;
    this.emit(
      'lr-sort',
      Object.freeze({ phase: 'commit', sortKey: this.sortKey, sortDir: this.sortDir } as const)
    );
  };

  private stopOwnedEvent = (event: Event): void => {
    event.stopPropagation();
  };

  /** Row activation opens a document; checkbox controls own selection. Keep the composed table in
   * multiple-selection semantics for truthful `aria-selected`, but contain and roll back its
   * click-anywhere selection behavior at this wrapper boundary. */
  private onTableSelectionChange = (event: CustomEvent): void => {
    event.stopPropagation();
    const table = event.currentTarget as HTMLElement & {
      selectedRowKeys: ReadonlySet<string | number>;
    };
    table.selectedRowKeys = new Set(this.selectedDocumentIds);
  };

  private openDocument(document: LibraryDocument): void {
    if (this.sourceBlocked || (this.sourceMode && !this.sourceRows.includes(document))) return;
    this.emit('lr-open', Object.freeze({ documentId: document.id }));
  }

  private setSelected(ids: Iterable<string>): void {
    if (this.sourceSelectionBlocked) return;
    this.selectedDocumentIds = [...ids];
    if (this.sourceMode) { this.sourceSelectionEvent = this._selectedDocumentIds; return; }
    this.announcements.announcePolite(this.selectionCountText());
    const eventIds = Object.freeze([...this.selectedDocumentIds]);
    this.emit('lr-selection-change', Object.freeze({ documentIds: eventIds }));
  }

  private toggleSelection(document: LibraryDocument, checked: boolean): void {
    const next = new Set(this.selectedDocumentIds);
    if (checked) next.add(document.id);
    else next.delete(document.id);
    this.setSelected(next);
  }

  private toggleSelectAll(checked: boolean, visible: LibraryDocument[]): void {
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
      aria-label=${this.localize(this.sourceMode ? 'documentLibrarySelectPage' : 'documentLibrarySelectAll')}
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
        name: document.name,
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
      ${document.name}
    </button>`;
  }

  private renderTagsCell(
    document: LibraryDocument
  ): TemplateResult | typeof nothing {
    const tags = document.tags ?? [];
    if (tags.length === 0) return nothing;
    if (this.sourceMode) return html`<span>${tags.join(', ')}</span>`;
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
    const label =
      hostAriaLabel(this)?.trim() ??
      (this.label == null ? this.localize('documentLibraryLabel') : this.label);
    const visible = this.sourceMode ? this.sourceRows : this.sortedDocuments;
    const selected = this.selectedIdSet;
    const tags = this.sourceMode ? this.sourceTags : this.allTags;
    const facetTotal = this.sourceMode ? this.sourceResult?.tags?.total ?? 0 : tags.length;
    const emptyHeading =
      (this.sourceMode ? !this.searchTerm && this.tagFilter.length === 0 : this._documents.length === 0)
        ? this.localize('documentLibraryEmptyHeading')
        : this.localize('documentLibraryNoMatchesHeading');

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
        ${(this.sourceMode ? facetTotal > tags.length : tags.length > MAX_TAG_FACETS)
          ? html`<p part="limit" role="note">${this.localize('tagFacetLimit', undefined, {
              count: getNumberFormat(this.effectiveLocale).format(this.sourceMode ? facetTotal - tags.length : tags.length - MAX_TAG_FACETS),
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
        <lr-table
          part="table"
          exportparts="row, cell, header-cell, document-name, error-row, error-cell, error, error-base, error-icon, error-heading, error-description, error-actions, retry-button"
          aria-label=${label}
          .strings=${this.strings}
          .paginationMode=${this.sourceMode ? 'server' : 'client'}
          .page=${this.sourceMode ? finiteInteger(this.sourcePage, 0, 0, Number.MAX_SAFE_INTEGER) + 1 : 1}
          .pageSize=${this.sourceMode ? finiteInteger(this.sourcePageSize, 100, 1, 500) : 100}
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
          ?loading=${this.loading || (this.sourceMode && this.sourcePages.state.pending)}
          empty-heading=${emptyHeading}
          ?error=${this.error || (this.sourceMode && !!(this.sourceFailure || this.sourcePages.state.error))}
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
            this.openDocument(event.detail.row);
          }}
          @lr-row-click=${this.stopOwnedEvent}
        >${this.hasErrorSlot
          ? html`<div slot="error"><slot name="error"></slot></div>`
          : nothing}</lr-table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-document-library': LyraDocumentLibrary;
  }
}
