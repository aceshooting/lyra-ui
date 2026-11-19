import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, query } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { playIcon, pauseIcon } from '../../../internal/icons.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { finiteCount, finiteDuration, isSliderKey } from '../../../internal/numbers.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { preserveRangeKeyboardShortcut } from '../../../internal/range-keyboard-shortcut.js';
import { styles } from './sequence-playback.styles.js';
import { registerSequencePlayback, type SequencePlaybackCommands, type SequencePlaybackOwner, type SequencePlaybackProjection } from '../../../internal/sequence-playback-binding.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_pause, LYRA_DEFAULT_play, LYRA_DEFAULT_playbackPosition, LYRA_DEFAULT_playbackStepPosition } from '../../../internal/default-strings/media.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const DEFAULT_INTERVAL_MS = 900;
const MIN_INTERVAL_MS = 16; // ~one animation frame; prevents a near-zero-delay tick loop
const INVALID_INTERVAL_WARNING_KEY = 'lyra-sequence-playback-invalid-interval';
const INVALID_INTERVAL_WARNING =
  '<lr-sequence-playback>: interval-ms is outside the supported timer range and the timer delay was clamped.';

function warnInvalidInterval(): void {
  devWarnOnce(INVALID_INTERVAL_WARNING_KEY, INVALID_INTERVAL_WARNING);
}

/** Formats a zero-based sequence index as caller-owned plain text. */
export type SequencePlaybackValueFormatter = (currentIndex: number) => string | null | undefined;

export interface LyraSequencePlaybackStepDetail {
  currentIndex: number;
}

