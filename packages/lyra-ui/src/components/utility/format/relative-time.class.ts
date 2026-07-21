import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './format.styles.js';
import { getRelativeTimeFormat } from '../../../internal/intl-cache.js';

export type RelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * `<lr-relative-time>` — locale-aware relative time that can refresh automatically.
 *
 * @customElement lr-relative-time
 */
export class LyraRelativeTime extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property() date: string | number | Date = '';
  @property() unit: RelativeTimeUnit | 'auto' = 'auto';
  @property() numeric: 'always' | 'auto' = 'auto';
  @property({ type: Boolean, attribute: 'sync' }) sync = false;
  private timer?: ReturnType<typeof setInterval>;
  connectedCallback(): void { super.connectedCallback(); this.schedule(); }
  disconnectedCallback(): void { clearInterval(this.timer); super.disconnectedCallback(); }
  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('sync') || changed.has('date') || changed.has('locale') || changed.has('unit') || changed.has('numeric')) this.schedule();
  }
  private schedule(): void {
    clearInterval(this.timer);
    if (this.sync) this.timer = setInterval(() => this.requestUpdate(), 30_000);
  }
  private relative(): string {
    const target = this.date instanceof Date ? this.date.getTime() : new Date(this.date).getTime();
    if (!Number.isFinite(target)) return '';
    const seconds = (target - Date.now()) / 1000;
    // `units` drives "auto" selection order (largest unit first) -- derived from `divisors`' key
    // order rather than duplicated, so the two can never drift out of sync; `divisors`' insertion
    // order is already largest-to-smallest, matching the desired selection order exactly.
    const divisors: Record<RelativeTimeUnit, number> = { year: 31_536_000, quarter: 7_884_000, month: 2_628_000, week: 604_800, day: 86_400, hour: 3_600, minute: 60, second: 1 };
    const units = Object.keys(divisors) as RelativeTimeUnit[];
    const selected = this.unit === 'auto' ? units.find((candidate) => Math.abs(seconds) >= divisors[candidate]) ?? 'second' : this.unit;
    const value = Math.round(seconds / divisors[selected]);
    return getRelativeTimeFormat(this.effectiveLocale || undefined, { numeric: this.numeric }).format(value, selected);
  }
  render(): TemplateResult { return html`${this.relative()}`; }
}
declare global { interface HTMLElementTagNameMap { 'lr-relative-time': LyraRelativeTime; } }
