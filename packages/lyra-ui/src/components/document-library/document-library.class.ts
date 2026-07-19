import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { getDateTimeFormat } from '../../internal/intl-cache.js';
import type { DocumentRef } from '../../ai/types.js';
import type { TableColumn } from '../table/table.class.js';
import type { LyraCombobox } from '../combobox/combobox.class.js';
import '../table/table.js';
import '../checkbox/checkbox.js';
import '../chip/chip.js';
import '../chip/chip-group.js';
import '../file-icon/file-icon.js';
import '../input/input.js';
import '../combobox/combobox.js';
import { styles } from './document-library.styles.js';

/** How recently a document's content was verified/updated, consumer-computed (this component
 *  performs no staleness calculation of its own -- it only renders whichever bucket the host
 *  already assigned). Ordered fresh -> aging -> stale for `freshness`-column sorting. */
export type LibraryDocumentFreshness = 'fresh' | 'aging' | 'stale';

/**
 * One inventory row. Extends the shared `DocumentRef` (`src/ai/types.ts`) -- `id`/`name`/
 * `mimeType`/`uri`/`version` assign directly onto/from it with no adapter -- with the
 * version/tags/owner/freshness fields the roadmap's document-library surface needs that the
 * provider-neutral `DocumentRef` deliberately doesn't carry (those concepts are specific to an
 * inventory view, not to "a reference to a document" in general). `updatedAt` reuses
 * `ChatMessage.timestamp`'s own `Date | string` shape from the same `src/ai/types.ts` module for
 * consistency across this component family.
 */
export interface LibraryDocument extends DocumentRef {
  tags?: string[];
  owner?: string;
  /** Last-updated timestamp. `Date | string` (ISO-8601), matching `ChatMessage.timestamp`. */
  updatedAt?: Date | string;
  freshness?: LibraryDocumentFreshness;
}

/** Column keys `sortKey` accepts. Not every column is sortable (`type`/`tags`/`select` are not). */
export type LibraryDocumentSortKey = 'name' | 'version' | 'owner' | 'freshness' | 'updatedAt';

export interface DocumentLibraryFilterChangeDetail {
  text: string;
  tags: string[];
  matchCount: number;
}
export interface DocumentLibrarySortDetail {
  key: LibraryDocumentSortKey;
  direction: 'ascending' | 'descending';
}
export interface DocumentLibrarySelectionChangeDetail {
  ids: string[];
}
export interface DocumentLibraryOpenDetail {
  id: string;
}

export interface LyraDocumentLibraryEventMap {
  'lr-filter-change': CustomEvent<DocumentLibraryFilterChangeDetail>;
  'lr-sort': CustomEvent<DocumentLibrarySortDetail>;
  'lr-selection-change': CustomEvent<DocumentLibrarySelectionChangeDetail>;
  'lr-open': CustomEvent<DocumentLibraryOpenDetail>;
}

