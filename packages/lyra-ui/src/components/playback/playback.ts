import { html, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { playIcon, pauseIcon } from '../../internal/icons.js';
import { styles } from './playback.styles.js';

/**
 * `<lyra-playback>` — steps an index through `[0, length)` on a fixed
 * interval (play/pause), like the manual play-timers duplicated across
 * per-repo time-series dashboards.
 *
 * @customElement lyra-playback
 * @event lyra-play
 * @event lyra-pause
 * @event lyra-step - `detail: { index }`, fired on every tick and manual step.
 * @csspart base, play-button, slider
 */
export class LyraPlayback extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ type: Number }) length = 0;
  @property({ type: Number }) index = 0;
  @property({ type: Number, attribute: 'interval-ms' }) intervalMs = 900;
  @property({ type: Boolean, reflect: true }) playing = false;
  @property({ type: Boolean }) loop = true;

  /**
   * Re-declared as a Lit reactive property (shadowing the inherited plain
   * `HTMLElement.hidden` IDL property) so that setting `el.hidden = true` —
   * or the `hidden` attribute — actually enters Lit's change-tracking system
   * and the `willUpdate` auto-pause guard below can see it via `changed`.
   * `reflect: true` preserves the native attribute-reflection behavior.
   */
  @property({ type: Boolean, reflect: true }) hidden = false;

  private timer?: number;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pause();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('hidden') && this.hidden) this.pause();
  }

  /** Start playback; no-op if there's nothing to advance through. */
  play(): void {
    if (this.playing || this.length <= 1) return;
    this.playing = true;
    this.emit('lyra-play');
    this.timer = window.setInterval(() => this.tick(), this.intervalMs);
  }

  /** Stop playback. */
  pause(): void {
    if (!this.playing) return;
    window.clearInterval(this.timer);
    this.timer = undefined;
    this.playing = false;
    this.emit('lyra-pause');
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
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
    this.setIndex(Math.min(this.length - 1, Math.max(0, index)));
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
          max=${Math.max(0, this.length - 1)}
          .value=${String(this.index)}
          aria-label="Playback position"
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
