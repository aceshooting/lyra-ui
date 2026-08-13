import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { isRtl } from '../../../internal/rtl.js';
import { sanitizeCssColor } from '../../../internal/safe-css.js';
import { styles } from './sequence-strip.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_sequenceStripCategoryCount, LYRA_DEFAULT_sequenceStripEmpty } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface SequenceStripItem {
  id: string;
  category: string;
  /** A small marker rendered at the bottom of this cell — a secondary boolean annotation
   *  independent of the primary category color (e.g. a subagent-dispatched turn). */
  marker?: boolean;
  /** Per-item text shown in the hover/focus tooltip and exposed as the item's accessible name
   *  (falls back to the category's own `label`, or its `key`, when unset). */
  label?: string;
}

export interface SequenceStripCategory {
  key: string;
  /** A CSS color. Invalid values and `url()` paint servers render transparently. */
  color: string;
  /** Human-readable name used in the auto-generated `aria-label` summary and as the hover-tooltip
   *  fallback text for items with no `label` of their own. Falls back to `key` itself when unset. */
  label?: string;
}

/**
 * `<lr-sequence-strip>` — a compact, one-thin-cell-per-item strip visualizing a sequence of
 * categorical states, with an optional secondary per-cell marker. Pure CSS/flex, no chart.js/SVG/
 * canvas — sized/named consistently with the sparkline/heatmap family, but a glanceable aggregate
 * visualization. The strip is a labeled `role="list"` and each cell is a named list item.
 * Exactly one cell is tabbable; Left/Right and Home/End rove through the items and show the same
 * detail tooltip as pointer hover. Cells are inspectable rather than actionable, so they do not
 * emit an activation event. A host `aria-label` names the internal list ahead of the
 * `accessible-label` alias and generated summary. Controlled item refreshes preserve the focused
 * item by id, clamp to the nearest survivor, and focus the stable list when the strip becomes empty.
 * A queued arrow/Home/End focus is generation- and identity-bound: replacing `items`, disconnecting,
 * or reconnecting before that update settles cannot focus the same numeric index in a new model.
 * Cells flex below their ordinary 2px visual target when the allocation cannot fit every item;
 * above 320 items the decorative 1px gaps collapse as well. The dense policy keeps the strip
 * contained at the 320px responsive baseline without dropping any listitem or keyboard stop.
 *
 * @customElement lr-sequence-strip
 * @csspart base - The root strip wrapper (`role="list"`).
 * @csspart cell - Each named, roving-focus item cell, background-colored by its category.
 * @csspart marker - The small bottom marker on a cell whose item sets `marker: true`.
 * @csspart tooltip - The hover/focus tooltip showing the active item's label.
 * @csspart legend - The static category key rendered below the strip when `showLegend` is set
 * (`aria-hidden` — it repeats the strip's own `aria-label` visually).
 * @csspart legend-item - One swatch + label pair in the legend, one per `categories` entry (plus one
 * trailing marker row when `markerLabel` is set).
 * @csspart legend-swatch - The color chip of a legend item, matching that category's cell color.
 * @csspart legend-marker-swatch - The chip of the `markerLabel` legend row: a neutral chip carrying
 * the same bottom bar a `marker: true` cell paints, in the same `--lr-sequence-strip-marker-color`.
 * @csspart legend-label - The text of a legend item (the category's `label`, or its `key`).
 * @cssprop [--lr-sequence-strip-height=var(--lr-size-1-5rem)] - Block size of the strip.
 * @cssprop [--lr-sequence-strip-marker-color=var(--lr-color-text)] - Color of the bottom marker on a `marker: true` cell, and of the marker legend row's bar.
 * @cssprop [--lr-sequence-strip-legend-swatch-size=var(--lr-size-0-625rem)] - Inline and block size of a legend swatch (category and marker rows alike).
 * @cssprop [--lr-sequence-strip-legend-marker-bg=var(--lr-color-surface-raised)] - Neutral chip background behind the marker legend row's bar; it stands in for "any cell", so it deliberately matches no category color.
 * @status stable
 * @since 4.0.0
 */
