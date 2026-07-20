import { html, type ComplexAttributeConverter, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { playIcon, pauseIcon } from '../../../internal/icons.js';
import { finiteCount, finiteDuration, MAX_TIMEOUT_MS } from '../../../internal/numbers.js';
import { styles } from './playback.styles.js';

const MIN_INTERVAL_MS = 16; // ~one animation frame; prevents a near-zero-delay tick loop

/** `true`-defaulting boolean attribute converter, identical shape to `<lr-task-list>`'s
 *  `trueDefaultBooleanConverter` -- duplicated locally per this library's convention of not
 *  sharing these tiny converters across independently-consumable component files. Lit's default
 *  presence-based `type: Boolean` can never be set back to `false` from a plain-HTML attribute
 *  once the property's own default is `true` (removing an attribute that was never present fires
 *  no `attributeChangedCallback`), so `fromAttribute` checks the literal string instead.
 *  `toAttribute` reflects the `true` state as a present (empty-string) attribute rather than
 *  omitting it, matching every other `reflect: true` boolean property in this library -- though
 *  `loop` itself is not reflected today, this keeps the converter reusable if that changes. */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? '' : null;
  },
};

// Deduplicated per distinct bad value (like the analogous one-time warnings
// in lr-heatmap/lr-word-cloud) rather than a single once-ever flag, so a
// later, genuinely different bad value is never silently swallowed by an
// earlier, unrelated one.
const warnedInvalidIntervals = new Set<number>();
function warnInvalidInterval(value: number): void {
  if (warnedInvalidIntervals.has(value)) return;
  warnedInvalidIntervals.add(value);
  // The clamp fires for any value outside the timer-safe range, so report the
  // reason that actually applies instead of collapsing every bad value into
  // one misleading "non-finite or non-positive" message.
  const reason = !Number.isFinite(value)
    ? 'non-finite'
    : value < MIN_INTERVAL_MS
      ? `below the ${MIN_INTERVAL_MS}ms floor`
      : `above the ${MAX_TIMEOUT_MS}ms ceiling`;
  console.warn(
    `<lr-playback> interval-ms (${value}) is ${reason}; clamping to ${MIN_INTERVAL_MS}ms.`,
  );
}

export interface LyraPlaybackEventMap {
  'lr-play': CustomEvent<undefined>;
  'lr-pause': CustomEvent<undefined>;
  'lr-step': CustomEvent<{ index: number }>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}
/**
 * `<lr-playback>` — steps an index through `[0, length)` on a fixed
 * interval (play/pause), the common building block behind ad-hoc
 * play-timers in time-series dashboards.
 *
 * @customElement lr-playback
 * @event lr-play - Fired when playback starts.
 * @event lr-pause - Fired when playback stops (including auto-pause).
 * @event lr-step - `detail: { index }`, fired on every tick and manual step.
 * @event blur - Re-dispatched from an internal playback control as a bubbling, composed event.
 * @event focus - Re-dispatched from an internal playback control as a bubbling, composed event.
 * @csspart base - The playback controls wrapper.
 * @csspart play-button - The play/pause button.
 * @csspart slider - The playback position slider.
 * @cssprop [--lr-playback-icon-size=calc(var(--lr-icon-button-size) * 0.35)] - Font size of the
 *   play/pause glyph, derived from the shared icon-button hit-target size.
 */
export class LyraPlayback extends LyraElement<LyraPlaybackEventMap> {
  static styles = [LyraElement.styles, styles];

  static properties = {
    playing: { type: Boolean, reflect: true, noAccessor: true },
    loop: { type: Boolean, converter: trueDefaultBooleanConverter },
  };

  /** Total number of steps to play through; the index range is `[0, length)`. */
  @property({ type: Number }) length = 0;
  /** The current step, in `[0, length)`. */
  @property({ type: Number }) index = 0;
  /** Delay between ticks, in milliseconds, while playing. Clamped to
   *  `[MIN_INTERVAL_MS, MAX_TIMEOUT_MS]` — see `scheduleTick()`. */
  @property({ type: Number, attribute: 'interval-ms' }) intervalMs = 900;
  // `playing` is declared via `static properties` above (noAccessor) with a
  // hand-written accessor below, so a direct `el.playing = true/false`
  // assignment always drives the real timer — not just calls through
  // play()/pause().
  /** Whether playback wraps back to index 0 after the last step instead of pausing there. Defaults
   *  `true`; uses `trueDefaultBooleanConverter` (declared via `static properties` above) so plain
   *  HTML `loop="false"` actually clears it -- Lit's default presence-based `type: Boolean`
   *  converter cannot distinguish an absent attribute from the literal string `"false"`. */
  loop = true;

  /**
   * Re-declared as a Lit reactive property (shadowing the inherited plain
   * `HTMLElement.hidden` IDL property) so that setting `el.hidden = true` —
   * or the `hidden` attribute — actually enters Lit's change-tracking system
   * and the `willUpdate` auto-pause guard below can see it via `changed`.
   * `reflect: true` preserves the native attribute-reflection behavior.
   */
  @property({ type: Boolean, reflect: true }) hidden = false;

  private timer?: number;
  private _playing = false;
  @query('[part="play-button"]') private playButton?: HTMLButtonElement;

  get playing(): boolean {
    return this._playing;
  }
  set playing(next: boolean) {
    const old = this._playing;
    if (next === old) return;
    this._playing = next;
    if (next) {
      if (finiteCount(this.length) <= 1) {
        this._playing = false;
        return;
      }
      this.emit('lr-play');
      this.scheduleTick();
    } else {
      window.clearTimeout(this.timer);
      this.timer = undefined;
      this.emit('lr-pause');
    }
    this.requestUpdate('playing', old);
  }

