import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { playIcon, pauseIcon } from '../../../internal/icons.js';
import { finiteCount, finiteDuration, MAX_TIMEOUT_MS } from '../../../internal/numbers.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { styles } from './sequence-playback.styles.js';
import { presenceTrueDefaultBooleanConverter as trueDefaultBooleanConverter } from '../../../internal/converters.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_pause, LYRA_DEFAULT_play, LYRA_DEFAULT_playbackPosition, LYRA_DEFAULT_playbackStepPosition } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const MIN_INTERVAL_MS = 16; // ~one animation frame; prevents a near-zero-delay tick loop

// Deduplicated per distinct bad value (like the analogous one-time warnings
// in lr-heatmap/lr-word-cloud) rather than a single once-ever flag, so a
// later, genuinely different bad value is never silently swallowed by an
// earlier, unrelated one.
const warnedInvalidIntervals = new Set<number>();
function warnInvalidInterval(value: number, normalized: number): void {
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
    `<lr-sequence-playback> interval-ms (${value}) is ${reason}; clamping to ${normalized}ms.`,
  );
}

export interface LyraSequencePlaybackStepDetail {
  currentIndex: number;
}

export interface LyraSequencePlaybackEventMap {
  'lr-play': CustomEvent<null>;
  'lr-pause': CustomEvent<null>;
  'lr-sequence-step': CustomEvent<LyraSequencePlaybackStepDetail>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<null>;
  'lr-focus': CustomEvent<null>;
}
/**
 * `<lr-sequence-playback>` — steps a current index through `[0, itemCount)` on a fixed
 * interval (play/pause), the common building block behind ad-hoc
 * play-timers in time-series dashboards.
 *
 * @customElement lr-sequence-playback
 * @event lr-play - Fired when playback starts.
 * @event lr-pause - Fired when playback stops (including auto-pause).
 * @event lr-sequence-step - `detail: { currentIndex }`, fired on every tick and manual step.
 * @event {FocusEvent} blur - Relayed once from an internal playback control as a bubbling,
 *   composed native event.
 * @event {FocusEvent} focus - Relayed once from an internal playback control as a bubbling,
 *   composed native event.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @csspart base - The playback controls wrapper.
 * @csspart play-button - The play/pause button.
 * @csspart slider - The playback position slider.
 * @cssprop [--lr-sequence-playback-icon-size=calc(var(--lr-icon-button-size) * 0.35)] - Font size of the
 *   play/pause glyph, derived from the shared icon-button hit-target size.
 * @cssprop --lr-sequence-playback-play-button-active-bg - Pressed play/pause button background. Defaults
 *   to the existing surface active mix; read as an inline fallback so an ancestor value inherits.
 * @cssprop [--lr-sequence-playback-play-button-active-border-color=var(--lr-color-brand)] - Pressed
 *   play/pause button border color; read as an inline fallback so an ancestor value inherits.
 * @status stable
 * @since unreleased
 */
