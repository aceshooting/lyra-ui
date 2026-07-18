import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { pauseIcon, playIcon } from '../../internal/icons.js';
import { finiteDuration } from '../../internal/numbers.js';
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
 * zero, a "Paused" state while `paused` (instead of freezing on a stale value), and a
 * pause/resume toggle. First-party invention (no Web Awesome equivalent); the
 * closest existing component, `lyra-stream-status`, is scoped to transport/connection-health
 * phases, a different concern from a scheduled-interval countdown -- this mirrors its internal
 * `<lyra-live-region>` composition for accessible phase-transition announcements.
 *
 * @customElement lyra-poll-status
 * @event lyra-poll-due - Fired once when the countdown reaches zero (not fired while `paused`).
 * @event lyra-pause-change - Fired when `paused` changes via the built-in button. `detail: boolean`.
 * @csspart base - The root wrapper.
 * @csspart indicator - The pulsing status dot.
 * @csspart countdown - The `M:SS` text (or "Refreshing…" once due, or "Paused" while `paused`).
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
    // A mount/reconnect with no scheduled deadline yet (nextInMs never set,
    // so targetAt is still its 0 default) must not start a ticker -- it
    // would immediately see targetAt - Date.now() <= 0 on its very first
    // tick and fire a spurious lyra-poll-due for a countdown that never ran.
    if (this.active && !this.paused && this.nextInMs != null) this.armTicker();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disarmTicker();
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('nextInMs')) {
      if (this.nextInMs != null) {
        // A NaN/negative nextInMs (a bad attribute, or a stray programmatic assignment) must not
        // reach `Date.now() + nextInMs` unsanitized -- that would poison `targetAt` with NaN,
        // which every subsequent tick's `Math.max(0, targetAt - Date.now())` also evaluates to
        // NaN (Math.max never recovers from a NaN operand), permanently bricking the countdown:
        // `remainingMs === 0` never becomes true, so the ticker runs forever and `lyra-poll-due`
        // never fires. Clamping to a non-negative, finite value up front (0 means "due
        // immediately," consistent with a countdown that's already reached zero) keeps the
        // ticker's own `Math.max(0, ...)` clamp meaningful instead of masking a NaN that already
        // got in.
        const nextInMs = finiteDuration(this.nextInMs, 0, 0);
        this.targetAt = Date.now() + nextInMs;
        this.due = false;
        this.remainingMs = nextInMs;
      } else {
        this.due = false;
        this.remainingMs = 0;
      }
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('nextInMs')) {
      if (this.nextInMs != null && this.active && !this.paused) {
        this.armTicker();
      } else {
        // Clearing next-in-ms (e.g. between poll cycles) must stop the
        // ticker armed for the previous deadline -- otherwise it keeps
        // running against a now-stale targetAt and eventually fires a
        // lyra-poll-due for a countdown the host no longer considers active,
        // while [part='countdown'] already renders nothing.
        this.disarmTicker();
      }
    }
    if (changed.has('paused')) {
      if (this.paused) {
        this.disarmTicker();
        this.announce(this.localize('pollPausedAnnounce'));
      } else {
        if (this.active && this.nextInMs != null) this.armTicker();
        this.announce(this.localize('pollResumedAnnounce'));
      }
    }
    if (changed.has('active')) {
      if (this.active && !this.paused && this.nextInMs != null) this.armTicker();
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
    if (this.paused) return this.localize('pollPaused');
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
