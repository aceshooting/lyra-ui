import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { AnnouncementSinkController } from '../../../internal/announcer.js';
import { blankNumberConverter } from '../../../internal/converters.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { prefersReducedMotion } from '../../../internal/motion.js';
import { observeReducedMotion } from '../../../internal/motion-observer.js';
import { finiteInteger, finiteNumber } from '../../../internal/numbers.js';
import { styles } from './number-ticker.styles.js';

/** The number style a ticker formats with. */
export type LyraNumberTickerType = 'decimal' | 'currency' | 'percent';
/** How a ticker displays its currency. */
export type LyraNumberTickerCurrencyDisplay = 'symbol' | 'narrowSymbol' | 'code' | 'name';

export interface LyraNumberTickerEventMap {
  'lr-finish': CustomEvent<null>;
}

const DEFAULT_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)';
const TYPES: readonly LyraNumberTickerType[] = ['decimal', 'currency', 'percent'];
const CURRENCY_DISPLAYS: readonly LyraNumberTickerCurrencyDisplay[] = ['symbol', 'narrowSymbol', 'code', 'name'];
const optionalDigits = blankNumberConverter(undefined);

/** Decimal places of a number, ignoring float noise such as 0.1 + 0.2. */
function decimalPlaces(n: number): number {
  const text = getNumberFormat('en-US', { maximumFractionDigits: 20, useGrouping: false }).format(
    Number(Number(n).toPrecision(15)),
  );
  return text.split('.')[1]?.length ?? 0;
}

/**
 * `<lr-number-ticker>` — counts to `value` when it scrolls into view, formatting every frame with
 * `Intl.NumberFormat` in the effective locale. Use it for dashboard figures and landing-page metrics.
 *
 * Under `prefers-reduced-motion: reduce` (or when `duration` is 0) it jumps straight to the final
 * value. Assistive technology never hears the animation: the counting text is `aria-hidden` and the
 * final value is present in visually hidden text from the start. A later `value` change after the
 * first count is announced once, politely, through the shared light-DOM live region. It renders its
 * start value during SSR and counts after hydration, once it is on screen.
 *
 * @customElement lr-number-ticker
 * @csspart base - The container around the displayed number.
 * @csspart value - The displayed (counting) number.
 * @cssstate counting - Applied while the number is counting.
 * @event lr-finish - The ticker settled on its value, including the instant reduced-motion and zero-duration paths.
 * @status experimental
 * @since unreleased
 */
