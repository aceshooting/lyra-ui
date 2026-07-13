import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { playIcon, pauseIcon } from '../../internal/icons.js';
import { styles } from './playback.styles.js';

const MIN_INTERVAL_MS = 16; // ~one animation frame; prevents a near-zero-delay tick loop

// Deduplicated per distinct bad value (like the analogous one-time warnings
// in lyra-heatmap/lyra-word-cloud) rather than a single once-ever flag, so a
// later, genuinely different bad value is never silently swallowed by an
// earlier, unrelated one.
const warnedInvalidIntervals = new Set<number>();
function warnInvalidInterval(value: number): void {
  if (warnedInvalidIntervals.has(value)) return;
  warnedInvalidIntervals.add(value);
  // The clamp fires for *any* value below the floor, not only non-finite
  // ones (e.g. an ordinary `interval-ms="10"`) -- report the reason that
  // actually applies instead of always claiming "non-finite or non-positive".
  const reason = Number.isFinite(value) ? `below the ${MIN_INTERVAL_MS}ms floor` : 'non-finite';
  console.warn(
    `<lyra-playback> interval-ms (${value}) is ${reason}; clamping to ${MIN_INTERVAL_MS}ms.`,
  );
}

/**
 * `<lyra-playback>` — steps an index through `[0, length)` on a fixed
 * interval (play/pause), the common building block behind ad-hoc
 * play-timers in time-series dashboards.
 *
 * @customElement lyra-playback
 * @event lyra-play - Fired when playback starts.
 * @event lyra-pause - Fired when playback stops (including auto-pause).
 * @event lyra-step - `detail: { index }`, fired on every tick and manual step.
 * @csspart base, play-button, slider
 */
export class LyraPlayback extends LyraElement {
  static styles = [LyraElement.styles, styles];

  static properties = {
    playing: { type: Boolean, reflect: true, noAccessor: true },
    loop: { type: Boolean },
  };

  @property({ type: Number }) length = 0;
  @property({ type: Number }) index = 0;
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
  @property({ type: Boolean, reflect: true }) hidden = false;

  private timer?: number;
  private _playing = false;

  get playing(): boolean {
    return this._playing;
  }
  set playing(next: boolean) {
    const old = this._playing;
    if (next === old) return;
    this._playing = next;
    if (next) {
      if (this.length <= 1) {
        this._playing = false;
        return;
      }
      this.emit('lyra-play');
      this.scheduleTick();
    } else {
      window.clearTimeout(this.timer);
      this.timer = undefined;
      this.emit('lyra-pause');
    }
    this.requestUpdate('playing', old);
  }

  /** Largest index reachable at the current `length` (never negative, and
   * never NaN — a non-finite `length` falls back to 0 rather than leaking a
   * literal "NaN" into the rendered slider's `max` attribute). */
  private get maxIndex(): number {
    return Number.isFinite(this.length) ? Math.max(0, this.length - 1) : 0;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pause();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hidden') && this.hidden) this.pause();
    // A non-finite `length`/`index` (e.g. externally assigned NaN) must not
    // linger: `maxIndex` already falls back to a safe value for rendering,
    // but `next()`/`previous()` compare `index`/`length` directly and would
    // otherwise stay permanently bricked (NaN comparisons are always
    // false). Checked unconditionally — not just under the `length` branch
    // below — so a corrupted `index` alone still self-heals on the very next
    // update, without requiring `length` to also change.
    if (!Number.isFinite(this.length)) this.length = 0;
    if (!Number.isFinite(this.index)) this.index = 0;
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
    if (this.playing || this.length <= 1) return;
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
    let delay = this.intervalMs;
    if (!Number.isFinite(delay) || delay < MIN_INTERVAL_MS) {
      warnInvalidInterval(delay);
      delay = MIN_INTERVAL_MS;
    }
    // Self-identifying: a synchronous pause()+play() (or a synchronous
    // play() from a 'lyra-pause'/'lyra-step' listener) invoked while this
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
    const next = this.index + 1;
    if (next >= this.length) {
      if (this.loop) this.setIndex(0);
      else {
        this.setIndex(this.length - 1);
        this.pause();
      }
    } else {
      this.setIndex(next);
    }
  }

  private setIndex(i: number): void {
    this.index = i;
    this.emit('lyra-step', { index: this.index });
  }

  /** Advance one step without starting playback. */
  next(): void {
    if (this.index + 1 < this.length) this.setIndex(this.index + 1);
  }

  /** Go back one step without starting playback. */
  previous(): void {
    if (this.index > 0) this.setIndex(this.index - 1);
  }

  /** Jump to an explicit index, pausing playback. */
  goTo(index: number): void {
    this.pause();
    this.setIndex(Math.min(this.maxIndex, Math.max(0, index)));
  }

  render(): TemplateResult {
    return html`
      <div part="base">
        <button
          part="play-button"
          type="button"
          aria-label=${this.playing ? 'Pause' : 'Play'}
          ?disabled=${this.length <= 1}
          @click=${() => this.toggle()}
        >
          ${this.playing ? pauseIcon() : playIcon()}
        </button>
        <input
          part="slider"
          type="range"
          min="0"
          max=${this.maxIndex}
          .value=${String(this.index)}
          aria-label="Playback position"
          ?disabled=${this.length <= 1}
          @input=${(e: Event) => this.goTo(Number((e.target as HTMLInputElement).value))}
        />
      </div>
    `;
  }
}

defineElement('playback', LyraPlayback);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-playback': LyraPlayback;
  }
}
