import { html, nothing, type ComplexAttributeConverter, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { pauseIcon, playIcon } from '../../../internal/icons.js';
import { finiteDuration } from '../../../internal/numbers.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import { styles } from './poll-status.styles.js';

export interface LyraPollStatusEventMap {
  'lr-poll-due': CustomEvent<undefined>;
  'lr-pause-change': CustomEvent<boolean>;
}

const TICK_MS = 1000;

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library
 *  (see e.g. `<lr-agent-run>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

/**
 * `<lr-poll-status>` — a "next scheduled refresh" countdown with a built-in pause control: a
 * ticking `M:SS` display counting down to the next scheduled action, a "Refreshing…" state at
 * zero, a "Paused" state while `paused` (instead of freezing on a stale value), and a
 * pause/resume toggle. First-party invention (no Web Awesome equivalent); the
 * closest existing component, `lr-stream-status`, is scoped to transport/connection-health
 * phases, a different concern from a scheduled-interval countdown -- this mirrors its internal
 * `<lr-live-region>` composition for accessible phase-transition announcements.
 *
 * @customElement lr-poll-status
 * @event lr-poll-due - Fired once when the countdown reaches zero (not fired while `paused`).
 * @event lr-pause-change - Fired when `paused` changes via the built-in button. `detail: boolean`.
 * @csspart base - The root wrapper.
 * @csspart indicator - The pulsing status dot.
 * @csspart countdown - The `M:SS` text (or "Refreshing…" once due, or "Paused" while `paused`).
 * @csspart pause-button - The built-in pause/resume toggle.
 * @cssprop [--lr-poll-status-due-bg=var(--lr-color-success)] - Background of `indicator` while
 *   `data-due` is set, without repainting every other component that reuses the shared success
 *   token.
 */
export class LyraPollStatus extends LyraElement<LyraPollStatusEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Milliseconds until the next scheduled action, as of whenever this was last set -- setting it
   *  (re)starts the countdown from "now." Unset (the default) shows no countdown. */
  @property({ type: Number, attribute: 'next-in-ms' }) nextInMs?: number;

  /** Whether the poll cycle is running at all. `true` (the default). */
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) active = true;

  /** User-toggled pause -- while `true`, the countdown display freezes and `lr-poll-due` never
   *  fires. `false` (the default). */
  @property({ type: Boolean, reflect: true }) paused = false;

  @state() private remainingMs = 0;
  @state() private due = false;
  private tickTimer?: ReturnType<typeof setInterval>;
  private targetAt = 0;

  /** True only until the component's first completed update -- gates the pause/resume
   *  announcement below so mounting with `paused`'s default `false` value never announces
   *  "Resumed." as though a user actually toggled it (mirrors `<lr-chat-message>`'s and
   *  `<lr-branch-picker>`'s identical `isMounting` gate for their own first-update announcements:
   *  Lit's ReactiveElement records every declared reactive property as changed during
   *  construction, so `changed.has('paused')` is true on the very first `updated()` call too). */
  private isMounting = true;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  connectedCallback(): void {
    super.connectedCallback();
    // A mount/reconnect with no scheduled deadline yet (nextInMs never set,
    // so targetAt is still its 0 default) must not start a ticker -- it
    // would immediately see targetAt - Date.now() <= 0 on its very first
    // tick and fire a spurious lr-poll-due for a countdown that never ran.
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
        // `remainingMs === 0` never becomes true, so the ticker runs forever and `lr-poll-due`
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
    const wasMounting = this.isMounting;
    this.isMounting = false;
    if (changed.has('nextInMs')) {
      if (this.nextInMs != null && this.active && !this.paused) {
        this.armTicker();
      } else {
        // Clearing next-in-ms (e.g. between poll cycles) must stop the
        // ticker armed for the previous deadline -- otherwise it keeps
        // running against a now-stale targetAt and eventually fires a
        // lr-poll-due for a countdown the host no longer considers active,
        // while [part='countdown'] already renders nothing.
        this.disarmTicker();
      }
    }
    if (changed.has('paused')) {
      if (this.paused) {
        this.disarmTicker();
        // Never announce a "pause" that was only ever the component's own initial/mount-time
        // state -- only a real post-mount transition into paused counts as something to tell a
        // screen-reader user about.
        if (!wasMounting) this.announce(this.localize('pollPausedAnnounce'));
      } else {
        if (this.active && this.nextInMs != null) this.armTicker();
        if (!wasMounting) this.announce(this.localize('pollResumedAnnounce'));
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
        this.emit('lr-poll-due');
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
    this.emit<boolean>('lr-pause-change', this.paused);
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
        <lr-live-region></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-poll-status': LyraPollStatus;
  }
}
