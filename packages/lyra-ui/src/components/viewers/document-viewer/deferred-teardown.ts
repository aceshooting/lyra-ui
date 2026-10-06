/** Runs a viewer's disconnect teardown a microtask later, unless a same-task re-insertion (a DOM move) cancels it. */
export class DeferredTeardown {
  private pending = false;

  constructor(private readonly teardown: () => void) {}

  /** From `disconnectedCallback()`. */
  schedule(): void {
    this.pending = true;
    queueMicrotask(() => this.flush());
  }

  /** From `connectedCallback()`; `true` when this reconnect was a move that kept the viewer's state. */
  cancel(): boolean {
    const moved = this.pending;
    this.pending = false;
    return moved;
  }

  /** Runs a pending teardown now (adoption into another document). */
  flush(): void {
    if (!this.pending) return;
    this.pending = false;
    this.teardown();
  }
}
