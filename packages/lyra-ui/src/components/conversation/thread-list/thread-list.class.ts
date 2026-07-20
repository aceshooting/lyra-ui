import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import '../conversation-item/conversation-item.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.js';
import { styles } from './thread-list.styles.js';
import { getDateTimeFormat, getPluralRules } from '../../../internal/intl-cache.js';

export interface ChatThread {
  id: string;
  title: string;
  excerpt?: string;
  timestamp?: Date | string;
  pinned?: boolean;
  archived?: boolean;
}

export type ThreadRowAction = 'pin' | 'archive' | 'delete';

export interface LyraThreadListEventMap {
  'lr-select': CustomEvent<{ id: string }>;
  'lr-thread-pin': CustomEvent<{ id: string; pinned: boolean }>;
  'lr-thread-archive': CustomEvent<{ id: string; archived: boolean }>;
  'lr-thread-delete': CustomEvent<{ id: string }>;
  'lr-thread-rename': CustomEvent<{ id: string; title: string }>;
  'lr-filter-change': CustomEvent<{ text: string; matchCount: number }>;
  'lr-group-toggle': CustomEvent<{ id: string; collapsed: boolean }>;
}

export type ThreadBucketKey =
  | 'pinned'
  | 'today'
  | 'yesterday'
  | 'previous7'
  | 'previous30'
  | `month:${string}`
  | 'archived';

type ThreadListItem =
  | {
      kind: 'group';
      id: string;
      label: string | TemplateResult;
      accessibleLabel: string;
      collapsed: boolean;
    }
  | { kind: 'thread'; thread: ChatThread };

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

