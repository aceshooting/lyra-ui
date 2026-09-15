import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './format.styles.js';
import { getRelativeTimeFormat } from '../../../internal/intl-cache.js';
import { finiteDuration } from '../../../internal/numbers.js';
import {
  relativeTimeFormatOptions,
  dateSourceConverter,
  resolveDateSource,
  relativeTimeDivisor,
  resolveRelativeTimeState,
  RELATIVE_TIME_UNITS,
  type LyraFormatDisplay,
  type LyraRelativeTimeNumeric,
  type LyraRelativeTimeUnit,
} from './format-options.js';

export type {
  LyraFormatDisplay as RelativeTimeFormat,
  LyraRelativeTimeNumeric,
  LyraRelativeTimeUnit,
} from './format-options.js';

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
    const divisor = relativeTimeDivisor(state.selected);
    const roundedBoundary = state.seconds - (state.value - 0.5) * divisor;
    const candidates = [roundedBoundary];
    if (state.requestedUnit === 'auto') {
      const index = RELATIVE_TIME_UNITS.indexOf(state.selected);
      const magnitude = Math.abs(state.seconds);
      if (state.seconds >= 0 && state.selected !== 'second') {
        candidates.push(magnitude - divisor);
      } else if (state.seconds < 0 && index > 0) {
        candidates.push(relativeTimeDivisor(RELATIVE_TIME_UNITS[index - 1]!) - magnitude);
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
    const target = resolveDateSource(this.date)?.getTime();
    if (target === undefined) return undefined;
    const seconds = (target - Date.now()) / 1000;
    return { target, ...resolveRelativeTimeState(seconds, this.unit) };
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
