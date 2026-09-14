/** The timer queue a debounce is scheduled on. `window` satisfies it, which is how a component
 *  adopted into another document keeps its pending work on *that* document's realm instead of the
 *  ambient one (the same reason `<lr-combobox>` and `<lr-data-grid>` retain an owner window). */
export interface DebounceTimerHost {
  setTimeout(handler: () => void, timeoutMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

/** Used whenever no host resolver is supplied, or the resolver has no realm to offer. */
const AMBIENT_TIMER_HOST: DebounceTimerHost = {
  setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
  clearTimeout: (handle) => clearTimeout(handle),
};

/**
 * A single pending-value debounce timer: `push()` restarts the delay and remembers only the
 * latest value, `flush()` settles it immediately, and `cancel()`/`dispose()` discard it with no
 * callback. One instance tracks exactly one in-flight edit -- a caller debouncing several
 * independent things at once (one per filter id, one per row) keeps its own keyed collection of
 * instances (a `Map<K, DebounceController<T>>`), exactly like `lr-filter-bar`'s per-filter-id
 * collection, so cancelling one key's entry never touches another's and a bulk teardown is just
 * "dispose every value in the map".
 *
 * `pending`/`pendingValue` expose that in-flight edit, because for several callers "a debounce is
 * armed" *is* the "the user is currently editing this field" state: `lr-filter-bar` suppresses its
 * external-value sync and substitutes the not-yet-committed value into a controlled child while
 * one is armed, and `lr-data-grid` treats one as an outstanding server request. `pendingValue` is
 * consumed before `onSettled` runs, so a callback reading it back sees `undefined`, never the
 * value it was just handed.
 *
 * `dispose()` additionally marks the controller permanently inert: a `push()` after `dispose()`
 * is a no-op rather than scheduling a new timer, so a caller that disposes every instance from its
 * own `disconnectedCallback()` can rely on no timer ever firing into a torn-down host again, even
 * if a stray reference to the controller outlives the component. `cancel()` alone leaves the
 * controller reusable -- it only discards whatever is currently pending, matching
 * `lr-filter-bar`'s `cancelDebounce()`, which is called on `reset()`/a chip removal without ending
 * that field's ability to debounce a later edit, and which also runs on a disconnect that a
 * re-parent may follow.
 */
export class DebounceController<T> {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #timerHost: DebounceTimerHost | undefined;
  /** Bumped whenever the armed timer stops being the current one. A callback compares the
   *  generation it was scheduled under against this, so a task already queued when a newer
   *  `push()` (or a `cancel()`) superseded it arrives inert -- it can neither settle a value that
   *  is no longer current nor forget the newer timer's retained handle, which would leave that
   *  timer uncancellable at teardown. */
  #generation = 0;
  #pending = false;
  #pendingValue: T | undefined;
  #disposed = false;

  /**
   * @param delayMs The delay applied by the *next* `push()`; assign it at any time (a host whose
   *   debounce is itself a reactive property just writes it before pushing). An already-armed
   *   timer keeps the delay it started with.
   * @param onSettled Receives the latest pushed value once the delay elapses or `flush()` runs.
   * @param resolveTimerHost Resolves the realm to schedule on, re-read on every `push()` and
   *   retained for the matching clear, so a controller whose host moves between documents still
   *   cancels on the realm that scheduled the work. Falls back to the ambient timer queue.
   */
  constructor(
    public delayMs: number,
    private readonly onSettled: (value: T) => void,
    private readonly resolveTimerHost?: () => DebounceTimerHost | null | undefined,
  ) {}

  /** Whether a pushed value is waiting to settle -- the "this field is mid-edit" predicate. */
  get pending(): boolean {
    return this.#pending;
  }

  /** The latest pushed value while one is pending, `undefined` otherwise. */
  get pendingValue(): T | undefined {
    return this.#pendingValue;
  }

  /** Records a new pending value, restarting the timer. A no-op once disposed. */
  push(value: T): void {
    if (this.#disposed) return;
    this.#pending = true;
    this.#pendingValue = value;
    this.#retireTimer();
    const generation = this.#generation;
    const host = this.resolveTimerHost?.() ?? AMBIENT_TIMER_HOST;
    this.#timerHost = host;
    this.#timer = host.setTimeout(() => {
      if (generation !== this.#generation) return;
      // The task has already run: there is nothing left to clear, only to forget.
      this.#forgetTimer();
      this.#settle();
    }, this.delayMs);
  }

  /** Fires `onSettled` immediately with the latest pushed value, if one is pending. A no-op
   *  otherwise -- safe to call unconditionally (e.g. on every blur). */
  flush(): void {
    if (!this.#pending) return;
    this.#retireTimer();
    this.#settle();
  }

  /** Discards any pending value with no callback. Leaves the controller usable for a later
   *  `push()`. */
  cancel(): void {
    this.#retireTimer();
    this.#pending = false;
    this.#pendingValue = undefined;
  }

  /** Same as `cancel()`, plus permanently disables further `push()` calls. Call from
   *  `disconnectedCallback()` so a timer already in flight can never settle into a torn-down
   *  host, and so a lingering reference can't schedule a new one afterward. */
  dispose(): void {
    this.cancel();
    this.#disposed = true;
  }

  /** Clears the armed timer through the host that scheduled it, then forgets it. */
  #retireTimer(): void {
    if (this.#timer !== undefined) this.#timerHost?.clearTimeout(this.#timer);
    this.#forgetTimer();
  }

  /** Drops the retained handle and retires its generation, without clearing anything. */
  #forgetTimer(): void {
    this.#generation += 1;
    this.#timer = undefined;
    this.#timerHost = undefined;
  }

  #settle(): void {
    this.#pending = false;
    const value = this.#pendingValue as T;
    this.#pendingValue = undefined;
    this.onSettled(value);
  }
}
