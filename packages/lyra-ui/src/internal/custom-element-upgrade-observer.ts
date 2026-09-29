/** Tracks definitions that can introduce a shadow root without a DOM mutation. Pending registry
 * promises hold this collector weakly, and disconnect invalidates callbacks from older mounts. */
export class CustomElementUpgradeObserver {
  private generation = 0;
  private pending = new Map<CustomElementRegistry, Set<string>>();

  constructor(private readonly onUpgrade: () => void) {}

  disconnect(): void {
    this.generation++;
    this.pending.clear();
  }

  /** Registers a visited element when another text consumer owns its extraction options. */
  observeElement(element: Element): void {
    const name = element.localName;
    const registry = element.ownerDocument.defaultView?.customElements;
    if (!name.includes('-') || !registry || registry.get(name)) return;
    let names = this.pending.get(registry);
    if (!names) this.pending.set(registry, names = new Set());
    if (names.has(name)) return;
    names.add(name);
    const reference = new WeakRef(this);
    const generation = this.generation;
    void registry.whenDefined(name).then(() => {
      const observer = reference.deref();
      if (!observer || observer.generation !== generation) return;
      observer.pending.get(registry)?.delete(name);
      observer.onUpgrade();
    }, () => undefined);
  }
}
