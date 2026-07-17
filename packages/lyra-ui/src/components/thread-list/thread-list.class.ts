import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraConversationItem } from '../conversation-item/conversation-item.class.js';
import '../conversation-item/conversation-item.js';
import type { LyraVirtualList, VirtualListGroup } from '../virtual-list/virtual-list.class.js';
import '../virtual-list/virtual-list.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.js';
import { styles } from './thread-list.styles.js';

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
  'lyra-select': CustomEvent<{ id: string }>;
  'lyra-thread-pin': CustomEvent<{ id: string; pinned: boolean }>;
  'lyra-thread-archive': CustomEvent<{ id: string; archived: boolean }>;
  'lyra-thread-delete': CustomEvent<{ id: string }>;
  'lyra-thread-rename': CustomEvent<{ id: string; title: string }>;
  'lyra-filter-change': CustomEvent<{ text: string; matchCount: number }>;
}

type ThreadBucketKey =
  | 'pinned'
  | 'today'
  | 'yesterday'
  | 'previous7'
  | 'previous30'
  | `month:${string}`
  | 'archived';

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts's
// chevronIcon()/closeIcon()/etc.) without adding pin/archive/trash glyphs to that module -- so
// these one-off icons still read as part of the same visual language as the rest of the library's
// inline icons. Same approach lyra-conversation-item's own local pencil glyph takes for the
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
 * `<lyra-thread-list>` — the conversation sidebar: a grouped, searchable list of chat sessions with
 * pin/archive/delete/rename affordances. *Data mode* (non-empty `threads`, or empty `threads` with
 * nothing slotted) renders every row as a `<lyra-conversation-item>` inside an internal
 * `<lyra-virtual-list>` — virtualized by construction, scroll position and per-row state survive a
 * `threads` replacement; zero rows renders the built-in empty state. *Slotted mode* (empty `threads`
 * *and* real slotted content) renders host-supplied `<lyra-conversation-item>`s from the default slot
 * as-is: no grouping, virtualization, or row actions in that mode — those are data-mode-only by design
 * (shadow DOM cannot inject group headers between slotted children).
 *
 * No thread CRUD or persistence: every mutation (`lyra-thread-pin`/`-archive`/`-delete`/`-rename`) is
 * a controlled event carrying the *requested* new state — the host mutates `threads`.
 *
 * @customElement lyra-thread-list
 * @slot - Slotted mode only: host-supplied `lyra-conversation-item`s, rendered in order. Each
 *   top-level assigned element that doesn't already carry an explicit `role` is given
 *   `role="listitem"`, since `[part="list"]` is `role="list"` in this mode and `lyra-conversation-item`
 *   deliberately doesn't self-apply that role (see its own class doc).
 * @slot empty - Replaces the built-in empty state.
 * @event lyra-select - `detail: { id }` -- a row was activated (data mode).
 * @event lyra-thread-pin - `detail: { id, pinned }` -- the *requested* new state (data mode).
 * @event lyra-thread-archive - `detail: { id, archived }` -- the *requested* new state (data mode).
 * @event lyra-thread-delete - `detail: { id }` -- no built-in confirmation (data mode).
 * @event lyra-thread-rename - `detail: { id, title }`, re-emitted from the row's `lyra-rename` with
 *   the id attached (data mode).
 * @event lyra-filter-change - `detail: { text, matchCount }` -- fires in both modes.
 * @csspart base - The root.
 * @csspart search - The search field wrapper.
 * @csspart search-input - The `<input type="search">`.
 * @csspart list - The list region.
 * @csspart empty - The empty/no-matches state.
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

  /** Data mode: bucket rows under localized date headers, or `'none'` for a flat, ungrouped list in
   *  host order (including archived threads commingled with active ones, when `showArchived`). */
  @property() grouping: 'date' | 'none' = 'date';

  /** Data mode only: built-in icon buttons rendered into each row's `actions` slot, in display order. */
  @property({ attribute: false }) rowActions: ThreadRowAction[] = [];

  /** Data mode: include `archived` threads (in their own trailing group under `grouping="date"`). */
  @property({ type: Boolean, attribute: 'show-archived', reflect: true }) showArchived = false;

  /** Forwarded to each data-mode row's inline rename. */
  @property({ type: Boolean, reflect: true }) editable = true;

  /** Accessible name for the list region. Defaults to the localized `threadListLabel`. */
  @property() label = '';

  @state() private searchText = '';
  @state() private hasEmptySlot = false;
  @state() private hasDefaultSlotContent = false;

  @query('lyra-virtual-list') private virtualListEl?: LyraVirtualList;
  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;

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
        '[lyra-thread-list] both `threads` and slotted content were supplied -- `threads` (data mode) wins and the default slot is ignored.',
      );
    }
  }

  // Slotted mode's `[part="list"]` carries `role="list"`, which ARIA requires to directly own only
  // `role="listitem"` elements -- `lyra-conversation-item` deliberately does *not* self-apply that
  // role (its own doc explains why: it's a plain activatable row usable standalone, not committed to
  // list/listbox membership), so the container imposes it on whatever lands in the default slot
  // instead, the same way `lyra-breadcrumb-item` self-applies `role="listitem"` for its own `role="list"`
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
        const [, ym] = key.split(':');
        const [year, month] = ym!.split('-').map(Number);
        return new Intl.DateTimeFormat(this.effectiveLocale, { month: 'long', year: 'numeric' }).format(
          new Date(year!, month! - 1, 1),
        );
      }
    }
  }

  private buildRows(visible: ChatThread[]): { rows: ChatThread[]; groups: VirtualListGroup[] } {
    if (this.grouping === 'none') return { rows: visible, groups: [] };
    const now = new Date();
    const bucketOf = new Map<ChatThread, ThreadBucketKey>();
    const monthKeys = new Set<string>();
    for (const t of visible) {
      const key = this.bucketFor(t, now);
      bucketOf.set(t, key);
      if (key.startsWith('month:')) monthKeys.add(key);
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
    const rows: ChatThread[] = [];
    const groups: VirtualListGroup[] = [];
    for (const key of order) {
      const bucketThreads = visible.filter((t) => bucketOf.get(t) === key);
      if (bucketThreads.length === 0) continue;
      groups.push({ key, label: this.bucketLabel(key), startIndex: rows.length });
      rows.push(...bucketThreads);
    }
    return { rows, groups };
  }

  private onSearchInput = (e: Event): void => {
    this.searchText = (e.target as HTMLInputElement).value;
    const count = this.visibleThreads.length;
    this.emit<{ text: string; matchCount: number }>('lyra-filter-change', {
      text: this.searchText,
      matchCount: count,
    });
    this.announceMatchCount(count);
  };

  private announceMatchCount(count: number): void {
    if (this.searchText.trim() === '') return;
    const key =
      new Intl.PluralRules(this.effectiveLocale).select(count) === 'one'
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
    return [...scope.querySelectorAll<LyraConversationItem>('lyra-conversation-item')];
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
      <span slot="actions">
        ${this.rowActions.includes('pin')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize(thread.pinned ? 'unpinConversation' : 'pinConversation')}
              @click=${() => this.emit('lyra-thread-pin', { id: thread.id, pinned: !thread.pinned })}
            >
              ${pinIcon()}
            </button>`
          : nothing}
        ${this.rowActions.includes('archive')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize(thread.archived ? 'unarchiveConversation' : 'archiveConversation')}
              @click=${() => this.emit('lyra-thread-archive', { id: thread.id, archived: !thread.archived })}
            >
              ${archiveIcon()}
            </button>`
          : nothing}
        ${this.rowActions.includes('delete')
          ? html`<button
              type="button"
              part="row-action"
              aria-label=${this.localize('deleteConversation')}
              @click=${() => this.emit('lyra-thread-delete', { id: thread.id })}
            >
              ${trashIcon()}
            </button>`
          : nothing}
      </span>
    `;
  }

  private renderRow = (item: unknown): unknown => {
    const thread = item as ChatThread;
    return html`
      <lyra-conversation-item
        id=${thread.id}
        title=${thread.title}
        excerpt=${thread.excerpt ?? ''}
        .timestamp=${thread.timestamp}
        ?active=${thread.id === this.activeId}
        .editable=${this.editable}
        @lyra-select=${() => this.emit('lyra-select', { id: thread.id })}
        @lyra-rename=${(e: CustomEvent<{ title: string }>) =>
          this.emit('lyra-thread-rename', { id: thread.id, title: e.detail.title })}
      >
        ${thread.pinned ? html`<span slot="meta" part="pin-glyph" aria-hidden="true">${pinIcon()}</span>` : nothing}
        ${this.rowActions.length > 0 ? this.renderRowActions(thread) : nothing}
      </lyra-conversation-item>
    `;
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
    const { rows, groups } = this.buildRows(visible);
    const showEmpty = rows.length === 0 && !this.hasEmptySlot;
    return html`
      <div part="base" role="region" aria-label=${label}>
        ${this.searchable ? this.renderSearch() : nothing}
        <div part="list" @keydown=${this.onListKeyDown}>
          ${showEmpty
            ? html`<div part="empty">${
                this.searchText.trim() ? this.localize('noMatches') : this.localize('threadListEmpty')
              }</div>`
            : html`<lyra-virtual-list
                exportparts="group:group-header, row:row"
                row-height="auto"
                .items=${rows}
                .renderItem=${this.renderRow}
                .keyFunction=${(item: unknown) => (item as ChatThread).id}
                .groups=${groups}
                .activeId=${this.activeId}
              ></lyra-virtual-list>`}
          <slot name="empty" @slotchange=${this.onEmptySlotChange}></slot>
        </div>
        <lyra-live-region></lyra-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-thread-list': LyraThreadList;
  }
}
