import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { pauseIcon, playIcon } from '../../internal/icons.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import { styles } from './poll-status.styles.js';

export interface LyraPollStatusEventMap {
  'lyra-poll-due': CustomEvent<undefined>;
  'lyra-pause-change': CustomEvent<boolean>;
}

const TICK_MS = 1000;

/**
 * `<lyra-poll-status>` — a "next scheduled refresh" countdown with a built-in pause control: a
 * ticking `M:SS` display counting down to the next scheduled action, a "Refreshing…" state at
 * zero, and a pause/resume toggle. First-party invention (no Web Awesome equivalent); the
 * closest existing component, `lyra-stream-status`, is scoped to transport/connection-health
 * phases, a different concern from a scheduled-interval countdown -- this mirrors its internal
 * `<lyra-live-region>` composition for accessible phase-transition announcements.
 *
 * @customElement lyra-poll-status
 * @event lyra-poll-due - Fired once when the countdown reaches zero (not fired while `paused`).
 * @event lyra-pause-change - Fired when `paused` changes via the built-in button. `detail: boolean`.
 * @csspart base - The root wrapper.
 * @csspart indicator - The pulsing status dot.
 * @csspart countdown - The `M:SS` (or "Refreshing…") text.
 * @csspart pause-button - The built-in pause/resume toggle.
 */
export class LyraPollStatus extends LyraElement<LyraPollStatusEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Milliseconds until the next scheduled action, as of whenever this was last set -- setting it
   *  (re)starts the countdown from "now." Unset (the default) shows no countdown. */
  @property({ type: Number, attribute: 'next-in-ms' }) nextInMs?: number;

  /** Whether the poll cycle is running at all. `true` (the default). */
  @property({ type: Boolean, reflect: true }) active = true;

  /** User-toggled pause -- while `true`, the countdown display freezes and `lyra-poll-due` never
   *  fires. `false` (the default). */
  @property({ type: Boolean, reflect: true }) paused = false;

  @state() private remainingMs = 0;
  @state() private due = false;
  private tickTimer?: ReturnType<typeof setInterval>;
  private targetAt = 0;

  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.active && !this.paused) this.armTicker();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disarmTicker();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('nextInMs') && this.nextInMs != null) {
      this.targetAt = Date.now() + this.nextInMs;
      this.due = false;
      this.remainingMs = this.nextInMs;
      if (this.active && !this.paused) this.armTicker();
    }
    if (changed.has('paused')) {
      if (this.paused) {
        this.disarmTicker();
        this.announce(this.localize('pollPausedAnnounce'));
      } else {
        if (this.active) this.armTicker();
        this.announce(this.localize('pollResumedAnnounce'));
      }
    }
    if (changed.has('active')) {
      if (this.active && !this.paused) this.armTicker();
      else this.disarmTicker();
    }
  }

  private armTicker(): void {
    this.disarmTicker();
    this.tickTimer = setInterval(() => {
      this.remainingMs = Math.max(0, this.targetAt - Date.now());
      if (this.remainingMs === 0 && !this.due) {
        this.due = true;
        this.disarmTicker();
        this.emit('lyra-poll-due');
        this.announce(this.localize('pollRefreshingAnnounce'));
      }
    }, TICK_MS);
  }

  private disarmTicker(): void {
    if (this.tickTimer !== undefined) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
  }

  private announce(text: string): void {
    const region = this.liveRegion;
    if (!region) return;
    region.mode = 'polite';
    region.announce(text, { force: true });
  }

  private togglePause = (): void => {
    this.paused = !this.paused;
    this.emit<boolean>('lyra-pause-change', this.paused);
  };

  private formatCountdown(): string {
    if (this.due) return this.localize('pollRefreshing');
    const totalSeconds = Math.ceil(this.remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  render(): TemplateResult {
    return html`
      <div part="base">
        <span part="indicator" aria-hidden="true" ?data-due=${this.due}></span>
        <span part="countdown">${this.nextInMs != null ? this.formatCountdown() : nothing}</span>
        <button
          part="pause-button"
          type="button"
          aria-pressed=${this.paused ? 'true' : 'false'}
          aria-label=${this.localize(this.paused ? 'pollResume' : 'pollPause')}
          @click=${this.togglePause}
        >${this.paused ? playIcon() : pauseIcon()}</button>
        <lyra-live-region></lyra-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-poll-status': LyraPollStatus;
  }
}