export interface LyraSequencePlaybackEventMap {
  'lr-play': CustomEvent<null>;
  'lr-pause': CustomEvent<null>;
  'lr-sequence-step': CustomEvent<LyraSequencePlaybackStepDetail>;
  blur: FocusEvent;
  focus: FocusEvent;
}
/**
 * `<lr-sequence-playback>` — steps a current index through `[0, itemCount)` on a fixed
 * interval (play/pause), the common building block behind ad-hoc
 * play-timers in time-series dashboards.
 *
 * @customElement lr-sequence-playback
 * @slot play-icon - Decorative play glyph shown while paused; rendered inert and `aria-hidden` inside the
 *   play/pause button, so it must not be a second interactive control. The built-in glyph is the fallback.
 * @slot pause-icon - Decorative pause glyph shown while playing, through the same inert layer.
 * @event lr-play - Fired when playback starts.
 * @event lr-pause - Fired when playback stops (including auto-pause).
 * @event lr-sequence-step - `detail: { currentIndex }`, fired on every tick and manual step.
 * @event {FocusEvent} blur - Relayed once from an internal playback control as a bubbling,
 *   composed native event.
 * @event {FocusEvent} focus - Relayed once from an internal playback control as a bubbling,
 *   composed native event.
 * @csspart base - The playback controls wrapper.
 * @csspart play-button - The play/pause button; disabled resting paint is retained under hover and press.
 * @csspart slider - The playback position slider.
 * @csspart value - Optional non-live position readout shown by `with-value`.
 * @cssprop [--lr-sequence-playback-icon-size=calc(var(--lr-icon-button-size) * 0.35)] - Font size of the
 *   play/pause glyph, derived from the shared icon-button hit-target size.
 * @cssprop [--lr-sequence-playback-play-button-hover-border-color=var(--lr-color-brand)] - Hovered
 *   play/pause button border color; read as an inline fallback so an ancestor value inherits.
 * @cssprop --lr-sequence-playback-play-button-active-bg - Pressed play/pause button background. Defaults
 *   to the existing surface active mix; read as an inline fallback so an ancestor value inherits.
 * @cssprop [--lr-sequence-playback-play-button-active-border-color=var(--lr-color-brand)] - Pressed
 *   play/pause button border color; read as an inline fallback so an ancestor value inherits.
 * @status stable
 * @since 9.0.0
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

  /** `playing` is reflected output, not input. */
  protected static readonly knownUnobservedAttributes: readonly string[] = ['playing'];

  /** Total number of sequence items; the current-index range is `[0, itemCount)`. */
  @property({ type: Number, attribute: 'item-count' }) itemCount = 0;
  /** The current sequence item, in `[0, itemCount)`. */
  @property({ type: Number, attribute: 'current-index' }) currentIndex = 0;
  /** Delay between ticks, in milliseconds, while playing. Clamped to the timer-safe range in
   *  `scheduleTick()`. */
  @property({ type: Number, attribute: 'interval-ms' }) intervalMs = DEFAULT_INTERVAL_MS;

  /** Second spelling of `intervalMs`, matching `lr-carousel`'s `autoplay-interval`. */
  // numeric-guard-exempt: alias accessor over intervalMs, which scheduleTick() normalizes with finiteDuration()
  @property({ type: Number, attribute: 'autoplay-interval', noAccessor: true })
  get autoplayInterval(): number {
    return this.intervalMs;
  }
  set autoplayInterval(value: number) {
    this.intervalMs = value;
  }

  /** Stops standalone playback on the last item instead of wrapping. Starting again from that
   *  item restarts at zero. Read on every tick; dormant while a source clock owns playback. */
  @property({ type: Boolean, attribute: 'without-loop' }) withoutLoop = false;

  /** Optional synchronous, side-effect-free formatter for the normalized zero-based index.
   *  Its plain text supplies `aria-valuetext` and the optional visible value. Nullish, nonstring,
   *  or thrown results use the localized ordinal; an explicit empty string remains empty.
   *  Mutating playback during formatting discards that result without immediately retrying it. */
  @property({ attribute: false }) valueFormatter?: SequencePlaybackValueFormatter;

  /** Show a non-live position readout below the slider. Hidden by default. */
  @property({ type: Boolean, attribute: 'with-value' }) withValue = false;

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
  private playbackGeneration = 0;
  private indexRevision = 0;
  private formatGeneration = 0;
  private formatting = false;
  private suppressFormatter = false;
  @query('[part="play-button"]') private playButton?: HTMLButtonElement;

  private boundCommands?: SequencePlaybackCommands;
  private releaseBinding?: () => void;
  private bindingGeneration = 0;
  private boundProjection?: SequencePlaybackProjection;
  private silentRestoration = false;

  constructor() {
    super();
    registerSequencePlayback(this, {
      available: () => !this.boundCommands,
      attach: (commands, released) => this.attachBinding(commands, released),
    });
  }

  override requestUpdate(...args: Parameters<LyraElement['requestUpdate']>): void {
    this.formatGeneration = (this.formatGeneration ?? 0) + 1;
    this.suppressFormatter = this.formatting === true;
    super.requestUpdate(...args);
  }

  private attachBinding(commands: SequencePlaybackCommands, released: () => void): SequencePlaybackOwner {
    const count = this.itemCount, index = this.currentIndex;
    const generation = ++this.bindingGeneration;
    this.playbackGeneration++;
    this.clearTimer(); this._playing = false; this.toggleAttribute('playing', false);
    this.boundCommands = commands;
    this.releaseBinding = released;
    const current = (): boolean => this.bindingGeneration === generation && this.boundCommands === commands;
    return {
      current,
      project: (value, forceStep = false, silent = false) => {
        if (!current()) return;
        const previousIndex = this.currentIndex, previousPlaying = this._playing;
        this.boundProjection = value;
        this.itemCount = value.count; this.currentIndex = value.index; this._playing = value.playing;
        this.toggleAttribute('playing', value.playing); this.requestUpdate();
        if (!silent && previousPlaying !== value.playing) this.emit(value.playing ? 'lr-play' : 'lr-pause');
        if (current() && !silent && (forceStep || previousIndex !== value.index)) this.emit('lr-sequence-step', { currentIndex: value.index });
      },
      release: () => {
        if (!current()) return;
        this.playbackGeneration++;
        this.bindingGeneration++; this.boundCommands = undefined; this.boundProjection = undefined; this.releaseBinding = undefined;
        this.clearTimer(); this._playing = false; this.toggleAttribute('playing', false);
        this.silentRestoration = true;
        this.itemCount = finiteCount(count); this.currentIndex = finiteCount(index, 0, Math.max(0, finiteCount(count) - 1));
        this.requestUpdate();
      },
    };
  }

  override adoptedCallback(): void {
    this.playbackGeneration++;
    this.releaseBinding?.();
    super.adoptedCallback();
  }

  /** Whether playback is running. Read-only state, reflected as the `playing` attribute; use `play()`, `pause()` and `toggle()`. */
  get playing(): boolean {
    return this._playing;
  }

  private setPlaying(next: boolean): void {
    if (next === this._playing || (next && finiteCount(this.itemCount) <= 1)) return;
    const generation = ++this.playbackGeneration;
    const document = this.ownerDocument;
    const connected = this.isConnected;
    const count = finiteCount(this.itemCount);
    const restart = next && this.withoutLoop &&
      finiteCount(this.currentIndex, 0, this.maxIndex) === this.maxIndex;
    if (restart) this.currentIndex = 0;
    this._playing = next;
    this.toggleAttribute('playing', next);
    this.requestUpdate();
    if (next) {
      const current = (): boolean => generation === this.playbackGeneration && this._playing &&
        !this.boundCommands && this.ownerDocument === document && this.isConnected === connected &&
        finiteCount(this.itemCount) > 1;
      const resetRevision = this.indexRevision;
      this.emit('lr-play');
      if (!current()) return;
      if (restart && this.indexRevision === resetRevision && this.currentIndex === 0 && finiteCount(this.itemCount) === count) {
        this.emit('lr-sequence-step', { currentIndex: 0 });
      }
      if (current()) this.scheduleTick();
    } else {
      this.clearTimer();
      this.emit('lr-pause');
    }
  }

  /** Largest index reachable at the current `itemCount` (never negative, and
   * never NaN — a non-finite `itemCount` falls back to 0 rather than leaking a
   * literal "NaN" into the rendered slider's `max` attribute). */
  private get maxIndex(): number {
    return Math.max(0, finiteCount(this.itemCount) - 1);
  }

  override disconnectedCallback(): void {
    if (this.boundCommands) this.releaseBinding?.();
    else this.pause();
    this.clearTimer();
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (this.boundCommands && changed.has('hidden') && this.hidden) this.releaseBinding?.();
    if (this.boundCommands && this.boundProjection) {
      this.itemCount = this.boundProjection.count; this.currentIndex = this.boundProjection.index;
      return;
    }
    if (this.silentRestoration) { this.silentRestoration = false; return; }
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
    if (changed.has('currentIndex') && !changed.has('itemCount') && currentIndex > this.maxIndex) {
      this.currentIndex = this.maxIndex;
    }
    if (changed.has('itemCount')) {
      // If itemCount is externally reduced to <= 1 while playing, the timer
      // would otherwise keep firing forever — and the play button (the only
      // control that could stop it) becomes ?disabled at that point, leaving
      // no way to stop it from the rendered UI.
      if (this.itemCount <= 1) this.pause();
      // Re-clamp `currentIndex` into the new `[0, itemCount)` range on any shrink, not
      // just the <= 1 case above, so it never lingers out of bounds. Goes through
      // `setIndex()` (not a raw assignment) so a consumer synced via `lr-sequence-step`
      // (e.g. an external step-N-of-M label) learns about this self-mutation too --
      // otherwise it would go stale while the component's own position already moved.
      if (this.currentIndex > this.maxIndex) this.setIndex(this.maxIndex);
    }
  }

  /** Start playback; no-op while playing or with fewer than two items. Standalone non-looping
   *  playback at its final item resets to zero before `lr-play`, followed by one reset step unless
   *  a listener supersedes the start. A bound source clock owns its own restart semantics. */
  play(): void {
    if (this.boundCommands) { this.boundCommands.play(); return; }
    this.setPlaying(true);
  }

  /** Stop playback. */
  pause(): void {
    if (this.boundCommands) { this.boundCommands.pause(); return; }
    this.setPlaying(false);
  }

  /** Toggle playing/paused; starting follows the same restart semantics as `play()`. */
  toggle(): void {
    if (this.boundCommands) { this.boundCommands.toggle(); return; }
    this.setPlaying(!this._playing);
  }

  // A self-rescheduling `setTimeout` (rather than one long-lived
  // `setInterval`) so `intervalMs` is re-read fresh before every tick, the
  // same way `tick()` already re-reads `this.withoutLoop` on every fire — changing
  // `interval-ms` live takes effect on the very next step instead of only
  // after a pause/play cycle.
  private scheduleTick(): void {
    const authoredDelay: number | null = this.intervalMs;
    const rawDelay = authoredDelay ?? DEFAULT_INTERVAL_MS;
    const delay = finiteDuration(rawDelay, MIN_INTERVAL_MS, MIN_INTERVAL_MS);
    if (delay !== rawDelay) warnInvalidInterval();
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
      if (this.playing && this.timer === id && this.timerWindow === timerWindow) {
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
      if (!this.withoutLoop) this.setIndex(0);
      else {
        this.setIndex(itemCount - 1);
        this.pause();
      }
    } else {
      this.setIndex(next);
    }
  }

  private setIndex(i: number): void {
    this.indexRevision++;
    this.currentIndex = finiteCount(i, 0, this.maxIndex);
    this.emit('lr-sequence-step', { currentIndex: this.currentIndex });
  }

  /** Advance one step, preserving playing/paused state; no-op at the final item. */
  next(): void {
    if (this.boundCommands) { this.boundCommands.next(); return; }
    const currentIndex = finiteCount(this.currentIndex);
    if (currentIndex + 1 < finiteCount(this.itemCount)) this.setIndex(currentIndex + 1);
  }

  /** Go back one step, preserving playing/paused state; no-op at the first item. */
  previous(): void {
    if (this.boundCommands) { this.boundCommands.previous(); return; }
    const currentIndex = finiteCount(this.currentIndex);
    if (currentIndex > 0) this.setIndex(currentIndex - 1);
  }

  /** Jump to an explicit current index, pausing playback. */
  goTo(currentIndex: number): void {
    if (this.boundCommands) { this.boundCommands.goTo(currentIndex); return; }
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
  };

  private onControlBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  // Native <input type=range> ArrowLeft/ArrowRight direction under dir="rtl" is NOT consistent
  // across engines (WebKit steps opposite of Chromium/Firefox), so the "next/previous" meaning
  // is pinned here in JS rather than left to the browser. Mirrors
  // image-comparer.class.ts's keyboardPosition().
  private keyboardStepDelta(key: string): number | undefined {
    const rtl = this.effectiveDirection === 'rtl';
    if (key === 'ArrowLeft') return rtl ? 1 : -1;
    if (key === 'ArrowRight') return rtl ? -1 : 1;
    return undefined;
  }

  private onSliderKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      if (isSliderKey(event.key)) preserveRangeKeyboardShortcut(event);
      return;
    }
    const delta = this.keyboardStepDelta(event.key);
    if (delta === undefined) return;
    event.preventDefault();
    this.goTo(finiteCount(this.currentIndex, 0, this.maxIndex) + delta);
  };

  private positionProjection(): { index: number; count: number; text: string } {
    const formatter = this.valueFormatter;
    const indexInput = this.currentIndex;
    const countInput = this.itemCount;
    const locale = this.effectiveLocale;
    const document = this.ownerDocument;
    const connected = this.isConnected;
    const generation = this.formatGeneration;
    const current = (): boolean => generation === this.formatGeneration &&
      formatter === this.valueFormatter && Object.is(indexInput, this.currentIndex) &&
      Object.is(countInput, this.itemCount) && locale === this.effectiveLocale &&
      document === this.ownerDocument && connected === this.isConnected;
    let custom: unknown;
    if (typeof formatter === 'function' && !this.suppressFormatter) {
      this.formatting = true;
      try {
        custom = formatter(finiteCount(indexInput, 0, Math.max(0, finiteCount(countInput) - 1)));
      } catch {
        // Consumer formatting cannot remove the native ordinal fallback.
      } finally {
        this.formatting = false;
      }
      if (!current()) this.suppressFormatter = true;
    }
    const coherent = current();
    const count = finiteCount(this.itemCount);
    const index = finiteCount(this.currentIndex, 0, Math.max(0, count - 1));
    const numberFormat = getNumberFormat(this.effectiveLocale);
    const text = coherent && typeof custom === 'string' ? custom :
      this.localize('playbackStepPosition', undefined, {
        index: numberFormat.format(index + 1),
        total: numberFormat.format(count),
      });
    return { index, count, text };
  }

  override render(): TemplateResult {
    const position = this.positionProjection();
    const disabled = position.count <= 1;
    return html`
      <div part="base" class=${this.withValue ? 'with-value' : nothing}>
        <button
          part="play-button"
          type="button"
          aria-label=${this.playing ? this.localize('pause') : this.localize('play')}
          ?disabled=${disabled}
          @click=${() => this.toggle()}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        >
          <span class="icon" aria-hidden="true" inert>${this.playing
            ? html`<slot name="pause-icon">${pauseIcon()}</slot>`
            : html`<slot name="play-icon">${playIcon()}</slot>`}</span>
        </button>
        <input
          part="slider"
          type="range"
          min="1"
          max=${Math.max(1, position.count)}
          .value=${String(position.index + 1)}
          aria-label=${this.localize('playbackPosition')}
          aria-valuetext=${position.text}
          ?disabled=${disabled}
          @input=${(e: Event) => this.goTo(Number((e.target as HTMLInputElement).value) - 1)}
          @keydown=${this.onSliderKeyDown}
          @focus=${this.onControlFocus}
          @blur=${this.onControlBlur}
        />
        ${this.withValue ? html`<span part="value" aria-hidden="true">${position.text}</span>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-sequence-playback': LyraSequencePlayback;
  }
}
