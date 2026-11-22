import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteNumber } from '../../../internal/numbers.js';
import {
  COUNTER_UNIT_MS,
  COUNTER_UNITS,
  splitDuration,
  type LyraCounterUnit,
  type LyraCounterValues,
} from './counter-time.js';
import { styles } from './counter.styles.js';

export type { LyraCounterUnit } from './counter-time.js';

/** The label style of a counter's units. */
export type LyraCounterFormat = 'long' | 'short' | 'narrow';
/** The direction a counter runs. */
export type LyraCounterDirection = 'down' | 'up';

export interface LyraCounterEventMap {
  'lr-finish': CustomEvent<null>;
}

const DEFAULT_UNITS: readonly LyraCounterUnit[] = ['days', 'hours', 'minutes', 'seconds'];
const FORMATS: readonly LyraCounterFormat[] = ['long', 'short', 'narrow'];
const optionalNumber = blankNumberConverter(undefined);

/** A source for `date`: a `Date`, epoch milliseconds, or a date string (ISO 8601 is the safe form). */
export type LyraCounterDateSource = Date | string | number;

function toMilliseconds(source: LyraCounterDateSource | undefined | null): number {
  if (source === undefined || source === null || source === '') return Number.NaN;
  return source instanceof Date ? source.getTime() : new Date(source).getTime();
}

/**
 * `<lr-counter>` — counts down to a date (or for a duration) or up from one, ticking through years,
 * months, days, hours, minutes and seconds with locale-aware unit labels. Use it for launch and sale
 * countdowns and for how long something has been running.
 *
 * The host is not a live region: the counter is a `role="timer"` whose visually hidden phrase is
 * refreshed every tick but never announced, so assistive technology reads the current time on demand
 * instead of once a second. Set `label` to name it. It renders zeros during SSR and starts counting
 * once it connects on the client, because the server cannot know the viewer's clock.
 *
 * @customElement lr-counter
 * @slot years - A custom label for years.
 * @slot months - A custom label for months.
 * @slot days - A custom label for days.
 * @slot hours - A custom label for hours.
 * @slot minutes - A custom label for minutes.
 * @slot seconds - A custom label for seconds.
 * @slot finished - Content shown in place of the units when a countdown is at zero, including one whose date already passed.
 * @csspart base - The timer container that holds the units.
 * @csspart unit - The container that wraps one unit's value and label.
 * @csspart value - One unit's value.
 * @csspart label - One unit's label.
 * @csspart delimiter - The text shown between units.
 * @csspart finished - The container around the `finished` slot.
 * @cssprop [--lr-counter-gap=0.5em] - The space between units.
 * @cssstate finished - Applied while a countdown is at zero, including one whose date already passed.
 * @event lr-finish - A running countdown reached zero. Not emitted when the date had already passed.
 * @status experimental
 * @since unreleased
 */
export class LyraCounter extends LyraElement<LyraCounterEventMap> {
  static override styles = [LyraElement.styles, styles];

  /**
   * The date to count down to, or up from: a `Date`, epoch milliseconds, or a string. Prefer ISO 8601
   * strings so time zones resolve identically everywhere. When omitted, the counter counts down from
   * `duration`, or up from the moment it starts.
   */
  @property() date?: LyraCounterDateSource;

  /**
   * Milliseconds to count down from, starting when the counter connects. Changing it restarts the
   * countdown. Ignored when `date` is set or `direction` is `up`.
   */
  @property({ converter: optionalNumber }) duration?: number;

  /** Counts `down` to the date (the default) or `up` from it. */
  @property({ reflect: true }) direction: LyraCounterDirection = 'down';

  /** An accessible name for the timer. */
  @property() label = '';

  /** The largest unit to show; larger time rolls up into it. An invalid pair falls back to days through seconds. */
  @property({ attribute: 'largest-unit' }) largestUnit: LyraCounterUnit = 'days';

  /** The smallest unit to show; smaller time is dropped. An invalid pair falls back to days through seconds. */
  @property({ attribute: 'smallest-unit' }) smallestUnit: LyraCounterUnit = 'seconds';

  /** The unit label style: `long` (the default), `short` or `narrow`. */
  @property() format: LyraCounterFormat = 'long';

  /** Hides the unit labels and keeps every unit so the digits hold their place, like a clock. */
  @property({ type: Boolean, attribute: 'without-labels', reflect: true }) withoutLabels = false;

  /** Text shown between units, such as `:`. */
  @property() delimiter = '';

  /** Pauses the counter; clearing it continues from the time shown. */
  @property({ type: Boolean, reflect: true }) paused = false;

  /** Formats each unit's value. Receives the value and its unit; assistive technology still reads the raw value. Property only. */
  @property({ attribute: false }) valueFormatter?: (value: number, unit: LyraCounterUnit) => string;

  @state() private values: LyraCounterValues = {};
  @state() private finished = false;
  @state() private hasFinishedContent = false;

