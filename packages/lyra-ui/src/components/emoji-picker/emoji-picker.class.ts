import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { FormAssociated } from '../../internal/form-associated.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './emoji-picker.styles.js';
import { loadEmojiDataCached } from './emoji-data-loader.js';

const VIRTUALIZE_AT = 200;
const VIRTUAL_ROW_HEIGHT_FALLBACK = 64;
const MAX_VIRTUAL_COLUMNS = 20;

interface VirtualEmojiRow {
  label?: string;
  items: Array<{ item: EmojiPickerItem; index: number }>;
}

export interface EmojiPickerItem {
  emoji: string;
  /** Accessible/searchable name (e.g. 'grinning face'). Used for the picked button's `aria-label`
   *  and as one of the two fields `queryText` matches against. */
  name: string;
  /** Additional searchable aliases (e.g. `['grinning']`). Matched the same way `name` is. */
  shortcodes?: string[];
}

export interface EmojiPickerGroup {
  key: string;
  label: string;
  emojis: EmojiPickerItem[];
}

export interface LyraEmojiPickerEventMap {
  input: CustomEvent<undefined>;
  change: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
  /** Fired when an emoji is picked (click, or Enter/Space on the active grid cell). `detail: {
   *  emoji: string }` — the picked glyph, same value `this.value` is set to. */
  'lr-change': CustomEvent<{ emoji: string }>;
}

class EmojiPickerBase extends LyraElement<LyraEmojiPickerEventMap> {}

/**
 * `<lr-emoji-picker>` — a searchable, keyboard-navigable, form-associated emoji picker. In the
 * same "zero/optional-peer dependency" spirit as `<lr-lite-chart>`/`<lr-heatmap>`: `groups` is
 * fully consumer-suppliable (this component ships no emoji data of its own), with an *optional*
 * convenience auto-loader for a default set — see `emoji-data-loader.ts` and the class doc there for
 * exactly what that covers.
 *
 * Keyboard model: the grid is a roving-tabindex listbox (a single Tab stop — only the active emoji
 * is tabbable). Arrow keys move the active option (Left/Right follow reading direction and swap
 * under RTL; Up/Down move by one visual row, measured from the live wrap layout), Home/End jump to
 * the first/last option, and Enter/Space picks. The search input doubles as a `role="combobox"`
 * over the same listbox: the arrow keys and Enter also work there while focus stays in the input,
 * with `aria-activedescendant` tracking the active option. Large data sets automatically window
 * their visible rows so scrolling does not create one button per supplied emoji in the DOM.
 *
 * @customElement lr-emoji-picker
 * @event lr-change - An emoji was picked. `detail: { emoji: string }`.
 * @csspart base - The root wrapper.
 * @csspart search - The search/filter `<input>` (`role="combobox"` over the grid).
 * @csspart grid - The keyboard-navigable emoji grid.
 * @csspart group-label - Each group's heading, rendered above its emojis.
 * @csspart emoji - Each emoji's own `<button>`; meets the shared minimum tappable size
 *   (`--lr-icon-button-size`) without enlarging the rendered emoji glyph itself.
 * @csspart empty - The empty-state message, shown when the search matches nothing.
 */
export class LyraEmojiPicker extends FormAssociated(EmojiPickerBase) {
  static styles = [LyraElement.styles, styles];

  /** The full, ungrouped data set to search/render. Consumer-supplied — this component ships no
   *  emoji data of its own. Empty (the default) renders no groups/emojis at all, just the search
   *  input and an empty state. See `emoji-data-loader.ts` for an optional convenience loader. */
  @property({ attribute: false }) groups: EmojiPickerGroup[] = [];

  /** Accessible name forwarded from the host to the internal emoji listbox. Empty falls back to
   *  the localized default grid label. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** Injectable loader seam -- overridden directly by tests with a synchronous fake instead of
   *  needing the real `emoji-picker-element-data` package to load in the test browser (mirrors
   *  `LyraPdfViewer`'s `loadLibrary` field / `LyraQrCode`'s `loadLibrary` field). */
  private loadGroups: () => Promise<EmojiPickerGroup[] | null> = loadEmojiDataCached;

  connectedCallback(): void {
    super.connectedCallback();
    // Only auto-loads when the consumer hasn't already supplied groups directly -- an explicit
    // `groups` (even an empty array set intentionally) always wins, matching the "consumer-supplied
    // data takes precedence over any built-in default" convention this library uses elsewhere (e.g.
    // <lr-lite-chart>'s pointText falling back to a built-in template only when unset).
    if (this.groups.length > 0) return;
    void this.loadGroups().then((loaded) => {
      if (!this.isConnected || !loaded || this.groups.length > 0) return;
      this.groups = loaded;
    });
  }

