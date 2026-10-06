import {
  getActiveNativeModal,
  getNativeModalMountTarget,
  isInNativeModalContext,
  SHARED_LIVE_REGION_ATTRIBUTE,
} from './native-modal-context.js';
import { finiteDuration } from './numbers.js';
import { isAccessibilityVisible } from './accessibility-visibility.js';

/** Options for a single `Announcer.announce()` call. */
export interface AnnounceOptions {
  /** Bypass any in-progress throttle window and flush this text immediately. */
  force?: boolean;
}

export interface AnnouncerOptions {
  /** Throttle window in ms. Repeated `announce()` calls arriving within this
   *  window of the first call in a burst collapse to one trailing-edge flush
   *  of the latest text. Defaults to 500. */
  throttleMs?: number;
  /** Invoked with the coalesced text whenever a burst flushes (on the
   *  trailing edge, or immediately for a `{ force: true }` call). */
  onFlush: (text: string) => void;
  /** Timer host used for scheduling and cancellation. Components that can be adopted into another
   *  document should pass (or later bind) that document's `defaultView`. */
  timerHost?: AnnouncerTimerHost;
}

/** Minimal timer surface used by `Announcer`; a `Window` satisfies this contract. */
export interface AnnouncerTimerHost {
  setTimeout(handler: () => void, timeout: number): number;
  clearTimeout(handle: number): void;
}

const DEFAULT_THROTTLE_MS = 500;
const ambientTimerHost: AnnouncerTimerHost = {
  setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout) as unknown as number,
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

/**
 * Trailing-edge debounce/coalesce for screen-reader announcements.
 *
 * Streaming UIs (token-by-token chat responses, progress ticks, etc.)
 * naturally produce far more candidate announcements than a screen-reader
 * user can usefully absorb — reading every incremental chunk aloud is spam,
 * not information. `Announcer` collapses a burst of `announce()` calls
 * arriving within `throttleMs` of the *first* call in that burst down to a
 * single flush of the latest text: superseded intermediate text is dropped
 * outright, never queued or concatenated. Passing `{ force: true }` always
 * flushes immediately regardless of any window in progress, so a final or
 * terminal message (e.g. "response complete") is never swallowed mid-burst.
 *
 * The class itself is pure timing/state logic with no DOM dependency — it
 * knows nothing about ARIA, elements, or Lit; `acquireAnnouncementSink()`
 * below is the DOM half that a flush writes into. `<lr-live-region>`
 * (`../components/utility/live-region/live-region.js`) is the element that
 * composes the two. Other components that need throttled announcements (a
 * stream-status indicator, a tool-call chip's status transitions, a chat
 * message's streaming state) should reuse that wrapper rather than
 * instantiating `Announcer` directly.
 */
export class Announcer {
  private _throttleMs = DEFAULT_THROTTLE_MS;

  private readonly onFlush: (text: string) => void;
  private timerHost: AnnouncerTimerHost;
  private timer?: number;
  private pending?: string;

  constructor(options: AnnouncerOptions) {
    this.throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
    this.onFlush = options.onFlush;
    this.timerHost = options.timerHost ?? ambientTimerHost;
  }

  /** Throttle window in ms. Safe to change between bursts; a flush already
   *  scheduled keeps the deadline it was scheduled with. A non-finite value (`NaN`/`Infinity`)
   *  resets it to the documented 500ms default; a negative finite value clamps to 0 (the next
   *  burst still schedules an async timer, never an inline/synchronous flush) -- mirrors
   *  `<lr-live-region>`'s own `safeThrottleMs` normalization of this same field. */
  get throttleMs(): number {
    return this._throttleMs;
  }

  set throttleMs(value: number) {
    this._throttleMs = finiteDuration(value, DEFAULT_THROTTLE_MS);
  }

  /** The latest text awaiting flush, if a burst is currently in progress. */
  get pendingText(): string | undefined {
    return this.pending;
  }

  /** Whether a flush is currently scheduled (a burst is in progress). */
  get isPending(): boolean {
    return this.timer !== undefined;
  }

  /**
   * Queue `text` for announcement. Within a single throttle window, only the
   * latest text queued survives — this call always overwrites whatever an
   * earlier call in the same burst queued.
   */
  announce(text: string, options: AnnounceOptions = {}): void {
    this.pending = text;
    if (options.force) {
      this.flush();
      return;
    }
    // Only the first call of a burst schedules the timer; later calls inside
    // the same window just overwrite `pending` above, so the flush deadline
    // stays anchored to the first call (trailing-edge debounce) instead of
    // being pushed back on every subsequent call.
    this.timer ??= this.timerHost.setTimeout(() => this.flush(), this.throttleMs);
  }

