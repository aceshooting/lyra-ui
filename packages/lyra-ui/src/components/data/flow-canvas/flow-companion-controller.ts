import { tag } from '../../../internal/prefix.js';

type RootWithIds = Document | ShadowRoot;

/** Shared lifecycle-safe resolver used by each flow-canvas companion. */
export class FlowCanvasCompanionController<T extends HTMLElement> {
  private observer?: MutationObserver;
  private observerDocument?: Document;
  private generation = 0;
  private _target: T | null = null;

  constructor(
    private readonly host: HTMLElement & { for: string },
    private readonly isCapable: (element: HTMLElement) => element is T,
    private readonly onTargetChange: (next: T | null, previous: T | null) => void,
  ) {}

  get target(): T | null {
    return this._target;
  }

  connect(): void {
    this.generation += 1;
    this.watchRoot();
    this.reconcile();
  }

  disconnect(): void {
    this.generation += 1;
    this.observer?.disconnect();
    this.observer = undefined;
    this.observerDocument = undefined;
    this.setTarget(null);
  }

  adopt(): void {
    if (!this.host.isConnected) {
      this.disconnect();
      return;
    }
    this.connect();
  }

  targetIdChanged(): void {
    if (this.host.isConnected) this.reconcile();
  }

  private root(): RootWithIds {
    return this.host.getRootNode() as RootWithIds;
  }

  private candidate(): HTMLElement | null {
    if (this.host.for) {
      const byId = this.root().getElementById?.(this.host.for);
      return byId?.nodeType === 1 && byId.localName === tag('flow-canvas')
        ? (byId as HTMLElement)
        : null;
    }
    return this.host.closest<HTMLElement>(tag('flow-canvas'));
  }

  private setTarget(next: T | null): void {
    if (next === this._target) return;
    const previous = this._target;
    this._target = next;
    this.onTargetChange(next, previous);
  }

  private reconcile(): void {
    const candidate = this.candidate();
    if (candidate && this.isCapable(candidate)) {
      this.setTarget(candidate);
      return;
    }
    this.setTarget(null);
    if (!candidate) return;

    // A companion can register before the granular canvas entry. The element identity is already
    // present, so child/id observation alone cannot notice its later upgrade; retry explicitly
    // after the owner realm defines the tag and discard stale adoption/disconnect continuations.
    const ownerDocument = this.host.ownerDocument;
    const registry = ownerDocument.defaultView?.customElements;
    if (!registry) return;
    const generation = this.generation;
    const root = this.root();
    void registry.whenDefined(tag('flow-canvas')).then(() => {
      if (
        generation !== this.generation ||
        !this.host.isConnected ||
        this.host.ownerDocument !== ownerDocument ||
        this.root() !== root
      ) {
        return;
      }
      this.reconcile();
    });
  }

  private watchRoot(): void {
    const ownerDocument = this.host.ownerDocument;
    this.observer?.disconnect();
    this.observer = undefined;
    this.observerDocument = undefined;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor || !this.host.isConnected) return;
    const root = this.root();
    const generation = this.generation;
    const observer = new MutationObserverCtor(() => {
      if (
        this.observer !== observer ||
        this.observerDocument !== ownerDocument ||
        generation !== this.generation ||
        !this.host.isConnected ||
        this.host.ownerDocument !== ownerDocument ||
        this.root() !== root
      ) {
        return;
      }
      this.reconcile();
    });
    this.observer = observer;
    this.observerDocument = ownerDocument;
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id'],
    });
  }
}
