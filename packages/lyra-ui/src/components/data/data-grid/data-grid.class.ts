import { copyOutcome, reportCopyOutcome } from '../../../internal/record-copy-feedback.js';
import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { NESTED_INTERACTIVE_SELECTOR } from '../../../internal/nested-interactive.js';
import { downloadBlob } from '../../../internal/csv.js';
import { createInputMemo } from '../../../internal/input-memo.js';
import { MeasuredOffsetIndex } from '../../../internal/measured-offset-index.js';
import { eventCollectionSupport } from '../../../internal/collection-snapshot.js';
import { CollectionSourceTracker } from '../../../internal/collection-source-tracker.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { trueDefaultBooleanConverter, trueDefaultSpellcheckConverter as spellcheckConverter, blankNumberConverter } from '../../../internal/converters.js';
import { resolveCssTokenLength } from '../../../internal/css-token-length.js';
import {
  getOwnDataDescriptor,
  readOwnArrayLength,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { chevronIcon, closeIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { ColumnResizePointerSession, columnResizeAriaValues, columnResizeKeyboardWidth, columnResizePointerWidth } from '../../../internal/column-resize.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import {
  AnnouncementSinkController,
} from '../../../internal/announcer.js';
import {
  finiteCount,
  finiteDuration,
  finiteInteger,
  finiteRange,
} from '../../../internal/numbers.js';
import { DebounceController } from '../../../internal/debounce-controller.js';
import { renderDataState } from '../../../internal/data-state-renderer.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { hostAriaLabel, srOnly } from '../../../internal/a11y.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import {
  writeClipboardText,
  type LyraClipboardWriteOutcome,
} from '../../../internal/clipboard.js';
import {
  activateNonmodalOverlay,
  type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import {
  aggregateValues,
  columnId,
  columnValue,
  filterList,
  filterRows,
  textFilterCorpus,
  pathValue,
  rowsAsDelimited,
  searchRows,
  searchHaystacks,
  sortRows,
} from './data-grid-processing.js';
// Type-only: the tag-map typings of the composed menu. Registration (and the code) comes from the
// side-effectful `lr-data-grid.ts` entry, so this class module stays side-effect-free.
import type {} from '../../overlays/overlay/dropdown.class.js';
import type {} from '../../layout/menu/dropdown-item.class.js';
import { styles } from './data-grid.styles.js';
import type { DataGridAppearance, DataGridCellContextMenuDetail, DataGridColumn, DataGridCopyOptions, DataGridCsvOptions, DataGridExportOptions, DataGridFacets, DataGridFilter, DataGridKey, DataGridPinSide, DataGridRequest, DataGridResponse, DataGridScrollOptions, DataGridSelectable, DataGridSize, DataGridSortingState, DataGridState, LyraDataGridEventMap, SortingState } from './data-grid-types.js';
import type { LyraPaginationFormat } from '../pagination/pagination.class.js';
import { shadowFocusTarget } from '../../../internal/active-element.js';
import { isHandledOrComposingKey, isRepeatedActivationKey, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
export * from './data-grid-types.js';
import { selectableConverter, displayItemKey, snapshotColumns, VIRTUALIZATION_THRESHOLD, VIRTUAL_OVERSCAN, DATA_GRID_TREE_NODE_LIMIT, DATA_GRID_TREE_DEPTH_LIMIT, DATA_GRID_DRAG_TYPE, REBIND_NO_SNAPSHOT, freezeSnapshot, sameFilterState, sameSortState, serializableFilterValue, isKey, snapshotKeys, keysEqual, typedKey, sameKeySet, arrayHasKey, isElementValue, valueControl, checkableControl, humanizeIdentifier, safeText, normalizePinSide, normalizedGroupBy, type DataDisplayRow, type DataDisplayGroup, type DisplayItem, type DataGridViewportAnchor, type PendingVirtualScroll, type ResizeSession, type ColumnDragSession } from './data-grid-support.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_dataGridColumnMenu, LYRA_DEFAULT_dataGridColumns, LYRA_DEFAULT_dataGridFilterColumn, LYRA_DEFAULT_dataGridPinEnd, LYRA_DEFAULT_dataGridPinStart, LYRA_DEFAULT_dataGridRowLimit, LYRA_DEFAULT_dataGridRowsPerPage, LYRA_DEFAULT_dataGridSelectPage, LYRA_DEFAULT_dataGridToggleRow, LYRA_DEFAULT_dataGridTreeLimitReached, LYRA_DEFAULT_dataGridUnpin, LYRA_DEFAULT_noColumns, LYRA_DEFAULT_resizeColumn } from '../../../internal/default-strings/data.generated.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_copied, LYRA_DEFAULT_copyFailed, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_resizeValuePixels, LYRA_DEFAULT_retry, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_tableLoadFailed, LYRA_DEFAULT_viewerSearchMatchCount } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

// Only grids opting into the columns menu render, and so register, its dropdown, items and trigger.
const DATA_GRID_CHILDREN = {
  dropdown: () => import('../../lr-dropdown.js'),
  'dropdown-item': () => import('../../lr-dropdown-item.js'),
  button: () => import('../../lr-button.js'),
};


/**
 * `<lr-data-grid>` — a virtualized data grid for client or server data, with sorting, filtering,
 * grouping, trees, paging, pinning, resizing, reordering, selection, copying, and CSV export.
 * Mirrors the public `<wa-data-grid>` surface under the `lr-` prefix.
 *
 * Arrays are shallow-reactive: reassign `data`, `columns`, and controlled state arrays after
 * changing them. Set `label` or a host `aria-label` to name the internal grid. Initial declarative
 * loading stays silent; each later transition into loading appends the localized loading text to
 * the document's shared light-DOM polite sink while the visible overlay remains non-live. Public
 * collections are clone-owned readonly snapshots. Nested rows are projected iteratively with a
 * maxRows-node/64-descendant-level budget (10,000 nodes by default) and a localized limit notice. Column identities use a
 * nonblank `id`, then a nonblank `field`, then stable definition-object occurrence; blank and
 * later-duplicate identities are omitted first-wins. With `rowKey`, malformed, blank, and later
 * duplicate row identities are omitted first-wins; without it, row object occurrence is stable
 * across reorder. `selectedRowKeys`/`expandedRowKeys` are the canonical controlled fields, while
 * mirrored `selectedKeys`/`expandedKeys` remain compatibility aliases.
 * The filter, all-columns, and per-column disclosures are mutually exclusive and register with
 * the shared topmost overlay router; Escape closes the active disclosure and returns focus to its
 * trigger.
 * Pagination uses one page-local ARIA row model in client and server modes: the header occupies
 * row one, current-page display and expanded-detail rows start at row two, and `aria-rowcount`
 * covers that current page plus the header. A server `total` drives `pageCount` and the pager but
 * does not inflate `aria-rowcount` without corresponding dataset-global `aria-rowindex` values.
 *
 * A separate `error` state reports a failed load: while `error` is set, the body's single row
 * becomes the built-in failed-load `<lr-empty>` (the same `error`-prefixed exported parts and
 * `[part='retry-button']` as `<lr-table>`), behind its own `error` slot -- `<thead>`/toolbar/pager
 * stay mounted around it. `loading` beats `error` beats every empty/no-columns/no-results branch,
 * matching `<lr-table>`'s own precedence. `error` is host-controlled, exactly like `<lr-table>`'s:
 * the internal `dataSource` request cycle's own `lr-data-error` does NOT set it, since that event's
 * own contract keeps prior rows rendered on a rejection -- a consumer that wants this specific
 * failure to replace the row content instead sets `error = true` from its own `lr-data-error`
 * listener.
 *
 * Wide grids mount only the inline viewport plus overscan, pinned columns, and the focused column.
 * Above 50 columns, CSS-resolved widths stay stable while scrolling; newly mounted content fits
 * those widths. Column definitions/widths, row projection, allocation, font changes and explicit
 * refresh recalculate them. Header, body and footer share these tracks.
 * Expanded detail blocks remain part of their virtual row. `--max-height: none` explicitly opts
 * out of row virtualization. Columns retain at most 10,000 definitions.
 *
 * @customElement lr-data-grid
 * @slot empty - Content rendered when the source has no rows.
 * @slot loading - Content rendered over the grid while data is loading.
 * @slot no-results - Content rendered when active search or filters match no rows.
 * @slot error - Replaces the built-in failed-load state, including its retry button, while
 *   `error` is set.
 * @event lr-request - Fired when server data is requested. `detail` contains sort, filter, search,
 *   page, page-size, and abort-signal state.
 * @event request - Mirrored server-data request event with the same detail as `lr-request`.
 * @event lr-cell-click - Fired when a data cell is activated with canonical `rowKey` and
 *   `columnId` identity.
 *   Clicking a supported interactive descendant, including its inner open-shadow native control,
 *   runs that control without also emitting lr-cell-click; passive cell content retains activation.
 * @event lr-cell-contextmenu - Fired before a native cell context menu. Cancelable; preventing
 *   default suppresses the native menu. Detail includes canonical `rowKey` and `columnId`.
 * @event lr-column-move - Fired while and after a user column move; `detail.finished` marks commit.
 * @event lr-column-pin - Fired after a user pins or unpins a column.
 * @event lr-column-resize - Fired while and after a user resize; `detail.finished` marks commit.
 *   Pointer cancellation or lost capture restores the pre-gesture width, reports that rollback as
 *   `finished: false` when a live resize occurred, and never emits a commit.
 * @event lr-column-visibility-change - Fired after a user changes column visibility.
 * @event lr-copy - A clipboard write fulfilled. Frozen detail: `{ ok: true, text }`.
 * @event lr-copy-error - A clipboard write failed. Frozen detail:
 *   `{ ok: false, text, reason, error }`.
 * @event lr-error - A clipboard write failed; compatibility notification without raw error text.
 * @event lr-data-error - Fired when a server request rejects; prior rows remain rendered. Does
 *   NOT set `error` itself -- `error` is a separate, host-controlled property (see `@slot error`),
 *   so a consumer that wants this rejection to replace the row content with the built-in
 *   failed-load state sets `error = true` from its own listener.
 * @event lr-retry-request - Cancelable retry proposal before the default retry action. `detail: null`.
 *   The built-in `[part='retry-button']` was activated, only rendered while
 *   `error` is set. Cancelable: the default action clears `error`; `preventDefault()` leaves it
 *   set instead.
 * @event lr-column-resize-request - Cancelable proposal of a committed column width (a keyboard
 *   step or a pointer drag's final width), fired before `lr-column-resize`. Frozen
 *   `detail: { columnId, columnKey, width }`. Preventing it keeps the previous width and discards a
 *   drag's live preview.
 * @event lr-filter-change - Fired after a user changes a column filter.
 * @event lr-search-change - Fired after a user edits or clears the built-in search box
 *   (`with-search`). Frozen `detail: { searchTerm }`; `searchTerm` and the first page are already
 *   applied. Programmatic `searchTerm` writes do not fire it.
 * @event lr-group-collapse - Fired after a user collapses a client-side group. Frozen detail:
 *   `{ key, columnId, value, rows }`.
 * @event lr-group-expand - Fired after a user expands a client-side group. Frozen detail:
 *   `{ key, columnId, value, rows }`.
 * @event lr-activate - Accepted pager activation, including the current page, with zero-based `{ value }`.
 * @event lr-before-page-change - Cancelable pager proposal with zero-based `{ page, pageSize }`.
 * @event lr-selection-request - Cancelable user selection proposal with readonly `{ selectedRowKeys }`.
 * @event lr-selection-change - Selection committed, with readonly `{ selectedRowKeys, selectedKeys, selectedRows }`.
 * @event lr-row-expand-request - Cancelable row expansion proposal with `{ row, rowKey, expanded }`.
 * @event lr-row-expand-toggle - Accepted row expansion change with `{ row, rowKey, expanded }`.
 * @event lr-sort - Sort commit with `{ phase, sortKey, sortDir, sort }`. Clearing uses an empty key and null direction.
 * @csspart page-summary - The localized range for the current page.
 * @csspart page-input - The compact pager's page-jump input.
 * @event lr-page-change - Fired after a user changes the zero-based page or page size, and after a
 *   user sort, filter or search resets a later page to the first. Frozen detail: `{ page, pageSize }`.
 * @event lr-row-collapse - Fired after a user collapses a tree row or row detail with canonical
 *   `rowKey` plus the mirrored `key` compatibility alias.
 * @event lr-row-expand - Fired after a user expands a tree row or row detail with canonical
 *   `rowKey` plus the mirrored `key` compatibility alias.
 * @event lr-row-select - Fired after a user changes selection, and after a client `data` refresh
 *   drops selected keys whose rows are gone, with canonical `selectedRowKeys` plus the mirrored
 *   `selectedKeys` compatibility alias.
 * @event lr-sort-request - Cancelable sort proposal, fired before `sort` commits. Frozen readonly
 *   `detail: { sort }`. Vetoing it leaves `sort` unchanged and suppresses `lr-sort-change`.
 *   Both the grid and table emit the primary sort in `lr-sort` on commit.
 * @event lr-sort-change - Fired after a user changes sorting, unless a preceding `lr-sort-request`
 *   was vetoed.
 * @event focus - Native focus relayed once from the toolbar search or active column-filter input.
 * @event blur - Native blur relayed once from the toolbar search or active column-filter input.
 * @csspart body - The sole vertical and horizontal scroll viewport; header and footer columns
 *   mirror its logical inline position.
 * @csspart cell - A data cell.
 * @csspart column-menu - A per-column menu.
 * @csspart column-menu-button - A per-column menu trigger.
 * @csspart columns-menu - The all-columns visibility menu: the composed `<lr-dropdown>` itself,
 *   whose trigger and `role="menuitemcheckbox"` rows are its own children. It replaced a
 *   hand-rolled toggle button plus an inline `role="group"` checkbox panel, so a rule written
 *   against that former structure (`::part(columns-menu) > button`, a descendant
 *   `input[type=checkbox]`) no longer matches.
 * @csspart data-grid - The outer data-grid container.
 * @csspart drag-ghost - Preview that follows the pointer while a column is dragged, kept inside the grid box.
 * @csspart ellipsis - Omitted-page indicator in the pager.
 * @csspart empty - Empty-data state.
 * @csspart error-row - The single full-width row that replaces the body content while `error` is
 *   set.
 * @csspart error-cell - The cell inside `error-row` that holds the failed-load content.
 * @csspart error - The built-in `<lr-empty>` host rendered while `error` is set.
 * @csspart error-base - Exported from the built-in error `<lr-empty>`'s own `base` part.
 * @csspart error-icon - Exported from the built-in error `<lr-empty>`'s `icon` part.
 * @csspart error-heading - Exported from the built-in error `<lr-empty>`'s `heading` part.
 * @csspart error-description - Exported from the built-in error `<lr-empty>`'s `description` part.
 * @csspart error-actions - Exported from the built-in error `<lr-empty>`'s `actions` part.
 * @csspart retry-button - The built-in retry control rendered into the error state's `actions`.
 * @csspart expand-button - A tree/detail/group expand control, named by the constant
 *   `dataGridToggleRow` string (`Toggle row {row}`) in both states. The expanded state is reported
 *   once: on the owning `row`/`group-row` in a tree grid, otherwise on this button.
 * @csspart filter-button - A column filter trigger.
 * @csspart filter-panel - The active column filter editor.
 * @csspart filter-panel-clear - The button that clears the active column filter editor's value,
 *   replacing the native search-cancel glyph suppressed by its own reset; rendered only while it
 *   has a value.
 * @csspart first-button - First-page button.
 * @csspart first-icon - The first-page directional icon.
 * @csspart footer - Footer container.
 * @csspart footer-cell - A footer cell.
 * @csspart footer-row - Footer row.
 * @csspart group-count - Number of rows in a group.
 * @csspart group-row - A grouped row.
 * @csspart group-value - Group value and disclosure control.
 * @csspart header - Header row.
 * @csspart header-cell - A column header cell.
 * @csspart last-button - Last-page button.
 * @csspart last-icon - The last-page directional icon.
 * @csspart live-region - The visually-hidden, `aria-hidden` mirror of the last polite
 * announcement. The announcement itself lands in the shared light-DOM polite region
 * (`acquireAnnouncementSink()` in `internal/announcer.ts`), because a live region inside a shadow
 * root is not reliably announced; this part is a styling/inspection surface only.
 * @csspart loading-overlay - Visible, non-live loading-state overlay. The grid carries
 *   `aria-busy`; post-mount loading announcements use the shared light-DOM polite sink.
 * @csspart next-button - Next-page button.
 * @csspart next-icon - The next-page directional icon.
 * @csspart no-results - No-filter-results state.
 * @csspart page - A numbered page button.
 * @csspart page-current - The applied numbered page button, shown with a solid brand fill.
 * @csspart page-size - Page-size selector.
 * @csspart pager - Pagination controls.
 * @csspart pager-button - Shared part for every pager button.
 * @csspart pin-indicator - Pinned-column edge marker.
 * @csspart previous-button - Previous-page button.
 * @csspart previous-icon - The previous-page directional icon.
 * @csspart resize-handle - Pointer and keyboard column resize handle.
 * @csspart row - A data row.
 * @csspart row-detail - Expanded detail content.
 * @csspart search - Global row-search input.
 * @csspart search-wrapper - The row wrapper around `search` and `search-clear`.
 * @csspart search-clear - The button that clears the global row-search input, replacing the
 *   native search-cancel glyph suppressed by its own reset; rendered only while it has a value.
 * @csspart select-all-checkbox - Current-page select-all checkbox.
 * @csspart sort-indicator - Current sort-direction indicator.
 * @csspart sort-number - Multi-sort priority number.
 * @csspart table - Grid table wrapper.
 * @csspart toolbar - Search and column controls.
 * @csspart tree-limit - Localized notice rendered when nested input exceeds the maxRows node or
 *   64-descendant-level projection budget.
 * @csspart row-limit - Localized notice rendered when flat input exceeds maxRows rows.
 * @cssprop [--accent-color=var(--lr-color-brand)] - Accent used by focus and active states.
 * @cssprop [--background-color=var(--lr-color-surface)] - Grid background.
 * @cssprop [--border-color=var(--lr-color-border)] - Border color of the grid's controls (search,
 *   buttons, page size), and of its grid lines unless `--lr-data-grid-line-color` is set.
 * @cssprop [--lr-data-grid-line-color=var(--border-color,var(--lr-color-border-subtle))] - Color of
 *   the decorative grid lines: the outer edge, header, row, cell and footer separators, and the
 *   toolbar and pager rules. Defaults to the subtle tier so a theme can soften the grid without
 *   weakening its control boundaries.
 * @cssprop [--border-radius=var(--lr-radius)] - Outer and control corner radius. When unset, the
 *   outer frame uses --lr-radius-container and controls keep --lr-radius.
 * @cssprop [--border-width=var(--lr-border-width-thin)] - Grid and cell border width.
 * @cssprop [--cell-padding=var(--lr-space-m)] - Header, cell, and footer padding.
 * @cssprop [--lr-data-grid-cell-color=inherit] - Text colour of body cells.
 * @cssprop [--lr-data-grid-cell-link-color=var(--lr-color-brand)] - Colour of anchors returned by
 *   a column formatter or row detail renderer. These render inside the grid's shadow root, beyond
 *   the reach of page CSS. Set `revert` to restore the user-agent default.
 * @cssprop [--lr-data-grid-cell-link-hover-color=var(--lr-data-grid-cell-link-color,var(--lr-color-brand))] -
 *   Colour of those anchors on hover, focus-visible, and active interaction.
 * @cssprop [--focus-ring=var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)] - Focus ring.
 * @cssprop [--header-background=var(--lr-color-surface-raised)] - Header background.
 * @cssprop [--header-row-height=var(--lr-size-3-5rem)] - Header-row minimum height.
 * @cssprop [--header-text-color=var(--lr-color-text)] - Header foreground.
 * @cssprop [--indent-size=var(--lr-size-1-25rem)] - Tree-level indentation.
 * @cssprop [--max-height=var(--lr-size-30rem)] - Scroll viewport maximum height; `none` renders all.
 * @cssprop --lr-data-grid-control-active-bg - Pressed background for grid controls.
 * @cssprop --lr-data-grid-control-hover-bg - Hovered background for grid controls.
 * @cssprop --lr-data-grid-page-size-active-bg - Pressed page-size selector background.
 * @cssprop --lr-data-grid-row-active-bg - Pressed data-row background.
 * @cssprop --lr-data-grid-sortable-header-active-bg - Pressed sortable-header background.
 * @cssprop --lr-data-grid-sortable-header-hover-bg - Hovered sortable-header background.
 * @cssprop [--row-height=var(--lr-size-3-5rem)] - Estimated and minimum row height; overrides the
 *   size baseline and optional --lr-theme-table-row-height minimum, subject to the 24px and density target floors.
 * @cssprop --row-hover-background - Hovered-row background.
 * @cssprop [--selected-background=var(--lr-color-brand-quiet)] - Selected-row background.
 * @cssprop [--stripe-background=var(--lr-color-surface-raised)] - Alternating-row background.
 * @cssprop [--text-color=var(--lr-color-text)] - Grid foreground.
 * @cssprop [--transition-duration=var(--lr-duration-fast)] - Interaction transition duration.
 * @status experimental
 * @since 4.0.0
 */
export class LyraDataGrid<Row = Record<string, unknown>> extends LyraElement<
  LyraDataGridEventMap<Row>
> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    clear: LYRA_DEFAULT_clear,
    copied: LYRA_DEFAULT_copied,
    copyFailed: LYRA_DEFAULT_copyFailed,
    dataGridColumnMenu: LYRA_DEFAULT_dataGridColumnMenu,
    dataGridColumns: LYRA_DEFAULT_dataGridColumns,
    dataGridFilterColumn: LYRA_DEFAULT_dataGridFilterColumn,
    dataGridPinEnd: LYRA_DEFAULT_dataGridPinEnd,
    dataGridPinStart: LYRA_DEFAULT_dataGridPinStart,
    dataGridRowLimit: LYRA_DEFAULT_dataGridRowLimit,
    dataGridRowsPerPage: LYRA_DEFAULT_dataGridRowsPerPage,
    dataGridSelectPage: LYRA_DEFAULT_dataGridSelectPage,
    dataGridToggleRow: LYRA_DEFAULT_dataGridToggleRow,
    dataGridTreeLimitReached: LYRA_DEFAULT_dataGridTreeLimitReached,
    dataGridUnpin: LYRA_DEFAULT_dataGridUnpin,
    loading: LYRA_DEFAULT_loading,
    noColumns: LYRA_DEFAULT_noColumns,
    noData: LYRA_DEFAULT_noData,
    noMatches: LYRA_DEFAULT_noMatches,
    resizeColumn: LYRA_DEFAULT_resizeColumn,
    resizeValuePixels: LYRA_DEFAULT_resizeValuePixels,
    retry: LYRA_DEFAULT_retry,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    viewerSearchMatchCount: LYRA_DEFAULT_viewerSearchMatchCount,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = eventCollectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-request',
    'request',
    'lr-column-move',
    'lr-data-error',
  ]);
  /** `signal` is an `AbortSignal`, and `error`/`request` are an opaque rejection reason and an
   *  already-frozen `DataGridRequest` snapshot -- none of the three has a structural clone the
   *  generic event-detail snapshotter can produce, so their identity is preserved instead of
   *  being walked (which would otherwise omit the whole detail down to `null`). */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-request': Object.freeze(['signal']),
    request: Object.freeze(['signal']),
    'lr-data-error': Object.freeze(['error', 'request']),
  });
  static override styles = [LyraElement.styles, sizes, srOnly, styles];

  /** Bordered or borderless container treatment. */
  @property({ reflect: true }) appearance: DataGridAppearance = 'outlined';
  /** Dot path or callback returning nested child rows. */
  @property({ attribute: 'child-rows' }) childRows:
    | string
    | ((row: Row) => readonly Row[] | undefined)
    | null = null;
  /** The value each snapshotting collection setter last received. */
  private readonly assignedSources = new CollectionSourceTracker();

  private isRebind(name: string, value: unknown, current: unknown): boolean {
    return this.assignedSources.isRebind(name, value, current);
  }

  private _columnOrder: readonly string[] = Object.freeze([]);
  private columnOrderAssignment = 0;
  /** Clone-owned controlled column order; an empty array uses declaration order. */
  @property({ attribute: false })
  get columnOrder(): readonly string[] {
    return this._columnOrder;
  }
  set columnOrder(value: readonly string[]) {
    const assignment = ++this.columnOrderAssignment;
    if (this.isRebind('columnOrder', value, this._columnOrder)) return;
    const previous = this._columnOrder;
    const seen = new Set<string>();
    const next = freezeSnapshot(
      Array.isArray(value)
        ? value.filter((id): id is string => {
            if (typeof id !== 'string' || id.trim() === '' || seen.has(id))
              return false;
            seen.add(id);
            return true;
          })
        : []
    );
    if (assignment !== this.columnOrderAssignment) return;
    this._columnOrder = next;
    this.requestUpdate('columnOrder', previous);
  }

  private readonly columnOccurrenceIds = new WeakMap<object, string>();
  private nextColumnOccurrenceId = 1;
  private readonly rowOccurrenceIds = new WeakMap<object, string>();
  private nextRowOccurrenceId = 1;
  private _columns: readonly DataGridColumn<Row>[] = Object.freeze([]);
  private columnsAssignment = 0;
  /** Clone-owned readonly column-definition sequence. Reassign to update.
   * @default [] */
  @property({ attribute: false })
  get columns(): readonly DataGridColumn<Row>[] {
    return this._columns;
  }
  set columns(value: readonly DataGridColumn<Row>[]) {
    const assignment = ++this.columnsAssignment;
    if (this.isRebind('columns', value, this._columns)) return;
    const previous = this._columns;
    const next = snapshotColumns(value, (column) => {
      const current = this.columnOccurrenceIds.get(column);
      if (current) return current;
      const identity = `column-occurrence-${this.nextColumnOccurrenceId}`;
      this.nextColumnOccurrenceId += 1;
      this.columnOccurrenceIds.set(column, identity);
      return identity;
    });
    if (assignment !== this.columnsAssignment) return;
    this._columns = next;
    this.requestUpdate('columns', previous);
  }

  /** Maximum admitted rows, including tree descendants; bounded from 1 to 100,000.
   * Set before data, then reassign data to restore previously excluded rows. */
  @property({ converter: blankNumberConverter(10_000), attribute: 'max-rows' }) maxRows = 10_000;

  private get rowLimit(): number {
    return Math.max(1, finiteCount(this.maxRows, DATA_GRID_TREE_NODE_LIMIT, 100_000));
  }

  private dataAdmissionTruncated = false;
  private dataAdmissionLimit = 10_000;
  private _data: readonly Row[] = Object.freeze([]);
  private dataAssignment = 0;
  /** Clone-owned readonly client rows or current server page. Row identities are preserved.
   * Admission inspects at most maxRows source positions, retaining own data properties only.
   * Set maxRows before assigning data; reassign the source to restore excluded rows.
   * @default [] */
  @property({ attribute: false, noAccessor: true })
  get data(): readonly Row[] {
    return this._data;
  }
  set data(value: readonly Row[]) {
    const assignment = ++this.dataAssignment;
    const limit = this.rowLimit;
    if (this.isRebind('data', value, this._data) && this.dataAdmissionLimit === limit) return;
    const previous = this._data;
    const admitted: Row[] = [];
    let length = 0;
    try {
      if (Array.isArray(value)) {
        length = readOwnArrayLength(value) ?? 0;
        const end = Math.min(length, limit);
        for (let index = 0; index < end; index += 1) {
          const entry = getOwnDataDescriptor(value, String(index));
          if (entry === MISSING_OWN_DATA_DESCRIPTOR || entry === UNSAFE_OWN_DATA_DESCRIPTOR) continue;
          const row = entry.value;
          if (row !== null && (typeof row === 'object' || typeof row === 'function')) admitted.push(row as Row);
        }
      }
    } catch { /* Keep the safely admitted prefix of a revoked or hostile array. */ }
    if (assignment !== this.dataAssignment) return;
    this.dataAdmissionLimit = limit;
    this.dataAdmissionTruncated = length > limit;
    this._data = Object.freeze(admitted);
    this.requestUpdate('data', previous);
  }
  /** Async server loader. Providing one enables server behavior. A changed query aborts and
   * invalidates the previous request before waiting for `filterDebounce`; stale results cannot
   * replace the current query's rows, even when a loader ignores its abort signal. */
  @property({ attribute: false }) dataSource:
    | ((request: DataGridRequest) => Promise<DataGridResponse<Row>>)
    | null = null;
  private _expandedRowKeys: readonly DataGridKey[] = Object.freeze([]);
  private expandedRowKeysAssignment = 0;
  /** Clone-owned controlled expanded tree/detail/group row keys. */
  @property({ attribute: false })
  get expandedRowKeys(): readonly DataGridKey[] {
    return this._expandedRowKeys;
  }
  set expandedRowKeys(value: readonly DataGridKey[]) {
    const assignment = ++this.expandedRowKeysAssignment;
    if (this.isRebind('expandedRowKeys', value, this._expandedRowKeys)) return;
    const previous = this._expandedRowKeys;
    const next = snapshotKeys(value);
    if (assignment !== this.expandedRowKeysAssignment) return;
    this._expandedRowKeys = next;
    this.requestUpdate('expandedRowKeys', previous);
    this.requestUpdate('expandedKeys', previous);
  }
  /** Mirrored compatibility alias for `expandedRowKeys`. */
  @property({ attribute: false })
  get expandedKeys(): readonly DataGridKey[] {
    return this.expandedRowKeys;
  }
  set expandedKeys(value: readonly DataGridKey[]) {
    this.expandedRowKeys = value;
  }
  /** Delay before server search/filter requests. */
  @property({ converter: blankNumberConverter(250), attribute: 'filter-debounce' })
  filterDebounce = 250;
  /** Whether the client row projection omitted rows: more than maxRows total rows (roots plus
   *  nested children) or nesting deeper than 64 levels. The `tree-limit` notice renders then. */
  get dataTruncated(): boolean {
    return this.sourceProjection().truncated;
  }
  /** Number of rows after client search and filters, before paging. */
  get filteredCount(): number {
    return this.processedClientRows.length;
  }
  /** Keeps matching descendants and their ancestors during tree filtering. */
  @property({ type: Boolean, attribute: 'filter-from-leaf-rows' })
  filterFromLeafRows = false;
  private _filters: readonly DataGridFilter[] = Object.freeze([]);
  private filterAssignment = 0;
  /** Clone-owned controlled per-column filters. Re-binding an equal value is not a change: the
   *  held value and its reference survive, nothing re-renders, and no server request is
   *  rescheduled, so a host that re-binds on every render cannot postpone the request forever. */
  @property({ attribute: false })
  get filters(): readonly DataGridFilter[] {
    return this._filters;
  }
  set filters(value: readonly DataGridFilter[]) {
    const assignment = ++this.filterAssignment;
    const previous = this._filters;
    const next: DataGridFilter[] = [];
    if (Array.isArray(value)) {
      for (const filter of value) {
        try {
          if (!filter || typeof filter.id !== 'string') continue;
          const value = filter.value;
          const list = filterList(value);
          const filterValue = list ? freezeSnapshot(list) : value;
          next.push(Object.freeze({ id: filter.id, value: filterValue }));
        } catch {
          // Keep later valid filters when a hostile record/getter fails.
        }
      }
    }
    // A re-bind carrying the same values is not a change: keep the existing frozen reference so
    // Lit's dirty check stays quiet and the server-request debounce is not restarted.
    if (assignment !== this.filterAssignment || sameFilterState(previous, next)) return;
    this._filters = Object.freeze(next);
    this.requestUpdate('filters', previous);
  }
  private _groupBy: string | readonly string[] | null = null;
  private groupByAssignment = 0;
  /** One or more field/column identifiers used to group client rows.
   * @default null */
  @property({ attribute: 'group-by' })
  get groupBy(): string | readonly string[] | null {
    return this._groupBy;
  }
  set groupBy(value: string | readonly string[] | null) {
    const assignment = ++this.groupByAssignment;
    if (this.isRebind('groupBy', value, this._groupBy)) return;
    const previous = this._groupBy;
    const next =
      typeof value === 'string'
        ? value
        : Array.isArray(value)
        ? freezeSnapshot(
            value.filter((item): item is string => typeof item === 'string')
          )
        : null;
    if (assignment !== this.groupByAssignment) return;
    this._groupBy = next;
    this.requestUpdate('groupBy', previous);
  }
  /** Accessible name used when host `aria-label` is absent. */
  @property() label: string | null = null;
  /** Shows the loading overlay. */
  @property({ type: Boolean, reflect: true }) loading = false;
  /** Reports a failed load: the body renders the built-in failed-load state (matching
   *  `<lr-table>`'s own `error` contract) instead of the row/empty content, behind an `error`
   *  slot. `loading` beats `error` beats the empty/no-columns/no-results branches, so a loading
   *  grid never flashes a stale failure and a failed grid never falls through to "no results"
   *  copy that hides the retry affordance. Host-controlled in every mode: a rejected internal
   *  `dataSource` request emits `lr-data-error` and keeps the prior rows but does not set this,
   *  so listen for that event and set `error` yourself. */
  @property({ type: Boolean, reflect: true }) error = false;
  /** Failed-load heading override. Omitted localizes `<lr-table>`'s own `tableLoadFailed`
   *  default. */
  @property({ attribute: 'error-heading' }) errorHeading?: string;
  /** Failed-load supporting copy. */
  @property({ attribute: 'error-description' }) errorDescription = '';
  /** Maximum simultaneous sorts; zero is unlimited. */
  @property({ converter: blankNumberConverter(0), attribute: 'max-multi-sort' }) maxMultiSort = 0;
  /** Zero-based page index. */
  @property({ converter: blankNumberConverter(0), reflect: true }) page = 0;
  /** Number of available pages. */
  get pageCount(): number {
    return this.safePageSize ? Math.ceil(this.pageItemCount / this.safePageSize) : 0;
  }

  private get pageItemCount(): number {
    if (!this.usesServerData && normalizedGroupBy(this.groupBy).length) {
      return this.topLevelGroupBuckets(this.processedClientRows).length;
    }
    return this.safeTotal >= 0 ? this.safeTotal : this.filteredCount;
  }

  /** Shows the localized range and exact item count alongside the page controls. */
  @property({ type: Boolean, attribute: 'pagination-with-summary' }) paginationWithSummary = false;
  /** Layout of the page controls. Compact includes a page-number field. */
  @property({ attribute: 'pagination-format' }) paginationFormat: LyraPaginationFormat = 'standard';
  /** Enables open-ended navigation when the server cannot supply a total. */
  @property({ type: Boolean, attribute: 'unknown-total' }) unknownTotal = false;
  /** Whether the server has another page when the total is unknown. */
  @property({ type: Boolean, attribute: 'has-next', converter: trueDefaultBooleanConverter }) hasNext = true;
  private get indeterminatePage(): boolean {
    return this.usesServerData && this.unknownTotal;
  }

  /** Rows per page. */
  @property({ converter: blankNumberConverter(20), attribute: 'page-size' }) pageSize = 20;
  /** Choices rendered by the page-size selector. */
  private _pageSizeOptions: readonly number[] = Object.freeze([
    10, 20, 50, 100,
  ]);
  private pageSizeOptionsAssignment = 0;
  /** Clone-owned choices rendered by the page-size selector.
   * @default [10, 20, 50, 100] */
  @property({ attribute: false })
  get pageSizeOptions(): readonly number[] {
    return this._pageSizeOptions;
  }
  set pageSizeOptions(value: readonly number[]) {
    const assignment = ++this.pageSizeOptionsAssignment;
    if (this.isRebind('pageSizeOptions', value, this._pageSizeOptions)) return;
    const previous = this._pageSizeOptions;
    const next = freezeSnapshot(Array.isArray(value) ? value : []);
    if (assignment !== this.pageSizeOptionsAssignment) return;
    this._pageSizeOptions = next;
    this.requestUpdate('pageSizeOptions', previous);
  }
  /** Enables client slicing and pager controls. */
  @property({ type: Boolean, reflect: true }) paginate = false;
  /** Enables pinning unless a column overrides it. */
  @property({ type: Boolean, reflect: true }) pinnable = false;
  /** Enables column movement unless a column overrides it. */
  @property({ type: Boolean, reflect: true }) reorderable = false;
  /** Enables column resizing unless a column overrides it. */
  @property({ type: Boolean, reflect: true }) resizable = false;
  /** Callback assigning a class to each row. */
  @property({ attribute: false }) rowClass:
    | ((row: Row) => string | null | undefined)
    | null = null;
  /** Callback rendering expandable detail content. */
  @property({ attribute: false }) rowDetail:
    | ((row: Row) => string | TemplateResult | Node)
    | null = null;
  /** Stable row identity: a dot path (`row-key="id"`), or a `(row) => key` callback as
   *  `<lr-table>` takes. A callback that throws or returns no string/finite-number key omits the
   *  row, like a missing path value. */
  @property({ attribute: 'row-key' }) rowKey:
    | string
    | ((row: Row) => DataGridKey | null | undefined)
    | null = null;
  /** Optional global-search matcher. */
  @property({ attribute: false }) searchFn:
    | ((value: unknown, term: string, row: Row) => boolean)
    | null = null;
  /** Controlled global search term. */
  @property({ attribute: false }) searchTerm = '';
  /** Forwarded to the toolbar search and column-filter inputs' native `spellcheck`. Defaults to
   *  `true`, matching the native element; `spellcheck="false"` is parsed as `false`. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  /** Forwarded to the same inputs' native `autocapitalize`. Empty string omits the attribute. */
  @property() override autocapitalize = '';
  /** Forwarded to the same inputs' native `autocorrect` (Safari/WebKit). Empty string omits the
   *  attribute. Named `autoCorrect` to dodge the `lib.dom.d.ts` collision, like `<lr-table>`. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Row-selection behavior. A bare attribute means `multiple`. */
  @property({ reflect: true, converter: selectableConverter })
  selectable: DataGridSelectable = 'none';
  /** Alias of {@link selectable} using `<lr-table>`'s `selectionMode`/`selection-mode` spelling,
   *  so a consumer migrating between the two grid components doesn't need to remember that they
   *  chose different property names for the same row-selection concept. `selectable` remains the
   *  canonical spelling (mirrored from `<wa-data-grid>`, so it is never renamed); reading and
   *  writing `selectionMode` reads and writes `selectable` directly through the same underlying
   *  state -- there is no separate value to fall out of sync. The bare `''` attribute shorthand
   *  for `'multiple'` (`selectable`'s own convenience form) normalizes to `'multiple'` when read
   *  back through this alias.
   * @default 'none'
   */
  @property({ attribute: 'selection-mode' })
  get selectionMode(): 'none' | 'single' | 'multiple' {
    return this.selectable === '' ? 'multiple' : this.selectable;
  }
  set selectionMode(value: 'none' | 'single' | 'multiple') {
    this.selectable = value;
  }
  /** Callback disabling selection for individual rows. */
  @property({ attribute: false }) selectableRows:
    | ((row: Row) => boolean)
    | null = null;
  private _selectedRowKeys: readonly DataGridKey[] = Object.freeze([]);
  private selectionAssignment = 0;
  /** Clone-owned controlled selected row keys. */
  @property({ attribute: false })
  get selectedRowKeys(): readonly DataGridKey[] {
    return this._selectedRowKeys;
  }
  set selectedRowKeys(value: readonly DataGridKey[]) {
    const assignment = ++this.selectionAssignment;
    this.pendingInitialSelectedRows = undefined;
    this.assignSelectedRowKeys(value, assignment);
  }
  private assignSelectedRowKeys(value: readonly DataGridKey[], assignment: number): void {
    if (this.isRebind('selectedRowKeys', value, this._selectedRowKeys)) return;
    const previous = this._selectedRowKeys;
    const next = snapshotKeys(value);
    if (assignment !== this.selectionAssignment) return;
    this._selectedRowKeys = next;
    this.requestUpdate('selectedRowKeys', previous);
    this.requestUpdate('selectedKeys', previous);
  }
  /** Mirrored compatibility alias for `selectedRowKeys`. */
  @property({ attribute: false })
  get selectedKeys(): readonly DataGridKey[] {
    return this.selectedRowKeys;
  }
  set selectedKeys(value: readonly DataGridKey[]) {
    this.selectedRowKeys = value;
  }
  private readonly selectedRowsFor = createInputMemo(
    (_rows: readonly Row[], keys: readonly DataGridKey[]): readonly Row[] => {
      const byKey = this.canonicalRowIndex();
      const positions = this.sourceIndexMap();
      return freezeSnapshot(keys.flatMap(key => {
        const row = byKey.get(key);
        return row === undefined ? [] : [row];
      }).sort((left, right) => positions.get(left)! - positions.get(right)!));
    }
  );

  /** Selected rows, derived from `selectedRowKeys`. Assigning current source rows updates those keys. */
  get selectedRows(): readonly Row[] {
    return this.selectedRowsFor(this.allSourceRows, this.selectedKeys);
  }
  set selectedRows(next: readonly Row[]) {
    const assignment = ++this.selectionAssignment;
    // The getter derives a fresh array, so only the last assigned value marks a rebind.
    if (this.isRebind('selectedRows', next, REBIND_NO_SNAPSHOT)) {
      if (this.pendingInitialSelectedRows)
        this.pendingInitialSelectedRows.assignment = assignment;
      return;
    }
    const candidates = Array.isArray(next) ? next : [];
    // Before this element's first update, Lit property bindings from an enclosing template commit
    // in source order -- `.selectedRows=${…}` can run before a later `.data=${…}` in the very same
    // synchronous pass, while `allSourceRows` (derived from `data`/`rowKey`) is still the pre-`data`
    // default. Resolving eagerly here would then permanently drop the initial selection: `willUpdate()`
    // only ever *prunes* `selectedKeys` against valid keys, it never re-derives them from candidate
    // rows. Retrying once more from `willUpdate()`, once `data` has settled for this update, covers
    // exactly that declarative-binding-order case without changing the synchronous, immediately-
    // readable-back behavior a post-mount `el.selectedRows = …` assignment already relies on.
    if (!this.hasUpdated) this.pendingInitialSelectedRows = { candidates, assignment };
    this.resolveSelectedRowsAssignment(candidates, assignment);
  }
  /** @internal Raw `selectedRows` candidates from a setter call before this element's first
   *  update, re-resolved from `willUpdate()` once `data`/`rowKey` have settled for that update --
   *  see `selectedRows`'s setter doc. */
  private pendingInitialSelectedRows?: { candidates: readonly Row[]; assignment: number };
  private resolveSelectedRowsAssignment(candidates: readonly Row[], assignment: number): void {
    const source = this.allSourceRows;
    const sourceSet = new Set(source);
    const sourceIndexes = this.sourceIndexMap(source);
    const seen = new Set<Row>();
    const rows = candidates.filter((row) => {
      if (!sourceSet.has(row) || seen.has(row)) return false;
      seen.add(row);
      return true;
    });
    const limited = this.selectionMode === 'single' ? rows.slice(0, 1) : rows;
    const keys = limited.map((row) =>
      this.keyForRow(row, this.sourceIndexFor(row, sourceIndexes) ?? 0)
    );
    if (assignment !== this.selectionAssignment) return;
    this.assignSelectedRowKeys(keys, assignment);
  }
  /** Uses server/event-driven loading and skips client processing. */
  @property({ type: Boolean, reflect: true }) server = false;
  /** Density on the shared Lyra size ladder. */
  @property({ reflect: true }) size: DataGridSize = 'm';
  private _sort: SortingState = Object.freeze([]);
  private sortAssignment = 0;
  /** Clone-owned controlled multi-column sorting state. Like `filters`, re-binding an equal value
   *  is not a change and reschedules nothing. */
  @property({ attribute: false })
  get sort(): SortingState {
    return this._sort;
  }
  set sort(value: SortingState) {
    const assignment = ++this.sortAssignment;
    const previous = this._sort;
    const next: DataGridSortingState[number][] = [];
    if (Array.isArray(value)) {
      for (const item of value) {
        try {
          if (!item || typeof item.id !== 'string') continue;
          next.push(Object.freeze({ id: item.id, desc: Boolean(item.desc) }));
        } catch {
          // Keep later valid sort records when a hostile record/getter fails.
        }
      }
    }
    // Same reasoning as `filters` above: an unchanged re-bind must not reschedule anything.
    if (assignment !== this.sortAssignment || sameSortState(previous, next)) return;
    this._sort = Object.freeze(next);
    this.requestUpdate('sort', previous);
  }
  /** Starts new sort cycles descending. */
  @property({ type: Boolean, attribute: 'sort-desc-first' }) sortDescFirst =
    false;
  /** Alternates client row backgrounds. */
  @property({ type: Boolean, reflect: true }) striped = false;
  /** Total server rows; `-1` derives the count from loaded data. */
  @property({ converter: blankNumberConverter(-1) }) total = -1;
  /** Shows a menu on each column. */
  @property({ type: Boolean, attribute: 'with-column-menu', reflect: true })
  withColumnMenu = false;
  /** Shows the all-columns visibility menu -- the library's own checkbox menu (`<lr-dropdown>`
   *  plus a `role="menuitemcheckbox"` row per column), which stays open across successive toggles
   *  so several columns can be shown or hidden in one visit. */
  @property({ type: Boolean, attribute: 'with-columns-menu', reflect: true })
  withColumnsMenu = false;
  /** Keeps a sorted column in ascending/descending states instead of removing its sort. */
  @property({ type: Boolean, attribute: 'without-sort-removal', reflect: true })
  withoutSortRemoval = false;
  /** Shows the global search field. */
  @property({ type: Boolean, attribute: 'with-search', reflect: true })
  withSearch = false;

  @state() private columnWidths = new Map<string, number>();
  @state() private columnVisibility = new Map<string, boolean>();
  @state() private columnPinning = new Map<string, DataGridPinSide>();
  @state() private activeFilterColumn: string | null = null;
  @state() private columnsMenuOpen = false;
  @state() private activeColumnMenu: string | null = null;
  @state() private liveText = '';
  @state() private bodyScrollTop = 0;
  /** Logical distance from the body's inline start; header/footer translate it into their physical
   * direction so `[part="body"]` remains the sole horizontal viewport in both writing modes. */
  @state() private bodyScrollInlineOffset = 0;
  @state() private viewportHeight = 0;
  @state() private focusedRow = -1;
  @state() private focusedColumn = 0;
  @state() private dragGhost = '';
  @state() private activeResizeColumn: string | undefined;

  @query('[part="body"]') private bodyElement?: HTMLElement;

  private requestGeneration = 0;
  private requestController?: AbortController;
  private pendingServerMatchCount = false;
  private serverRequestInputs?: readonly unknown[];
  /** The debounced server request. Scheduled on the realm the grid lives in at the time -- a grid
   *  adopted into another document must keep its pending request on that document's timer queue,
   *  and must still be able to cancel it there on teardown. `pending` is the "a request is already
   *  queued" predicate `willUpdate()` reads. */
  private readonly requestDebounce = new DebounceController<Window>(
    0,
    (owner) => {
      // `loadServerData()` re-checks connection, realm and `usesServerData` itself, so a settle
      // that outlived any of them is already a no-op there.
      void this.loadServerData(owner);
    },
    () => this.ownerDocument.defaultView,
  );
  private ownsLoadingState = false;
  private resizeSession?: ResizeSession;
  private readonly resizePointer = new ColumnResizePointerSession(
    (event) => this.onResizeMove(event),
    (event) => this.onResizeEnd(event),
    (event) => this.onResizeCancel(event),
  );
  private columnDragSession?: ColumnDragSession;
  private columnDragSequence = 0;
  private managedOverlay?: OverlayHandle;
  private managedOverlayOwner: string | null = null;
  private lastSelectedIndex = -1;
  private isMounting = true;
  /** Explicit keyless refreshes invalidate borrowed row content. Named property updates key each
   * derivation on its actual inputs, keeping selection, geometry and loading out of content work. */
  private pipelineEpoch = 0;
  /** A public keyless refresh also counts when coalesced with an unrelated view-state change. */
  private contentRefreshPending = false;
  private readonly pipelineMemo = new Map<
    string,
    { readonly inputs: readonly unknown[]; readonly value: unknown }
  >();

  private memoize<Value>(key: string, inputs: readonly unknown[], compute: () => Value): Value {
    const cached = this.pipelineMemo.get(key);
    if (
      cached &&
      cached.inputs.length === inputs.length &&
      cached.inputs.every((input, index) => Object.is(input, inputs[index]))
    ) {
      return cached.value as Value;
    }
    const value = compute();
    this.pipelineMemo.set(key, { inputs, value });
    return value;
  }
  /** Measured whole-display-item block sizes, keyed by stable row/group identity rather than a
   * transient virtual index. Unmeasured items retain `resolvedRowHeight` as their bounded estimate. */
  private readonly measuredItemHeights = new Map<string, number>();
  private readonly measuredOffsets = new MeasuredOffsetIndex();
  private measuredItemOffsetSignature = '';
  private measuredItemOffsetEstimate = 0;
  private measuredItemOffsetsDirty = true;
  private measurementLocale = '';
  private measurementDisplaySignature = '';
  private measurementRowHeight: number | undefined;
  private measurementFontSignature = '';
  private measurementFontHasRendered = false;
  /** The last stable item at the viewport's leading edge, retained across projections that can
   * reorder or remeasure rows before the next render reconciles their physical offsets. */
  private lastMeasurementAnchor?: DataGridViewportAnchor;
  private measuredBodyWidth: number | undefined;
  /** Width reserved by a vertical body scrollbar at logical inline end. Header/footer live outside
   * that scrollport, so their inline-end pins need the same inset to share its visible edge. */
  private bodyScrollbarInlineEndGutter = 0;
  private rowMeasurementObserver?: ResizeObserver;
  private rowMeasurementObserverOwner?: Window;
  private rowMeasurementObserverBody?: HTMLElement;
  private readonly observedMeasurementElements = new Map<HTMLElement, string>();
  private readonly observedMeasurementBlockSizes = new Map<HTMLElement, number>();
  private measurementUpdateQueued = false;
  private measurementScrollSyncQueued = false;
  private bodyScrollStateSyncQueued = false;
  private measurementFrame?: { readonly owner: Window; handle: number };
  /** A component-issued vertical scroll that must not be mistaken for intervening user intent. */
  private expectedBodyScroll?: {
    readonly body: HTMLElement;
    readonly top: number;
  };
  private pendingVirtualScroll?: PendingVirtualScroll;
  /** Handle on the shared light-DOM live region announcements actually go through -- a region
   *  rendered inside this shadow root is not reliably announced (JAWS with Firefox ignores one
   *  outright), so `[part="live-region"]` is only an `aria-hidden` mirror. */
  private readonly sink = new AnnouncementSinkController(this, { eager: ['polite'] });

  override connectedCallback(): void {
    super.connectedCallback();
    // Acquired on connect, not on the first announcement: assistive tech has to have been
    // observing a live region *before* text arrives for the change to be announced at all.
    // A reconnect can reuse already-rendered rows without scheduling a Lit update. Rebind the
    // owner-realm observer here so variable-height measurements do not silently stop after moving
    // the grid between containers/documents.
    if (this.hasUpdated) {
      this.syncMeasuredBodyWidth();
      this.syncBodyScrollState();
      this.syncRowMeasurementObserver();
      this.correctMeasurementAnchor();
      this.measureRenderedItems();
      this.closeComposedColumnsMenu();
    }
    if (this.dataSource || this.replayServerRequest) this.scheduleServerRequest(false);
    this.replayServerRequest = false;
  }

  /** A listener-driven server request was handed an abort signal that disconnect then fired. */
  private replayServerRequest = false;

  override disconnectedCallback(): void {
    this.replayServerRequest = this.server && !this.dataSource && this.requestController !== undefined;
    this.managedOverlay?.deactivate({ restoreFocus: false });
    this.managedOverlay = undefined;
    this.managedOverlayOwner = null;
    this.requestGeneration += 1;
    this.requestController?.abort();
    this.requestController = undefined;
    this.serverRequestInputs = undefined;
    if (this.ownsLoadingState) this.loading = false;
    this.ownsLoadingState = false;
    this.cancelRequestTimer();
    if (this.resizeSession?.moved)
      this.restoreResizeSession(this.resizeSession, false);
    this.resizePointer.stop();
    this.resizeSession = undefined;
    this.activeResizeColumn = undefined;
    this.activeFilterColumn = null;
    this.activeColumnMenu = null;
    this.columnsMenuOpen = false;
    this.closeComposedColumnsMenu();
    this.dragGhost = '';
    this.columnDragSession = undefined;
    this.pendingVirtualScroll = undefined;
    this.expectedBodyScroll = undefined;
    this.resetRowMeasurementObserver();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.sink.adopted();
    this.expectedBodyScroll = undefined;
    this.resetRowMeasurementObserver();
    if (this.isConnected && this.hasUpdated) {
      this.syncMeasuredBodyWidth();
      this.syncBodyScrollState();
      this.syncRowMeasurementObserver();
      this.correctMeasurementAnchor();
      this.measureRenderedItems();
    }
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) this.contentRefreshPending = true;
    super.requestUpdate(...args);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);

    if (changed.has('columns')) {
      const activeFooters = new Set(this.columns.filter(column => typeof column.footer === 'function').map((column, index) => `footer:${columnId(column, index)}`));
      for (const key of this.pipelineMemo.keys()) if (key.startsWith('footer:') && !activeFooters.has(key)) this.pipelineMemo.delete(key);
    }
    this.resetGeometryCycle();
    this.geometryCycle = true;
    const contentRefresh = this.contentRefreshPending;
    this.contentRefreshPending = false;
    if (contentRefresh) {
      this.pipelineEpoch += 1;
    }
    if (this.hasUpdated && changed.has('loading') && this.loading) {
      this.announce(this.localize('loading'));
    }
    const sourceReplaced =
      changed.has('dataSource') && changed.get('dataSource') !== undefined;
    const serverDisabled = changed.has('server') && !this.usesServerData;
    if (
      (sourceReplaced || serverDisabled) &&
      !this.matchesCurrentServerRequest() &&
      (this.requestController || this.requestDebounce.pending)
    ) {
      this.requestGeneration += 1;
      this.requestController?.abort();
      this.requestController = undefined;
      this.serverRequestInputs = undefined;
      this.cancelRequestTimer();
      if (this.ownsLoadingState) this.loading = false;
      this.ownsLoadingState = false;
    }
    if (
      this.resizeSession &&
      (changed.has('resizable') || changed.has('columns')) &&
      !this.columnCanResize(this.resizeSession.columnId)
    ) {
      const session = this.resizeSession;
      this.resizePointer.stop();
      this.resizeSession = undefined;
      this.activeResizeColumn = undefined;
      if (session.moved) this.restoreResizeSession(session, true);
    }
    if (
      this.columnDragSession &&
      (changed.has('reorderable') || changed.has('columns')) &&
      !this.columnCanMove(this.columnDragSession.sourceId)
    ) {
      this.columnDragSession = undefined;
      this.dragGhost = '';
    }
    if (changed.has('columns')) this.handleColumnsChange();
    this.reconcileRowMeasurementCache(changed, contentRefresh);

    // Re-resolve a `selectedRows` assignment that landed before this first update against the now-
    // settled `data`/`rowKey` -- see the setter's doc. `!this.hasUpdated` here (checked before
    // super.updated() ever flips it) still means "this is the first update".
    if (!this.hasUpdated && this.pendingInitialSelectedRows !== undefined) {
      const pending = this.pendingInitialSelectedRows;
      this.pendingInitialSelectedRows = undefined;
      if (pending.assignment === this.selectionAssignment)
        this.resolveSelectedRowsAssignment(pending.candidates, pending.assignment);
    }

    if (
      !this.usesServerData &&
      !this.sourceProjection().truncated &&
      (changed.has('data') ||
        changed.has('rowKey') ||
        changed.has('childRows') ||
        changed.has('server') ||
        changed.has('dataSource'))
    ) {
      // A truncated projection cannot prove a key invalid -- its row may lie beyond the budget --
      // so controlled selection is pruned only against a complete projection.
      const validKeys = this.allSourceRows.map((row, index) =>
        this.keyForRow(row, index)
      );
      const validKeySet = new Set(validKeys);
      const selectedKeys = this.selectedKeys.filter((key) =>
        validKeySet.has(key)
      );
      if (
        selectedKeys.length !== this.selectedKeys.length ||
        selectedKeys.some(
          (key, index) => !keysEqual(key, this.selectedKeys[index]!)
        )
      ) {
        this.selectedKeys = selectedKeys;
        // A host mirroring selection from `lr-row-select` must hear about keys a refresh dropped.
        // The first update is the starting state, not a change.
        if (this.hasUpdated) this.emitSelection();
      }
      this.lastSelectedIndex = -1;
    }

    if (
      this.paginate &&
      (changed.has('data') ||
        changed.has('filters') ||
        changed.has('searchTerm') ||
        changed.has('groupBy') ||
        changed.has('unknownTotal') ||
        changed.has('pageSize') ||
        changed.has('total') ||
        changed.has('server') ||
        changed.has('dataSource'))
    ) {
      this.page = this.safePage;
    }

    if (this.renderedDisplayItems && (changed.has('filters') || changed.has('searchTerm'))) {
      this.pendingServerMatchCount = this.usesServerData;
      if (!this.usesServerData) this.announce(this.localize('viewerSearchMatchCount', undefined, { count: this.filteredCount }));
    }
    if (this.pendingServerMatchCount && !this.dataSource && this.usesServerData &&
      (changed.has('data') || changed.has('total')) && this.matchesCurrentServerRequest()) this.announceServerMatchCount();

    this.followRovingCell();

    if (
      changed.has('data') ||
      changed.has('columns') ||
      changed.has('filters') ||
      changed.has('searchTerm') ||
      changed.has('sort') ||
      changed.has('expandedKeys') ||
      changed.has('groupBy') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('paginate') ||
      changed.has('childRows')
    ) {
      this.focusedRow = finiteInteger(
        this.focusedRow,
        -1,
        -1,
        Math.max(-1, this.displayItems.length - 1)
      );
      this.focusedColumn = finiteInteger(
        this.focusedColumn,
        0,
        0,
        Math.max(0, this.visibleColumns.length - 1)
      );
    }
  }

  /** The display rows and column ids the last render used, so the roving cell can follow its row
   *  and column identity when a refresh re-derives them. */
  private renderedDisplayItems?: readonly DisplayItem<Row>[];
  private renderedColumns?: ReadonlyArray<{ readonly id: string }>;
  /** Set when a refresh re-derived the rows while a body cell held focus; consumed in `updated()`. */
  private restoreCellFocus = false;

  /**
   * Rows render through a keyed `repeat()`, so a refresh that reorders rows moves the focused cell's
   * row node (which drops DOM focus) and one that removes it deletes the node. Keep the roving cell
   * on the same row key and column id (or the nearest surviving index, clamped afterwards) and note
   * whether a body cell held focus, so `updated()` can put focus back.
   */
  private followRovingCell(): void {
    const previousItems = this.renderedDisplayItems;
    const items = this.displayItems;
    if (previousItems && previousItems !== items && this.focusedRow >= 0) {
      const previous = previousItems[this.focusedRow];
      const current = items[this.focusedRow];
      const key = previous ? displayItemKey(previous) : undefined;
      if (key !== undefined && (!current || displayItemKey(current) !== key)) {
        const index = (this.displayIndexes.get(key) ?? -1);
        if (index >= 0) this.focusedRow = index;
      }
      const active = shadowFocusTarget(this);
      this.restoreCellFocus =
        active?.getAttribute('role') === 'gridcell' && active.hasAttribute('data-focus-cell');
    }
    const previousColumns = this.renderedColumns;
    const columns = this.visibleColumns;
    if (previousColumns && previousColumns !== columns) {
      const id = previousColumns[this.focusedColumn]?.id;
      if (id !== undefined && columns[this.focusedColumn]?.id !== id) {
        const index = columns.findIndex((entry) => entry.id === id);
        if (index >= 0) this.focusedColumn = index;
      }
    }
  }

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    if (hostAriaLabel(this) == null && !this.label) {
      devWarnOnce(
        'lyra-data-grid-missing-accessible-name',
        '<lr-data-grid> has no accessible name: set `label` or a host `aria-label`.'
      );
    }
  }

  private menuRegistration?: Promise<unknown>;
  private childRegistration?: Promise<unknown>;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.menuRegistration;
    await this.childRegistration;
    return complete;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.menuRegistration = loadLazyChildren(DATA_GRID_CHILDREN, this.renderRoot) ?? this.menuRegistration;
    this.childRegistration = loadLazyChildren('data-grid', this.renderRoot) ?? this.childRegistration;
    this.renderedDisplayItems = this.displayItems;
    this.renderedColumns = this.visibleColumns;
    if (this.restoreCellFocus) {
      this.restoreCellFocus = false;
      // Only when the re-render dropped focus: a cell that kept it (the row stayed in place) is
      // already the roving cell.
      if (!shadowFocusTarget(this) && this.focusedRow >= 0) {
        this.focusCell(this.focusedRow, this.focusedColumn);
      }
    }
    if (changed.has('dataSource') && this.dataSource)
      this.scheduleServerRequest(false);
    const requestRelevant =
      changed.has('sort') ||
      changed.has('filters') ||
      changed.has('searchTerm') ||
      changed.has('page') ||
      changed.has('pageSize') ||
      changed.has('server');
    if (requestRelevant && (this.server || this.dataSource)) {
      const delayed = changed.has('filters') || changed.has('searchTerm');
      this.scheduleServerRequest(delayed);
    }
    this.syncManagedOverlay();
    this.syncMeasuredBodyWidth();
    this.syncResolvedColumnWidths();
    this.syncResizeHandleValues();
    this.queueBodyScrollStateSync();
    this.syncRowMeasurementObserver();
    this.correctMeasurementAnchor();
    if (!this.measurementFontHasRendered) {
      this.cycleFontSignature = undefined;
      this.measurementFontHasRendered = true;
    }
    this.measureRenderedItems();
    this.alignPendingVirtualScroll();
    this.isMounting = false;
    this.geometryCycle = false;
  }

  /** The all-columns menu is deliberately absent: it composes `<lr-dropdown>`, which owns its own
   *  Escape, light dismiss and focus return through the shared overlay manager. Routing it through
   *  this helper as well would activate two overlays over the same panel. */
  private get currentManagedOverlayOwner(): string | null {
    if (this.activeFilterColumn !== null) return `filter:${this.activeFilterColumn}`;
    if (this.activeColumnMenu !== null) return `column:${this.activeColumnMenu}`;
    return null;
  }

  private managedOverlayElements(owner: string): {
    readonly panel: HTMLElement | null;
    readonly trigger: HTMLElement | null;
  } {
    const separator = owner.indexOf(':');
    const kind = owner.slice(0, separator);
    const columnIdValue = owner.slice(separator + 1);
    const header = [...this.renderRoot.querySelectorAll<HTMLElement>(
      '[part~="header-cell"][data-column-id]'
    )].find((candidate) => candidate.getAttribute('data-column-id') === columnIdValue);
    if (!header) return { panel: null, trigger: null };
    if (kind === 'filter') {
      return {
        panel: header.querySelector<HTMLElement>('[part="filter-panel"]'),
        trigger: header.querySelector<HTMLElement>('[part="filter-button"]'),
      };
    }
    return {
      panel: header.querySelector<HTMLElement>('[part="column-menu"] [role="group"]'),
      trigger: header.querySelector<HTMLElement>('[part="column-menu-button"]'),
    };
  }

  private dismissManagedOverlay(owner: string): void {
    if (owner.startsWith('filter:') && this.activeFilterColumn === owner.slice(7)) {
      this.activeFilterColumn = null;
    } else if (owner.startsWith('column:') && this.activeColumnMenu === owner.slice(7)) {
      this.activeColumnMenu = null;
    }
  }

  private syncManagedOverlay(): void {
    const owner = this.currentManagedOverlayOwner;
    if (
      owner !== null &&
      owner === this.managedOverlayOwner &&
      this.managedOverlay?.isActive() &&
      this.managedOverlayElements(owner).panel
    ) return;
    this.managedOverlay?.deactivate({ restoreFocus: owner === null });
    this.managedOverlay = undefined;
    this.managedOverlayOwner = null;
    if (owner === null || !this.isConnected) return;
    const { panel } = this.managedOverlayElements(owner);
    if (!panel) return;
    this.managedOverlayOwner = owner;
    this.managedOverlay = activateNonmodalOverlay({
      host: this,
      panel: () => this.managedOverlayElements(owner).panel,
      onEscape: () => this.dismissManagedOverlay(owner),
      restoreFocusTo: () => this.managedOverlayElements(owner).trigger,
    });
  }

  /** Closes the composed all-columns dropdown outright. `<lr-popover>` deliberately *suspends*
   *  rather than closes on disconnect, so a detached-and-reattached grid would otherwise come back
   *  with its menu still open -- and the mirrored `columnsMenuOpen` flag, already reset, would have
   *  committed its `.open` binding while detached, leaving Lit's dirty check with nothing to
   *  re-commit. Every transient menu on this grid closes across a reconnect; this keeps the one
   *  whose state now lives in a child element honouring that. */
  private closeComposedColumnsMenu(): void {
    const menu = this.renderRoot?.querySelector<HTMLElement & { open: boolean }>(
      '[part="columns-menu"]'
    );
    if (menu?.open) menu.open = false;
  }

  /** Mirrors the composed dropdown's own open state and keeps the three panels mutually
   *  exclusive. Opening is the dropdown's to decide (pointer, keyboard, light dismiss); this only
   *  records it and closes whatever else was open. */
  private openColumnsPanel(): void {
    this.columnsMenuOpen = true;
    this.activeFilterColumn = null;
    this.activeColumnMenu = null;
  }

  private toggleFilterPanel(id: string): void {
    const next = this.activeFilterColumn === id ? null : id;
    this.activeFilterColumn = next;
    if (next !== null) {
      this.columnsMenuOpen = false;
      this.activeColumnMenu = null;
    }
  }

  private toggleColumnPanel(id: string): void {
    const next = this.activeColumnMenu === id ? null : id;
    this.activeColumnMenu = next;
    if (next !== null) {
      this.columnsMenuOpen = false;
      this.activeFilterColumn = null;
    }
  }

  /** Send `text` to assistive tech. It goes to the shared light-DOM region -- appended as a new
   *  child node, so an identical repeat (copying twice in a row) is read again rather than being a
   *  silent no-op -- and is mirrored into `[part="live-region"]` for styling/inspection only. */
  private announce(text: string): void {
    this.sink.announcePolite(text);
    this.liveText = text;
  }

  private get usesServerData(): boolean {
    return this.server || this.dataSource !== null;
  }

  private get safePage(): number {
    return this.indeterminatePage ? finiteCount(this.page) : finiteInteger(this.page, 0, 0, Math.max(0, this.pageCount - 1));
  }

  private get safePageSize(): number {
    return finiteCount(this.pageSize);
  }

  private get safeTotal(): number {
    return this.total === -1 ? -1 : finiteCount(this.total);
  }

  private sourceProjection(): {
    readonly rows: readonly Row[];
    readonly truncated: boolean;
  } {
    return this.memoize(
      'source',
      [this.pipelineEpoch, this.data, this.childRows, this.rowKey, this.rowLimit],
      () => this.computeSourceProjection()
    );
  }

  private computeSourceProjection(): {
    readonly rows: readonly Row[];
    readonly truncated: boolean;
  } {
    const result: Row[] = [];
    const visited = new Set<unknown>();
    const seenRowKeys = new Set<DataGridKey>();
    const stack: Array<{ readonly row: Row; readonly depth: number }> = [];
    for (let index = this.data.length - 1; index >= 0; index -= 1) {
      stack.push({ row: this.data[index]!, depth: 0 });
    }
    let truncated = this.dataAdmissionTruncated;
    while (stack.length > 0 && result.length < this.rowLimit) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (!trackIdentity) continue;
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      const rowKey = this.rowIdentity(current.row);
      if (rowKey === undefined || seenRowKeys.has(rowKey)) continue;
      seenRowKeys.add(rowKey);
      result.push(current.row);
      const children = this.childrenFor(current.row);
      if (children.length === 0) continue;
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) {
        truncated = true;
        continue;
      }
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ row: children[index]!, depth: current.depth + 1 });
      }
    }
    if (stack.length > 0) truncated = true;
    return { rows: Object.freeze(result), truncated };
  }

  private get allSourceRows(): readonly Row[] {
    return this.sourceProjection().rows;
  }

  private get canonicalRootRows(): readonly Row[] {
    const source = this.allSourceRows;
    return this.memoize('roots', [source, this.data], () => {
      const canonical = new Set(source);
      return this.data.filter((row) => canonical.delete(row));
    });
  }

  private sourceIndexMap(
    rows: readonly Row[] = this.allSourceRows
  ): ReadonlyMap<Row, number> {
    const build = (): ReadonlyMap<Row, number> => {
      const indexes = new Map<Row, number>();
      rows.forEach((row, index) => {
        if (!indexes.has(row)) indexes.set(row, index);
      });
      return indexes;
    };
    return this.memoize('sourceIndex', [rows], build);
  }

  private sourceIndexFor(
    row: Row,
    indexes: ReadonlyMap<Row, number>
  ): number | undefined {
    // Every row reaching here is a member of the current source projection (page rows come from
    // its canonical roots, children from `canonicalMembers()`), so reference lookup is complete.
    return indexes.get(row);
  }

  private canonicalRowIndex(rows: readonly Row[] = this.allSourceRows): ReadonlyMap<DataGridKey, Row> {
    const build = (): ReadonlyMap<DataGridKey, Row> => {
      const byIdentity = new Map<DataGridKey, Row>();
      for (const row of rows) {
        const identity = this.rowIdentity(row);
        if (identity !== undefined && !byIdentity.has(identity))
          byIdentity.set(identity, row);
      }
      return byIdentity;
    };
    return this.memoize('canonicalIndex', [rows], build);
  }

  private canonicalMembers(
    rows: readonly Row[],
    byIdentity: ReadonlyMap<DataGridKey, Row> = this.canonicalRowIndex()
  ): Row[] {
    const output: Row[] = [];
    const seen = new Set<DataGridKey>();
    for (const candidate of rows) {
      const identity = this.rowIdentity(candidate);
      if (identity === undefined || seen.has(identity)) continue;
      const canonical = byIdentity.get(identity);
      if (!canonical) continue;
      seen.add(identity);
      output.push(canonical);
    }
    return output;
  }

  private get orderedColumns(): Array<{
    column: DataGridColumn<Row>;
    id: string;
    naturalIndex: number;
  }> {
    return this.memoize('ordered', [this.columns, this.columnOrder], () =>
      this.computeOrderedColumns()
    );
  }

  private computeOrderedColumns(): Array<{
    column: DataGridColumn<Row>;
    id: string;
    naturalIndex: number;
  }> {
    const entries = this.columns.map((column, naturalIndex) => ({
      column,
      id: columnId(column, naturalIndex),
      naturalIndex,
    }));
    if (this.columnOrder.length === 0) return entries;
    const rank = new Map(this.columnOrder.map((id, index) => [id, index]));
    return entries.sort((left, right) => {
      const leftRank = rank.get(left.id);
      const rightRank = rank.get(right.id);
      if (leftRank === undefined && rightRank === undefined)
        return left.naturalIndex - right.naturalIndex;
      if (leftRank === undefined) return 1;
      if (rightRank === undefined) return -1;
      return leftRank - rightRank;
    });
  }

  private get columnIndex() {
    const entries = this.orderedColumns;
    return this.memoize('columnIndex', [entries], () => new Map(entries.map(entry => [entry.id, entry])));
  }

  private get groupedColumnIndex() {
    const entries = this.orderedColumns;
    return this.memoize('groupedColumnIndex', [entries], () => {
      const index = new Map<string, (typeof entries)[number]>();
      for (const entry of entries) {
        for (const key of [entry.id, entry.column.field]) if (key && !index.has(key)) index.set(key, entry);
      }
      return index;
    });
  }

  private get visibleColumns(): Array<{
    column: DataGridColumn<Row>;
    id: string;
    naturalIndex: number;
  }> {
    const ordered = this.orderedColumns;
    return this.memoize(
      'visible',
      [ordered, this.columnVisibility, this.columnPinning],
      () => {
        const entries = ordered.filter(
          ({ column, id }) =>
            this.columnVisibility.get(id) ?? column.hidden !== true
        );
        return entries.sort((left, right) => {
          const leftPin = normalizePinSide(this.getColumnPin(left.id));
          const rightPin = normalizePinSide(this.getColumnPin(right.id));
          if (leftPin === rightPin) return 0;
          return leftPin === 'left' || rightPin === 'right' ? -1 : 1;
        });
      }
    );
  }

  private get processedClientRows(): Row[] {
    const rows = this.canonicalRootRows;
    return this.memoize(
      'processed',
      [
        rows,
        this.pipelineEpoch,
        this.usesServerData,
        this.childRows,
        this.filterFromLeafRows,
        this.columns,
        this.filters,
        this.searchTerm,
        this.searchFn,
        this.sort,
        this.effectiveLocale,
      ],
      () => this.computeProcessedClientRows(rows)
    );
  }

  private get filterText() {
    return this.memoize('filterText', [this.allSourceRows, this.columns, this.effectiveLocale],
      () => textFilterCorpus<Row>(this.effectiveLocale));
  }

  private computeProcessedClientRows(rows: readonly Row[]): Row[] {
    if (this.usesServerData) return [...rows];
    const sorted = this.memoize('sorted', [rows, this.pipelineEpoch, this.columns, this.sort, this.effectiveLocale],
      () => sortRows(rows, this.columns, this.sort, this.effectiveLocale));
    if (this.childRows) return sorted.filter(row => this.rowMatches(row) ||
      (this.filterFromLeafRows && this.hasMatchingDescendant(row)));
    const filtered = filterRows(sorted, this.columns, this.filters, this.effectiveLocale, this.filterText);
    const haystacks = !this.searchFn && this.searchTerm.trim() ? this.memoize('searchHaystacks', [rows, this.pipelineEpoch, this.columns, this.effectiveLocale],
      () => searchHaystacks(rows, this.columns, this.effectiveLocale)) : undefined;
    return searchRows(filtered, this.columns, this.searchTerm, this.effectiveLocale, this.searchFn, haystacks);
  }

  private childrenFor(row: Row): Row[] {
    const cache = this.memoize('children', [this.data, this.childRows, this.rowLimit, this.pipelineEpoch], () => new Map<Row, Row[]>());
    const existing = cache.get(row);
    if (existing) return existing;
    const children = this.readChildren(row);
    cache.set(row, children);
    return children;
  }

  private readChildren(row: Row): Row[] {
    try {
      const children =
        typeof this.childRows === 'function'
          ? this.childRows(row)
          : this.childRows
          ? pathValue(row, this.childRows)
          : undefined;
      return Array.isArray(children)
        ? (children.slice(0, this.rowLimit) as Row[])
        : [];
    } catch {
      return [];
    }
  }

  private rowIdentity(row: Row): DataGridKey | undefined {
    if (
      (typeof row !== 'object' || row === null) &&
      typeof row !== 'function'
    )
      return undefined;
    try {
      if (this.rowKey) {
        const candidate =
          typeof this.rowKey === 'function'
            ? this.rowKey(row)
            : pathValue(row, this.rowKey);
        return isKey(candidate) ? candidate : undefined;
      }
      const object = row as object;
      const current = this.rowOccurrenceIds.get(object);
      if (current) return current;
      const identity = `row-occurrence-${this.nextRowOccurrenceId}`;
      this.nextRowOccurrenceId += 1;
      this.rowOccurrenceIds.set(object, identity);
      return identity;
    } catch {
      return undefined;
    }
  }

  private keyForRow(row: Row, _index: number): DataGridKey {
    return this.rowIdentity(row)!;
  }

  private renderedColumnElements(
    columnId: string,
    role?: 'columnheader'
  ): HTMLElement[] {
    const prefix = role ? `[role="${role}"]` : '';
    const ownerCss = this.ownerDocument.defaultView?.CSS;
    const escape = ownerCss?.escape;
    if (typeof escape === 'function') {
      try {
        const matches = [
          ...this.renderRoot.querySelectorAll<HTMLElement>(
            `${prefix}[data-column-id="${escape.call(ownerCss, columnId)}"]`
          ),
        ];
        if (matches.length > 0) return matches;
      } catch {
        // A partial DOM may omit CSS.escape or expose an unusable implementation. The exact scan
        // below keeps public sizing methods usable there and cannot turn a caller-supplied id into
        // selector syntax.
      }
    }
    return [
      ...this.renderRoot.querySelectorAll<HTMLElement>(
        `${prefix}[data-column-id]`
      ),
    ].filter((element) => element.getAttribute('data-column-id') === columnId);
  }

  private computedToken(name: string, privateDefault?: string): string {
    if (!this.isConnected) return '';
    const owner = this.ownerDocument.defaultView;
    if (!owner || typeof owner.getComputedStyle !== 'function') return '';
    try {
      const style = owner.getComputedStyle(this);
      return (
        style.getPropertyValue(name).trim() ||
        (privateDefault ? style.getPropertyValue(privateDefault).trim() : '')
      );
    } catch {
      // Detached/partial DOM implementations can expose the API without supporting this host.
      return '';
    }
  }

  /** Sizes one column to its rendered header and cell contents. */
  autoSizeColumn(columnId: string): void {
    const cells = this.renderedColumnElements(columnId);
    if (cells.length === 0) return;
    let width = 0;
    for (const cell of cells) width = Math.max(width, cell.scrollWidth);
    const entry = this.columnIndex.get(columnId);
    if (!entry) return;
    const { minimum, maximum } = this.columnBounds(entry.column);
    this.setColumnWidth(
      columnId,
      finiteRange(width, minimum, minimum, maximum),
      false
    );
  }

  /** Sizes every visible column to its rendered contents. */
  autoSizeColumns(): void {
    for (const { id } of this.visibleColumns) this.autoSizeColumn(id);
  }

  /** Collapses every tree, detail, and group row without emitting user events. */
  collapseAllRows(): void {
    this.expandedKeys = [];
  }

  /** Collapses one tree/detail/group key without emitting a user event. */
  collapseRow(key: string | number): void {
    this.expandedKeys = this.expandedKeys.filter(
      (candidate) => !keysEqual(candidate, key)
    );
  }

  /** Copies selected rows, or all processed rows when nothing is selected, and returns the row count.
   *  A non-empty `delimiter` takes precedence over the default selected by `format`. */
  copySelectedRows(options: DataGridCopyOptions = {}): number {
    const rowsToCopy =
      this.selectedRows.length > 0
        ? this.selectedRows
        : this.getProcessedRows();
    const format = options.format ?? 'tsv';
    const text = this.delimitedRows(rowsToCopy, {
      ...options,
      delimiter: options.delimiter || (format === 'csv' ? ',' : '\t'),
    });
    void this.copyAndReport(text);
    return rowsToCopy.length;
  }

  /** Expands every expandable row without emitting user events. */
  expandAllRows(): void {
    const keys: DataGridKey[] = [];
    this.allSourceRows.forEach((row, index) => {
      if (this.childrenFor(row).length > 0 || this.rowDetail)
        keys.push(this.keyForRow(row, index));
    });
    for (const group of this.groupItems(this.processedClientRows))
      keys.push(group.key);
    this.expandedKeys = keys;
  }

  /** Expands one tree/detail/group key without emitting a user event. */
  expandRow(key: string | number): void {
    if (!arrayHasKey(this.expandedKeys, key))
      this.expandedKeys = [...this.expandedKeys, key];
  }

  /** Downloads processed rows as formula-safe delimited text (CSV by default). */
  exportDataAsCsv(options: DataGridExportOptions = {}): void {
    const text = this.getDataAsCsv(options);
    const ownerDocument = this.ownerDocument;
    const owner = ownerDocument.defaultView;
    if (!owner || typeof owner.URL.createObjectURL !== 'function') return;
    downloadBlob(text, options.fileName || 'data.csv', 'text/csv;charset=utf-8', ownerDocument);
  }

  /** Moves focus to the grid's current roving stop. */
  override focus(options: FocusOptions = {}): void {
    const selector =
      this.focusedRow < 0
        ? `[role="columnheader"][data-column-position="${this.focusedColumn}"]`
        : `[role="gridcell"][data-row-position="${this.focusedRow}"][data-column-position="${this.focusedColumn}"]`;
    this.renderRoot?.querySelector<HTMLElement>(selector)?.focus(
      options
    );
  }

  /** Computes facets after every other column filter but before this column's own filter. */
  getColumnFacets(columnId: string): DataGridFacets {
    const uniqueValues = new Map<unknown, number>();
    if (this.usesServerData) return Object.freeze({ uniqueValues });
    const entry = this.columnIndex.get(columnId);
    if (!entry) return Object.freeze({ uniqueValues });
    const otherFilters = this.filters.filter(
      (filter) => filter.id !== columnId
    );
    const rows = searchRows(
      filterRows(
        this.canonicalRootRows,
        this.columns,
        otherFilters,
        this.effectiveLocale
      ),
      this.columns,
      this.searchTerm,
      this.effectiveLocale,
      this.searchFn
    );
    let minimum = Number.POSITIVE_INFINITY;
    let maximum = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const value = columnValue(entry.column, row);
      uniqueValues.set(value, (uniqueValues.get(value) ?? 0) + 1);
      const number = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(number)) {
        minimum = Math.min(minimum, number);
        maximum = Math.max(maximum, number);
      }
    }
    return Number.isFinite(minimum) && Number.isFinite(maximum)
      ? Object.freeze({
          uniqueValues,
          minMax: Object.freeze([minimum, maximum] as const),
        })
      : Object.freeze({ uniqueValues });
  }

  /** Returns one column's current pin side. */
  getColumnPin(columnId: string): DataGridPinSide {
    if (this.columnPinning.has(columnId))
      return this.columnPinning.get(columnId) ?? false;
    return (
      this.columnIndex.get(columnId)?.column.pinned ??
      false
    );
  }

  /** Returns processed rows as formula-safe delimited text without downloading. */
  getDataAsCsv(options: DataGridCsvOptions = {}): string {
    return this.delimitedRows(this.getProcessedRows(), options);
  }

  private readonly processedRowsFor = createInputMemo(freezeSnapshot<Row>);

  /** Returns all filtered and sorted rows before pagination, with each admitted source-row
   * occurrence retained once, matching facets, CSV, and rendered identity. */
  getProcessedRows(): readonly Row[] {
    return this.processedRowsFor(this.processedClientRows);
  }

  /** Returns the current page (or all rows when pagination is off). */
  getVisibleRows(): readonly Row[] {
    const rows = this.processedClientRows;
    return this.memoize(
      'visibleRows',
      [
        rows,
        this.paginate,
        this.usesServerData,
        this.pageSize,
        this.page,
        this.total,
        this.groupBy,
        this.orderedColumns,
      ],
      () => this.computeVisibleRows(rows)
    );
  }

  private computeVisibleRows(rows: readonly Row[]): readonly Row[] {
    if (!this.paginate || this.usesServerData) return freezeSnapshot(rows);
    const size = this.safePageSize;
    if (size === 0) return [];
    const start = this.safePage * size;
    if (normalizedGroupBy(this.groupBy).length > 0) {
      return freezeSnapshot(
        this.topLevelGroupBuckets(rows)
          .slice(start, start + size)
          .flatMap((bucket) => bucket.rows)
      );
    }
    return freezeSnapshot(rows.slice(start, start + size));
  }

  /** Returns a serializable snapshot of the grid view state. */
  getState(): DataGridState {
    return Object.freeze({
      order: freezeSnapshot(this.columnOrder),
      widths: Object.freeze(Object.fromEntries(this.columnWidths)),
      visibility: Object.freeze(Object.fromEntries(this.columnVisibility)),
      pinning: Object.freeze(Object.fromEntries(this.columnPinning)),
      sort: freezeSnapshot(this.sort.map((item) => Object.freeze({ ...item }))),
      filters: freezeSnapshot(
        this.filters.map((item) =>
          Object.freeze({
            id: item.id,
            value: serializableFilterValue(item.value),
          })
        )
      ),
      search: this.searchTerm,
      selectedRowKeys: freezeSnapshot(this.selectedRowKeys),
      expandedRowKeys: freezeSnapshot(this.expandedRowKeys),
      selectedKeys: freezeSnapshot(this.selectedRowKeys),
      expandedKeys: freezeSnapshot(this.expandedRowKeys),
      page: this.safePage,
      pageSize: this.safePageSize,
    });
  }

  /** Reconciles column order, widths, visibility, and pinning with the current definitions. */
  handleColumnsChange(): void {
    const valid = new Set(
      this.columns.map((column, index) => columnId(column, index))
    );
    const natural = [...valid];
    const order = this.columnOrder.filter((id) => valid.has(id));
    const orderedIds = new Set(order);
    for (const id of natural) if (!orderedIds.has(id)) order.push(id);
    if (
      this.columnOrder.length > 0 &&
      order.join('\u0000') !== this.columnOrder.join('\u0000')
    ) {
      this.columnOrder = order;
    }
    const widths = [...this.columnWidths].filter(([id]) => valid.has(id));
    const visibility = [...this.columnVisibility].filter(([id]) =>
      valid.has(id)
    );
    const pinning = [...this.columnPinning].filter(([id]) => valid.has(id));
    if (widths.length !== this.columnWidths.size)
      this.columnWidths = new Map(widths);
    if (visibility.length !== this.columnVisibility.size)
      this.columnVisibility = new Map(visibility);
    if (pinning.length !== this.columnPinning.size)
      this.columnPinning = new Map(pinning);
  }

  /** Applies a requested zero-based page and emits `lr-page-change`. */
  handlePageChange(): void {
    this.applyPageChange(this.safePage);
  }

  private applyPageChange(value: number | Event): void {
    let requested: number;
    if (typeof value === 'number') requested = value;
    else
      requested = Number(
        valueControl(value?.currentTarget)?.value ?? this.safePage
      );
    const last = this.indeterminatePage ? Number.MAX_SAFE_INTEGER : Math.max(0, this.pageCount - 1);
    const next = finiteInteger(requested, this.safePage, 0, last);
    this.page = next;
    this.emit(
      'lr-page-change',
      Object.freeze({ page: next, pageSize: this.safePageSize })
    );
  }

  private onPagerRequest(event: CustomEvent<{ page: number }>): void {
    event.stopPropagation();
    const { page, pageSize, paginate, hasNext, indeterminatePage, pageCount } = this;
    const detail = Object.freeze({ page: event.detail.page - 1, pageSize: this.safePageSize });
    if (this.emit('lr-before-page-change', detail, { cancelable: true }).defaultPrevented ||
      !this.isConnected || this.page !== page || this.pageSize !== pageSize || this.pageCount !== pageCount ||
      this.paginate !== paginate || this.hasNext !== hasNext || this.indeterminatePage !== indeterminatePage) event.preventDefault();
  }

  private onPagerChange(event: CustomEvent<{ page: number }>): void {
    event.stopPropagation();
    this.applyPageChange(event.detail.page - 1);
  }

  private onPagerActivate(event: CustomEvent<{ value: number }>): void {
    event.stopPropagation();
    this.emit('lr-activate', Object.freeze({ value: event.detail.value - 1 }));
  }

  /** Applies a search-input event or re-evaluates the current search term. */
  handleSearchTermChange(): void {
    this.applySearchTermChange(this.searchTerm);
  }

  private applySearchTermChange(value: string | Event): void {
    const next =
      typeof value === 'string'
        ? value
        : valueControl(value?.currentTarget)?.value ?? this.searchTerm;
    this.searchTerm = next;
    if (this.page !== 0) this.page = 0;
  }

  // The native `::-webkit-search-cancel-button` reset in data-grid.styles.ts removes the
  // browser's own clear affordance with no replacement -- this button, and the search input's
  // refocus afterward, restore a real one-click way to reset the toolbar search.
  private onClearSearch = (): void => {
    if (this.searchTerm === '') return;
    const previousPage = this.page;
    this.applySearchTermChange('');
    this.emit('lr-search-change', Object.freeze({ searchTerm: '' }));
    this.emitPageReset(previousPage);
    this.renderRoot.querySelector<HTMLInputElement>('[part="search"]')?.focus();
  };

  /** A user edit of the built-in search box: apply it, then report it like the column filters'
   *  `lr-filter-change`. */
  private onSearchInput = (event: Event): void => {
    const before = this.searchTerm;
    const previousPage = this.page;
    this.applySearchTermChange(event);
    if (this.searchTerm !== before) {
      this.emit('lr-search-change', Object.freeze({ searchTerm: this.searchTerm }));
      this.emitPageReset(previousPage);
    }
  };

  /** Pins or unpins a column without emitting the user-only pin event. Accepts `'left'`/`'right'`
   *  (RTL-relative, not physical -- see `DataGridPinSide`) or their `'start'`/`'end'` aliases. */
  pinColumn(columnId: string, side: DataGridPinSide): void {
    if (!this.orderedColumns.some(({ id }) => id === columnId)) return;
    const next = new Map(this.columnPinning);
    next.set(columnId, side);
    this.columnPinning = next;
  }

  /** Forces the current server request. */
  async reload(): Promise<void> {
    const owner = this.ownerDocument.defaultView;
    if (!this.isConnected || !owner || !this.usesServerData) return;
    this.cancelRequestTimer();
    await this.loadServerData(owner);
  }

  /** Restores column declaration order, widths, visibility, and pinning. */
  resetColumns(): void {
    this.columnOrder = [];
    this.columnWidths = new Map();
    this.columnVisibility = new Map();
    this.columnPinning = new Map();
  }

  /** Restores view state while intentionally preserving selection and the current page. */
  resetState(): void {
    this.resetColumns();
    this.sort = [];
    this.filters = [];
    this.searchTerm = '';
    this.expandedKeys = [];
  }

  /** Scrolls the requested processed-row index into the virtual viewport. */
  scrollToIndex(index: number, options: DataGridScrollOptions = {}): void {
    this.pendingVirtualScroll = undefined;
    // An explicit navigation command is newer than a measurement anchor captured before it.
    // Keep ordinary reconciliation anchored, but never let that stale correction reset this jump.
    this.pendingMeasurementAnchor = undefined;
    const rows = this.getVisibleRows();
    if (rows.length === 0) return;
    const requestedIndex = finiteInteger(index, 0, 0, rows.length - 1);
    const requestedRow = rows[requestedIndex]!;
    const sourceIndexes = this.sourceIndexMap();
    const sourceIndex = this.sourceIndexFor(requestedRow, sourceIndexes);
    const requestedKey = this.keyForRow(
      requestedRow,
      sourceIndex ?? requestedIndex
    );
    const items = this.displayItems;
    const target = this.displayIndexes.get(`row:${typeof requestedKey}:${String(requestedKey)}`) ?? -1;
    if (target < 0) return;
    const body = this.bodyElement;
    if (!body) return;
    if (this.recordMeasurementRowHeight() && this.invalidateRowMeasurements())
      this.queueMeasurementUpdate();
    const rendered = this.renderRoot?.querySelector<HTMLElement>(
      `[part~="row"][data-visible-index="${target}"]`
    );
    const rowHeight = this.displayItemHeight(target, items);
    const rowTop = this.displayItemOffset(target, items);
    const currentTop = finiteRange(body.scrollTop, this.bodyScrollTop, 0);
    const viewportHeight = finiteRange(body.clientHeight, 0, 0);
    const alignment = options.align ?? (rendered ? 'nearest' : 'start');
    let top = rowTop;
    if (alignment === 'center') top -= (viewportHeight - rowHeight) / 2;
    else if (alignment === 'end') top -= viewportHeight - rowHeight;
    else if (alignment === 'nearest') {
      const rowBottom = rowTop + rowHeight;
      if (rowTop >= currentTop && rowBottom <= currentTop + viewportHeight)
        top = currentTop;
      else if (rowTop < currentTop) top = rowTop;
      else top = rowBottom - viewportHeight;
    }
    const maximumTop = Math.max(
      0,
      this.displayItemOffset(items.length, items) - viewportHeight
    );
    top = finiteRange(top, 0, 0, maximumTop);
    if (rendered) {
      const delta = this.renderedRowAlignmentDelta(rendered, body, alignment);
      top = finiteRange(
        currentTop + delta,
        currentTop,
        0,
        Math.max(0, body.scrollHeight - body.clientHeight)
      );
      body.scrollTo({ top });
      if (alignment === 'start') {
        const correction = this.renderedStartPrecisionDelta(rendered, body);
        if (correction !== 0) {
          top = finiteRange(
            body.scrollTop + correction,
            body.scrollTop,
            0,
            Math.max(0, body.scrollHeight - body.clientHeight)
          );
          body.scrollTo({ top });
        }
      }
      top = body.scrollTop;
      this.expectedBodyScroll = Object.freeze({ body, top });
      this.bodyScrollTop = top;
      this.lastMeasurementAnchor = this.measurementAnchorAtOffset(top, items);
      return;
    }
    this.lastMeasurementAnchor = this.measurementAnchorAtOffset(top, items);
    const targetItem = items[target];
    if (targetItem)
      this.pendingVirtualScroll = Object.freeze({
        itemKey: displayItemKey(targetItem),
        align: alignment,
      });
    this.expectedBodyScroll = Object.freeze({ body, top });
    this.bodyScrollTop = top;
    body.scrollTo({ top });
  }

  /** Applies known fields from a partial serialized view state. */
  setState(state: DataGridState): void {
    const known = new Set(
      this.columns.map((column, index) => columnId(column, index))
    );
    if (state.order)
      this.columnOrder = state.order.filter((id) => known.has(id));
    if (state.widths)
      this.columnWidths = this.validColumnMap(state.widths, known, (width) =>
        finiteRange(width, 0, 0)
      );
    if (state.visibility)
      this.columnVisibility = this.validColumnMap(
        state.visibility,
        known,
        Boolean
      );
    if (state.pinning)
      this.columnPinning = this.validColumnMap(state.pinning, known, (side) =>
        side === 'left' ||
        side === 'right' ||
        side === 'start' ||
        side === 'end'
          ? side
          : false
      );
    if (state.sort)
      this.sort = state.sort
        .filter((item) => known.has(item.id))
        .map((item) => ({ id: item.id, desc: Boolean(item.desc) }));
    if (state.filters)
      this.filters = state.filters
        .filter((item) => known.has(item.id))
        .map((item) => ({ ...item }));
    if (state.search !== undefined) this.searchTerm = state.search;
    const selectedRowKeys = state.selectedRowKeys ?? state.selectedKeys;
    const expandedRowKeys = state.expandedRowKeys ?? state.expandedKeys;
    if (selectedRowKeys) this.selectedRowKeys = selectedRowKeys;
    if (expandedRowKeys) this.expandedRowKeys = expandedRowKeys;
    if (state.page !== undefined) this.page = finiteCount(state.page);
    if (state.pageSize !== undefined)
      this.pageSize = finiteCount(state.pageSize);
  }

  /** Reserves visible fixed columns and selection controls, then divides the remaining width
   * proportionally across flexible columns, preserving each column's min/max bounds. */
  sizeColumnsToFit(): void {
    const body = this.bodyElement;
    if (!body || this.visibleColumns.length === 0) return;
    const selectionWidth = this.selectionEnabled
      ? resolveCssTokenLength(this.computedToken('--lr-icon-button-size'), {
          host: this,
        }) ?? 0
      : 0;
    const visible = this.visibleColumns;
    const flexible = visible.filter(
      ({ column }) => finiteRange(column.flex ?? 1, 1, 0) > 0
    );
    if (flexible.length === 0) return;
    const measuredWidths = new Map(
      [...this.renderRoot.querySelectorAll<HTMLElement>('[role="columnheader"][data-column-id]')]
        .map((header) => [
          header.dataset['columnId'],
          resolveCssTokenLength(this.ownerDocument.defaultView?.getComputedStyle(header).width ?? '', { host: this }) ?? 0,
        ] as const)
    );
    const fixedWidth = visible.reduce((total, { column, id }) => {
      if (finiteRange(column.flex ?? 1, 1, 0) > 0) return total;
      const bounds = this.columnBounds(column);
      const explicit = this.columnWidths.get(id) ?? column.width;
      const fallback = explicit !== undefined && explicit > 0
        ? this.estimatedColumnWidth(column, id)
        : Number.isFinite(column.maxWidth) && (column.maxWidth ?? 0) > 0
          ? bounds.maximum
          : bounds.minimum || this.estimatedColumnWidth(column, id);
      return total + finiteRange(measuredWidths.get(id) || fallback, fallback, 0);
    }, 0);
    const available = Math.max(0, body.clientWidth - selectionWidth - fixedWidth);
    const flexValues = flexible.map(({ column }) =>
      finiteRange(column.flex ?? 1, 1, 0)
    );
    const flexScale = flexValues.reduce(
      (largest, value) => Math.max(largest, value),
      0
    );
    const scaledFlex = flexValues.map((value) =>
      flexScale > 0 ? value / flexScale : value
    );
    const totalFlex =
      scaledFlex.reduce((sum, value) => sum + value, 0) || flexible.length;
    const next = new Map(this.columnWidths);
    for (const [index, { column, id }] of flexible.entries()) {
      const share = available * ((scaledFlex[index] ?? 0) / totalFlex);
      const { minimum, maximum } = this.columnBounds(column);
      next.set(id, finiteRange(share, minimum, minimum, maximum));
    }
    this.columnWidths = next;
  }

  /** Shows or hides one column without emitting the user-only visibility event. */
  toggleColumn(columnId: string, visible: boolean): void {
    if (!this.orderedColumns.some(({ id }) => id === columnId)) return;
    const next = new Map(this.columnVisibility);
    next.set(columnId, visible);
    this.columnVisibility = next;
    this.focusedColumn = finiteInteger(
      this.focusedColumn,
      0,
      0,
      Math.max(0, this.visibleColumns.length - 1)
    );
  }

  private validColumnMap<Value, Input>(
    record: Record<string, Input>,
    known: Set<string>,
    convert: (value: Input) => Value
  ): Map<string, Value> {
    const result = new Map<string, Value>();
    for (const [id, value] of Object.entries(record))
      if (known.has(id)) result.set(id, convert(value));
    return result;
  }

  private delimitedRows(
    rows: readonly Row[],
    options: DataGridCsvOptions
  ): string {
    const active = this.visibleColumns.map(({ column, id }) => ({
      ...column,
      id,
      value: (row: Row): unknown => {
        const raw = columnValue(column, row);
        const formatted = column.formatter?.(raw, row);
        return typeof formatted === 'string' ? formatted : raw;
      },
      hidden: false,
    }));
    return rowsAsDelimited(rows, active, options);
  }

  private async copyAndReport(text: string): Promise<void> {
    const owner = this.isConnected ? this.ownerDocument.defaultView : null;
    const outcome = await this.writeClipboard(text, owner);
    reportCopyOutcome({
      emit: (name, detail) => this.emit(name, detail),
      announce: ok => { if (!this.isMounting) this.announce(this.localize(ok ? 'copied' : 'copyFailed')); },
    }, outcome, () => owner !== null && this.isConnected && this.ownerDocument.defaultView === owner);
  }

  private async writeClipboard(
    text: string,
    owner: Window | null
  ): Promise<LyraClipboardWriteOutcome> {
    const ownerDocument = this.ownerDocument;
    const outcome = await writeClipboardText(owner, text);
    if (
      outcome.ok ||
      !owner ||
      ownerDocument.defaultView !== owner ||
      !ownerDocument.body
    ) {
      return outcome;
    }
    const textarea = ownerDocument.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    ownerDocument.body.append(textarea);
    try {
      textarea.select();
      if (ownerDocument.execCommand?.('copy')) {
        return copyOutcome('success', { text });
      }
    } finally {
      textarea.remove();
    }
    return outcome;
  }

  private setColumnWidth(
    columnIdValue: string,
    width: number,
    emit: boolean,
    finished = true
  ): void {
    const entry = this.columnIndex.get(columnIdValue);
    if (!entry) return;
    const { minimum, maximum } = this.columnBounds(entry.column);
    const safeWidth = finiteRange(width, minimum, minimum, maximum);
    const next = new Map(this.columnWidths);
    next.set(columnIdValue, safeWidth);
    this.columnWidths = next;
    if (emit)
      this.emit(
        'lr-column-resize',
        Object.freeze({
          columnId: columnIdValue,
          columnKey: columnIdValue,
          width: safeWidth,
          finished,
        })
      );
  }

  private cancelRequestTimer(): void {
    // Cancel, never dispose: a disconnect may be a re-parent, after which this grid must still be
    // able to queue a request.
    this.requestDebounce.cancel();
  }

  private announceServerMatchCount(): void {
    this.pendingServerMatchCount = false;
    if (!this.indeterminatePage && this.safeTotal >= 0) {
      this.announce(this.localize('viewerSearchMatchCount', undefined, { count: this.safeTotal }));
    }
  }

  private currentServerRequestInputs(): readonly unknown[] {
    return [this.ownerDocument, this.dataSource, this.server, this.sort, this.filters,
      this.searchTerm, this.safePage, this.safePageSize];
  }

  private matchesCurrentServerRequest(): boolean {
    const current = this.currentServerRequestInputs();
    return this.serverRequestInputs?.every((value, index) => Object.is(value, current[index])) ?? false;
  }

  private scheduleServerRequest(delayed: boolean): void {
    const owner = this.ownerDocument.defaultView;
    if (!this.isConnected || !owner || !this.usesServerData) return;
    // A synchronous reload can already own this update's query. It must survive the later
    // reactive update; reload itself always forces a new request, including unchanged inputs.
    if (this.matchesCurrentServerRequest()) return;
    // The new query owns the result immediately, including its debounce interval.
    this.requestGeneration++;
    this.requestController?.abort();
    this.requestController = undefined;
    this.serverRequestInputs = undefined;
    this.requestDebounce.delayMs = delayed ? finiteDuration(this.filterDebounce, 250) : 0;
    this.requestDebounce.push(owner);
  }

  private async loadServerData(owner: Window): Promise<void> {
    if (
      !this.isConnected ||
      this.ownerDocument.defaultView !== owner ||
      !this.usesServerData
    )
      return;
    this.requestController?.abort();
    this.serverRequestInputs = this.currentServerRequestInputs();
    const AbortControllerCtor = (owner as Window & typeof globalThis)
      .AbortController;
    this.requestController =
      typeof AbortControllerCtor === 'function'
        ? new AbortControllerCtor()
        : undefined;
    const generation = ++this.requestGeneration;
    const request: DataGridRequest = Object.freeze({
      sort: freezeSnapshot(this.sort.map((item) => Object.freeze({ ...item }))),
      filters: freezeSnapshot(
        this.filters.map((item) =>
          Object.freeze({
            id: item.id,
            value: serializableFilterValue(item.value),
          })
        )
      ),
      search: this.searchTerm,
      page: this.safePage,
      pageSize: this.safePageSize,
      signal: this.requestController?.signal,
    });
    const current = (): boolean => generation === this.requestGeneration
      && !request.signal?.aborted
      && this.isConnected
      && this.ownerDocument.defaultView === owner
      && this.matchesCurrentServerRequest();
    const requestDetail = (): DataGridRequest =>
      Object.freeze({
        ...request,
        sort: freezeSnapshot(
          request.sort.map((item) => Object.freeze({ ...item }))
        ),
        filters: freezeSnapshot(
          request.filters.map((item) =>
            Object.freeze({
              id: item.id,
              value: serializableFilterValue(item.value),
            })
          )
        ),
      });
    this.emit('lr-request', requestDetail());
    if (!current()) return;
    this.emit('request', requestDetail());
    if (!current()) return;
    if (!this.dataSource) return;
    this.ownsLoadingState = true;
    this.loading = true;
    try {
      const response = await this.dataSource(request);
      if (!current()) return;
      this.data = Array.isArray(response.rows) ? response.rows : [];
      this.total = finiteCount(response.total);
      if (this.pendingServerMatchCount) this.announceServerMatchCount();
      this.loading = false;
      this.ownsLoadingState = false;
    } catch (error) {
      if (!current()) return;
      this.loading = false;
      this.ownsLoadingState = false;
      // Deliberately does NOT set `this.error` -- `lr-data-error`'s own documented contract keeps
      // prior rows rendered on a rejection, and unconditionally replacing them with the failed-load
      // state here would break that for every existing `dataSource` consumer. `error` stays a host-
      // controlled property, exactly like `<lr-table>`'s: a listener that wants to escalate this
      // specific rejection to the full failed-load state sets `error = true` itself from its own
      // `lr-data-error` handler.
      this.emit(
        'lr-data-error',
        Object.freeze({ error, request: requestDetail() })
      );
    }
  }

  private get selectionEnabled(): boolean {
    return this.selectionMode !== 'none';
  }

  /** ARIA columns and every row-spanning cell share this one selection-column adjustment. */
  private get ariaColumnCount(): number {
    return Math.max(
      1,
      this.visibleColumns.length + (this.selectionEnabled ? 1 : 0)
    );
  }

  private rowIsSelectable(row: Row): boolean {
    return this.selectionEnabled && (this.selectableRows?.(row) ?? true);
  }

  private rowMatches(row: Row): boolean {
    const source = this.allSourceRows;
    const matches = this.memoize('rowMatches', [source, this.columns, this.filters,
      this.searchTerm, this.searchFn, this.effectiveLocale], () => {
      const haystacks = !this.searchFn && this.searchTerm.trim() ? this.memoize('treeHaystacks',
        [source, this.columns, this.effectiveLocale], () => searchHaystacks(source, this.columns, this.effectiveLocale)) : undefined;
      return new Set(searchRows(filterRows(source, this.columns, this.filters, this.effectiveLocale, this.filterText),
        this.columns, this.searchTerm, this.effectiveLocale, this.searchFn, haystacks));
    });
    return matches.has(row);
  }

  private processedChildrenFor(row: Row, byIdentity: ReadonlyMap<DataGridKey, Row>): Row[] {
    const cache = this.memoize('sortedChildren', [this.allSourceRows, this.columns, this.sort,
      this.effectiveLocale, this.usesServerData], () => new Map<Row, Row[]>());
    let children = cache.get(row);
    if (!children) {
      const canonical = this.canonicalMembers(this.childrenFor(row), byIdentity);
      children = this.usesServerData ? canonical : sortRows(canonical, this.columns, this.sort, this.effectiveLocale);
      cache.set(row, children);
    }
    if (this.usesServerData) return children;
    return children.filter(child => this.rowMatches(child) ||
      (this.filterFromLeafRows && this.hasMatchingDescendant(child)));
  }

  private hasMatchingDescendant(row: Row): boolean {
    const stack = this.canonicalMembers(this.childrenFor(row)).map((child) => ({
      row: child,
      depth: 1,
    }));
    const visited = new Set<unknown>();
    let inspected = 0;
    while (stack.length > 0 && inspected < this.rowLimit) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      inspected += 1;
      if (this.rowMatches(current.row)) return true;
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) continue;
      for (const child of this.canonicalMembers(this.childrenFor(current.row))) {
        stack.push({ row: child, depth: current.depth + 1 });
      }
    }
    return false;
  }

  private get pageRows(): readonly Row[] {
    return this.getVisibleRows();
  }

  private get currentPageSelectableRows(): Array<{
    row: Row;
    key: DataGridKey;
  }> {
    return this.memoize(
      'pageSelectable',
      [
        this.pageRows,
        this.allSourceRows,
        this.pipelineEpoch,
        this.childRows,
        this.selectable,
        this.selectableRows,
      ],
      () => this.computeCurrentPageSelectableRows()
    );
  }

  private computeCurrentPageSelectableRows(): Array<{
    row: Row;
    key: DataGridKey;
  }> {
    const result: Array<{ row: Row; key: DataGridKey }> = [];
    const sourceIndex = new Map(
      this.allSourceRows.map((row, index) => [row, index])
    );
    const visited = new Set<unknown>();
    const stack = [...this.pageRows]
      .reverse()
      .map((row) => ({ row, depth: 0 }));
    let inspected = 0;
    while (stack.length > 0 && inspected < this.rowLimit) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      inspected += 1;
      const index = this.sourceIndexFor(current.row, sourceIndex);
      if (index === undefined) continue;
      const key = this.keyForRow(current.row, index);
      if (this.rowIsSelectable(current.row))
        result.push({ row: current.row, key });
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) continue;
      const children = this.canonicalMembers(this.childrenFor(current.row));
      for (
        let childIndex = children.length - 1;
        childIndex >= 0;
        childIndex -= 1
      ) {
        const child = children[childIndex]!;
        stack.push({ row: child, depth: current.depth + 1 });
      }
    }
    return result;
  }

  /** Object-valued grouping callbacks may return a fresh object on every projection. The lowest
   * stable member identity keeps that group's key repeatable while still separating structurally
   * equal object buckets, which cannot share a row. */
  private groupMemberKey(rows: readonly Row[]): string {
    let first: string | undefined;
    for (const row of rows) {
      const identity = this.rowIdentity(row);
      if (identity === undefined) continue;
      const candidate = `${typeof identity}:${safeText(identity)}`;
      if (first === undefined || candidate < first) first = candidate;
    }
    return first ?? 'unknown';
  }

  private groupKey(
    parent: string,
    id: string,
    value: unknown,
    rows: readonly Row[]
  ): string {
    const valueType = typeof value;
    if (
      (valueType === 'object' && value !== null) ||
      valueType === 'function'
    ) {
      return `group:${parent}:${id}:${valueType}:member:${this.groupMemberKey(
        rows
      )}`;
    }
    return `group:${parent}:${id}:${valueType}:${safeText(value)}`;
  }

  private topLevelGroupBuckets(
    rows: readonly Row[]
  ): Array<{ value: unknown; rows: Row[] }> {
    return this.memoize(
      'buckets',
      [rows, this.groupBy, this.orderedColumns],
      () => this.computeTopLevelGroupBuckets(rows)
    );
  }

  private computeTopLevelGroupBuckets(
    rows: readonly Row[]
  ): Array<{ value: unknown; rows: Row[] }> {
    const field = normalizedGroupBy(this.groupBy)[0];
    if (!field) return [];
    const entry = this.groupedColumnIndex.get(field);
    if (!entry) return [];
    const buckets = new Map<unknown, Row[]>();
    for (const row of rows) {
      const value = columnValue(entry.column, row);
      const bucket = buckets.get(value) ?? [];
      bucket.push(row);
      buckets.set(value, bucket);
    }
    return [...buckets].map(([value, bucketRows]) => ({
      value,
      rows: bucketRows,
    }));
  }

  private groupItems(rows: readonly Row[]): DataDisplayGroup<Row>[] {
    const fields = normalizedGroupBy(this.groupBy);
    if (fields.length === 0 || this.usesServerData) return [];
    const result: DataDisplayGroup<Row>[] = [];
    const visit = (
      groupRows: readonly Row[],
      depth: number,
      parent: string
    ): void => {
      const field = fields[depth];
      if (!field) return;
      const entry = this.groupedColumnIndex.get(field);
      if (!entry) return;
      const buckets = new Map<unknown, Row[]>();
      for (const row of groupRows) {
        const value = columnValue(entry.column, row);
        const bucket = buckets.get(value) ?? [];
        bucket.push(row);
        buckets.set(value, bucket);
      }
      for (const [value, bucket] of buckets) {
        const key = this.groupKey(parent, entry.id, value, bucket);
        result.push({
          kind: 'group',
          key,
          value,
          columnId: entry.id,
          rows: bucket,
          depth,
        });
        if (depth + 1 < fields.length) visit(bucket, depth + 1, key);
      }
    };
    visit(rows, 0, 'root');
    return result;
  }

  private get displayItems(): DisplayItem<Row>[] {
    return this.memoize(
      'display',
      [
        this.pageRows,
        this.pipelineEpoch,
        this.processedClientRows,
        this.allSourceRows,
        this.childRows || this.groupBy ? this.expandedKeys : null,
        this.groupBy,
        this.orderedColumns,
        this.usesServerData,
        this.childRows,
      ],
      () => this.computeDisplayItems()
    );
  }

  private get displayIndexes() {
    const items = this.displayItems;
    return this.memoize('displayIndexes', [items], () => new Map(items.map((item, index) => [displayItemKey(item), index])));
  }

  private computeDisplayItems(): DisplayItem<Row>[] {
    for (const key of this.pipelineMemo.keys()) {
      if (key.startsWith('eligible:') || key.startsWith('groupSelected:') || key.startsWith('aggregate:')) this.pipelineMemo.delete(key);
    }
    const groups = normalizedGroupBy(this.groupBy);
    if (groups.length > 0 && !this.usesServerData)
      return this.groupedDisplayItems(
        this.pageRows,
        groups,
        0,
        'root',
        this.sourceIndexMap()
      );
    const result: DisplayItem<Row>[] = [];
    const sourceRows = this.allSourceRows;
    const indexes = this.sourceIndexMap(sourceRows);
    // Resolve fresh callback-produced children against one bounded source snapshot for this
    // traversal. The next projection rebuilds it so caller-owned row changes remain visible.
    let byIdentity: ReadonlyMap<DataGridKey, Row> | undefined;
    const visited = new Set<unknown>();
    const stack = [...this.pageRows]
      .reverse()
      .map((row) => ({ row, depth: 0 }));
    while (stack.length > 0 && result.length < this.rowLimit) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      const sourceIndex = this.sourceIndexFor(current.row, indexes);
      if (sourceIndex === undefined) continue;
      const safeIndex = sourceIndex;
      const key = this.keyForRow(current.row, safeIndex);
      result.push({
        kind: 'row',
        row: current.row,
        key,
        depth: current.depth,
        sourceIndex: safeIndex,
      });
      if (
        !arrayHasKey(this.expandedKeys, key) ||
        current.depth >= DATA_GRID_TREE_DEPTH_LIMIT
      )
        continue;
      const children = this.processedChildrenFor(
        current.row,
        byIdentity ??= this.canonicalRowIndex(sourceRows)
      );
      for (let index = children.length - 1; index >= 0; index -= 1) {
        stack.push({ row: children[index]!, depth: current.depth + 1 });
      }
    }
    return result;
  }

  private groupedDisplayItems(
    rows: readonly Row[],
    fields: readonly string[],
    depth: number,
    parent: string,
    sourceIndexes: ReadonlyMap<Row, number>
  ): DisplayItem<Row>[] {
    const field = fields[depth];
    if (!field) return [];
    const entry = this.groupedColumnIndex.get(field);
    if (!entry)
      return rows.map((row, index) => ({
        kind: 'row',
        row,
        key: this.keyForRow(
          row,
          this.sourceIndexFor(row, sourceIndexes) ?? index
        ),
        depth,
        sourceIndex: this.sourceIndexFor(row, sourceIndexes) ?? index,
      }));
    const buckets = new Map<unknown, Row[]>();
    for (const row of rows) {
      const value = columnValue(entry.column, row);
      const bucket = buckets.get(value) ?? [];
      bucket.push(row);
      buckets.set(value, bucket);
    }
    const result: DisplayItem<Row>[] = [];
    for (const [value, bucket] of buckets) {
      const key = this.groupKey(parent, entry.id, value, bucket);
      result.push({
        kind: 'group',
        key,
        value,
        columnId: entry.id,
        rows: bucket,
        depth,
      });
      if (!arrayHasKey(this.expandedKeys, key)) continue;
      if (depth + 1 < fields.length)
        result.push(
          ...this.groupedDisplayItems(
            bucket,
            fields,
            depth + 1,
            key,
            sourceIndexes
          )
        );
      else {
        for (const row of bucket) {
          const sourceIndex = this.sourceIndexFor(row, sourceIndexes);
          result.push({
            kind: 'row',
            row,
            key: this.keyForRow(row, sourceIndex ?? result.length),
            depth: depth + 1,
            sourceIndex: sourceIndex ?? result.length,
          });
        }
      }
    }
    return result;
  }

  private signatureItems?: readonly DisplayItem<Row>[];
  private signatureValue = '';

  private measurementSignature(items: readonly DisplayItem<Row>[]): string {
    // The memoized display list keeps its identity across scroll renders, so the O(n) string is
    // rebuilt only when the list itself was re-derived.
    if (items === this.signatureItems) return this.signatureValue;
    this.signatureItems = items;
    this.signatureValue = items
      .map((item) => {
        const key = displayItemKey(item);
        return `${key.length}:${key}`;
      })
      .join('|');
    return this.signatureValue;
  }

  private invalidateRowMeasurements(): boolean {
    const anchor = this.lastMeasurementAnchor ?? this.captureMeasurementAnchor();
    if (this.measuredItemHeights.size === 0) {
      this.measuredItemOffsetsDirty = true;
      return false;
    }
    if (anchor) this.pendingMeasurementAnchor = anchor;
    this.measuredItemHeights.clear();
    this.measuredItemOffsetsDirty = true;
    return true;
  }

  /** Clears estimates whenever a change can alter a row's physical block size. Pure scrolling is
   * deliberately absent: cache entries are keyed by stable display identity and survive a row
   * leaving/re-entering the virtual window. */
  // Untyped PropertyValues includes the private reactive width and visibility maps, which are
  // intentionally omitted from keyof this but can change wrapping and row height.
  private reconcileRowMeasurementCache(changed: PropertyValues, contentRefresh = changed.size === 0): void {
    const items = this.displayItems;
    const signature = this.measurementSignature(items);
    const locale = this.effectiveLocale;
    const changedGeometry = [
      'columns',
      'columnOrder',
      'columnVisibility',
      'columnWidths',
      'data',
      'filters',
      'searchTerm',
      'sort',
      'expandedKeys',
      'groupBy',
      'page',
      'pageSize',
      'paginate',
      'childRows',
      'rowDetail',
      'rowClass',
      'selectable',
      'strings',
    ].some((property) => changed.has(property));
    const localeChanged =
      this.measurementLocale !== '' && this.measurementLocale !== locale;
    const structureChanged =
      this.measurementDisplaySignature !== '' &&
      this.measurementDisplaySignature !== signature;
    const rowHeightChanged = this.recordMeasurementRowHeight();
    if (contentRefresh || changedGeometry || localeChanged || structureChanged || rowHeightChanged)
      this.invalidateRowMeasurements();
    this.measurementLocale = locale;
    this.measurementDisplaySignature = signature;
  }

  /** Detects CSS-token/font metric changes even when no public reactive property changed. */
  private recordMeasurementRowHeight(): boolean {
    const height = this.resolvedRowHeight;
    const previous = this.measurementRowHeight;
    const fontSignature = this.currentMeasurementFontSignature();
    const fontChanged =
      this.measurementFontSignature !== '' &&
      this.measurementFontSignature !== fontSignature;
    this.measurementRowHeight = height;
    this.measurementFontSignature = fontSignature;
    return (previous !== undefined && previous !== height) || fontChanged;
  }

  private currentMeasurementFontSignature(): string {
    if (this.geometryCycle && this.cycleFontSignature !== undefined) return this.cycleFontSignature;
    // Server-side and partial DOM hosts expose no owner document at all, so the
    // connection check has to run before the document is dereferenced.
    if (!this.isConnected) return '';
    const owner = this.ownerDocument?.defaultView;
    if (!owner || typeof owner.getComputedStyle !== 'function') return '';
    try {
      const style = owner.getComputedStyle(this);
      const cell = this.renderRoot?.querySelector<HTMLElement>(
        '[part~="cell"], [part~="header-cell"], [part="group-value"]'
      );
      const cellStyle = cell ? owner.getComputedStyle(cell) : undefined;
      const cellPadding = cellStyle
        ? [
            cellStyle.paddingBlockStart,
            cellStyle.paddingBlockEnd,
            cellStyle.paddingInlineStart,
            cellStyle.paddingInlineEnd,
          ].join(',')
        : this.computedToken('--cell-padding', '--_lr-data-grid-cell-padding');
      return this.cycleFontSignature = [
        style.fontFamily,
        style.fontSize,
        style.fontStretch,
        style.fontStyle,
        style.fontWeight,
        style.letterSpacing,
        style.lineHeight,
        style.wordSpacing,
        cellPadding,
      ].join('\u0000');
    } catch {
      return '';
    }
  }

  private recordMeasuredBodyWidth(width: unknown): boolean {
    if (typeof width !== 'number' || !Number.isFinite(width) || width < 0)
      return false;
    const previous = this.measuredBodyWidth;
    this.measuredBodyWidth = width;
    if (previous === undefined || previous === width)
      return false;
    this.invalidateRowMeasurements();
    return true;
  }

  private syncMeasuredBodyWidth(): void {
    const body = this.bodyElement;
    if (!body) return;
    this.syncBodyScrollbarInlineEndGutter(body);
    if (this.recordMeasuredBodyWidth(body.clientWidth))
      this.queueMeasurementUpdate();
  }

  /** Mirrors the body's actual vertical-scrollbar reservation onto outer end-pinned tracks without
   * scheduling a nested Lit update from `updated()`. */
  private syncBodyScrollbarInlineEndGutter(body: HTMLElement): void {
    const scrollbarGutter = finiteRange(
      body.offsetWidth - body.clientWidth,
      0,
      0
    );
    if (this.bodyScrollbarInlineEndGutter === scrollbarGutter) return;
    this.bodyScrollbarInlineEndGutter = scrollbarGutter;
    const value = `${scrollbarGutter}px`;
    this.renderRoot
      .querySelectorAll<HTMLElement>('[part="header"], [part="footer-row"]')
      .forEach((element) =>
        element.style.setProperty('--data-grid-body-inline-end-gutter', value)
      );
  }

  /** ResizeObserver and `updated()` may both discover a changed height in one render. Coalesce a
   * follow-up pass outside Lit's lifecycle so a measurement cannot recursively schedule updates. */
  private queueMeasurementUpdate(): void {
    if (this.measurementUpdateQueued) return;
    this.measurementUpdateQueued = true;
    const owner = this.ownerDocument.defaultView;
    const schedule = owner?.queueMicrotask?.bind(owner) ?? queueMicrotask;
    schedule(() => {
      this.measurementUpdateQueued = false;
      // Measurements change offsets, not caller-owned content. Keep this follow-up out of the
      // public keyless refresh path, which must discard offscreen heights after row edits.
      if (this.isConnected) super.requestUpdate();
    });
  }

  private queueMeasuredScrollTop(body: HTMLElement): void {
    if (this.measurementScrollSyncQueued) return;
    this.measurementScrollSyncQueued = true;
    const owner = body.ownerDocument.defaultView;
    const schedule = owner?.queueMicrotask?.bind(owner) ?? queueMicrotask;
    schedule(() => {
      this.measurementScrollSyncQueued = false;
      if (!this.isConnected || this.bodyElement !== body) return;
      const next = finiteRange(body.scrollTop, this.bodyScrollTop, 0);
      if (this.bodyScrollTop !== next) this.bodyScrollTop = next;
      this.lastMeasurementAnchor = this.captureMeasurementAnchor();
    });
  }

  /** Reads layout-clamped scroll state after Lit commits without scheduling a nested update. */
  private queueBodyScrollStateSync(): void {
    if (this.bodyScrollStateSyncQueued) return;
    this.bodyScrollStateSyncQueued = true;
    const owner = this.ownerDocument.defaultView;
    const schedule = owner?.queueMicrotask?.bind(owner) ?? queueMicrotask;
    schedule(() => {
      this.bodyScrollStateSyncQueued = false;
      if (this.isConnected) this.syncBodyScrollState();
    });
  }

  /** ResizeObserver fires up to once per animation frame while an animated/dragged ancestor
   *  resize is in progress. Coalesce however many ticks land in one frame into a single deferred
   *  read (`measureRenderedItems()`) and write (`syncBodyScrollbarInlineEndGutter()`) pass,
   *  instead of forcing a fresh layout read across the whole rendered virtual-item set on every
   *  tick. Mirrors `<lr-table>`'s own `scheduleLayoutSync()`. */
  private scheduleMeasurementSync(): void {
    if (this.measurementFrame) return;
    const owner = this.ownerDocument.defaultView;
    if (!owner) return;
    const frame = { owner, handle: 0 };
    frame.handle = owner.requestAnimationFrame(() => {
      if (this.measurementFrame !== frame) return;
      this.measurementFrame = undefined;
      if (!this.isConnected || this.ownerDocument.defaultView !== owner) return;
      const body = this.bodyElement;
      if (body) this.syncBodyScrollbarInlineEndGutter(body);
      this.measureRenderedItems();
    });
    this.measurementFrame = frame;
  }

  private cancelMeasurementFrame(): void {
    const frame = this.measurementFrame;
    if (!frame) return;
    this.measurementFrame = undefined;
    frame.owner.cancelAnimationFrame(frame.handle);
  }

  private resetRowMeasurementObserver(): void {
    this.rowMeasurementObserver?.disconnect();
    this.rowMeasurementObserver = undefined;
    this.rowMeasurementObserverOwner = undefined;
    this.rowMeasurementObserverBody = undefined;
    this.observedMeasurementElements.clear();
    this.observedMeasurementBlockSizes.clear();
    this.cancelMeasurementFrame();
    // A realm/container reset can change wrapping even when the body has the same CSS pixel
    // width (for example, a new document's fonts or inherited theme). Preserve the last stable
    // item as a pending restoration target, but never reuse measurements across that boundary.
    const invalidated = this.invalidateRowMeasurements();
    this.lastMeasurementAnchor = undefined;
    if (invalidated && this.isConnected) this.queueMeasurementUpdate();
  }

  private syncRowMeasurementObserver(): void {
    const body = this.bodyElement;
    const owner = body?.ownerDocument.defaultView;
    if (!body || !owner || !this.isConnected || !owner.ResizeObserver) {
      this.resetRowMeasurementObserver();
      return;
    }
    if (
      this.rowMeasurementObserverOwner !== owner ||
      this.rowMeasurementObserverBody !== body ||
      !this.rowMeasurementObserver
    ) {
      this.resetRowMeasurementObserver();
      const observer = new owner.ResizeObserver((entries) => {
        if (
          this.rowMeasurementObserver !== observer ||
          this.rowMeasurementObserverOwner !== owner ||
          this.rowMeasurementObserverBody !== body ||
          !this.isConnected ||
          this.ownerDocument.defaultView !== owner
        )
          return;
        for (const entry of entries) {
          const target = entry.target as HTMLElement;
          if (target !== body && !this.observedMeasurementElements.has(target)) continue;
          const blockSize = entry.borderBoxSize?.[0]?.blockSize;
          if (blockSize !== undefined && Number.isFinite(blockSize) && blockSize > 0)
            this.observedMeasurementBlockSizes.set(target, blockSize);
          else this.observedMeasurementBlockSizes.delete(target);
        }
        this.syncBodyScrollState(body);
        for (const entry of entries) {
          if (entry.target !== body) continue;
          // The borderBoxSize width is already computed by the browser as part of this entry --
          // reading it costs no forced layout, unlike syncBodyScrollbarInlineEndGutter() and
          // measureRenderedItems() below, so it stays inline rather than deferred.
          const width =
            entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
          if (this.recordMeasuredBodyWidth(width)) {
            this.queueMeasurementUpdate();
            return;
          }
        }
        this.scheduleMeasurementSync();
      });
      this.rowMeasurementObserver = observer;
      this.rowMeasurementObserverOwner = owner;
      this.rowMeasurementObserverBody = body;
      observer.observe(body, { box: 'border-box' });
    }
    const observer = this.rowMeasurementObserver;
    if (!observer) return;
    const current = new Map<HTMLElement, string>();
    this.renderRoot
      .querySelectorAll<HTMLElement>(
        '[data-virtual-item-key], [data-virtual-item-detail-for]'
      )
      .forEach((element) => {
        const key =
          element.dataset['virtualItemKey'] ??
          element.dataset['virtualItemDetailFor'];
        if (key) current.set(element, key);
      });
    for (const element of this.observedMeasurementElements.keys()) {
      if (!current.has(element)) {
        observer.unobserve(element);
        this.observedMeasurementElements.delete(element);
        this.observedMeasurementBlockSizes.delete(element);
      }
    }
    for (const [element, key] of current) {
      if (this.observedMeasurementElements.get(element) === key) continue;
      if (this.observedMeasurementElements.has(element)) observer.unobserve(element);
      this.observedMeasurementElements.set(element, key);
      observer.observe(element, { box: 'border-box' });
    }
  }

  private syncDisplayOffsets(items: readonly DisplayItem<Row>[]): void {
    const estimate = this.measurementRowHeight ?? this.resolvedRowHeight;
    const signature = this.measurementSignature(items);
    if (!this.measuredItemOffsetsDirty && this.measuredItemOffsetSignature === signature &&
        this.measuredItemOffsetEstimate === estimate) return;
    this.measuredOffsets.reset(items.map(item => this.measuredItemHeights.get(displayItemKey(item)) ?? estimate), estimate);
    this.measuredItemOffsetSignature = signature;
    this.measuredItemOffsetEstimate = estimate;
    this.measuredItemOffsetsDirty = false;
  }

  /** A newly measured block changes logarithmically many sums, independent of collection size. */
  private updateOffsetHeight(key: string, height: number): void {
    if (this.measuredItemOffsetsDirty) return;
    const index = this.displayIndexes.get(key);
    if (index === undefined || this.measuredItemOffsetSignature !== this.measurementSignature(this.displayItems)) {
      this.measuredItemOffsetsDirty = true;
      return;
    }
    this.measuredOffsets.set(index, height);
  }

  private displayItemOffset(index: number, items: readonly DisplayItem<Row>[]): number {
    this.syncDisplayOffsets(items);
    return this.measuredOffsets.offsetOf(index);
  }

  private displayItemHeight(index: number, items: readonly DisplayItem<Row>[]): number {
    this.syncDisplayOffsets(items);
    if (index < 0 || index >= items.length) return 0;
    return this.measuredOffsets.heightAt(index);
  }

  private displayItemIndexAtOffset(offset: number, items: readonly DisplayItem<Row>[]): number {
    if (items.length === 0) return -1;
    this.syncDisplayOffsets(items);
    return this.measuredOffsets.indexAt(offset);
  }

  private captureMeasurementAnchor(): DataGridViewportAnchor | undefined {
    const body = this.bodyElement;
    const items = this.displayItems;
    if (!body || items.length === 0) return undefined;
    const scrollTop = finiteRange(body.scrollTop, this.bodyScrollTop, 0);
    return this.measurementAnchorAtOffset(scrollTop, items);
  }

  private measurementAnchorAtOffset(
    scrollTop: number,
    items: readonly DisplayItem<Row>[]
  ): DataGridViewportAnchor | undefined {
    if (items.length === 0) return undefined;
    const index = this.displayItemIndexAtOffset(scrollTop, items);
    const item = items[index];
    if (!item) return undefined;
    const offset = Math.max(0, scrollTop - this.displayItemOffset(index, items));
    const height = this.displayItemHeight(index, items);
    // A viewport can begin in the final divider pixel of a tall measured row. If invalidation then
    // falls back to a shorter estimate, preserving that large intra-row offset skips past the next
    // visible item. Anchor the next stable identity at zero instead, which preserves the content
    // actually leading the viewport across the measurement reset.
    if (index + 1 < items.length && height > 1 && offset >= height - 1) {
      const next = items[index + 1]!;
      return Object.freeze({ itemKey: displayItemKey(next), offset: 0 });
    }
    return Object.freeze({
      itemKey: displayItemKey(item),
      offset,
    });
  }

  private pendingMeasurementAnchor?: DataGridViewportAnchor;

  private correctMeasurementAnchor(): void {
    const anchor = this.pendingMeasurementAnchor;
    const body = this.bodyElement;
    if (!anchor || !body) return;
    const items = this.displayItems;
    const index = (this.displayIndexes.get(anchor.itemKey) ?? -1);
    this.pendingMeasurementAnchor = undefined;
    if (index < 0) {
      this.lastMeasurementAnchor = undefined;
      return;
    }
    const next = Math.max(
      0,
      this.displayItemOffset(index, items) + anchor.offset
    );
    this.expectedBodyScroll = Object.freeze({ body, top: next });
    body.scrollTop = next;
    this.lastMeasurementAnchor = anchor;
    this.queueMeasuredScrollTop(body);
  }

  private measureRenderedItems(): void {
    const previous = this.geometryCycle;
    if (!previous) this.resetGeometryCycle();
    this.geometryCycle = true;
    try { this.measureCurrentItems(); }
    finally { this.geometryCycle = previous; }
  }

  private measureCurrentItems(): void {
    const rowHeightChanged = this.recordMeasurementRowHeight();
    if (rowHeightChanged) this.invalidateRowMeasurements();
    const estimate = this.measurementRowHeight ?? this.resolvedRowHeight;
    const grouped = new Map<string, HTMLElement[]>();
    this.renderRoot
      .querySelectorAll<HTMLElement>(
        '[data-virtual-item-key], [data-virtual-item-detail-for]'
      )
      .forEach((element) => {
        const key =
          element.dataset['virtualItemKey'] ??
          element.dataset['virtualItemDetailFor'];
        if (!key) return;
        const entries = grouped.get(key) ?? [];
        entries.push(element);
        grouped.set(key, entries);
      });
    if (grouped.size === 0) {
      if (rowHeightChanged) this.queueMeasurementUpdate();
      return;
    }
    const anchor = this.captureMeasurementAnchor();
    let changed = false;
    for (const [key, elements] of grouped) {
      let height = 0;
      let measurable = true;
      for (const element of elements) {
        let next: number;
        try {
          next = this.layoutBorderBoxHeight(element);
        } catch {
          measurable = false;
          break;
        }
        if (!Number.isFinite(next) || next <= 0) {
          measurable = false;
          break;
        }
        height += next;
      }
      if (!measurable || !Number.isFinite(height) || height <= 0) continue;
      const previous = this.measuredItemHeights.get(key);
      // A one-pixel row divider is not content height. Keeping that fixed border out of the cache
      // preserves the authored estimate for ordinary one-line rows while still capturing real
      // wrapping/detail growth.
      if (Math.abs(estimate - height) <= 1) {
        if (previous !== undefined) {
          this.measuredItemHeights.delete(key);
          this.updateOffsetHeight(key, estimate);
          changed = true;
        }
        continue;
      }
      if (previous !== undefined && Math.abs(previous - height) <= 0.1)
        continue;
      this.measuredItemHeights.set(key, height);
      this.updateOffsetHeight(key, height);
      changed = true;
    }
    if (!changed) {
      if (rowHeightChanged) this.queueMeasurementUpdate();
      return;
    }
    if (anchor && this.pendingMeasurementAnchor === undefined)
      this.pendingMeasurementAnchor = anchor;
    this.queueMeasurementUpdate();
  }

  /** Returns fractional layout pixels, independent of ancestor transforms and CSS zoom. */
  private layoutBorderBoxHeight(element: HTMLElement): number {
    if (!element.isConnected) return Number.NaN;
    const style = element.ownerDocument.defaultView?.getComputedStyle(element);
    if (!style || style.display === 'none') return Number.NaN;
    const roundedHeight = element.offsetHeight;
    if (roundedHeight <= 0) return Number.NaN;
    const observed = this.observedMeasurementBlockSizes.get(element);
    // A style change can precede the next ResizeObserver delivery. The integer offset height
    // detects a stale cached border box while retaining the observer's fractional precision.
    if (observed !== undefined && Math.abs(observed - roundedHeight) <= 0.5)
      return observed;
    const height = Number.parseFloat(style.height);
    if (style.boxSizing === 'border-box') return height;
    return height +
      Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  }

  /** Returns the measured vertical correction within the body's own viewport. */
  private renderedRowAlignmentDelta(
    target: HTMLElement,
    body: HTMLElement,
    alignment: 'start' | 'center' | 'end' | 'nearest'
  ): number {
    let targetTop: number;
    let targetBottom: number;
    const style = target.ownerDocument.defaultView?.getComputedStyle(target);
    const visuallyTransformed = style && (
      style.position === 'sticky' ||
      style.transform !== 'none' ||
      (style.translate && style.translate !== 'none') ||
      (style.scale && style.scale !== 'none') ||
      (style.rotate && style.rotate !== 'none') ||
      (style.zoom && style.zoom !== '1' && style.zoom !== 'normal')
    );
    if (target.offsetParent === body && !visuallyTransformed) {
      // Rendered rows are direct children of the positioned body. Their offsets stay in the
      // body's layout pixels even when an ancestor scales or zooms the rendered rectangles.
      targetTop = target.offsetTop - body.scrollTop;
      targetBottom = targetTop + target.offsetHeight;
    } else {
      const targetRect = target.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      const bodyLayoutHeight = this.layoutBorderBoxHeight(body);
      const scaleY = bodyLayoutHeight > 0 && bodyRect.height > 0
        ? finiteRange(bodyRect.height / bodyLayoutHeight, 1, Number.EPSILON)
        : 1;
      targetTop = (targetRect.top - bodyRect.top) / scaleY - body.clientTop;
      targetBottom = (targetRect.bottom - bodyRect.top) / scaleY - body.clientTop;
    }
    const viewportBottom = body.clientHeight;
    if (alignment === 'center')
      return (targetTop + targetBottom - viewportBottom) / 2;
    if (alignment === 'end') return targetBottom - viewportBottom;
    if (alignment === 'start') return targetTop;
    const outsideTop = targetTop < 0;
    const outsideBottom = targetBottom > viewportBottom;
    // Native nearest does not move a row already inside, or one spanning both viewport edges.
    if (outsideTop === outsideBottom) return 0;
    const oversized = targetBottom - targetTop > body.clientHeight;
    if (outsideTop)
      return oversized ? targetBottom - viewportBottom : targetTop;
    return oversized ? targetTop : targetBottom - viewportBottom;
  }

  /** Corrects the painted start edge after CSSOM snaps a rendered row's scroll offset. */
  private renderedStartPrecisionDelta(target: HTMLElement, body: HTMLElement): number {
    const bodyRect = body.getBoundingClientRect();
    const layoutHeight = this.layoutBorderBoxHeight(body);
    const scaleY = bodyRect.height / layoutHeight;
    if (!Number.isFinite(scaleY) || scaleY <= 0) return 0;
    const style = body.ownerDocument.defaultView?.getComputedStyle(body);
    // A computed border width is always a non-negative length; an unreadable one yields NaN, which
    // makes the visual error NaN and the correction 0 below.
    const borderTop = Number.parseFloat(style?.borderTopWidth ?? '');
    const visualError = target.getBoundingClientRect().top -
      (bodyRect.top + borderTop * scaleY);
    return Math.abs(visualError) > 1 ? visualError / scaleY : 0;
  }

  /** Replays a virtual scroll command only after its target's measured offsets are stable. */
  private alignPendingVirtualScroll(): void {
    const pending = this.pendingVirtualScroll;
    if (
      !pending ||
      this.measurementUpdateQueued ||
      this.measurementScrollSyncQueued ||
      this.pendingMeasurementAnchor !== undefined
    )
      return;
    const exists = this.displayIndexes.has(pending.itemKey);
    if (!exists) {
      this.pendingVirtualScroll = undefined;
      return;
    }
    const target = [...this.renderRoot.querySelectorAll<HTMLElement>(
      '[part~="row"][data-virtual-item-key]'
    )].find((element) => element.dataset['virtualItemKey'] === pending.itemKey);
    const body = this.bodyElement;
    if (!target || !body) return;
    const layoutDelta = this.renderedRowAlignmentDelta(target, body, pending.align);
    const precisionDelta = pending.align === 'start'
      ? this.renderedStartPrecisionDelta(target, body)
      : 0;
    // CSSOM scroll offsets round fractional pixels differently across engines. Half a layout
    // pixel is the closest reachable integer scroll position; a whole pixel can exceed the
    // visible alignment tolerance under CSS zoom.
    if (Math.abs(layoutDelta) <= 0.5 && precisionDelta === 0) {
      this.pendingVirtualScroll = undefined;
      return;
    }
    const alignmentDelta = Math.abs(layoutDelta) > 0.5
      ? layoutDelta
      : precisionDelta;
    const previousTop = body.scrollTop;
    const nextTop = finiteRange(
      previousTop + alignmentDelta,
      previousTop,
      0,
      Math.max(0, body.scrollHeight - body.clientHeight)
    );
    body.scrollTo({ top: nextTop });
    if (precisionDelta !== 0) {
      const remaining = this.renderedStartPrecisionDelta(target, body);
      if (Math.abs(remaining) >= Math.abs(precisionDelta)) {
        body.scrollTo({ top: previousTop });
        this.pendingVirtualScroll = undefined;
      }
    }
    // Alignment can change the virtual window itself. Keep the command until that window
    // commits, otherwise replacing overscan rows with estimated spacers shifts the target.
    if (body.scrollTop === previousTop) this.pendingVirtualScroll = undefined;
    else {
      this.expectedBodyScroll = Object.freeze({ body, top: body.scrollTop });
      this.queueMeasurementUpdate();
    }
    this.queueBodyScrollStateSync();
  }

  private geometryCycle = false;
  private resetGeometryCycle(): void {
    this.cycleRowHeight = undefined;
    this.cycleColumnEstimate = undefined;
    this.cycleFontSignature = undefined;
  }
  private cycleRowHeight?: number;
  private cycleColumnEstimate?: number;
  private cycleFontSignature?: string;

  private get resolvedRowHeight(): number {
    if (this.geometryCycle && this.cycleRowHeight !== undefined) return this.cycleRowHeight;
    const raw = this.computedToken(
      '--row-height',
      '--_lr-data-grid-row-height'
    );
    const targetFloor = resolveCssTokenLength(this.computedToken('--_lr-density-target-min'), { host: this }) ?? 0;
    return this.cycleRowHeight = finiteRange(resolveCssTokenLength(raw, { host: this }) ?? 56, 56, Math.max(24, targetFloor));
  }

  /** Counts expanded detail rows before each display position, once per projection/expansion. */
  private detailRowOffsets(items: readonly DisplayItem<Row>[]): readonly number[] {
    if (!this.rowDetail) return [0];
    return this.memoize('detailRowOffsets', [items, this.expandedKeys, this.rowDetail], () => {
      const offsets = [0];
      for (const item of items) {
        offsets.push(offsets[offsets.length - 1]! +
          (item.kind === 'row' && arrayHasKey(this.expandedKeys, item.key) ? 1 : 0));
      }
      return offsets;
    });
  }

  private get virtualWindow(): {
    items: DisplayItem<Row>[];
    allItems: DisplayItem<Row>[];
    start: number;
    end: number;
  } {
    const items = this.displayItems;
    const disable =
      items.length < VIRTUALIZATION_THRESHOLD ||
      this.computedToken('--max-height', '--_lr-data-grid-max-height') ===
        'none';
    if (disable) return { items, allItems: items, start: 0, end: items.length };
    const height = this.resolvedRowHeight;
    const viewport = Math.max(height, this.viewportHeight || height * 10);
    const firstVisible = this.displayItemIndexAtOffset(this.bodyScrollTop, items);
    const lastVisible = this.displayItemIndexAtOffset(
      this.bodyScrollTop + viewport,
      items
    );
    const start = Math.max(0, firstVisible - VIRTUAL_OVERSCAN);
    const end = Math.min(items.length, lastVisible + VIRTUAL_OVERSCAN + 1);
    return { items: items.slice(start, end), allItems: items, start, end };
  }

  private naturalColumnInputs?: readonly unknown[];

  private columnGeometryInputs(): readonly unknown[] {
    return [this.visibleColumns, this.columnWidths, this.measuredBodyWidth,
      this.selectionEnabled, this.currentMeasurementFontSignature(), this.pipelineEpoch,
      this.processedClientRows, this.estimatedColumnWidth({} as DataGridColumn<Row>, '')];
  }

  private sameColumnGeometry(left: readonly unknown[] | undefined, right: readonly unknown[]): boolean {
    return left?.length === right.length && left.every((input, index) => Object.is(input, right[index]));
  }

  private get gridTemplate(): string {
    const inputs = this.columnGeometryInputs();
    if (this.visibleColumns.length > 50 && this.resolvedColumnWidths &&
        this.sameColumnGeometry(this.resolvedColumnInputs, inputs)) {
      return this.memoize('resolvedGridTemplate', [this.resolvedColumnWidths, this.selectionEnabled], () => {
        const tracks = this.resolvedColumnWidths!.map(width => `${width}px`);
        if (this.selectionEnabled) tracks.unshift('var(--lr-icon-button-size)');
        return tracks.join(' ');
      });
    }
    this.naturalColumnInputs = inputs;
    return this.memoize('gridTemplate', [this.visibleColumns, this.columnWidths, this.selectionEnabled], () => this.computeGridTemplate());
  }

  private computeGridTemplate(): string {
    const columns = this.visibleColumns.map(({ column, id }) => {
      const bounds = this.columnBounds(column);
      const width = this.columnWidths.get(id) ?? column.width;
      if (width !== undefined && Number.isFinite(width) && width > 0)
        return `${finiteRange(
          width,
          bounds.minimum,
          bounds.minimum,
          bounds.maximum
        )}px`;
      const minimum =
        bounds.minimum > 0
          ? `${bounds.minimum}px`
          : Number.isFinite(column.maxWidth) && (column.maxWidth ?? 0) > 0
          ? '0px'
          : 'var(--lr-size-7rem)';
      const maximum =
        Number.isFinite(column.maxWidth) && (column.maxWidth ?? 0) > 0
          ? `${bounds.maximum}px`
          : `${finiteRange(column.flex ?? 1, 1, 0)}fr`;
      return `minmax(${minimum}, ${maximum})`;
    });
    if (this.selectionEnabled) columns.unshift('var(--lr-icon-button-size)');
    return columns.length > 0
      ? columns.join(' ')
      : 'minmax(var(--lr-size-7rem), 1fr)';
  }

  private resolvedColumnWidths?: readonly number[];
  private resolvedColumnInputs?: readonly unknown[];

  /** CSS resolves fractional, flexible and content-constrained tracks; offsets use that same layout. */
  private syncResolvedColumnWidths(): void {
    const inputs = this.columnGeometryInputs();
    if (this.sameColumnGeometry(this.resolvedColumnInputs, inputs)) return;
    // Allocation can change after rendering; restore natural tracks before measuring again.
    if (!this.sameColumnGeometry(this.naturalColumnInputs, inputs)) {
      this.queueMeasurementUpdate();
      return;
    }
    const row = this.renderRoot.querySelector<HTMLElement>('[part~="row"]') ??
      this.renderRoot.querySelector<HTMLElement>('[part="header"]');
    const owner = this.ownerDocument.defaultView;
    if (!row || typeof owner?.getComputedStyle !== 'function') return;
    let tracks: number[];
    try {
      tracks = owner.getComputedStyle(row).gridTemplateColumns.split(/\s+/u).map(value => Number.parseFloat(value));
    } catch { return; }
    const widths = this.selectionEnabled ? tracks.slice(1) : tracks;
    if (widths.length !== this.visibleColumns.length || widths.some(width => !Number.isFinite(width) || width < 0)) return;
    this.resolvedColumnInputs = inputs;
    this.queueMeasurementUpdate();
    if (this.resolvedColumnWidths?.length === widths.length &&
        this.resolvedColumnWidths.every((width, index) => Math.abs(width - widths[index]!) < 0.01)) return;
    this.resolvedColumnWidths = widths;
    this.queueMeasurementUpdate();
  }

  private get columnLayout() {
    const columns = this.visibleColumns;
    const estimate = this.estimatedColumnWidth({} as DataGridColumn<Row>, '');
    return this.memoize('columnLayout', [columns, this.columnWidths, estimate, this.selectionEnabled, this.resolvedColumnWidths], () => {
      const offsets = [0];
      const positions = new Map<string, number>();
      const pins = new Map<string, number>();
      const pinned: number[] = [];
      let left = 0;
      let right = 0;
      columns.forEach(({ column, id }, position) => {
        positions.set(id, position);
        const width = this.resolvedColumnWidths?.[position] ?? this.estimatedColumnWidth(column, id);
        offsets.push(offsets[position]! + width);
        if (normalizePinSide(this.getColumnPin(id)) === 'left') {
          pins.set(id, left); left += width; pinned.push(position);
        }
      });
      for (let index = columns.length - 1; index >= 0; index -= 1) {
        const { column, id } = columns[index]!;
        if (normalizePinSide(this.getColumnPin(id)) === 'right') {
          pins.set(id, right); right += this.resolvedColumnWidths?.[index] ?? this.estimatedColumnWidth(column, id); pinned.push(index);
        }
      }
      return { offsets, positions, pins, pinned };
    });
  }

  /** Keep complete CSS tracks while mounting only cells intersecting the inline viewport. */
  private get windowColumns() {
    const columns = this.visibleColumns;
    const layout = this.columnLayout;
    if (columns.length <= 50) return columns.map((entry, position) => ({ ...entry, position }));
    const at = (offset: number): number => {
      let low = 0; let high = columns.length - 1;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (layout.offsets[middle + 1]! <= offset) low = middle + 1;
        else high = middle;
      }
      return low;
    };
    const start = Math.max(0, at(this.bodyScrollInlineOffset) - 2);
    const end = Math.min(columns.length, at(this.bodyScrollInlineOffset + (this.measuredBodyWidth || 1120)) + 3);
    const positions = new Set(layout.pinned);
    positions.add(this.focusedColumn);
    if (this.selectionEnabled || this.childRows || this.rowDetail) positions.add(0);
    for (let index = start; index < end; index += 1) positions.add(index);
    return [...positions].sort((a, b) => a - b).flatMap(position => {
      const entry = columns[position];
      return entry ? [{ ...entry, position }] : [];
    });
  }

  /** Physical header/footer translation derived from the body's normalized logical inline offset. */
  private get bodyScrollTranslation(): string {
    const logical = finiteRange(
      this.bodyScrollInlineOffset,
      0,
      0,
      Number.MAX_SAFE_INTEGER
    );
    const physical = this.effectiveDirection === 'rtl' ? logical : -logical;
    return `${physical}px`;
  }

  private columnStyle(
    column: DataGridColumn<Row>,
    id: string
  ): Record<string, string> {
    const cache = this.memoize('columnStyles', [this.columnLayout, this.selectionEnabled], () => new Map<string, Record<string, string>>());
    const cached = cache.get(id);
    if (cached) return cached;
    const side = normalizePinSide(this.getColumnPin(id));
    const pinOffset = side ? this.pinOffset(id, side) : 0;
    const style = {
      'grid-column': String((this.columnLayout.positions.get(id) ?? 0) + 1 + (this.selectionEnabled ? 1 : 0)),
      ...(side ? { '--pin-offset': `${pinOffset}px` } : {}),
      ...(Number.isFinite(column.width) &&
      (column.width ?? 0) > 0 &&
      !this.columnWidths.has(id)
        ? { '--column-authored-width': `${column.width}px` }
        : {}),
    };
    cache.set(id, style);
    return style;
  }

  private estimatedColumnWidth(
    column: DataGridColumn<Row>,
    id: string
  ): number {
    const { minimum, maximum } = this.columnBounds(column);
    const explicit = this.columnWidths.get(id) ?? column.width;
    if (explicit !== undefined && Number.isFinite(explicit) && explicit > 0)
      return finiteRange(explicit, Math.max(112, minimum), minimum, maximum);
    if (!this.geometryCycle) this.cycleColumnEstimate = undefined;
    this.cycleColumnEstimate ??= resolveCssTokenLength(this.computedToken('--lr-size-7rem'), { host: this }) ?? 112;
    return finiteRange(
      this.cycleColumnEstimate,
      Math.max(112, minimum),
      minimum,
      maximum
    );
  }

  private columnBounds(column: DataGridColumn<Row>): {
    readonly minimum: number;
    readonly maximum: number;
  } {
    const minimum = finiteRange(column.minWidth ?? 0, 0, 0);
    const authoredMaximum = finiteRange(
      column.maxWidth ?? Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER,
      0
    );
    return Object.freeze({
      minimum,
      maximum: Math.max(minimum, authoredMaximum),
    });
  }

  private pinOffset(id: string, _side: 'left' | 'right'): number {
    return this.columnLayout.pins.get(id) ?? 0;
  }

  private columnLabel(column: DataGridColumn<Row>, id: string): string {
    // An explicitly blank (or whitespace-only) label carries no useful information -- it falls
    // back to the humanized field/id exactly like an omitted label, rather than rendering an
    // empty, still keyboard-focusable columnheader.
    return column.label !== undefined && column.label.trim().length > 0
      ? column.label
      : humanizeIdentifier(column.field ?? id, this.effectiveLocale);
  }

  private columnIsSortable(column: DataGridColumn<Row>): boolean {
    return column.sortable !== false && Boolean(column.field || column.value);
  }

  private sortFor(id: string): {
    state: DataGridSortingState[number] | undefined;
    index: number;
  } {
    const index = this.sort.findIndex((item) => item.id === id);
    return { state: index >= 0 ? this.sort[index] : undefined, index };
  }

  private activateSort(id: string, additive: boolean): void {
    const entry = this.columnIndex.get(id);
    if (!entry || !this.columnIsSortable(entry.column)) return;
    const currentSort = this.sort;
    const existing = this.sortFor(id).state;
    const descendingFirst = entry.column.sortDescFirst ?? this.sortDescFirst;
    let replacement: DataGridSortingState[number] | undefined;
    if (!existing) replacement = { id, desc: descendingFirst };
    else if (existing.desc === descendingFirst)
      replacement = { id, desc: !descendingFirst };
    else if (this.withoutSortRemoval)
      replacement = { id, desc: descendingFirst };

    let next = additive ? this.sort.filter((item) => item.id !== id) : [];
    if (replacement) next.push(replacement);
    const limit = finiteCount(this.maxMultiSort);
    if (limit > 0 && next.length > limit)
      next = next.slice(next.length - limit);
    const proposedSort = freezeSnapshot(
      next.map((item) => Object.freeze({ ...item }))
    );
    const requestEvent = this.emit(
      'lr-sort-request',
      Object.freeze({ sort: proposedSort }),
      { cancelable: true }
    );
    // A listener may have disconnected the grid, swapped the columns or written `sort`: the
    // proposal was computed from the earlier state, so it no longer applies.
    if (requestEvent.defaultPrevented || !this.isConnected || this.columnIndex.get(id) !== entry || this.sort !== currentSort) return;
    const previousPage = this.page;
    this.sort = next;
    this.page = 0;
    const primary = proposedSort[0];
    this.emit('lr-sort', Object.freeze({ phase: 'commit', sortKey: primary?.id ?? '', sortDir: primary ? (primary.desc ? 'desc' : 'asc') : null, sort: proposedSort } as const));
    this.emit('lr-sort-change', Object.freeze({ sort: proposedSort }));
    this.emitPageReset(previousPage);
  }

  /** A user query change (sort, filter, search) returns to the first page; report the page change
   *  the reset caused so a server-driven consumer does not keep requesting the old page. */
  private emitPageReset(previousPage: number): void {
    if (previousPage === 0 || this.page !== 0 || !this.isConnected) return;
    this.emit('lr-page-change', Object.freeze({ page: 0, pageSize: this.safePageSize }));
  }

  private onHeaderClick(event: MouseEvent, id: string): void {
    const target = event.target;
    const interactive = isElementValue(target)
      ? target.closest(NESTED_INTERACTIVE_SELECTOR)
      : null;
    if (interactive && interactive !== event.currentTarget) return;
    this.activateSort(id, event.shiftKey);
  }

  private onFilterInput(event: Event, id: string): void {
    const control = valueControl(event.currentTarget);
    if (!control) return;
    this.commitFilterValue(id, control.value);
  }

  private commitFilterValue(id: string, value: string): void {
    const next = this.filters.filter((filter) => filter.id !== id);
    if (value) next.push({ id, value });
    this.filters = next;
    const previousPage = this.page;
    this.page = 0;
    this.emit(
      'lr-filter-change',
      Object.freeze({
        filters: freezeSnapshot(
          next.map((filter) => Object.freeze({ ...filter }))
        ),
      })
    );
    this.emitPageReset(previousPage);
  }

  // The native `::-webkit-search-cancel-button` reset in data-grid.styles.ts removes the
  // browser's own clear affordance from the per-column filter panel with no replacement -- this
  // button, and the filter input's refocus afterward, restore a real one-click way to reset it.
  private onClearFilterInput(id: string): void {
    if (!this.filtersById.has(id)) return;
    this.commitFilterValue(id, '');
    this.renderRoot
      .querySelector<HTMLInputElement>(`[part="filter-panel"] input[type="search"]`)
      ?.focus();
  }

  /** Reads the authoritative body position after native scrolling or a layout-driven clamp. */
  private syncBodyScrollState(source: unknown = this.bodyElement): void {
    const target = source as
      | (Element & {
          scrollTop?: unknown;
          scrollLeft?: unknown;
          scrollWidth?: unknown;
          clientHeight?: unknown;
          clientWidth?: unknown;
        })
      | null;
    if (
      !isElementValue(target) ||
      typeof target.scrollTop !== 'number' ||
      typeof target.clientHeight !== 'number' ||
      typeof target.scrollLeft !== 'number'
    )
      return;
    this.bodyScrollTop = finiteRange(target.scrollTop, this.bodyScrollTop, 0);
    this.viewportHeight = finiteRange(target.clientHeight, this.viewportHeight, 0);
    const inlineExtent =
      typeof target.scrollWidth === 'number' &&
      typeof target.clientWidth === 'number' &&
      Number.isFinite(target.scrollWidth) &&
      Number.isFinite(target.clientWidth)
        ? Math.max(0, target.scrollWidth - target.clientWidth)
        : Number.MAX_SAFE_INTEGER;
    // CSSOM View normalizes RTL scrollLeft from 0 at logical inline start down to a negative
    // extent at logical inline end. Store one positive logical distance, then render the physical
    // translation once for the non-scrolling header/footer rows.
    this.bodyScrollInlineOffset = finiteRange(
      this.effectiveDirection === 'rtl' ? -target.scrollLeft : target.scrollLeft,
      0,
      0,
      inlineExtent
    );
  }

  private onBodyScroll(event: Event): void {
    // Layout correction can synchronously dispatch scroll before the target is recorded.
    if (this.geometryCycle) {
      this.queueBodyScrollStateSync();
      return;
    }
    const body = event.currentTarget;
    this.syncBodyScrollState(body);
    const expected = this.expectedBodyScroll;
    if (
      expected &&
      expected.body === body &&
      Math.abs(
        finiteRange(
          (body as HTMLElement).scrollTop,
          this.bodyScrollTop,
          0
        ) - expected.top
      ) <= 1
    ) {
      this.expectedBodyScroll = undefined;
    } else {
      this.expectedBodyScroll = undefined;
      // A native scroll between an estimated jump and later measurement reconciliation is newer
      // user intent. Neither a stale stable-key anchor nor a deferred target may pull it back.
      this.pendingMeasurementAnchor = undefined;
      this.pendingVirtualScroll = undefined;
    }
    this.lastMeasurementAnchor = this.captureMeasurementAnchor();
  }

  private onBodyCellEvent(event: Event): void {
    const cell = event.composedPath().find((node): node is HTMLElement =>
      isElementValue(node) && node.hasAttribute('data-row-position') && node.hasAttribute('data-column-id'));
    if (!cell) return;
    const rowPosition = Number(cell.dataset['rowPosition']);
    const columnPosition = Number(cell.dataset['columnPosition']);
    const item = this.displayItems[rowPosition];
    const id = cell.dataset['columnId']!;
    const entry = this.columnIndex.get(id);
    if (!item || item.kind !== 'row' || !entry) return;
    if (event.type === 'focusin') {
      this.focusedRow = rowPosition;
      this.focusedColumn = columnPosition;
    } else if (event.type === 'click') {
      this.onCellClick(event as MouseEvent, item, entry.column, id, rowPosition, cell);
    } else if (event.type === 'contextmenu') {
      this.emitCellContextMenu(event as MouseEvent, item, entry.column, id, rowPosition);
    } else if (event.type === 'keydown') {
      this.onGridKeyDown(event as KeyboardEvent, rowPosition, columnPosition, item, entry.column, id, cell);
    }
  }

  private onCellClick(
    event: MouseEvent,
    item: DataDisplayRow<Row>,
    column: DataGridColumn<Row>,
    columnIdValue: string,
    index: number,
    cell: EventTarget | null = event.currentTarget
  ): void {
    for (const target of event.composedPath()) {
      if (target === cell) break;
      if (isElementValue(target) && target.matches(NESTED_INTERACTIVE_SELECTOR)) return;
    }
    this.emit(
      'lr-cell-click',
      Object.freeze({
        rowKey: item.key,
        columnId: columnIdValue,
        column,
        value: columnValue(column, item.row),
        row: item.row,
        index,
      })
    );
  }

  private emitCellContextMenu(
    originalEvent: MouseEvent | KeyboardEvent,
    item: DataDisplayRow<Row>,
    column: DataGridColumn<Row>,
    columnIdValue: string,
    index: number
  ): void {
    const detail: DataGridCellContextMenuDetail<Row> = Object.freeze({
      rowKey: item.key,
      columnId: columnIdValue,
      column,
      value: columnValue(column, item.row),
      row: item.row,
      index,
      originalEvent,
    });
    const emitted = this.emit('lr-cell-contextmenu', detail, {
      cancelable: true,
    });
    if (emitted.defaultPrevented) originalEvent.preventDefault();
  }

  private descendantRows(row: Row): Row[] {
    const result: Row[] = [];
    const visited = new Set<unknown>();
    const stack = this.canonicalMembers(this.childrenFor(row))
      .reverse()
      .map((child) => ({ row: child, depth: 1 }));
    while (stack.length > 0 && result.length < this.rowLimit) {
      const current = stack.pop()!;
      const trackIdentity =
        (typeof current.row === 'object' && current.row !== null) ||
        typeof current.row === 'function';
      if (trackIdentity && visited.has(current.row)) continue;
      if (trackIdentity) visited.add(current.row);
      result.push(current.row);
      if (current.depth >= DATA_GRID_TREE_DEPTH_LIMIT) continue;
      const children = this.canonicalMembers(this.childrenFor(current.row));
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index]!;
        stack.push({ row: child, depth: current.depth + 1 });
      }
    }
    return result;
  }

  private setRowSelected(
    item: DataDisplayRow<Row>,
    selected: boolean,
    event?: MouseEvent
  ): void {
    if (!this.rowIsSelectable(item.row)) return;
    const { items: selectableItems, positions } = this.memoize('selectableDisplay',
      [this.displayItems, this.selectable, this.selectableRows], () => {
        const items = this.displayItems.filter((candidate): candidate is DataDisplayRow<Row> =>
          candidate.kind === 'row' && this.rowIsSelectable(candidate.row));
        return { items, positions: new Map(items.map((candidate, position) => [candidate.key, position])) };
      });
    const position = positions.get(item.key) ?? -1;
    let affected = [item];
    if (
      event?.shiftKey &&
      this.selectionMode === 'multiple' &&
      this.lastSelectedIndex >= 0
    ) {
      const from = Math.min(this.lastSelectedIndex, position);
      const to = Math.max(this.lastSelectedIndex, position);
      affected = selectableItems.slice(from, to + 1);
    }
    const descendants =
      this.selectionMode === 'multiple'
        ? affected
            .flatMap((candidate) => this.descendantRows(candidate.row))
            .filter((row) => this.rowIsSelectable(row))
        : [];
    const sourceIndexes = this.sourceIndexMap();
    const keys = [
      ...affected.map((candidate) => candidate.key),
      ...descendants.map((row, index) => {
        const sourceIndex = this.sourceIndexFor(row, sourceIndexes);
        return this.keyForRow(row, sourceIndex ?? index);
      }),
    ];
    // Each affected key leaves its old place and, when selecting, is appended in the order of its
    // last occurrence -- in one pass instead of one filter over the selection per affected key.
    const ordered = new Map<string, DataGridKey>();
    for (const key of keys) {
      const typed = typedKey(key);
      ordered.delete(typed);
      ordered.set(typed, key);
    }
    const next =
      this.selectionMode === 'single'
        ? []
        : this.selectedKeys.filter((candidate) => !ordered.has(typedKey(candidate)));
    if (selected) next.push(...ordered.values());
    if (this.commitSelection(next)) this.lastSelectedIndex = position;
  }

  private selectCurrentPage(selected: boolean): void {
    const pageKeys = this.currentPageSelectableRows.map((item) => item.key);
    const pageKeySet = new Set(pageKeys.map(typedKey));
    let next = this.selectedKeys.filter((key) => !pageKeySet.has(typedKey(key)));
    if (selected) next = [...next, ...pageKeys];
    this.commitSelection(next);
  }

  private commitSelection(next: DataGridKey[]): boolean {
    const { selectedKeys, data, rowKey, selectionMode, displayItems, selectableRows } = this;
    if (sameKeySet(selectedKeys, next)) return true;
    const detail = Object.freeze({ selectedRowKeys: freezeSnapshot(next) });
    if (this.emit('lr-selection-request', detail, { cancelable: true }).defaultPrevented || !this.isConnected ||
      this.selectedKeys !== selectedKeys || this.data !== data || this.rowKey !== rowKey ||
      this.selectionMode !== selectionMode || this.displayItems !== displayItems || this.selectableRows !== selectableRows) {
      super.requestUpdate();
      return false;
    }
    this.selectedKeys = next;
    this.emitSelection();
    return true;
  }

  private emitSelection(): void {
    const selectedRowKeys = freezeSnapshot(this.selectedRowKeys);
    const selectedRows = freezeSnapshot(this.selectedRows);
    const detail = Object.freeze({ selectedRowKeys, selectedKeys: selectedRowKeys, selectedRows });
    this.emit('lr-selection-change', detail);
    this.emit('lr-row-select', detail);
  }

  private rowSelectionState(item: DataDisplayRow<Row>): { checked: boolean; indeterminate: boolean } {
    const states = this.memoize('selectionStates', [this.allSourceRows, this.selectedKeys,
      this.selectable, this.selectableRows, this.childRows], () => {
      const result = new Map<Row, { checked: boolean; indeterminate: boolean }>();
      if (!this.childRows || this.selectionMode !== 'multiple') return result;
      const byIdentity = this.canonicalRowIndex();
      const children = new Map<Row, Row[]>();
      const parentCounts = new Map<Row, number>();
      for (const row of this.allSourceRows) {
        const nested = this.canonicalMembers(this.childrenFor(row), byIdentity);
        children.set(row, nested);
        for (const child of nested) parentCounts.set(child, (parentCounts.get(child) ?? 0) + 1);
      }
      // Graph-shaped child providers need unique-descendant semantics instead of tree sums.
      if ([...parentCounts.values()].some(count => count > 1)) return result;
      const totals = new Map<Row, { count: number; selected: number }>();
      const visiting = new Set<Row>();
      const visit = (row: Row, depth: number): boolean => {
        if (totals.has(row)) return true;
        if (visiting.has(row) || depth > DATA_GRID_TREE_DEPTH_LIMIT) return false;
        visiting.add(row);
        let count = 0; let selected = 0;
        for (const child of children.get(row) ?? []) {
          if (!visit(child, depth + 1)) return false;
          const total = totals.get(child)!;
          count += total.count; selected += total.selected;
        }
        const own = arrayHasKey(this.selectedKeys, this.rowIdentity(row)!);
        const checked = own && selected === count;
        result.set(row, { checked, indeterminate: !checked && (own || selected > 0) });
        const eligible = this.rowIsSelectable(row);
        totals.set(row, { count: count + (eligible ? 1 : 0), selected: selected + (eligible && own ? 1 : 0) });
        visiting.delete(row);
        return true;
      };
      for (const row of this.allSourceRows) if (!visit(row, 0)) { result.clear(); break; }
      return result;
    });
    let state = states.get(item.row);
    if (!state) { state = this.computeRowSelectionState(item); states.set(item.row, state); }
    return state;
  }

  private computeRowSelectionState(item: DataDisplayRow<Row>): {
    checked: boolean;
    indeterminate: boolean;
  } {
    const own = arrayHasKey(this.selectedKeys, item.key);
    if (this.selectionMode !== 'multiple')
      return { checked: own, indeterminate: false };
    const descendants = this.descendantRows(item.row).filter((row) =>
      this.rowIsSelectable(row)
    );
    if (descendants.length === 0) return { checked: own, indeterminate: false };
    const sourceIndexes = this.sourceIndexMap();
    const selected = descendants.filter((row, index) => {
      const sourceIndex = this.sourceIndexFor(row, sourceIndexes);
      return arrayHasKey(
        this.selectedKeys,
        this.keyForRow(row, sourceIndex ?? index)
      );
    }).length;
    const checked = own && selected === descendants.length;
    return {
      checked,
      indeterminate: !checked && (own || selected > 0),
    };
  }

  private toggleRowExpanded(
    item: DataDisplayRow<Row>,
    emitUserEvent: boolean
  ): void {
    const { expandedKeys, data, rowKey, rowDetail, childRows } = this;
    const expanded = arrayHasKey(expandedKeys, item.key);
    const detail = Object.freeze({ rowKey: item.key, key: item.key, row: item.row, expanded: !expanded });
    if (emitUserEvent && (this.emit('lr-row-expand-request', detail, { cancelable: true }).defaultPrevented ||
      !this.isConnected || this.expandedKeys !== expandedKeys || this.data !== data ||
      this.rowKey !== rowKey || this.rowDetail !== rowDetail || this.childRows !== childRows)) return;
    if (expanded) this.collapseRow(item.key);
    else this.expandRow(item.key);
    if (emitUserEvent) {
      this.emit('lr-row-expand-toggle', detail);
      this.emit(
        expanded ? 'lr-row-collapse' : 'lr-row-expand',
        Object.freeze({
          rowKey: item.key,
          key: item.key,
          row: item.row,
        })
      );
    }
  }

  private toggleGroupExpanded(item: DataDisplayGroup<Row>): void {
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    if (expanded) this.collapseRow(item.key);
    else this.expandRow(item.key);
    const detail = Object.freeze({
      key: item.key,
      columnId: item.columnId,
      value: item.value,
      rows: freezeSnapshot(item.rows),
    });
    this.emit(expanded ? 'lr-group-collapse' : 'lr-group-expand', detail);
  }

  private moveColumn(id: string, delta: number, emitUserEvent: boolean): void {
    const order = this.orderedColumns.map((entry) => entry.id);
    const from = order.indexOf(id);
    if (from < 0) return;
    const to = finiteInteger(from + delta, from, 0, order.length - 1);
    if (from === to) return;
    order.splice(from, 1);
    order.splice(to, 0, id);
    this.columnOrder = order;
    if (emitUserEvent)
      this.emit(
        'lr-column-move',
        Object.freeze({
          columnOrder: freezeSnapshot(order),
          columnId: id,
          finished: true,
        })
      );
  }

  private columnCanMove(id: string): boolean {
    const entry = this.columnIndex.get(id);
    return Boolean(entry && (this.reorderable || entry.column.movable));
  }

  private columnCanResize(id: string): boolean {
    const entry = this.columnIndex.get(id);
    return Boolean(entry && (this.resizable || entry.column.resizable));
  }

  private onDragStart(event: DragEvent, id: string): void {
    const entry = this.columnIndex.get(id);
    if (!entry || !this.columnCanMove(id) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const token = `${++this.columnDragSequence}:${id}`;
    this.columnDragSession = Object.freeze({ sourceId: id, token });
    event.dataTransfer.setData(DATA_GRID_DRAG_TYPE, token);
    event.dataTransfer.setData('text/plain', id);
    event.dataTransfer.effectAllowed = 'move';
    this.dragGhost = this.columnLabel(entry.column, id);
    const { clientX, clientY } = event;
    void this.updateComplete.then(() => this.positionDragGhost(clientX, clientY));
  }

  /** Places the drag preview at the pointer, clamped inside the grid box so the grid's own
   *  clipping and any clipping ancestor never cut it off. */
  private positionDragGhost(clientX: number, clientY: number): void {
    const ghost = this.renderRoot.querySelector<HTMLElement>('[part="drag-ghost"]');
    const box = ghost?.parentElement;
    if (!ghost || !box) return;
    const bounds = box.getBoundingClientRect();
    const maxX = Math.max(0, box.clientWidth - ghost.offsetWidth);
    const maxY = Math.max(0, box.clientHeight - ghost.offsetHeight);
    const x = finiteRange(clientX - bounds.left - box.clientLeft, 0, 0, maxX);
    const y = finiteRange(clientY - bounds.top - box.clientTop, 0, 0, maxY);
    ghost.style.translate = `${x}px ${y}px`;
  }

  private onDrop(event: DragEvent, targetId: string): void {
    event.preventDefault();
    const session = this.columnDragSession;
    const token = event.dataTransfer?.getData(DATA_GRID_DRAG_TYPE);
    const sourceId = session?.sourceId;
    this.columnDragSession = undefined;
    this.dragGhost = '';
    if (
      !session ||
      token !== session.token ||
      !sourceId ||
      sourceId === targetId ||
      !this.columnCanMove(sourceId) ||
      !this.columnCanMove(targetId)
    )
      return;
    const order = this.orderedColumns.map((entry) => entry.id);
    const source = order.indexOf(sourceId);
    const target = order.indexOf(targetId);
    if (source < 0 || target < 0) return;
    order.splice(source, 1);
    order.splice(target, 0, sourceId);
    this.columnOrder = order;
    this.emit(
      'lr-column-move',
      Object.freeze({
        columnOrder: freezeSnapshot(order),
        columnId: sourceId,
        finished: true,
      })
    );
  }

  private onResizeStart(event: PointerEvent, id: string): void {
    const entry = this.columnIndex.get(id);
    if (!entry || !this.columnCanResize(id)) return;
    this.resizePointer.stop();
    if (this.resizeSession?.moved) this.restoreResizeSession(this.resizeSession, true);
    const header = this.renderedColumnElements(id, 'columnheader')[0];
    this.resizeSession = {
      columnId: id,
      startClientX: event.clientX,
      startWidth:
        header?.getBoundingClientRect().width ??
        this.estimatedColumnWidth(entry.column, id),
      initialStateWidth: this.columnWidths.get(id),
      pointerId: event.pointerId,
      moved: false,
      direction: this.effectiveDirection,
    };
    this.activeResizeColumn = id;
    this.resizePointer.start(event, event.currentTarget as HTMLElement);
    event.preventDefault();
  }

  private onResizeMove(event: PointerEvent): void {
    const session = this.resizeSession;
    if (!session || event.pointerId !== session.pointerId) return;
    if (!this.columnCanResize(session.columnId)) {
      this.resizePointer.stop();
      this.resizeSession = undefined;
      this.activeResizeColumn = undefined;
      if (session.moved) this.restoreResizeSession(session, true);
      return;
    }
    const { minimum, maximum } = this.columnBounds(this.columnIndex.get(session.columnId)!.column);
    this.setColumnWidth(
      session.columnId,
      columnResizePointerWidth(session.startWidth, session.startClientX, event.clientX, session.direction === 'rtl', minimum, maximum),
      true,
      false
    );
    session.moved = true;
  }

  private takeResizeSession(event: PointerEvent): ResizeSession | undefined {
    const session = this.resizeSession;
    if (!session || event.pointerId !== session.pointerId) return undefined;
    this.resizeSession = undefined;
    this.activeResizeColumn = undefined;
    this.resizePointer.stop();
    return session;
  }

  private restoreResizeSession(session: ResizeSession, emit: boolean): void {
    const next = new Map(this.columnWidths);
    if (session.initialStateWidth === undefined) next.delete(session.columnId);
    else next.set(session.columnId, session.initialStateWidth);
    this.columnWidths = next;
    if (emit) {
      this.emit(
        'lr-column-resize',
        Object.freeze({
          columnId: session.columnId,
          columnKey: session.columnId,
          width: session.startWidth,
          finished: false,
        })
      );
    }
  }

  private onResizeEnd(event: PointerEvent): void {
    const session = this.takeResizeSession(event);
    if (!session) return;
    if (!this.columnCanResize(session.columnId)) {
      if (session.moved) this.restoreResizeSession(session, true);
      return;
    }
    const width = this.columnWidths.get(session.columnId) ?? session.startWidth;
    // The final width is a proposal, as in `<lr-table>`: a veto discards the live preview.
    let committed = false;
    requestThenCommit({
      requestDetail: Object.freeze({ columnId: session.columnId, columnKey: session.columnId, width }),
      emitRequest: (detail, init: { cancelable: true }) => this.emit('lr-column-resize-request', detail, init),
      commit: () => {
        committed = true;
        this.emit('lr-column-resize', Object.freeze({ columnId: session.columnId, columnKey: session.columnId, width, finished: true }));
      },
    });
    if (!committed) this.restoreResizeSession(session, true);
  }

  private onResizeCancel(event: PointerEvent): void {
    const session = this.takeResizeSession(event);
    if (!session || !session.moved) return;
    this.restoreResizeSession(session, true);
  }

  /**
   * Keyboard resize, with `<lr-table>`'s step model: Left/Right ±10px (±50px with Shift; swapped
   * under RTL), and on the focused separator itself Home/End jump to the column's minimum/maximum
   * and Enter fits the column to its content, the keyboard form of double-click.
   * Each step is proposed through the cancelable `lr-column-resize-request` before it commits.
   */
  private onResizeKey(event: KeyboardEvent, id: string, fromHandle = false): void {
    const entry = this.columnIndex.get(id);
    if (!entry || !this.columnCanResize(id)) return;
    if (shouldIgnoreNavigationKey(event)) return;
    const arrow = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    // End needs an authored maximum, as in `<lr-table>`; an unbounded column has no end to jump to.
    const jump =
      fromHandle &&
      (event.key === 'Home' || (event.key === 'End' && entry.column.maxWidth !== undefined));
    if (fromHandle && event.key === 'Enter') {
      event.preventDefault();
      if (!isRepeatedActivationKey(event)) this.autoSizeColumn(id);
      return;
    }
    if (!arrow && !jump) return;
    event.preventDefault();
    const { minimum, maximum } = this.columnBounds(entry.column);
    // Like a pointer drag, start from what is rendered: an auto-sized column is rarely the 7rem
    // estimate.
    const current = this.columnWidths.get(id) ?? this.renderedColumnWidth(id) ?? this.estimatedColumnWidth(entry.column, id);
    const width = columnResizeKeyboardWidth(event, current, minimum, maximum, this.effectiveDirection === 'rtl', fromHandle);
    if (width === undefined) return;
    requestThenCommit({
      requestDetail: Object.freeze({ columnId: id, columnKey: id, width }),
      emitRequest: (detail, init: { cancelable: true }) => this.emit('lr-column-resize-request', detail, init),
      commit: () => this.setColumnWidth(id, width, true, true),
    });
  }

  private renderedColumnWidth(id: string): number | undefined {
    const width = this.renderedColumnElements(id, 'columnheader')[0]?.getBoundingClientRect().width;
    return width !== undefined && Number.isFinite(width) && width > 0 ? width : undefined;
  }

  /** The render binds a separator's value from the stored or declared width, or a 7rem estimate.
   *  For an auto-sized column, report the rendered width instead, as `<lr-table>` does. */
  private syncResizeHandleValues(): void {
    for (const handle of this.renderRoot.querySelectorAll<HTMLElement>('[part="resize-handle"]')) {
      const header = handle.closest<HTMLElement>('[role="columnheader"][data-column-id]');
      const id = header?.getAttribute('data-column-id');
      if (!header || !id || this.columnWidths.has(id)) continue;
      const entry = this.columnIndex.get(id);
      if (!entry || entry.column.width !== undefined) continue;
      const rendered = header.getBoundingClientRect().width;
      if (!Number.isFinite(rendered) || rendered <= 0) continue;
      const width = Math.round(rendered);
      if (handle.getAttribute('aria-valuenow') === String(width)) continue;
      handle.setAttribute('aria-valuenow', String(width));
      handle.setAttribute(
        'aria-valuetext',
        this.localize('resizeValuePixels', undefined, {
          value: getNumberFormat(this.effectiveLocale).format(width),
        })
      );
    }
  }

  private onPageSizeChange(event: Event): void {
    const control = valueControl(event.currentTarget);
    if (!control) return;
    const { page, pageSize, paginate } = this;
    const requestedSize = finiteCount(Number(control.value));
    const detail = Object.freeze({ page: 0, pageSize: requestedSize });
    if (this.emit('lr-before-page-change', detail, { cancelable: true }).defaultPrevented ||
      !this.isConnected || this.page !== page || this.pageSize !== pageSize || this.paginate !== paginate) {
      control.value = String(this.safePageSize);
      return;
    }
    this.pageSize = requestedSize;
    this.page = 0;
    this.emit(
      'lr-page-change',
      Object.freeze({ page: 0, pageSize: this.safePageSize })
    );
  }

  private focusCell(row: number, column: number): void {
    const rowLimit = Math.max(-1, this.displayItems.length - 1);
    const columnLimit = Math.max(0, this.visibleColumns.length - 1);
    this.focusedRow = finiteInteger(row, this.focusedRow, -1, rowLimit);
    this.focusedColumn = finiteInteger(
      column,
      this.focusedColumn,
      0,
      columnLimit
    );
    let pendingScrollTop: number | undefined;
    if (this.focusedRow >= 0) {
      const selector = `[role="gridcell"][data-row-position="${this.focusedRow}"]`;
      if (!this.renderRoot.querySelector(selector)) {
        const top = this.displayItemOffset(
          this.focusedRow,
          this.displayItems
        );
        pendingScrollTop = top;
        this.bodyScrollTop = top;
        if (this.bodyElement) this.bodyElement.scrollTop = top;
      }
    }
    void this.updateComplete.then(() => {
      // WebKit clamps a pre-render write to zero when the virtual spacer has not established its
      // final scroll range yet. Restore the requested offset once that render is committed, then
      // focus the newly materialized cell.
      if (pendingScrollTop !== undefined && this.bodyElement) {
        this.bodyElement.scrollTop = pendingScrollTop;
      }
      this.focus();
    });
  }

  /**
   * WAI-ARIA treegrid disclosure keys on a row's first cell. `direction` is the inline direction
   * (`1` = toward the inline end, already RTL-resolved). The inline-end arrow expands a collapsed
   * expandable row (tree children, a row detail panel, or a group); the inline-start arrow
   * collapses an expanded one or, on a collapsed nested tree row, moves to its parent row. Returns
   * whether the key was consumed; otherwise the arrow moves between cells as usual.
   */
  private handleDisclosureKey(direction: number, rowPosition: number): boolean {
    const items = this.displayItems;
    const item = items[rowPosition];
    if (!item) return false;
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    if (item.kind === 'group') {
      if ((direction > 0) === expanded) return false;
      this.toggleGroupExpanded(item);
      return true;
    }
    const expandable =
      this.childrenFor(item.row).length > 0 || this.rowDetail !== null;
    if (expandable && (direction > 0) !== expanded) {
      this.toggleRowExpanded(item, true);
      return true;
    }
    if (direction > 0 || !this.childRows || item.depth === 0) return false;
    // Display construction emits every nested row after its parent, so the walk always finds one;
    // the first row is a root, which bounds it.
    let parent = rowPosition - 1;
    while (parent > 0 && (items[parent]?.depth ?? 0) >= item.depth) parent -= 1;
    this.focusCell(parent, 0);
    return true;
  }

  /** Whether a non-collapsed text selection is live anywhere the native copy would take it from:
   *  composed ranges into this shadow tree, the shadow root's own selection where an engine exposes
   *  one, or the document selection. */
  private hasTextSelection(): boolean {
    const root = this.shadowRoot as (ShadowRoot & { getSelection?: () => Selection | null }) | null;
    const selection = this.ownerDocument.getSelection() as
      | (Selection & { getComposedRanges?: (options: { shadowRoots: ShadowRoot[] }) => StaticRange[] })
      | null;
    try {
      if (root && selection?.getComposedRanges?.({ shadowRoots: [root] }).some((range) => !range.collapsed)) return true;
    } catch {
      // An engine with the older positional signature falls through to the checks below.
    }
    return [root?.getSelection?.(), selection].some(
      (candidate) => candidate != null && candidate.rangeCount > 0 && !candidate.isCollapsed
    );
  }

  private onGridKeyDown(
    event: KeyboardEvent,
    rowPosition: number,
    columnPosition: number,
    item?: DataDisplayRow<Row>,
    column?: DataGridColumn<Row>,
    columnIdValue?: string,
    cell: EventTarget | null = event.currentTarget
  ): void {
    const target = event.target;
    if (
      isElementValue(target) &&
      target !== cell &&
      target.closest(NESTED_INTERACTIVE_SELECTOR)
    ) {
      return;
    }
    // An earlier listener's claim and an IME composition own their keys; a held Enter/Space
    // activates once.
    if (isHandledOrComposingKey(event)) return;
    if (isRepeatedActivationKey(event) && ['Enter', ' '].includes(event.key)) return;
    const rtlMultiplier = this.effectiveDirection === 'rtl' ? -1 : 1;
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'a' &&
      this.selectionMode === 'multiple'
    ) {
      this.selectCurrentPage(true);
      event.preventDefault();
      return;
    }
    // Ctrl/Cmd+C owns the copy only for an explicit row selection; a text selection (or no row
    // selection at all) keeps the native copy.
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'c' &&
      this.selectedRows.length > 0 &&
      !this.hasTextSelection()
    ) {
      this.copySelectedRows();
      event.preventDefault();
      return;
    }
    if (event.shiftKey && event.key === 'F10' && item && column && columnIdValue) {
      this.emitCellContextMenu(event, item, column, columnIdValue, rowPosition);
      return;
    }
    const headerEntry = columnIdValue
      ? this.columnIndex.get(columnIdValue)
      : undefined;
    if (
      rowPosition < 0 &&
      columnIdValue &&
      headerEntry &&
      (this.reorderable || headerEntry.column.movable) &&
      event.shiftKey &&
      !event.altKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * rtlMultiplier;
      this.moveColumn(columnIdValue, delta, true);
      event.preventDefault();
      return;
    }
    // Alt+key (Alt+Arrow is history navigation) and Ctrl/Cmd+key (zoom, tab switch) belong to the
    // browser or system: only Ctrl/Cmd+Home/End (grid corners) are grid shortcuts. A column resizes
    // from its focusable separator.
    if (event.altKey) return;
    if ((event.ctrlKey || event.metaKey) && event.key !== 'Home' && event.key !== 'End') return;
    if (
      rowPosition >= 0 &&
      columnPosition === 0 &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      this.handleDisclosureKey(
        (event.key === 'ArrowRight' ? 1 : -1) * rtlMultiplier,
        rowPosition
      )
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const delta = (event.key === 'ArrowRight' ? 1 : -1) * rtlMultiplier;
      this.focusCell(rowPosition, columnPosition + delta);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      this.focusCell(rowPosition - 1, columnPosition);
      event.preventDefault();
    } else if (event.key === 'ArrowDown') {
      this.focusCell(rowPosition + 1, columnPosition);
      event.preventDefault();
    } else if (event.key === 'Home') {
      this.focusCell(event.ctrlKey || event.metaKey ? -1 : rowPosition, 0);
      event.preventDefault();
    } else if (event.key === 'End') {
      this.focusCell(
        event.ctrlKey || event.metaKey
          ? this.displayItems.length - 1
          : rowPosition,
        this.visibleColumns.length - 1
      );
      event.preventDefault();
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      const delta =
        event.key === 'PageDown'
          ? this.safePageSize || 10
          : -(this.safePageSize || 10);
      this.focusCell(rowPosition + delta, columnPosition);
      event.preventDefault();
    } else if (event.key === 'Enter') {
      if (rowPosition < 0 && columnIdValue)
        this.activateSort(columnIdValue, event.shiftKey);
      else if (item && column && columnIdValue)
        this.emit(
          'lr-cell-click',
          Object.freeze({
            rowKey: item.key,
            columnId: columnIdValue,
            column,
            value: columnValue(column, item.row),
            row: item.row,
            index: rowPosition,
          })
        );
      event.preventDefault();
    } else if (event.key === ' ' && item) {
      const selected = !arrayHasKey(this.selectedKeys, item.key);
      this.setRowSelected(item, selected, event as unknown as MouseEvent);
      event.preventDefault();
    } else if (event.key === ' ' && rowPosition >= 0) {
      const group = this.displayItems[rowPosition];
      if (group?.kind === 'group' && this.selectionMode === 'multiple') {
        const eligible = group.rows.filter((row) => this.rowIsSelectable(row));
        const sourceIndexes = this.sourceIndexMap();
        const allSelected =
          eligible.length > 0 &&
          eligible.every((row, index) =>
            arrayHasKey(
              this.selectedKeys,
              this.keyForRow(row, this.sourceIndexFor(row, sourceIndexes) ?? index)
            )
          );
        this.setGroupSelected(group, !allSelected);
        event.preventDefault();
      }
    }
  }

  private setGroupSelected(
    group: DataDisplayGroup<Row>,
    selected: boolean
  ): void {
    const eligible = group.rows.filter((row) => this.rowIsSelectable(row));
    const sourceIndexes = this.sourceIndexMap();
    const groupKeys = eligible.map((row, index) => {
      const sourceIndex = this.sourceIndexFor(row, sourceIndexes);
      return this.keyForRow(row, sourceIndex ?? index);
    });
    const groupKeySet = new Set(groupKeys.map(typedKey));
    let next = this.selectedKeys.filter((key) => !groupKeySet.has(typedKey(key)));
    if (selected) next = [...next, ...groupKeys];
    this.commitSelection(next);
  }

  private userPinColumn(id: string, side: DataGridPinSide): void {
    this.pinColumn(id, side);
    this.emit('lr-column-pin', Object.freeze({ columnId: id, side }));
  }

  private userToggleColumn(id: string, visible: boolean): void {
    this.toggleColumn(id, visible);
    this.emit(
      'lr-column-visibility-change',
      Object.freeze({ columnId: id, visible })
    );
  }

  private relayEditorFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private relayEditorBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private renderToolbar(): TemplateResult | typeof nothing {
    if (!this.withSearch && !this.withColumnsMenu) return nothing;
    return html`
      <div part="toolbar">
        ${this.withSearch
          ? html`
              <div part="search-wrapper">
                <input
                  part="search"
                  type="search"
                  .value=${this.searchTerm}
                  aria-label=${this.localize('search')}
                  placeholder=${this.localize('search')}
                  spellcheck=${this.spellcheck}
                  autocapitalize=${this.autocapitalize || nothing}
                  autocorrect=${this.autoCorrect || nothing}
                  @input=${this.onSearchInput}
                  @focus=${this.relayEditorFocus}
                  @blur=${this.relayEditorBlur}
                />
                ${this.searchTerm !== ''
                  ? html`<button
                      part="search-clear"
                      type="button"
                      aria-label=${this.localize('clear')}
                      @click=${this.onClearSearch}
                    >
                      <span aria-hidden="true" inert>${closeIcon()}</span>
                    </button>`
                  : nothing}
              </div>
            `
          : nothing}
        ${this.withColumnsMenu ? this.renderColumnsMenu() : nothing}
      </div>
    `;
  }

  // The grid owns column visibility so rejected menu requests preserve the checkmark.
  private renderColumnsMenu(): TemplateResult {
    const label = this.localize('dataGridColumns');
    return html`
      <lr-dropdown without-arrow
        part="columns-menu"
        aria-label=${label}
        stay-open-on-select
        .open=${this.columnsMenuOpen}
        @lr-show=${() => this.openColumnsPanel()}
        @lr-after-hide=${() => {
          this.columnsMenuOpen = false;
        }}
      >
        <lr-button slot="trigger" appearance="outlined">${label}</lr-button>
        ${this.orderedColumns.map(({ column, id }) => {
          const visible = this.columnVisibility.get(id) ?? column.hidden !== true;
          return html`<lr-dropdown-item
            type="checkbox"
            value=${id}
            ?checked=${visible}
            ?disabled=${column.hideable === false}
            @lr-menu-item-change-request=${(event: Event) => {
              event.stopPropagation();
              event.preventDefault();
              const { value, checked } = (
                event as CustomEvent<{ value: string; checked: boolean }>
              ).detail;
              this.userToggleColumn(value, checked);
            }}
            >${this.columnLabel(column, id)}</lr-dropdown-item
          >`;
        })}
      </lr-dropdown>
    `;
  }

  private renderSelectAllHeader(): TemplateResult | typeof nothing {
    if (!this.selectionEnabled) return nothing;
    const items = this.currentPageSelectableRows;
    const selected = this.memoize('selectAll', [items, this.selectedKeys], () => items.filter(item => arrayHasKey(this.selectedKeys, item.key)).length);
    return html`
      <div role="columnheader" aria-colindex="1">
        ${this.selectionMode === 'multiple'
          ? html`
              <input
                part="select-all-checkbox"
                type="checkbox"
                aria-label=${this.localize('dataGridSelectPage')}
                .checked=${live(items.length > 0 && selected === items.length)}
                .indeterminate=${live(selected > 0 && selected < items.length)}
                ?disabled=${items.length === 0}
                @change=${(event: Event) => {
                  const control = checkableControl(event.currentTarget);
                  if (control) this.selectCurrentPage(control.checked);
                }}
              />
            `
          : html`<span class="sr-only">${this.localize('select')}</span>`}
      </div>
    `;
  }

  private get filtersById(): ReadonlyMap<string, DataGridFilter> {
    return this.memoize('filtersById', [this.filters], () => {
      const index = new Map<string, DataGridFilter>();
      for (const filter of this.filters) if (!index.has(filter.id)) index.set(filter.id, filter);
      return index;
    });
  }

  private renderColumnMenu(
    column: DataGridColumn<Row>,
    id: string
  ): TemplateResult | typeof nothing {
    if (!this.withColumnMenu) return nothing;
    const open = this.activeColumnMenu === id;
    const pinAllowed = this.pinnable || column.pinnable;
    const visible = this.columnVisibility.get(id) ?? column.hidden !== true;
    const label = this.columnLabel(column, id);
    const menuId = `column-menu-${this.columnIndex.get(id)!.naturalIndex}`;
    const menuLabel = this.localize('dataGridColumnMenu', undefined, { label });
    return html`
      <div part="column-menu">
        <button
          part="column-menu-button"
          type="button"
          aria-label=${menuLabel}
          aria-controls=${menuId}
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this.toggleColumnPanel(id)}
        >
          <span aria-hidden="true">⋮</span>
        </button>
        ${open
          ? html`
              <div
                id=${menuId}
                role="group"
                aria-label=${menuLabel}
              >
                ${pinAllowed
                  ? html`
                      <button
                        type="button"
                        data-column-action="pin-start"
                        @click=${() => this.userPinColumn(id, 'left')}
                      >
                        ${this.localize('dataGridPinStart', undefined, {
                          label,
                        })}
                      </button>
                      <button
                        type="button"
                        data-column-action="pin-end"
                        @click=${() => this.userPinColumn(id, 'right')}
                      >
                        ${this.localize('dataGridPinEnd', undefined, { label })}
                      </button>
                      <button
                        type="button"
                        data-column-action="unpin"
                        @click=${() => this.userPinColumn(id, false)}
                      >
                        ${this.localize('dataGridUnpin', undefined, { label })}
                      </button>
                    `
                  : nothing}
                ${column.hideable === false
                  ? nothing
                  : html`
                      <label data-column-visibility>
                        <input
                          type="checkbox"
                          .checked=${live(visible)}
                          @change=${(event: Event) => {
                            const control = checkableControl(
                              event.currentTarget
                            );
                            if (control)
                              this.userToggleColumn(id, control.checked);
                          }}
                        />
                        ${this.columnLabel(column, id)}
                      </label>
                    `}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderHeader(): TemplateResult {
    const selectionOffset = this.selectionEnabled ? 1 : 0;
    return html`
      <div
        part="header"
        role="row"
        style=${styleMap({
          '--data-grid-scroll-translation': this.bodyScrollTranslation,
          '--data-grid-body-inline-end-gutter': `${this.bodyScrollbarInlineEndGutter}px`,
        })}
      >
        ${this.renderSelectAllHeader()}
        ${this.visibleColumns.length === 0 && !this.selectionEnabled
          ? html`
              <div role="columnheader" aria-colindex="1">
                ${this.localize('noColumns')}
              </div>
            `
          : nothing}
        ${this.windowColumns.map(({ column, id, position }) => {
          const sorting = this.sortFor(id);
          const sortable = this.columnIsSortable(column);
          const direction = sorting.state?.desc ? 'descending' : 'ascending';
          const canResize = this.resizable || column.resizable;
          const canMove = this.reorderable || column.movable;
          const resizeBounds = this.columnBounds(column);
          const resizeValue = this.estimatedColumnWidth(column, id);
          const resizeAria = columnResizeAriaValues(resizeValue, resizeBounds.minimum, resizeBounds.maximum);
          return html`
            <div
              part="header-cell"
              role="columnheader"
              aria-colindex=${position + 1 + selectionOffset}
              aria-sort=${sortable ? (sorting.state ? direction : 'none') : nothing}
              tabindex=${this.focusedRow < 0 && this.focusedColumn === position
                ? '0'
                : '-1'}
              data-focus-cell
              data-column-id=${id}
              data-column-position=${position}
              data-align=${column.align ?? 'start'}
              data-sortable=${sortable ? '' : nothing}
              data-pin=${normalizePinSide(this.getColumnPin(id)) || nothing}
              style=${styleMap(this.columnStyle(column, id))}
              .draggable=${Boolean(canMove)}
              @focus=${() => {
                this.focusedRow = -1;
                this.focusedColumn = position;
              }}
              @click=${(event: MouseEvent) => this.onHeaderClick(event, id)}
              @keydown=${(event: KeyboardEvent) =>
                this.onGridKeyDown(event, -1, position, undefined, column, id)}
              @dragstart=${(event: DragEvent) => this.onDragStart(event, id)}
              @dragend=${() => {
                this.columnDragSession = undefined;
                this.dragGhost = '';
              }}
              @dragover=${(event: DragEvent) => {
                const session = this.columnDragSession;
                if (
                  session &&
                  this.columnCanMove(session.sourceId) &&
                  this.columnCanMove(id)
                )
                  event.preventDefault();
              }}
              @drop=${(event: DragEvent) => this.onDrop(event, id)}
            >
              <span>${this.columnLabel(column, id)}</span>
              ${sorting.state
                ? html`
                    <span part="sort-indicator" data-direction=${direction}
                      >${chevronIcon()}</span
                    >
                    ${this.sort.length > 1
                      ? html`<span part="sort-number"
                          >${getNumberFormat(this.effectiveLocale).format(
                            sorting.index + 1
                          )}</span
                        >`
                      : nothing}
                  `
                : nothing}
              ${column.filterable
                ? html`
                    <button
                      part="filter-button"
                      type="button"
                      aria-label=${this.localize('dataGridFilterColumn', undefined, { column: this.columnLabel(column, id) })}
                      aria-expanded=${this.activeFilterColumn === id
                        ? 'true'
                        : 'false'}
                      @click=${() => this.toggleFilterPanel(id)}
                    >
                      <span aria-hidden="true">⌕</span>
                    </button>
                  `
                : nothing}
              ${this.renderColumnMenu(column, id)}
              ${this.getColumnPin(id)
                ? html`<span part="pin-indicator" aria-hidden="true"></span>`
                : nothing}
              ${canResize
                ? html`
                    <span
                      part="resize-handle"
                      ?data-resizing=${this.activeResizeColumn === id}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label=${this.localize('resizeColumn', undefined, {
                        label: this.columnLabel(column, id),
                      })}
                      aria-valuemin=${resizeAria.min}
                      aria-valuemax=${resizeAria.max}
                      aria-valuenow=${resizeAria.now}
                      aria-valuetext=${this.localize(
                        'resizeValuePixels',
                        undefined,
                        {
                          value: getNumberFormat(this.effectiveLocale).format(
                            resizeValue
                          ),
                        }
                      )}
                      tabindex="0"
                      @pointerdown=${(event: PointerEvent) =>
                        this.onResizeStart(event, id)}
                      @dblclick=${() => this.autoSizeColumn(id)}
                      @keydown=${(event: KeyboardEvent) =>
                        this.onResizeKey(event, id, true)}
                    ></span>
                  `
                : nothing}
              ${this.activeFilterColumn === id
                ? html`
                    <div part="filter-panel">
                      <input
                        type="search"
                        aria-label=${this.localize('dataGridFilterColumn', undefined, { column: this.columnLabel(column, id) })}
                        spellcheck=${this.spellcheck}
                        autocapitalize=${this.autocapitalize || nothing}
                        autocorrect=${this.autoCorrect || nothing}
                        .value=${safeText(
                          this.filtersById.get(id)?.value
                        )}
                        @input=${(event: Event) =>
                          this.onFilterInput(event, id)}
                        @focus=${this.relayEditorFocus}
                        @blur=${this.relayEditorBlur}
                      />
                      ${this.filtersById.has(id)
                        ? html`<button
                            part="filter-panel-clear"
                            type="button"
                            aria-label=${this.localize('clear')}
                            @click=${() => this.onClearFilterInput(id)}
                          >
                            <span aria-hidden="true" inert>${closeIcon()}</span>
                          </button>`
                        : nothing}
                    </div>
                  `
                : nothing}
            </div>
          `;
        })}
      </div>
    `;
  }

  private renderCellValue(column: DataGridColumn<Row>, row: Row): unknown {
    const value = columnValue(column, row);
    return column.formatter ? column.formatter(value, row) : safeText(value);
  }

  private renderExpandButton(
    item: DataDisplayRow<Row>,
    column: DataGridColumn<Row>
  ): TemplateResult | typeof nothing {
    const expandable =
      this.childrenFor(item.row).length > 0 || this.rowDetail !== null;
    if (!expandable) return nothing;
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    const row = safeText(columnValue(column, item.row)).trim() || String(item.key);
    return html`
      <button
        part="expand-button"
        type="button"
        style=${styleMap({ '--depth': String(item.depth) })}
        aria-label=${this.localize('dataGridToggleRow', undefined, { row })}
        aria-expanded=${this.childRows ? nothing : expanded ? 'true' : 'false'}
        tabindex="-1"
        @click=${() => this.toggleRowExpanded(item, true)}
      >
        <span data-expanded=${expanded ? 'true' : 'false'}
          >${chevronIcon()}</span
        >
      </button>
    `;
  }

  private renderDataRow(
    item: DataDisplayRow<Row>,
    rowPosition: number,
    ariaRowIndex: number
  ): TemplateResult {
    const selection = this.rowSelectionState(item);
    const expandable =
      this.childrenFor(item.row).length > 0 || this.rowDetail !== null;
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    const rowClass = this.rowClass?.(item.row) ?? '';
    const selectionOffset = this.selectionEnabled ? 1 : 0;
    return html`
      <div
        part="row"
        class=${rowClass}
        role="row"
        aria-rowindex=${ariaRowIndex}
        aria-level=${this.childRows ? item.depth + 1 : nothing}
        aria-selected=${this.selectionEnabled
          ? selection.checked
            ? 'true'
            : 'false'
          : nothing}
        aria-expanded=${this.childRows && expandable
          ? expanded
            ? 'true'
            : 'false'
          : nothing}
        data-visible-index=${rowPosition}
        data-virtual-item-key=${displayItemKey(item)}
      >
        ${this.selectionEnabled
          ? html`
              <div role="gridcell" aria-colindex="1" part="cell">
                <input
                  type=${this.selectionMode === 'single' ? 'radio' : 'checkbox'}
                  aria-labelledby=${`select-row-label row-${rowPosition}-label`}
                  tabindex="-1"
                  .checked=${live(selection.checked)}
                  .indeterminate=${live(selection.indeterminate)}
                  ?disabled=${!this.rowIsSelectable(item.row)}
                  @click=${(event: MouseEvent) => {
                    const control = checkableControl(event.currentTarget);
                    if (control)
                      this.setRowSelected(item, control.checked, event);
                  }}
                />
              </div>
            `
          : nothing}
        ${this.windowColumns.map(
          ({ column, id, position: columnPosition }) => html`
            <div
              part="cell"
              role="gridcell"
              aria-colindex=${columnPosition + 1 + selectionOffset}
              tabindex=${this.focusedRow === rowPosition &&
              this.focusedColumn === columnPosition
                ? '0'
                : '-1'}
              data-focus-cell
              data-row-position=${rowPosition}
              data-column-position=${columnPosition}
              data-column-id=${id}
              data-align=${column.align ?? 'start'}
              data-pin=${normalizePinSide(this.getColumnPin(id)) || nothing}
              title=${column.cellTitle?.(item.row) || nothing}
              style=${styleMap(this.columnStyle(column, id))}

            >
              ${columnPosition === 0 ? this.renderExpandButton(item, column) : nothing}
              ${columnPosition === 0 && this.selectionEnabled
                ? html`<span class="row-label" id=${`row-${rowPosition}-label`}
                    >${this.renderCellValue(column, item.row)}</span
                  >`
                : this.renderCellValue(column, item.row)}
              ${this.getColumnPin(id)
                ? html`<span part="pin-indicator" aria-hidden="true"></span>`
                : nothing}
            </div>
          `
        )}
      </div>
      ${expanded && this.rowDetail
        ? html`
            <div
              role="row"
              aria-rowindex=${ariaRowIndex + 1}
              data-virtual-item-detail-for=${displayItemKey(item)}
            >
              <div
                part="row-detail"
                role="gridcell"
                aria-colspan=${this.ariaColumnCount}
              >
                ${this.rowDetail(item.row)}
              </div>
            </div>
          `
        : nothing}
    `;
  }

  private renderGroupRow(
    item: DataDisplayGroup<Row>,
    rowPosition: number,
    ariaRowIndex: number
  ): TemplateResult {
    const expanded = arrayHasKey(this.expandedKeys, item.key);
    const eligible = this.memoize(`eligible:${item.key}`, [item.rows, this.selectable, this.selectableRows], () => item.rows.filter(row => this.rowIsSelectable(row)));
    const sourceIndexes = this.sourceIndexMap();
    const selected = this.memoize(`groupSelected:${item.key}`, [eligible, this.selectedKeys], () => eligible.filter((row, index) => {
      const sourceIndex = this.sourceIndexFor(row, sourceIndexes);
      return arrayHasKey(
        this.selectedKeys,
        this.keyForRow(row, sourceIndex ?? index)
      );
    }).length);
    return html`
      <div
        part="group-row"
        role="row"
        aria-rowindex=${ariaRowIndex}
        aria-level=${item.depth + 1}
        aria-expanded=${expanded ? 'true' : 'false'}
        data-virtual-item-key=${displayItemKey(item)}
      >
        <div
          part="group-value"
          role="gridcell"
          aria-colspan=${this.ariaColumnCount}
          tabindex=${this.focusedRow === rowPosition ? '0' : '-1'}
          data-focus-cell
          data-row-position=${rowPosition}
          data-column-position="0"
          @focus=${() => {
            this.focusedRow = rowPosition;
            this.focusedColumn = 0;
          }}
          @keydown=${(event: KeyboardEvent) =>
            this.onGridKeyDown(event, rowPosition, 0)}
        >
          ${this.selectionMode === 'multiple'
            ? html`
                <input
                  type="checkbox"
                  aria-labelledby=${`select-row-label group-${rowPosition}-label`}
                  tabindex="-1"
                  .checked=${live(eligible.length > 0 &&
                  selected === eligible.length)}
                  .indeterminate=${live(selected > 0 && selected < eligible.length)}
                  ?disabled=${eligible.length === 0}
                  @change=${(event: Event) => {
                    const control = checkableControl(event.currentTarget);
                    if (control) this.setGroupSelected(item, control.checked);
                  }}
                />
              `
            : nothing}
          <button
            part="expand-button"
            type="button"
            style=${styleMap({ '--depth': String(item.depth) })}
            aria-label=${this.localize('dataGridToggleRow', undefined, { row: safeText(item.value) })}
            tabindex="-1"
            @click=${() => this.toggleGroupExpanded(item)}
          >
            <span data-expanded=${expanded ? 'true' : 'false'}
              >${chevronIcon()}</span
            >
          </button>
          <span id=${`group-${rowPosition}-label`}>${safeText(item.value)}</span>
          <span part="group-count"
            >${getNumberFormat(this.effectiveLocale).format(
              item.rows.length
            )}</span
          >
          ${this.visibleColumns.map(({ column, id }) => {
            if (!column.aggregation) return nothing;
            const aggregate = this.memoize(`aggregate:${item.key}:${id}`, [item.rows, column, this.pipelineEpoch], () => aggregateValues(
              column.aggregation!,
              item.rows,
              item.rows.map((row) => columnValue(column, row))
            ));
            return html`<span
              >${column.aggregatedFormatter
                ? column.aggregatedFormatter(aggregate, item.rows)
                : safeText(aggregate)}</span
            >`;
          })}
        </div>
      </div>
    `;
  }

  /** `renderDataState()`'s built-in `[part='retry-button']` activation. Mirrors `<lr-table>`'s own
   *  "propose, then react to the veto" onRetryClick shape: the default action clears `error`;
   *  `preventDefault()` leaves it set for a consumer that owns its own retry timing (and its own
   *  reload -- `error` is host-controlled here exactly like every other sibling, so this grid never
   *  re-issues a `dataSource` request on its own). */
  private onErrorRetry = (): void => {
    this.error = false;
  };

  private renderBodyContent(): TemplateResult {
    // `error` beats every empty/no-columns/no-results branch below, matching `<lr-table>`'s own
    // precedence. `loading` beats `error` in turn: while `loading` is set, this body keeps
    // rendering whatever it already would (rows, most often, since `loading` here is an overlay
    // rather than a whole-body replacement -- see `render()`'s `part="loading-overlay"`), so a
    // loading grid never flashes a stale failure underneath its own spinner.
    if (this.error && !this.loading) {
      return html`
        <div role="row" aria-rowindex="2" part="error-row">
          <div part="error-cell" role="gridcell" aria-colspan=${this.ariaColumnCount}>
            ${renderDataState(
              this,
              {
                loading: false,
                error: true,
                empty: false,
                errorHeading: this.errorHeading,
                errorDescription: this.errorDescription,
                onRetry: this.onErrorRetry,
                emitRetryRequest: (detail, init: { cancelable: true }) => this.emit('lr-retry-request', detail, init),
              },
              'error',
              'lr-retry-request'
            )}
          </div>
        </div>
      `;
    }
    if (this.columns.length === 0 || this.visibleColumns.length === 0) {
      return html`
        <div role="row" aria-rowindex="2">
          <div part="empty" role="gridcell" aria-colindex="1">
            <slot name="empty">${this.localize('noColumns')}</slot>
          </div>
        </div>
      `;
    }
    if (this.canonicalRootRows.length === 0) {
      return html`
        <div role="row" aria-rowindex="2">
          <div
            part="empty"
            role="gridcell"
            aria-colspan=${this.ariaColumnCount}
          >
            <slot name="empty">${this.localize('noData')}</slot>
          </div>
        </div>
      `;
    }
    if (this.displayItems.length === 0) {
      return html`
        <div role="row" aria-rowindex="2">
          <div
            part="no-results"
            role="gridcell"
            aria-colspan=${this.ariaColumnCount}
          >
            <slot name="no-results">${this.localize('noMatches')}</slot>
          </div>
        </div>
      `;
    }
    const window = this.virtualWindow;
    const allItems = window.allItems;
    let ariaRowIndex = 2 + window.start + (this.detailRowOffsets(allItems)[window.start] ?? 0);
    return html`
      ${window.start > 0
        ? html`<div
            aria-hidden="true"
            style=${styleMap({
              height: `${this.displayItemOffset(window.start, allItems)}px`,
            })}
          ></div>`
        : nothing}
      ${repeat(
        window.items,
        (item) => displayItemKey(item),
        (item, localIndex) => {
          const rowPosition = window.start + localIndex;
          const currentAriaRowIndex = ariaRowIndex;
          ariaRowIndex +=
            1 +
            (item.kind === 'row' &&
            Boolean(this.rowDetail) &&
            arrayHasKey(this.expandedKeys, item.key)
              ? 1
              : 0);
          return item.kind === 'group'
            ? this.renderGroupRow(item, rowPosition, currentAriaRowIndex)
            : this.renderDataRow(item, rowPosition, currentAriaRowIndex);
        }
      )}
      ${window.end < allItems.length
        ? html`
            <div
              aria-hidden="true"
              style=${styleMap({
                height: `${Math.max(
                  0,
                  this.displayItemOffset(allItems.length, allItems) -
                    this.displayItemOffset(window.end, allItems)
                )}px`,
              })}
            ></div>
          `
        : nothing}
    `;
  }

  private renderFooter(): TemplateResult | typeof nothing {
    const hasFooter = this.memoize('hasFooter', [this.visibleColumns], () =>
      this.visibleColumns.some(({ column }) => column.footer !== undefined));
    if (!hasFooter) return nothing;
    const rows = this.getProcessedRows();
    return html`
      <div part="footer">
        <div
          part="footer-row"
          role="row"
          style=${styleMap({
              '--data-grid-scroll-translation': this.bodyScrollTranslation,
            '--data-grid-body-inline-end-gutter': `${this.bodyScrollbarInlineEndGutter}px`,
          })}
        >
          ${this.selectionEnabled
            ? html`<div part="footer-cell" role="gridcell"></div>`
            : nothing}
          ${this.windowColumns.map(
            ({ column, id }) => html`
              <div
                part="footer-cell"
                role="gridcell"
                data-column-id=${id}
                data-pin=${normalizePinSide(this.getColumnPin(id)) || nothing}
                style=${styleMap(this.columnStyle(column, id))}
              >
                ${typeof column.footer === 'function'
                  ? this.memoize(`footer:${id}`, [rows, column.footer, this.pipelineEpoch, this.effectiveLocale], () => typeof column.footer === 'function' ? column.footer(rows) : nothing)
                  : column.footer ?? nothing}
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  private renderPager(): TemplateResult | typeof nothing {
    if (!this.paginate) return nothing;
    const format = getNumberFormat(this.effectiveLocale, {
      maximumFractionDigits: 0,
    });
    const configuredPageSizes = [
      ...new Set(
        this.pageSizeOptions
          .map((value) => finiteCount(value))
          .filter((value) => value > 0)
      ),
    ];
    const pageSizes = configuredPageSizes.includes(this.safePageSize)
      ? configuredPageSizes
      : [this.safePageSize, ...configuredPageSizes];
    // Not `.value` on the <select>: it would be assigned before the options render, and dropped.
    return html`
      <div part="pager">
        <span class="page-size-wrapper">
          <select
            part="page-size"
            aria-label=${this.localize('dataGridRowsPerPage')}
            @change=${this.onPageSizeChange}
          >
            ${pageSizes.map(
              (value) =>
                html`<option value=${value} .selected=${value === this.safePageSize}>${format.format(value)}</option>`
            )}
          </select>
          <span class="page-size-chevron" aria-hidden="true"
            >${chevronIcon()}</span
          >
        </span>
        <lr-pagination
          exportparts="button:pager-button, first-button, previous-button, next-button, last-button, first-icon, previous-icon, next-icon, last-icon, page, page-current, ellipsis, page-input, summary:page-summary"
          with-edges .withSummary=${this.paginationWithSummary} .format=${this.paginationFormat} .page=${this.safePage + 1} .pageSize=${this.safePageSize}
          .total=${this.indeterminatePage ? -1 : this.pageItemCount} .hasNext=${this.hasNext}
          .strings=${this.strings} @lr-before-page-change=${this.onPagerRequest}
          @lr-page-change=${this.onPagerChange} @lr-activate=${this.onPagerActivate}
        ></lr-pagination>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const accessibleName = hostAriaLabel(this) ?? (this.label || undefined);
    const detailCount = this.detailRowOffsets(this.displayItems)[this.displayItems.length] ?? 0;
    const rowCount = Math.max(1, this.displayItems.length + detailCount) + 1;
    const columnCount = this.ariaColumnCount;
    const role =
      this.childRows || normalizedGroupBy(this.groupBy).length > 0
        ? 'treegrid'
        : 'grid';
    const treeProjection = this.sourceProjection();
    return html`
      <div
        part="data-grid"
        @dragover=${(event: DragEvent) => {
          if (this.columnDragSession) this.positionDragGhost(event.clientX, event.clientY);
        }}
      >
        ${this.renderToolbar()}
        <div
          part="table"
          style=${styleMap({ '--data-grid-columns': this.gridTemplate })}
          role=${role}
          aria-label=${accessibleName ?? nothing}
          aria-multiselectable=${this.selectionEnabled
            ? this.selectionMode === 'multiple'
              ? 'true'
              : 'false'
            : nothing}
          aria-busy=${this.loading ? 'true' : 'false'}
          aria-rowcount=${rowCount}
          aria-colcount=${columnCount}
          data-tree-truncated=${treeProjection.truncated && this.childRows ? 'true' : nothing}
        >
          ${this.renderHeader()}
          <div
            part="body"
            class=${this.visibleColumns.length > 50 && this.displayItems.length > 0 && (!this.error || this.loading)
              ? 'column-windowed' : nothing}
            role="rowgroup"
            tabindex="-1"
            @scroll=${this.onBodyScroll}
            @focusin=${this.onBodyCellEvent}
            @click=${this.onBodyCellEvent}
            @contextmenu=${this.onBodyCellEvent}
            @keydown=${this.onBodyCellEvent}
          >
            ${this.renderBodyContent()}
          </div>
          ${this.renderFooter()}
        </div>
        ${treeProjection.truncated && this.childRows
          ? html`<div part="tree-limit">
              ${this.localize('dataGridTreeLimitReached')}
            </div>`
          : nothing}
        ${treeProjection.truncated && !this.childRows
          ? html`<div part="row-limit">
              ${this.localize('dataGridRowLimit', undefined, {
                count: this.formatLocaleNumber(this.rowLimit), pluralCount: this.rowLimit,
              })}
            </div>`
          : nothing}
        ${this.loading
          ? html`
              <div part="loading-overlay">
                <slot name="loading">${this.localize('loading')}</slot>
              </div>
            `
          : nothing}
        ${this.renderPager()}
        <div part="live-region" class="sr-only" aria-hidden="true">${this.liveText}</div>
        ${this.selectionEnabled
          ? html`<span id="select-row-label" hidden>${this.localize('select')}</span>`
          : nothing}
        ${this.dragGhost
          ? html`<div part="drag-ghost">${this.dragGhost}</div>`
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-data-grid': LyraDataGrid;
  }
}