function defaultFilter(thread: ChatThread, query: string): boolean {
  return thread.title.toLowerCase().includes(query) || (thread.excerpt ?? '').toLowerCase().includes(query);
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
 *
 * Data mode: a host needing content with no home in `lr-conversation-item`'s own
 * `title`/`excerpt`/`meta`/`actions` surface sets `wrapRow` to wrap the already-built row. For
 * common row composition, `renderLeading`, `renderMeta`, and `renderRowContent` provide focused
 * virtualized render hooks. A host needing a fully custom
 * `actions` surface itself — beyond `rowActions`'s closed `pin | archive | delete` set, e.g. a
 * `<lr-menu>` with Rename/Delete — sets `renderActions` instead; its content is appended after any
 * built-in `rowActions` output in the same slot, and `wrapRow` continues to compose around the result.
 *
 * @customElement lr-thread-list
 * @slot - Slotted mode only: host-supplied `lr-conversation-item`s, rendered in order. Each
 *   top-level assigned element that doesn't already carry an explicit `role` is given
 *   `role="listitem"`, since `[part="list"]` is `role="list"` in this mode and `lr-conversation-item`
 *   deliberately doesn't self-apply that role (see its own class doc).
 * @slot empty - Replaces the built-in empty state.
 * @event lr-select - `detail: { id }` -- a row was activated (data mode).
 * @event lr-thread-pin - `detail: { id, pinned }` -- the *requested* new state (data mode).
 * @event lr-thread-archive - `detail: { id, archived }` -- the *requested* new state (data mode).
 * @event lr-thread-delete - `detail: { id }` -- no built-in confirmation (data mode).
 * @event lr-thread-rename - `detail: { id, title }`, re-emitted from the row's `lr-rename` with
 *   the id attached (data mode).
 * @event lr-filter-change - `detail: { text, matchCount }` -- fires in both modes.
 * @event lr-group-toggle - `detail: { id, collapsed }` -- requests a controlled custom/date group
 *   collapse-state change; the host updates `collapsedGroupIds`.
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
 * @csspart group-toggle - The controlled group expand/collapse button.
 * @csspart group-label - The group label inside `group-toggle`.
 * @csspart group-icon - The decorative expand/collapse glyph.
 * @csspart row - Exported from the internal `lr-virtual-list`'s `row` part (data mode).
 * @csspart row-wrapper - The wrapper around `wrapRow` output (data mode, only when `wrapRow` is
 *   set). Row-only: group headers are never passed through `wrapRow`, so they never carry it.
 * @csspart row-leading - The wrapper around `renderLeading` output.
 * @csspart row-content - The wrapper around `renderRowContent` output.
 * @csspart row-meta - A wrapper around built-in or `renderMeta` metadata.
 * @csspart row-actions - The wrapper around built-in and `renderActions` output.
 * @csspart row-item-base - Data mode: the row `<lr-conversation-item>`'s own `base` part — the box
 *   whose padding sets row height. `row-item-*` parts are the item's *internals*; the `row-*` parts
 *   above wrap this component's own callback output and are a different surface. Styling row
 *   density here replaces the older `::part(row) { --lr-theme-*: … }` workaround, which retheme'd
 *   the whole row subtree (`renderActions` popups included).
 * @csspart row-item-option - Data mode: the row item's selectable `option` region.
 * @csspart row-item-leading - Data mode: the row item's `leading` wrapper.
 * @csspart row-item-content - Data mode: the row item's title/excerpt content column.
 * @csspart row-item-title - Data mode: the row item's title text.
 * @csspart row-item-title-input - Data mode: the row item's in-place rename `<input>`.
 * @csspart row-item-rename-button - Data mode: the row item's pencil/rename affordance.
 * @csspart row-item-excerpt - Data mode: the row item's excerpt line.
 * @csspart row-item-meta - Data mode: the row item's `meta` wrapper.
 * @csspart row-item-timestamp - Data mode: the row item's `<time>` element.
 * @csspart row-item-actions - Data mode: the row item's `actions` wrapper.
 */
export class LyraThreadList extends LyraElement<LyraThreadListEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Non-empty ⇒ data mode (the default slot is ignored). Empty with no slotted content ⇒ data mode
   *  with zero rows (the built-in empty state). Empty *with* slotted content ⇒ slotted mode. */
  @property({ attribute: false }) threads: ChatThread[] = [];

  /** Data mode: marks the matching row `active`/`aria-current` and scrolls it into view. */
  @property({ attribute: 'active-id' }) activeId = '';

  /** Shows the built-in search field. */
  @property({ type: Boolean, reflect: true }) searchable = false;

  /** Overrides the default case-insensitive `title` + `excerpt` substring match. */
  @property({ attribute: false }) filter?: (thread: ChatThread, query: string) => boolean;

  /** Data mode: bucket rows under localized date headers, use `groupBy` with `'custom'`, or use
   *  `'none'` for a flat list in host order. */
  @property() grouping: 'date' | 'custom' | 'none' = 'date';

  /** `grouping="custom"`: derives an arbitrary controlled group id for every visible thread. */
  @property({ attribute: false }) groupBy?: (thread: ChatThread) => string;

  /** `grouping="custom"`: renders a group label. Receives the id and matching visible threads. */
  @property({ attribute: false }) formatGroup?: (
    id: string,
    threads: ChatThread[],
  ) => string | TemplateResult;

  /** `grouping="custom"`: explicit group-id order, or a comparator. Unlisted ids follow in their
   *  first-seen order when an array is supplied. */
  @property({ attribute: false }) groupOrder?: string[] | ((a: string, b: string) => number);

  /** Data mode: controlled ids of date/custom groups whose rows are omitted from virtualization. */
  @property({ attribute: false }) collapsedGroupIds: string[] = [];

  /** Data mode only: built-in icon buttons rendered into each row's `actions` slot, in display order. */
  @property({ attribute: false }) rowActions: ThreadRowAction[] = [];

  /** Data mode only: appended after any built-in `rowActions` buttons in the same row's `actions`
   *  slot -- the escape hatch for a fully custom per-row action surface (e.g. a `<lr-menu>` with
   *  Rename/Delete, mirroring an app's own richer row-action menu) that `rowActions`'s closed
   *  `pin | archive | delete` set can't express. Additive, not a replacement: both render together
   *  when `rowActions` is also non-empty, the same composition direction `wrapRow` already takes
   *  elsewhere on the row (it only ever adds content, never removes built-in output) -- set
   *  `rowActions` to `[]` (its default) to omit the built-in buttons and use only the callback's
   *  content. Receives the *current* thread on every render, re-invoked per row through the
   *  virtualized `renderItem` path exactly like `wrapRow` -- never memoized or stale. Rendered as a
   *  DOM sibling of the row's own selectable region (`lr-conversation-item`'s `[part="option"]`),
   *  the same structural reason the built-in `rowActions` buttons don't also trigger `lr-select` --
   *  so ordinary Lyra controls returned here (`lr-menu`, `lr-icon-button`, etc.) fire their own
   *  events normally without also selecting the row. Unset (the default) leaves `rowActions`'
   *  output byte-for-byte unchanged. */
  @property({ attribute: false }) renderActions?: (thread: ChatThread) => TemplateResult;

  /** Data mode only: renders non-interactive content in the row's leading slot, before its title
   *  and excerpt. The callback runs during the virtualized row render. */
  @property({ attribute: false }) renderLeading?: (thread: ChatThread) => TemplateResult;

  /** Data mode only: renders the row's meta content. Built-in pin metadata remains available when
   *  present, and this result is appended in the same meta region. */
  @property({ attribute: false }) renderMeta?: (thread: ChatThread) => TemplateResult;

  /** Data mode only: replaces the conversation item's title/excerpt/meta content area with a
   *  host-rendered row body. Use this for structured, non-interactive row content while keeping
   *  the selectable row and timestamp semantics supplied by `<lr-conversation-item>`. */
  @property({ attribute: false }) renderRowContent?: (thread: ChatThread) => TemplateResult;

  /** Overrides the localized label for a date group. The date argument is present for month
   *  groups and omitted for semantic groups such as `today` or `archived`. */
  @property({ attribute: false }) formatGroupLabel?: (key: ThreadBucketKey, date?: Date) => string;

  /** Overrides the default locale-aware formatting used for month group dates. */
  @property({ attribute: false }) formatDate?: (date: Date) => string;

  /** Data mode: include `archived` threads (in their own trailing group under `grouping="date"`). */
  @property({ type: Boolean, attribute: 'show-archived', reflect: true }) showArchived = false;

  /** Forwarded to each data-mode row's inline rename. */
  @property({ type: Boolean, reflect: true }) editable = true;

  /** Data mode only: forwarded to every row `<lr-conversation-item>`'s own `compact`, tightening
   *  each row's padding and gaps in one place. Slotted mode is a deliberate no-op — this component
   *  renders host-supplied items as-is, so the host sets `compact` on its own items there, the same
   *  division of responsibility slotted mode already has for every other row property. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Accessible name for the list region. Defaults to the localized `threadListLabel`. */
  @property() label = '';

  /** Data mode only: wraps each row's built-in `<lr-conversation-item>` with host-supplied
   *  content that has no home in the item's own `title`/`excerpt`/`meta`/`actions` surface — e.g. a
   *  leading purpose icon (`lr-conversation-item` has no default slot to receive one) or trailing
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
  @property({ attribute: false }) wrapRow?: (thread: ChatThread, row: TemplateResult) => TemplateResult;

  @state() private searchText = '';
  @state() private hasEmptySlot = false;
  @state() private hasDefaultSlotContent = false;

  @query('lr-virtual-list') private virtualListEl?: LyraVirtualList;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  // Slotted mode is only for a host that's actually relying on it (real slotted content present)
  // and hasn't also supplied `threads` -- empty `threads` with nothing slotted is still data mode,
  // just with zero rows, so it renders the built-in empty state rather than a silently blank slot.
  private get dataMode(): boolean {
    return this.threads.length > 0 || !this.hasDefaultSlotContent;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasEmptySlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'empty');
      const defaultSlotted = Array.from(this.children).filter((el) => !el.hasAttribute('slot'));
      this.hasDefaultSlotContent = defaultSlotted.length > 0;
      this.markAsListItems(defaultSlotted);
    }
    if (changed.has('threads') && this.threads.length > 0 && this.hasDefaultSlotContent) {
      console.warn(
        '[lr-thread-list] both `threads` and slotted content were supplied -- `threads` (data mode) wins and the default slot is ignored.',
      );
    }
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
      if (!el.hasAttribute('role')) el.setAttribute('role', 'listitem');
    }
  }

  private get visibleThreads(): ChatThread[] {
    const q = this.searchText.trim().toLowerCase();
    const withArchiveFilter = this.threads.filter((t) => this.showArchived || !t.archived);
    if (q === '') return withArchiveFilter;
    const fn = this.filter ?? defaultFilter;
    return withArchiveFilter.filter((t) => fn(t, q));
  }

  private bucketFor(thread: ChatThread, now: Date): ThreadBucketKey {
    if (thread.archived) return 'archived';
    if (thread.pinned) return 'pinned';
    const ts = this.normalizeTimestamp(thread.timestamp);
    if (!ts) return 'previous30';
    const dayMs = 86_400_000;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / dayMs);
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays <= 7) return 'previous7';
    if (diffDays <= 30) return 'previous30';
    return `month:${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
  }

  private normalizeTimestamp(value: Date | string | undefined): Date | undefined {
    if (value === undefined) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private bucketLabel(key: ThreadBucketKey): string {
    const groupDate = key.startsWith('month:') ? this.dateForBucket(key) : undefined;
    if (this.formatGroupLabel) return this.formatGroupLabel(key, groupDate);
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
        return this.formatDate?.(groupDate!) ??
          getDateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(groupDate!);
      }
    }
  }

  private dateForBucket(key: ThreadBucketKey): Date | undefined {
    if (!key.startsWith('month:')) return undefined;
    const [, ym] = key.split(':');
    const [year, month] = ym!.split('-').map(Number);
    return new Date(year!, month! - 1, 1);
  }

  private orderedCustomGroupIds(grouped: Map<string, ChatThread[]>): string[] {
    const firstSeen = [...grouped.keys()];
    if (typeof this.groupOrder === 'function') return firstSeen.sort(this.groupOrder);
    if (!this.groupOrder) return firstSeen;
    const ordered = [...new Set(this.groupOrder)].filter((id) => grouped.has(id));
    const listed = new Set(ordered);
    return [...ordered, ...firstSeen.filter((id) => !listed.has(id))];
  }

  private groupedItems(
    grouped: Map<string, ChatThread[]>,
    order: string[],
    format: (id: string, threads: ChatThread[]) => string | TemplateResult,
  ): ThreadListItem[] {
    const collapsedIds = new Set(this.collapsedGroupIds);
    const items: ThreadListItem[] = [];
    for (const id of order) {
      const groupedThreads = grouped.get(id);
      if (!groupedThreads || groupedThreads.length === 0) continue;
      const label = format(id, groupedThreads);
      items.push({
        kind: 'group',
        id,
        label,
        accessibleLabel: typeof label === 'string' ? label : id,
        collapsed: collapsedIds.has(id),
      });
      if (!collapsedIds.has(id)) {
        items.push(...groupedThreads.map((thread): ThreadListItem => ({ kind: 'thread', thread })));
      }
    }
    return items;
  }

  private buildItems(visible: ChatThread[]): ThreadListItem[] {
    if (this.grouping === 'none') {
      return visible.map((thread) => ({ kind: 'thread', thread }));
    }

    if (this.grouping === 'custom') {
      if (!this.groupBy) return visible.map((thread) => ({ kind: 'thread', thread }));
      const grouped = new Map<string, ChatThread[]>();
      for (const thread of visible) {
        const id = this.groupBy(thread);
        const existing = grouped.get(id);
        if (existing) existing.push(thread);
        else grouped.set(id, [thread]);
      }
      return this.groupedItems(
        grouped,
        this.orderedCustomGroupIds(grouped),
        (id, groupedThreads) => this.formatGroup?.(id, groupedThreads) ?? id,
      );
    }

    const now = new Date();
    const grouped = new Map<string, ChatThread[]>();
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
    return this.groupedItems(grouped, order, (id) => this.bucketLabel(id as ThreadBucketKey));
  }

  private onSearchInput = (e: Event): void => {
    this.searchText = (e.target as HTMLInputElement).value;
    const count = this.visibleThreads.length;
    this.emit<{ text: string; matchCount: number }>('lr-filter-change', {
      text: this.searchText,
      matchCount: count,
    });
    this.announceMatchCount(count);
  };

  private announceMatchCount(count: number): void {
    if (this.searchText.trim() === '') return;
    const key =
      getPluralRules(this.effectiveLocale).select(count) === 'one'
        ? 'threadListMatchAnnounce'
        : 'threadListMatchAnnouncePlural';
    this.liveRegion?.announce(this.localize(key, undefined, { count }));
  }

  private onSearchKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown') return;
    const rows = this.rowElements();
    if (rows.length === 0) return;
    e.preventDefault();
    this.optionEl(rows[0])?.focus();
  };

  private rowElements(): LyraConversationItem[] {
    const scope: ParentNode = this.dataMode ? (this.virtualListEl?.renderRoot ?? this) : this;
    return [...scope.querySelectorAll<LyraConversationItem>('lr-conversation-item')];
  }

  private optionEl(row: LyraConversationItem): HTMLElement | null {
    return row.shadowRoot?.querySelector<HTMLElement>('[part="option"]') ?? null;
  }

  private focusedRowIndex(rows: LyraConversationItem[]): number {
    return rows.findIndex((row) => row.shadowRoot?.activeElement != null);
  }

  private onListKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const rows = this.rowElements();
    if (rows.length === 0) return;
    const currentIndex = this.focusedRowIndex(rows);
    let targetIndex: number;
    if (e.key === 'Home') targetIndex = 0;
    else if (e.key === 'End') targetIndex = rows.length - 1;
    else if (e.key === 'ArrowDown') targetIndex = currentIndex < 0 ? 0 : currentIndex + 1;
    else targetIndex = currentIndex < 0 ? rows.length - 1 : currentIndex - 1;

    e.preventDefault();
    if (targetIndex >= 0 && targetIndex < rows.length) {
      this.optionEl(rows[targetIndex])?.focus();
      return;
    }
    // Past the currently-rendered edge -- nudge the internal virtual-list's scroll position by
    // roughly one row so the next row mounts, then focus whichever row ends up at that edge.
    const base = this.virtualListEl?.renderRoot.querySelector('[part="base"]') as HTMLElement | null;
    if (!base) return;
    const rowHeight = rows[0]?.getBoundingClientRect().height || 48;
    base.scrollTop += e.key === 'ArrowDown' ? rowHeight : -rowHeight;
    base.dispatchEvent(new Event('scroll'));
    requestAnimationFrame(() => {
      const refreshed = this.rowElements();
      const edgeRow = e.key === 'ArrowDown' ? refreshed[refreshed.length - 1] : refreshed[0];
      if (edgeRow) this.optionEl(edgeRow)?.focus();
    });
  };

  private renderRowActions(thread: ChatThread): TemplateResult {
    return html`
      <span slot="actions" part="row-actions">
        ${this.rowActions.includes('pin')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize(thread.pinned ? 'unpinConversation' : 'pinConversation')}
              @click=${() => this.emit('lr-thread-pin', { id: thread.id, pinned: !thread.pinned })}
            >
              ${pinIcon()}
            </button>`
          : nothing}
        ${this.rowActions.includes('archive')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize(thread.archived ? 'unarchiveConversation' : 'archiveConversation')}
              @click=${() => this.emit('lr-thread-archive', { id: thread.id, archived: !thread.archived })}
            >
              ${archiveIcon()}
            </button>`
          : nothing}
        ${this.rowActions.includes('delete')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize('deleteConversation')}
              @click=${() => this.emit('lr-thread-delete', { id: thread.id })}
            >
              ${trashIcon()}
            </button>`
          : nothing}
        ${this.renderActions ? this.renderActions(thread) : nothing}
      </span>
    `;
  }

  private renderGroup(item: Extract<ThreadListItem, { kind: 'group' }>): TemplateResult {
    const nextCollapsed = !item.collapsed;
    return html`
      <div part="group-header" data-group-id=${item.id} role="heading" aria-level="2">
        <button
          type="button"
          part="group-toggle"
          aria-expanded=${item.collapsed ? 'false' : 'true'}
          aria-label=${this.localize(item.collapsed ? 'threadGroupExpand' : 'threadGroupCollapse', undefined, {
            label: item.accessibleLabel,
          })}
          @click=${() => this.emit('lr-group-toggle', { id: item.id, collapsed: nextCollapsed })}
        >
          <span part="group-icon" aria-hidden="true">${item.collapsed ? '+' : '−'}</span>
          <span part="group-label">${item.label}</span>
        </button>
      </div>
    `;
  }

  private renderRow = (item: unknown): unknown => {
    const thread = item as ChatThread;
    const row = html`
      <lr-conversation-item
        exportparts="base:row-item-base, option:row-item-option, leading:row-item-leading, content:row-item-content, title:row-item-title, title-input:row-item-title-input, rename-button:row-item-rename-button, excerpt:row-item-excerpt, meta:row-item-meta, timestamp:row-item-timestamp, actions:row-item-actions"
        id=${thread.id}
        title=${thread.title}
        excerpt=${thread.excerpt ?? ''}
        .timestamp=${thread.timestamp}
        ?active=${thread.id === this.activeId}
        ?compact=${this.compact}
        .editable=${this.editable}
        @lr-select=${() => this.emit('lr-select', { id: thread.id })}
        @lr-rename=${(e: CustomEvent<{ title: string }>) =>
          this.emit('lr-thread-rename', { id: thread.id, title: e.detail.title })}
      >
        ${this.renderLeading
          ? html`<span slot="leading" part="row-leading">${this.renderLeading(thread)}</span>`
          : nothing}
        ${this.renderRowContent
          ? html`<span slot="content" part="row-content">${this.renderRowContent(thread)}</span>`
          : nothing}
        ${thread.pinned
          ? html`<span slot="meta" part="row-meta pin-glyph" aria-hidden="true">${pinIcon()}</span>`
          : nothing}
        ${this.renderMeta
          ? html`<span slot="meta" part="row-meta">${this.renderMeta(thread)}</span>`
          : nothing}
        ${this.rowActions.length > 0 || this.renderActions ? this.renderRowActions(thread) : nothing}
      </lr-conversation-item>
    `;
    // A plain, unstyled block `<div>`, and only when `wrapRow` is set. The measured row box is
    // `lr-virtual-list`'s own `[part="row"]`, one level up; a zero-margin/zero-padding block box
    // contributes exactly its child's height to it, so every measured row height is identical to
    // the unwrapped baseline (asserted in the tests). `display: contents` would also be
    // measurement-neutral but generates no box at all, making `::part(row-wrapper)` unusable for
    // the padding/border/background/flex rules the part exists for.
    return this.wrapRow ? html`<div part="row-wrapper">${this.wrapRow(thread, row)}</div>` : row;
  };

  private renderItem = (item: unknown): unknown => {
    const listItem = item as ThreadListItem;
    return listItem.kind === 'group' ? this.renderGroup(listItem) : this.renderRow(listItem.thread);
  };

  private itemKey = (item: unknown): string => {
    const listItem = item as ThreadListItem;
    return listItem.kind === 'group' ? `group:${listItem.id}` : listItem.thread.id;
  };

  private onDefaultSlotChange = (e: Event): void => {
    const assigned = (e.target as HTMLSlotElement).assignedElements({ flatten: true });
    this.markAsListItems(assigned);
    this.hasDefaultSlotContent = assigned.length > 0;
  };

  private onEmptySlotChange = (e: Event): void => {
    this.hasEmptySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
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
        />
      </div>
    `;
  }

  render(): TemplateResult {
    const label = this.label || this.localize('threadListLabel');
    if (!this.dataMode) {
      return html`
        <div part="base">
          ${this.searchable ? this.renderSearch() : nothing}
          <div part="list" role="list" aria-label=${label}>
            <slot @slotchange=${this.onDefaultSlotChange}></slot>
          </div>
        </div>
      `;
    }
    const visible = this.visibleThreads;
    const items = this.buildItems(visible);
    const showEmpty = visible.length === 0 && !this.hasEmptySlot;
    return html`
      <div part="base" role="region" aria-label=${label}>
        ${this.searchable ? this.renderSearch() : nothing}
        <div part="list" @keydown=${this.onListKeyDown}>
          ${showEmpty
            ? html`<div part="empty">${
                this.searchText.trim() ? this.localize('noMatches') : this.localize('threadListEmpty')
              }</div>`
            : html`<lr-virtual-list
                exportparts="base:viewport, row:row, row-wrapper:row-wrapper, group-header:group-header, group-toggle:group-toggle, group-label:group-label, group-icon:group-icon, row-leading:row-leading, row-content:row-content, row-meta:row-meta, row-actions:row-actions, row-action:row-action, pin-glyph:pin-glyph, row-item-base:row-item-base, row-item-option:row-item-option, row-item-leading:row-item-leading, row-item-content:row-item-content, row-item-title:row-item-title, row-item-title-input:row-item-title-input, row-item-rename-button:row-item-rename-button, row-item-excerpt:row-item-excerpt, row-item-meta:row-item-meta, row-item-timestamp:row-item-timestamp, row-item-actions:row-item-actions"
                row-height="auto"
                .items=${items}
                .renderItem=${this.renderItem}
                .keyFunction=${this.itemKey}
                .activeId=${this.activeId}
              ></lr-virtual-list>`}
          <slot name="empty" @slotchange=${this.onEmptySlotChange}></slot>
        </div>
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-thread-list': LyraThreadList;
  }
}
