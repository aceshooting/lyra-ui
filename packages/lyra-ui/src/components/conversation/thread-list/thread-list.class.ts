import { OwnedMutationObserver } from '../../../internal/owned-observer.js';
import { isElementNode } from '../../../internal/dom-guards.js';
import { normalizeLabel } from '../../../internal/accessible-name.js';
import type { LyraPageSource } from '../../../data-sources.js';
import type { SourcePageState } from '../../../internal/source-page-controller.js';

import { displayedSourcePage, normalizeSourcePage, normalizeSourcePageSize, sourcePageOfRecord, SourceQueryInputs } from '../../../internal/source-paging.js';
import { createHaystackMemo, foldSearchText, prepareNeedle } from '../../../internal/search-haystack.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { collectionSupport, publicCollectionTruncation } from '../../../internal/collection-snapshot.js';
import { tag } from '../../../internal/prefix.js';
import {
  html,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hasSlotContent } from '../../../internal/slot-content.js';
import { HostDescriptionController } from '../../../internal/aria-controls.js';
import {
  archiveIcon,
  chevronIcon,
  closeIcon,
  pinIcon,
  trashIcon,
} from '../../../internal/icons.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import type {
  LyraVirtualList,
  LyraVirtualListGroup,
  LyraVirtualListIndexedSource,
} from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { isRovingTargetAvailable, shouldIgnoreNavigationKey } from '../../../internal/list-navigation.js';
import { styles } from './thread-list.styles.js';
import { contextualSizes } from '../../../internal/contextual-vocabulary.styles.js';
import { requestThenCommit } from '../../../internal/request-commit.js';
import { renderDataState } from '../../../internal/data-state-renderer.js';
import { bucketFor, dateForBucket } from './thread-list-buckets.js';
import { canonicalThreads, sourceThread, ThreadListPageController, type ThreadListItem, type ThreadListModel } from './thread-list-source.js';
import { startOfLocalDay } from '../../../internal/group-by-recency.js';
import {
  optionalSizeConverter,
  type LyraSize,
} from '../../../internal/variants.js';
import {
  getDateTimeFormat,
  getNumberFormat,
} from '../../../internal/intl-cache.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import type { LyraChatThread, ThreadBucketKey, ThreadListGrouping } from './thread-list-types.js';
import { loadLazyChildren } from '../../../internal/lazy-children.js';
import { blankNumberConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_archiveConversation, LYRA_DEFAULT_conversationActionWithTitle, LYRA_DEFAULT_deleteConversation, LYRA_DEFAULT_pinConversation, LYRA_DEFAULT_searchThreads, LYRA_DEFAULT_threadGroupArchived, LYRA_DEFAULT_threadGroupPinned, LYRA_DEFAULT_threadGroupPrevious30Days, LYRA_DEFAULT_threadGroupPrevious7Days, LYRA_DEFAULT_threadGroupToday, LYRA_DEFAULT_threadGroupYesterday, LYRA_DEFAULT_threadListEmpty, LYRA_DEFAULT_threadListInputLimit, LYRA_DEFAULT_threadListLabel, LYRA_DEFAULT_threadListMatchAnnounce, LYRA_DEFAULT_unarchiveConversation, LYRA_DEFAULT_unpinConversation } from '../../../internal/default-strings/conversation.generated.js';
import { LYRA_DEFAULT_clear, LYRA_DEFAULT_loading, LYRA_DEFAULT_noData, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_retry, LYRA_DEFAULT_tableLoadFailed } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

// Provider mode registers the pager, and a failed load the error view, the first time each renders.
const THREAD_LIST_CHILDREN = {
  pagination: () => import('../../lr-pagination.js'),
  empty: () => import('../../lr-empty.js'),
};

export type { LyraChatThread, ThreadBucketKey, ThreadListGrouping } from './thread-list-types.js';
export type ThreadRowAction = 'pin' | 'archive' | 'delete';

/** Global provider query; callbacks are applied by the provider, never to a partial page. */
export interface ThreadListSourceQuery {
  readonly search: string;
  readonly withArchived: boolean;
  readonly grouping: ThreadListGrouping;
  readonly collapsedGroupIds: readonly string[];
  readonly filter: LyraThreadList['filter'];
  readonly groupBy: LyraThreadList['groupBy'];
  readonly getGroupLabel: LyraThreadList['getGroupLabel'];
  readonly groupOrder: LyraThreadList['groupOrder'];
}
export type ThreadListSource = LyraPageSource<LyraChatThread, ThreadListSourceQuery>;

/** Payload shared by the `lr-group-toggle-request`/`lr-group-toggle` pair. */
export interface ThreadGroupToggleDetail {
  groupId: string;
  /** Whether the group is shown in the resulting (on `lr-group-toggle-request`, the proposed)
   *  state. Always present on events this component dispatches. */
  expanded?: boolean;
}

/** Payload shared by the `lr-source-page-change-request`/`lr-source-page-change` pair. */
export interface ThreadListSourcePageChangeDetail {
  /** Zero-based source record page: proposed on the request, applied on the change. */
  page: number;
}

export interface LyraThreadListEventMap {
  'lr-source-page-change-request': CustomEvent<ThreadListSourcePageChangeDetail>;
  'lr-source-page-change': CustomEvent<ThreadListSourcePageChangeDetail>;
  'lr-select': CustomEvent<{ conversationId: string }>;
  'lr-thread-pin': CustomEvent<{ conversationId: string; pinned: boolean }>;
  'lr-thread-archive': CustomEvent<{
    conversationId: string;
    archived: boolean;
  }>;
  'lr-thread-delete': CustomEvent<{ conversationId: string }>;
  'lr-thread-rename': CustomEvent<{ conversationId: string; label: string }>;
  'lr-filter-change': CustomEvent<{ text: string; matchCount: number }>;
  'lr-query-change': CustomEvent<{ text: string }>;
  'lr-group-toggle-request': CustomEvent<ThreadGroupToggleDetail>;
  'lr-group-toggle': CustomEvent<ThreadGroupToggleDetail>;
  /** The built-in `[part='retry-button']` was activated, only rendered while `error` is set.
   *  Cancelable: the default action clears `error`; `preventDefault()` leaves it set instead. */
  'lr-retry-request': CustomEvent<null>;
  blur: FocusEvent;
  focus: FocusEvent;
}

export interface ThreadGroupContext {
  id: string;
  threads: readonly LyraChatThread[];
  bucket?: ThreadBucketKey;
  date?: Date;
}

const EXCERPT_SELECTOR = '[part="row-excerpt"]';

const THREADS_AND_SLOTTED_CONTENT_WARNING_KEY =
  'lyra-thread-list:threads-and-slotted-content';
const THREADS_AND_SLOTTED_CONTENT_WARNING =
  '<lr-thread-list>: both `threads` and slotted content were supplied; `threads` data mode wins and the default slot is ignored.';

