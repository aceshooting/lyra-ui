import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './sequence-strip.styles.js';

export interface SequenceStripItem {
  id: string;
  category: string;
  /** A small marker rendered at the bottom of this cell — a secondary boolean annotation
   *  independent of the primary category color (e.g. a subagent-dispatched turn). */
  marker?: boolean;
  /** Per-item text, used by a future hover treatment (see the class doc) — not read by this
   *  component's own auto-generated `aria-label`, which summarizes by category/count only. */
  label?: string;
}

export interface SequenceStripCategory {
  key: string;
  color: string;
  /** Human-readable name used in the auto-generated `aria-label` summary and (in a follow-up
   *  change) any per-item hover text. Falls back to `key` itself when unset. */
  label?: string;
}

/**
 * `<lyra-sequence-strip>` — a compact, one-thin-cell-per-item strip visualizing a sequence of
 * categorical states, with an optional secondary per-cell marker. Pure CSS/flex, no chart.js/SVG/
 * canvas — sized/named consistently with the sparkline/heatmap family, but a glanceable aggregate
 * visualization (`role="img"`, one summarizing `aria-label`), not a `role="list"` of
 * separately-operable items: no per-cell keyboard focus, no per-cell click event, matching
 * `<lyra-sparkline>`'s accessibility model rather than `<lyra-heatmap>`'s heavier canvas +
 * keyboard-roving one.
 *
 * @customElement lyra-sequence-strip
 * @csspart base - The root strip wrapper (`role="img"`).
 * @csspart cell - Each item's cell, background-colored by its category.
 * @csspart marker - The small bottom marker on a cell whose item sets `marker: true`.
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

  render(): TemplateResult {
    const ariaLabel = this.accessibleLabel || this.autoSummary();
    return html`
      <div part="base" role="img" aria-label=${ariaLabel}>
        ${this.items.map(
          (item) => html`
            <span part="cell" style="background-color:${this.categoryColor(item.category)}">
              ${item.marker ? html`<span part="marker"></span>` : nothing}
            </span>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-sequence-strip': LyraSequenceStrip;
  }
}