  /** Largest index reachable at the current `length` (never negative, and
   * never NaN — a non-finite `length` falls back to 0 rather than leaking a
   * literal "NaN" into the rendered slider's `max` attribute). */
  private get maxIndex(): number {
    return Math.max(0, finiteCount(this.length) - 1);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pause();
  }

  protected willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('hidden') && this.hidden) this.pause();
    // A non-finite `length`/`index` (e.g. externally assigned NaN) must not
    // linger: `maxIndex` already falls back to a safe value for rendering,
    // but `next()`/`previous()` compare `index`/`length` directly and would
    // otherwise stay permanently bricked (NaN comparisons are always
    // false). Checked unconditionally — not just under the `length` branch
    // below — so a corrupted `index` alone still self-heals on the very next
    // update, without requiring `length` to also change.
    const length = finiteCount(this.length);
    const index = finiteCount(this.index);
    if (length !== this.length) this.length = length;
    if (index !== this.index) this.index = index;
    if (changed.has('length')) {
      // If length is externally reduced to <= 1 while playing, the timer
      // would otherwise keep firing forever — and the play button (the only
      // control that could stop it) becomes ?disabled at that point, leaving
      // no way to stop it from the rendered UI.
      if (this.length <= 1) this.pause();
      // Re-clamp `index` into the new `[0, length)` range on any shrink, not
      // just the <= 1 case above, so it never lingers out of bounds.
      if (this.index > this.maxIndex) this.index = this.maxIndex;
    }
  }

  /** Start playback; no-op if there's nothing to advance through. */
  play(): void {
    if (this.playing || finiteCount(this.length) <= 1) return;
    this.playing = true;
  }

  /** Stop playback. */
  pause(): void {
    if (!this.playing) return;
    this.playing = false;
  }

  /** Toggle between playing and paused. */
  toggle(): void {
    this.playing = !this.playing;
  }

  // A self-rescheduling `setTimeout` (rather than one long-lived
  // `setInterval`) so `intervalMs` is re-read fresh before every tick, the
  // same way `tick()` already re-reads `this.loop` on every fire — changing
  // `interval-ms` live takes effect on the very next step instead of only
  // after a pause/play cycle.
  private scheduleTick(): void {
    const rawDelay = this.intervalMs;
    const delay = finiteDuration(rawDelay, MIN_INTERVAL_MS, MIN_INTERVAL_MS);
    if (delay !== rawDelay) warnInvalidInterval(rawDelay);
    // Self-identifying: a synchronous pause()+play() (or a synchronous
    // play() from a 'lr-pause'/'lr-step' listener) invoked while this
    // callback is running schedules its own new timer and overwrites
    // `this.timer` before this callback resumes. Only the timer that is
    // still the current one is allowed to reschedule itself — every other,
    // now-superseded chain quietly stops instead of spawning a second,
    // untracked chain that pause()/disconnectedCallback() can never reach.
    const id = window.setTimeout(() => {
      this.tick();
      if (this.playing && this.timer === id) this.scheduleTick();
    }, delay);
    this.timer = id;
  }

  private tick(): void {
    const length = finiteCount(this.length);
    const next = finiteCount(this.index) + 1;
    if (next >= length) {
      if (this.loop) this.setIndex(0);
      else {
        this.setIndex(length - 1);
        this.pause();
      }
    } else {
      this.setIndex(next);
    }
  }

  private setIndex(i: number): void {
    this.index = finiteCount(i, 0, this.maxIndex);
    this.emit('lr-step', { index: this.index });
  }

  /** Advance one step without starting playback. */
  next(): void {
    const index = finiteCount(this.index);
    if (index + 1 < finiteCount(this.length)) this.setIndex(index + 1);
  }

  /** Go back one step without starting playback. */
  previous(): void {
    const index = finiteCount(this.index);
    if (index > 0) this.setIndex(index - 1);
  }

  /** Jump to an explicit index, pausing playback. */
  goTo(index: number): void {
    this.pause();
    this.setIndex(finiteCount(index, 0, this.maxIndex));
  }

  /** Focus the primary play/pause control. */
  override focus(options?: FocusOptions): void {
    this.playButton?.focus(options);
  }

  /** Blur the primary play/pause control. */
  override blur(): void {
    this.playButton?.blur();
  }

  private onControlFocus = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('focus');
  };

  private onControlBlur = (event: FocusEvent): void => {
    event.stopPropagation();
    this.emit('blur');
  };

  render(): TemplateResult {
    const maxIndex = this.maxIndex;
    const index = finiteCount(this.index, 0, maxIndex);
    const disabled = finiteCount(this.length) <= 1;
    return html`
      <div part="base">
        <button
          part="play-button"
          type="button"
          aria-label=${this.playing ? this.localize('pause') : this.localize('play')}
          ?disabled=${disabled}
          @click=${() => this.toggle()}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        >
          ${this.playing ? pauseIcon() : playIcon()}
        </button>
        <input
          part="slider"
          type="range"
          min="0"
          max=${maxIndex}
          .value=${String(index)}
          aria-label=${this.localize('playbackPosition')}
          ?disabled=${disabled}
          @input=${(e: Event) => this.goTo(Number((e.target as HTMLInputElement).value))}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        />
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-playback': LyraPlayback;
  }
}
