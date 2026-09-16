import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getListFormat, getNumberFormat } from '../../../internal/intl-cache.js';
import { isRtl } from '../../../internal/rtl.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { finiteCount, finiteInteger } from '../../../internal/numbers.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { styles } from './sequence-strip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_sequenceStripBucketLabel, LYRA_DEFAULT_sequenceStripBucketSummary, LYRA_DEFAULT_sequenceStripCategoryCount, LYRA_DEFAULT_sequenceStripEmpty, LYRA_DEFAULT_sequenceStripUnnamedCategory } from '../../../internal/default-strings.generated.js';
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
  /**
   * Marks this item non-actionable: `aria-disabled="true"` replaces the selected/active
   * affordances of the cell that represents it, activating it (click, or Enter/Space while
   * roving-focused) emits nothing, and roving keyboard navigation (arrow keys, Home/End) steps
   * past it instead of landing on it. Above `MAX_RENDERED_CELLS`, one cell paints a whole RANGE of
   * items and activating it always resolves to that range's first item (`cell.start`, see
   * `activateCell()`), so a range cell's disabled state follows that same first item. Omitted or
   * `false` renders the item exactly as before this field existed.
   */
  readonly disabled?: boolean;
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

/** A bounded cell count keeps high-cardinality strips responsive. Past it the strip does NOT drop
 * the surplus: it distributes every retained item over exactly this many cells, so the rendered
 * width always spans the whole sequence. */
const MAX_RENDERED_CELLS = 200;
const MAX_RENDERED_CATEGORIES = 200;
const MAX_SEQUENCE_COLLECTION_ENTRIES = 10_000;

/**
 * One rendered strip cell. At or below `MAX_RENDERED_CELLS` a cell is exactly one item
 * (`start === end`). Past it a cell is a contiguous RANGE of items painted by that range's
 * dominant category — the strip keeps representing the full span at full width instead of
 * stretching a leading window across it, which is what the pre-16.0.0 projection did.
 */
interface SequenceStripCell {
  /** Index of this cell's first item in the canonical sequence. */
  readonly start: number;
  /** Index of this cell's last item, inclusive — equal to `start` for a one-item cell. */
  readonly end: number;
  /** The category painting the cell: the item's own, or the range's dominant one. */
  readonly categoryId: string;
  /** Whether ANY item in the range sets `marker` — the marker is a presence annotation, so a
   *  range that contains one still reports it rather than averaging it away. */
  readonly marker: boolean;
}

/**
 * First item index of bucket `cell` when `total` items are spread over `cellCount` cells.
 *
 * `ceil(cell * total / cellCount)` is the exact inverse of the `floor(item * cellCount / total)`
 * lookup in `cellIndexForItem()`, so the two can never disagree about which cell owns an item —
 * the `floor`/`floor` pairing an earlier draft used put items 495-497 in different cells depending
 * on which direction the question was asked from. Every bucket holds at least
 * `floor(total / cellCount) >= 1` items while `cellCount <= total`, so no cell is ever empty.
 */
function bucketStartIndex(cell: number, total: number, cellCount: number): number {
  return Math.ceil((cell * total) / cellCount);
}