export class LyraSequenceStrip extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    sequenceStripCategoryCount: LYRA_DEFAULT_sequenceStripCategoryCount,
    sequenceStripEmpty: LYRA_DEFAULT_sequenceStripEmpty,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: SequenceStripItem[] = [];
  @property({ attribute: false }) categories: SequenceStripCategory[] = [];
  /** Overrides the auto-generated `aria-label` (a per-category "label: count" summary). Unset
   *  computes the summary from `items`/`categories`. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;
  /** Standard host accessible-name override. Wins over `accessibleLabel` and the generated
   *  category summary, and is forwarded to the internal list that owns the semantic role. */
  @property({ attribute: 'aria-label' }) private hostAriaLabel: string | null = null;
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
      const renderedCells = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[part="cell"]') ?? [])];
      const focusedIndex = renderedCells.indexOf(this.shadowRoot?.activeElement as HTMLElement);
      if (focusedIndex < 0) {
        this.keyboardIndex = null;
        return;
      }
      const previousItems = (changed.get('items') as SequenceStripItem[] | undefined) ?? [];
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
        this.shadowRoot?.querySelectorAll<HTMLElement>('[part="cell"]')[pending]?.focus();
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

  private categoryColor(key: string): string {
    return sanitizeCssColor(this.categories.find((c) => c.key === key)?.color) ?? 'transparent';
  }

  private autoSummary(): string {
    const counts = new Map<string, number>();
    for (const item of this.items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    if (counts.size === 0) return this.localize('sequenceStripEmpty');
    const clauses = [...counts.entries()].map(([key, count]) => {
      const label = this.categories.find((c) => c.key === key)?.label ?? key;
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
    return clauses.join(', ');
  }

  private itemLabel(item: SequenceStripItem): string {
    if (item.label) return item.label;
    return this.categories.find((c) => c.key === item.category)?.label ?? item.category;
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
      const target = this.shadowRoot?.querySelectorAll<HTMLElement>('[part="cell"]')[next];
      if (target?.dataset['itemId'] === targetId) target.focus();
    });
  }

  /** The legend repeats, in visible form, the category names already exposed by the named
   *  `role="list"` summary and its individually named `role="listitem"` cells. Exposing the key to
   *  assistive technology as well would read the same scheme twice, so the whole subtree is
   *  `aria-hidden` — it is a decorative duplicate rendered outside the list, and hiding it removes
   *  nothing from the inspectable sequence. */
  private renderLegend(): TemplateResult {
    return html`
      <div part="legend" aria-hidden="true">
        ${this.categories.map(
          (category) => html`
            <span part="legend-item">
              <span
                part="legend-swatch"
                style=${styleMap({ backgroundColor: sanitizeCssColor(category.color) ?? 'transparent' })}
              ></span>
              <span part="legend-label">${category.label ?? category.key}</span>
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
      </div>
    `;
  }

  override render(): TemplateResult {
    const ariaLabel = this.hostAriaLabel || this.accessibleLabel || this.autoSummary();
    const activeIndex = this.hoverIndex ?? this.keyboardIndex;
    const active = activeIndex !== null ? this.items[activeIndex] : undefined;
    const tabStop = this.keyboardIndex ?? 0;
    return html`
      <div
        part="base"
        role="list"
        aria-label=${ariaLabel}
        tabindex="-1"
        ?data-dense=${this.items.length > 320}
        @focusout=${this.onStripFocusOut}
      >
        ${this.items.map(
          (item, index) => html`
            <span
              part="cell"
              data-item-id=${item.id}
              role="listitem"
              aria-label=${this.itemLabel(item)}
              aria-posinset=${index + 1}
              aria-setsize=${this.items.length}
              tabindex=${index === tabStop ? '0' : '-1'}
              style=${styleMap({ backgroundColor: this.categoryColor(item.category) })}
              @pointerenter=${() => this.onCellEnter(index)}
              @pointerleave=${() => this.onCellLeave()}
              @focus=${() => this.onCellFocus(index)}
              @keydown=${(e: KeyboardEvent) => this.onCellKeyDown(e, index)}
            >
              ${item.marker ? html`<span part="marker"></span>` : nothing}
            </span>
          `,
        )}
        <div id="sequence-strip-tooltip" part="tooltip" ?hidden=${!active}>${active ? this.itemLabel(active) : ''}</div>
      </div>
      ${this.showLegend ? this.renderLegend() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sequence-strip': LyraSequenceStrip;
  }
}
