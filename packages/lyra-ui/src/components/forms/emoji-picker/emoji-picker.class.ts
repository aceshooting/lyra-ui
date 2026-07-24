import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { FormAssociated } from '../../../internal/form-associated.js';
import { nextId } from '../../../internal/a11y.js';
import { styles } from './emoji-picker.styles.js';
import { loadEmojiDataCached } from './emoji-data-loader.js';
// Data types live in ./emoji-types.js (extracted to break a type-only import cycle with
// emoji-data-loader.ts); re-exported so `export *` from emoji-picker.js keeps the public paths.
import type { EmojiPickerItem, EmojiPickerGroup } from './emoji-types.js';
export type { EmojiPickerItem, EmojiPickerGroup };

const VIRTUALIZE_AT = 200;
// Only used while the probe boxes have no used size to read (the element is not laid out at all --
// `display: none`, a detached render). They mirror the shipped token defaults at a 16px root font
// size: 2.5rem, 0.125rem, and 2.5rem + 1rem.
const ITEM_SIZE_FALLBACK = 40;
const GAP_FALLBACK = 2;
const VIRTUAL_ROW_HEIGHT_FALLBACK = 56;
const MAX_VIRTUAL_COLUMNS = 20;

interface VirtualEmojiRow {
  label?: string;
  items: Array<{ item: EmojiPickerItem; index: number }>;
}

/** Pixel geometry of the windowed layout, resolved from the three geometry custom properties. */
interface EmojiPickerGeometry {
  itemSize: number;
  gap: number;
  rowHeight: number;
}

/** One probe box's used inline size in CSS pixels, or `fallback` when it has no usable box yet. */
function probePixels(probe: HTMLElement, fallback: number, allowZero = false): number {
  // The *used* value (post-layout, minimum-clamped) rather than `getBoundingClientRect()` on
  // purpose: `inline-size`'s resolved value is in untransformed CSS pixels, the same space as the
  // `clientWidth`/`scrollTop` numbers this geometry is combined with. A rect is in transformed
  // viewport space, so a scaled ancestor would rescale the column count and row pitch relative to
  // the scroller they drive.
  const px = Number.parseFloat(getComputedStyle(probe).inlineSize);
  if (!Number.isFinite(px) || px < 0) return fallback;
  return px > 0 || allowZero ? px : fallback;
}