/** Projects `items` into at most `MAX_RENDERED_CELLS` span-preserving cells. */
function buildSequenceStripCells(items: readonly SequenceStripItem[]): SequenceStripCell[] {
  const total = finiteCount(items.length);
  if (total === 0) return [];
  const cellCount = Math.min(total, MAX_RENDERED_CELLS);
  if (cellCount === total) {
    return items.map((item, index) => ({
      start: index,
      end: index,
      categoryId: item.categoryId,
      marker: item.marker === true,
    }));
  }
  const cells: SequenceStripCell[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const start = bucketStartIndex(cell, total, cellCount);
    const end = bucketStartIndex(cell + 1, total, cellCount) - 1;
    const counts = new Map<string, number>();
    let marker = false;
    for (let index = start; index <= end; index++) {
      const item = items[index];
      if (!item) continue;
      if (item.marker === true) marker = true;
      counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
    }
    // A Map iterates in insertion order, which here is first-occurrence order, so the strict `>`
    // resolves a tie to the category that appears EARLIEST in the range. Comparing as the counts
    // were accumulated instead would hand a tie to whichever category reached the shared maximum
    // last, which reads as an arbitrary flicker when one item is appended.
    let categoryId = '';
    let dominantCount = 0;
    for (const [id, count] of counts) {
      if (count > dominantCount) {
        dominantCount = count;
        categoryId = id;
      }
    }
    cells.push({ start, end, categoryId, marker });
  }
  return cells;
}

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
 * Exactly one cell is tabbable; Left/Right and Home/End rove through the cells and show the same
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
 * At most 200 cells are rendered. Past that cap the strip becomes a span-preserving OVERVIEW rather
 * than a window: the retained items are distributed over exactly 200 contiguous ranges, each cell
 * painted by its range's dominant category and marked when any item in it is, so the strip still
 * represents the whole sequence at full width. Roving focus, `aria-posinset`/`aria-setsize`,
 * `aria-current` and activation all address those cells; activating a range emits its FIRST item.
 * Assignment
 * retains at most the first 10,000 items and categories as detached frozen snapshots; reassign a
 * collection after changing it.
 *
 * An item may also set `disabled`, marking it non-actionable: `aria-disabled="true"` replaces the
 * selected/active affordances of the cell that represents it, activating it (click or Enter/Space)
 * emits nothing, and roving Left/Right/Home/End navigation -- including the default resting tab
 * stop -- steps past it instead of landing on it. Above the cell cap, a range cell's disabled state
 * follows its own activated item, the range's first (see `lr-item-activate` above). Omitted or
 * `false` renders the item exactly as before this field existed.
 *
 * @customElement lr-sequence-strip
 * @event lr-item-activate - Fired when a cell is clicked, or activated with Enter/Space on the
 *   roving-tabindex focus. `detail: { index, id, item }` identifies the picked item — the range's
 *   FIRST item once the strip is past its cell cap. Not
 *   cancelable, and it does not move `selectedIndex` on its own -- the selection is controlled,
 *   so the consumer stays the single source of truth for a playback index this strip does not own.
 * @csspart base - The root strip wrapper (`role="list"`).
 * @csspart cell - Each named, roving-focus cell, background-colored by its category — one item
 * below the render cap, one dominant-coloured item range above it. Carries `aria-disabled="true"`
 * while the item it activates sets `disabled`.
 * @csspart marker - The small bottom marker on a cell any of whose items sets `marker: true`.
 * @csspart tooltip - The hover/focus tooltip showing the active cell's label, positioned from that
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
 * @csspart bucket-summary - Visible item-total/range-count disclosure, rendered only while the
 * strip is past its cell cap and therefore showing ranges rather than individual items. It replaces
 * 15.x's `window-range`, which disclosed a projection window this component no longer has.
 * @csspart legend-limit - Visible rendered/total category count when the legend is bounded.
 * @cssprop [--lr-sequence-strip-height=var(--lr-size-1-5rem)] - Block size of the strip.
 * @cssprop [--lr-sequence-strip-marker-color=var(--lr-color-text)] - Color of the bottom marker on a `marker: true` cell, and of the marker legend row's bar.
 * @cssprop [--lr-sequence-strip-legend-swatch-size=var(--lr-size-0-625rem)] - Inline and block size of a legend swatch (category and marker rows alike).
 * @cssprop [--lr-sequence-strip-legend-marker-bg=var(--lr-color-surface-raised)] - Neutral chip background behind the marker legend row's bar; it stands in for "any cell", so it deliberately matches no category color.
 * @cssprop [--lr-sequence-strip-disabled-opacity=0.5] - Opacity of a cell whose activated item sets `disabled`.
 * @status stable
 * @since 4.0.0
 */
