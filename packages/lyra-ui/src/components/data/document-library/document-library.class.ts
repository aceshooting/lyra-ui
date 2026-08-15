import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  getDateTimeFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import type { DocumentRef } from '../../../ai/types.js';
import type {
  TableColumn,
  TableSortCommitDetail,
  TableSortDirection,
  TableSortRequestDetail,
} from '../table/table.class.js';
import type { LyraCombobox } from '../../forms/combobox/combobox.class.js';
import {
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { styles } from './document-library.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_documentLibraryClearSelection, LYRA_DEFAULT_documentLibraryEmptyHeading, LYRA_DEFAULT_documentLibraryFilterByTag, LYRA_DEFAULT_documentLibraryFreshnessAging, LYRA_DEFAULT_documentLibraryFreshnessColumn, LYRA_DEFAULT_documentLibraryFreshnessFresh, LYRA_DEFAULT_documentLibraryFreshnessStale, LYRA_DEFAULT_documentLibraryLabel, LYRA_DEFAULT_documentLibraryNameColumn, LYRA_DEFAULT_documentLibraryNoMatchesHeading, LYRA_DEFAULT_documentLibraryOwnerColumn, LYRA_DEFAULT_documentLibrarySearchPlaceholder, LYRA_DEFAULT_documentLibrarySelectAll, LYRA_DEFAULT_documentLibrarySelectColumn, LYRA_DEFAULT_documentLibrarySelectDocument, LYRA_DEFAULT_documentLibrarySelectedCount, LYRA_DEFAULT_documentLibraryTagsColumn, LYRA_DEFAULT_documentLibraryTypeColumn, LYRA_DEFAULT_documentLibraryUpdatedColumn, LYRA_DEFAULT_documentLibraryVersionColumn } from '../../../internal/default-strings.generated.js';
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
}

const FRESHNESS_RANK: Record<LibraryDocumentFreshness, number> = {
  fresh: 0,
  aging: 1,
  stale: 2,
};
const MAX_LIBRARY_COLLECTION_ENTRIES = 10_000;
const FRESHNESS_TONE: Record<
  LibraryDocumentFreshness,
  'success' | 'warning' | 'danger'
