import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { isRtl } from '../../../internal/rtl.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { styles } from './sequence-strip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_sequenceStripCategoryCount, LYRA_DEFAULT_sequenceStripEmpty, LYRA_DEFAULT_sequenceStripUnnamedCategory } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface SequenceStripItem {
  readonly id: string;
  readonly categoryId: string;
  /** A small marker rendered at the bottom of this cell — a secondary boolean annotation
   *  independent of the primary category color (e.g. a subagent-dispatched turn). */
  readonly marker?: boolean;
  /** Per-item text shown in the hover/focus tooltip and exposed as the item's accessible name
   *  (falls back to the category's own `label`, or the localized unnamed-category label). */
  readonly label?: string;
}

export interface SequenceStripCategory {
  readonly id: string;
  /** A CSS color. Invalid values and `url()` paint servers render transparently. */
  readonly color: string;
  /** Human-readable name used in the auto-generated `aria-label` summary and as the hover-tooltip
   *  fallback text for items with no `label` of their own. An omitted or blank label uses the
   *  localized unnamed-category label rather than exposing an internal id. */
  readonly label?: string;
}

/** A bounded DOM window keeps high-cardinality strips responsive while the bounded canonical item
 * model remains available to roving keyboard navigation and `aria-setsize`. */
const MAX_RENDERED_ITEMS = 200;
const MAX_RENDERED_CATEGORIES = 200;
const MAX_SEQUENCE_COLLECTION_ENTRIES = 10_000;

/** Detail of `lr-item-activate`: which strip item the user picked. */
export interface LyraSequenceStripActivateDetail {
  readonly index: number;
  readonly id: string;
  readonly item: SequenceStripItem;
}

export interface LyraSequenceStripEventMap {
  'lr-item-activate': CustomEvent<LyraSequenceStripActivateDetail>;
}

/**
 * `<lr-sequence-strip>` — a compact, one-thin-cell-per-item strip visualizing a sequence of
 * categorical states, with an optional secondary per-cell marker. Pure CSS/flex, no chart.js/SVG/
 * canvas — sized/named consistently with the sparkline/heatmap family, but a glanceable aggregate
 * visualization. The strip is a labeled `role="list"` and each cell is a named list item.
 * Exactly one cell is tabbable; Left/Right and Home/End rove through the items and show the same
 * detail tooltip as pointer hover. Clicking a cell, or pressing Enter/Space on the roving cell,
 * emits the controlled `lr-item-activate` event without moving selection. A host `aria-label`
 * names the host itself without being duplicated on the internal list; `accessible-label` names
 * that list, otherwise its category summary does.
 * A category whose label is omitted or blank uses the localized unnamed-category label for
 * affected list-item names and tooltips, its summary clause, and its legend row.
 * Controlled item refreshes preserve the focused
 * item by id, clamp to the nearest survivor, and focus the stable list when the strip becomes empty.
 * A queued arrow/Home/End focus is generation- and identity-bound: replacing `items`, disconnecting,
 * or reconnecting before that update settles cannot focus the same numeric index in a new model.
 * At most 200 items around the roving stop are mounted at once; before focus enters, a valid
 * controlled `selectedIndex` anchors that stop/window so its `aria-current` cell is present.
 * `aria-posinset`/`aria-setsize` retain positions in the bounded canonical sequence and navigation
 * shifts the window. Assignment
 * retains at most the first 10,000 items and categories as detached frozen snapshots; reassign a
 * collection after changing it.
 *
 * @customElement lr-sequence-strip
 * @event lr-item-activate - Fired when a cell is clicked, or activated with Enter/Space on the
 *   roving-tabindex focus. `detail: { index, id, item }` identifies the picked item. Not
 *   cancelable, and it does not move `selectedIndex` on its own -- the selection is controlled,
 *   so the consumer stays the single source of truth for a playback index this strip does not own.
 * @csspart base - The root strip wrapper (`role="list"`).
 * @csspart cell - Each named, roving-focus item cell, background-colored by its category.
 * @csspart marker - The small bottom marker on a cell whose item sets `marker: true`.
 * @csspart tooltip - The hover/focus tooltip showing the active item's label, positioned from that
 * active cell.
 * @csspart legend - The static category key rendered below the strip when `showLegend` is set
 * (`aria-hidden` — it repeats the strip's own `aria-label` visually).
 * @csspart legend-item - One swatch + label pair in the legend, one per `categories` entry (plus one
 * trailing marker row when `markerLabel` is set).
 * @csspart legend-swatch - The color chip of a legend item, matching that category's cell color.
 * @csspart legend-marker-swatch - The chip of the `markerLabel` legend row: a neutral chip carrying
 * the same bottom bar a `marker: true` cell paints, in the same `--lr-sequence-strip-marker-color`.
 * @csspart legend-label - The text of a legend item (the category's `label`, or the localized
 * unnamed-category label).
 * @csspart window-range - Visible numeric range/total disclosure when item projection is windowed.
 * @csspart legend-limit - Visible rendered/total category count when the legend is bounded.
 * @cssprop [--lr-sequence-strip-height=var(--lr-size-1-5rem)] - Block size of the strip.
 * @cssprop [--lr-sequence-strip-marker-color=var(--lr-color-text)] - Color of the bottom marker on a `marker: true` cell, and of the marker legend row's bar.
 * @cssprop [--lr-sequence-strip-legend-swatch-size=var(--lr-size-0-625rem)] - Inline and block size of a legend swatch (category and marker rows alike).
 * @cssprop [--lr-sequence-strip-legend-marker-bg=var(--lr-color-surface-raised)] - Neutral chip background behind the marker legend row's bar; it stands in for "any cell", so it deliberately matches no category color.
 * @status stable
 * @since 4.0.0
 */
