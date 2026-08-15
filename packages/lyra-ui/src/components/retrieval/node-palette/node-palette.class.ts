import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import {
  Announcer,
  acquireAnnouncementSink,
  type AnnouncementSink,
} from '../../../internal/announcer.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { FLOW_PALETTE_MIME_TYPE } from '../../data/flow-canvas/flow-canvas.class.js';
import { styles } from './node-palette.styles.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_nodePaletteDragHint, LYRA_DEFAULT_nodePaletteEmpty, LYRA_DEFAULT_nodePaletteLabel, LYRA_DEFAULT_nodePalettePlaceholder, LYRA_DEFAULT_nodePaletteResultCount, LYRA_DEFAULT_reorderItemMoved, LYRA_DEFAULT_search } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraPaletteItem {
  /** The `FlowNode.type` a placement/drop creates. */
  type: string;
  label: string;
  description?: string;
  /** Items group under localized-by-host category headings, in first-appearance array order. */
  category?: string;
  keywords?: string[];
  /** Optional TemplateResult glyph (`TreeItem.icon` precedent). */
  icon?: unknown;
  /** Visible but not draggable/placeable. */
  disabled?: boolean;
}

export interface LyraNodePaletteEventMap {
  'lr-palette-place': CustomEvent<{ type: string }>;
  'lr-select': CustomEvent<LyraEventDetailSnapshot<{ item: LyraPaletteItem }>>;
  /** A keyboard reorder *request*, only while `reorderable`. `fromIndex`/`toIndex` index into the
   *  host's own `items` array, so applying it is a plain splice; `category` names the group the
   *  move stayed inside (`null` for the ungrouped bucket). This component never reorders `items`
   *  itself, so nothing consults `defaultPrevented` and the event is deliberately not cancelable. */
  'lr-reorder': CustomEvent<{
    type: string;
    category: string | null;
    fromIndex: number;
    toIndex: number;
  }>;
  focus: FocusEvent;
  blur: FocusEvent;
}

/**
 * `<lr-node-palette>` — the searchable, categorized node library for workflow editors: drag an
 * item onto a canvas, or place it by keyboard. Never creates nodes or touches a canvas's data
 * itself — the drop/place handshake ends at `lr-node-add`/`lr-palette-place`; the host mutates
 * `nodes`. Fully decoupled from `lr-flow-canvas` (no `for` resolution, unlike
 * `lr-flow-minimap`/`lr-flow-controls`/`lr-flow-run-status`) — it only needs to agree with a
 * `droppable` canvas on the `FLOW_PALETTE_MIME_TYPE` drag payload shape.
 *
 * Set `reorderable` to opt into keyboard reordering of the catalog itself: Ctrl/Cmd+ArrowUp/
 * ArrowDown on the focused item emits `lr-reorder` — a *request*, exactly like every other event
 * here. `items` stays host-owned; nothing moves until the host applies the reported indices and
 * reassigns it. The move is scoped to the item's own category group, matching the group-first
 * rendering order, and mirrors `<lr-tree>`'s already-shipped `reorderable`/`lr-reorder` contract.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-node-palette
 * @slot header - Content above the search field (e.g. a heading or tabs).
 * @slot footer - Content below the list.
 * @event lr-palette-place - An item was placed (pointer click or Enter/Space — the click/keyboard
 *   alternative to dragging). `detail: { type }`.
 * @event lr-select - Emitted alongside `lr-palette-place` on both gestures, carrying the full
 *   item. `detail: { item }`.
 * @event lr-reorder - `detail: { type, category, fromIndex, toIndex }` — Ctrl/Cmd+ArrowUp/ArrowDown
 *   on the focused item requests moving it past its neighbour **inside its own category group**, so
 *   a reorder can never turn into a recategorization. `fromIndex`/`toIndex` index into `items`
 *   itself, so the host applies the move with a plain splice. Only fired while `reorderable`, never
 *   at a group boundary, and never cancelable — this component does not mutate `items`. Success is
 *   announced only once the re-rendered group order confirms the host applied it.
 * @event focus - A realm-correct native `FocusEvent`, relayed exactly once when the internal
 *   search field gains focus; preserves `relatedTarget` and crosses the shadow boundary.
 * @event blur - A realm-correct native `FocusEvent`, relayed exactly once when the internal
 *   search field loses focus; preserves `relatedTarget` and crosses the shadow boundary.
 * @csspart base - The root wrapper.
 * @csspart search - The search input.
 * @csspart list - The listbox.
 * @csspart group-header - A category heading (`role="presentation"`).
 * @csspart item - A single option row.
 * @csspart item-icon - An item's icon wrapper.
 * @csspart item-label - An item's label text.
 * @csspart item-description - An item's description text.
 * @csspart empty - The no-results message.
 * @csspart live-region - The result-count announcement.
 * @status stable
 * @since 4.0.0
 */
