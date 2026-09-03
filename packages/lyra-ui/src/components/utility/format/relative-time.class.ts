import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { isDateObject } from '../../../internal/dom-guards.js';
import { styles } from './format.styles.js';
import { getRelativeTimeFormat } from '../../../internal/intl-cache.js';
import { finiteDuration } from '../../../internal/numbers.js';
import {
  relativeTimeFormatOptions,
  dateSourceConverter,
  type LyraFormatDisplay,
  type LyraRelativeTimeNumeric,
} from './format-options.js';

export type {
  LyraFormatDisplay as RelativeTimeFormat,
  LyraRelativeTimeNumeric,
} from './format-options.js';

export type LyraRelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

const DIVISORS: Record<LyraRelativeTimeUnit, number> = {
  year: 31_536_000,
  quarter: 7_884_000,
  month: 2_628_000,
  week: 604_800,
  day: 86_400,
  hour: 3_600,
  minute: 60,
  second: 1,
};
const UNITS = Object.keys(DIVISORS) as LyraRelativeTimeUnit[];

/** Reads native Date time slots directly, avoiding conversion hooks on arbitrary object input. */
function resolvedDateEpoch(value: unknown): number | undefined {
  if (value === null || value === undefined) return Date.now();
  if (typeof value === 'string' || typeof value === 'number') {
    const epoch = new Date(value).getTime();
    return Number.isFinite(epoch) ? epoch : undefined;
  }
  if (!isDateObject(value)) return undefined;
  try {
    const epoch = Date.prototype.getTime.call(value);
    return Number.isFinite(epoch) ? epoch : undefined;
  } catch {
    return undefined;
  }
}

/**
 * `<lr-relative-time>` — locale-aware relative time that can refresh automatically. Numeric
 * `date` attributes are epoch milliseconds, matching numeric property assignment; nonnumeric
 * attributes remain date strings.
 *
 * @customElement lr-relative-time
 * @status stable
 * @since 4.0.0
 */
export class LyraRelativeTime extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property({ converter: dateSourceConverter }) date: string | number | Date = new Date();
  @property() unit: LyraRelativeTimeUnit | 'auto' = 'auto';
  @property() format: LyraFormatDisplay = 'long';
  @property() numeric: LyraRelativeTimeNumeric = 'auto';
  @property({ type: Boolean, attribute: 'sync' }) sync = false;
  private timer?: number;
  private timerOwner?: Window;
  private timerDocument?: Document;
  private timerGeneration = 0;
  override connectedCallback(): void {
    super.connectedCallback();
    this.schedule();
  }
  override disconnectedCallback(): void {
    this.clearTimer();
    super.disconnectedCallback();
  }
  override adoptedCallback(): void {
    super.adoptedCallback();
    this.clearTimer();
  }
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('sync') ||
      changed.has('date') ||
      changed.has('locale') ||
      changed.has('unit') ||
      changed.has('format') ||
      changed.has('numeric')
    )
      this.schedule();
  }

  private schedule(): void {
    this.clearTimer();
    if (!this.sync || !this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow) return;
    const state = this.relativeState();
    if (!state) return;

    // `Math.round()` changes when the decreasing target delta crosses `(value - .5) * unit`.
    // Wake at that exact boundary instead of polling every 30 seconds, then also account for an
    // auto-selected unit changing (e.g. 1 day -> 23 hours) before the rounded day value would.
    const divisor = DIVISORS[state.selected];
    const roundedBoundary = state.seconds - (state.value - 0.5) * divisor;
    const candidates = [roundedBoundary];
    if (state.requestedUnit === 'auto') {
      const index = UNITS.indexOf(state.selected);
      const magnitude = Math.abs(state.seconds);
      if (state.seconds >= 0 && state.selected !== 'second') {
        candidates.push(magnitude - divisor);
      } else if (state.seconds < 0 && index > 0) {
        candidates.push(DIVISORS[UNITS[index - 1]!] - magnitude);
      }
    }
    const secondsUntilChange = Math.min(...candidates.filter((candidate) => candidate > 0));
    const delay = finiteDuration(secondsUntilChange * 1000, 1000, 20);
    const generation = this.timerGeneration;
    const handle = ownerWindow.setTimeout(() => {
      if (
        this.timer !== handle ||
        this.timerOwner !== ownerWindow ||
        this.timerDocument !== ownerDocument ||
        this.timerGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.timer = undefined;
      this.timerOwner = undefined;
      this.timerDocument = undefined;
      this.requestUpdate();
      this.schedule();
    }, delay);
    this.timer = handle;
    this.timerOwner = ownerWindow;
    this.timerDocument = ownerDocument;
  }

  private clearTimer(): void {
    this.timerGeneration += 1;
    if (this.timer !== undefined) this.timerOwner?.clearTimeout(this.timer);
    this.timer = undefined;
    this.timerOwner = undefined;
    this.timerDocument = undefined;
  }

  private relativeState():
    | {
        target: number;
        seconds: number;
        requestedUnit: LyraRelativeTimeUnit | 'auto';
        selected: LyraRelativeTimeUnit;
        value: number;
      }
    | undefined {
    const target = resolvedDateEpoch(this.date);
    if (target === undefined) return undefined;
    const seconds = (target - Date.now()) / 1000;
    const requestedUnit = this.unit === 'auto' || UNITS.includes(this.unit as LyraRelativeTimeUnit) ? this.unit : 'auto';
    const selected =
      requestedUnit === 'auto'
        ? UNITS.find((candidate) => Math.abs(seconds) >= DIVISORS[candidate]) ?? 'second'
        : requestedUnit;
    return {
      target,
      seconds,
      requestedUnit,
      selected,
      value: Math.round(seconds / DIVISORS[selected]),
    };
  }

  private relative(): { text: string; target: number } | undefined {
    const state = this.relativeState();
    if (!state) return undefined;
    const options = relativeTimeFormatOptions(this.format, this.numeric);
    try {
      return {
        text: getRelativeTimeFormat(this.effectiveLocale || undefined, options).format(state.value, state.selected),
        target: state.target,
      };
    } catch {
      return {
        text: getRelativeTimeFormat(undefined, {
          numeric: 'auto',
          style: 'long',
        }).format(state.value, state.selected),
        target: state.target,
      };
    }
  }

  override render(): TemplateResult {
    const relative = this.relative();
    return relative ? html`<time datetime=${new Date(relative.target).toISOString()}>${relative.text}</time>` : html``;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    'lr-relative-time': LyraRelativeTime;
  }
}
