export type RenderedStateTarget = HTMLElement | (() => HTMLElement | null);

/** Returns true when `element` is connected and generates at least one CSS layout box. */
export function hasRenderedLayoutBox(element: HTMLElement): boolean {
  return element.isConnected && element.getClientRects().length > 0;
}

interface RenderedStateMutationSubscription {
  affects(record: MutationRecord): boolean;
  notify(): void;
}

const mutationHubs = new WeakMap<Document, RenderedStateMutationHub>();

class RenderedStateMutationHub {
  private readonly subscriptions = new Map<RenderedStateMutationSubscription, Set<ShadowRoot>>();
  private readonly observer: MutationObserver;

  constructor(
    private readonly document: Document,
    MutationObserverConstructor: typeof MutationObserver,
  ) {
    this.observer = new MutationObserverConstructor((records) => {
      const affected = new Set<RenderedStateMutationSubscription>();
      for (const record of records) {
        for (const subscription of this.subscriptions.keys()) {
          if (subscription.affects(record)) affected.add(subscription);
        }
      }
      for (const subscription of affected) subscription.notify();
    });
  }

  set(subscription: RenderedStateMutationSubscription, roots: Set<ShadowRoot>): void {
    const previous = this.subscriptions.get(subscription);
    if (
      previous &&
      previous.size === roots.size &&
      [...previous].every((root) => roots.has(root))
    ) {
      return;
    }
    this.subscriptions.set(subscription, roots);
    this.rebuild();
  }

  delete(subscription: RenderedStateMutationSubscription): void {
    if (!this.subscriptions.delete(subscription)) return;
    if (this.subscriptions.size === 0) {
      this.observer.disconnect();
      mutationHubs.delete(this.document);
      return;
    }
    this.rebuild();
  }

  private rebuild(): void {
    this.observer.disconnect();
    const options: MutationObserverInit = {
      attributeFilter: ['class', 'hidden', 'style'],
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    };
    if (this.document.documentElement) this.observer.observe(this.document.documentElement, options);
    const roots = new Set([...this.subscriptions.values()].flatMap((entries) => [...entries]));
    for (const root of roots) this.observer.observe(root, options);
  }
}

function mutationHubFor(document: Document): RenderedStateMutationHub | undefined {
  const existing = mutationHubs.get(document);
  if (existing) return existing;
  const MutationObserverConstructor =
    document.defaultView?.MutationObserver ??
    (typeof globalThis.MutationObserver === 'function' ? globalThis.MutationObserver : undefined);
  if (!MutationObserverConstructor || !document.documentElement) return undefined;
  const hub = new RenderedStateMutationHub(document, MutationObserverConstructor);
  mutationHubs.set(document, hub);
  return hub;
}

function collectComposedAncestors(
  element: HTMLElement,
  elements: Set<Element>,
  roots: Set<ShadowRoot>,
): void {
  let current: Element | null = element;
  const seen = new Set<Element>();
  while (current && !seen.has(current)) {
    seen.add(current);
    elements.add(current);
    const assignedSlot: HTMLSlotElement | null = (current as HTMLElement).assignedSlot;
    if (assignedSlot) {
      current = assignedSlot;
      continue;
    }
    if (current.parentElement) {
      current = current.parentElement;
      continue;
    }
    const root: Node = current.getRootNode();
    const shadowRoot: ShadowRoot | undefined =
      root.nodeType === 11 && 'host' in root ? (root as ShadowRoot) : undefined;
    if (!shadowRoot) break;
    roots.add(shadowRoot);
    current = shadowRoot.host;
  }
}

function mutationNodeContains(node: Node, candidate: Node): boolean {
  return node === candidate || (typeof (node as ParentNode).contains === 'function' && (node as ParentNode).contains(candidate));
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
  private mutationHub?: RenderedStateMutationHub;
  private observedVisibilityElements = new Set<Element>();
  private frame?: number;
  private frameView?: Window;
  private readonly mutationSubscription: RenderedStateMutationSubscription = {
    affects: (record) => this.mutationAffects(record),
    notify: () => this.check(),
  };

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
    this.mutationHub?.delete(this.mutationSubscription);
    this.mutationHub = undefined;
    this.observedDocument = undefined;
    this.observedTarget = undefined;
    this.observedVisibilityElements.clear();
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
      this.mutationHub?.delete(this.mutationSubscription);
      this.resizeObserver = undefined;
      this.mutationHub = undefined;
      this.observedTarget = undefined;
      this.observedDocument = doc;

      const ResizeObserverConstructor =
        doc.defaultView?.ResizeObserver ??
        (typeof globalThis.ResizeObserver === 'function' ? globalThis.ResizeObserver : undefined);
      if (ResizeObserverConstructor) {
        this.resizeObserver = new ResizeObserverConstructor(() => this.check());
      }
      this.mutationHub = mutationHubFor(doc);
    }

    const visibilityElements = new Set<Element>();
    const mutationRoots = new Set<ShadowRoot>();
    collectComposedAncestors(this.host, visibilityElements, mutationRoots);
    if (target && target !== this.host) {
      collectComposedAncestors(target, visibilityElements, mutationRoots);
    }
    this.observedVisibilityElements = visibilityElements;
    this.mutationHub?.set(this.mutationSubscription, mutationRoots);

    if (target === this.observedTarget) return;
    if (this.observedTarget) this.resizeObserver?.unobserve(this.observedTarget);
    this.observedTarget = target ?? undefined;
    if (target) this.resizeObserver?.observe(target);
  }

  private mutationAffects(record: MutationRecord): boolean {
    if (record.type === 'attributes') {
      return this.observedVisibilityElements.has(record.target as Element);
    }

    const target = this.observedTarget;
    if (record.type === 'characterData') {
      return Boolean(target?.contains(record.target));
    }
    if (record.type !== 'childList') return false;
    if (target && (record.target === target || target.contains(record.target))) return true;
    for (const node of [...record.addedNodes, ...record.removedNodes]) {
      if (mutationNodeContains(node, this.host) || (target && mutationNodeContains(node, target))) {
        return true;
      }
    }
    return false;
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
