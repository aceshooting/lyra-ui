import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Anything with the observer teardown contract. */
interface ObserverLike {
  disconnect(): void;
}

type OwnerWindow = Window & typeof globalThis;
type OwnedHost = ReactiveControllerHost & HTMLElement;

/** A delivered list, or `[]` for a non-array or a revoked proxy whose brand check throws. */
function deliveredList<T>(value: T[]): T[] {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Realm-owned observer base. The native observer is constructed from the host's current owner
 * window (never the module realm), every callback is checked against the generation, document and
 * connection it was created for, and the remembered observations are re-armed by `resume()` after
 * a disconnect, a same-task move or an adoption into another document.
 */
abstract class OwnedObserver<O extends ObserverLike, Args extends unknown[], Init> {
  private native?: O;
  private nativeOwner?: OwnerWindow;
  private nativeDocument?: Document;
  private generation = 0;
  private readonly observations = new Map<Node, Init | undefined>();

  constructor(protected readonly host: Element) {}

  /** True while a native observer is attached for the current realm. */
  get active(): boolean {
    return this.native !== undefined;
  }

  protected abstract construct(owner: OwnerWindow, callback: (...args: Args) => void): O | undefined;

  protected abstract attach(observer: O, target: Node, init: Init | undefined): void;

  protected abstract dispatch(args: Args): void;

  /** Starts (or extends) observation. Unsupported or failing platforms degrade silently. */
  observe(target: Node, init?: Init): void {
    this.observations.set(target, init);
    if (this.ensure()) {
      for (const [remembered, rememberedInit] of this.observations) this.attachOne(remembered, rememberedInit);
    } else {
      this.attachOne(target, init);
    }
  }

  /** Stops observing one target. */
  unobserve(target: Node): void {
    this.observations.delete(target);
    const native = this.native as (O & { unobserve?: (target: Node) => void }) | undefined;
    try {
      native?.unobserve?.(target);
    } catch {
      // A broken native observer is retired by the next disconnect.
    }
  }

  /** Re-creates the native observer for the host's current realm and re-observes every target. */
  resume(): void {
    this.teardown();
    if (this.observations.size === 0) return;
    if (this.ensure()) for (const [target, init] of this.observations) this.attachOne(target, init);
  }

  /** Stops all delivery. Remembered targets survive for `resume()`; `clear()` forgets them. */
  disconnect(): void {
    this.teardown();
  }

  /** Stops all delivery and forgets every target. */
  clear(): void {
    this.teardown();
    this.observations.clear();
  }

  private teardown(): void {
    this.generation += 1;
    const native = this.native;
    this.native = undefined;
    this.nativeOwner = undefined;
    this.nativeDocument = undefined;
    try {
      native?.disconnect();
    } catch {
      // The generation already made any queued callback stale.
    }
  }

  /** Returns true when a fresh native observer was created (so every target needs attaching). */
  private ensure(): boolean {
    const document = this.host.ownerDocument;
    const owner = document.defaultView as OwnerWindow | null;
    if (this.native && (this.nativeOwner !== owner || this.nativeDocument !== document)) this.teardown();
    if (this.native || !owner || !this.host.isConnected) return false;
    const generation = this.generation;
    let created: O | undefined;
    try {
      created = this.construct(owner, (...args: Args) => {
        if (
          this.native !== created ||
          this.generation !== generation ||
          this.nativeOwner !== owner ||
          this.nativeDocument !== document ||
          !this.host.isConnected ||
          this.host.ownerDocument !== document
        ) {
          return;
        }
        this.dispatch(args);
      });
    } catch {
      created = undefined;
    }
    if (!created) return false;
    this.native = created;
    this.nativeOwner = owner;
    this.nativeDocument = document;
    return true;
  }

  private attachOne(target: Node, init: Init | undefined): void {
    const native = this.native;
    if (!native) return;
    try {
      this.attach(native, target, init);
    } catch {
      // A target the platform rejects must not take the host down; retire this observer.
      if (this.native === native) this.teardown();
    }
  }
}

/** Owner-realm `MutationObserver` with generation, document and connection guards. */
export class OwnedMutationObserver extends OwnedObserver<MutationObserver, [MutationRecord[]], MutationObserverInit> {
  constructor(host: Element, private readonly callback: (records: MutationRecord[]) => void) {
    super(host);
  }

  protected construct(owner: OwnerWindow, callback: (records: MutationRecord[]) => void): MutationObserver | undefined {
    const Ctor = owner.MutationObserver;
    return typeof Ctor === 'function' ? new Ctor((records) => callback(records)) : undefined;
  }

  protected attach(observer: MutationObserver, target: Node, init: MutationObserverInit | undefined): void {
    observer.observe(target, init ?? { childList: true });
  }

  protected dispatch([records]: [MutationRecord[]]): void {
    this.callback(deliveredList(records));
  }
}

/** Owner-realm `ResizeObserver` with generation, document and connection guards. */
export class OwnedResizeObserver extends OwnedObserver<ResizeObserver, [ResizeObserverEntry[]], ResizeObserverOptions> {
  constructor(host: Element, private readonly callback: (entries: ResizeObserverEntry[]) => void) {
    super(host);
  }

  protected construct(owner: OwnerWindow, callback: (entries: ResizeObserverEntry[]) => void): ResizeObserver | undefined {
    const Ctor = owner.ResizeObserver;
    return typeof Ctor === 'function' ? new Ctor((entries) => callback(entries as ResizeObserverEntry[])) : undefined;
  }

  protected attach(observer: ResizeObserver, target: Node, init: ResizeObserverOptions | undefined): void {
    observer.observe(target as Element, init);
  }

  protected dispatch([entries]: [ResizeObserverEntry[]]): void {
    this.callback(deliveredList(entries));
  }
}

/** Owner-realm `IntersectionObserver` with generation, document and connection guards. */
export class OwnedIntersectionObserver extends OwnedObserver<IntersectionObserver, [IntersectionObserverEntry[]], never> {
  constructor(
    host: Element,
    private readonly callback: (entries: IntersectionObserverEntry[]) => void,
    private readonly options?: IntersectionObserverInit
  ) {
    super(host);
  }

  protected construct(owner: OwnerWindow, callback: (entries: IntersectionObserverEntry[]) => void): IntersectionObserver | undefined {
    const Ctor = owner.IntersectionObserver;
    return typeof Ctor === 'function'
      ? new Ctor((entries) => callback(entries as IntersectionObserverEntry[]), this.options)
      : undefined;
  }

  protected attach(observer: IntersectionObserver, target: Node): void {
    observer.observe(target as Element);
  }

  protected dispatch([entries]: [IntersectionObserverEntry[]]): void {
    this.callback(deliveredList(entries));
  }
}

/**
 * Reads the newest boolean `isIntersecting` for `target`, ignoring malformed entries. One delivery
 * can queue several entries for a target in time order, and only the last one is current.
 */
export function readIntersecting(entries: unknown, target: Element): boolean | undefined {
  let intersecting: boolean | undefined;
  try {
    if (!Array.isArray(entries)) return undefined;
    for (const candidate of entries) {
      if (candidate === null || (typeof candidate !== 'object' && typeof candidate !== 'function')) continue;
      try {
        const entry = candidate as Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>;
        if (entry.target !== target) continue;
        const value = entry.isIntersecting;
        if (typeof value === 'boolean') intersecting = value;
      } catch {
        // Keep looking for a usable entry for this host.
      }
    }
  } catch {
    // A hostile entries container is no more useful than an absent callback.
  }
  return intersecting;
}

/** Reads a finite, non-negative inline size from a resize entry, or `undefined`. */
export function readInlineSize(entry: unknown): number | undefined {
  try {
    const e = entry as Partial<ResizeObserverEntry> | null;
    if (!e || typeof e !== 'object') return undefined;
    const size = e.contentBoxSize?.[0]?.inlineSize ?? e.contentRect?.width;
    return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : undefined;
  } catch {
    return undefined;
  }
}

/** Observes the host's own light DOM and re-arms across disconnect, move and adoption. */
export class HostChildrenObserver implements ReactiveController {
  private readonly observer: OwnedMutationObserver;

  constructor(
    private readonly host: OwnedHost,
    private readonly options: {
      attributeFilter?: string[];
      characterData?: boolean;
      subtree?: boolean;
      onChange(records: MutationRecord[]): void;
    }
  ) {
    this.observer = new OwnedMutationObserver(host, (records) => this.options.onChange(records));
    host.addController(this);
  }

  hostConnected(): void {
    this.observer.clear();
    const { attributeFilter, characterData, subtree } = this.options;
    this.observer.observe(this.host, {
      childList: true,
      subtree: subtree ?? false,
      ...(attributeFilter ? { attributes: true, attributeFilter } : {}),
      ...(characterData ? { characterData: true } : {}),
    });
  }

  hostDisconnected(): void {
    this.observer.disconnect();
  }
}

/**
 * Tracks the host's inline size (and optionally a second metric element) with an owner-realm
 * `ResizeObserver`; falls back to window `resize` events when the platform has none, or always
 * when `windowResize()` returns true (viewport-relative breakpoints).
 */
export class AllocationObserverController implements ReactiveController {
  private readonly observer: OwnedResizeObserver;
  private resizeView?: Window;

  constructor(
    private readonly host: OwnedHost,
    private readonly options: {
      onInlineSize(px: number, target: Element): void;
      extra?: () => Element | null;
      windowResize?: () => boolean;
    }
  ) {
    this.observer = new OwnedResizeObserver(host, (entries) => this.read(entries));
    host.addController(this);
  }

  hostConnected(): void {
    this.refresh();
  }

  hostDisconnected(): void {
    this.observer.disconnect();
    this.unlistenWindow();
  }

  /** Re-evaluates the observed targets and the window fallback (call when `extra` changes). */
  refresh(): void {
    if (!this.host.isConnected) return;
    this.unlistenWindow();
    const view = this.host.ownerDocument.defaultView;
    this.observer.clear();
    const supported = typeof view?.ResizeObserver === 'function';
    if (view && (!supported || this.options.windowResize?.())) {
      this.resizeView = view;
      view.addEventListener('resize', this.onWindowResize);
    }
    if (!supported) return;
    this.observer.observe(this.host);
    const extra = this.options.extra?.();
    if (extra) this.observer.observe(extra);
  }

  private readonly onWindowResize = (): void => {
    const width = this.host.getBoundingClientRect().width;
    if (Number.isFinite(width) && width >= 0) this.options.onInlineSize(width, this.host);
  };

  private unlistenWindow(): void {
    this.resizeView?.removeEventListener('resize', this.onWindowResize);
    this.resizeView = undefined;
  }

  private read(entries: ResizeObserverEntry[]): void {
    const extra = this.options.extra?.() ?? null;
    for (const entry of entries) {
      const size = readInlineSize(entry);
      if (size === undefined) continue;
      // A single-target polyfill may report only a content rectangle for a foreign target.
      const target = entry.target === extra ? extra : this.host;
      this.options.onInlineSize(size, target);
    }
  }
}

/**
 * Viewport-intersection gate. `visible` is false until the first delivery; a platform without
 * `IntersectionObserver` (or one that throws) degrades to permanently visible so painting is
 * never withheld.
 */
export class VisibilityGate implements ReactiveController {
  private readonly observer: OwnedIntersectionObserver;
  private current = false;
  private resolved = false;

  constructor(
    private readonly host: OwnedHost,
    private readonly options: {
      onVisible(visible: boolean, wasPaintable: boolean): void;
      init?: IntersectionObserverInit;
    }
  ) {
    this.observer = new OwnedIntersectionObserver(host, (entries) => {
      const intersecting = readIntersecting(entries, this.host);
      if (intersecting !== undefined) this.set(intersecting);
    }, options.init);
    host.addController(this);
  }

  /** Whether the host is currently paintable (intersecting, or the platform cannot tell). */
  get visible(): boolean {
    return this.current;
  }

  /** Whether any delivery (or the unsupported fallback) has resolved visibility. */
  get known(): boolean {
    return this.resolved;
  }

  hostConnected(): void {
    this.current = false;
    this.resolved = false;
    this.observer.clear();
    this.observer.observe(this.host);
    if (!this.observer.active) this.set(true);
  }

  hostDisconnected(): void {
    this.observer.disconnect();
  }

  private set(visible: boolean): void {
    const wasPaintable = this.resolved && this.current;
    this.resolved = true;
    this.current = visible;
    this.options.onVisible(visible, wasPaintable);
  }
}

/**
 * Calls `cb` whenever the owner window's `devicePixelRatio` changes. A `matchMedia` list is fixed
 * to the ratio it was built for, so each change re-arms a fresh one. Returns the disposer.
 */
export function watchDevicePixelRatio(view: Window | null, cb: () => void): () => void {
  if (!view || typeof view.matchMedia !== 'function') return () => undefined;
  let disposed = false;
  let query: MediaQueryList | undefined;
  let listener: (() => void) | undefined;
  const release = (): void => {
    if (query && listener) {
      try {
        query.removeEventListener('change', listener);
      } catch {
        // Nothing left to release.
      }
    }
    query = undefined;
    listener = undefined;
  };
  const arm = (): void => {
    release();
    if (disposed) return;
    try {
      const next = view.matchMedia(`(resolution: ${view.devicePixelRatio}dppx)`);
      const onChange = (): void => {
        if (disposed || query !== next) return;
        arm();
        cb();
      };
      query = next;
      listener = onChange;
      next.addEventListener('change', onChange);
    } catch {
      release();
    }
  };
  arm();
  return () => {
    disposed = true;
    release();
  };
}