export class LyraNumberTicker extends LyraElement<LyraNumberTickerEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The number to count to. Changing it after the first run counts on from the number shown. */
  @property({ converter: blankNumberConverter(0) }) value = 0;

  /** The number to count from on the first run and after `restart()`. */
  @property({ attribute: 'start-value', converter: blankNumberConverter(0) }) startValue = 0;

  /** The longest a count takes, in milliseconds. `0` skips the animation. */
  @property({ converter: blankNumberConverter(2000) }) duration = 2000;

  /** Milliseconds to wait before the first run's count begins. Later value changes are not delayed. */
  @property({ converter: blankNumberConverter(0) }) delay = 0;

  /** Any CSS easing function (`linear`, `ease-in-out`, `cubic-bezier()`, `steps()`, `linear()`); an invalid one falls back to the default. */
  @property() easing = DEFAULT_EASING;

  /** Starts counting right away instead of waiting until the ticker is half visible. */
  @property({ type: Boolean }) eager = false;

  /** The number style: `decimal` (the default), `currency` or `percent`. */
  @property() type: LyraNumberTickerType = 'decimal';

  /** Turns grouping separators off. */
  @property({ type: Boolean, attribute: 'without-grouping' }) withoutGrouping = false;

  /** The ISO 4217 currency code used when `type` is `currency`. */
  @property() currency = 'USD';

  /** How a currency is shown: `symbol` (the default), `narrowSymbol`, `code` or `name`. */
  @property({ attribute: 'currency-display' }) currencyDisplay: LyraNumberTickerCurrencyDisplay = 'symbol';

  /** Minimum integer digits, 1-21. */
  @property({ attribute: 'minimum-integer-digits', converter: optionalDigits }) minimumIntegerDigits?: number;

  /** Minimum fraction digits, 0-100. When only one fraction option is set it is used for both. */
  @property({ attribute: 'minimum-fraction-digits', converter: optionalDigits }) minimumFractionDigits?: number;

  /** Maximum fraction digits, 0-100. When only one fraction option is set it is used for both. */
  @property({ attribute: 'maximum-fraction-digits', converter: optionalDigits }) maximumFractionDigits?: number;

  /** Minimum significant digits, 1-21. */
  @property({ attribute: 'minimum-significant-digits', converter: optionalDigits }) minimumSignificantDigits?: number;

  /** Maximum significant digits, 1-21. */
  @property({ attribute: 'maximum-significant-digits', converter: optionalDigits }) maximumSignificantDigits?: number;

  /** Formats the number instead of `Intl.NumberFormat`; the formatting properties are then ignored. Property only. */
  @property({ attribute: false }) valueFormatter?: (value: number) => string;

  @state() private displayValue: number | null = null;

  private readonly internals = attachInternalsSafely(this);
  private readonly announcer = new AnnouncementSinkController(this);
  private observer?: IntersectionObserver;
  private stopMotionWatch?: () => void;
  private intersecting = false;
  private pending = true;
  private animation?: Animation;
  private frame = 0;
  private hasCounted = false;
  private run = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    const view = this.ownerDocument.defaultView;
    if (view && 'IntersectionObserver' in view) {
      // Half the ticker must be visible so a person scrolling to it sees the count.
      this.observer = new view.IntersectionObserver(
        entries => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          this.intersecting = entry.intersectionRatio >= 0.5;
          if (this.intersecting && this.pending) this.start();
        },
        { threshold: 0.5 },
      );
      this.observer.observe(this);
    }
    this.stopMotionWatch = observeReducedMotion(this, reduced => {
      if (reduced && this.animation) void this.finish();
    });
    // An eager ticker that was interrupted resumes without waiting to be seen.
    if (this.eager && this.pending && this.hasUpdated) this.start();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = undefined;
    this.stopMotionWatch?.();
    this.stopMotionWatch = undefined;
    this.intersecting = false;
    // An interrupted run resumes on reconnect; a finished ticker stays finished.
    if (this.animation) this.pending = true;
    this.stop();
  }

  protected override firstUpdated(changed: PropertyValues<this>): void {
    super.firstUpdated(changed);
    if (this.eager) this.startSoon();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!changed.has('value') || changed.get('value') === undefined) return;
    this.pending = true;
    // A run in progress picks up the new value even off screen.
    if (this.eager || this.intersecting || this.animation) this.startSoon();
  }

  /** Starts after the current update: a run writes `displayValue`, which must not re-enter `updated()`. */
  private startSoon(): void {
    void Promise.resolve().then(() => {
      if (this.isConnected && this.pending) this.start();
    });
  }

  /** Plays the count again from `startValue` to `value`. */
  restart(): void {
    this.stop();
    this.hasCounted = false;
    this.displayValue = null;
    this.pending = true;
    if (this.eager || this.intersecting) this.start();
  }

  private start(): void {
    const from = this.displayValue ?? finiteNumber(this.startValue, 0);
    const to = finiteNumber(this.value, 0);
    // The delay applies only when counting from the start value.
    const delay = this.displayValue === null ? Math.max(0, finiteNumber(this.delay, 0)) : 0;
    const duration = Math.max(0, finiteNumber(this.duration, 0));

    this.stop();
    this.pending = false;
    if (prefersReducedMotion(this) || !(duration > 0) || from === to || typeof this.animate !== 'function') {
      void this.finish();
      return;
    }

    const options = { duration, delay, fill: 'both' } as const;
    let animation: Animation;
    try {
      animation = this.animate(null, { ...options, easing: this.easing });
    } catch {
      animation = this.animate(null, { ...options, easing: DEFAULT_EASING });
    }
    this.animation = animation;
    const tick = (): void => {
      if (this.animation !== animation) return;
      const time = Number(animation.currentTime);
      if (animation.playState === 'finished' || animation.playState === 'idle' || time >= delay + duration) {
        void this.finish();
        return;
      }
      // displayValue stays null through the delay so an interrupted run keeps its delay.
      if (time >= delay) {
        setCustomState(this.internals, 'counting', true);
        const progress = animation.effect?.getComputedTiming().progress ?? 0;
        this.displayValue = from + (to - from) * finiteNumber(Number(progress), 0);
      }
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  private async finish(): Promise<void> {
    this.stop();
    const run = ++this.run;
    this.displayValue = finiteNumber(this.value, 0);
    await this.updateComplete;
    // A newer run started while rendering, or the element left the page.
    if (run !== this.run || this.animation || this.pending) return;
    // Announce before the event so a listener that changes the value cannot change what is spoken.
    if (this.hasCounted) this.announcer.announcePolite(this.format(this.displayValue ?? 0));
    if (this.value !== this.startValue) this.hasCounted = true;
    this.emit('lr-finish', null);
  }

  private stop(): void {
    cancelAnimationFrame(this.frame);
    setCustomState(this.internals, 'counting', false);
    const animation = this.animation;
    this.animation = undefined;
    animation?.cancel();
  }

  private format(n: number): string {
    if (!Number.isFinite(n)) return '';
    try {
      if (typeof this.valueFormatter === 'function') return String(this.valueFormatter(n));
      const type = TYPES.includes(this.type) ? this.type : 'decimal';
      const digit = (value: number | undefined, min: number, max: number): number | undefined =>
        value === undefined || !Number.isFinite(value) ? undefined : finiteInteger(value, min, min, max);
      const minFraction = digit(this.minimumFractionDigits, 0, 100);
      const maxFraction = digit(this.maximumFractionDigits, 0, 100);
      const minSignificant = digit(this.minimumSignificantDigits, 1, 21);
      const maxSignificant = digit(this.maximumSignificantDigits, 1, 21);
      // Plain decimals keep a steady number of places while counting so the width does not jitter.
      const steady =
        type === 'decimal' &&
        minFraction === undefined &&
        maxFraction === undefined &&
        minSignificant === undefined &&
        maxSignificant === undefined
          ? Math.max(decimalPlaces(this.startValue), decimalPlaces(this.value))
          : undefined;
      const options: Intl.NumberFormatOptions = {
        style: type,
        useGrouping: this.withoutGrouping ? false : undefined,
        minimumIntegerDigits: digit(this.minimumIntegerDigits, 1, 21),
        minimumFractionDigits: steady ?? minFraction ?? maxFraction,
        maximumFractionDigits: steady ?? maxFraction ?? minFraction,
        minimumSignificantDigits: minSignificant,
        maximumSignificantDigits: maxSignificant,
      };
      if (type === 'currency') {
        options.currency = (typeof this.currency === 'string' && this.currency.trim()) || 'USD';
        options.currencyDisplay = CURRENCY_DISPLAYS.includes(this.currencyDisplay) ? this.currencyDisplay : 'symbol';
      }
      const formatter = getNumberFormat(this.effectiveLocale, options);
      const text = formatter.format(n);
      // A small negative number that rounds to zero would print "-0"; show plain zero instead.
      return n < 0 && text === formatter.format(-0) ? formatter.format(0) : text;
    } catch {
      // Invalid options or a throwing formatter render nothing instead of throwing every frame.
      return '';
    }
  }

  protected override render(): TemplateResult {
    const shown = this.format(this.displayValue ?? finiteNumber(this.startValue, 0));
    const final = this.format(finiteNumber(this.value, 0));
    // Settled: the number is rendered once so selecting and copying never duplicates it.
    if (shown === final) return html`<span part="base"><span part="value">${final}</span></span>`;
    // No whitespace between the spans so the output is safe inside white-space: pre.
    return html`<span part="base"><span part="value" aria-hidden="true">${shown}</span><span class="sr-only">${final}</span></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-number-ticker': LyraNumberTicker;
  }
}
