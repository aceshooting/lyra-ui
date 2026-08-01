export type RenderedStateTarget = HTMLElement | (() => HTMLElement | null);

/** Returns true when `element` is connected and generates at least one CSS layout box. */
export function hasRenderedLayoutBox(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0;
}

/**
 * Watches a live element (or lazily resolved element) for transitions between generating and not
 * generating a CSS layout box. Resize and DOM observers provide the normal event-driven path; an
 * animation-frame fallback keeps the contract working in browsers that do not expose either
 * observer constructor and while a lazy target has not rendered yet.
 */
export class RenderedStateController {
  private readonly host: HTMLElement;
  private readonly target: RenderedStateTarget;
  private readonly onChange: (rendered: boolean) => void;
  private started = false;
  private lastRendered?: boolean;
  private observedDocument?: Document;
  private observedTarget?: HTMLElement;
  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private frame?: number;
  private frameView?: Window;

  constructor(
    host: HTMLElement,
    target: RenderedStateTarget,
    onChange: (rendered: boolean) => void,
  );
  constructor(
    host: HTMLElement,
    onChange: (rendered: boolean) => void,
  );
  constructor(
    host: HTMLElement,
    targetOrChange: RenderedStateTarget | ((rendered: boolean) => void),
    maybeOnChange?: (rendered: boolean) => void,
  ) {
    this.host = host;
    if (maybeOnChange) {
      this.target = targetOrChange as RenderedStateTarget;
      this.onChange = maybeOnChange;
    } else {
      this.target = host;
      this.onChange = targetOrChange as (rendered: boolean) => void;
    }
  }

  /** The most recently observed state, or a synchronous current reading before `start()`. */
  get rendered(): boolean {
    return this.lastRendered ?? this.readCurrent();
  }

  /** Starts watching and reports the current state synchronously. Idempotent. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.lastRendered = undefined;
    this.check();
  }

  /** Stops all observers and frame work. The controller can be started again. */
  stop(): void {
    if (!this.started) return;
    this.started = false;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.mutationObserver?.disconnect();
    this.mutationObserver = undefined;
    this.observedDocument = undefined;
    this.observedTarget = undefined;
    this.cancelFrame();
  }

  /** Re-reads the target immediately and returns its current state. */
  check(): boolean {
    const target = this.resolveTarget();
    if (this.started) this.refreshObservers(target);
    const rendered = target !== null && hasRenderedLayoutBox(target);
    if (this.started && rendered !== this.lastRendered) {
      this.lastRendered = rendered;
      this.onChange(rendered);
    }
    if (this.started) {
      // A missing lazy target needs polling until there is a real node to observe. Without
      // ResizeObserver, polling is also the fallback for stylesheet/CSSOM-only changes that do
      // not create MutationObserver records. A resolved hidden target remains observed without
      // burning a frame on every refresh interval until it becomes rendered again.
      if (!this.resizeObserver || !target) this.scheduleFrame();
      else this.cancelFrame();
    }
    return rendered;
  }

  private resolveTarget(): HTMLElement | null {
    return typeof this.target === 'function' ? this.target() : this.target;
  }

  private readCurrent(): boolean {
    const target = this.resolveTarget();
    return target !== null && hasRenderedLayoutBox(target);
  }

  private refreshObservers(target: HTMLElement | null): void {
    const doc = this.host.ownerDocument;
    if (doc !== this.observedDocument) {
      this.resizeObserver?.disconnect();
      this.mutationObserver?.disconnect();
      this.resizeObserver = undefined;
      this.mutationObserver = undefined;
      this.observedTarget = undefined;
      this.observedDocument = doc;

      const ResizeObserverConstructor =
        doc.defaultView?.ResizeObserver ??
        (typeof globalThis.ResizeObserver === 'function' ? globalThis.ResizeObserver : undefined);
      if (ResizeObserverConstructor) {
        this.resizeObserver = new ResizeObserverConstructor(() => this.check());
      }

      const MutationObserverConstructor =
        doc.defaultView?.MutationObserver ??
        (typeof globalThis.MutationObserver === 'function' ? globalThis.MutationObserver : undefined);
      if (MutationObserverConstructor && doc.documentElement) {
        this.mutationObserver = new MutationObserverConstructor(() => this.check());
        this.mutationObserver.observe(doc.documentElement, {
          attributeFilter: ['class', 'hidden', 'style'],
          attributes: true,
          characterData: true,
          childList: true,
          subtree: true,
        });
      }
    }

    if (target === this.observedTarget) return;
    if (this.observedTarget) this.resizeObserver?.unobserve(this.observedTarget);
    this.observedTarget = target ?? undefined;
    if (target) this.resizeObserver?.observe(target);
  }

  private scheduleFrame(): void {
    if (this.frame !== undefined) return;
    const view = this.host.ownerDocument.defaultView;
    if (!view) return;
    this.frameView = view;
    this.frame = view.requestAnimationFrame(() => {
      this.frame = undefined;
      this.frameView = undefined;
      if (this.started) this.check();
    });
  }

  private cancelFrame(): void {
    if (this.frame === undefined) return;
    this.frameView?.cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.frameView = undefined;
  }
}
