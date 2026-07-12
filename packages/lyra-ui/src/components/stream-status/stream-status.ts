import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import type { LyraLiveRegion } from '../live-region/live-region.js';
import '../live-region/live-region.js';
import { styles } from './stream-status.styles.js';

export type StreamStatusPhase = 'idle' | 'connecting' | 'streaming' | 'stalled';

const DEFAULT_STALL_MESSAGE = 'Taking longer than usual…';
const STALL_ANNOUNCEMENT = 'Connection stalled.';
const RECOVER_ANNOUNCEMENT = 'Connection restored.';

/**
 * `<lyra-stream-status>` — a compact status indicator for a single streaming
 * connection (SSE, WebSocket, long-poll, …), with built-in heartbeat-aware
 * stall detection.
 *
 * The host drives `phase` directly for `idle`/`connecting`/`streaming`, and
 * calls `recordActivity()` on every *semantic* frame received while
 * streaming — a real content chunk, never a transport-level keep-alive ping.
 * This component has no payload-inspection logic of its own: "ignore
 * heartbeats" is entirely a call-site discipline — the host simply never
 * calls `recordActivity()` for a ping, so pings never reset the stall timer
 * and a connection that's only sending keep-alives (no real content) for
 * longer than `stall-threshold-ms` correctly reads as stalled.
 *
 * Internally, an inactivity timer runs only while `phase === 'streaming'`.
 * It's (re)armed whenever the phase transitions to `'streaming'` (directly,
 * or via `recordActivity()` recovering from `'stalled'`) and on every
 * subsequent `recordActivity()` call while already streaming; it's disarmed
 * the instant `phase` becomes anything else, including a host-driven
 * reassignment away from `'streaming'` — so a stale timer can never fire a
 * stall transition after the host has already moved on. If it ever fires,
 * `phase` becomes `'stalled'` and `lyra-stall` is dispatched.
 *
 * `phase` remains a fully public, directly settable property at all times —
 * a host can assign `'stalled'` (or any other phase) itself as a manual
 * override, and this component never fights that assignment. `lyra-stall`/
 * `lyra-recover` fire on *any* transition into/out of `'stalled'`
 * respectively, whether timer-driven or host-driven, and never for a
 * reassignment to the same value (Lit's default `hasChanged` already skips a
 * no-op set, same as every other reflected `@property` in this library).
 * Like `<lyra-chat-message>`'s `status`, whatever phase this element happens
 * to *mount* with is never itself treated as an eventful transition — only a
 * later change fires an event or an announcement.
 *
 * Accessibility: phase transitions into/out of `'stalled'` are announced
 * through an internal `<lyra-live-region>` (see that component for the
 * throttled/coalesced-announcement machinery this composes) rather than a
 * hand-rolled `aria-live` region. `recordActivity()` itself never announces
 * anything, no matter how often the host calls it — only the *transition*
 * announces, exactly once per transition, which is the entire point of
 * routing through the throttled announcer instead of writing to a live
 * region on every call. Entering `'stalled'` announces with `mode="assertive"`
 * (a stall can need the user's attention, e.g. before they give up and
 * navigate away); recovering back out of `'stalled'` announces with
 * `mode="polite"` (good news doesn't need to interrupt). The decorative
 * indicator dot is `aria-hidden` — it's a color/motion cue only, never the
 * sole carrier of state.
 *
 * Visual: `'stalled'` is styled as a warning, not a danger — a stall is
 * usually recoverable (the stream may resume on its own, or the host's own
 * retry logic may kick in), so treating it as an actionable warning rather
 * than a hard failure keeps the tone proportionate. A host that wants to
 * escalate to danger styling after N stalls can scope its own CSS off
 * `[phase="stalled"]`, or simply stop rendering this component and show its
 * own danger-styled error state instead.
 *
 * @customElement lyra-stream-status
 * @slot - Custom copy shown only while `phase="stalled"` (e.g. "Taking longer than usual…"). A sensible built-in default is used when nothing is slotted.
 * @slot actions - A stop/retry button row. Always present in the template regardless of `phase` — visibility is driven purely by whether anything is slotted, not by `phase`; what to put here, and when, is entirely the host's call.
 * @event lyra-stall - Fired whenever `phase` transitions into `'stalled'` from anything else (timer-driven, or a direct host assignment).
 * @event lyra-recover - Fired whenever `phase` transitions out of `'stalled'` to anything else (via `recordActivity()`, or a direct host assignment).
 * @csspart base - The root layout container.
 * @csspart indicator - The decorative (`aria-hidden`) status dot.
 * @csspart message - Wrapper around the default slot; only rendered while `phase="stalled"`.
 * @csspart actions - Wrapper around the `actions` slot.
 */
