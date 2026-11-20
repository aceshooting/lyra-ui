/**
 * Observes the timers a component schedules, so a "nothing keeps ticking" assertion reads the
 * pending timer list synchronously instead of sleeping for several intervals and hoping a leaked
 * chain would have fired by then.
 *
 * Only timers created while the probe is installed, whose delay passes `matching`, are tracked; a
 * timer leaves the list when it fires, is cleared, or (for an interval) is cleared. The test owns
 * `restore()` (a `finally` block).
 */
export interface TimerProbe {
  /** Delays, in milliseconds, of every tracked timer that has neither fired nor been cleared. */
  pending(): number[];
  restore(): void;
}

export function probeTimers(
  matching: (delayMs: number) => boolean = () => true,
  target: Window = window,
): TimerProbe {
  const originalSetTimeout = target.setTimeout;
  const originalSetInterval = target.setInterval;
  const originalClearTimeout = target.clearTimeout;
  const originalClearInterval = target.clearInterval;
  const live = new Map<number, number>();

  const track = (
    original: typeof target.setTimeout,
    once: boolean,
  ): typeof target.setTimeout =>
    ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      const delayMs = Number(delay ?? 0);
      if (typeof handler !== 'function' || !matching(delayMs)) {
        return original.call(target, handler, delay, ...args);
      }
      const id: number = original.call(
        target,
        (...callArgs: unknown[]) => {
          if (once) live.delete(id);
          return handler(...callArgs);
        },
        delay,
        ...args,
      );
      live.set(id, delayMs);
      return id;
    }) as typeof target.setTimeout;

  const forget = (original: (id?: number) => void) => (id?: number): void => {
    if (id !== undefined) live.delete(id);
    original.call(target, id);
  };

  target.setTimeout = track(originalSetTimeout, true);
  target.setInterval = track(originalSetInterval as unknown as typeof target.setTimeout, false) as unknown as typeof target.setInterval;
  target.clearTimeout = forget(originalClearTimeout);
  target.clearInterval = forget(originalClearInterval);

  return {
    pending: () => [...live.values()],
    restore: () => {
      target.setTimeout = originalSetTimeout;
      target.setInterval = originalSetInterval;
      target.clearTimeout = originalClearTimeout;
      target.clearInterval = originalClearInterval;
    },
  };
}

/**
 * Moves the window's `performance.now()` forward by `deltaMs`, so a time-window rule ("a second key
 * press within 500 ms counts as a double activation") is exercised without sleeping through the
 * window. Returns the restore function the test owns in a `finally` block.
 */
export function skewPerformanceClock(deltaMs: number, target: Window = window): () => void {
  const performanceClock = target.performance;
  const hadOwn = Object.prototype.hasOwnProperty.call(performanceClock, 'now');
  const original = performanceClock.now;
  performanceClock.now = function now(this: Performance): number {
    return original.call(this) + deltaMs;
  };
  return () => {
    if (hadOwn) performanceClock.now = original;
    else Reflect.deleteProperty(performanceClock, 'now');
  };
}

/**
 * Whether a component-owned timer (an `OwnedTimeout` / `OwnedInterval` field) is armed. Reads the
 * timer's own state, so a stray timer another helper schedules in the same window (a `waitUntil`
 * deadline, an announcer flush) can never be mistaken for the component's.
 */
export function ownedTimerPending(host: object, field: string): boolean {
  const timer = (host as Record<string, { pending?: unknown } | undefined>)[field];
  if (typeof timer?.pending !== 'boolean') throw new Error(`${field} is not an owned timer`);
  return timer.pending;
}