/**
 * `<lr-thread-list>` — the conversation sidebar: a grouped, searchable list of chat sessions with
 * pin/archive/delete/rename affordances. *Data mode* (non-empty `threads`, or empty `threads` with
 * nothing slotted) renders every row as a `<lr-conversation-item>` inside an internal
 * `<lr-virtual-list>` — virtualized by construction, scroll position and per-row state survive a
 * `threads` replacement; zero rows renders the built-in empty state. *Slotted mode* (empty `threads`
 * *and* real slotted content) renders host-supplied `<lr-conversation-item>`s from the default slot
 * as-is: no grouping, virtualization, or row actions in that mode — those are data-mode-only by design
 * (shadow DOM cannot inject group headers between slotted children).
 *
 * No thread CRUD or persistence: every mutation (`lr-thread-pin`/`-archive`/`-delete`/`-rename`) is
 * a controlled event carrying the *requested* new state — the host mutates `threads`.
 * Data-mode thread `id` values must be nonempty, nonblank, and unique. Untyped invalid rows and
 * later duplicates are omitted deterministically, so focus, virtualization, actions, and emitted
 * `conversationId` values all resolve to the first valid occurrence.
 * Arrow/Home/End navigation skips unavailable rows, including a row placed below an `inert`
 * ancestor by `wrapRow`. Arrow navigation continues through the complete item model at a virtual
 * window edge; Home/End always resolve the first/last complete-model thread even from a middle
 * window, mounting candidates until an available row can receive focus.
 *
 * Data mode: a host needing content with no home in `lr-conversation-item`'s own
 * `label`/`excerpt`/`meta`/`actions` surface sets `wrapRow` to wrap the already-built row. For
 * common row composition, `renderStart`, `renderExcerpt`, `renderMeta`, and `renderRowContent`
 * provide focused virtualized render hooks -- `renderExcerpt` renders into the row item's own
 * `excerpt` slot (winning over the plain-string `excerpt` property) for rich per-row content such
 * as a highlighted search snippet. Excerpt, meta and row-content output joins the row's
 * content-derived accessible name, as does a pinned row's localized "Pinned" status; `renderStart`
 * output stays out of it. A host needing a fully custom
 * `actions` surface itself — beyond `rowActions`'s closed `pin | archive | delete` set, e.g. a
 * `<lr-dropdown>` + `<lr-menu>` with Rename/Delete — sets `renderActions` instead; its content is appended after any
 * built-in `rowActions` output in the same slot, and `wrapRow` continues to compose around the result.
 *
 * Public collection properties take bounded, detached readonly sequences. Thread display fields
 * are projected from own data descriptors once per assignment; callbacks retain the caller's
 * exact source thread identity. Create a new collection and reassign it after changes; mutating
 * the assigned array does not update the view.
 *
 * A separate `error` state reports a failed load: while `error` is set, the built-in `<lr-empty>`
 * failed-load state (the same `error`-prefixed exported parts and `[part='retry-button']` as
 * `<lr-table>`) replaces the virtual list/empty state, behind its own `error` slot. `error` beats
 * the built-in empty state, matching `<lr-table>`'s own precedence.
 *
 * With dataSource, the provider owns global search, filtering, ordering and group metadata.
 * Source pages contain at most 500 records plus their intersecting group headings. sourceTotal
 * counts all matching records before collapse; collapsedGroupIds hides only the current page's
 * members and keeps their headings actionable. Group-label callbacks are passed to the provider;
 * renderGroupAdornment is legacy-only because it requires a complete group array. Row render
 * hooks still receive the original provider record identity. Source record display text is
 * bounded to 65,536 aggregate UTF-16 units; malformed pages fail visibly without partial rows.
 * Active IDs use provider locate to navigate once without scanning; clearing/restoring an ID
 * starts a new lookup. Manual page changes do not reapply an unchanged active ID. Provider search
 * events report the authoritative global record count after success. Same-source assignment or
 * requestUpdate() refreshes; named paints retain the page. Removing dataSource restores threads
 * and default-slot behavior. Source retry preserves the existing cancelable retry event.
 *
 * @customElement lr-thread-list
 * @slot - Slotted mode only: host-supplied `lr-conversation-item`s, rendered in order. Each
 *   top-level assigned element that doesn't already carry an explicit `role` is given
 *   `role="listitem"`, since `[part="list"]` is `role="list"` in this mode and `lr-conversation-item`
 *   deliberately doesn't self-apply that role (see its own class doc).
 * @slot empty - Replaces the built-in empty state.
 * @csspart source-status - Provider loading text.
 * @csspart source-pagination - Provider record-page navigation.
 * @slot error - Replaces the built-in failed-load state, including its retry button, while `error`
 *   is set.
 * @event lr-select - `detail: { conversationId }` -- a row was activated (data mode only).
 * @event lr-thread-pin - `detail: { conversationId, pinned }` -- the requested new state.
 * @event lr-thread-archive - `detail: { conversationId, archived }` -- the requested new state.
 * @event lr-thread-delete - `detail: { conversationId }` -- no built-in confirmation.
 * @event lr-thread-rename - `detail: { conversationId, label }`, re-emitted from the row's
 *   correlated `lr-rename` request (data mode only).
 * @event lr-filter-change - `detail: { text, matchCount }` -- data-mode query plus owned results.
 * @event lr-query-change - `detail: { text }` -- slotted-mode query request; the host owns results.
 * @event lr-group-toggle-request - `detail: { groupId, expanded }` is a cancelable proposal before a
 *   custom/date group's collapse state changes. Calling `preventDefault()` skips the built-in
 *   `collapsedGroupIds` write below and suppresses the following `lr-group-toggle`, leaving the
 *   group's collapse state fully controlled -- the host must then reassign `collapsedGroupIds`
 *   itself, mirroring `<lr-chat-message>`'s and `<lr-code-block>`'s own
 *   `lr-toggle-request`/`lr-toggle` pairs.
 * @event lr-group-toggle - `detail: { groupId, expanded }` -- a custom/date group's collapse-state
 *   change was accepted and, unless `lr-group-toggle-request` was prevented, already applied to
 *   `collapsedGroupIds`. A host that already listens here and reassigns `collapsedGroupIds` itself
 *   keeps working unchanged: this component's own write, when it happens, always precedes that
 *   listener in the same synchronous event dispatch, so the host's own assignment simply wins last.
 * @event {FocusEvent} blur - `searchable`: re-dispatched from the internal search `<input>`'s own `blur` --
 *   bubbling and composed (unlike the native event, which is neither), so a listener above the
 *   shadow boundary can observe it.
 * @event {FocusEvent} focus - `searchable`: re-dispatched from the internal search `<input>`'s own `focus`,
 *   for the same reason as `blur`.
 * @event lr-source-page-change-request - `detail: { page }` (zero-based) is a cancelable proposal
 *   from the built-in `[part='source-pagination']` before `sourcePage` changes. Calling
 *   `preventDefault()` skips the built-in `sourcePage` write and the following
 *   `lr-source-page-change`, leaving the page fully controlled.
 * @event lr-source-page-change - `detail: { page }` (zero-based) -- `sourcePage` was changed by
 *   the component rather than by the host: an accepted pagination request, the reset to page 0
 *   after a query input changes, the provider's correction of an out-of-range page, or the jump
 *   to the page holding `activeConversationId`. A host assignment never fires it.
 * @event lr-retry-request - Cancelable retry proposal before the default retry action. `detail: null`.
 *   The built-in `[part='retry-button']` was activated, only rendered while
 *   `error` is set. Cancelable: the default action clears `error`; `preventDefault()` leaves it
 *   set instead.
 * @csspart base - The root.
 * @csspart search - The search field wrapper.
 * @csspart search-input - The `<input type="search">`.
 * @csspart clear-button - Clears the search field. Rendered only while it has a value.
 * @csspart list - The list region.
 * @csspart empty - The empty/no-matches state.
 * @csspart limit - Original thread input-loss notice.
 * @csspart error - The built-in `<lr-empty>` host rendered while `error` is set.
 * @csspart error-base - Exported from the built-in error `<lr-empty>`'s own `base` part.
 * @csspart error-icon - Exported from the built-in error `<lr-empty>`'s `icon` part.
 * @csspart error-heading - Exported from the built-in error `<lr-empty>`'s `heading` part.
 * @csspart error-description - Exported from the built-in error `<lr-empty>`'s `description` part.
 * @csspart error-actions - Exported from the built-in error `<lr-empty>`'s `actions` part.
 * @csspart retry-button - The built-in retry control rendered into the error state's `actions`.
 * @csspart viewport - The real scroll container, exported from the internal `lr-virtual-list`. It
 *   fills this component's height with no consumer CSS (and falls back to `lr-virtual-list`'s own
 *   24rem `--lr-virtual-list-height` default when the container has no resolvable height). It
 *   honors the theme-level `--lr-theme-scrollbar-width`, `--lr-theme-scrollbar-gutter` and
 *   `--lr-theme-scrollbar-color` hooks (each defaulting to `auto`), like every internal scroller.
 * @csspart row-action - A built-in pin/archive/delete icon button (data mode, when `rowActions` includes it).
 * @csspart pin-glyph - The small pin indicator shown in a pinned row's `meta` slot (data mode).
 * @csspart group-header - A date/custom group header in data mode.
 * @csspart group-sticky - `sticky-groups` only: the pinned copy of the current group's header,
 *   exported from the internal `lr-virtual-list`'s sticky layer. It repeats the `group-header`,
 *   `group-label`, and `group-icon` visuals but is `aria-hidden`, inert, and pointer-transparent;
 *   the real row remains the sole `group-toggle`. Style this part for the pinned band itself, e.g.
 *   a shadow or a border under the band.
 * @csspart group-toggle - The controlled group expand/collapse button, named by its visible group
 *   label while `aria-expanded` reports the state.
 * @csspart group-label - The group label inside `group-toggle`.
 * @csspart group-adornment - Optional rich `renderGroupAdornment` output beside the toggle.
 * @csspart group-icon - The decorative expand/collapse glyph.
 * @csspart group-icon-collapsed - The glyph for a collapsed group.
 * @csspart row - Exported from the internal `lr-virtual-list`'s `row` part (data mode).
 * @csspart row-wrapper - The wrapper around `wrapRow` output (data mode, only when `wrapRow` is
 *   set). Row-only: group headers are never passed through `wrapRow`, so they never carry it.
 * @csspart row-start - The wrapper around `renderStart` output.
 * @csspart row-excerpt - The wrapper around `renderExcerpt` output, slotted into the row item's own
 *   `excerpt` slot.
 * @csspart row-content - The wrapper around `renderRowContent` output.
 * @csspart row-meta - A wrapper around built-in or `renderMeta` metadata.
 * @csspart row-actions - The wrapper around built-in and `renderActions` output.
 * @csspart row-item-base - Data mode: the row `<lr-conversation-item>`'s own `base` part — the box
 *   whose padding sets row height. `row-item-*` parts are the item's *internals*; the `row-*` parts
 *   above wrap this component's own callback output and are a different surface. Styling row
 *   density here replaces the older `::part(row) { --lr-theme-*: … }` workaround, which retheme'd
 *   the whole row subtree (`renderActions` popups included).
 * @csspart row-item-base-menu-open - Data mode: state alias on `row-item-base` while a menu that
 *   `renderActions` opened from that row is open (the row item's own `base-menu-open`). Key a
 *   hover- or focus-revealed row-menu trigger on it as well as on `:hover`/`:focus-within`, e.g.
 *   `::part(row-item-base-menu-open) { --app-row-actions-opacity: 1; }` read by
 *   `::part(row-actions)`: the open menu sits in the browser top layer, where Chromium and WebKit
 *   stop matching `:hover` and `:focus-within` on the row while the pointer or focus is inside it.
 *   The row also keeps its built-in hover tint while the menu is open.
 * @csspart row-item-active-indicator - Data mode: the row item's decorative active indicator,
 *   exported from `lr-conversation-item`.
 * @csspart row-item-select-button - Data mode: the row item's selectable button-like region.
 * @csspart row-item-start - Data mode: the row item's `start` wrapper.
 * @csspart row-item-content - Data mode: the row item's label/excerpt content column.
 * @csspart row-item-label - Data mode: the row item's visible label.
 * @csspart row-item-label-input - Data mode: the row item's in-place rename `<input>`.
 * @csspart row-item-rename-button - Data mode: the row item's pencil/rename affordance.
 * @csspart row-item-excerpt - Data mode: the row item's excerpt line.
 * @csspart row-item-meta - Data mode: the row item's `meta` wrapper.
 * @csspart row-item-timestamp - Data mode: the row item's `<time>` element.
 * @csspart row-item-actions - Data mode: the row item's `actions` wrapper.
 * @cssprop [--lr-thread-list-search-hover-border-color=var(--lr-color-brand)] - Border color of the
 *   hovered `[part="search-input"]`.
 * @cssprop [--lr-thread-list-search-padding=var(--lr-space-s)] - Gutter around the built-in search
 *   field. Deliberately not tiered by `size`, which sizes the field itself.
 * @cssprop [--lr-thread-list-search-gap=var(--lr-space-xs)] - Gap between the search field and its
 *   clear button.
 * @cssprop [--lr-thread-list-search-min-height] - Minimum row height of the search field. Unset
 *   while `size` is, so the field is exactly as tall as its own text plus padding; a `size` tier
 *   resolves it to that tier's shared form-control height.
 * @cssprop [--lr-thread-list-search-font-size] - Text size of the search field. Unset while `size`
 *   is, so the field inherits the ambient text size; a `size` tier resolves it to that tier's
 *   shared form-control font size.
 * @cssprop [--lr-thread-list-search-padding-inline=var(--lr-space-s)] - Inline gutter of the search
 *   field. A `size` tier replaces the default with that tier's shared form-control inline gutter.
 * @cssprop [--lr-thread-list-search-padding-block=var(--lr-space-xs)] - Block gutter of the search
 *   field. A `size` tier replaces the default with that tier's shared form-control block gutter.
 * @cssprop [--lr-thread-list-search-radius=var(--lr-radius)] - Corner radius of the search field. A
 *   `size` tier replaces the default with that tier's shared form-control radius.
 * @cssprop [--lr-thread-list-search-clear-size=var(--lr-icon-button-size)] - Box size of the search
 *   field's clear button. Deliberately not tiered by `size`: it is a tap target floored at
 *   `--lr-icon-button-size`, not a text box, so only a larger value changes it.
 * @cssprop [--lr-thread-list-group-header-bg=var(--lr-color-surface)] - Group header background; sticky headers stay opaque so scrolled rows never show through.
 * @cssprop [--lr-thread-list-group-header-padding=var(--lr-space-xs) var(--lr-space-s)] - Group header padding.
 * @cssprop [--lr-thread-list-group-toggle-font-size=var(--lr-size-1em)] - Group label font size, set on
 *   the header so the toggle and its `sticky-groups` copy match. Row density follows `size`.
 * @cssprop [--lr-thread-list-group-toggle-font-weight=var(--lr-font-weight-semibold)] - Group-toggle font weight.
 * @cssprop [--lr-thread-list-group-toggle-color=var(--lr-color-text-quiet)] - Group label colour at rest
 *   (set on the header, inherited by the toggle).
 * @cssprop [--lr-thread-list-group-toggle-min-block-size=var(--lr-icon-button-size)] - Group-toggle
 *   minimum block size.
 * @cssprop [--lr-thread-list-group-toggle-hover-bg=var(--lr-color-surface-raised)] - Group-toggle hover background.
 * @cssprop [--lr-thread-list-group-toggle-hover-color=var(--lr-color-text)] - Group-toggle hover foreground.
 * @cssprop [--lr-thread-list-group-toggle-active-bg=color-mix(in oklab, var(--lr-thread-list-group-toggle-hover-bg, var(--lr-color-surface-raised)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Group-toggle pressed background.
 * @cssprop [--lr-thread-list-group-toggle-active-color=var(--lr-thread-list-group-toggle-hover-color, var(--lr-color-text))] - Group-toggle pressed foreground.
 * @cssprop [--lr-thread-list-row-action-hover-bg=var(--lr-icon-button-bg-hover, var(--lr-color-surface-raised))] - Row-action hover background.
 * @cssprop [--lr-thread-list-row-action-hover-color=var(--lr-icon-button-color-hover, var(--lr-color-text))] - Row-action hover foreground.
 * @cssprop [--lr-thread-list-row-action-active-bg=var(--lr-icon-button-bg-active, color-mix(in oklab, var(--lr-thread-list-row-action-hover-bg, var(--lr-icon-button-bg-hover, var(--lr-color-surface-raised))), var(--lr-color-mix-partner) var(--lr-color-mix-active)))] - Row-action pressed background.
 * @cssprop [--lr-thread-list-row-action-active-color=var(--lr-icon-button-color-active, var(--lr-thread-list-row-action-hover-color, var(--lr-icon-button-color-hover, var(--lr-color-text))))] - Row-action pressed foreground.
 *   Row actions and the search clear button otherwise read the shared `--lr-icon-button-*` tokens.
 * @cssprop [--lr-thread-list-excerpt-highlight-bg=var(--lr-color-warning-quiet)] -
 *   Background of `<mark>` descendants returned by `renderExcerpt`.
 * @cssprop [--lr-thread-list-excerpt-highlight-color=currentColor] - Foreground of `<mark>`
 *   descendants returned by `renderExcerpt`.
 * @cssprop [--lr-thread-list-excerpt-highlight-radius=var(--lr-radius-xs)] - Corner radius of
 *   `<mark>` descendants returned by `renderExcerpt`.
 * @cssprop [--lr-thread-list-excerpt-highlight-padding=0] - Padding of `<mark>` descendants
 *   returned by `renderExcerpt`.
 * @cssprop --lr-icon-button-bg - Resting background of the search clear button.
 * @cssprop --lr-icon-button-bg-active - Pressed background of the search clear button.
 * @cssprop --lr-icon-button-bg-hover - Hover background of the search clear button.
 * @cssprop --lr-icon-button-border - Resting border of the search clear button.
 * @cssprop --lr-icon-button-border-active - Pressed border of the search clear button.
 * @cssprop --lr-icon-button-border-hover - Hover border of the search clear button.
 * @cssprop --lr-icon-button-color - Resting foreground of the search clear button.
 * @cssprop --lr-icon-button-color-active - Pressed foreground of the search clear button.
 * @cssprop --lr-icon-button-color-hover - Hover foreground of the search clear button.
 * @cssprop --lr-icon-button-radius - Corner radius of the search clear button.
 * @status stable
 * @since 4.0.0
 */