export type LyraEmojiPickerSize = '2xs' | 'xs' | 's' | 'm' | 'l' | 'xl';

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
 * Ships the same opt-in `label`/`hint`/`errorText` form-control chrome as `<lr-select>`/
 * `<lr-color-picker>` (props + matching named slots + `form-control`/`form-control-label`/`hint`/
 * `error` parts) — left unset, the chrome stays hidden. When `label` (or the `label` slot) is set
 * and `aria-label`/`accessibleLabel` is not, the grid's accessible name switches from the
 * localized default to `aria-labelledby` pointing at the visible label, mirroring
 * `<lr-checkbox-group>`'s identical `accessibleLabel`-wins-over-`aria-labelledby` precedence.
 *
 * `disabled` (from the `FormAssociated` mixin) gates every self-rendered interactive
 * sub-control — the search input and every emoji button — not just one of them.
 *
 * @customElement lr-emoji-picker
 * @event input - Native-style composed event emitted after a user picks an emoji.
 * @event change - Native-style composed commit event emitted with `input`.
 * @event lr-change - An emoji was picked. `detail: { emoji: string }`.
 * @event blur - Re-dispatched from the internal search `<input>`'s own `blur` — bubbling and
 *   composed (unlike the native event, which is neither).
 * @event focus - Re-dispatched from the internal search `<input>`'s own `focus`, for the same
 *   reason as `blur`.
 * @slot label - Custom label content.
 * @slot hint - Custom hint content.
 * @slot error - Custom error content.
 * @csspart form-control - The outer wrapper around label, base, error and hint.
 * @csspart form-control-label - The visible label.
 * @csspart base - The wrapper around the search input and grid.
 * @csspart search - The search/filter `<input>` (`role="combobox"` over the grid).
 * @csspart grid - The keyboard-navigable emoji grid.
 * @csspart group-label - Each group's heading, rendered above its emojis.
 * @csspart emoji - Each emoji's own `<button>`; its box and glyph both scale with the `size`
 *   property (`--lr-emoji-picker-item-size`/`-glyph-size`), with the hit area floored at a flat
 *   24px (WCAG 2.5.8) rather than the shared `--lr-icon-button-size`.
 * @csspart empty - The empty-state message, shown when the search matches nothing.
 * @csspart virtual-spacer - The full-height scroll spacer that gives the grid its scrollbar while
 *   only the visible rows exist in the DOM. Rendered on the windowed path only.
 * @csspart virtual-row - One windowed row, absolutely positioned at the `--lr-emoji-picker-row-height`
 *   pitch. Rendered on the windowed path only.
 * @csspart virtual-label - The `aria-hidden` placeholder that reserves a row's group-label band when
 *   that row has no label, keeping every row the same height. Rendered on the windowed path only.
 * @csspart virtual-items - The flex row holding one windowed row's emoji buttons.
 * @csspart hint - The hint message.
 * @csspart error - The error message.
 * @cssprop [--lr-emoji-picker-item-size=var(--lr-icon-button-size)] - Each emoji button's box.
 *   Floored at 24px; the small size tiers can stay denser than the shared 40px icon-button size.
 * @cssprop [--lr-emoji-picker-glyph-size=var(--lr-font-size-lg)] - Font size of the emoji glyph,
 *   scaled by the `size` property to keep the glyph proportional to the item box.
 * @cssprop [--lr-emoji-picker-gap=var(--lr-space-2xs)] - Gap between emoji within a windowed row.
 * @cssprop [--lr-emoji-picker-control-gap=var(--lr-space-xs)] - Gap between field sections.
 * @cssprop [--lr-emoji-picker-radius=var(--lr-radius)] - Outer picker corner radius.
 * @cssprop [--lr-emoji-picker-item-radius=var(--lr-radius-xs)] - Search and emoji corner radius.
 * @cssprop [--lr-emoji-picker-search-hover-border-color=var(--lr-color-brand)] - Search hover border.
 * @cssprop [--lr-emoji-picker-row-height=calc(var(--lr-emoji-picker-item-size) + var(--lr-space-l))] -
 *   One windowed row's height. Must stay at or above the item size plus the group-label band, or
 *   consecutive absolutely-positioned rows overlap.
 * @cssprop [--lr-emoji-picker-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   keyboard-active (`data-active`) **and** hovered emoji button — the two share a single rule, so
 *   this one hook retints both consistently. Declared as an inline `var()` fallback (never on
 *   `:host`), so setting it on the element or an ancestor recolors only the emoji highlight without
 *   hijacking the library-wide `--lr-color-brand-quiet` token.
 */
export class LyraEmojiPicker extends FormAssociated(EmojiPickerBase) {
  static override styles = [LyraElement.styles, styles];

  /** The full, ungrouped data set to search/render. Consumer-supplied — this component ships no
   *  emoji data of its own. Empty (the default) renders no groups/emojis at all, just the search
   *  input and an empty state. See `emoji-data-loader.ts` for an optional convenience loader. */
  @property({ attribute: false }) groups: EmojiPickerGroup[] = [];

  /** Accessible name forwarded from the host to the internal emoji listbox. Empty falls back to
   *  the localized default grid label. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** Visual size — scales the emoji grid item box proportionally, floored at 24px
   *  (WCAG 2.5.8); not pixel-matched to `lr-input`'s row-height scale. */
  @property({ reflect: true }) size: LyraEmojiPickerSize = 'm';

  /** Visible label content, rendered above the search/grid. Empty (the default) renders no label
   *  chrome at all -- see the class doc above for the full label/hint/error contract. */
  @property() label = '';
  /** Supporting text rendered below the search/grid. */
  @property() hint = '';
  /** Validation-error text rendered below the hint. */
  @property({ attribute: 'error-text' }) errorText = '';

  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  // Set on the search input's first native `blur`; gates the `aria-invalid` reflection below so
  // validity styling never flashes on first render -- mirrors `<lr-select>`'s identical `touched`.
  @state() private touched = false;

  private readonly labelId = nextId('emoji-picker-label');
  private readonly hintId = nextId('emoji-picker-hint');
  private readonly errorId = nextId('emoji-picker-error');

  /** Injectable loader seam -- overridden directly by tests with a synchronous fake instead of
   *  needing the real `emoji-picker-element-data` package to load in the test browser (mirrors
   *  `LyraPdfViewer`'s `loadLibrary` field / `LyraQrCode`'s `loadLibrary` field). */
  private loadGroups: () => Promise<EmojiPickerGroup[] | null> = loadEmojiDataCached;

  override connectedCallback(): void {
    super.connectedCallback();
    // Re-arms the geometry sensor after a reconnect; the cache is deliberately kept across the
    // disconnect, so the first delivery here still re-renders if the tokens moved while detached.
    this.observeGeometryProbe();
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
  private geometryProbe?: { root: HTMLElement; item: HTMLElement; gap: HTMLElement; row: HTMLElement };
  private geometryCache?: EmojiPickerGeometry;
  private geometryObserver?: ResizeObserver;

  @query('[part="search"]') private searchEl?: HTMLInputElement;

  private readonly gridId = nextId('emoji-picker-grid');

  // Lowercased search haystack per item, computed once per item object -- re-joining and
  // re-lowercasing every item on every keystroke dominates filter cost for large sets. Keyed by
  // item identity in a WeakMap, so replacing `groups` invalidates naturally (stale entries are
  // simply collected).
  private readonly haystacks = new WeakMap<
    EmojiPickerItem,
    { locale: string; value: string }
  >();

  private haystackFor(item: EmojiPickerItem): string {
    const locale = this.effectiveLocale;
    let cached = this.haystacks.get(item);
    if (cached === undefined || cached.locale !== locale) {
      cached = {
        locale,
        value: [item.name, ...(item.shortcodes ?? [])].join(' ').toLocaleLowerCase(locale),
      };
      this.haystacks.set(item, cached);
    }
    return cached.value;
  }

  private get filteredGroups(): EmojiPickerGroup[] {
    const q = this.queryText.trim().toLocaleLowerCase(this.effectiveLocale);
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

  /**
   * The windowed layout's pixel geometry. `getComputedStyle(host).getPropertyValue('--x')` hands
   * back a custom property's *computed token stream* (`2.5rem`, `calc(2.5rem + 1rem)`) and never a
   * pixel length, so parsing it reads a `rem` value's leading number as pixels and cannot read a
   * `calc()` at all. Measuring the probe boxes the stylesheet sizes from those same tokens makes
   * the browser do the unit math instead, for every unit `calc()` included.
   *
   * Measured at most once per geometry change, not per frame: the result is cached, and the probe
   * boxes themselves are the invalidation signal (see `observeGeometryProbe`).
   */
  private geometry(): EmojiPickerGeometry {
    if (this.geometryCache) return this.geometryCache;
    const probe = this.geometryProbe;
    if (!probe) {
      return { itemSize: ITEM_SIZE_FALLBACK, gap: GAP_FALLBACK, rowHeight: VIRTUAL_ROW_HEIGHT_FALLBACK };
    }
    // A zero gap is a legitimate value; a zero item size or row height is not (it would divide the
    // scroll offset by zero), so those fall back instead.
    this.geometryCache = {
      itemSize: probePixels(probe.item, ITEM_SIZE_FALLBACK),
      gap: probePixels(probe.gap, GAP_FALLBACK, true),
      rowHeight: probePixels(probe.row, VIRTUAL_ROW_HEIGHT_FALLBACK),
    };
    return this.geometryCache;
  }

  /** Creates the measurement probe the first time the windowed path needs it. Runs before
   *  `render()` so the very first windowed render already measures real pixels. */
  private syncGeometryProbe(): void {
    if (this.geometryProbe || !this.isVirtualized) return;
    const makeProbe = (name: string): HTMLDivElement => {
      const probe = document.createElement('div');
      probe.dataset['probe'] = name;
      return probe;
    };
    const root = makeProbe('root');
    root.setAttribute('aria-hidden', 'true');
    const item = makeProbe('item');
    const gap = makeProbe('gap');
    const row = makeProbe('row');
    root.append(item, gap, row);
    this.renderRoot.append(root);
    this.geometryProbe = { root, item, gap, row };
    this.observeGeometryProbe();
  }

  /** The probe boxes double as the change sensor: anything that can move the geometry -- a token
   *  override applied after the first render, a theme swap, a root/host font-size change feeding a
   *  `rem`/`em` value -- resizes them, so the cached pixels are re-derived exactly when they can
   *  actually differ, with no per-frame reads. */
  private observeGeometryProbe(): void {
    const probe = this.geometryProbe;
    if (!probe) return;
    this.geometryObserver ??= new ResizeObserver(this.onGeometryResize);
    this.geometryObserver.observe(probe.item);
    this.geometryObserver.observe(probe.gap);
    this.geometryObserver.observe(probe.row);
  }

  private onGeometryResize = (): void => {
    const previous = this.geometryCache;
    this.geometryCache = undefined;
    if (!previous) return; // nothing has been rendered against the stale numbers yet
    const next = this.geometry();
    if (next.itemSize === previous.itemSize && next.gap === previous.gap && next.rowHeight === previous.rowHeight) {
      return;
    }
    this.requestUpdate();
  };

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
      const { itemSize, gap } = this.geometry();
      return Math.min(MAX_VIRTUAL_COLUMNS, Math.max(1, Math.floor((Math.max(width, itemSize) + gap) / (itemSize + gap))));
    }
    const buttons = this.optionButtons();
    if (buttons.length === 0) return 1;
    const firstTop = buttons[0]!.offsetTop; // safe: length === 0 returned above
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
        grid.scrollTop = rowIndex * this.geometry().rowHeight;
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

  // Native focus/blur neither bubble nor cross the shadow boundary, so a host-level @focus/@blur
  // listener on <lr-emoji-picker> would never fire without this bridge -- mirrors
  // <lr-input>'s/<lr-select>'s identical onFocus/onBlur pair.
  private onSearchFocus = (): void => {
    this.emit('focus');
  };

  private onSearchBlur = (): void => {
    this.touched = true;
    this.emit('blur');
  };

  private onLabelSlotChange = (event: Event): void => {
    this.hasLabelSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onHintSlotChange = (event: Event): void => {
    this.hasHintSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private onErrorSlotChange = (event: Event): void => {
    this.hasErrorSlot = (event.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private pick(item: EmojiPickerItem): void {
    if (this.effectiveDisabled) return;
    this.value = item.emoji;
    this.emit('input');
    this.emit('change');
    this.emit('lr-change', { emoji: item.emoji });
  }

  // Shared between the search input (combobox idiom: focus stays in the input while
  // `aria-activedescendant` tracks the active option) and the grid itself (roving tabindex: focus
  // follows the active option).
  private onNavigationKeyDown = (event: KeyboardEvent): void => {
    if (this.effectiveDisabled) return;
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
    const indexed = Number(button.dataset['index']);
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

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.syncGeometryProbe();
    if (!this.hasUpdated) {
      this.hasLabelSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'label');
      this.hasHintSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'hint');
      this.hasErrorSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'error');
    }
  }

  protected override updated(changed: PropertyValues): void {
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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observedGrid?.removeEventListener('scroll', this.onGridScroll);
    this.gridResizeObserver?.disconnect();
    this.gridResizeObserver = undefined;
    // The probe node itself stays in the shadow root (it is re-observed on reconnect); only the
    // observer is torn down, so nothing keeps measuring while detached.
    this.geometryObserver?.disconnect();
    this.geometryObserver = undefined;
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
      ?disabled=${this.effectiveDisabled}
      @click=${() => this.pick(item)}
      @focusin=${this.onGridFocusIn}
      @mouseenter=${() => this.setActiveIndex(itemIndex, false)}
    >${item.emoji}</button>`;
  }

  private renderVirtualRows(): TemplateResult {
    const rows = this.virtualRows();
    const rowHeight = this.geometry().rowHeight;
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

  override render(): TemplateResult {
    const items = this.flatItems;
    let index = -1;
    const hasLabel = this.hasLabelSlot || this.label.length > 0;
    const hasHint = this.hasHintSlot || this.hint.length > 0;
    const hasError = this.hasErrorSlot || this.errorText.length > 0;
    const describedBy = [hasError ? this.errorId : '', hasHint ? this.hintId : ''].filter(Boolean).join(' ');
    const invalid = this.touched && !this.internals.validity.valid;
    return html`
      <div part="form-control">
        <div part="form-control-label" id=${this.labelId} ?hidden=${!hasLabel}>
          ${this.label}<slot name="label" @slotchange=${this.onLabelSlotChange}></slot>
        </div>
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
            ?disabled=${this.effectiveDisabled}
            @input=${this.onSearchInput}
            @keydown=${this.onNavigationKeyDown}
            @focus=${this.onSearchFocus}
            @blur=${this.onSearchBlur}
          />
          <div
            part="grid"
            id=${this.gridId}
            role="listbox"
            aria-label=${this.accessibleLabel || (hasLabel ? nothing : this.localize('emojiPickerGridLabel'))}
            aria-labelledby=${!this.accessibleLabel && hasLabel ? this.labelId : nothing}
            aria-describedby=${describedBy || nothing}
            aria-required=${this.required ? 'true' : 'false'}
            aria-invalid=${invalid ? 'true' : 'false'}
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
        <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>
          ${this.hint}<slot name="hint" @slotchange=${this.onHintSlotChange}></slot>
        </div>
        <div part="error" id=${this.errorId} ?hidden=${!hasError}>
          ${this.errorText}<slot name="error" @slotchange=${this.onErrorSlotChange}></slot>
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
