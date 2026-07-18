import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
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
    return [...counts.entries()]
      .map(([key, count]) => {
        const label = this.categories.find((c) => c.key === key)?.label ?? key;
        return this.localize('sequenceStripCategoryCount', undefined, { label, count });
      })
      .join(', ');
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sequence-strip': LyraSequenceStrip;
  }
}