> = {
  fresh: 'success',
  aging: 'warning',
  stale: 'danger',
};

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
 * `visibleDocuments` already sorts against real values (timestamps for `updatedAt`, a rank for
 * `freshness`). Client mode would order the rows a second time from `String(cell(row))`, and these
 * `cell()`s render formatted dates and templates — which made the Updated column come out
 * alphabetical by month name rather than chronological. `sortKey`/`sortDir` are still passed
 * down: they drive the header's sort affordance, not the order.
 * Post-mount selection-count changes announce through the document's shared light-DOM polite
 * sink, including zero and repeated equal counts; initial declarative selection stays silent. The
 * visible selection bar remains ordinary, non-live content.
 * Document identity is a unique nonempty `id`: malformed, blank-id, and later duplicate records
 * are omitted at assignment, so the first valid occurrence owns filtering, counts, selection,
 * rows, and open events.
 * Internal search, tag-filter, and checkbox native/prefixed value-event aliases, plus table
 * selection/pagination events, are consumed at their translation boundary; hosts receive only the
 * documented library-level events.
 *
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
 * @csspart base - The root region.
 * @csspart toolbar - Wraps the search field and tag filter.
 * @csspart search - The `<lr-input>` search field.
 * @csspart tag-filter - The `<lr-combobox>` tag facet filter. Only rendered while at least one
 *   document declares a `tags` entry.
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
    documentLibrarySelectedCount: LYRA_DEFAULT_documentLibrarySelectedCount,
    documentLibraryTagsColumn: LYRA_DEFAULT_documentLibraryTagsColumn,
    documentLibraryTypeColumn: LYRA_DEFAULT_documentLibraryTypeColumn,
    documentLibraryUpdatedColumn: LYRA_DEFAULT_documentLibraryUpdatedColumn,
    documentLibraryVersionColumn: LYRA_DEFAULT_documentLibraryVersionColumn,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-filter-change',
    'lr-selection-change',
  ]);

  private _documents: readonly LibraryDocument[] = Object.freeze([]);
  /** Clone-owned readonly inventory, bounded to the first 10,000 source documents and 10,000 tags
   * per document. Document records, nested tag arrays, and dates are snapshotted at assignment
   * time; blank ids and later duplicate ids are omitted first-wins before filters, counts,
   * selection, rows, and events. Reads return detached snapshots so even `Date` mutators cannot
   * reach retained state. Reassign the collection to update. */
  @property({ attribute: false })
  get documents(): readonly LibraryDocument[] {
    return this.snapshotDocuments(this._documents);
  }
  set documents(value: readonly LibraryDocument[]) {
    const previous = this._documents;
    this._documents = this.snapshotDocuments(Array.isArray(value) ? value : []);
    this.requestUpdate('documents', previous);
  }

  /** Bulk-selected document ids. Settable up front (pre-selection) and mutated internally by the
   *  row/select-all checkboxes and "Clear selection" — read it back, or listen for
   *  `lr-selection-change`, to persist the current selection. Automatically pruned of any id no
   *  longer present in `documents` (no event fires for that pruning -- only an actual selection
   *  interaction does, mirroring `<lr-chip-group>`'s identical silent-resync convention for its
   *  own `expanded` state). Assignment snapshots at most 10,000 unique ids; reassign to update. */
  private _selectedDocumentIds: readonly string[] = Object.freeze([]);
  @property({ attribute: false })
  get selectedDocumentIds(): readonly string[] {
    return this._selectedDocumentIds;
  }
  set selectedDocumentIds(value: readonly string[]) {
    const previous = this._selectedDocumentIds;
    this._selectedDocumentIds = this.snapshotIds(Array.isArray(value) ? value : []);
    this.requestUpdate('selectedDocumentIds', previous);
  }

  /** Currently-applied tag facet (`AND` semantics -- a document must carry every listed tag).
   *  Settable up front and mutated internally by the tag filter combobox. Assignment snapshots at
   *  most 10,000 unique tags; reassign to update. */
  private _tagFilter: readonly string[] = Object.freeze([]);
  @property({ attribute: false })
  get tagFilter(): readonly string[] {
    return this._tagFilter;
  }
  set tagFilter(value: readonly string[]) {
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

  /** Controlled search query applied to document names, owners, and tags. */
  @property({ attribute: 'search-term' }) searchTerm = '';

  @property({ type: Boolean, reflect: true }) loading = false;

  /** Accessible name for the region and the inner grid. Defaults to the localized
   *  `documentLibraryLabel`. */
  @property() label = '';

  private announcementSink?: AnnouncementSink;
  private isMounting = true;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncAnnouncementSink();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseAnnouncementSink();
  }

  private releaseAnnouncementSink(): void {
    this.announcementSink?.release();
    this.announcementSink = undefined;
  }

  private syncAnnouncementSink(): void {
    if (!this.isConnected) {
      this.releaseAnnouncementSink();
      return;
    }
    if (this.announcementSink?.element.ownerDocument === this.ownerDocument)
      return;
    this.releaseAnnouncementSink();
    this.announcementSink = acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  private snapshotDocuments(documents: readonly LibraryDocument[]): readonly LibraryDocument[] {
    const snapshot: LibraryDocument[] = [];
    const seen = new Set<string>();
    for (const document of documents.slice(0, MAX_LIBRARY_COLLECTION_ENTRIES)) {
      try {
        const id = document?.id;
        if (typeof id !== 'string' || id.trim().length === 0 || seen.has(id)) continue;
        const updatedAt = document.updatedAt instanceof Date ? new Date(document.updatedAt.getTime()) : document.updatedAt;
        const tags = document.tags === undefined
          ? undefined
          : Object.freeze(document.tags.slice(0, MAX_LIBRARY_COLLECTION_ENTRIES));
        const retained = Object.freeze({ ...document, id, updatedAt, tags });
        seen.add(id);
        snapshot.push(retained);
      } catch {
        // A malformed record cannot reserve its id or suppress a later valid occurrence.
      }
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

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      (changed.has('documents') || changed.has('selectedDocumentIds')) &&
      this.selectedDocumentIds.length > 0
    ) {
      const existing = new Set(this._documents.map((doc) => doc.id));
      const normalized = this.snapshotIds(this.selectedDocumentIds.filter((id) => existing.has(id)));
      if (
        normalized.length !== this.selectedDocumentIds.length ||
        normalized.some((id, index) => id !== this.selectedDocumentIds[index])
      ) {
        this.selectedDocumentIds = normalized;
      }
    }
    if (
      (changed.has('documents') || changed.has('tagFilter')) &&
      this.tagFilter.length > 0
    ) {
      const availableTags = new Set(
        this._documents.flatMap((document) => document.tags ?? [])
      );
      const normalized = this.snapshotIds(this.tagFilter.filter((tag) => availableTags.has(tag)));
      if (
        normalized.length !== this.tagFilter.length ||
        normalized.some((tag, index) => tag !== this.tagFilter[index])
      ) {
        this.tagFilter = normalized;
      }
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (!this.isMounting && changed.has('selectedDocumentIds')) {
      this.announcementSink?.announce(this.selectionCountText());
    }
    this.isMounting = false;
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

  private defaultFilter = (
    document: LibraryDocument,
    query: string
  ): boolean => {
    const locale = this.effectiveLocale;
    const haystack = [
      document.name,
      document.owner ?? '',
      ...(document.tags ?? []),
    ];
    return haystack.some((value) =>
      value.toLocaleLowerCase(locale).includes(query)
    );
  };

  private matchesTagFilter(document: LibraryDocument): boolean {
    if (this.tagFilter.length === 0) return true;
    const tags = new Set(document.tags ?? []);
    return this.tagFilter.every((tag) => tags.has(tag));
  }

  private compareDocuments = (
    a: LibraryDocument,
    b: LibraryDocument
  ): number => {
    const locale = this.effectiveLocale;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    let result = 0;
    switch (this.sortKey) {
      case 'name':
        result = a.name.localeCompare(b.name, locale, { numeric: true });
        break;
      case 'version':
        result = (a.version ?? '').localeCompare(b.version ?? '', locale, {
          numeric: true,
        });
        break;
      case 'owner':
        result = (a.owner ?? '').localeCompare(b.owner ?? '', locale, {
          numeric: true,
        });
        break;
      case 'freshness':
        result =
          (a.freshness ? FRESHNESS_RANK[a.freshness] : 3) -
          (b.freshness ? FRESHNESS_RANK[b.freshness] : 3);
        break;
      case 'updatedAt':
        result =
          (this.normalizeDate(a.updatedAt)?.getTime() ?? 0) -
          (this.normalizeDate(b.updatedAt)?.getTime() ?? 0);
        break;
    }
    return result * dir;
  };

  /** The current search+tag-facet-filtered, sorted view of `documents`. */
  private get visibleDocuments(): LibraryDocument[] {
    const query = this.searchTerm
      .trim()
      .toLocaleLowerCase(this.effectiveLocale);
    const matchFn = this.filter ?? this.defaultFilter;
    const filtered = this._documents.filter(
      (document) =>
        (query === '' || matchFn(document, query)) &&
        this.matchesTagFilter(document)
    );
    return [...filtered].sort(this.compareDocuments);
  }

  /** Every distinct tag across `documents`, sorted for stable combobox ordering. Empty when no
   *  document declares any tag -- the tag-filter combobox itself is only rendered while this is
   *  non-empty. */
  private get allTags(): string[] {
    const tags = new Set<string>();
    for (const document of this._documents)
      for (const tag of document.tags ?? []) tags.add(tag);
    return [...tags].sort((a, b) => a.localeCompare(b, this.effectiveLocale));
  }

  private emitFilterChange(): void {
    const tags = Object.freeze([...this.tagFilter]);
    this.emit(
      'lr-filter-change',
      Object.freeze({ searchTerm: this.searchTerm, tags, matchCount: this.visibleDocuments.length })
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
    this.emit('lr-open', Object.freeze({ documentId: document.id }));
  }

  private setSelected(ids: Iterable<string>): void {
    this.selectedDocumentIds = [...ids];
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

  private renderSelectAllCheckbox(visible: LibraryDocument[]): TemplateResult {
    const allSelected =
      visible.length > 0 &&
      visible.every((document) => this.selectedDocumentIds.includes(document.id));
    const someSelected =
      !allSelected &&
      visible.some((document) => this.selectedDocumentIds.includes(document.id));
    return html`<lr-checkbox
      .checked=${allSelected}
      .indeterminate=${someSelected}
      aria-label=${this.localize('documentLibrarySelectAll')}
      @input=${this.stopOwnedEvent}
      @lr-input=${this.stopOwnedEvent}
      @change=${this.stopOwnedEvent}
      @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
        event.stopPropagation();
        this.toggleSelectAll(event.detail.checked, visible);
      }}
    ></lr-checkbox>`;
  }

  private renderRowCheckbox(document: LibraryDocument): TemplateResult {
    return html`<lr-checkbox
      .checked=${this.selectedDocumentIds.includes(document.id)}
      aria-label=${this.localize('documentLibrarySelectDocument', undefined, {
        name: document.name,
      })}
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
    >
      ${document.name}
    </button>`;
  }

  private renderTagsCell(
    document: LibraryDocument
  ): TemplateResult | typeof nothing {
    const tags = document.tags ?? [];
    if (tags.length === 0) return nothing;
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
    const date = this.normalizeDate(document.updatedAt);
    return date
      ? getDateTimeFormat(this.effectiveLocale, { dateStyle: 'medium' }).format(
          date
        )
      : '';
  }

  private buildColumns(
    visible: LibraryDocument[]
  ): TableColumn<LibraryDocument>[] {
    return [
      {
        key: 'select',
        label: this.localize('documentLibrarySelectColumn'),
        headerCell: () => this.renderSelectAllCheckbox(visible),
        cell: (document) => this.renderRowCheckbox(document),
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

  override render(): TemplateResult {
    const label =
      this.getAttribute('aria-label')?.trim() ||
      this.label ||
      this.localize('documentLibraryLabel');
    const visible = this.visibleDocuments;
    const tags = this.allTags;
    const emptyHeading =
      this._documents.length === 0
        ? this.localize('documentLibraryEmptyHeading')
        : this.localize('documentLibraryNoMatchesHeading');

    return html`
      <div part="base" role="region" aria-label=${label}>
        <div part="toolbar">
          <lr-input
            part="search"
            type="search"
            .value=${this.searchTerm}
            placeholder=${this.localize('documentLibrarySearchPlaceholder')}
            aria-label=${this.localize('documentLibrarySearchPlaceholder')}
            @input=${this.stopOwnedEvent}
            @change=${this.stopOwnedEvent}
            @lr-input=${this.onSearchInput}
            @lr-change=${this.stopOwnedEvent}
          ></lr-input>
          ${tags.length > 0
            ? html`<lr-combobox
                part="tag-filter"
                multiple
                .value=${this.tagFilter}
                placeholder=${this.localize('documentLibraryFilterByTag')}
                aria-label=${this.localize('documentLibraryFilterByTag')}
                @input=${this.stopOwnedEvent}
                @lr-input=${this.stopOwnedEvent}
                @change=${this.onTagFilterChange}
                @lr-change=${this.stopOwnedEvent}
              >
                ${tags.map(
                  (tag) => html`<lr-option value=${tag}>${tag}</lr-option>`
                )}
              </lr-combobox>`
            : nothing}
        </div>
        ${this.selectedDocumentIds.length > 0
          ? html`<div part="selection-bar">
              <span part="selection-count">${this.selectionCountText()}</span>
              <button
                type="button"
                part="clear-selection"
                @click=${this.clearSelection}
              >
                ${this.localize('documentLibraryClearSelection')}
              </button>
            </div>`
          : nothing}
        <lr-table
          part="table"
          exportparts="row, cell, header-cell"
          aria-label=${label}
          .columns=${this.buildColumns(visible)}
          .rows=${visible}
          .rowKey=${(document: LibraryDocument) => document.id}
          .selectedRowKeys=${new Set(this.selectedDocumentIds)}
          selection-mode="multiple"
          .sortKey=${this.sortKey}
          .sortDir=${this.sortDir}
          sort-mode="server"
          ?loading=${this.loading}
          empty-heading=${emptyHeading}
          @lr-sort-request=${this.onTableSortRequest}
          @lr-sort=${this.onTableSortCommit}
          @lr-page-change=${this.stopOwnedEvent}
          @lr-selection-change=${this.onTableSelectionChange}
          @lr-row-click=${(event: CustomEvent<{ row: LibraryDocument }>) => {
            event.stopPropagation();
            this.openDocument(event.detail.row);
          }}
        ></lr-table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-document-library': LyraDocumentLibrary;
  }
}