export class LyraSequenceStrip extends LyraElement<LyraSequenceStripEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    sequenceStripCategoryCount: LYRA_DEFAULT_sequenceStripCategoryCount,
    sequenceStripEmpty: LYRA_DEFAULT_sequenceStripEmpty,
    sequenceStripUnnamedCategory: LYRA_DEFAULT_sequenceStripUnnamedCategory,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  private _items: readonly SequenceStripItem[] = [];
  private _categories: readonly SequenceStripCategory[] = [];

  /** Frozen snapshot of at most the first 10,000 items. Empty/blank ids are omitted and duplicate
   * ids use the first entry. Reassign to update. */
  @property({ attribute: false })
  get items(): readonly SequenceStripItem[] { return this._items; }
  set items(value: readonly SequenceStripItem[]) {
    const previous = this._items;
    const seen = new Set<string>();
    const next: SequenceStripItem[] = [];
    if (Array.isArray(value)) {
      for (const item of value.slice(0, MAX_SEQUENCE_COLLECTION_ENTRIES)) {
        try {
          if (!item || typeof item.id !== 'string' || item.id.trim().length === 0 || seen.has(item.id)) continue;
          seen.add(item.id);
          next.push(Object.freeze({
            id: item.id,
            categoryId: typeof item.categoryId === 'string' ? item.categoryId : '',
            ...(item.marker === undefined ? {} : { marker: Boolean(item.marker) }),
            ...(typeof item.label === 'string' ? { label: item.label } : {}),
          }));
        } catch {
          // Retain later valid entries when an untyped record getter throws.
        }
      }
    }
    this._items = Object.freeze(next);
    this.requestUpdate('items', previous);
  }

  /** Frozen snapshot of at most the first 10,000 categories. Empty/blank ids are omitted and
   * duplicate ids use the first entry. Reassign to update. */
  @property({ attribute: false })
  get categories(): readonly SequenceStripCategory[] { return this._categories; }
  set categories(value: readonly SequenceStripCategory[]) {
    const previous = this._categories;
    const seen = new Set<string>();
    const next: SequenceStripCategory[] = [];
    if (Array.isArray(value)) {
      for (const category of value.slice(0, MAX_SEQUENCE_COLLECTION_ENTRIES)) {
        try {
          if (!category || typeof category.id !== 'string' || category.id.trim().length === 0 || seen.has(category.id)) continue;
          seen.add(category.id);
          next.push(Object.freeze({
            id: category.id,
            color: typeof category.color === 'string' ? category.color : '',
            ...(typeof category.label === 'string' ? { label: category.label } : {}),
          }));
        } catch {
          // Retain later valid entries when an untyped record getter throws.
        }
      }
    }
    this._categories = Object.freeze(next);
    this.requestUpdate('categories', previous);
  }
  /** Overrides the auto-generated `aria-label` (a per-category "label: count" summary). Unset
   *  computes the summary from `items`/`categories`; an explicitly empty string renders as an
   *  empty label rather than falling back to the auto-generated summary. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;

  /**
   * Index of the currently selected item, or `-1` (the default) for none — the controlled selection
   * this strip's natural companion, `lr-sequence-playback`, scrubs through. Mirrors the shape
   * `lr-lite-chart`'s `selectedIndices` and `lr-heatmap`'s `selectedCell` already establish.
   *
   * Controlled, not self-managing: activating a cell emits `lr-item-activate` and does **not**
   * move the selection on its own, so the consumer stays the single source of truth and the
   * component cannot drift from a playback index it does not own. Before focus enters, a valid
   * selection anchors the bounded render window and its sole keyboard entry stop; keyboard roving
   * remains authoritative after focus. An out-of-range or non-integer value selects nothing rather
   * than throwing.
   */
  // numeric-guard-exempt: isSelected() below rejects anything that is not an in-range integer
  // before this value is used, so a non-finite or fractional write selects nothing rather than
  // reaching layout, Intl, canvas or timer math.
  @property({ type: Number, attribute: 'selected-index' }) selectedIndex = -1;

  /** Whether `index` is the selected one, guarding a non-integer or out-of-range value. */
  private isSelected(index: number): boolean {
    return (
      Number.isInteger(this.selectedIndex) &&
      this.selectedIndex >= 0 &&
      this.selectedIndex < this.items.length &&
      this.selectedIndex === index
    );
  }

  /**
   * Emits `lr-item-activate` for `index`.
   *
   * Not cancelable: nothing in this component branches on `defaultPrevented`, and the library's
   * contract reserves cancelable events for real veto points.
   */
  private activateItem(index: number): void {
    const item = this.items[index];
    if (!item) return;
    this.emit('lr-item-activate', { index, id: item.id, item });
  }
  /** Renders a static `[part="legend"]` key of every `categories` entry below the strip, so the
   *  color-to-category mapping is readable without hovering each cell. Deliberately
   *  non-interactive: unlike `<lr-graph-legend>` this toggles nothing and emits nothing — the
   *  strip is a presentational aggregate, and the key describes the scheme, not the current data
   *  (a category with no matching item still gets a row). */
  @property({ type: Boolean, reflect: true, attribute: 'show-legend' }) showLegend = false;

  /** Names what a cell's `marker` means (e.g. `"Subagent"`). Set it to key the marker in the legend
   *  — with `showLegend` on it adds one trailing `[part="legend-item"]` whose swatch reproduces the
   *  cell's own marker treatment — and to have the marker counted in the auto-generated summary,
   *  which is otherwise per-category only. Unset (the default) nothing changes: no extra legend row
   *  and no extra summary clause. */
  @property({ attribute: 'marker-label' }) markerLabel?: string;

  /** The item index currently under the pointer (`null` when not hovering any cell). */
  @state() private hoverIndex: number | null = null;
  /** The roving keyboard-focus index (`null` while focus is outside the strip). */
  @state() private keyboardIndex: number | null = null;
  private pendingFocusTarget: number | 'base' | undefined;
  private restoringOwnedFocus = false;
  private focusRestoreGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('items')) {
      this.focusRestoreGeneration++;
      this.hoverIndex = null;
      const focusedCell = this.shadowRoot?.activeElement as HTMLElement | null;
      const focusedIndex = Number(focusedCell?.dataset['index']);
      if (!Number.isInteger(focusedIndex) || focusedIndex < 0) {
        this.keyboardIndex = null;
        return;
      }
      const previousItems = (changed.get('items') as readonly SequenceStripItem[] | undefined) ?? [];
      const focusedId = previousItems[focusedIndex]?.id;
      const retainedIndex = focusedId == null ? -1 : this.items.findIndex((item) => item.id === focusedId);
      const nextIndex = retainedIndex >= 0
        ? retainedIndex
        : this.items.length
          ? Math.min(focusedIndex, this.items.length - 1)
          : -1;
      this.keyboardIndex = nextIndex >= 0 ? nextIndex : null;
      this.pendingFocusTarget = nextIndex >= 0 ? nextIndex : 'base';
      this.restoringOwnedFocus = true;
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingFocusTarget;
    if (pending === undefined) return;
    this.pendingFocusTarget = undefined;
    const generation = this.focusRestoreGeneration;
    this.scheduleAfterUpdate(() => {
      try {
        if (generation !== this.focusRestoreGeneration || !this.isConnected) return;
        if (pending === 'base') {
          this.shadowRoot?.querySelector<HTMLElement>('[part="base"]')?.focus();
          return;
        }
        this.shadowRoot?.querySelector<HTMLElement>(`[part="cell"][data-index="${pending}"]`)?.focus();
      } finally {
        this.restoringOwnedFocus = false;
      }
    }, 'sequence-strip-focus');
  }

  override disconnectedCallback(): void {
    this.focusRestoreGeneration++;
    this.pendingFocusTarget = undefined;
    this.restoringOwnedFocus = false;
    this.hoverIndex = null;
    this.keyboardIndex = null;
    super.disconnectedCallback();
  }

  private categoryMap(): ReadonlyMap<string, SequenceStripCategory> {
    return new Map(this.categories.map((category) => [category.id, category]));
  }

  private categoryColor(categoryId: string, categories: ReadonlyMap<string, SequenceStripCategory>): string {
    return sanitizeCssColor(categories.get(categoryId)?.color) ?? 'transparent';
  }

  private categoryLabel(
    categoryId: string,
    categories: ReadonlyMap<string, SequenceStripCategory>,
  ): string {
    const label = categories.get(categoryId)?.label;
    return label !== undefined && label.trim().length > 0
      ? label
      : this.localize('sequenceStripUnnamedCategory');
  }

  private autoSummary(): string {
    const counts = new Map<string, number>();
    const categories = this.categoryMap();
    for (const item of this.items) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    if (counts.size === 0) return this.localize('sequenceStripEmpty');
    const clauses = [...counts.entries()].map(([categoryId, count]) => {
      const label = this.categoryLabel(categoryId, categories);
      return this.localize('sequenceStripCategoryCount', undefined, {
        label,
        count: getNumberFormat(this.effectiveLocale).format(count),
        pluralCount: count,
      });
    });
    // The marker is a second, independent axis, so it gets its own trailing clause rather than
    // folding into any category's count -- and only once `markerLabel` names it, since the summary
    // has no other word for it. Counted like a category: only a non-zero count is announced (a
    // zero-count category is likewise absent from the summary while still keying the legend), and
    // the same '{label}: {count}' string is reused so it translates through one key.
    const markerCount = this.items.filter((item) => item.marker).length;
    if (this.markerLabel && markerCount > 0) {
      clauses.push(this.localize('sequenceStripCategoryCount', undefined, {
        label: this.markerLabel,
        count: getNumberFormat(this.effectiveLocale).format(markerCount),
        pluralCount: markerCount,
      }));
    }
    return getListFormat(this.effectiveLocale, { style: 'long', type: 'unit' }).format(clauses);
  }

  private itemLabel(item: SequenceStripItem, categories = this.categoryMap()): string {
    if (item.label !== undefined && item.label.trim().length > 0) return item.label;
    return this.categoryLabel(item.categoryId, categories);
  }

  private onCellEnter(index: number): void {
    this.hoverIndex = index;
  }

  private onCellLeave(): void {
    this.hoverIndex = null;
  }

  private onCellFocus(index: number): void {
    if (!this.restoringOwnedFocus) this.keyboardIndex = index;
  }

  private onStripFocusOut(e: FocusEvent): void {
    if (this.restoringOwnedFocus) return;
    const next = e.relatedTarget;
    if (!(next instanceof Element) || next.getAttribute('part') !== 'cell') this.keyboardIndex = null;
  }

  private onCellKeyDown(e: KeyboardEvent, index: number): void {
    // A focused cell has to be activatable from the keyboard, not only the pointer -- the cells
    // already carry a roving tabindex, so without this they were reachable but inert.
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      this.activateItem(index);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || this.items.length === 0) return;
    e.preventDefault();
    const forwardKey = isRtl(this) ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = isRtl(this) ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = this.items.length - 1;
    else if (e.key === forwardKey) next = Math.min(this.items.length - 1, index + 1);
    else if (e.key === backwardKey) next = Math.max(0, index - 1);
    const items = this.items;
    const targetId = items[next]?.id;
    if (targetId === undefined) return;
    const generation = this.focusRestoreGeneration;
    this.keyboardIndex = next;
    void this.updateComplete.then(() => {
      if (
        generation !== this.focusRestoreGeneration ||
        !this.isConnected ||
        this.items !== items
      ) {
        return;
      }
      const target = this.shadowRoot?.querySelector<HTMLElement>(`[part="cell"][data-index="${next}"]`);
      if (target?.dataset['itemId'] === targetId) target.focus();
    });
  }

  /** The legend repeats, in visible form, the category names already exposed by the named
   *  `role="list"` summary and its individually named `role="listitem"` cells. Exposing the key to
   *  assistive technology as well would read the same scheme twice, so the whole subtree is
   *  `aria-hidden` — it is a decorative duplicate rendered outside the list, and hiding it removes
   *  nothing from the inspectable sequence. */
  private renderLegend(): TemplateResult {
    const renderedCategories = this.categories.slice(0, MAX_RENDERED_CATEGORIES);
    const categoryMap = this.categoryMap();
    const number = getNumberFormat(this.effectiveLocale);
    return html`
      <div part="legend" aria-hidden="true">
        ${renderedCategories.map(
          (category) => html`
            <span part="legend-item">
              <span
                part="legend-swatch"
                style=${styleMap({ backgroundColor: sanitizeCssColor(category.color) ?? 'transparent' })}
              ></span>
              <span part="legend-label">${this.categoryLabel(category.id, categoryMap)}</span>
            </span>
          `,
        )}
        ${this.markerLabel
          ? html`
              <span part="legend-item">
                <span part="legend-marker-swatch"></span>
                <span part="legend-label">${this.markerLabel}</span>
              </span>
            `
          : nothing}
        ${this.categories.length > renderedCategories.length
          ? html`<span part="legend-limit">${number.format(renderedCategories.length)} / ${number.format(this.categories.length)}</span>`
          : nothing}
      </div>
    `;
  }

  override render(): TemplateResult {
    const categoryMap = this.categoryMap();
    const ariaLabel = this.accessibleLabel == null ? this.autoSummary() : this.accessibleLabel;
    const activeIndex = this.hoverIndex ?? this.keyboardIndex;
    const active = activeIndex !== null ? this.items[activeIndex] : undefined;
    const selectedIndex =
      Number.isInteger(this.selectedIndex) &&
      this.selectedIndex >= 0 &&
      this.selectedIndex < this.items.length
        ? this.selectedIndex
        : null;
    const tabStop = this.keyboardIndex ?? selectedIndex ?? 0;
    const tooltipIndex = activeIndex ?? tabStop;
    const maxStart = Math.max(0, this.items.length - MAX_RENDERED_ITEMS);
    const windowStart = Math.min(maxStart, Math.max(0, tabStop - Math.floor(MAX_RENDERED_ITEMS / 2)));
    const renderedItems = this.items.slice(windowStart, windowStart + MAX_RENDERED_ITEMS);
    const number = getNumberFormat(this.effectiveLocale);
    return html`
      <div
        part="base"
        role="list"
        aria-label=${ariaLabel}
        tabindex="-1"
        ?data-dense=${renderedItems.length >= MAX_RENDERED_ITEMS}
        @focusout=${this.onStripFocusOut}
      >
        ${renderedItems.map(
          (item, localIndex) => {
            const index = windowStart + localIndex;
            return html`
            <span
              part="cell"
              data-item-id=${item.id}
              data-index=${index}
              role="listitem"
              aria-label=${this.itemLabel(item, categoryMap)}
              aria-posinset=${index + 1}
              aria-setsize=${this.items.length}
              tabindex=${index === tabStop ? '0' : '-1'}
              style=${styleMap({ backgroundColor: this.categoryColor(item.categoryId, categoryMap) })}
              @pointerenter=${() => this.onCellEnter(index)}
              @pointerleave=${() => this.onCellLeave()}
              @focus=${() => this.onCellFocus(index)}
              @keydown=${(e: KeyboardEvent) => this.onCellKeyDown(e, index)}
              @click=${() => this.activateItem(index)}
              aria-current=${this.isSelected(index) ? 'true' : 'false'}
              ?data-selected=${this.isSelected(index)}
            >
              ${item.marker ? html`<span part="marker"></span>` : nothing}
              ${index === tooltipIndex
                ? html`
                    <span id="sequence-strip-tooltip" part="tooltip" ?hidden=${!active}>
                      ${active ? this.itemLabel(active, categoryMap) : ''}
                    </span>
                  `
                : nothing}
            </span>`;
          },
        )}
      </div>
      ${this.items.length > renderedItems.length
        ? html`<div part="window-range" aria-hidden="true">${number.format(windowStart + 1)}–${number.format(windowStart + renderedItems.length)} / ${number.format(this.items.length)}</div>`
        : nothing}
      ${this.showLegend ? this.renderLegend() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sequence-strip': LyraSequenceStrip;
  }
}
