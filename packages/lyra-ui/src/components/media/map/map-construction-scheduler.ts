/** When `<lr-map>` constructs its engine: once visible, at browser idle time, at once, or on the
 *  first user input on the element (optionally also after `initializationDelay`). */
export type LyraMapInitialization = 'visible' | 'idle' | 'eager' | 'interaction';
/** Host input events that admit an `interaction` construction. */
const MAP_ACTIVATION_EVENTS = ['pointerdown', 'touchstart', 'wheel', 'keydown', 'click'] as const;

type Cancel = () => void;

/** Cancellable owner-realm scheduling capabilities. Null means no browser realm. */
export interface MapConstructionPort {
  connected(): boolean;
  visible(admit: () => void): Cancel;
  idle(admit: () => void): Cancel;
  /** Admits on the first input on the host, or after `delay` milliseconds when it is given. */
  interaction?(admit: () => void, delay: number | undefined): Cancel;
}

/** One construction attempt per connection, after both admission and caller readiness. */
export class MapConstructionScheduler {
  private active = false;
  private ready = false;
  private admitted = false;
  private consumed = false;
  private generation = 0;
  private cancel?: Cancel;
  private checkingConnection = false;

  constructor(private readonly port: MapConstructionPort | null, private readonly construct: () => void) {}

  connect(mode: LyraMapInitialization = 'visible', delay?: number): void {
    const generation = this.generation + 1;
    this.disconnect();
    if (generation !== this.generation) return;
    this.active = true;
    this.ready = false;
    this.consumed = false;
    this.reconfigure(mode, delay);
  }

  disconnect(): void {
    this.active = false;
    this.generation += 1;
    const cancel = this.cancel;
    this.cancel = undefined;
    cancel?.();
  }

  /** Whether construction already happened for this connection. */
  get constructed(): boolean { return this.consumed; }

  reconfigure(mode: LyraMapInitialization, delay?: number): void {
    const generation = ++this.generation;
    const previous = this.cancel;
    this.cancel = undefined;
    previous?.();
    if (generation !== this.generation || !this.active) return;
    this.admitted = false;
    if (!this.active || this.consumed || !this.port) return;
    const admit = (): void => {
      if (!this.active || generation !== this.generation || this.consumed) return;
      this.admitted = true;
      const cancel = this.cancel;
      this.cancel = undefined;
      cancel?.();
      if (generation === this.generation) this.flush();
    };
    if (mode === 'eager') admit();
    else {
      const cancel = mode === 'idle' ? this.port.idle(admit) : mode === 'interaction' && this.port.interaction ? this.port.interaction(admit, delay)
        : this.port.visible(admit);
      // A scheduler may admit synchronously (for example absent IntersectionObserver).
      if (generation !== this.generation || this.admitted || !this.active) cancel();
      else this.cancel = cancel;
    }
  }

  setReady(ready: boolean): void {
    this.ready = ready;
    this.flush();
  }

  private flush(followLatest = true): void {
    if (!this.active || !this.ready || !this.admitted || this.consumed || !this.port || this.checkingConnection) return;
    const generation = this.generation;
    let connected: boolean;
    this.checkingConnection = true;
    try {
      connected = this.port.connected();
    } finally {
      this.checkingConnection = false;
    }
    if (generation !== this.generation) {
      // Drain one newer synchronous admission without allowing a hostile predicate to loop forever.
      if (followLatest) this.flush(false);
      return;
    }
    if (!connected || !this.active || !this.ready || !this.admitted || this.consumed) return;
    this.consumed = true;
    this.construct();
  }
}

/** Uses only the host's owner window; importing or creating this helper is SSR safe. */
export function createMapConstructionScheduler(host: Element, construct: () => void): MapConstructionScheduler {
  const view = host.ownerDocument.defaultView;
  return new MapConstructionScheduler(view ? {
    connected: () => host.isConnected,
    visible(admit) {
      const Observer = (view as Window & typeof globalThis).IntersectionObserver;
      if (!Observer) {
        admit();
        return () => {};
      }
      const observer = new Observer(entries => {
        if (entries.some(entry => entry.target === host && entry.isIntersecting)) admit();
      });
      observer.observe(host);
      return () => observer.disconnect();
    },
    interaction(admit, delay) {
      // Passive capture listeners only observe the input; the event itself continues unchanged.
      const options = { capture: true, passive: true } as const;
      for (const type of MAP_ACTIVATION_EVENTS) host.addEventListener(type, admit, options);
      const handle = delay === undefined ? undefined : view.setTimeout(admit, delay);
      return () => {
        for (const type of MAP_ACTIVATION_EVENTS) host.removeEventListener(type, admit, options);
        if (handle !== undefined) view.clearTimeout(handle);
      };
    },
    idle(admit) {
      if (typeof view.requestIdleCallback === 'function' && typeof view.cancelIdleCallback === 'function') {
        const handle = view.requestIdleCallback(admit, { timeout: 1000 });
        return () => view.cancelIdleCallback(handle);
      }
      const handle = view.setTimeout(admit, 0);
      return () => view.clearTimeout(handle);
    },
  } : null, construct);
}
