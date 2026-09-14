/**
 * A single pending-value debounce timer: `push()` restarts the delay and remembers only the
 * latest value, `flush()` settles it immediately, and `cancel()`/`dispose()` discard it with no
 * callback. One instance tracks exactly one in-flight edit -- a caller debouncing several
 * independent things at once (one per filter id, one per row) keeps its own keyed collection of
 * instances (a `Map<K, DebounceController<T>>`), exactly like `lr-filter-bar`'s existing
 * `debounceTimers`/`pendingValue` maps, so cancelling one key's entry never touches another's and
 * a bulk teardown is just "dispose every value in the map".
 *
 * `dispose()` additionally marks the controller permanently inert: a `push()` after `dispose()`
 * is a no-op rather than scheduling a new timer, so a caller that disposes every instance from its
 * own `disconnectedCallback()` can rely on no timer ever firing into a torn-down host again, even
 * if a stray reference to the controller outlives the component. `cancel()` alone leaves the
 * controller reusable -- it only discards whatever is currently pending, matching
 * `lr-filter-bar`'s `cancelDebounce()`, which is called on `reset()`/a chip removal without ending
 * that field's ability to debounce a later edit.
 */
export class DebounceController<T> {
  #timer: ReturnType<typeof setTimeout> | undefined;
  #pending = false;
  #pendingValue: T | undefined;
  #disposed = false;

  constructor(
    private readonly delayMs: number,
    private readonly onSettled: (value: T) => void,
  ) {}

  /** Records a new pending value, restarting the timer. A no-op once disposed. */
  push(value: T): void {
    if (this.#disposed) return;
    this.#pending = true;
    this.#pendingValue = value;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#settle();
    }, this.delayMs);
  }

  /** Fires `onSettled` immediately with the latest pushed value, if one is pending. A no-op
   *  otherwise -- safe to call unconditionally (e.g. on every blur). */
  flush(): void {
    if (!this.#pending) return;
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    this.#settle();
  }

  /** Discards any pending value with no callback. Leaves the controller usable for a later
   *  `push()`. */
  cancel(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
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

  #settle(): void {
    this.#pending = false;
    const value = this.#pendingValue as T;
    this.#pendingValue = undefined;
    this.onSettled(value);
  }
}