  private readonly internals = attachInternalsSafely(this);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private startedAt = 0;
  private pausedAt: number | null = null;
  private shift = 0;
  private counting = false;
  private generation = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    this.startedAt ||= Date.now();
    // Resume after a move or re-attach; the first connection ticks from willUpdate().
    if (this.hasUpdated) this.tick();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('duration')) this.startedAt = Date.now();
    if (changed.has('date') || changed.has('duration')) {
      this.shift = 0;
      this.pausedAt = null;
      this.counting = false;
    }
    if (this.paused) {
      this.pausedAt ??= Date.now();
    } else if (this.pausedAt !== null) {
      // Move the target by the time spent paused so counting resumes from the time shown.
      this.shift += Date.now() - this.pausedAt;
      this.pausedAt = null;
    }
    this.tick();
  }

  private stopTimer(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private get units(): readonly LyraCounterUnit[] {
    const start = COUNTER_UNITS.indexOf(this.largestUnit);
    const end = COUNTER_UNITS.indexOf(this.smallestUnit);
    return start < 0 || end < 0 || start > end ? DEFAULT_UNITS : COUNTER_UNITS.slice(start, end + 1);
  }

  /** Recomputes the shown values from the clock, schedules the next tick and reports a finish once. */
  private tick(): void {
    this.stopTimer();
    const down = this.direction !== 'up';
    const units = this.units;
    const smallest = units[units.length - 1]!;
    const base = this.date !== undefined && this.date !== null && this.date !== ''
      ? toMilliseconds(this.date)
      : this.startedAt + (down ? (typeof this.duration === 'number' ? this.duration : Number.NaN) : 0);
    const target = base + this.shift;
    const now = this.pausedAt ?? Date.now();
    const diff = down ? target - now : now - target;
    // A countdown rounds up to the smallest unit so zero arrives with the finish; a count-up rounds down.
    const step = (down && COUNTER_UNIT_MS[smallest]) || 1000;
    const shown = Number.isFinite(diff)
      ? Math.max(0, (down ? Math.ceil(diff / step) : Math.floor(diff / step)) * step)
      : 0;
    const finished = down && Number.isFinite(diff) && shown === 0;

    let values: LyraCounterValues = {};
    if (Number.isFinite(diff)) {
      const from = down ? target - shown : target;
      values = splitDuration(new Date(from), new Date(from + shown), units[0]!, smallest, down);
    }
    if (COUNTER_UNITS.some(unit => values[unit] !== this.values[unit])) this.values = values;
    if (finished !== this.finished) {
      this.finished = finished;
      setCustomState(this.internals, 'finished', finished);
    }

    if (Number.isFinite(diff) && !finished && this.pausedAt === null && this.isConnected) {
      // Wake at the next whole step of the difference so the display changes on time.
      const delay = down ? diff % step || step : 1000 - (((diff % 1000) + 1000) % 1000);
      this.timer = setTimeout(() => this.tick(), Math.max(1, finiteNumber(delay, 1000)));
    }

    // Only a countdown that reaches zero while running finishes; one that starts at zero does not.
    if (finished && this.counting) {
      const generation = ++this.generation;
      void this.updateComplete.then(() => {
        if (generation === this.generation && this.finished) this.emit('lr-finish', null);
      });
    }
    this.counting = down && shown > 0;
  }

  private unitLabel(value: number, unit: LyraCounterUnit, display: LyraCounterFormat): string {
    return getNumberFormat(this.effectiveLocale, { style: 'unit', unit: unit.slice(0, -1), unitDisplay: display })
      .formatToParts(value)
      .filter(part => part.type === 'unit')
      .map(part => part.value)
      .join('');
  }

  private unitValue(value: number, unit: LyraCounterUnit): string {
    if (typeof this.valueFormatter === 'function') {
      try {
        return String(this.valueFormatter(value, unit));
      } catch {
        return '';
      }
    }
    return getNumberFormat(this.effectiveLocale, { minimumIntegerDigits: 2 }).format(value);
  }

  private onFinishedSlotChange(event: Event): void {
    this.hasFinishedContent = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(
      node => node.nodeType === Node.ELEMENT_NODE || (node.textContent ?? '').trim() !== '',
    );
  }

  protected override render(): TemplateResult {
    const units = this.units;
    const display = FORMATS.includes(this.format) ? this.format : 'long';
    const firstNonZero = units.findIndex(unit => this.values[unit]);
    // Leading zero units are dropped, but the smallest unit stays when everything is zero.
    const spoken = units.slice(firstNonZero < 0 ? -1 : firstNonZero);
    const phrase = spoken
      .map(unit =>
        getNumberFormat(this.effectiveLocale, { style: 'unit', unit: unit.slice(0, -1), unitDisplay: 'long' }).format(
          this.values[unit] ?? 0,
        ),
      )
      .join(' ');
    const hasValues = Object.keys(this.values).length > 0;
    const shown = this.withoutLabels || !hasValues ? units : spoken;
    const widest = units.map(unit =>
      [0, 1, 2, 5]
        .map(sample => this.unitLabel(sample, unit, display))
        .reduce((longest, label) => (label.length > longest.length ? label : longest), ''),
    );
    const showFinished = this.finished && this.hasFinishedContent;

    const unitTemplates = shown.map((unit, index) => {
      const value = this.values[unit] ?? 0;
      const delimiter = index > 0 && this.delimiter
        ? html`<span part="delimiter" aria-hidden="true">${this.delimiter}</span>`
        : nothing;
      // No whitespace between the spans so the output is safe inside white-space: pre.
      return html`${delimiter}<span part="unit" aria-hidden="true"><span part="value">${this.unitValue(value, unit)}</span><span part="label"><slot name=${unit}><span class="label-stack"><span>${this.unitLabel(value, unit, display)}</span>${widest.map(label => html`<span class="sizer" aria-hidden="true">${label}</span>`)}</span></slot></span></span>`;
    });

    return html`<span part="finished" ?hidden=${!showFinished}><slot name="finished" @slotchange=${this.onFinishedSlotChange}></slot></span>${showFinished
      ? nothing
      : html`<span part="base" role="timer" aria-label=${this.label || nothing}><span class="sr-only">${phrase}</span>${unitTemplates}</span>`}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-counter': LyraCounter;
  }
}
