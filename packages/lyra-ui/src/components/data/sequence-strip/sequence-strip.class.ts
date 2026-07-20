import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './sequence-strip.styles.js';

export interface SequenceStripItem {
  id: string;
  category: string;
  /** A small marker rendered at the bottom of this cell — a secondary boolean annotation
   *  independent of the primary category color (e.g. a subagent-dispatched turn). */
  marker?: boolean;
  /** Per-item text shown in the hover tooltip (falls back to the category's own `label`, or its
   *  `key`, when unset) — not read by this component's own auto-generated `aria-label`, which
   *  summarizes by category/count only. */
  label?: string;
}

export interface SequenceStripCategory {
  key: string;
  color: string;
  /** Human-readable name used in the auto-generated `aria-label` summary and as the hover-tooltip
   *  fallback text for items with no `label` of their own. Falls back to `key` itself when unset. */
  label?: string;
}

/**
 * `<lr-sequence-strip>` — a compact, one-thin-cell-per-item strip visualizing a sequence of
 * categorical states, with an optional secondary per-cell marker. Pure CSS/flex, no chart.js/SVG/
 * canvas — sized/named consistently with the sparkline/heatmap family, but a glanceable aggregate
 * visualization (`role="img"`, one summarizing `aria-label`), not a `role="list"` of
 * separately-operable items: no per-cell keyboard focus, no per-cell click event, matching
 * `<lr-sparkline>`'s accessibility model rather than `<lr-heatmap>`'s heavier canvas +
 * keyboard-roving one.
 *
 * @customElement lr-sequence-strip
 * @csspart base - The root strip wrapper (`role="img"`).
 * @csspart cell - Each item's cell, background-colored by its category.
 * @csspart marker - The small bottom marker on a cell whose item sets `marker: true`.
 * @csspart tooltip - The hover tooltip showing the hovered item's label.
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
 */
export class LyraSequenceStrip extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: SequenceStripItem[] = [];
  @property({ attribute: false }) categories: SequenceStripCategory[] = [];
  /** Only `'horizontal'` (the default) is supported today — vertical is plausible future scope, not
   *  built speculatively without a motivating case. */
  @property({ reflect: true }) orientation: 'horizontal' = 'horizontal';
  /** Overrides the auto-generated `aria-label` (a per-category "label: count" summary). Unset
   *  computes the summary from `items`/`categories`. */
  @property({ attribute: 'accessible-label' }) accessibleLabel?: string;
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

  /** The item index currently under the pointer (`null` when not hovering any cell) — drives
   *  `[part="tooltip"]`, mirroring `<lr-heatmap>`'s own `hoverCell` pattern. No keyboard/focus
   *  equivalent — see the class doc for why this component has no per-cell focus target at all. */
  @state() private hoverIndex: number | null = null;

  private categoryColor(key: string): string {
    return this.categories.find((c) => c.key === key)?.color ?? 'transparent';
  }

  private autoSummary(): string {
    const counts = new Map<string, number>();
    for (const item of this.items) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    if (counts.size === 0) return this.localize('sequenceStripEmpty');
    const clauses = [...counts.entries()].map(([key, count]) => {
      const label = this.categories.find((c) => c.key === key)?.label ?? key;
      return this.localize('sequenceStripCategoryCount', undefined, { label, count });
    });
    // The marker is a second, independent axis, so it gets its own trailing clause rather than
    // folding into any category's count -- and only once `markerLabel` names it, since the summary
    // has no other word for it. Counted like a category: only a non-zero count is announced (a
    // zero-count category is likewise absent from the summary while still keying the legend), and
    // the same '{label}: {count}' string is reused so it translates through one key.
    const markerCount = this.items.filter((item) => item.marker).length;
    if (this.markerLabel && markerCount > 0) {
      clauses.push(this.localize('sequenceStripCategoryCount', undefined, { label: this.markerLabel, count: markerCount }));
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

  /** The legend repeats, in visible form, exactly the category names the strip already announces
   *  through `[part="base"]`'s `role="img"` + `aria-label` summary. Exposing it to assistive
   *  technology as well would read the same scheme out twice, so the whole subtree is
   *  `aria-hidden` — it is a decorative duplicate, and it renders outside the `role="img"` element
   *  so hiding it removes nothing from the announced summary. */
  private renderLegend(): TemplateResult {
    return html`
      <div part="legend" aria-hidden="true">
        ${this.categories.map(
          (category) => html`
            <span part="legend-item">
              <span part="legend-swatch" style="background-color:${category.color}"></span>
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

  render(): TemplateResult {
    const ariaLabel = this.accessibleLabel || this.autoSummary();
    const hovered = this.hoverIndex !== null ? this.items[this.hoverIndex] : undefined;
    return html`
      <div part="base" role="img" aria-label=${ariaLabel}>
        ${this.items.map(
          (item, index) => html`
            <span
              part="cell"
              style="background-color:${this.categoryColor(item.category)}"
              @pointerenter=${() => this.onCellEnter(index)}
              @pointerleave=${() => this.onCellLeave()}
            >
              ${item.marker ? html`<span part="marker"></span>` : nothing}
            </span>
          `,
        )}
        <div part="tooltip" ?hidden=${!hovered}>${hovered ? this.itemLabel(hovered) : ''}</div>
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