const FRESHNESS_RANK: Record<LibraryDocumentFreshness, number> = { fresh: 0, aging: 1, stale: 2 };
const FRESHNESS_TONE: Record<LibraryDocumentFreshness, 'success' | 'warning' | 'danger'> = {
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
 * Composes `<lr-table>` (not `<lr-data-grid>`) for the inventory grid itself: `<lr-data-grid>`
 * only supports a single `selectedKey` and stringifies every cell value (`String(value)`), so it
 * cannot host the checkbox/chip/icon content bulk selection, tags, and per-row type icons need.
 * `<lr-table>` supports arbitrary `cell()`/`headerCell()` content and `priority`-driven responsive
 * column hiding, which this component relies on for its 320px-allocation behavior. Search
 * (`<lr-input type="search">`) and the tag facet (`<lr-combobox multiple>`) are both self-managed
 * (client-side filtering against `documents`, like `<lr-thread-list>`'s own `searchable` field) —
 * override matching entirely via `filter`. Row selection uses `<lr-checkbox>` per cell rather than
 * `<lr-table>`'s own built-in `selectionMode`, since that mode's click-anywhere-in-the-row toggle
 * would conflict with the row's own name button opening the document; `<lr-table>`'s
 * `selectedKeys` is still fed from `selectedIds` purely for its `aria-selected` row styling.
 *
 * @customElement lr-document-library
 * @event lr-filter-change - The search text or tag facet changed. `detail: { text, tags, matchCount }`.
 * @event lr-sort - A sortable column header was activated. `detail: { key, direction }`.
 * @event lr-selection-change - The bulk selection changed (a row checkbox, the header
 *   select-all checkbox, or "Clear selection"). `detail: { ids }`.
 * @event lr-open - A document was activated (its name, or Enter/Space/click elsewhere on its
 *   row). `detail: { id }`.
 * @csspart base - The root region.
 * @csspart toolbar - Wraps the search field and tag filter.
 * @csspart search - The `<lr-input>` search field.
 * @csspart tag-filter - The `<lr-combobox>` tag facet filter. Only rendered while at least one
 *   document declares a `tags` entry.
 * @csspart selection-bar - The "N selected" / "Clear selection" bar. Only rendered while
 *   `selectedIds` is non-empty.
 * @csspart selection-count - The selected-count text inside `selection-bar`.
 * @csspart clear-selection - The "Clear selection" button inside `selection-bar`.
 * @csspart table - The `<lr-table>` inventory grid.
 * @csspart document-name - Each row's clickable document-name button.
 * @csspart row - Exported from `<lr-table>`'s own `row` part.
 * @csspart cell - Exported from `<lr-table>`'s own `cell` part.
 * @csspart header-cell - Exported from `<lr-table>`'s own `header-cell` part.
 */
export class LyraDocumentLibrary extends LyraElement<LyraDocumentLibraryEventMap> {
  static styles = [LyraElement.styles, styles];

  /** The full, unfiltered/unsorted inventory. */
  @property({ attribute: false }) documents: LibraryDocument[] = [];

  /** Bulk-selected document ids. Settable up front (pre-selection) and mutated internally by the
   *  row/select-all checkboxes and "Clear selection" — read it back, or listen for
   *  `lr-selection-change`, to persist the current selection. Automatically pruned of any id no
   *  longer present in `documents` (no event fires for that pruning -- only an actual selection
   *  interaction does, mirroring `<lr-chip-group>`'s identical silent-resync convention for its
   *  own `expanded` state). */
  @property({ attribute: false }) selectedIds: string[] = [];

  /** Currently-applied tag facet (`AND` semantics -- a document must carry every listed tag).
   *  Settable up front and mutated internally by the tag filter combobox. */
  @property({ attribute: false }) tagFilter: string[] = [];

  /** Overrides the default case-insensitive name/owner/tag substring match. Receives the already
   *  trimmed, lowercased search text, mirroring `<lr-thread-list>`'s identical `filter` contract. */
  @property({ attribute: false }) filter?: (document: LibraryDocument, query: string) => boolean;

  @property({ attribute: 'sort-key' }) sortKey: LibraryDocumentSortKey = 'name';
  @property({ attribute: 'sort-direction' }) sortDirection: 'ascending' | 'descending' = 'ascending';

  @property({ type: Boolean, reflect: true }) loading = false;

  /** Accessible name for the region and the inner grid. Defaults to the localized
   *  `documentLibraryLabel`. */
  @property() label = '';

  @state() private searchText = '';

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('documents') && this.selectedIds.length > 0) {
      const existing = new Set(this.documents.map((doc) => doc.id));
      const pruned = this.selectedIds.filter((id) => existing.has(id));
      if (pruned.length !== this.selectedIds.length) this.selectedIds = pruned;
    }
  }

  private normalizeDate(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private defaultFilter = (document: LibraryDocument, query: string): boolean => {
    const locale = this.effectiveLocale;
    const haystack = [document.name, document.owner ?? '', ...(document.tags ?? [])];
    return haystack.some((value) => value.toLocaleLowerCase(locale).includes(query));
  };

  private matchesTagFilter(document: LibraryDocument): boolean {
    if (this.tagFilter.length === 0) return true;
    const tags = new Set(document.tags ?? []);
    return this.tagFilter.every((tag) => tags.has(tag));
  }

  private compareDocuments = (a: LibraryDocument, b: LibraryDocument): number => {
    const locale = this.effectiveLocale;
    const dir = this.sortDirection === 'ascending' ? 1 : -1;
    let result = 0;
    switch (this.sortKey) {
      case 'name':
        result = a.name.localeCompare(b.name, locale, { numeric: true });
        break;
      case 'version':
        result = (a.version ?? '').localeCompare(b.version ?? '', locale, { numeric: true });
        break;
      case 'owner':
        result = (a.owner ?? '').localeCompare(b.owner ?? '', locale, { numeric: true });
        break;
      case 'freshness':
        result =
          (a.freshness ? FRESHNESS_RANK[a.freshness] : 3) - (b.freshness ? FRESHNESS_RANK[b.freshness] : 3);
        break;
      case 'updatedAt':
        result = (this.normalizeDate(a.updatedAt)?.getTime() ?? 0) - (this.normalizeDate(b.updatedAt)?.getTime() ?? 0);
        break;
    }
    return result * dir;
  };

  /** The current search+tag-facet-filtered, sorted view of `documents`. */
  private get visibleDocuments(): LibraryDocument[] {
    const query = this.searchText.trim().toLocaleLowerCase(this.effectiveLocale);
    const matchFn = this.filter ?? this.defaultFilter;
    const filtered = this.documents.filter(
      (document) => (query === '' || matchFn(document, query)) && this.matchesTagFilter(document),
    );
    return [...filtered].sort(this.compareDocuments);
  }

  /** Every distinct tag across `documents`, sorted for stable combobox ordering. Empty when no
   *  document declares any tag -- the tag-filter combobox itself is only rendered while this is
   *  non-empty. */
  private get allTags(): string[] {
    const tags = new Set<string>();
    for (const document of this.documents) for (const tag of document.tags ?? []) tags.add(tag);
    return [...tags].sort((a, b) => a.localeCompare(b, this.effectiveLocale));
  }

  private emitFilterChange(): void {
    this.emit<DocumentLibraryFilterChangeDetail>('lr-filter-change', {
      text: this.searchText,
      tags: this.tagFilter,
      matchCount: this.visibleDocuments.length,
    });
  }

  private onSearchInput = (event: CustomEvent<{ value: string }>): void => {
    this.searchText = event.detail.value;
    this.emitFilterChange();
  };

  private onTagFilterChange = (event: Event): void => {
    const combobox = event.target as LyraCombobox;
    this.tagFilter = Array.isArray(combobox.value) ? [...combobox.value] : [];
    this.emitFilterChange();
  };

  private onSort = (key: LibraryDocumentSortKey): void => {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'ascending' ? 'descending' : 'ascending';
    } else {
      this.sortKey = key;
      this.sortDirection = 'ascending';
    }
    this.emit<DocumentLibrarySortDetail>('lr-sort', { key: this.sortKey, direction: this.sortDirection });
  };

  private openDocument(document: LibraryDocument): void {
    this.emit<DocumentLibraryOpenDetail>('lr-open', { id: document.id });
  }

  private setSelected(ids: Iterable<string>): void {
    this.selectedIds = [...new Set(ids)];
    this.emit<DocumentLibrarySelectionChangeDetail>('lr-selection-change', { ids: this.selectedIds });
  }

  private toggleSelection(document: LibraryDocument, checked: boolean): void {
    const next = new Set(this.selectedIds);
    if (checked) next.add(document.id);
    else next.delete(document.id);
    this.setSelected(next);
  }

  private toggleSelectAll(checked: boolean, visible: LibraryDocument[]): void {
    const next = new Set(this.selectedIds);
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
    const allSelected = visible.length > 0 && visible.every((document) => this.selectedIds.includes(document.id));
    const someSelected = !allSelected && visible.some((document) => this.selectedIds.includes(document.id));
    return html`<lr-checkbox
      .checked=${allSelected}
      .indeterminate=${someSelected}
      aria-label=${this.localize('documentLibrarySelectAll')}
      @lr-change=${(event: CustomEvent<{ checked: boolean }>) =>
        this.toggleSelectAll(event.detail.checked, visible)}
    ></lr-checkbox>`;
  }

  private renderRowCheckbox(document: LibraryDocument): TemplateResult {
    return html`<lr-checkbox
      .checked=${this.selectedIds.includes(document.id)}
      aria-label=${this.localize('documentLibrarySelectDocument', undefined, { name: document.name })}
      @lr-change=${(event: CustomEvent<{ checked: boolean }>) => this.toggleSelection(document, event.detail.checked)}
    ></lr-checkbox>`;
  }

  private renderNameCell(document: LibraryDocument): TemplateResult {
    return html`<button type="button" part="document-name" @click=${() => this.openDocument(document)}>
      ${document.name}
    </button>`;
  }

  private renderTagsCell(document: LibraryDocument): TemplateResult | typeof nothing {
    const tags = document.tags ?? [];
    if (tags.length === 0) return nothing;
    return html`<lr-chip-group>${tags.map((tag) => html`<lr-chip>${tag}</lr-chip>`)}</lr-chip-group>`;
  }

  private renderFreshnessCell(document: LibraryDocument): TemplateResult | typeof nothing {
    if (!document.freshness) return nothing;
    return html`<lr-chip tone=${FRESHNESS_TONE[document.freshness]}>${this.freshnessLabel(document.freshness)}</lr-chip>`;
  }

  private renderUpdatedCell(document: LibraryDocument): string {
    const date = this.normalizeDate(document.updatedAt);
    return date ? getDateTimeFormat(this.effectiveLocale, { dateStyle: 'medium' }).format(date) : '';
  }

  private buildColumns(visible: LibraryDocument[]): TableColumn<LibraryDocument>[] {
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
          html`<lr-file-icon mime-type=${document.mimeType ?? ''} name=${document.name} decorative></lr-file-icon>`,
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

  render(): TemplateResult {
    const label = this.label || this.localize('documentLibraryLabel');
    const visible = this.visibleDocuments;
    const tags = this.allTags;
    const emptyHeading =
      this.documents.length === 0
        ? this.localize('documentLibraryEmptyHeading')
        : this.localize('documentLibraryNoMatchesHeading');

    return html`
      <div part="base" role="region" aria-label=${label}>
        <div part="toolbar">
          <lr-input
            part="search"
            type="search"
            .value=${this.searchText}
            placeholder=${this.localize('documentLibrarySearchPlaceholder')}
            aria-label=${this.localize('documentLibrarySearchPlaceholder')}
            @lr-input=${this.onSearchInput}
          ></lr-input>
          ${tags.length > 0
            ? html`<lr-combobox
                part="tag-filter"
                multiple
                .value=${this.tagFilter}
                placeholder=${this.localize('documentLibraryFilterByTag')}
                aria-label=${this.localize('documentLibraryFilterByTag')}
                @change=${this.onTagFilterChange}
              >
                ${tags.map((tag) => html`<lr-option value=${tag}>${tag}</lr-option>`)}
              </lr-combobox>`
            : nothing}
        </div>
        ${this.selectedIds.length > 0
          ? html`<div part="selection-bar" role="status">
              <span part="selection-count"
                >${this.localize('documentLibrarySelectedCount', undefined, { count: this.selectedIds.length })}</span
              >
              <button type="button" part="clear-selection" @click=${this.clearSelection}>
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
          .selectedKeys=${new Set(this.selectedIds)}
          .sortKey=${this.sortKey}
          .sortDir=${this.sortDirection === 'ascending' ? 'asc' : 'desc'}
          ?loading=${this.loading}
          empty-heading=${emptyHeading}
          @lr-sort=${(event: CustomEvent<{ key: string }>) => this.onSort(event.detail.key as LibraryDocumentSortKey)}
          @lr-row-click=${(event: CustomEvent<{ row: LibraryDocument }>) => this.openDocument(event.detail.row)}
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
