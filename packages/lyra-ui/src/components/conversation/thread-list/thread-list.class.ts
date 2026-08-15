import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import type {
  LyraVirtualList,
  VirtualListGroup,
} from '../../layout/virtual-list/virtual-list.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './thread-list.styles.js';
import {
  getDateTimeFormat,
  getNumberFormat,
  resolveIntlLocale,
} from '../../../internal/intl-cache.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { normalizeLyraTimestamp, type LyraTimestamp } from '../timestamp.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_archiveConversation, LYRA_DEFAULT_deleteConversation, LYRA_DEFAULT_noMatches, LYRA_DEFAULT_pinConversation, LYRA_DEFAULT_searchThreads, LYRA_DEFAULT_threadGroupArchived, LYRA_DEFAULT_threadGroupCollapse, LYRA_DEFAULT_threadGroupExpand, LYRA_DEFAULT_threadGroupPinned, LYRA_DEFAULT_threadGroupPrevious30Days, LYRA_DEFAULT_threadGroupPrevious7Days, LYRA_DEFAULT_threadGroupToday, LYRA_DEFAULT_threadGroupYesterday, LYRA_DEFAULT_threadListEmpty, LYRA_DEFAULT_threadListLabel, LYRA_DEFAULT_threadListMatchAnnounce, LYRA_DEFAULT_unarchiveConversation, LYRA_DEFAULT_unpinConversation } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraChatThread {
  id: string;
  title: string;
  excerpt?: string;
  timestamp?: LyraTimestamp;
  pinned?: boolean;
  archived?: boolean;
}

export type ThreadRowAction = 'pin' | 'archive' | 'delete';

export type ThreadListGrouping = 'date' | 'custom' | 'none';

export interface LyraThreadListEventMap {
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
  'lr-group-toggle': CustomEvent<{ groupId: string; collapsed: boolean }>;
  blur: CustomEvent<null>;
  focus: CustomEvent<null>;
}

export type ThreadBucketKey =
  | 'pinned'
  | 'today'
  | 'yesterday'
  | 'previous7'
  | 'previous30'
  | `month:${string}`
  | 'archived';

export interface ThreadGroupContext {
  id: string;
  threads: readonly LyraChatThread[];
  bucket?: ThreadBucketKey;
  date?: Date;
}

type ThreadListItem =
  | {
      kind: 'group';
      id: string;
      label: string;
      adornment?: TemplateResult;
      collapsed: boolean;
    }
  | { kind: 'thread'; thread: LyraChatThread };

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts's
// chevronIcon()/closeIcon()/etc.) without adding pin/archive/trash glyphs to that module -- so
// these one-off icons still read as part of the same visual language as the rest of the library's
// inline icons. Same approach lr-conversation-item's own local pencil glyph takes for the
// identical reason.
function pinIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 17v5"></path>
      <path d="M9 3h6l1 6 3 3v2H5v-2l3-3Z"></path>
    </svg>
  `;
}

function archiveIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="4" rx="1"></rect>
      <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path>
      <line x1="10" y1="13" x2="14" y2="13"></line>
    </svg>
  `;
}

function trashIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 7h16"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M6 7l1 14h10l1-14"></path>
      <path d="M9 7V4h6v3"></path>
    </svg>
  `;
}

function defaultFilter(
  thread: LyraChatThread,
  query: string,
  locale: string
): boolean {
  const intlLocale = resolveIntlLocale(locale);
  return (
    thread.title.toLocaleLowerCase(intlLocale).includes(query) ||
    (thread.excerpt ?? '').toLocaleLowerCase(intlLocale).includes(query)
  );
}

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
 * as a highlighted search snippet. A host needing a fully custom
 * `actions` surface itself — beyond `rowActions`'s closed `pin | archive | delete` set, e.g. a
 * `<lr-dropdown>` + `<lr-menu>` with Rename/Delete — sets `renderActions` instead; its content is appended after any
 * built-in `rowActions` output in the same slot, and `wrapRow` continues to compose around the result.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-thread-list
 * @slot - Slotted mode only: host-supplied `lr-conversation-item`s, rendered in order. Each
 *   top-level assigned element that doesn't already carry an explicit `role` is given
 *   `role="listitem"`, since `[part="list"]` is `role="list"` in this mode and `lr-conversation-item`
 *   deliberately doesn't self-apply that role (see its own class doc).
 * @slot empty - Replaces the built-in empty state.
 * @event lr-select - `detail: { conversationId }` -- a row was activated (data mode only).
 * @event lr-thread-pin - `detail: { conversationId, pinned }` -- the requested new state.
 * @event lr-thread-archive - `detail: { conversationId, archived }` -- the requested new state.
 * @event lr-thread-delete - `detail: { conversationId }` -- no built-in confirmation.
 * @event lr-thread-rename - `detail: { conversationId, label }`, re-emitted from the row's
 *   correlated `lr-rename` request (data mode only).
 * @event lr-filter-change - `detail: { text, matchCount }` -- data-mode query plus owned results.
 * @event lr-query-change - `detail: { text }` -- slotted-mode query request; the host owns results.
 * @event lr-group-toggle - `detail: { groupId, collapsed }` -- requests a controlled custom/date group
 *   collapse-state change; the host updates `collapsedGroupIds`.
 * @event blur - `searchable`: re-dispatched from the internal search `<input>`'s own `blur` --
 *   bubbling and composed (unlike the native event, which is neither), so a listener above the
 *   shadow boundary can observe it.
 * @event focus - `searchable`: re-dispatched from the internal search `<input>`'s own `focus`,
 *   for the same reason as `blur`.
 * @csspart base - The root.
 * @csspart search - The search field wrapper.
 * @csspart search-input - The `<input type="search">`.
 * @csspart list - The list region.
 * @csspart empty - The empty/no-matches state.
 * @csspart viewport - The real scroll container, exported from the internal `lr-virtual-list`. It
 *   fills this component's height with no consumer CSS (and falls back to `lr-virtual-list`'s own
 *   24rem `--lr-virtual-list-height` default when the container has no resolvable height).
 * @csspart row-action - A built-in pin/archive/delete icon button (data mode, when `rowActions` includes it).
 * @csspart pin-glyph - The small pin indicator shown in a pinned row's `meta` slot (data mode).
 * @csspart group-header - A date/custom group header in data mode.
 * @csspart group-sticky - `sticky-groups` only: the pinned copy of the current group's header,
 *   exported from the internal `lr-virtual-list`'s sticky layer. It wraps a full copy of the
 *   `group-header`/`group-toggle`/`group-label`/`group-icon` markup (which therefore styles both the
 *   real header row and the pinned copy), and carries `aria-hidden` — style it for the pinned band
 *   itself, e.g. a shadow or a border under the band.
 * @csspart group-toggle - The controlled group expand/collapse button.
 * @csspart group-label - The group label inside `group-toggle`.
 * @csspart group-adornment - Optional rich `renderGroupAdornment` output beside the toggle.
 * @csspart group-icon - The decorative expand/collapse glyph.
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
 * @cssprop [--lr-thread-list-excerpt-highlight-background=var(--lr-color-warning-quiet)] -
 *   Background of `<mark>` descendants returned by `renderExcerpt`.
 * @cssprop [--lr-thread-list-excerpt-highlight-foreground=inherit] - Foreground of `<mark>`
 *   descendants returned by `renderExcerpt`.
 * @cssprop [--lr-thread-list-excerpt-highlight-radius=var(--lr-radius-xs)] - Corner radius of
 *   `<mark>` descendants returned by `renderExcerpt`.
 * @cssprop [--lr-thread-list-excerpt-highlight-padding=0] - Padding of `<mark>` descendants
 *   returned by `renderExcerpt`.
 * @status stable
 * @since 4.0.0
 */
export class LyraThreadList extends LyraElement<LyraThreadListEventMap> {
  protected static override readonly ownedCollectionProperties = Object.freeze(['threads', 'groupOrder', 'collapsedGroupIds', 'rowActions']);

  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    archiveConversation: LYRA_DEFAULT_archiveConversation,
    deleteConversation: LYRA_DEFAULT_deleteConversation,
    noMatches: LYRA_DEFAULT_noMatches,
    pinConversation: LYRA_DEFAULT_pinConversation,
    searchThreads: LYRA_DEFAULT_searchThreads,
    threadGroupArchived: LYRA_DEFAULT_threadGroupArchived,
    threadGroupCollapse: LYRA_DEFAULT_threadGroupCollapse,
    threadGroupExpand: LYRA_DEFAULT_threadGroupExpand,
    threadGroupPinned: LYRA_DEFAULT_threadGroupPinned,
    threadGroupPrevious30Days: LYRA_DEFAULT_threadGroupPrevious30Days,
    threadGroupPrevious7Days: LYRA_DEFAULT_threadGroupPrevious7Days,
    threadGroupToday: LYRA_DEFAULT_threadGroupToday,
    threadGroupYesterday: LYRA_DEFAULT_threadGroupYesterday,
    threadListEmpty: LYRA_DEFAULT_threadListEmpty,
    threadListLabel: LYRA_DEFAULT_threadListLabel,
    threadListMatchAnnounce: LYRA_DEFAULT_threadListMatchAnnounce,
    unarchiveConversation: LYRA_DEFAULT_unarchiveConversation,
    unpinConversation: LYRA_DEFAULT_unpinConversation,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** At least one valid thread ⇒ data mode (the default slot is ignored). No valid threads and no
   *  slotted content ⇒ data mode with zero rows (the built-in empty state). No valid threads with
   *  slotted content ⇒ slotted mode. Thread ids must be nonempty and unique; invalid/later
   *  duplicate rows are omitted, first wins. */
  @property({ attribute: false }) threads: readonly LyraChatThread[] = [];

  /**
   * Data mode: marks the matching raw thread id `active`/`aria-current` and scrolls it into view.
   * Internal group and thread keys are separately namespaced, so ids such as `group:today` remain
   * ordinary thread ids rather than colliding with a group header.
   */
  @property({ attribute: 'active-conversation-id' }) activeConversationId = '';

  /** Shows the built-in search field. */
  @property({ type: Boolean, reflect: true }) searchable = false;

  /** Overrides the default case-insensitive `title` + `excerpt` substring match. */
  @property({ attribute: false }) filter?: (
    thread: LyraChatThread,
    query: string
  ) => boolean;

  /** Data mode: bucket rows under localized date headers, use `groupBy` with `'custom'`, or use
   *  `'none'` for a flat list in host order. */
  @property() grouping: ThreadListGrouping = 'date';

  /** `grouping="custom"`: derives an arbitrary controlled group id for every visible thread. */
  @property({ attribute: false }) groupBy?: (thread: LyraChatThread) => string;

  /** Returns the semantic string label for any date or custom group. */
  @property({ attribute: false }) getGroupLabel?: (
    context: ThreadGroupContext
  ) => string;

  /** Renders optional rich content beside (never inside) a group toggle. */
  @property({ attribute: false }) renderGroupAdornment?: (
    context: ThreadGroupContext
  ) => TemplateResult;

  /** `grouping="custom"`: explicit group-id order, or a comparator. Unlisted ids follow in their
   *  first-seen order when an array is supplied. */
  @property({ attribute: false }) groupOrder?:
    | readonly string[]
    | ((a: string, b: string) => number);

  /** Data mode: controlled ids of date/custom groups whose rows are omitted from virtualization. */
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
   *  virtual row above later rows even if focus temporarily leaves the menu. Unset (the default)
   *  leaves `rowActions`' output byte-for-byte unchanged. */
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
  @property({ type: Boolean, attribute: 'show-archived', reflect: true })
  showArchived = false;

  /** Forwarded to each data-mode row's inline rename. */
  @property({
    type: Boolean,
    reflect: true,
    converter: trueDefaultBooleanConverter,
  })
  renamable = true;

  /** Data mode only: forwarded to every row `<lr-conversation-item>`'s own `compact`, tightening
   *  each row's padding and gaps in one place. Slotted mode is a deliberate no-op — this component
   *  renders host-supplied items as-is, so the host sets `compact` on its own items there, the same
   *  division of responsibility slotted mode already has for every other row property. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Data mode only: pins the current date/custom group's header to the top of the scroll viewport
   *  while its rows are in view, pushing it off as the next group's header arrives. Group headers
   *  are ordinary virtualized rows, so this renders a `aria-hidden` copy of the header into
   *  `lr-virtual-list`'s sticky layer (`[part="group-sticky"]`) — the real row keeps the
   *  `role="heading"` semantics and the tab order, and the copy stays clickable so the pinned
   *  toggle still requests a collapse. Default `false` leaves rendering exactly as it is without
   *  this feature; `grouping="none"` has no headers to pin, so it is a no-op there. */
  @property({ type: Boolean, attribute: 'sticky-groups', reflect: true })
  stickyGroups = false;

  /** Accessible name for the list region. Defaults to the localized `threadListLabel`. */
  @property() label = '';

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

  @state() private searchText = '';
  @state() private hasEmptySlot = false;
  @state() private hasDefaultSlotContent = false;

  @query('lr-virtual-list') private virtualListEl?: LyraVirtualList;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;
  private focusTaskGeneration = 0;
  private readonly injectedListItemRoles = new Set<Element>();

  // Slotted mode is only for a host that's actually relying on it (real slotted content present)
  // and hasn't also supplied `threads` -- empty `threads` with nothing slotted is still data mode,
  // just with zero rows, so it renders the built-in empty state rather than a silently blank slot.
  private get dataMode(): boolean {
    return this.normalizedThreads.length > 0 || !this.hasDefaultSlotContent;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      const defaultSlotted = this.defaultSlottedElements();
      this.hasDefaultSlotContent = defaultSlotted.length > 0;
      if (this.normalizedThreads.length === 0) this.markAsListItems(defaultSlotted);
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (
      changed.has('threads') ||
      changed.has('searchText') ||
      changed.has('filter') ||
      changed.has('grouping') ||
      changed.has('groupBy') ||
      changed.has('groupOrder') ||
      changed.has('collapsedGroupIds') ||
      changed.has('showArchived')
    ) {
      this.focusTaskGeneration++;
    }
    const syncSlottedContent = (): void => {
      const defaultSlotted = this.defaultSlottedElements();
      this.hasDefaultSlotContent = defaultSlotted.length > 0;
      const hasDataThreads = this.normalizedThreads.length > 0;
      if (hasDataThreads && defaultSlotted.length > 0) {
        this.restoreInjectedListItemRoles();
        console.warn(
          '[lr-thread-list] both `threads` and slotted content were supplied -- `threads` (data mode) wins and the default slot is ignored.'
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
        this.hasEmptySlot = Array.from(this.children).some(
          (el) => el.getAttribute('slot') === 'empty'
        );
        syncSlottedContent();
      });
    } else if (changed.has('threads')) {
      syncSlottedContent();
    }
  }

  private defaultSlottedElements(): Element[] {
    return Array.from(this.children).filter((el) => !el.hasAttribute('slot'));
  }

  // Slotted mode's `[part="list"]` carries `role="list"`, which ARIA requires to directly own only
  // `role="listitem"` elements -- `lr-conversation-item` deliberately does *not* self-apply that
  // role (its own doc explains why: it's a plain activatable row usable standalone, not committed to
  // list/listbox membership), so the container imposes it on whatever lands in the default slot
  // instead, the same way `lr-breadcrumb-item` self-applies `role="listitem"` for its own `role="list"`
  // parent -- just applied from the outside here since the slotted element doesn't own that choice.
  // Never overrides a role a consumer set explicitly.
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
    this.focusTaskGeneration++;
    this.restoreInjectedListItemRoles();
    super.disconnectedCallback();
  }

  private get normalizedThreads(): LyraChatThread[] {
    const seen = new Set<string>();
    return this.threads.filter((thread) => {
      if (typeof thread.id !== 'string' || thread.id.trim().length === 0 || seen.has(thread.id)) return false;
      seen.add(thread.id);
      return true;
    });
  }

  private get visibleThreads(): LyraChatThread[] {
    const q = this.searchText.trim().toLocaleLowerCase(this.effectiveLocale);
    const withArchiveFilter = this.normalizedThreads.filter(
      (thread) => this.showArchived || !thread.archived
    );
    if (q === '') return withArchiveFilter;
    return withArchiveFilter.filter((t) =>
      this.filter
        ? this.filter(t, q)
        : defaultFilter(t, q, this.effectiveLocale)
    );
  }

  private bucketFor(thread: LyraChatThread, now: Date): ThreadBucketKey {
    if (thread.archived) return 'archived';
    if (thread.pinned) return 'pinned';
    const ts =
      thread.timestamp == null
        ? undefined
        : normalizeLyraTimestamp(thread.timestamp);
    if (!ts) return 'previous30';
    const dayMs = 86_400_000;
    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / dayMs);
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays <= 7) return 'previous7';
    if (diffDays <= 30) return 'previous30';
    return `month:${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
  }

  private bucketLabel(
    key: ThreadBucketKey,
    threads: readonly LyraChatThread[]
  ): string {
    const groupDate = key.startsWith('month:')
      ? this.dateForBucket(key)
      : undefined;
    const context: ThreadGroupContext = {
      id: key,
      threads,
      bucket: key,
      date: groupDate,
    };
    if (this.getGroupLabel) return this.getGroupLabel(context);
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

  private dateForBucket(key: ThreadBucketKey): Date | undefined {
    if (!key.startsWith('month:')) return undefined;
    const [, ym] = key.split(':');
    const [year, month] = ym!.split('-').map(Number);
    return new Date(year!, month! - 1, 1);
  }

  private orderedCustomGroupIds(grouped: Map<string, LyraChatThread[]>): string[] {
    const firstSeen = [...grouped.keys()];
    if (typeof this.groupOrder === 'function')
      return firstSeen.sort(this.groupOrder);
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
      const label = this.getGroupLabel?.(context) ?? defaultLabel(context);
      items.push({
        kind: 'group',
        id,
        label,
        adornment: this.renderGroupAdornment?.(context),
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

  private buildItems(visible: LyraChatThread[]): ThreadListItem[] {
    if (this.grouping === 'none') {
      return visible.map((thread) => ({ kind: 'thread', thread }));
    }

    if (this.grouping === 'custom') {
      if (!this.groupBy)
        return visible.map((thread) => ({ kind: 'thread', thread }));
      const grouped = new Map<string, LyraChatThread[]>();
      for (const thread of visible) {
        const id = this.groupBy(thread);
        const existing = grouped.get(id);
        if (existing) existing.push(thread);
        else grouped.set(id, [thread]);
      }
      return this.groupedItems(
        grouped,
        this.orderedCustomGroupIds(grouped),
        (id, groupedThreads) => ({ id, threads: groupedThreads }),
        (context) => context.id
      );
    }

    const now = new Date();
    const grouped = new Map<string, LyraChatThread[]>();
    const monthKeys = new Set<string>();
    for (const thread of visible) {
      const id = this.bucketFor(thread, now);
      const existing = grouped.get(id);
      if (existing) existing.push(thread);
      else grouped.set(id, [thread]);
      if (id.startsWith('month:')) monthKeys.add(id);
    }
    const order: ThreadBucketKey[] = [
      'pinned',
      'today',
      'yesterday',
      'previous7',
      'previous30',
      ...([...monthKeys].sort().reverse() as ThreadBucketKey[]),
      'archived',
    ];
    return this.groupedItems(
      grouped,
      order,
      (id, groupedThreads) => {
        const bucket = id as ThreadBucketKey;
        return {
          id,
          threads: groupedThreads,
          bucket,
          date: bucket.startsWith('month:')
            ? this.dateForBucket(bucket)
            : undefined,
        };
      },
      (context) => this.bucketLabel(context.bucket!, context.threads)
    );
  }

  private onSearchInput = (e: Event): void => {
    e.stopPropagation();
    this.focusTaskGeneration++;
    this.searchText = (e.target as HTMLInputElement).value;
    if (!this.dataMode) {
      this.emit('lr-query-change', { text: this.searchText });
      return;
    }
    const count = this.visibleThreads.length;
    this.emit('lr-filter-change', {
      text: this.searchText,
      matchCount: count,
    });
    this.announceMatchCount(count);
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
    if (e.key !== 'ArrowDown') return;
    this.focusTaskGeneration++;
    const rows = this.navigableRows();
    if (rows.length === 0) return;
    e.preventDefault();
    this.selectButtonEl(rows[0]!)?.focus(); // safe: rows.length > 0 checked above
  };

  // Native focus/blur on the shadow-DOM search <input> neither bubble nor cross the shadow
  // boundary, so a host listening for focus/blur on the custom element itself is never notified
  // without this bridge -- same convention as `<lr-textarea>`'s/`<lr-chat-composer>`'s own
  // onFocus/onBlur.
  private onSearchFocus = (): void => {
    this.emit('focus', null);
  };

  private onSearchBlur = (): void => {
    this.emit('blur', null);
  };

  // Data mode's rows are rendered into `lr-virtual-list`'s own shadow root (this component only
  // supplies the `renderItem` callback), so they are reached through that component's public
  // `renderedRows` accessor -- the currently-windowed row wrappers -- rather than by querying its
  // render root directly. Slotted mode's rows are this element's own light-DOM children.
  private rowElements(): LyraConversationItem[] {
    if (!this.dataMode)
      return [
        ...this.querySelectorAll<LyraConversationItem>('lr-conversation-item'),
      ];
    return (this.virtualListEl?.renderedRows ?? []).flatMap((row) => [
      ...row.querySelectorAll<LyraConversationItem>('lr-conversation-item'),
    ]);
  }

  private selectButtonEl(row: LyraConversationItem): HTMLElement | null {
    return (
      row.shadowRoot?.querySelector<HTMLElement>('[part="select-button"]') ??
      null
    );
  }

  /** A row is navigable only while both its public host and semantic option can receive focus.
   *  `wrapRow` may place the host below an inert ancestor, and an inert target refuses focus
   *  silently, so the navigation scan must exclude it before committing an index. */
  private isNavigableRow(row: LyraConversationItem): boolean {
    const option = this.selectButtonEl(row);
    return Boolean(
      option &&
        option.getAttribute('role') === 'button' &&
        row.hidden === false &&
        row.getAttribute('aria-hidden') !== 'true' &&
        row.getAttribute('aria-disabled') !== 'true' &&
        !row.inert &&
        row.closest('[inert]') === null &&
        option.hidden === false &&
        option.getAttribute('aria-hidden') !== 'true' &&
        option.getAttribute('aria-disabled') !== 'true' &&
        !option.inert &&
        option.closest('[inert]') === null
    );
  }

  private navigableRows(): LyraConversationItem[] {
    return this.rowElements().filter((row) => this.isNavigableRow(row));
  }

  private focusedRowIndex(rows: LyraConversationItem[]): number {
    return rows.findIndex((row) => activeElementIn(row.shadowRoot) != null);
  }

  /**
   * Mounts and focuses the first navigable thread at or beyond a complete-model item index. Group
   * records and unavailable rendered rows are skipped in `direction`; a newer navigation, search,
   * disconnect, or list replacement invalidates the pending focus task.
   */
  private focusVirtualThreadFromItemIndex(
    list: LyraVirtualList,
    items: ThreadListItem[],
    initialItemIndex: number,
    direction: 1 | -1,
    focusGeneration: number
  ): void {
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
            const view = this.ownerDocument.defaultView;
            if (view) view.requestAnimationFrame(() => resolve());
            else requestAnimationFrame(() => resolve());
          });
          if (
            focusGeneration !== this.focusTaskGeneration ||
            !this.isConnected ||
            this.virtualListEl !== list
          ) {
            return;
          }
          await list.updateComplete;
          if (
            focusGeneration !== this.focusTaskGeneration ||
            !this.isConnected ||
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
    })();
  }

  private onListKeyDown = (e: KeyboardEvent): void => {
    if (
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'Home' &&
      e.key !== 'End'
    )
      return;
    const origin = e.composedPath()[0];
    if (
      (origin as Partial<Node> | undefined)?.nodeType === 1 &&
      (origin as Element).closest('[part="group-toggle"]')
    )
      return;
    const focusGeneration = ++this.focusTaskGeneration;
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

  private renderRowActions(thread: LyraChatThread): TemplateResult {
    return html`
      <span slot="actions" part="row-actions">
        ${this.rowActions.includes('pin')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize(
                thread.pinned ? 'unpinConversation' : 'pinConversation'
              )}
              @click=${() =>
                this.emit('lr-thread-pin', {
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
              aria-label=${this.localize(
                thread.archived
                  ? 'unarchiveConversation'
                  : 'archiveConversation'
              )}
              @click=${() =>
                this.emit('lr-thread-archive', {
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
              aria-label=${this.localize('deleteConversation')}
              @click=${() =>
                this.emit('lr-thread-delete', { conversationId: thread.id })}
            >
              ${trashIcon()}
            </button>`
          : nothing}
        ${this.renderActions ? this.renderActions(thread) : nothing}
      </span>
    `;
  }

  /** The header markup for one group. The `sticky` copy is identical except that it carries no
   *  heading semantics: `lr-virtual-list` renders it `aria-hidden` into its sticky layer, so the
   *  real row below stays the single exposed heading for the group -- a `role="heading"` here would
   *  be a second one the moment both are in the DOM at once. */
  private renderGroupHeader(
    item: Extract<ThreadListItem, { kind: 'group' }>,
    options: { sticky?: boolean } = {}
  ): TemplateResult {
    const nextCollapsed = !item.collapsed;
    return html`
      <div
        part="group-header"
        data-group-id=${item.id}
        role=${options.sticky ? nothing : 'heading'}
        aria-level=${options.sticky ? nothing : '2'}
      >
        <button
          type="button"
          part="group-toggle"
          tabindex=${options.sticky ? '-1' : nothing}
          aria-expanded=${item.collapsed ? 'false' : 'true'}
          aria-label=${this.localize(
            item.collapsed ? 'threadGroupExpand' : 'threadGroupCollapse',
            undefined,
            {
              label: item.label,
            }
          )}
          @click=${() =>
            this.emit('lr-group-toggle', {
              groupId: item.id,
              collapsed: nextCollapsed,
            })}
        >
          <span part="group-icon" aria-hidden="true"
            >${item.collapsed ? '+' : '−'}</span
          >
          <span part="group-label">${item.label}</span>
        </button>
        ${!options.sticky && item.adornment
          ? html`<span part="group-adornment">${item.adornment}</span>`
          : nothing}
      </div>
    `;
  }

  private renderRow = (item: unknown): unknown => {
    const thread = item as LyraChatThread;
    const row = html`
      <lr-conversation-item
        exportparts="base:row-item-base, active-indicator:row-item-active-indicator, select-button:row-item-select-button, start:row-item-start, content:row-item-content, label:row-item-label, label-input:row-item-label-input, rename-button:row-item-rename-button, excerpt:row-item-excerpt, meta:row-item-meta, timestamp:row-item-timestamp, actions:row-item-actions"
        conversation-id=${thread.id}
        label=${thread.title}
        excerpt=${thread.excerpt ?? ''}
        .timestamp=${thread.timestamp}
        ?active=${thread.id === this.activeConversationId}
        ?compact=${this.compact}
        .renamable=${this.renamable}
        @lr-select=${(e: Event) => {
          // conversation-item's own lr-select bubbles+composes with no detail (LyraElement.emit()'s
          // defaults) -- without stopping it here it would keep bubbling straight through this
          // component under the same name, right behind the correctly-shaped re-emit below.
          e.stopPropagation();
          this.emit('lr-select', { conversationId: thread.id });
        }}
        @lr-rename=${(
          e: CustomEvent<{ conversationId: string; label: string }>
        ) => {
          e.stopPropagation();
          this.emit('lr-thread-rename', {
            conversationId: thread.id,
            label: e.detail.label,
          });
        }}
      >
        ${this.renderStart
          ? html`<span slot="start" part="row-start" inert
              >${this.renderStart(thread)}</span
            >`
          : nothing}
        ${this.renderExcerpt
          ? html`<span slot="excerpt" part="row-excerpt" inert
              >${this.renderExcerpt(thread)}</span
            >`
          : nothing}
        ${this.renderRowContent
          ? html`<span slot="content" part="row-content" inert
              >${this.renderRowContent(thread)}</span
            >`
          : nothing}
        ${thread.pinned
          ? html`<span slot="meta" part="row-meta pin-glyph" aria-hidden="true"
              >${pinIcon()}</span
            >`
          : nothing}
        ${this.renderMeta
          ? html`<span slot="meta" part="row-meta" inert
              >${this.renderMeta(thread)}</span
            >`
          : nothing}
        ${this.rowActions.length > 0 || this.renderActions
          ? this.renderRowActions(thread)
          : nothing}
      </lr-conversation-item>
    `;
    // A plain, unstyled block `<div>`, and only when `wrapRow` is set. The measured row box is
    // `lr-virtual-list`'s own `[part="row"]`, one level up; a zero-margin/zero-padding block box
    // contributes exactly its child's height to it, so every measured row height is identical to
    // the unwrapped baseline (asserted in the tests). `display: contents` would also be
    // measurement-neutral but generates no box at all, making `::part(row-wrapper)` unusable for
    // the padding/border/background/flex rules the part exists for.
    return this.wrapRow
      ? html`<div part="row-wrapper">${this.wrapRow(thread, row)}</div>`
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
  private stickyAnchors(items: ThreadListItem[]): VirtualListGroup[] {
    const anchors: VirtualListGroup[] = [];
    this.stickyGroupItems.clear();
    items.forEach((item, index) => {
      if (item.kind !== 'group') return;
      this.stickyGroupItems.set(item.id, item);
      anchors.push({ key: item.id, label: '', startIndex: index });
    });
    return anchors;
  }

  // Stable identity: a fresh arrow per render would invalidate the child's property on every update.
  private renderStickyGroup = (group: VirtualListGroup): unknown => {
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

  private onSlottedSelect = (e: Event): void => {
    // Slotted children retain their own event for listeners attached directly to them, but this
    // wrapper reserves `lr-select` for its correlated data-mode event shape.
    e.stopPropagation();
  };

  private onEmptySlotChange = (e: Event): void => {
    this.hasEmptySlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private renderSearch(): TemplateResult {
    return html`
      <div part="search">
        <input
          part="search-input"
          type="search"
          .value=${this.searchText}
          aria-label=${this.localize('searchThreads')}
          placeholder=${this.localize('searchThreads')}
          @input=${this.onSearchInput}
          @keydown=${this.onSearchKeyDown}
          @focus=${this.onSearchFocus}
          @blur=${this.onSearchBlur}
        />
      </div>
    `;
  }

  override render(): TemplateResult {
    const label =
      this.getAttribute('aria-label') ??
      (this.label || this.localize('threadListLabel'));
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
        ${this.dataMode ? this.renderDataList() : this.renderSlottedList(label)}
      </div>
    `;
  }

  private renderSlottedList(label: string): TemplateResult {
    return html`<div part="list" role="list" aria-label=${label}>
      <slot
        @slotchange=${this.onDefaultSlotChange}
        @lr-select=${this.onSlottedSelect}
      ></slot>
    </div>`;
  }

  private renderDataList(): TemplateResult {
    const visible = this.visibleThreads;
    const items = this.buildItems(visible);
    const showEmpty = visible.length === 0 && !this.hasEmptySlot;
    return html`
      <div part="list" @keydown=${this.onListKeyDown}>
        ${showEmpty
          ? html`<div part="empty">
              ${this.searchText.trim()
                ? this.localize('noMatches')
                : this.localize('threadListEmpty')}
            </div>`
          : html`<lr-virtual-list
              exportparts="base:viewport, sticky-group:group-sticky, row:row, row-wrapper:row-wrapper, group-header:group-header, group-toggle:group-toggle, group-label:group-label, group-adornment:group-adornment, group-icon:group-icon, row-start:row-start, row-excerpt:row-excerpt, row-content:row-content, row-meta:row-meta, row-actions:row-actions, row-action:row-action, pin-glyph:pin-glyph, row-item-base:row-item-base, row-item-active-indicator:row-item-active-indicator, row-item-select-button:row-item-select-button, row-item-start:row-item-start, row-item-content:row-item-content, row-item-label:row-item-label, row-item-label-input:row-item-label-input, row-item-rename-button:row-item-rename-button, row-item-excerpt:row-item-excerpt, row-item-meta:row-item-meta, row-item-timestamp:row-item-timestamp, row-item-actions:row-item-actions"
              row-height="auto"
              .items=${items}
              .groups=${this.stickyGroups
                ? this.stickyAnchors(items)
                : undefined}
              .renderStickyGroup=${this.stickyGroups
                ? this.renderStickyGroup
                : undefined}
              .renderItem=${this.renderItem}
              .keyFunction=${this.itemKey}
              .activeId=${this.activeConversationId
                ? this.threadItemKey(this.activeConversationId)
                : ''}
            ></lr-virtual-list>`}
        <slot
          name="empty"
          ?hidden=${!(visible.length === 0 && this.hasEmptySlot)}
          @slotchange=${this.onEmptySlotChange}
        ></slot>
      </div>
      <lr-live-region></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-thread-list': LyraThreadList;
  }
}
