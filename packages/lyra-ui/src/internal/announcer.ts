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
}

const DEFAULT_THROTTLE_MS = 500;

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
 * This is pure timing/state logic with no DOM dependency — it knows nothing
 * about ARIA, elements, or Lit. `<lyra-live-region>`
 * (`../components/live-region/live-region.js`) is the DOM-facing wrapper
 * that composes one of these with an actual live-region element. Other
 * components that need throttled announcements (a stream-status indicator,
 * a tool-call chip's status transitions, a chat message's streaming state)
 * should reuse that wrapper rather than instantiating `Announcer` directly.
 */
export class Announcer {
  /** Throttle window in ms. Safe to change between bursts; a flush already
   *  scheduled keeps the deadline it was scheduled with. */
  throttleMs: number;

  private readonly onFlush: (text: string) => void;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: string;

  constructor(options: AnnouncerOptions) {
    this.throttleMs = options.throttleMs ?? DEFAULT_THROTTLE_MS;
    this.onFlush = options.onFlush;
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
    this.timer ??= setTimeout(() => this.flush(), this.throttleMs);
  }

  /** Cancel any pending (not yet flushed) announcement without flushing it. */
  cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = undefined;
  }

  private flush(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    const text = this.pending;
    this.pending = undefined;
    if (text !== undefined) this.onFlush(text);
  }
}