export class LyraNodePalette extends LyraElement<LyraNodePaletteEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    nodePaletteDragHint: LYRA_DEFAULT_nodePaletteDragHint,
    nodePaletteEmpty: LYRA_DEFAULT_nodePaletteEmpty,
    nodePaletteLabel: LYRA_DEFAULT_nodePaletteLabel,
    nodePalettePlaceholder: LYRA_DEFAULT_nodePalettePlaceholder,
    nodePaletteResultCount: LYRA_DEFAULT_nodePaletteResultCount,
    reorderItemMoved: LYRA_DEFAULT_reorderItemMoved,
    search: LYRA_DEFAULT_search,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['items']);

  static override styles = [LyraElement.styles, styles, srOnly];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-select',
  ]);

  /** Node templates available for filtering, activation, dragging, and optional reordering. */
  @property({ attribute: false }) items: readonly LyraPaletteItem[] = [];
  /** Accessible name for the palette; empty uses the localized default. */
  @property() label = '';
  /**
   * Opts into Ctrl/Cmd+ArrowUp/ArrowDown keyboard reordering (see the class doc). Defaults to
   * `false`: unset, no `lr-reorder` is ever emitted and Ctrl/Cmd+Arrow keeps behaving exactly like
   * a plain Arrow press.
   */
  @property({ type: Boolean, reflect: true }) reorderable = false;
  /** JS-only accessible-name override for the listbox. A markup `aria-label` names the component
   *  as a whole, so it is not cloned onto the inner listbox. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private queryText = '';
  @state() private activeIndex = 0;
  @state() private liveText = '';

  private readonly listId = nextId('node-palette-list');
  private readonly hintId = nextId('node-palette-hint');
  private announcementSink?: AnnouncementSink;
  private readonly announcer = new Announcer({
    onFlush: (text) => {
      this.liveText = text;
      this.announcementSink?.announce(text);
    },
  });
  /** Gates the item-count announcement so a freshly-mounted palette (or one that receives its
   *  initial `items` before/at connect) never announces its own starting count -- mirrors
   *  `<lr-chat-message>`/`<lr-branch-picker>`'s identical `isMounting` gate. */
  private isMounting = true;

  // `filtered`/`categorized`/`rovingList` are each memoized off the inputs they actually read
  // (`items` reference + folded query + locale for `filtered`; the `filtered` array reference
  // itself for `categorized`/`rovingList`, which are always called with `this.filtered`). Within
  // a single Lit update cycle those inputs never change between willUpdate()/render()/updated(),
  // so the second and third call each cycle are cache hits instead of full re-scans -- see
  // `lastRenderedRovingList` below for the keydown-handler side of this (no per-keystroke
  // recomputation at all).
  private filteredCache: {
    items: readonly LyraPaletteItem[];
    query: string;
    locale: string;
    result: readonly LyraPaletteItem[];
  } | null = null;
  private categorizedCache: {
    filtered: readonly LyraPaletteItem[];
    result: { category: string | null; items: LyraPaletteItem[] }[];
  } | null = null;
  private rovingListCache: {
    filtered: readonly LyraPaletteItem[];
    result: LyraPaletteItem[];
  } | null = null;

  private get filtered(): readonly LyraPaletteItem[] {
    const locale = this.effectiveLocale;
    const q = this.queryText.trim().toLocaleLowerCase(locale);
    const cache = this.filteredCache;
    if (
      cache &&
      cache.items === this.items &&
      cache.query === q &&
      cache.locale === locale
    ) {
      return cache.result;
    }
    const result = !q
      ? this.items
      : this.items.filter((item) =>
          [item.label, item.category ?? '', ...(item.keywords ?? [])]
            .join(' ')
            .toLocaleLowerCase(locale)
            .includes(q)
        );
    this.filteredCache = { items: this.items, query: q, locale, result };
    return result;
  }

  private categorized(
    filtered: readonly LyraPaletteItem[]
  ): { category: string | null; items: LyraPaletteItem[] }[] {
    const cache = this.categorizedCache;
    if (cache && cache.filtered === filtered) return cache.result;
    const groups = new Map<string | null, LyraPaletteItem[]>();
    for (const item of filtered) {
      const key = item.category ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    const result = Array.from(groups, ([category, groupItems]) => ({
      category,
      items: groupItems,
    }));
    this.categorizedCache = { filtered, result };
    return result;
  }

  private rovingList(filtered = this.filtered): LyraPaletteItem[] {
    const cache = this.rovingListCache;
    if (cache && cache.filtered === filtered) return cache.result;
    const result = this.categorized(filtered)
      .flatMap((group) => group.items)
      .filter((item) => !item.disabled);
    this.rovingListCache = { filtered, result };
    return result;
  }

  /** Enabled items in the order represented by the currently committed item elements. */
  private lastRenderedRovingList: LyraPaletteItem[] = [];
  private pendingFocusIndex: number | null = null;

  private itemElements(): HTMLElement[] {
    return Array.from(
      this.renderRoot.querySelectorAll(
        '[part="item"]:not([aria-disabled="true"])'
      )
    ) as HTMLElement[];
  }

  private occurrenceAt(items: LyraPaletteItem[], index: number): number {
    const item = items[index];
    let occurrence = 0;
    for (let i = 0; i < index; i++) {
      if (items[i] === item) occurrence++;
    }
    return occurrence;
  }

  private indexOfOccurrence(
    items: LyraPaletteItem[],
    item: LyraPaletteItem,
    occurrence: number
  ): number {
    let seen = 0;
    for (let index = 0; index < items.length; index++) {
      if (items[index] !== item) continue;
      if (seen === occurrence) return index;
      seen++;
    }
    return -1;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
    this.announcementSink ??= acquireAnnouncementSink('polite', {
      document: this.ownerDocument,
      source: this,
    });
  }

  override disconnectedCallback(): void {
    this.announcer.cancel();
    this.liveText = '';
    this.isMounting = true;
    this.announcementSink?.release();
    this.announcementSink = undefined;
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    const ownerWindow = this.ownerDocument.defaultView;
    if (ownerWindow) this.announcer.setTimerHost(ownerWindow);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const previous = this.lastRenderedRovingList;
    const next = this.rovingList();
    const structureChanged =
      previous.length !== next.length ||
      previous.some((item, index) => item !== next[index]);
    if (!this.hasUpdated || !structureChanged) return;

    const oldElements = this.itemElements();
    const focusedIndex = oldElements.indexOf(
      activeElementIn(this.shadowRoot) as HTMLElement
    );
    const referenceIndex =
      focusedIndex >= 0
        ? focusedIndex
        : Math.min(
            Math.max(0, this.activeIndex),
            Math.max(0, previous.length - 1)
          );

    let nextIndex = 0;
    const previousItem = previous[referenceIndex];
    if (!changed.has('queryText') && previousItem) {
      const occurrence = this.occurrenceAt(previous, referenceIndex);
      const preservedIndex = this.indexOfOccurrence(
        next,
        previousItem,
        occurrence
      );
      nextIndex =
        preservedIndex >= 0
          ? preservedIndex
          : Math.min(referenceIndex, Math.max(0, next.length - 1));
    }

    if (focusedIndex >= 0) {
      if (next.length === 0) {
        (
          this.renderRoot.querySelector('input') as HTMLInputElement | null
        )?.focus();
      } else {
        const nextItem = next[nextIndex]!;
        const nextOccurrence = this.occurrenceAt(next, nextIndex);
        const survivingOldIndex = this.indexOfOccurrence(
          previous,
          nextItem,
          nextOccurrence
        );
        const survivingOldElement = oldElements[survivingOldIndex];
        if (survivingOldElement) survivingOldElement.focus();
        else
          (
            this.renderRoot.querySelector('input') as HTMLInputElement | null
          )?.focus();
        this.pendingFocusIndex = nextIndex;
      }
    }
    this.activeIndex = next.length === 0 ? 0 : nextIndex;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.lastRenderedRovingList = this.rovingList();
    const pendingFocusIndex = this.pendingFocusIndex;
    if (pendingFocusIndex !== null) {
      this.pendingFocusIndex = null;
      this.itemElements()[
        Math.min(pendingFocusIndex, this.lastRenderedRovingList.length - 1)
      ]?.focus();
    }
    if (changed.has('items')) this.confirmPendingReorder();
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (!wasMounting && (changed.has('queryText') || changed.has('items'))) {
      const count = this.filtered.length;
      const countText = getNumberFormat(this.effectiveLocale).format(count);
      this.announcer.announce(
        this.localize('nodePaletteResultCount', undefined, {
          count: countText,
          pluralCount: count,
        })
      );
    }
  }

  private onSearchInput = (e: Event): void => {
    this.queryText = (e.target as HTMLInputElement).value;
    this.activeIndex = 0;
  };

  // Native focus/blur neither bubble nor cross the shadow boundary, so a host listening for
  // focus/blur directly on <lr-node-palette> (e.g. to highlight the field as active) would never
  // hear about the internal search field without this bridge.
  private onSearchFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onSearchBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onFieldKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Reads the roving list as last rendered rather than recomputing it -- see the cache note
      // above `filteredCache`. `lastRenderedRovingList` is refreshed in updated() on every cycle,
      // so it is always current by the time a user can press a key.
      if (this.lastRenderedRovingList.length === 0) return;
      this.activeIndex = 0;
      this.focusItem(0);
    }
  };

  private focusItem(index: number): void {
    void this.updateComplete.then(() => {
      this.itemElements()[index]?.focus();
    });
  }

  private onItemKeyDown(
    e: KeyboardEvent,
    rovingIndex: number,
    item: LyraPaletteItem
  ): void {
    // Same rationale as onFieldKeyDown above: reuse the list already built for the last render
    // instead of recomputing it on every arrow-key press.
    const list = this.lastRenderedRovingList;
    // Ctrl/Cmd+ArrowUp/ArrowDown reorders instead of navigating, matching <lr-tree>'s own contract.
    // ArrowUp/ArrowDown are not direction-sensitive, so this branch is deliberately not RTL-swapped:
    // "down" always means later in the group.
    if (
      this.reorderable &&
      (e.ctrlKey || e.metaKey) &&
      (e.key === 'ArrowUp' || e.key === 'ArrowDown')
    ) {
      e.preventDefault();
      this.requestReorder(item, e.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(list.length - 1, rovingIndex + 1);
      this.focusItem(this.activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rovingIndex === 0) {
        (
          this.renderRoot.querySelector('input') as HTMLInputElement | null
        )?.focus();
        return;
      }
      this.activeIndex = Math.max(0, rovingIndex - 1);
      this.focusItem(this.activeIndex);
    } else if (e.key === 'Home') {
      e.preventDefault();
      this.activeIndex = 0;
      this.focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      this.activeIndex = list.length - 1;
      this.focusItem(this.activeIndex);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.place(item);
    }
  }

  /** The rendered items of one category group, disabled entries included: a reorder moves the
   *  focused item past the neighbour a user can actually see, which is not the same list the
   *  roving-tabindex order walks. */
  private groupItemsFor(category: string | null): LyraPaletteItem[] {
    return (
      this.categorized(this.filtered).find(
        (group) => group.category === category
      )?.items ?? []
    );
  }

  private pendingReorder?: {
    item: LyraPaletteItem;
    category: string | null;
    neighbor: LyraPaletteItem;
    wasBefore: boolean;
  };

  private requestReorder(item: LyraPaletteItem, delta: 1 | -1): void {
    const category = item.category ?? null;
    const group = this.groupItemsFor(category);
    const position = group.indexOf(item);
    const neighbor = position < 0 ? undefined : group[position + delta];
    if (!neighbor) return; // already at the group's own boundary -- a move here would recategorize
    const fromIndex = this.items.indexOf(item);
    const toIndex = this.items.indexOf(neighbor);
    if (fromIndex < 0 || toIndex < 0) return;
    this.pendingReorder = { item, category, neighbor, wasBefore: delta === 1 };
    this.emit('lr-reorder', { type: item.type, category, fromIndex, toIndex });
  }

  /** Announce a move only once the re-rendered group proves the host accepted the request -- the
   *  same "confirm, don't assume" contract `<lr-tree>`'s own reorder announcement follows. Relative
   *  order is the test rather than an absolute index, so a host that applies the move *and* other
   *  edits in the same reassignment still confirms. */
  private confirmPendingReorder(): void {
    const pending = this.pendingReorder;
    if (!pending) return;
    const group = this.groupItemsFor(pending.category);
    const position = group.indexOf(pending.item);
    const neighborPosition = group.indexOf(pending.neighbor);
    if (position < 0 || neighborPosition < 0) {
      this.pendingReorder = undefined;
      return;
    }
    // The request was "swap past this neighbour", so the accepted state is simply the two having
    // traded sides. Anything else means the host has not applied it (yet).
    if (position < neighborPosition === pending.wasBefore) return;
    this.pendingReorder = undefined;
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const text = this.localize('reorderItemMoved', undefined, {
      index: numberFormat.format(position + 1),
      total: numberFormat.format(group.length),
    });
    // A discrete, user-initiated action, so it bypasses the result-count throttle window rather
    // than collapsing into it -- but only once this update has settled: a forced flush from inside
    // updated() writes the mirrored live text mid-cycle and schedules a second update.
    void this.updateComplete.then(() =>
      this.announcer.announce(text, { force: true })
    );
  }

  private place(item: LyraPaletteItem): void {
    if (item.disabled) return;
    this.emit('lr-palette-place', { type: item.type });
    this.emit('lr-select', { item });
  }

  private onItemDragStart(e: DragEvent, item: LyraPaletteItem): void {
    if (item.disabled || !e.dataTransfer) return;
    e.dataTransfer.setData(
      FLOW_PALETTE_MIME_TYPE,
      JSON.stringify({ type: item.type })
    );
    e.dataTransfer.setData('text/plain', item.label);
    e.dataTransfer.effectAllowed = 'copy';
  }

  private itemTemplate(item: LyraPaletteItem, rovingIndex: number): TemplateResult {
    return html`<div
      part="item"
      role="option"
      aria-selected="false"
      aria-disabled=${item.disabled ? 'true' : 'false'}
      aria-describedby=${item.disabled ? nothing : this.hintId}
      tabindex=${rovingIndex === this.activeIndex && !item.disabled
        ? '0'
        : '-1'}
      draggable=${item.disabled ? 'false' : 'true'}
      @click=${() => this.place(item)}
      @focus=${() => {
        if (rovingIndex >= 0) this.activeIndex = rovingIndex;
      }}
      @keydown=${(e: KeyboardEvent) => this.onItemKeyDown(e, rovingIndex, item)}
      @dragstart=${(e: DragEvent) => this.onItemDragStart(e, item)}
    >
      ${item.icon
        ? html`<span part="item-icon" aria-hidden="true"
            >${item.icon as TemplateResult}</span
          >`
        : nothing}
      <span part="item-label">${item.label}</span>
      ${item.description
        ? html`<span part="item-description">${item.description}</span>`
        : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const filtered = this.filtered;
    const groups = this.categorized(filtered);
    let nextRovingIndex = 0;
    const hostLabel = hostAriaLabel(this);
    const listLabel =
      hostLabel === null
        ? this.accessibleLabel ??
          (this.label || this.localize('nodePaletteLabel'))
        : this.label && this.label !== hostLabel
          ? this.label
          : this.localize('nodePaletteLabel');
    return html`<div part="base">
      <slot name="header"></slot>
      <input
        part="search"
        type="search"
        aria-label=${this.localize('search')}
        aria-controls=${this.listId}
        placeholder=${this.localize('nodePalettePlaceholder')}
        .value=${this.queryText}
        @input=${this.onSearchInput}
        @keydown=${this.onFieldKeyDown}
        @focus=${this.onSearchFocus}
        @blur=${this.onSearchBlur}
      />
      <div
        part="list"
        id=${this.listId}
        role="listbox"
        aria-label=${listLabel}
      >
        ${groups.length === 0
          ? html`<div part="empty">${this.localize('nodePaletteEmpty')}</div>`
          : groups.map((group, groupIndex) => {
              const headingId = `${this.listId}-group-${groupIndex}`;
              const content = group.items.map((item) => {
                const rovingIndex = item.disabled ? -1 : nextRovingIndex++;
                return this.itemTemplate(item, rovingIndex);
              });
              return group.category
                ? html`<div role="group" aria-labelledby=${headingId}>
                    <div
                      id=${headingId}
                      part="group-header"
                      role="presentation"
                    >
                      ${group.category}
                    </div>
                    ${content}
                  </div>`
                : content;
            })}
      </div>
      <div part="live-region" class="sr-only" aria-hidden="true">
        ${this.liveText}
      </div>
      <span id=${this.hintId} class="sr-only"
        >${this.localize('nodePaletteDragHint')}</span
      >
      <slot name="footer"></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-node-palette': LyraNodePalette;
  }
}
