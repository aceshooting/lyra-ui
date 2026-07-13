import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import type { LyraLiveRegion } from '../live-region/live-region.class.js';
import '../live-region/live-region.class.js';
import { styles } from './stream-status.styles.js';

export type StreamStatusPhase = 'idle' | 'connecting' | 'streaming' | 'stalled';

const DEFAULT_STALL_MESSAGE = 'Taking longer than usual…';
const STALL_ANNOUNCEMENT = 'Connection stalled.';
const RECOVER_ANNOUNCEMENT = 'Connection restored.';
// Used instead of RECOVER_ANNOUNCEMENT when a stall is left behind by moving
// to 'idle'/'connecting' rather than back to 'streaming' -- see
// announceTransition()'s caller in onPhaseChanged() for why "restored" would
// be actively misleading in that case.
const STALL_CLEARED_ANNOUNCEMENT = 'No longer stalled.';

// The default slot's stalled-message content is often plain text with no
// wrapping element at all (see the CustomStalledMessage story), so an
// Element-only check never counts it, and ordinary indented-markup
// whitespace (a newline + indentation before a slotted `actions` button, as
// in the DefaultStalledMessage story) must not count either -- native <slot>
// fallback content is suppressed by *any* assigned node, whitespace or not,
// which previously left the message area blank in exactly that common case.
// Mirrors lyra-citation-badge's identical isRealPreviewNode: a node counts as
// real message content if it's an element not assigned to some other named
// slot (e.g. `actions`), or non-whitespace text.
function isRealMessageNode(n: Node): boolean {
  return n.nodeType === Node.ELEMENT_NODE
    ? !(n as Element).hasAttribute('slot')
    : (n.textContent ?? '').trim().length > 0;
}

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
 * or via `recordActivity()` recovering from `'stalled'`), on every
 * subsequent `recordActivity()` call while already streaming, whenever
 * `stall-threshold-ms` itself changes while already streaming (the new
 * value takes effect immediately, the same way `<lyra-toast-item>`'s
 * `duration` re-applies mid-flight, rather than waiting for the next
 * `recordActivity()`/phase change), and whenever this element (re)connects
 * to the DOM while `phase` is still `'streaming'` (a disconnect always
 * disarms it, so moving the element elsewhere in the page — disconnect then
 * reconnect with `phase` unchanged — must resume detection rather than
 * silently disabling it for the rest of the streaming session). It's
 * disarmed the instant `phase` becomes anything else, including a
 * host-driven reassignment away from `'streaming'` — so a stale timer can
 * never fire a stall transition after the host has already moved on. If it
 * ever fires, `phase` becomes `'stalled'` and `lyra-stall` is dispatched.
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
 * navigate away); leaving `'stalled'` always announces with `mode="polite"`
 * (good news doesn't need to interrupt), but the *wording* depends on where
 * it lands: `"Connection restored."` only when the destination is
 * `'streaming'` (a genuine recovery), or a neutral `"No longer stalled."`
 * when the destination is `'idle'`/`'connecting'` instead — that's the host
 * giving up on the stream, not the stream recovering, and a screen-reader
 * user must never be told the opposite of what a sighted user sees on
 * screen. The decorative indicator dot is `aria-hidden` — it's a
 * color/motion cue only, never the sole carrier of state.
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
 * @event lyra-recover - Fired whenever `phase` transitions out of `'stalled'` to anything else (via `recordActivity()`, or a direct host assignment) — fired unconditionally regardless of destination phase, even though the accompanying announcement's wording varies (see the class doc's "Accessibility" section).
 * @csspart base - The root layout container.
 * @csspart indicator - The decorative (`aria-hidden`) status dot.
 * @csspart message - Wrapper around the default slot; only rendered while `phase="stalled"`.
 * @csspart actions - Wrapper around the `actions` slot.
 */
export interface LyraStreamStatusEventMap {
  'lyra-stall': CustomEvent<undefined>;
  'lyra-recover': CustomEvent<undefined>;
}
export class LyraStreamStatus extends LyraElement<LyraStreamStatusEventMap> {
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

  // Seeded from light-DOM childNodes in willUpdate() (mirrors hasActionsSlot
  // above), then kept current via onMessageSlotChange() -- see
  // isRealMessageNode()'s doc comment for why native <slot> fallback content
  // can't be relied on for the default stalled-message text.
  @state() private hasMessageContent = false;

  @query('lyra-live-region') private liveRegion?: LyraLiveRegion;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasActionsSlot = this.hasSlotted('actions');
      this.hasMessageContent = Array.from(this.childNodes).some(isRealMessageNode);
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
  //
  // The `else if` below only matters while `phase` itself didn't also change
  // in this same update -- if it did, onPhaseChanged() above already
  // (re)armed the timer with the current `stallThresholdMs`, so re-arming it
  // again here would just be redundant, not wrong, but the `else` skips that
  // double work.
  protected updated(changed: PropertyValues): void {
    if (changed.has('phase')) {
      this.onPhaseChanged(changed.get('phase') as StreamStatusPhase | undefined);
    } else if (changed.has('stallThresholdMs') && this.phase === 'streaming') {
      // Unlike `phase` itself, `stallThresholdMs` has no dedicated handler --
      // the already-armed timer was scheduled against the *old* value and
      // keeps counting down against it otherwise, so a shortened (or
      // lengthened) threshold would silently have no effect until the next
      // recordActivity() call or phase transition happened to re-arm it.
      this.armStallTimer();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A disconnect always disarms the timer (see disconnectedCallback()
    // below), but reparenting this element elsewhere in the page while still
    // `'streaming'` fires disconnectedCallback then connectedCallback with
    // `phase` unchanged -- no `updated()` cycle runs in between, so nothing
    // else would ever re-arm it. Without this, a reparent mid-stream would
    // permanently disable stall detection for the rest of that streaming
    // session.
    if (this.phase === 'streaming') this.armStallTimer();
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
      // `lyra-recover` fires unconditionally -- a host may still want the
      // event for any exit from 'stalled' -- but the *announced text* must
      // not claim the connection was "restored" when the destination is
      // 'idle'/'connecting': that's the host abandoning the stream, not it
      // recovering, and telling a screen-reader user otherwise would be the
      // opposite of what a sighted user sees on screen.
      this.emit('lyra-recover');
      const text = this.phase === 'streaming' ? RECOVER_ANNOUNCEMENT : STALL_CLEARED_ANNOUNCEMENT;
      this.announceTransition('polite', text);
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

  private onMessageSlotChange = (e: Event): void => {
    this.hasMessageContent = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(isRealMessageNode);
  };

  render(): TemplateResult {
    return html`
      <div part="base">
        <span part="indicator" aria-hidden="true"></span>
        ${this.phase === 'stalled'
          ? html`<div part="message">
              <slot @slotchange=${this.onMessageSlotChange}></slot>${this.hasMessageContent
                ? nothing
                : DEFAULT_STALL_MESSAGE}
            </div>`
          : nothing}
        <div part="actions" ?hidden=${!this.hasActionsSlot}>
          <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
        </div>
        <lyra-live-region></lyra-live-region>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lyra-stream-status': LyraStreamStatus;
  }
}