export class LyraThreadList extends LyraElement<LyraThreadListEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    archiveConversation: LYRA_DEFAULT_archiveConversation,
    clear: LYRA_DEFAULT_clear,
    conversationActionWithTitle: LYRA_DEFAULT_conversationActionWithTitle,
    deleteConversation: LYRA_DEFAULT_deleteConversation,
    loading: LYRA_DEFAULT_loading,
    noData: LYRA_DEFAULT_noData,
    noMatches: LYRA_DEFAULT_noMatches,
    pinConversation: LYRA_DEFAULT_pinConversation,
    retry: LYRA_DEFAULT_retry,
    searchThreads: LYRA_DEFAULT_searchThreads,
    tableLoadFailed: LYRA_DEFAULT_tableLoadFailed,
    threadGroupArchived: LYRA_DEFAULT_threadGroupArchived,
    threadGroupPinned: LYRA_DEFAULT_threadGroupPinned,
    threadGroupPrevious30Days: LYRA_DEFAULT_threadGroupPrevious30Days,
    threadGroupPrevious7Days: LYRA_DEFAULT_threadGroupPrevious7Days,
    threadGroupToday: LYRA_DEFAULT_threadGroupToday,
    threadGroupYesterday: LYRA_DEFAULT_threadGroupYesterday,
    threadListEmpty: LYRA_DEFAULT_threadListEmpty,
    threadListInputLimit: LYRA_DEFAULT_threadListInputLimit,
    threadListLabel: LYRA_DEFAULT_threadListLabel,
    threadListMatchAnnounce: LYRA_DEFAULT_threadListMatchAnnounce,
    unarchiveConversation: LYRA_DEFAULT_unarchiveConversation,
    unpinConversation: LYRA_DEFAULT_unpinConversation,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  protected static override collectionSupport = collectionSupport;

  protected static override readonly ownedCollectionProperties = Object.freeze(['threads', 'groupOrder', 'collapsedGroupIds', 'rowActions']);
  protected static override readonly identityCollectionProperties = Object.freeze(['threads']);

  static override styles = [LyraElement.styles, contextualSizes, styles];
  private readonly inputLimitAnnouncements = new AnnouncementSinkController(this);
  private get inputLimitMessage(): string {
    if (this.sourceMode) return '';
    return publicCollectionTruncation(this, 'threads') ? this.localize('threadListInputLimit') : '';
  }
  private syncInputLimitAnnouncement(): void {
    const loss = this.sourceMode ? undefined : publicCollectionTruncation(this, 'threads');
    this.inputLimitAnnouncements.transition('input-limit', loss ? `${loss.source}:${loss.retained}:${loss.kept}` : '', this.inputLimitMessage, 'polite');
  }
  private readonly hostDescription = new HostDescriptionController(
    this, () => this.renderRoot.querySelector<HTMLElement>('[part="base"][role="region"]'),
  );

  override adoptedCallback(): void {
    this.focusTaskGeneration++;
    this.stopPendingFocus?.();
    super.adoptedCallback();
    this.hostDescription.adopted();
    this.inputLimitAnnouncements.adopted();
    this.sourcePages.adopted();
    this.sourceRequestVersion++; this.sourceActiveInputs = undefined; this.sourceFilterIntent = undefined;
  }

  private _dataSource?: ThreadListSource;
  private sourceEpoch = 0;
  private sourceSyncing = false;
  /** Set by a component-owned `sourcePage` correction; `updated()` reports it once. */
  private sourcePageChangePending = false;
  private sourceInputs?: readonly unknown[];
  private readonly sourceQueryInputs = new SourceQueryInputs();
  private sourceRequestVersion = 0;
  private sourceFilterIntent?: { text: string; version: number };
  private sourceActiveInputs?: readonly unknown[];
  private sourceActiveReveal?: { id: string; version: number };
  @state() private sourceStateVersion = 0;
  private readonly sourcePages = new ThreadListPageController<ThreadListSourceQuery>(this, () => { this.sourceStateVersion++; });

  /** Full-source page provider, taking precedence over threads and the default slot. Present
   * invalid providers fail visibly. Reassign even the same source or call requestUpdate() to
   * refresh; undefined restores legacy data/slotted mode. */
  @property({ attribute: false })
  get dataSource(): ThreadListSource | undefined { return this._dataSource; }
  set dataSource(value: ThreadListSource | undefined) {
    const previous = this._dataSource; this._dataSource = value; this.sourceEpoch++;
    this.requestUpdate('dataSource', previous);
  }
  /** Zero-based source record page. Collapsing groups preserves this page and its record positions. */
  @property({ converter: blankNumberConverter(0), attribute: 'source-page' }) sourcePage = 0;
  /** Source records per page, normalized to 1..500. Size changes reset page 0. */
  @property({ converter: blankNumberConverter(100), attribute: 'source-page-size' }) sourcePageSize = 100;
  /** Exact current-query record count before group collapse, or null before success/without a source. */
  get sourceTotal(): number | null { return this.sourceMode ? this.sourcePages.state.result?.total ?? null : null; }
  private get sourceMode(): boolean { return this.dataSource !== undefined; }
  private get sourceFailed(): boolean { return this.sourceMode && !this.sourcePages.state.pending && !this.sourcePages.state.result; }
  private get sourceBlocked(): boolean { return this.sourceMode && (!this.isConnected || this.error || this.sourcePages.state.pending || this.sourceFailed); }

  private syncSource(): void {
    if (!this.sourcePages || this.sourceSyncing) return;
    this.sourceSyncing = true;
    try {
      if (!this.sourceMode) {
        if (this.sourceInputs) { this.sourceRequestVersion++; this.focusTaskGeneration++; this.sourcePages.bind(undefined); }
        this.sourceInputs = undefined; this.sourceQueryInputs.clear();
        this.sourcePages.clearPage(); this.sourceActiveInputs = undefined;
        this.sourceActiveReveal = undefined; this.sourceFilterIntent = undefined; return;
      }
      const source = this.dataSource!;
      const size = normalizeSourcePageSize(this.sourcePageSize);
      let page = normalizeSourcePage(this.sourcePage, size);
      const queryInputs = [this.searchText, this.withArchived, this.grouping, this.filter, this.groupBy, this.getGroupLabel, this.groupOrder, size];
      if (this.sourceQueryInputs.changed(queryInputs) && this.hasUpdated) {
        if (this.sourcePage !== 0) this.sourcePageChangePending = true;
        page = 0; this.sourcePage = 0;
      }
      const revision = source.revision;
      const inputs = [source, revision, this.sourceEpoch, this.effectiveLocale, ...queryInputs, this.collapsedGroupIds, page];
      if (this.sourceInputs && inputs.every((value, index) => value === this.sourceInputs![index])) return;
      this.sourceInputs = inputs; this.sourceRequestVersion++; this.focusTaskGeneration++;
      this.sourcePages.clearPage();
      this.sourceActiveReveal = undefined; this.sourceFilterIntent = undefined;
      this.sourcePages.bind({ source, revision, epoch: this.sourceEpoch, locale: this.effectiveLocale });
      const query: ThreadListSourceQuery = Object.freeze({ search: this.searchText, withArchived: this.withArchived,
        grouping: this.grouping, collapsedGroupIds: this.collapsedGroupIds, filter: this.filter, groupBy: this.groupBy,
        getGroupLabel: this.getGroupLabel, groupOrder: this.groupOrder });
      void this.sourcePages.request(query, page, size);
    } catch {
      this.sourcePages.bind(undefined); this.sourcePages.clearPage();
    } finally { this.sourceSyncing = false; }
  }

  private acceptSourcePage(): void {
    const result = this.sourcePages.state.result;
    if (!result || !this.sourcePages.acceptPage(result)) return;
    if (this.sourcePage !== this.sourcePages.state.page) {
      this.sourceSyncing = true; this.sourcePage = this.sourcePages.state.page; this.sourceSyncing = false;
      this.sourcePageChangePending = true;
      this.sourceInputs = this.sourceInputs ? [...this.sourceInputs.slice(0, -1), this.sourcePages.state.page] : undefined;
    }
    const intent = this.sourceFilterIntent;
    this.sourceFilterIntent = undefined;
    if (intent?.version === this.sourceRequestVersion) {
      const source = this.dataSource;
      const epoch = this.sourceEpoch;
      const state = this.sourcePages.state;
      const owner = this.ownerDocument;
      this.emit('lr-filter-change', { text: intent.text, matchCount: result.total });
      if (!this.isConnected || this.ownerDocument !== owner || this.dataSource !== source ||
          this.sourceEpoch !== epoch || this.sourceRequestVersion !== intent.version ||
          this.sourcePages.state !== state || this.sourceBlocked) return;
      this.announceMatchCount(result.total);
    }
    const reveal = this.sourceActiveReveal;
    this.sourceActiveReveal = undefined;
    if (reveal?.version === this.sourceRequestVersion) this.revealSourceActive(reveal.id, reveal.version);
  }

  private syncSourceActive(): void {
    if (!this.activeConversationId) { this.sourceActiveInputs = undefined; return; }
    if (!this.sourceMode || this.sourceBlocked) return;
    const source = this.dataSource!;
    const id = this.activeConversationId;
    const inputs = [source, source.revision, this.sourceEpoch, this.effectiveLocale, ...(this.sourceQueryInputs.current ?? []), id];
    if (this.sourceActiveInputs && inputs.every((value, index) => value === this.sourceActiveInputs![index])) return;
    this.sourceActiveInputs = inputs;
    const version = this.sourceRequestVersion;
    const owner = this.ownerDocument;
    void this.sourcePages.locate(id).then(index => {
      if (index === null || !this.isConnected || this.ownerDocument !== owner || !this.sourceMode || this.dataSource !== source || this.activeConversationId !== id || this.sourceRequestVersion !== version) return;
      const page = sourcePageOfRecord(index, this.sourcePageSize);
      if (page === this.sourcePage) { this.revealSourceActive(id, version); return; }
      this.sourcePage = page; this.sourcePageChangePending = true;
      this.sourceActiveReveal = { id, version: this.sourceRequestVersion };
    });
  }

  private revealSourceActive(id: string, version: number): void {
    const owner = this.ownerDocument;
    void this.updateComplete.then(async () => {
      const list = this.virtualListEl;
      if (!list) return;
      await list.updateComplete;
      if (!this.isConnected || this.ownerDocument !== owner || !this.sourceMode || this.sourceBlocked || this.sourceRequestVersion !== version || this.activeConversationId !== id || list !== this.virtualListEl) return;
      const index = this.model().items.findIndex(item => item.kind === 'thread' && item.thread.id === id);
      if (index >= 0) list.scrollToIndex(index, { align: 'auto', behavior: 'auto' });
    });
  }

  private canUseThread(thread: LyraChatThread): boolean {
    return !(this.sourceMode || this.sourcePages.sourceRowIdentities.has(thread)) || (this.sourceMode && !this.sourceBlocked && this.sourcePages.sourceRows.includes(thread));
  }
  private canUseGroup(item: Extract<ThreadListItem, { kind: 'group' }>): boolean {
    return !(this.sourceMode || this.sourcePages.sourceGroupIdentities.has(item)) || (this.sourceMode && !this.sourceBlocked && this.model().items.includes(item));
  }
  private onSourcePage = (event: CustomEvent<{ page: number }>): void => {
    event.stopPropagation();
    if (!this.sourceMode || this.sourceBlocked) return;
    const detail: ThreadListSourcePageChangeDetail = { page: event.detail.page - 1 };
    requestThenCommit({
      requestDetail: detail,
      emitRequest: (requestDetail, init: { cancelable: true }) =>
        this.emit('lr-source-page-change-request', requestDetail, init),
      commit: () => {
        if (!this.sourceMode || this.sourceBlocked) return;
        this.sourcePage = detail.page;
        this.emit('lr-source-page-change', detail);
      },
    });
  };
  private currentSourceRetry(source: ThreadListSource | undefined, state: SourcePageState<LyraChatThread>): boolean {
    return this.isConnected && this.sourceMode && this.dataSource === source && this.sourcePages.state === state && (this.error || this.sourceFailed);
  }
  private retrySource(source: ThreadListSource | undefined, state: SourcePageState<LyraChatThread>): void {
    if (!this.currentSourceRetry(source, state)) return;
    this.error = false; this.sourceInputs = undefined; this.syncSource(); this.sourceStateVersion++;
  }

  /** At least one valid thread ⇒ data mode (the default slot is ignored). No valid threads and no
   *  slotted content ⇒ data mode with zero rows (the built-in empty state). No valid threads with
   *  slotted content ⇒ slotted mode. Thread ids must be nonempty and unique; invalid/later
   *  duplicate rows are omitted, first wins. Group headings do not consume the thread admission
   *  budget: all admitted threads remain addressable in the virtual list. The first 10,000 input records are retained,
   *  matching newest-first sidebar ordering. Assign a new array to update: mutating an array and assigning it again does not. */
  @property({ attribute: false }) threads: readonly LyraChatThread[] = [];

  /**
   * Data mode: marks the matching raw thread id `active`/`aria-current` and scrolls it into view.
   * Internal group and thread keys are separately namespaced, so ids such as `group:today` remain
   * ordinary thread ids rather than colliding with a group header.
   */
  @property({ attribute: 'active-conversation-id' }) activeConversationId = '';

  /** Shows the built-in search field. */
  @property({ type: Boolean, reflect: true }) searchable = false;

  /** Shared size tier for the built-in search field and data-mode rows. Defaults to `m`.
   * Explicit `small`/`medium`/`large` spellings remain accepted; invalid or omitted writes
   * restore `m`. Slotted rows keep their own size. */
  @property({ reflect: true }) size: LyraSize | undefined = 'm';

  /** Overrides the default case-insensitive `title` + `excerpt` substring match. */
  @property({ attribute: false }) filter?: (
    thread: LyraChatThread,
    query: string
  ) => boolean;

  /** Data mode: bucket rows under localized date headers (a future timestamp counts as today, a
   *  missing or invalid one files under "Previous 30 days"), use `groupBy` with `'custom'`, or use
   *  `'none'` for a flat list in host order. */
  @property() grouping: ThreadListGrouping = 'date';

  /** `grouping="custom"`: derives an arbitrary controlled nonblank group id for every visible
   * thread. Rows whose callback fails or returns an invalid id are omitted from the grouped view. */
  @property({ attribute: false }) groupBy?: (thread: LyraChatThread) => string;

  /** Returns the semantic string label for any date or custom group. Re-invoked when the threads,
   *  grouping inputs, locale or this callback change, or on `requestUpdate()`. */
  @property({ attribute: false }) getGroupLabel?: (
    context: ThreadGroupContext
  ) => string;

  /** Renders optional rich content beside (never inside) a group toggle. Re-invoked like
   *  `getGroupLabel`. */
  @property({ attribute: false }) renderGroupAdornment?: (
    context: ThreadGroupContext
  ) => TemplateResult;

  /** `grouping="custom"`: explicit group-id order, or a comparator. Unlisted ids follow in their
   *  first-seen order when an array is supplied. */
  @property({ attribute: false }) groupOrder?:
    | readonly string[]
    | ((a: string, b: string) => number);

  /** Data mode: ids of date/custom groups whose rows are omitted from virtualization.
   *  Self-managed by default -- activating the built-in group toggle updates this array directly.
   *  Prevent the default of the cancelable `lr-group-toggle-request` event to veto that write and
   *  keep this property fully controlled instead. */
  @property({ attribute: false }) collapsedGroupIds: readonly string[] = [];

  /** Data mode only: built-in icon buttons rendered into each row's `actions` slot, in display order. */
  @property({ attribute: false }) rowActions: readonly ThreadRowAction[] = [];

  /** Data mode only: appended after any built-in `rowActions` buttons in the same row's `actions`
   *  slot -- the escape hatch for a fully custom per-row action surface (e.g. an `<lr-dropdown>`
   *  containing `<lr-menu>` with
   *  Rename/Delete, mirroring an app's own richer row-action menu) that `rowActions`'s closed
   *  `pin | archive | delete` set can't express. Additive, not a replacement: both render together
   *  when `rowActions` is also non-empty, the same composition direction `wrapRow` already takes
   *  elsewhere on the row (it only ever adds content, never removes built-in output) -- set
   *  `rowActions` to `[]` (its default) to omit the built-in buttons and use only the callback's
   *  content. Receives the *current* thread on every render, re-invoked per row through the
   *  virtualized `renderItem` path exactly like `wrapRow` -- never memoized or stale. Rendered as a
   *  DOM sibling of the row's own selectable region (`lr-conversation-item`'s `[part="select-button"]`),
   *  the same structural reason the built-in `rowActions` buttons don't also trigger `lr-select` --
   *  so ordinary Lyra controls returned here (`lr-dropdown`, `lr-icon-button`, etc.) fire their own
   *  events normally without also selecting the row. A nested open `lr-dropdown` also keeps its
   *  virtual row above later rows even if focus temporarily leaves the menu. Overlays returned here
   *  default to the `fixed` strategy inside the virtual row and open at full size outside the list
   *  (in the browser top layer where the native Popover API exists), in both directions; a
   *  promoted menu whose trigger scrolls out of the list is hidden until the trigger returns. An
   *  explicit `positioning-strategy="absolute"` keeps a menu inside the row. While such a menu is
   *  open its row carries `row-item-base-menu-open`, so a trigger revealed on row hover or focus
   *  can stay revealed while the pointer or focus is inside the top-layer menu. Arrow, Home and End
   *  keys a returned control already handled (`preventDefault()`, as `lr-menu` does) stay with that
   *  control instead of also moving between rows. Unset (the default) leaves `rowActions`' output
   *  byte-for-byte unchanged. */
  @property({ attribute: false }) renderActions?: (
    thread: LyraChatThread
  ) => TemplateResult;

  /** Data mode only: renders non-interactive content in the row's start slot, before its label
   *  and excerpt. The callback runs during the virtualized row render. */
  @property({ attribute: false }) renderStart?: (
    thread: LyraChatThread
  ) => TemplateResult;

  /** Data mode only: renders the row's meta content. Built-in pin metadata remains available when
   *  present, and this result is appended in the same meta region. */
  @property({ attribute: false }) renderMeta?: (
    thread: LyraChatThread
  ) => TemplateResult;

  /** Data mode only: renders the row's excerpt content into the row item's own `excerpt` slot,
   *  which wins over its plain-string `excerpt` property whenever it has assigned content -- see
   *  `<lr-conversation-item>`'s own `excerpt` slot doc. Use this for rich content the plain
   *  `LyraChatThread.excerpt` string can't carry, e.g. a server-highlighted search-match snippet.
   *  Unlike `renderRowContent`, this leaves the built-in label layout and inline-rename affordance
   *  untouched -- only the excerpt line is replaced. Unset (the default) leaves the plain-string
   *  `excerpt` property rendering exactly as it does today. */
  @property({ attribute: false }) renderExcerpt?: (
    thread: LyraChatThread
  ) => TemplateResult;

  /** Data mode only: replaces the conversation item's label/excerpt/meta content area with a
   *  host-rendered row body. Use this for structured, non-interactive row content while keeping
   *  the selectable row and timestamp semantics supplied by `<lr-conversation-item>`. */
  @property({ attribute: false }) renderRowContent?: (
    thread: LyraChatThread
  ) => TemplateResult;

  /** Overrides the default locale-aware formatting used for month group dates. */
  @property({ attribute: false }) formatDate?: (date: Date) => string;

  /** Data mode: include `archived` threads (in their own trailing group under `grouping="date"`). */
  @property({ type: Boolean, attribute: 'with-archived', reflect: true })
  withArchived = false;

  /** Forwarded to each data-mode row: turns off its inline rename. */
  @property({ type: Boolean, attribute: 'without-rename', reflect: true }) withoutRename = false;

  /** Data mode: omits the `pin-glyph` indicator from pinned rows. Each pinned row keeps a visually
   *  hidden "Pinned" label in its `meta` slot, so assistive technology still hears the state. */
  @property({ type: Boolean, attribute: 'without-pin-glyph', reflect: true }) withoutPinGlyph = false;

  /** Data mode: omits the decorative `group-icon` chevron from group headers (and their
   *  `sticky-groups` copy). The group toggle keeps `aria-expanded`, so its state is unchanged. */
  @property({ type: Boolean, attribute: 'without-group-icon', reflect: true }) withoutGroupIcon = false;

  /** Data mode only: pins the current date/custom group's header to the top of the scroll viewport
   *  while its rows are in view, pushing it off as the next group's header arrives. Group headers
   *  are ordinary virtualized rows, so this renders a `aria-hidden` copy of the header into
   *  `lr-virtual-list`'s sticky layer (`[part="group-sticky"]`) — the real row keeps the
   *  `role="heading"`, focus, and collapse-action ownership, while the copy is presentational,
   *  inert, and pointer-transparent. Default `false` leaves rendering exactly as it is without
   *  this feature; `grouping="none"` has no headers to pin, so it is a no-op there. */
  @property({ type: Boolean, attribute: 'sticky-groups', reflect: true })
  stickyGroups = false;

  /** Accessible name for the list region. Optional. Omitting it localizes the default
   *  `threadListLabel` message; an explicit empty string renders no visible/accessible label. */
  @property() label?: string;

  /** Reports a failed thread-list load. While set, the built-in failed-load state (matching
   *  `<lr-table>`'s own `error` contract) replaces the virtual list/empty state; `error` beats the
   *  built-in empty state. Reflected so `[error]` is selectable from outside. */
  @property({ type: Boolean, reflect: true }) error = false;

  /** Failed-load heading override. Omitted localizes `<lr-table>`'s own `tableLoadFailed`
   *  default. */
  @property({ attribute: 'error-heading' }) errorHeading?: string;

  /** Failed-load supporting copy. */
  @property({ attribute: 'error-description' }) errorDescription = '';

  /** Data mode only: wraps each row's built-in `<lr-conversation-item>` with host-supplied
   *  content that has no home in the item's own `label`/`excerpt`/`meta`/`actions` surface — e.g. a
   *  start-side purpose icon (`lr-conversation-item` has no default slot to receive one) or trailing
   *  tag chips. Receives the thread and the already-built row `TemplateResult`; returns the final
   *  row content. Unset renders the built-in row unwrapped -- no extra element is added at all.
   *  When set, the returned content is placed inside a library-owned `part="row-wrapper"` block
   *  `<div>`, so the whole wrapped row is styleable from outside as
   *  `lr-thread-list::part(row-wrapper)` (padding, border, background, `display: flex`, …) without
   *  the host having to thread its own class through this callback. That wrapper is deliberately
   *  unstyled and block-level: the box `lr-virtual-list` measures for windowing is its own
   *  `[part="row"]` one level up, and an unstyled block box contributes exactly its child's height
   *  to it, so adding it leaves every measured row height unchanged. Applies to rows only -- group
   *  headers never pass through `wrapRow` and never carry `row-wrapper`. */
  @property({ attribute: false }) wrapRow?: (
    thread: LyraChatThread,
    row: TemplateResult
  ) => TemplateResult;

  /** Group header items by id, refreshed whenever the item list is rebuilt, so the sticky callback
   *  can render the same header the anchor points at. */
  private readonly stickyGroupItems = new Map<
    string,
    Extract<ThreadListItem, { kind: 'group' }>
  >();

  private dataModel?: ThreadListModel;

  @state() private searchText = '';
  @state() private hasEmptySlot = false;
  @state() private hasDefaultSlotContent = false;

  @query(tag('virtual-list')) private virtualListEl?: LyraVirtualList;
  @query(tag('live-region')) private liveRegion?: LyraLiveRegion;
  @query('[part="search-input"]') private searchInputEl?: HTMLInputElement;
  private focusTaskGeneration = 0;
  private stopPendingFocus?: () => void;
  private readonly excerptObserver = new OwnedMutationObserver(this, records => this.updateMutatedExcerpts(records));
  private excerptRoot?: Node & ParentNode;
  private excerptObservationGeneration = 0;
  private readonly injectedListItemRoles = new Set<Element>();

  // Slotted mode is only for a host that's actually relying on it (real slotted content present)
  // and hasn't also supplied `threads` -- empty `threads` with nothing slotted is still data mode,
  // just with zero rows, so it renders the built-in empty state rather than a silently blank slot.
  private get dataMode(): boolean {
    return this.sourceMode || this.normalizedThreads.length > 0 || !this.hasDefaultSlotContent;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      if (this.sourceMode) { this.sourceActiveInputs = undefined; this.sourceStateVersion++; }
      this.syncInputLimitAnnouncement();
      const defaultSlotted = this.defaultSlottedElements();
      this.hasDefaultSlotContent = defaultSlotted.length > 0;
      if (!this.sourceMode && this.normalizedThreads.length === 0) this.markAsListItems(defaultSlotted);
      void this.observeRenderedExcerpts();
    }
  }

  private contentRefreshPending = false;

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    if (args[0] === undefined) { this.contentRefreshPending = true; this.sourceEpoch = (this.sourceEpoch ?? 0) + 1; }
    if (args[0] === undefined || ['dataSource', 'sourcePage', 'sourcePageSize', 'searchText', 'withArchived', 'grouping', 'filter', 'groupBy', 'getGroupLabel', 'groupOrder', 'collapsedGroupIds'].includes(String(args[0]))) this.syncSource();
    super.requestUpdate(...args);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncSource();
    if (this.sourceMode) { this.acceptSourcePage(); this.syncSourceActive(); }
    // Keep explicit refresh authority when another property joins the same update.
    if (this.contentRefreshPending) this.dataModel = undefined;
    this.contentRefreshPending = false;
    if (changed.has('size') && optionalSizeConverter.normalize(this.size) === undefined) this.size = 'm';
    if (
      changed.has('threads') ||
      changed.has('searchText') ||
      changed.has('filter') ||
      changed.has('grouping') ||
      changed.has('groupBy') ||
      changed.has('groupOrder') ||
      changed.has('collapsedGroupIds') ||
      changed.has('withArchived')
    ) {
      this.focusTaskGeneration++;
    }
    const syncSlottedContent = (): void => {
      const defaultSlotted = this.defaultSlottedElements();
      this.hasDefaultSlotContent = defaultSlotted.length > 0;
      const hasDataThreads = this.sourceMode || this.normalizedThreads.length > 0;
      if (hasDataThreads && defaultSlotted.length > 0) {
        this.restoreInjectedListItemRoles();
        if (!this.sourceMode) devWarnOnce(
          THREADS_AND_SLOTTED_CONTENT_WARNING_KEY,
          THREADS_AND_SLOTTED_CONTENT_WARNING
        );
      } else if (!hasDataThreads) {
        this.markAsListItems(defaultSlotted);
      }
    };
    if (!this.hasUpdated) {
      // A server render sees no light-DOM children, so it always renders data mode; a hydrating
      // list reproduces that first and adopts slotted rows on the update right after. Every
      // light-DOM read of the first update goes through the one deferral, including the
      // `threads` branch below -- the initial property values reach it as changes too, and a
      // single live read there is enough to contradict the markup being hydrated.
      this.seedFirstRenderState(() => {
        this.hasEmptySlot = hasSlotContent(this, 'empty');
        syncSlottedContent();
      });
    } else if (changed.has('threads') || changed.has('dataSource')) {
      syncSlottedContent();
    }
  }

  private sourceStatusInitialized = false;
  private previousSourceStatus = '';
  private childRegistration?: Promise<unknown>;

  protected override async getUpdateComplete(): Promise<boolean> {
    const complete = await super.getUpdateComplete();
    await this.childRegistration;
    return complete;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.sourcePageChangePending) {
      this.sourcePageChangePending = false;
      if (this.sourceMode) this.emit('lr-source-page-change', { page: this.sourcePage });
    }
    this.childRegistration = loadLazyChildren(THREAD_LIST_CHILDREN, this.renderRoot) ?? this.childRegistration;
    this.syncInputLimitAnnouncement();
    const status = this.sourceMode && this.sourcePages.state.pending ? this.localize('loading')
      : this.sourceMode && this.sourceFailed ? this.localize('tableLoadFailed') : '';
    if (this.sourceStatusInitialized && status && status !== this.previousSourceStatus) this.inputLimitAnnouncements.announcePolite(status);
    this.sourceStatusInitialized = true; this.previousSourceStatus = status;
    void this.observeRenderedExcerpts();
  }

  private async observeRenderedExcerpts(): Promise<void> {
    const generation = ++this.excerptObservationGeneration;
    const list = this.virtualListEl;
    if (list) await list.updateComplete;
    if (!this.isConnected || generation !== this.excerptObservationGeneration || list !== this.virtualListEl) return;
    const root = this.renderExcerpt ? list?.renderRoot : undefined;
    if (root === this.excerptRoot && this.excerptObserver.active) return;
    this.excerptObserver.clear();
    this.excerptRoot = root;
    if (!root) return;
    this.syncRenderedExcerpts(root.querySelectorAll<HTMLElement>(EXCERPT_SELECTOR));
    this.excerptObserver.observe(root, { childList: true, characterData: true, subtree: true });
  }

  private updateMutatedExcerpts(records: MutationRecord[]): void {
    const wrappers = new Set<HTMLElement>();
    for (const record of records) {
      const parent = isElementNode(record.target) ? record.target : record.target.parentElement;
      const wrapper = parent?.closest<HTMLElement>(EXCERPT_SELECTOR);
      if (wrapper) wrappers.add(wrapper);
      for (const node of record.addedNodes) {
        if (!isElementNode(node)) continue;
        if (node.matches(EXCERPT_SELECTOR)) wrappers.add(node as HTMLElement);
        for (const nested of node.querySelectorAll<HTMLElement>(EXCERPT_SELECTOR)) wrappers.add(nested);
      }
    }
    this.syncRenderedExcerpts(wrappers);
  }

  private syncRenderedExcerpts(wrappers: Iterable<HTMLElement>): void {
    // The renderer's span is plumbing, not excerpt content. Keep all element children meaningful
    // (including icons and images), while an empty Lit template contributes no slot or row gap.
    for (const wrapper of wrappers) {
      if (wrapper.parentElement?.localName !== tag('conversation-item')) continue;
      const present = Array.from(wrapper.childNodes).some(node =>
        node.nodeType === 1 || (node.nodeType === 3 && (node.textContent ?? '').trim().length > 0));
      const slot = present ? 'excerpt' : '';
      if (wrapper.slot !== slot) wrapper.slot = slot;
    }
  }

  private defaultSlottedElements(): Element[] {
    return Array.from(this.children).filter((el) => !el.getAttribute('slot'));
  }

  // Slotted rows need listitem semantics here. Preserve any role the caller supplied.
  private markAsListItems(elements: Element[]): void {
    for (const el of elements) {
      if (!el.hasAttribute('role')) {
        el.setAttribute('role', 'listitem');
        this.injectedListItemRoles.add(el);
      }
    }
  }

  private restoreInjectedListItemRoles(keep = new Set<Element>()): void {
    for (const element of this.injectedListItemRoles) {
      if (keep.has(element)) continue;
      if (element.getAttribute('role') === 'listitem')
        element.removeAttribute('role');
      this.injectedListItemRoles.delete(element);
    }
  }

  override disconnectedCallback(): void {
    this.excerptObservationGeneration++;
    this.excerptObserver.clear();
    this.excerptRoot = undefined;
    this.sourceRequestVersion++; this.sourceActiveInputs = undefined; this.sourceActiveReveal = undefined; this.sourceFilterIntent = undefined;
    this.sourceStatusInitialized = false; this.previousSourceStatus = '';
    this.focusTaskGeneration++;
    this.stopPendingFocus?.();
    this.restoreInjectedListItemRoles();
    super.disconnectedCallback();
  }

  /** The first 10,000 thread identities are retained, matching newest-first sidebar ordering. */
  private get normalizedThreads(): readonly LyraChatThread[] {
    return canonicalThreads(this.threads);
  }

  private sourceThreads(threads: readonly LyraChatThread[]): readonly LyraChatThread[] {
    return Object.freeze(threads.map(sourceThread));
  }

  private readonly titleHaystacks = createHaystackMemo<LyraChatThread>((thread, locale) => foldSearchText(thread.title, locale));
  private readonly excerptHaystacks = createHaystackMemo<LyraChatThread>((thread, locale) => foldSearchText(thread.excerpt ?? '', locale));

  private get visibleThreads(): LyraChatThread[] {
    const q = this.searchText.trim().toLocaleLowerCase(this.effectiveLocale);
    const needle = q && !this.filter ? prepareNeedle(this.searchText, this.effectiveLocale) : '';
    const threads = this.normalizedThreads;
    const titles = q && !this.filter ? this.titleHaystacks(threads, this.effectiveLocale) : [];
    const excerpts = q && !this.filter ? this.excerptHaystacks(threads, this.effectiveLocale) : [];
    return threads.filter((thread, index) => (this.withArchived || !thread.archived) &&
      (!q || (this.filter ? this.matchesCustomFilter(thread, q) : titles[index]!.includes(needle) || excerpts[index]!.includes(needle))));
  }

  private matchesCustomFilter(thread: LyraChatThread, query: string): boolean {
    try {
      return Boolean(this.filter?.(sourceThread(thread), query));
    } catch {
      return false;
    }
  }

  private bucketLabel(key: ThreadBucketKey): string {
    const groupDate = key.startsWith('month:')
      ? dateForBucket(key)
      : undefined;
    switch (key) {
      case 'pinned':
        return this.localize('threadGroupPinned');
      case 'today':
        return this.localize('threadGroupToday');
      case 'yesterday':
        return this.localize('threadGroupYesterday');
      case 'previous7':
        return this.localize('threadGroupPrevious7Days');
      case 'previous30':
        return this.localize('threadGroupPrevious30Days');
      case 'archived':
        return this.localize('threadGroupArchived');
      default: {
        return (
          this.formatDate?.(groupDate!) ??
          getDateTimeFormat(this.effectiveLocale, {
            month: 'long',
            year: 'numeric',
          }).format(groupDate!)
        );
      }
    }
  }

  private orderedCustomGroupIds(grouped: Map<string, LyraChatThread[]>): string[] {
    const firstSeen = [...grouped.keys()];
    if (typeof this.groupOrder === 'function') {
      // Sorts a copy, not `firstSeen` itself: `Array.prototype.sort` reorders in place before a
      // throwing comparator surfaces its exception, so sorting `firstSeen` directly would leave the
      // fallback below with a partially-shuffled array instead of the documented first-seen order.
      try {
        return [...firstSeen].sort(this.groupOrder);
      } catch {
        return firstSeen;
      }
    }
    if (!this.groupOrder) return firstSeen;
    const ordered = [...new Set(this.groupOrder)].filter((id) =>
      grouped.has(id)
    );
    const listed = new Set(ordered);
    return [...ordered, ...firstSeen.filter((id) => !listed.has(id))];
  }

  private groupedItems(
    grouped: Map<string, LyraChatThread[]>,
    order: string[],
    contextFor: (id: string, threads: LyraChatThread[]) => ThreadGroupContext,
    defaultLabel: (context: ThreadGroupContext) => string
  ): ThreadListItem[] {
    const collapsedIds = new Set(this.collapsedGroupIds);
    const items: ThreadListItem[] = [];
    for (const id of order) {
      const groupedThreads = grouped.get(id);
      if (!groupedThreads || groupedThreads.length === 0) continue;
      const context = contextFor(id, groupedThreads);
      let label: string | undefined;
      let adornment: TemplateResult | undefined;
      try {
        label = normalizeLabel(this.getGroupLabel?.(context));
      } catch {
        // Use the group's default name.
      }
      try {
        adornment = this.renderGroupAdornment?.(context);
      } catch {
        // Keep the group's name and rows available without its optional content.
      }
      items.push({
        kind: 'group',
        id,
        label: label ?? defaultLabel(context),
        adornment,
        collapsed: collapsedIds.has(id),
      });
      if (!collapsedIds.has(id)) {
        items.push(
          ...groupedThreads.map(
            (thread): ThreadListItem => ({ kind: 'thread', thread })
          )
        );
      }
    }
    return items;
  }

  private buildItems(visible: LyraChatThread[], today: number): ThreadListItem[] {
    if (this.grouping === 'none') {
      return visible.map((thread) => ({ kind: 'thread', thread }));
    }

    if (this.grouping === 'custom') {
      if (!this.groupBy)
        return visible.map((thread) => ({ kind: 'thread', thread }));
      const grouped = new Map<string, LyraChatThread[]>();
      for (const thread of visible) {
        let id: unknown;
        try {
          id = this.groupBy(sourceThread(thread));
        } catch {
          continue;
        }
        if (typeof id !== 'string' || id.trim().length === 0) continue;
        const existing = grouped.get(id);
        if (existing) existing.push(thread);
        else grouped.set(id, [thread]);
      }
      return this.groupedItems(
        grouped,
        this.orderedCustomGroupIds(grouped),
        (id, groupedThreads) => ({
          id,
          threads: this.sourceThreads(groupedThreads),
        }),
        (context) => context.id
      );
    }

    const grouped = new Map<string, LyraChatThread[]>();
    const monthKeys = new Map<ThreadBucketKey, number>();
    for (const thread of visible) {
      const id = bucketFor(thread, today);
      const existing = grouped.get(id);
      if (existing) existing.push(thread);
      else grouped.set(id, [thread]);
      if (id.startsWith('month:') && !monthKeys.has(id)) monthKeys.set(id, dateForBucket(id)!.getTime());
    }
    const order: ThreadBucketKey[] = [
      'pinned',
      'today',
      'yesterday',
      'previous7',
      'previous30',
      ...[...monthKeys.keys()].sort((a, b) => monthKeys.get(b)! - monthKeys.get(a)!),
      'archived',
    ];
    return this.groupedItems(
      grouped,
      order,
      (id, groupedThreads) => {
        const bucket = id as ThreadBucketKey;
        return {
          id,
          threads: this.sourceThreads(groupedThreads),
          bucket,
          date: bucket.startsWith('month:')
            ? dateForBucket(bucket)
            : undefined,
        };
      },
      (context) => this.bucketLabel(context.bucket!)
    );
  }

  /** Applies a new search value, emitting the same mode-appropriate event
   *  (`lr-query-change`/`lr-filter-change`) whether the text came from typing or from the clear
   *  button -- both are just "the search value changed" as far as a host is concerned. */
  private setSearchText(text: string): void {
    this.focusTaskGeneration++;
    this.searchText = text;
    if (this.sourceMode) { this.sourceFilterIntent = { text, version: this.sourceRequestVersion }; return; }
    if (!this.dataMode) {
      this.emit('lr-query-change', { text });
      return;
    }
    const count = this.model().visible.length;
    this.emit('lr-filter-change', { text, matchCount: count });
    this.announceMatchCount(count);
  }

  private onSearchInput = (e: Event): void => {
    e.stopPropagation();
    this.setSearchText((e.target as HTMLInputElement).value);
  };

  // Mirrors <lr-input>'s own clearable contract (part name `clear-button`, `this.localize('clear')`
  // accessible name) rather than composing <lr-input> itself: this search field is a lightweight
  // filter box, not a form control, and swapping the plain `<input part="search-input">` for
  // <lr-input> would turn the documented `search-input` part from the actual input element into a
  // wrapper custom element, breaking every consumer style rule written against it, on top of
  // pulling in <lr-input>'s label/hint/error/password/form-associated machinery this field has no
  // use for. A sibling button reuses the same vocabulary at a fraction of the disruption.
  private onClearSearch = (): void => {
    if (this.searchText === '') return;
    this.setSearchText('');
    this.searchInputEl?.focus();
  };

  private announceMatchCount(count: number): void {
    if (this.searchText.trim() === '') return;
    this.liveRegion?.announce(
      this.localize('threadListMatchAnnounce', undefined, {
        count: getNumberFormat(this.effectiveLocale).format(count),
        pluralCount: count,
      })
    );
  }

  private onSearchKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' || shouldIgnoreNavigationKey(e)) return;
    const focusGeneration = ++this.focusTaskGeneration;
    this.stopPendingFocus?.();
    const rows = this.navigableRows();
    const list = this.virtualListEl;
    const items = (list?.items ?? []) as ThreadListItem[];
    const first = items[items.findIndex((item) => item.kind === 'thread')];
    const firstId = first?.kind === 'thread' ? first.thread.id : undefined;
    // The first rendered row can be an overscan row above the viewport; target the first match.
    if (rows[0] && (!this.dataMode || rows[0].conversationId === firstId)) {
      e.preventDefault();
      this.selectButtonEl(rows[0])?.focus();
    } else if (this.dataMode && list?.scrollContainer && firstId !== undefined) {
      e.preventDefault();
      this.focusVirtualThreadFromItemIndex(list, items, 0, 1, focusGeneration);
    }
  };

  // Native focus/blur on the shadow-DOM search <input> neither bubble nor cross the shadow
  // boundary, so a host listening for focus/blur on the custom element itself is never notified
  // without this bridge -- same convention as `<lr-textarea>`'s/`<lr-chat-composer>`'s own
  // onFocus/onBlur.
  private onSearchFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onSearchBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  /** The rendered `<lr-conversation-item>` for one thread's `conversationId` -- a data-mode
   *  thread's own `id`, or a slotted item's own `conversation-id` -- or `null` when it is not
   *  currently rendered: filtered out by `withArchived`/search, windowed out of the virtualized
   *  viewport, removed from `threads`, or never present. `conversationId` is not a second identity
   *  scheme -- it is the same stable id `<lr-conversation-item>` already exposes on its own public
   *  `conversation-id` attribute/property, which every row event (`lr-select`, `lr-thread-rename`,
   *  `lr-thread-pin`, ...) already keys off; this method documents an accessor for it instead of
   *  requiring a consumer to pierce the shadow root and walk rendered rows themselves the way this
   *  component's own internals do. Reads the DOM as it stands -- `await threadList.updateComplete`
   *  before calling it after changing `threads`, `searchText`, `withArchived`, or scroll
   *  position. */
  itemElement(conversationId: string): LyraConversationItem | null {
    return (
      this.rowElements().find((row) => row.conversationId === conversationId) ?? null
    );
  }

  // Data mode's rows are rendered into `lr-virtual-list`'s own shadow root (this component only
  // supplies the `renderItem` callback), so they are reached through that component's public
  // `renderedRows` accessor -- the currently-windowed row wrappers -- rather than by querying its
  // render root directly. Slotted mode includes only children assigned to the default slot.
  private rowElements(): LyraConversationItem[] {
    if (!this.dataMode)
      return this.defaultSlottedElements().flatMap((element) =>
        element.localName === tag('conversation-item')
          ? [element as LyraConversationItem]
          : [...element.querySelectorAll<LyraConversationItem>(tag('conversation-item'))]
      );
    return (this.virtualListEl?.renderedRows ?? []).flatMap((row) => [
      ...row.querySelectorAll<LyraConversationItem>(tag('conversation-item')),
    ]);
  }

  private selectButtonEl(row: LyraConversationItem): HTMLElement | null {
    return (
      row.shadowRoot?.querySelector<HTMLElement>('[part="select-button"]') ??
      null
    );
  }


  private isNavigableRow(row: LyraConversationItem): boolean {
    const option = this.selectButtonEl(row);
    return option !== null &&
      option.getAttribute('role') === 'button' &&
      isRovingTargetAvailable(row) &&
      isRovingTargetAvailable(option, row);
  }

  private navigableRows(): LyraConversationItem[] {
    return this.rowElements().filter((row) => this.isNavigableRow(row));
  }

  private focusedRowIndex(rows: LyraConversationItem[]): number {
    return rows.findIndex((row) => row.matches(':focus-within'));
  }

  /**
   * Mounts and focuses the first navigable thread at or beyond a complete-model item index. Group
   * records and unavailable rendered rows are skipped in `direction`; a newer navigation, search,
   * disconnect, adoption, list replacement, or outside focus invalidates the pending focus task.
   */
  private focusVirtualThreadFromItemIndex(
    list: LyraVirtualList,
    items: ThreadListItem[],
    initialItemIndex: number,
    direction: 1 | -1,
    focusGeneration: number
  ): void {
    this.stopPendingFocus?.();
    const ownerDocument = this.ownerDocument;
    const stop = (): void => {
      ownerDocument.removeEventListener('focusin', onFocusIn, true);
      if (this.stopPendingFocus === stop) this.stopPendingFocus = undefined;
    };
    const onFocusIn = (event: FocusEvent): void => {
      // Observe actual transfers; removing a focused virtual row can leave body active without one.
      if (!event.isTrusted || this.matches(':focus-within')) return;
      if (focusGeneration === this.focusTaskGeneration) this.focusTaskGeneration++;
      stop();
    };
    this.stopPendingFocus = stop;
    ownerDocument.addEventListener('focusin', onFocusIn, true);
    void (async () => {
      let targetItemIndex = initialItemIndex;
      while (targetItemIndex >= 0 && targetItemIndex < items.length) {
        while (items[targetItemIndex]?.kind === 'group')
          targetItemIndex += direction;
        const targetItem = items[targetItemIndex];
        if (!targetItem || targetItem.kind !== 'thread') return;
        const targetId = targetItem.thread.id;
        list.scrollToIndex(targetItemIndex, {
          align: 'auto',
          behavior: 'auto',
        });

        // A focus-induced scroll for the old row and the virtual list's coalesced render may both
        // still be queued. The second pass covers a measurement update that mounts the exact target
        // one frame later.
        let targetRow: LyraConversationItem | undefined;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          await new Promise<void>((resolve) => {
            const view = ownerDocument.defaultView;
            if (view) view.requestAnimationFrame(() => resolve());
            else requestAnimationFrame(() => resolve());
          });
          if (
            focusGeneration !== this.focusTaskGeneration ||
            !this.isConnected ||
            this.ownerDocument !== ownerDocument ||
            this.virtualListEl !== list
          ) {
            return;
          }
          await list.updateComplete;
          if (
            focusGeneration !== this.focusTaskGeneration ||
            !this.isConnected ||
            this.ownerDocument !== ownerDocument ||
            this.virtualListEl !== list
          ) {
            return;
          }
          targetRow = this.rowElements().find(
            (row) => row.conversationId === targetId
          );
          if (targetRow) break;
        }
        if (targetRow && this.isNavigableRow(targetRow)) {
          this.selectButtonEl(targetRow)?.focus();
          return;
        }
        targetItemIndex += direction;
      }
    })().finally(stop);
  }

  private onListKeyDown = (e: KeyboardEvent): void => {
    if (
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    )
      return;
    // A control inside a row already consumed this key -- an open `renderActions` `lr-menu` moving
    // between its own items, or a dropdown trigger opening its menu. Row navigation on top of that
    // would pull focus out of the menu it just moved within.
    if (e.defaultPrevented || shouldIgnoreNavigationKey(e)) return;
    const origin = e.composedPath()[0];
    if (
      (origin as Partial<Node> | undefined)?.nodeType === 1 &&
      (origin as Element).closest('[part="group-toggle"]')
    )
      return;
    const focusGeneration = ++this.focusTaskGeneration;
    this.stopPendingFocus?.();
    const list = this.virtualListEl;
    if (
      this.dataMode &&
      (e.key === 'Home' || e.key === 'End') &&
      list?.scrollContainer
    ) {
      const items = list.items as ThreadListItem[];
      e.preventDefault();
      this.focusVirtualThreadFromItemIndex(
        list,
        items,
        e.key === 'Home' ? 0 : items.length - 1,
        e.key === 'Home' ? 1 : -1,
        focusGeneration
      );
      return;
    }
    const rows = this.navigableRows();
    if (rows.length === 0) return;
    const currentIndex = this.focusedRowIndex(rows);
    let targetIndex: number;
    if (e.key === 'Home') targetIndex = 0;
    else if (e.key === 'End') targetIndex = rows.length - 1;
    else if (e.key === 'ArrowDown')
      targetIndex = currentIndex < 0 ? 0 : currentIndex + 1;
    else targetIndex = currentIndex < 0 ? rows.length - 1 : currentIndex - 1;

    e.preventDefault();
    if (targetIndex >= 0 && targetIndex < rows.length) {
      this.selectButtonEl(rows[targetIndex]!)?.focus(); // safe: targetIndex in [0, rows.length) checked above
      return;
    }
    // Past the currently-rendered edge: resolve the exact adjacent thread in the child's complete
    // item model, scroll that item into view, then focus it by stable id after the scroll has been
    // folded into a render. Focusing an overscanned edge row may itself move the viewport; choosing
    // whichever row happens to land at the new rendered edge can therefore skip several threads on
    // browsers that apply that focus scroll later in the frame.
    if (!list?.scrollContainer) return;
    const currentRow = rows[currentIndex];
    if (!currentRow) return;
    const items = list.items as ThreadListItem[];
    const currentItemIndex = items.findIndex(
      (item) =>
        item.kind === 'thread' && item.thread.id === currentRow.conversationId
    );
    if (currentItemIndex < 0) return;
    const direction = e.key === 'ArrowDown' ? 1 : -1;
    this.focusVirtualThreadFromItemIndex(
      list,
      items,
      currentItemIndex + direction,
      direction,
      focusGeneration
    );
  };

  private rowActionLabel(thread: LyraChatThread, action: string): string {
    return this.localize('conversationActionWithTitle', undefined, {
      action,
      title: normalizeLabel(thread.title) ?? thread.id,
    });
  }

  private renderRowActions(thread: LyraChatThread): TemplateResult {
    const source = sourceThread(thread);
    return html`
      <span slot="actions" part="row-actions">
        ${this.rowActions.includes('pin')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.rowActionLabel(thread, this.localize(thread.pinned ? 'unpinConversation' : 'pinConversation'))}
              @click=${() =>
                this.canUseThread(thread) && this.emit('lr-thread-pin', {
                  conversationId: thread.id,
                  pinned: !thread.pinned,
                })}
            >
              ${pinIcon()}
            </button>`
          : nothing}
        ${this.rowActions.includes('archive')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.rowActionLabel(thread, this.localize(thread.archived ? 'unarchiveConversation' : 'archiveConversation'))}
              @click=${() =>
                this.canUseThread(thread) && this.emit('lr-thread-archive', {
                  conversationId: thread.id,
                  archived: !thread.archived,
                })}
            >
              ${archiveIcon()}
            </button>`
          : nothing}
        ${this.rowActions.includes('delete')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.rowActionLabel(thread, this.localize('deleteConversation'))}
              @click=${() =>
                this.canUseThread(thread) && this.emit('lr-thread-delete', { conversationId: thread.id })}
            >
              ${trashIcon()}
            </button>`
          : nothing}
        ${this.renderActions ? this.renderActions(source) : nothing}
      </span>
    `;
  }

  private toggleGroupCollapsed(item: Extract<ThreadListItem, { kind: 'group' }>, collapsed: boolean): void {
    if (!this.canUseGroup(item)) return;
    const groupId = item.id;
    const detail: ThreadGroupToggleDetail = { groupId, expanded: !collapsed };
    requestThenCommit({
      requestDetail: detail,
      emitRequest: (requestDetail, init: { cancelable: true }) =>
        this.emit('lr-group-toggle-request', requestDetail, init),
      commit: () => {
        if (!this.canUseGroup(item)) return;
        const next = new Set(this.collapsedGroupIds);
        if (collapsed) next.add(groupId);
        else next.delete(groupId);
        this.collapsedGroupIds = [...next];
        this.emit('lr-group-toggle', detail);
      },
    });
  }

  /** The header markup for one group. The `sticky` copy repeats only the visual label/glyph:
   *  `lr-virtual-list` renders it `aria-hidden` and inert, so the real row remains the group's sole
   *  heading and collapse action. */
  private renderGroupHeader(
    item: Extract<ThreadListItem, { kind: 'group' }>,
    options: { sticky?: boolean } = {}
  ): TemplateResult {
    const nextCollapsed = !item.collapsed;
    const icon = this.withoutGroupIcon
      ? nothing
      : html`<span
          part=${item.collapsed ? 'group-icon group-icon-collapsed' : 'group-icon'}
          aria-hidden="true"
          >${chevronIcon()}</span
        >`;
    return html`
      <div
        part="group-header"
        data-group-id=${item.id}
        role=${options.sticky ? nothing : 'heading'}
        aria-level=${options.sticky ? nothing : '2'}
      >
        ${options.sticky
          ? html`
              ${icon}
              <span part="group-label">${item.label}</span>
            `
          : html`
              <button
                type="button"
                part="group-toggle"
                aria-expanded=${item.collapsed ? 'false' : 'true'}
                @click=${() =>
                  this.toggleGroupCollapsed(item, nextCollapsed)}
              >
                ${icon}
                <span part="group-label">${item.label}</span>
              </button>
            `}
        ${!options.sticky && item.adornment
          ? html`<span part="group-adornment">${item.adornment}</span>`
          : nothing}
      </div>
    `;
  }

  private renderRow = (item: unknown): unknown => {
    const thread = item as LyraChatThread;
    const source = sourceThread(thread);
    const row = html`
      <lr-conversation-item
        exportparts="base:row-item-base, base-menu-open:row-item-base-menu-open, active-indicator:row-item-active-indicator, select-button:row-item-select-button, start:row-item-start, content:row-item-content, label:row-item-label, label-input:row-item-label-input, rename-button:row-item-rename-button, excerpt:row-item-excerpt, meta:row-item-meta, timestamp:row-item-timestamp, actions:row-item-actions"
        conversation-id=${thread.id}
        label=${thread.title}
        excerpt=${thread.excerpt ?? ''}
        .timestamp=${thread.timestamp}
        ?active=${thread.id === this.activeConversationId}
        size=${this.size ?? 'm'}
        .withoutRename=${this.withoutRename}
        @lr-select=${(e: Event) => {
          e.stopPropagation();
          // Descendant controls can also dispatch selection events.
          if (e.target !== e.currentTarget || !this.canUseThread(thread)) return;
          this.emit('lr-select', { conversationId: thread.id });
        }}
        @lr-rename=${(
          e: CustomEvent<{ conversationId: string; label: string }>
        ) => {
          e.stopPropagation();
          if (!this.canUseThread(thread)) return;
          this.emit('lr-thread-rename', {
            conversationId: thread.id,
            label: e.detail.label,
          });
        }}
      >
        ${this.renderStart
          ? html`<span slot="start" part="row-start" inert
              >${this.renderStart(source)}</span
            >`
          : nothing}
        ${this.renderExcerpt
          ? html`<span slot="excerpt" part="row-excerpt" data-lr-virtual-list-mark
              >${this.renderExcerpt(source)}</span
            >`
          : nothing}
        ${this.renderRowContent
          ? html`<span slot="content" part="row-content"
              >${this.renderRowContent(source)}</span
            >`
          : nothing}
        ${!thread.pinned
          ? nothing
          : this.withoutPinGlyph
          ? html`<span slot="meta" class="sr-only">${this.localize('threadGroupPinned')}</span>`
          : html`<span slot="meta" part="row-meta pin-glyph"
              ><span role="img" aria-label=${this.localize('threadGroupPinned')}>${pinIcon()}</span> </span
            >`}
        ${this.renderMeta
          ? html`<span slot="meta" part="row-meta"
              >${this.renderMeta(source)}</span
            >`
          : nothing}
        ${this.rowActions.length > 0 || this.renderActions
          ? this.renderRowActions(thread)
          : nothing}
      </lr-conversation-item>
    `;
    return this.wrapRow
      ? html`<div part="row-wrapper">${this.wrapRow(source, row)}</div>`
      : row;
  };

  private renderItem = (item: unknown): unknown => {
    const listItem = item as ThreadListItem;
    return listItem.kind === 'group'
      ? this.renderGroupHeader(listItem)
      : this.renderRow(listItem.thread);
  };

  /** Position anchors for `lr-virtual-list`'s sticky layer: one entry per group header row, keyed by
   *  group id. Every label is empty on purpose -- the header is already rendered as a real row, so a
   *  `[part="group"]` marker would be a second, duplicate header stacked on top of it. */
  private stickyAnchors(items: ThreadListItem[]): LyraVirtualListGroup[] {
    const anchors: LyraVirtualListGroup[] = [];
    this.stickyGroupItems.clear();
    items.forEach((item, index) => {
      if (item.kind !== 'group') return;
      this.stickyGroupItems.set(item.id, item);
      anchors.push({ key: item.id, label: '', startIndex: index });
    });
    return anchors;
  }

  // Stable identity: a fresh arrow per render would invalidate the child's property on every update.
  private renderStickyGroup = (group: LyraVirtualListGroup): unknown => {
    const item = this.stickyGroupItems.get(String(group.key));
    return item ? this.renderGroupHeader(item, { sticky: true }) : nothing;
  };

  private itemKey = (item: unknown): string => {
    const listItem = item as ThreadListItem;
    return listItem.kind === 'group'
      ? this.groupItemKey(listItem.id)
      : this.threadItemKey(listItem.thread.id);
  };

  /** Internal namespaces keep unrestricted public thread ids distinct from group-header keys. */
  private groupItemKey(id: string): string {
    return `group:${id}`;
  }

  private threadItemKey(id: string): string {
    return `thread:${id}`;
  }

  private onDefaultSlotChange = (e: Event): void => {
    const assigned = (e.target as HTMLSlotElement).assignedElements({
      flatten: true,
    });
    const keep = new Set(assigned);
    this.restoreInjectedListItemRoles(keep);
    this.markAsListItems(assigned);
    this.hasDefaultSlotContent = assigned.length > 0;
  };

  // Children keep their own events for listeners attached to them; only documented events leave.
  private stopEvent = (e: Event): void => {
    e.stopPropagation();
  };

  // A row's re-dispatched focus/blur bubbles; the platform's own focus events still reach the host.
  private stopRowFocus = (e: Event): void => {
    if (e.bubbles) e.stopPropagation();
  };

  private onEmptySlotChange = (): void => {
    this.hasEmptySlot = hasSlotContent(this, 'empty');
  };

  private renderSearch(): TemplateResult {
    return html`
      <div part="search">
        <input
          part="search-input"
          type="search"
          spellcheck="false"
          autocapitalize="off"
          autocorrect="off"
          autocomplete="off"
          enterkeyhint="search"
          .value=${this.searchText}
          aria-label=${this.localize('searchThreads')}
          placeholder=${this.localize('searchThreads')}
          @input=${this.onSearchInput}
          @keydown=${this.onSearchKeyDown}
          @focus=${this.onSearchFocus}
          @blur=${this.onSearchBlur}
        />
        ${this.searchText !== ''
          ? html`<button
              type="button"
              part="clear-button"
              aria-label=${this.localize('clear')}
              @click=${this.onClearSearch}
            >
              ${closeIcon()}
            </button>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const fallback = this.label === '' ? '' : normalizeLabel(this.label) ?? this.localize('threadListLabel');
    const override = this.getAttribute('aria-label');
    const label = override === '' ? '' : normalizeLabel(override) ?? fallback;
    // Both modes share one outer template so the mode switch replaces only the list inside it.
    // Slotted rows are invisible to a server renderer, which therefore always emits data mode; a
    // hydrating list has to reuse that markup rather than discard it on its corrective update.
    return html`
      <div
        part="base"
        role=${this.dataMode ? 'region' : nothing}
        aria-label=${this.dataMode ? label : nothing}
      >
        ${this.searchable ? this.renderSearch() : nothing}
        ${this.inputLimitMessage ? html`<p part="limit">${this.inputLimitMessage}</p>` : nothing}
        ${this.dataMode ? this.renderDataList() : this.renderSlottedList(label)}
      </div>
    `;
  }

  private renderSlottedList(label: string): TemplateResult {
    return html`<div part="list" role="list" aria-label=${label} @keydown=${this.onListKeyDown}>
      <slot
        @slotchange=${this.onDefaultSlotChange}
        @lr-select=${this.stopEvent}
      ></slot>
    </div>`;
  }

  /** `renderDataState()`'s built-in `[part='retry-button']` activation. Mirrors `<lr-table>`'s own
   *  "propose, then react to the veto" onRetryClick shape: the default action clears `error`;
   *  `preventDefault()` leaves it set for a consumer that owns its own retry timing. */
  private onErrorRetry = (): void => {
    this.error = false;
  };

  /** The visible threads and item model, rebuilt only when one of their inputs changes. */
  private model(): ThreadListModel {
    if (this.sourceMode) return this.sourcePages.model(this.collapsedGroupIds, this.stickyGroups, items => this.stickyAnchors(items));
    const today = startOfLocalDay(new Date());
    const key = [
      this.normalizedThreads, this.searchText, this.filter, this.withArchived, this.grouping,
      this.groupBy, this.groupOrder, this.collapsedGroupIds, this.getGroupLabel,
      this.renderGroupAdornment, this.formatDate, this.stickyGroups, this.effectiveLocale,
      this.strings, today,
    ];
    const previous = this.dataModel;
    if (previous && key.every((value, index) => Object.is(value, previous.key[index]))) return previous;
    const visible = this.visibleThreads;
    const items = this.buildItems(visible, today);
    // The public thread admission already bounded these records. Structural headings must not
    // consume a second array admission budget in the child list.
    let source: LyraVirtualListIndexedSource | undefined;
    if (items.length > 10000) {
      const keys = items.map((item) => this.itemKey(item));
      const indices = new Map<string | number, number>();
      keys.forEach((itemKey, index) => { if (!indices.has(itemKey)) indices.set(itemKey, index); });
      source = Object.freeze({
        count: items.length,
        itemAt: (index: number) => items[index],
        keyAt: (index: number) => keys[index]!,
        indexOfKey: (itemKey: string | number) => indices.get(itemKey) ?? -1,
      });
    }
    this.dataModel = { key, visible, items, source, groups: this.stickyGroups ? this.stickyAnchors(items) : undefined };
    return this.dataModel;
  }

  private renderDataList(): TemplateResult {
    const { visible, items, source, groups } = this.model();
    const showEmpty = visible.length === 0 && !this.hasEmptySlot;
    const provider = this.sourceMode;
    const retrySource = this.dataSource;
    const retryState = this.sourcePages.state;
    const failed = this.error || (provider && this.sourceFailed);
    const pending = provider && this.sourcePages.state.pending && !this.error;
    return html`
      <div part="list" @keydown=${this.onListKeyDown}>
        ${pending ? html`<p part="source-status">${this.localize('loading')}</p>` : failed
          ? renderDataState(
              this,
              {
                loading: false,
                error: true,
                empty: false,
                errorHeading: this.errorHeading,
                errorDescription: this.errorDescription,
                onRetry: provider ? () => this.retrySource(retrySource, retryState) : this.onErrorRetry,
                emitRetryRequest: (detail, init: { cancelable: true }) => {
                  if (provider && !this.currentSourceRetry(retrySource, retryState)) {
                    const event = new CustomEvent('lr-retry-request', init); event.preventDefault(); return event;
                  }
                  return this.emit('lr-retry-request', detail, init);
                },
              },
              'error',
              'lr-retry-request'
            )
          : showEmpty
          ? html`<div part="empty">
              ${this.searchText.trim()
                ? this.localize('noMatches')
                : this.localize('threadListEmpty')}
            </div>`
          : html`<lr-virtual-list
              exportparts="base:viewport, sticky-group:group-sticky, row:row, row-wrapper:row-wrapper, group-header:group-header, group-toggle:group-toggle, group-label:group-label, group-adornment:group-adornment, group-icon:group-icon, row-start:row-start, row-excerpt:row-excerpt, row-content:row-content, row-meta:row-meta, row-actions:row-actions, row-action:row-action, pin-glyph:pin-glyph, row-item-base:row-item-base, row-item-base-menu-open:row-item-base-menu-open, row-item-active-indicator:row-item-active-indicator, row-item-select-button:row-item-select-button, row-item-start:row-item-start, row-item-content:row-item-content, row-item-label:row-item-label, row-item-label-input:row-item-label-input, row-item-rename-button:row-item-rename-button, row-item-excerpt:row-item-excerpt, row-item-meta:row-item-meta, row-item-timestamp:row-item-timestamp, row-item-actions:row-item-actions"
              row-height="auto"
              .items=${guard([items, source], () => source ? [] : items)}
              .source=${source}
              .groups=${guard([groups], () => groups)}
              .renderStickyGroup=${this.stickyGroups
                ? guard([this.withoutGroupIcon], () => (group: LyraVirtualListGroup) => this.renderStickyGroup(group))
                : undefined}
              .renderItem=${guard([
                this.activeConversationId, this.size, this.withoutRename, this.withoutPinGlyph, this.withoutGroupIcon, this.rowActions,
                this.renderStart, this.renderRowContent, this.renderExcerpt, this.renderMeta,
                this.renderActions, this.wrapRow, this.strings, this.effectiveLocale, this.effectiveDirection,
              ], () => (item: unknown) => this.renderItem(item))}
              .keyFunction=${source ? undefined : this.itemKey}
              .activeItemId=${this.activeConversationId
                ? this.threadItemKey(this.activeConversationId)
                : ''}
              @focus=${this.stopRowFocus}
              @blur=${this.stopRowFocus}
              @lr-visible-range-change=${this.stopEvent}
              @lr-load-more=${this.stopEvent}
              @lr-virtual-scroll=${this.stopEvent}
            ></lr-virtual-list>`}
        <slot
          name="empty"
          ?hidden=${failed || pending || !(visible.length === 0 && this.hasEmptySlot)}
          @slotchange=${this.onEmptySlotChange}
        ></slot>
      </div>
      ${provider ? html`<lr-pagination part="source-pagination" format="compact"
        .page=${displayedSourcePage(this.sourcePage)} .pageSize=${normalizeSourcePageSize(this.sourcePageSize)}
        .total=${this.sourceTotal ?? -1} .disabled=${this.sourceBlocked || this.sourceTotal === null} .strings=${this.strings}
        @lr-page-change=${this.onSourcePage} @lr-before-page-change=${this.stopEvent} @lr-activate=${this.stopEvent}
        @focus=${this.stopEvent} @blur=${this.stopEvent}></lr-pagination>` : nothing}
      <lr-live-region></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-thread-list': LyraThreadList;
  }
}