export class LyraSequenceStrip extends LyraElement<LyraSequenceStripEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    sequenceStripBucketLabel: LYRA_DEFAULT_sequenceStripBucketLabel,
    sequenceStripBucketSummary: LYRA_DEFAULT_sequenceStripBucketSummary,
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
            ...(item.disabled === undefined ? {} : { disabled: Boolean(item.disabled) }),
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
   * selection anchors the strip's sole keyboard entry stop; keyboard roving remains authoritative
   * after focus. Past the 200-cell cap it is the whole range containing the index that reads as
   * selected, since that range is the only thing the strip draws for it. An out-of-range or
   * non-integer value selects nothing rather than throwing.
   */
  // numeric-guard-exempt: selectedCellIndex() below rejects anything that is not an in-range
  // integer, and cellIndexForItem() re-clamps through finiteInteger() before the bucket division,
  // so a non-finite or fractional write selects nothing rather than reaching layout, Intl, canvas
  // or timer math.
  @property({ type: Number, attribute: 'selected-index' }) selectedIndex = -1;

  /** Index of the cell that owns `itemIndex`, or `-1` for an unusable index. Below the cell cap
   *  this is the identity mapping; past it, the bucket whose range contains the item. */
  private cellIndexForItem(itemIndex: number): number {
    const total = finiteCount(this.items.length);
    if (total === 0) return -1;
    const index = finiteInteger(itemIndex, -1, -1, total - 1);
    if (index < 0) return -1;
    const cellCount = Math.min(total, MAX_RENDERED_CELLS);
    if (cellCount === total) return index;
    return Math.min(cellCount - 1, Math.floor((index * cellCount) / total));
  }

  /** The cell carrying the controlled selection, or `null` when `selectedIndex` is not an in-range
   *  integer. Past the cell cap the selected item's whole RANGE reads as selected, since that range
   *  is the only thing the strip still draws for it. */
  private selectedCellIndex(): number | null {
    if (
      !Number.isInteger(this.selectedIndex) ||
      this.selectedIndex < 0 ||
      this.selectedIndex >= this.items.length
    ) {
      return null;
    }
    const cellIndex = this.cellIndexForItem(this.selectedIndex);
    return cellIndex >= 0 ? cellIndex : null;
  }

  /**
   * Emits `lr-item-activate` for `index`.
   *
   * Not cancelable: nothing in this component branches on `defaultPrevented`, and the library's
   * contract reserves cancelable events for real veto points.
   */
  private activateItem(index: number): void {
    const item = this.items[index];
    if (!item || item.disabled) return;
    this.emit('lr-item-activate', { index, id: item.id, item });
  }

  /** Activates the item a cell stands for — itself below the cap, its range's first item above it.
   *  Reporting the first item keeps a playback consumer's `selectedIndex` on a real sequence
   *  position it can scrub from, which a synthesized range midpoint would not be. */
  private activateCell(cellIndex: number): void {
    const cell = this.cells()[cellIndex];
    if (!cell) return;
    this.activateItem(cell.start);
  }

  /** A cell's disabled state follows the item it activates -- itself below the cap, its range's
   *  first item above it (see `activateCell()`). */
  private cellDisabled(cell: SequenceStripCell): boolean {
    return this.items[cell.start]?.disabled === true;
  }

  /** Degrades a candidate cell index off a disabled cell to the nearest enabled one (forward
   *  first, then backward) -- so the resting tab stop (defaulting to cell 0) never rests on a
   *  disabled cell. Returns `-1` only when every cell is disabled (including an empty list). Unset
   *  regression: with no disabled item, this is the same clamped index the tab stop always used. */
  private nearestEnabledCellIndex(cells: readonly SequenceStripCell[], index: number): number {
    const count = cells.length;
    if (!count) return -1;
    const clamped = Math.min(Math.max(index, 0), count - 1);
    if (!this.cellDisabled(cells[clamped]!)) return clamped;
    for (let forward = clamped + 1; forward < count; forward += 1) {
      if (!this.cellDisabled(cells[forward]!)) return forward;
    }
    for (let backward = clamped - 1; backward >= 0; backward -= 1) {
      if (!this.cellDisabled(cells[backward]!)) return backward;
    }
    return -1;
  }

  /** Steps `from` by one cell in `direction`, skipping past a disabled cell without wrapping --
   *  the same roving step contract `stepEnabledIndex()` in `internal/catalog-picker.ts` implements
   *  for an active-descendant listbox. Unset regression: with no disabled item, this is the same
   *  `clamp(from + direction, 0, cells.length - 1)` the arrow-key handler always computed. */
  private stepEnabledCellIndex(cells: readonly SequenceStripCell[], from: number, direction: 1 | -1): number {
    const count = cells.length;
    if (!count) return from;
    let index = Math.min(Math.max(from + direction, 0), count - 1);
    for (let steps = 0; steps < count; steps += 1) {
      if (!this.cellDisabled(cells[index]!)) return index;
      index += direction;
      if (index < 0 || index >= count) break;
    }
    // Nothing enabled was found in that direction -- stay at the roving position the call came
    // from (guaranteed enabled by the same invariant `nearestEnabledCellIndex()` establishes for
    // every resting stop), rather than moving onto a disabled cell.
    return from;
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

  /** The CELL index currently under the pointer (`null` when not hovering any cell). */
  @state() private hoverIndex: number | null = null;
  /** The roving keyboard-focus CELL index (`null` while focus is outside the strip). */
  @state() private keyboardIndex: number | null = null;
  /** Identity-keyed projection cache. Hover and focus re-render on every pointer move, so the
   *  O(items) bucket pass must not run again while the same frozen `items` snapshot is installed. */
  private cellCacheSource: readonly SequenceStripItem[] | undefined;
  private cellCache: readonly SequenceStripCell[] = [];
  private pendingFocusTarget: number | 'base' | undefined;
  private restoringOwnedFocus = false;
  private focusRestoreGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('items')) {
      this.focusRestoreGeneration++;
      this.hoverIndex = null;
      const focusedCell = activeElementIn(this.shadowRoot) as HTMLElement | null;
      const focusedCellIndex = Number(focusedCell?.dataset?.['index']);
      if (!Number.isInteger(focusedCellIndex) || focusedCellIndex < 0) {
        this.keyboardIndex = null;
        return;
      }
      // The focused cell already carries the id of the item it stands for, so retention reads it
      // straight off the DOM rather than indexing the previous array by the focused position --
      // past the cell cap that position is a RANGE index, and indexing `items` with it would
      // retain an unrelated item (or none) every time.
      const focusedId = focusedCell?.dataset?.['itemId'];
      const retainedItemIndex =
        focusedId === undefined || focusedId === ''
          ? -1
          : this.items.findIndex((item) => item.id === focusedId);
      const cells = this.cells();
      const nextIndex = retainedItemIndex >= 0
        ? this.cellIndexForItem(retainedItemIndex)
        : cells.length
          ? Math.min(focusedCellIndex, cells.length - 1)
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

  /** The current cell projection, rebuilt only when a new `items` snapshot is installed. */
  private cells(): readonly SequenceStripCell[] {
    const items = this._items;
    if (this.cellCacheSource === items) return this.cellCache;
    this.cellCacheSource = items;
    this.cellCache = Object.freeze(buildSequenceStripCells(items));
    return this.cellCache;
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
    // Past the cell cap the list itself only exposes 200 positions for a far longer sequence, so
    // the label is the only place a screen-reader user can learn that each position is a range.
    // It is a clause of the same summary rather than a second live region: `[part="bucket-summary"]`
    // repeats it visually and is `aria-hidden` for exactly that reason.
    const overview = this.bucketSummary();
    if (overview !== undefined) clauses.push(overview);
    return getListFormat(this.effectiveLocale, { style: 'long', type: 'unit' }).format(clauses);
  }

  /** The localized "N items in M ranges" disclosure, or `undefined` while every item has its own
   *  cell and there is nothing to disclose. */
  private bucketSummary(): string | undefined {
    const cells = this.cells();
    if (cells.length === 0 || cells.length >= this.items.length) return undefined;
    const number = getNumberFormat(this.effectiveLocale);
    return this.localize('sequenceStripBucketSummary', undefined, {
      items: number.format(this.items.length),
      ranges: number.format(cells.length),
      pluralCount: this.items.length,
    });
  }

  /** A cell's accessible name and tooltip text: the item's own label for a one-item cell, and a
   *  "dominant category, items X to Y" range name once the cell stands for several. */
  private cellLabel(cell: SequenceStripCell, categories = this.categoryMap()): string {
    if (cell.end <= cell.start) {
      const item = this.items[cell.start];
      return item ? this.itemLabel(item, categories) : this.categoryLabel(cell.categoryId, categories);
    }
    const number = getNumberFormat(this.effectiveLocale);
    return this.localize('sequenceStripBucketLabel', undefined, {
      label: this.categoryLabel(cell.categoryId, categories),
      start: number.format(cell.start + 1),
      end: number.format(cell.end + 1),
      pluralCount: cell.end - cell.start + 1,
    });
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
      this.activateCell(index);
      return;
    }
    const cells = this.cells();
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || cells.length === 0) return;
    e.preventDefault();
    const forwardKey = isRtl(this) ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = isRtl(this) ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (e.key === 'Home') next = cells.findIndex((cell) => !this.cellDisabled(cell));
    else if (e.key === 'End') {
      next = cells.length - 1;
      while (next >= 0 && this.cellDisabled(cells[next]!)) next -= 1;
    } else if (e.key === forwardKey) next = this.stepEnabledCellIndex(cells, index, 1);
    else if (e.key === backwardKey) next = this.stepEnabledCellIndex(cells, index, -1);
    if (next < 0) return;
    const items = this.items;
    const targetStart = cells[next]?.start;
    const targetId = targetStart === undefined ? undefined : items[targetStart]?.id;
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
    const cells = this.cells();
    const activeIndex = this.hoverIndex ?? this.keyboardIndex;
    const active = activeIndex !== null ? cells[activeIndex] : undefined;
    const selectedCell = this.selectedCellIndex();
    const requestedTabStop = this.keyboardIndex ?? selectedCell ?? 0;
    // Degrades off a disabled cell to the nearest enabled one, so the resting `tabindex="0"` stop
    // is never one a keyboard user cannot reach; falls back to the raw request only when every
    // cell is disabled, the one case with no reachable stop to degrade to.
    const nearestEnabledTabStop = this.nearestEnabledCellIndex(cells, requestedTabStop);
    const tabStop = nearestEnabledTabStop >= 0 ? nearestEnabledTabStop : requestedTabStop;
    const tooltipIndex = activeIndex ?? tabStop;
    const overview = this.bucketSummary();
    return html`
      <div
        part="base"
        role="list"
        aria-label=${ariaLabel}
        tabindex="-1"
        ?data-dense=${cells.length >= MAX_RENDERED_CELLS}
        @focusout=${this.onStripFocusOut}
      >
        ${cells.map(
          (cell, index) => html`
            <span
              part="cell"
              data-item-id=${this.items[cell.start]?.id ?? ''}
              data-index=${index}
              data-range-start=${cell.start}
              data-range-end=${cell.end}
              role="listitem"
              aria-label=${this.cellLabel(cell, categoryMap)}
              aria-posinset=${index + 1}
              aria-setsize=${cells.length}
              aria-disabled=${this.cellDisabled(cell) ? 'true' : nothing}
              tabindex=${index === tabStop ? '0' : '-1'}
              style=${styleMap({ backgroundColor: this.categoryColor(cell.categoryId, categoryMap) })}
              @pointerenter=${() => this.onCellEnter(index)}
              @pointerleave=${() => this.onCellLeave()}
              @focus=${() => this.onCellFocus(index)}
              @keydown=${(e: KeyboardEvent) => this.onCellKeyDown(e, index)}
              @click=${() => this.activateCell(index)}
              aria-current=${selectedCell === index ? 'true' : 'false'}
              ?data-selected=${selectedCell === index}
            >
              ${cell.marker ? html`<span part="marker"></span>` : nothing}
              ${index === tooltipIndex
                ? html`
                    <span id="sequence-strip-tooltip" part="tooltip" ?hidden=${!active}>
                      ${active ? this.cellLabel(active, categoryMap) : ''}
                    </span>
                  `
                : nothing}
            </span>
          `,
        )}
      </div>
      ${overview === undefined
        ? nothing
        : html`<div part="bucket-summary" aria-hidden="true">${overview}</div>`}
      ${this.showLegend ? this.renderLegend() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sequence-strip': LyraSequenceStrip;
  }
}
