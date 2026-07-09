import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { styles } from './stat.styles.js';

export type StatVariant = 'neutral' | 'success' | 'warning' | 'danger';

/**
 * `<lyra-stat>` — a KPI/stat card. First-party invention consolidating the
 * "metric row" / "KPI card" pattern reinvented in every surveyed repo.
 *
 * @customElement lyra-stat
 * @slot - Leading icon.
 * @slot caption - Rich caption content (overrides the `caption` attribute).
 * @csspart base, icon, label, value, unit, trend, caption
 */
export class LyraStat extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property() label = '';
  @property() value = '';
  @property() unit = '';
  @property({ reflect: true }) variant: StatVariant = 'neutral';
  @property({ type: Number }) trend = NaN;
  @property() caption = '';

  render(): TemplateResult {
    const hasTrend = !isNaN(this.trend);
    const direction = this.trend > 0 ? 'up' : this.trend < 0 ? 'down' : 'flat';
    const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';

    return html`
      <div part="base">
        <span part="icon"><slot></slot></span>
        <span part="label">${this.label}</span>
        <div part="value-row">
          <span part="value">${this.value}</span>
          <span part="unit">${this.unit}</span>
        </div>
        ${hasTrend
          ? html`<span part="trend" data-direction=${direction}>
              ${arrow} ${Math.abs(this.trend)}%
            </span>`
          : nothing}
        <div part="caption">${this.caption}<slot name="caption"></slot></div>
      </div>
    `;
  }
}

defineElement('stat', LyraStat);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-stat': LyraStat;
  }
}