  /**
   * Rebind future timers to `timerHost`. A pending burst is canceled on the previous host and
   * rescheduled on the new one without losing its latest text.
   */
  setTimerHost(timerHost: AnnouncerTimerHost): void {
    if (timerHost === this.timerHost) return;
    if (this.timer !== undefined) {
      this.timerHost.clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.timerHost = timerHost;
    if (this.pending !== undefined) {
      this.timer = this.timerHost.setTimeout(() => this.flush(), this.throttleMs);
    }
  }

  /** Cancel any pending (not yet flushed) announcement without flushing it. */
  cancel(): void {
    if (this.timer !== undefined) {
      this.timerHost.clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = undefined;
  }

  private flush(): void {
    if (this.timer !== undefined) {
      this.timerHost.clearTimeout(this.timer);
      this.timer = undefined;
    }
    const text = this.pending;
    this.pending = undefined;
    if (text !== undefined) this.onFlush(text);
  }
}

/** Urgency of a shared announcement sink — mirrors native `aria-live`. */
export type AnnouncementPoliteness = 'polite' | 'assertive';

/** Options for `acquireAnnouncementSink()`. */
export interface AnnouncementSinkOptions {
  /** Document the sink is mounted in. Defaults to the ambient `document`; pass the consumer's own
   *  `ownerDocument` when it may live in an iframe or another adopted document. */
  document?: Document;
  /** Component or other semantic source whose accessibility visibility gates writes. A document
   *  sink cannot inherit `hidden`/`inert`/CSS/closed-details visibility from the source it
   *  announces for. A box-generating source also honors `content-visibility:auto` skipping;
   *  browsers cannot expose that distinction for a source whose own display is `contents`. */
  source?: Element;
  /** How long an announced node stays in the sink before it is swept, in ms. Long enough for a
   *  screen reader to have read it; short enough that focus returning to the page later never
   *  finds a pile of stale text to re-read. Defaults to 5000. */
  messageTtlMs?: number;
}

/** A ref-counted handle on the shared per-interaction-context, per-politeness live region. */
export interface AnnouncementSink {
  /** The shared light-DOM element carrying `role`/`aria-live`. */
  readonly element: HTMLElement;
  /** The politeness this handle was acquired for. */
  readonly politeness: AnnouncementPoliteness;
  /** Sweep delay for nodes this handle appends; see `AnnouncementSinkOptions.messageTtlMs`. */
  messageTtlMs: number;
  /** Append `text` as a new child node — an *addition*, which is what assistive tech is asked to
   *  read. Empty text is ignored. No-op once `release()` has been called. A handle retains only
   *  its latest 32 pending additions, and the shared region retains only the latest 128 across all
   *  handles; older nodes have already been exposed as additions and are removed without
   *  fabricating or concatenating announcement text. All pending nodes share one batched sweep
   *  timer per document/politeness region. */
  announce(text: string): void;
  /** Drop this handle: its still-pending nodes are removed, their sweeps canceled, and the shared
   *  region is unmounted once the last handle releases. Idempotent. */
  release(): void;
}

/**
 * Attribute that identifies a shared announcement sink, valued with its politeness
 * (`data-lr-live-region="polite"`). Stable and documented so a consumer's own DOM diffing,
 * snapshot testing, or `MutationObserver` can recognize (and ignore) library-owned nodes that
 * appear at the end of `<body>` or within an active native modal.
 */
export const ANNOUNCEMENT_SINK_ATTRIBUTE: string = SHARED_LIVE_REGION_ATTRIBUTE;

const DEFAULT_MESSAGE_TTL_MS = 5000;
const MAX_PENDING_MESSAGES_PER_HANDLE = 32;
const MAX_PENDING_MESSAGES_PER_SINK = 128;

// The standard visually-hidden algorithm, identical to `internal/a11y.ts`'s shared `srOnly` class.
// These are algorithm literals (a 1px clipped box), not themeable design values, and they are set
// inline because the sink lives in the *consumer's* light DOM where none of this package's
// stylesheets apply. Clipping is `clip-path: inset(50%)`, not the deprecated `clip` shorthand --
// the same spelling `srOnly` and `styles/utilities.css` use.
const SINK_HIDDEN_CSS_TEXT =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
  'clip-path:inset(50%);white-space:nowrap;border:0;';

interface PendingAnnouncement {
  element: HTMLElement;
  owner: Set<HTMLElement>;
  deadline: number;
}

interface SinkRecord {
  parent: HTMLElement;
  element: HTMLElement;
  refs: number;
  timerHost: AnnouncerTimerHost;
  pending: Map<HTMLElement, PendingAnnouncement>;
  sweepTimer?: number;
  sweepDeadline?: number;
}

// Per interaction context so a native modal never leaves its live region in the inert background.
// Weak keys let a removed document or modal be collected after its handles release.
const sinksByParent = new WeakMap<HTMLElement, Map<AnnouncementPoliteness, SinkRecord>>();

function removePendingAnnouncement(record: SinkRecord, pending: PendingAnnouncement): void {
  record.pending.delete(pending.element);
  pending.owner.delete(pending.element);
  pending.element.remove();
}

function scheduleSinkSweep(record: SinkRecord): void {
  let earliest = Number.POSITIVE_INFINITY;
  for (const pending of record.pending.values()) {
    earliest = Math.min(earliest, pending.deadline);
  }

  if (!Number.isFinite(earliest)) {
    if (record.sweepTimer !== undefined) {
      record.timerHost.clearTimeout(record.sweepTimer);
      record.sweepTimer = undefined;
      record.sweepDeadline = undefined;
    }
    return;
  }

  // An already scheduled earlier wake-up is safe: it will perform one bounded scan and schedule
  // the next true deadline. Only a newly earlier deadline needs to replace the timer.
  if (record.sweepTimer !== undefined && record.sweepDeadline !== undefined && record.sweepDeadline <= earliest) {
    return;
  }
  if (record.sweepTimer !== undefined) {
    record.timerHost.clearTimeout(record.sweepTimer);
  }

  record.sweepDeadline = earliest;
  const scheduledDeadline = earliest;
  record.sweepTimer = record.timerHost.setTimeout(() => {
    record.sweepTimer = undefined;
    record.sweepDeadline = undefined;
    for (const pending of [...record.pending.values()]) {
      if (pending.deadline <= scheduledDeadline) {
        removePendingAnnouncement(record, pending);
      }
    }
    scheduleSinkSweep(record);
  }, Math.max(0, earliest - Date.now()));
}

function mountSink(record: SinkRecord): void {
  if (record.element.parentNode !== record.parent) record.parent.appendChild(record.element);
}

function sinkRecord(doc: Document, politeness: AnnouncementPoliteness, parent: HTMLElement): SinkRecord {
  let byPoliteness = sinksByParent.get(parent);
  if (!byPoliteness) {
    byPoliteness = new Map();
    sinksByParent.set(parent, byPoliteness);
  }
  const existing = byPoliteness.get(politeness);
  if (existing) {
    // Consumer DOM reconciliation can replace `<body>` or remove library-owned marker nodes.
    // Keep the existing object (all held handles reference it) and remount it before reuse.
    mountSink(existing);
    return existing;
  }

  const element = doc.createElement('div');
  element.setAttribute(ANNOUNCEMENT_SINK_ATTRIBUTE, politeness);
  element.setAttribute('role', politeness === 'assertive' ? 'alert' : 'status');
  element.setAttribute('aria-live', politeness);
  // Additions only, non-atomic: each announcement is appended as its own child, so assistive tech
  // reads the node that just arrived rather than re-reading the whole region — which is also what
  // makes an identical repeat announce again instead of being a silent no-op, and what keeps the
  // sweep of an old node from being announced as a removal.
  element.setAttribute('aria-atomic', 'false');
  element.setAttribute('aria-relevant', 'additions');
  element.style.cssText = SINK_HIDDEN_CSS_TEXT;
  const ownerWindow = doc.defaultView;
  const timerHost: AnnouncerTimerHost = ownerWindow
    ? {
        setTimeout: (handler, timeout) => ownerWindow.setTimeout(handler, timeout),
        clearTimeout: (handle) => ownerWindow.clearTimeout(handle),
      }
    : ambientTimerHost;
  const record: SinkRecord = {
    parent,
    element,
    refs: 0,
    timerHost,
    pending: new Map(),
  };
  mountSink(record);
  byPoliteness.set(politeness, record);
  return record;
}

const inertSink = (politeness: AnnouncementPoliteness): AnnouncementSink => ({
  element: undefined as unknown as HTMLElement,
  politeness,
  messageTtlMs: DEFAULT_MESSAGE_TTL_MS,
  announce: () => {},
  release: () => {},
});

/**
 * Acquire the shared live region for `politeness` in `options.document`, mounting it in that
 * document's light DOM on first use and ref-counting it away when the last holder releases.
 *
 * A live region rendered inside a shadow root is not reliably announced — JAWS with Firefox
 * ignores one entirely — so every announcement this library makes has to land in the host
 * document's light DOM instead. Native modal carriers use their host's slotted light DOM; foreign
 * native dialogs receive the region within their own content. Each interaction context shares
 * one region per politeness, and a source outside the active native modal is suppressed.
 * Creating a region and filling it in the same task is also unreliable (assistive tech has to
 * have been observing the
 * region before the text arrives), so the region is mounted at acquire time, ahead of any text.
 */
export function acquireAnnouncementSink(
  politeness: AnnouncementPoliteness,
  options: AnnouncementSinkOptions = {},
): AnnouncementSink {
  const doc = options.document ?? (typeof document === 'undefined' ? undefined : document);
  // No document at all (SSR): hand back an inert handle so callers need no environment check.
  if (!doc) return inertSink(politeness);

  const mountParent = (): HTMLElement => {
    const modal = getActiveNativeModal(doc);
    return modal ? getNativeModalMountTarget(modal) : doc.body ?? doc.documentElement;
  };
  let record = sinkRecord(doc, politeness, mountParent());
  record.refs += 1;
  const ownMessages = new Set<HTMLElement>();
  let released = false;
  let deferredTimer: number | undefined;
  let deferredMessages: string[] = [];

  const releaseRecord = (): void => {
    for (const message of [...ownMessages]) {
      const pending = record.pending.get(message);
      if (pending) removePendingAnnouncement(record, pending);
      else ownMessages.delete(message);
    }
    scheduleSinkSweep(record);
    record.refs -= 1;
    if (record.refs > 0) return;
    if (record.sweepTimer !== undefined) {
      record.timerHost.clearTimeout(record.sweepTimer);
      record.sweepTimer = undefined;
      record.sweepDeadline = undefined;
    }
    record.pending.clear();
    record.element.remove();
    const byPoliteness = sinksByParent.get(record.parent);
    if (byPoliteness?.get(politeness) === record) byPoliteness.delete(politeness);
  };

  const sink: AnnouncementSink = {
    get element() { return record.element; },
    politeness,
    messageTtlMs: finiteDuration(options.messageTtlMs ?? DEFAULT_MESSAGE_TTL_MS, DEFAULT_MESSAGE_TTL_MS),
    announce(text: string): void {
      if (
        released ||
        text === '' ||
        (options.source && (options.source.ownerDocument !== doc || !isAccessibilityVisible(options.source)))
      ) {
        return;
      }
      const modal = getActiveNativeModal(doc);
      if (modal && options.source && !isInNativeModalContext(options.source, modal)) return;
      const parent = modal ? getNativeModalMountTarget(modal) : doc.body ?? doc.documentElement;
      if (record.parent !== parent) {
        releaseRecord();
        record = sinkRecord(doc, politeness, parent);
        record.refs += 1;
        // Mount the new region before adding text in a later task, so assistive technology can
        // observe it. Keep this transition queue bounded like ordinary pending additions.
        deferredMessages = [];
        if (deferredTimer !== undefined) record.timerHost.clearTimeout(deferredTimer);
        deferredTimer = record.timerHost.setTimeout(() => {
          deferredTimer = undefined;
          const messages = deferredMessages;
          deferredMessages = [];
          for (const message of messages) sink.announce(message);
        }, 0);
      }
      if (deferredTimer !== undefined) {
        deferredMessages.push(text);
        if (deferredMessages.length > MAX_PENDING_MESSAGES_PER_HANDLE) deferredMessages.shift();
        return;
      }
      // A still-held handle must recover if application-level body reconciliation detached the
      // shared marker since acquisition; otherwise every later message would land off-document.
      mountSink(record);
      const message = doc.createElement('div');
      message.textContent = text;
      record.element.appendChild(message);
      const ttl = finiteDuration(sink.messageTtlMs, DEFAULT_MESSAGE_TTL_MS);
      const pending: PendingAnnouncement = {
        element: message,
        owner: ownMessages,
        deadline: Date.now() + ttl,
      };
      ownMessages.add(message);
      record.pending.set(message, pending);

      // A live-region addition is observable when it arrives; retaining every old addition in the
      // DOM does not make it more truthful. Under a hostile burst, keep the latest bounded window
      // for this producer and then the latest bounded window across all producers. Never synthesize
      // or concatenate text: every retained node is exactly a message a caller supplied.
      while (ownMessages.size > MAX_PENDING_MESSAGES_PER_HANDLE) {
        const oldest = ownMessages.values().next().value;
        if (!oldest) break;
        const entry = record.pending.get(oldest);
        if (entry) removePendingAnnouncement(record, entry);
        else ownMessages.delete(oldest);
      }
      while (record.pending.size > MAX_PENDING_MESSAGES_PER_SINK) {
        const oldest = record.pending.values().next().value;
        if (!oldest) break;
        removePendingAnnouncement(record, oldest);
      }
      scheduleSinkSweep(record);
    },
    release(): void {
      if (released) return;
      released = true;
      if (deferredTimer !== undefined) record.timerHost.clearTimeout(deferredTimer);
      deferredTimer = undefined;
      deferredMessages = [];
      releaseRecord();
    },
  };
  return sink;
}