  @state() private queryText = '';

  // Deliberately non-reactive: pointer hover and arrow keys retarget the active option many times
  // a second, and a reactive property here would re-render the entire (potentially ~2000-button)
  // grid on every step. `setActiveIndex()` patches only the affected buttons imperatively instead;
  // the `live()` bindings in `render()` reconcile the template against that imperative state
  // whenever a real re-render (a query/groups change) happens.
  private activeIndex = 0;

  /** The large-data path keeps only visible rows in the DOM. The regular path remains unchanged
   * for small sets so consumers keep the simple grouped light-DOM shape they already receive. */
  private virtualScrollTop = 0;
  private virtualScrollRaf?: number;
  private observedGrid?: HTMLElement;
  private observedGridVirtualized = false;
  private gridResizeObserver?: ResizeObserver;

  @query('[part="search"]') private searchEl?: HTMLInputElement;

  private readonly gridId = nextId('emoji-picker-grid');

  // Lowercased search haystack per item, computed once per item object -- re-joining and
  // re-lowercasing every item on every keystroke dominates filter cost for large sets. Keyed by
  // item identity in a WeakMap, so replacing `groups` invalidates naturally (stale entries are
  // simply collected).
  private readonly haystacks = new WeakMap<EmojiPickerItem, string>();

  private haystackFor(item: EmojiPickerItem): string {
    let haystack = this.haystacks.get(item);
    if (haystack === undefined) {
      haystack = [item.name, ...(item.shortcodes ?? [])].join(' ').toLowerCase();
      this.haystacks.set(item, haystack);
    }
    return haystack;
  }

  private get filteredGroups(): EmojiPickerGroup[] {
    const q = this.queryText.trim().toLowerCase();
    if (!q) return this.groups;
    return this.groups
      .map((group) => ({
        ...group,
        emojis: group.emojis.filter((item) => this.haystackFor(item).includes(q)),
      }))
      .filter((group) => group.emojis.length > 0);
  }

  private get flatItems(): EmojiPickerItem[] {
    return this.filteredGroups.flatMap((group) => group.emojis);
  }

  private get isVirtualized(): boolean {
    return this.flatItems.length >= VIRTUALIZE_AT;
  }