export class LyraSequencePlayback extends LyraElement<LyraSequencePlaybackEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    pause: LYRA_DEFAULT_pause,
    play: LYRA_DEFAULT_play,
    playbackPosition: LYRA_DEFAULT_playbackPosition,
    playbackStepPosition: LYRA_DEFAULT_playbackStepPosition,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  static override properties = {
    playing: { type: Boolean, reflect: true, noAccessor: true },
    loop: { type: Boolean, converter: trueDefaultBooleanConverter },
  };

  /** Total number of sequence items; the current-index range is `[0, itemCount)`. */
  @property({ type: Number, attribute: 'item-count' }) itemCount = 0;
  /** The current sequence item, in `[0, itemCount)`. */
  @property({ type: Number, attribute: 'current-index' }) currentIndex = 0;
  /** Delay between ticks, in milliseconds, while playing. Clamped to
   *  `[MIN_INTERVAL_MS, MAX_TIMEOUT_MS]` — see `scheduleTick()`. */
  @property({ type: Number, attribute: 'interval-ms' }) intervalMs = 900;
  // `playing` is declared via `static properties` above (noAccessor) with a
  // hand-written accessor below, so a direct `el.playing = true/false`
  // assignment always drives the real timer — not just calls through
  // play()/pause().
  
  loop = true;

  /**
   * Re-declared as a Lit reactive property (shadowing the inherited plain
   * `HTMLElement.hidden` IDL property) so that setting `el.hidden = true` —
   * or the `hidden` attribute — actually enters Lit's change-tracking system
   * and the `willUpdate` auto-pause guard below can see it via `changed`.
   * `reflect: true` preserves the native attribute-reflection behavior.
   */
  @property({ type: Boolean, reflect: true }) override hidden = false;

  private timer?: number;
  private timerWindow?: Window;
  private _playing = false;
  /** Whether a requested playing state has crossed the valid-count boundary and owns a timer. */
  private running = false;
  @query('[part="play-button"]') private playButton?: HTMLButtonElement;

  get playing(): boolean {
    return this._playing;
  }
  set playing(next: boolean) {
    // During initial attribute upgrade, defer the count decision until `willUpdate()` has seen
    // every attribute; otherwise `<... playing item-count="3">` could depend on attribute order.
    // Once mounted, reject an impossible request synchronously so IDL and reflected presence can
    // never disagree during the gap before Lit's next update.
    if (Boolean(next) && this.hasUpdated && finiteCount(this.itemCount) <= 1) {
      if (this.hasAttribute('playing')) this.removeAttribute('playing');
      return;
    }
    const old = this._playing;
    const requested = Boolean(next);
    if (requested === old) return;
    this._playing = requested;
    this.requestUpdate('playing', old);
    if (requested) this.startIfPossible();
    else this.stopRunning();
  }

  /** Starts a requested playback only after all initial attributes have had a chance to upgrade. */
  private startIfPossible(): void {
    if (this.running || !this._playing || finiteCount(this.itemCount) <= 1) return;
    this.running = true;
    this.emit('lr-play');
    if (this.running && this._playing) this.scheduleTick();
  }

  private stopRunning(): void {
    this.clearTimer();
    if (!this.running) return;
    this.running = false;
    this.emit('lr-pause');
  }

  private rejectInvalidPlayingRequest(): void {
    if (!this._playing) return;
    const old = this._playing;
    this._playing = false;
    this.stopRunning();
    this.requestUpdate('playing', old);
  }

  /** Largest index reachable at the current `itemCount` (never negative, and
   * never NaN — a non-finite `itemCount` falls back to 0 rather than leaking a
   * literal "NaN" into the rendered slider's `max` attribute). */
  private get maxIndex(): number {
    return Math.max(0, finiteCount(this.itemCount) - 1);
  }

  override disconnectedCallback(): void {
    this.pause();
    this.clearTimer();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('hidden') && this.hidden) this.pause();
    // A non-finite `itemCount`/`currentIndex` (e.g. externally assigned NaN) must not
    // linger: `maxIndex` already falls back to a safe value for rendering,
    // but `next()`/`previous()` compare `currentIndex`/`itemCount` directly and would
    // otherwise stay permanently bricked (NaN comparisons are always
    // false). Checked unconditionally — not just under the `itemCount` branch
    // below — so a corrupted `currentIndex` alone still self-heals on the very next
    // update, without requiring `itemCount` to also change.
    const itemCount = finiteCount(this.itemCount);
    const currentIndex = finiteCount(this.currentIndex);
    if (itemCount !== this.itemCount) this.itemCount = itemCount;
    if (currentIndex !== this.currentIndex) this.currentIndex = currentIndex;
    if (changed.has('itemCount') || changed.has('playing')) {
      // If itemCount is externally reduced to <= 1 while playing, the timer
      // would otherwise keep firing forever — and the play button (the only
      // control that could stop it) becomes ?disabled at that point, leaving
      // no way to stop it from the rendered UI.
      if (this.itemCount <= 1) this.rejectInvalidPlayingRequest();
      else this.startIfPossible();
      // Re-clamp `currentIndex` into the new `[0, itemCount)` range on any shrink, not
      // just the <= 1 case above, so it never lingers out of bounds.
      if (this.currentIndex > this.maxIndex) this.currentIndex = this.maxIndex;
    }
  }

  /** Start playback; no-op if there's nothing to advance through. */
  play(): void {
    if (this.playing || finiteCount(this.itemCount) <= 1) return;
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
    if (delay !== rawDelay) warnInvalidInterval(rawDelay, delay);
    // Self-identifying: a synchronous pause()+play() (or a synchronous
    // play() from a 'lr-pause'/'lr-sequence-step' listener) invoked while this
    // callback is running schedules its own new timer and overwrites
    // `this.timer` before this callback resumes. Only the timer that is
    // still the current one is allowed to reschedule itself — every other,
    // now-superseded chain quietly stops instead of spawning a second,
    // untracked chain that pause()/disconnectedCallback() can never reach.
    const timerWindow = this.ownerDocument.defaultView;
    if (!timerWindow) return;
    const id = timerWindow.setTimeout(() => {
      if (this.timer !== id || this.timerWindow !== timerWindow) return;
      this.tick();
      if (this.running && this.playing && this.timer === id && this.timerWindow === timerWindow) {
        this.scheduleTick();
      }
    }, delay);
    this.timer = id;
    this.timerWindow = timerWindow;
  }

  private clearTimer(): void {
    if (this.timer !== undefined) this.timerWindow?.clearTimeout(this.timer);
    this.timer = undefined;
    this.timerWindow = undefined;
  }

  private tick(): void {
    const itemCount = finiteCount(this.itemCount);
    const next = finiteCount(this.currentIndex) + 1;
    if (next >= itemCount) {
      if (this.loop) this.setIndex(0);
      else {
        this.setIndex(itemCount - 1);
        this.pause();
      }
    } else {
      this.setIndex(next);
    }
  }

  private setIndex(i: number): void {
    this.currentIndex = finiteCount(i, 0, this.maxIndex);
    this.emit('lr-sequence-step', { currentIndex: this.currentIndex });
  }

  /** Advance one step without starting playback. */
  next(): void {
    const currentIndex = finiteCount(this.currentIndex);
    if (currentIndex + 1 < finiteCount(this.itemCount)) this.setIndex(currentIndex + 1);
  }

  /** Go back one step without starting playback. */
  previous(): void {
    const currentIndex = finiteCount(this.currentIndex);
    if (currentIndex > 0) this.setIndex(currentIndex - 1);
  }

  /** Jump to an explicit current index, pausing playback. */
  goTo(currentIndex: number): void {
    this.pause();
    this.setIndex(finiteCount(currentIndex, 0, this.maxIndex));
  }

  /** Focus the primary play/pause control. */
  override focus(options?: FocusOptions): void {
    this.playButton?.focus(options);
  }

  /** Blur the primary play/pause control. */
  override blur(): void {
    this.playButton?.blur();
  }

  /** Activate the primary play/pause control. */
  override click(): void {
    this.playButton?.click();
  }

  private onControlFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onControlBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  override render(): TemplateResult {
    const maxIndex = this.maxIndex;
    const currentIndex = finiteCount(this.currentIndex, 0, maxIndex);
    const disabled = finiteCount(this.itemCount) <= 1;
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
          min="1"
          max=${Math.max(1, finiteCount(this.itemCount))}
          .value=${String(currentIndex + 1)}
          aria-label=${this.localize('playbackPosition')}
          aria-valuetext=${this.localize('playbackStepPosition', undefined, {
            index: getNumberFormat(this.effectiveLocale).format(currentIndex + 1),
            total: getNumberFormat(this.effectiveLocale).format(finiteCount(this.itemCount)),
          })}
          ?disabled=${disabled}
          @input=${(e: Event) => this.goTo(Number((e.target as HTMLInputElement).value) - 1)}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sequence-playback': LyraSequencePlayback;
  }
}