export class LyraStreamStatus extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Current connection phase. Settable directly by the host at any time —
   *  see the class doc for how that interacts with the internal stall timer. */
  @property({ reflect: true }) phase: StreamStatusPhase = 'idle';

  /** How long `phase` may stay `'streaming'` with no `recordActivity()` call
   *  before this component declares it stalled. */
  @property({ type: Number, attribute: 'stall-threshold-ms' }) stallThresholdMs = 10000;

  // Only ever set while `phase === 'streaming'` — see armStallTimer()/disarmStallTimer().
  private stallTimer?: ReturnType<typeof setTimeout>;

  @state() private hasActionsSlot = false;

  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = this.hasSlotted('actions');
    }
  }

  // `changed.get('phase')` is `undefined` on the very first update, for the
  // same reason documented on lyra-chat-message's identical `updated()`
  // guard: Lit only records the *first* old value seen since the last
  // completed update, and the constructor's field-initializer assignment is
  // that first change, from the truly-unset internal slot. That naturally
  // skips firing an event/announcement for whatever phase this element
  // happens to mount with, while still arming the stall timer below if it
  // mounts already `'streaming'`.
  protected updated(changed: PropertyValues): void {
    if (changed.has('phase')) {
      this.onPhaseChanged(changed.get('phase') as StreamStatusPhase | undefined);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disarmStallTimer();
  }

  /**
   * Call on every semantic (non-heartbeat) frame received while streaming.
   * - While `phase === 'streaming'`: (re)arms the stall timer, pushing the
   *   stall deadline `stall-threshold-ms` further out.
   * - While `phase === 'stalled'`: recovers — `phase` becomes `'streaming'`
   *   again, `lyra-recover` fires, and the stall timer is armed fresh (same
   *   as the bullet above), all via the same `updated()` transition handling
   *   a direct host assignment would also go through.
   * - While `phase` is `'idle'` or `'connecting'`: a no-op. A host may call
   *   this defensively before formally flipping to `'streaming'`; it must
   *   never throw or start a timer early.
   */
  recordActivity(): void {
    if (this.phase === 'streaming') {
      this.armStallTimer();
    } else if (this.phase === 'stalled') {
      this.phase = 'streaming';
    }
  }

  private onPhaseChanged(previous: StreamStatusPhase | undefined): void {
    if (this.phase === 'streaming') {
      this.armStallTimer();
    } else {
      this.disarmStallTimer();
    }

    if (previous === undefined) return;

    if (this.phase === 'stalled' && previous !== 'stalled') {
      this.emit('lyra-stall');
      this.announceTransition('assertive', STALL_ANNOUNCEMENT);
    } else if (previous === 'stalled' && this.phase !== 'stalled') {
      this.emit('lyra-recover');
      this.announceTransition('polite', RECOVER_ANNOUNCEMENT);
    }
  }

  private armStallTimer(): void {
    this.disarmStallTimer();
    const threshold = this.stallThresholdMs;
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    this.stallTimer = setTimeout(() => {
      this.stallTimer = undefined;
      this.phase = 'stalled';
    }, threshold);
  }

  private disarmStallTimer(): void {
    if (this.stallTimer !== undefined) {
      clearTimeout(this.stallTimer);
      this.stallTimer = undefined;
    }
  }

  private announceTransition(mode: 'assertive' | 'polite', text: string): void {
    const region = this.liveRegion;
    if (!region) return;
    region.mode = mode;
    region.announce(text, { force: true });
  }

  private hasSlotted(name: string): boolean {
    return Array.from(this.children).some((el) => el.getAttribute('slot') === name);
  }

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  render(): TemplateResult {
    return html`
      <div part="base">
        <span part="indicator" aria-hidden="true"></span>
        ${this.phase === 'stalled'
          ? html`<div part="message"><slot>${DEFAULT_STALL_MESSAGE}</slot></div>`
          : nothing}
        <div part="actions" ?hidden=${!this.hasActionsSlot}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
        </div>
        <lyra-live-region></lyra-live-region>
      </div>
    `;
  }
}

defineElement('stream-status', LyraStreamStatus);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-stream-status': LyraStreamStatus;
  }
}