  private cssPixelValue(name: string, fallback: number): number {
    const value = Number.parseFloat(getComputedStyle(this).getPropertyValue(name));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private virtualRowHeight(): number {
    return this.cssPixelValue('--lr-emoji-picker-row-height', VIRTUAL_ROW_HEIGHT_FALLBACK);
  }

  private virtualRows(): VirtualEmojiRow[] {
    const columns = this.columnsPerRow();
    let index = 0;
    const rows: VirtualEmojiRow[] = [];
    for (const group of this.filteredGroups) {
      for (let offset = 0; offset < group.emojis.length; offset += columns) {
        rows.push({
          label: offset === 0 ? group.label : undefined,
          items: group.emojis.slice(offset, offset + columns).map((item) => ({ item, index: index++ })),
        });
      }
    }
    return rows;
  }

  private optionButtons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>('[part="emoji"]')];
  }

  /** Options in the first rendered row. Measured from live layout at call time because the
   *  flex-wrap column count is fluid (container width, emoji font metrics). */
  private columnsPerRow(): number {
    if (this.isVirtualized) {
      const grid = this.renderRoot.querySelector<HTMLElement>('[part="grid"]');
      const width = grid?.clientWidth ?? 0;
      const itemSize = this.cssPixelValue('--lr-emoji-picker-item-size', 40);
      const gap = this.cssPixelValue('--lr-emoji-picker-gap', 4);
      return Math.min(MAX_VIRTUAL_COLUMNS, Math.max(1, Math.floor((Math.max(width, itemSize) + gap) / (itemSize + gap))));
    }
    const buttons = this.optionButtons();
    if (buttons.length === 0) return 1;
    const firstTop = buttons[0].offsetTop;
    let columns = 0;
    for (const button of buttons) {
      if (button.offsetTop !== firstTop) break;
      columns += 1;
    }
    return Math.max(1, columns);
  }

  /** Moves the active option (clamped), updating only the affected buttons plus the combobox's
   *  `aria-activedescendant` — no re-render. `focusTarget` distinguishes the grid's roving-focus
   *  idiom (focus follows the active option) from the search input's combobox idiom (focus stays
   *  in the input). */
  private setActiveIndex(next: number, focusTarget: boolean): void {
    const buttons = this.optionButtons();
    if (buttons.length === 0 && !this.isVirtualized) return;
    this.activeIndex = Math.max(0, Math.min(next, this.flatItems.length - 1));
    const target = this.isVirtualized
      ? this.renderRoot.querySelector<HTMLButtonElement>(
          `[part="emoji"][data-index="${this.activeIndex}"]`,
        )
      : buttons[this.activeIndex];
    const previous = this.renderRoot.querySelector<HTMLButtonElement>('[part="emoji"][data-active]');
    if (previous && previous !== target) {
      previous.tabIndex = -1;
      previous.setAttribute('aria-selected', 'false');
      previous.removeAttribute('data-active');
    }
    if (target) {
      target.tabIndex = 0;
      target.setAttribute('aria-selected', 'true');
      target.setAttribute('data-active', '');
      this.searchEl?.setAttribute('aria-activedescendant', target.id);
      target.scrollIntoView({ block: 'nearest' });
    } else if (this.isVirtualized) {
      this.searchEl?.setAttribute('aria-activedescendant', `${this.gridId}-item-${this.activeIndex}`);
      const rowIndex = this.virtualRows().findIndex((row) => row.items.some(({ index }) => index === this.activeIndex));
      const grid = this.renderRoot.querySelector<HTMLElement>('[part="grid"]');
      if (rowIndex >= 0 && grid) {
        grid.scrollTop = rowIndex * this.virtualRowHeight();
        this.virtualScrollTop = grid.scrollTop;
        this.requestUpdate();
      }
    }
    if (focusTarget) target?.focus();
  }

  private onSearchInput = (event: Event): void => {
    this.queryText = (event.target as HTMLInputElement).value;
    this.activeIndex = 0;
  };

  private pick(item: EmojiPickerItem): void {
    this.value = item.emoji;
    this.emit('lr-change', { emoji: item.emoji });
  }

  // Shared between the search input (combobox idiom: focus stays in the input while
  // `aria-activedescendant` tracks the active option) and the grid itself (roving tabindex: focus
  // follows the active option).
  private onNavigationKeyDown = (event: KeyboardEvent): void => {
    const items = this.flatItems;
    if (items.length === 0) return;
    const inSearch = event.currentTarget === this.searchEl;
    // "Forward" follows reading direction: the wrapped flex grid mirrors under RTL, so the arrow
    // that moves visually toward the line end swaps with it.
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: number;
    if (event.key === forwardKey) target = this.activeIndex + 1;
    else if (event.key === backwardKey) target = this.activeIndex - 1;
    else if (event.key === 'ArrowDown') target = this.activeIndex + this.columnsPerRow();
    else if (event.key === 'ArrowUp') target = this.activeIndex - this.columnsPerRow();
    // In the input, Home/End keep their native caret meaning.
    else if (event.key === 'Home' && !inSearch) target = 0;
    else if (event.key === 'End' && !inSearch) target = items.length - 1;
    else if (event.key === 'Enter' || (event.key === ' ' && !inSearch)) {
      // Space only picks from the grid -- in the search input it types a literal space.
      event.preventDefault();
      const item = items[this.activeIndex];
      if (item) this.pick(item);
      return;
    } else {
      return;
    }
    event.preventDefault();
    this.setActiveIndex(target, !inSearch);
  };

  // Keeps the active option in lockstep with real focus, so Enter/Space always activates the
  // focused button -- focus can land on any option without passing through the arrow-key path
  // (Shift+Tab back into the grid, a consumer's own `focus()` call).
  private onGridFocusIn = (event: FocusEvent): void => {
    const button = event.target;
    if (!(button instanceof HTMLButtonElement)) return;
    const indexed = Number(button.dataset.index);
    const index = Number.isInteger(indexed) ? indexed : this.optionButtons().indexOf(button);
    if (index >= 0 && index !== this.activeIndex) this.setActiveIndex(index, false);
  };

  private onGridScroll = (event: Event): void => {
    if (!this.isVirtualized) return;
    const grid = event.currentTarget as HTMLElement;
    this.virtualScrollTop = grid.scrollTop;
    if (this.virtualScrollRaf !== undefined) return;
    this.virtualScrollRaf = requestAnimationFrame(() => {
      this.virtualScrollRaf = undefined;
      if (this.isConnected) this.requestUpdate();
    });
  };

  private syncGridObserver(): void {
    const grid = this.renderRoot.querySelector<HTMLElement>('[part="grid"]');
    const virtualized = this.isVirtualized;
    if (grid === this.observedGrid && virtualized === this.observedGridVirtualized) return;
    this.observedGrid?.removeEventListener('scroll', this.onGridScroll);
    this.gridResizeObserver?.disconnect();
    this.observedGrid = grid ?? undefined;
    this.observedGridVirtualized = virtualized;
    if (!grid || !virtualized) return;
    grid.addEventListener('scroll', this.onGridScroll, { passive: true });
    this.gridResizeObserver = new ResizeObserver(() => this.requestUpdate());
    this.gridResizeObserver.observe(grid);
  }

  protected updated(changed: PropertyValues): void {
    this.syncGridObserver();
    if (!changed.has('queryText') && !changed.has('groups')) return;
    const buttons = this.optionButtons();
    if (buttons.length === 0) {
      // No options: the combobox must not reference a nonexistent descendant.
      this.searchEl?.removeAttribute('aria-activedescendant');
      return;
    }
    if (!this.isVirtualized && this.activeIndex >= buttons.length) this.activeIndex = 0;
    // The grid just re-rendered: re-assert the active option's imperative state (tabindex,
    // aria-selected, aria-activedescendant) against the fresh DOM and keep it scrolled into view.
    this.setActiveIndex(this.activeIndex, false);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observedGrid?.removeEventListener('scroll', this.onGridScroll);
    this.gridResizeObserver?.disconnect();
    this.gridResizeObserver = undefined;
    this.observedGrid = undefined;
    this.observedGridVirtualized = false;
    if (this.virtualScrollRaf !== undefined) {
      cancelAnimationFrame(this.virtualScrollRaf);
      this.virtualScrollRaf = undefined;
    }
  }

  private renderEmojiButton(item: EmojiPickerItem, itemIndex: number, total: number): TemplateResult {
    return html`<button
      type="button"
      part="emoji"
      id=${`${this.gridId}-item-${itemIndex}`}
      data-index=${itemIndex}
      role="option"
      tabindex=${live(itemIndex === this.activeIndex ? '0' : '-1')}
      aria-selected=${live(itemIndex === this.activeIndex ? 'true' : 'false')}
      aria-setsize=${total}
      aria-posinset=${itemIndex + 1}
      aria-label=${item.name}
      ?data-active=${live(itemIndex === this.activeIndex)}
      @click=${() => this.pick(item)}
      @focusin=${this.onGridFocusIn}
      @mouseenter=${() => this.setActiveIndex(itemIndex, false)}
    >${item.emoji}</button>`;
  }

  private renderVirtualRows(): TemplateResult {
    const rows = this.virtualRows();
    const rowHeight = this.virtualRowHeight();
    const grid = this.renderRoot.querySelector<HTMLElement>('[part="grid"]');
    const viewportHeight = grid?.clientHeight || 256;
    const start = Math.max(0, Math.floor(this.virtualScrollTop / rowHeight) - 3);
    const end = Math.min(rows.length, Math.ceil((this.virtualScrollTop + viewportHeight) / rowHeight) + 3);
    const total = this.flatItems.length;
    return html`
      <div part="virtual-spacer" style=${`block-size: ${rows.length * rowHeight}px`}>
        ${rows.slice(start, end).map(
          (row, offset) => html`
            <div part="virtual-row" style=${`transform: translateY(${(start + offset) * rowHeight}px)`}>
              ${row.label ? html`<div part="group-label">${row.label}</div>` : html`<div part="virtual-label" aria-hidden="true"></div>`}
              <div part="virtual-items">
                ${row.items.map(({ item, index }) => this.renderEmojiButton(item, index, total))}
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  render(): TemplateResult {
    const items = this.flatItems;
    let index = -1;
    return html`
      <div part="base">
        <input
          part="search"
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          .value=${this.queryText}
          aria-label=${this.localize('emojiPickerSearchLabel')}
          aria-controls=${this.gridId}
          @input=${this.onSearchInput}
          @keydown=${this.onNavigationKeyDown}
        />
        <div
          part="grid"
          id=${this.gridId}
          role="listbox"
          aria-label=${this.accessibleLabel || this.localize('emojiPickerGridLabel')}
          @keydown=${this.onNavigationKeyDown}
          @focusin=${this.onGridFocusIn}
        >
          ${items.length === 0
            ? html`<div part="empty">${this.localize('emojiPickerEmpty')}</div>`
            : this.isVirtualized
              ? this.renderVirtualRows()
              : this.filteredGroups.map(
                (group) => html`
                  <div part="group-label">${group.label}</div>
                  ${group.emojis.map((item) => {
                    index++;
                    return this.renderEmojiButton(item, index, items.length);
                  })}
                `,
              )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-emoji-picker': LyraEmojiPicker;
  }
}
