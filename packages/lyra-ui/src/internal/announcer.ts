import { tag } from './prefix.js';
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
  /** Throttle window in ms. Safe to change between bursts; a flush already
   *  scheduled keeps the deadline it was scheduled with. */
  throttleMs: number;

  private readonly onFlush: (text: string) => void;
  private timerHost: AnnouncerTimerHost;
  private timer?: number;
  private pending?: string;

  constructor(options: AnnouncerOptions) {
    this.throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
    this.onFlush = options.onFlush;
    this.timerHost = options.timerHost ?? ambientTimerHost;
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

/** A ref-counted handle on the shared per-document, per-politeness live region. */
export interface AnnouncementSink {
  /** The shared light-DOM element carrying `role`/`aria-live`. */
  readonly element: HTMLElement;
  /** The politeness this handle was acquired for. */
  readonly politeness: AnnouncementPoliteness;
  /** Sweep delay for nodes this handle appends; see `AnnouncementSinkOptions.messageTtlMs`. */
  messageTtlMs: number;
  /** Append `text` as a new child node — an *addition*, which is what assistive tech is asked to
   *  read. Empty text is ignored. No-op once `release()` has been called. */
  announce(text: string): void;
  /** Drop this handle: its still-pending nodes are removed, their sweeps canceled, and the shared
   *  region is unmounted once the last handle releases. Idempotent. */
  release(): void;
}

/**
 * Attribute that identifies a shared announcement sink, valued with its politeness
 * (`data-lr-live-region="polite"`). Stable and documented so a consumer's own DOM diffing,
 * snapshot testing, or `MutationObserver` can recognize (and ignore) library-owned nodes that
 * appear at the end of `<body>`.
 */
export const ANNOUNCEMENT_SINK_ATTRIBUTE = `data-${tag('live-region')}`;

const DEFAULT_MESSAGE_TTL_MS = 5000;

// The standard visually-hidden algorithm, identical to `internal/a11y.ts`'s shared `srOnly` class.
// These are algorithm literals (a 1px clipped box), not themeable design values, and they are set
// inline because the sink lives in the *consumer's* light DOM where none of this package's
// stylesheets apply. Clipping is `clip-path: inset(50%)`, not the deprecated `clip` shorthand --
// the same spelling `srOnly` and `styles/utilities.css` use.
const SINK_HIDDEN_CSS_TEXT =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;' +
  'clip-path:inset(50%);white-space:nowrap;border:0;';

interface SinkRecord {
  element: HTMLElement;
  refs: number;
}

// Per-document so an element adopted into an iframe announces in the document the user is actually
// looking at; weakly keyed so a torn-down document is never retained by this module.
const sinksByDocument = new WeakMap<Document, Map<AnnouncementPoliteness, SinkRecord>>();

function mountSink(doc: Document, record: SinkRecord): void {
  const parent = doc.body ?? doc.documentElement;
  if (record.element.parentNode !== parent) parent.appendChild(record.element);
}

function sinkRecord(doc: Document, politeness: AnnouncementPoliteness): SinkRecord {
  let byPoliteness = sinksByDocument.get(doc);
  if (!byPoliteness) {
    byPoliteness = new Map();
    sinksByDocument.set(doc, byPoliteness);
  }
  const existing = byPoliteness.get(politeness);
  if (existing) {
    // Consumer DOM reconciliation can replace `<body>` or remove library-owned marker nodes.
    // Keep the existing object (all held handles reference it) and remount it before reuse.
    mountSink(doc, existing);
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
  const record: SinkRecord = { element, refs: 0 };
  mountSink(doc, record);
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
 * document instead. One region per politeness is shared by every consumer: creating a region and
 * filling it in the same task is also unreliable (assistive tech has to have been observing the
 * region before the text arrives), so the region is mounted at acquire time, ahead of any text.
 */
export function acquireAnnouncementSink(
  politeness: AnnouncementPoliteness,
  options: AnnouncementSinkOptions = {},
): AnnouncementSink {
  const doc = options.document ?? (typeof document === 'undefined' ? undefined : document);
  // No document at all (SSR): hand back an inert handle so callers need no environment check.
  if (!doc) return inertSink(politeness);

  const record = sinkRecord(doc, politeness);
  record.refs += 1;
  const ownerWindow = doc.defaultView;
  const timerHost: AnnouncerTimerHost = ownerWindow
    ? {
        setTimeout: (handler, timeout) => ownerWindow.setTimeout(handler, timeout),
        clearTimeout: (handle) => ownerWindow.clearTimeout(handle),
      }
    : ambientTimerHost;
  const sweeps = new Map<HTMLElement, number>();
  let released = false;

  const sink: AnnouncementSink = {
    element: record.element,
    politeness,
    messageTtlMs: finiteDuration(options.messageTtlMs ?? DEFAULT_MESSAGE_TTL_MS, DEFAULT_MESSAGE_TTL_MS),
    announce(text: string): void {
      if (
        released ||
        text === '' ||
        (options.source &&
          (options.source.ownerDocument !== doc || !isAccessibilityVisible(options.source)))
      ) {
        return;
      }
      // A still-held handle must recover if application-level body reconciliation detached the
      // shared marker since acquisition; otherwise every later message would land off-document.
      mountSink(doc, record);
      const message = doc.createElement('div');
      message.textContent = text;
      record.element.appendChild(message);
      const ttl = finiteDuration(sink.messageTtlMs, DEFAULT_MESSAGE_TTL_MS);
      sweeps.set(
        message,
        timerHost.setTimeout(() => {
          sweeps.delete(message);
          message.remove();
        }, ttl),
      );
    },
    release(): void {
      if (released) return;
      released = true;
      for (const [message, sweep] of sweeps) {
        timerHost.clearTimeout(sweep);
        message.remove();
      }
      sweeps.clear();
      record.refs -= 1;
      if (record.refs > 0) return;
      record.element.remove();
      const byPoliteness = sinksByDocument.get(doc);
      // Only retract the entry this handle actually held: a record replaced in the meantime
      // belongs to a later generation of holders.
      if (byPoliteness?.get(politeness) === record) byPoliteness.delete(politeness);
    },
  };
  return sink;
}
