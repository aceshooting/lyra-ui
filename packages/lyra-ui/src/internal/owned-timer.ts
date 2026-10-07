/** A scheduled callback belongs to the host's current document and its window. Cancelling or
 * rescheduling also invalidates callbacks already queued by a browser. */
abstract class OwnedSchedule {
  protected owner?: Window;
  protected handle?: number;
  protected document?: Document;
  private generation = 0;

  constructor(protected readonly host: Element) {}

  get pending(): boolean {
    return this.handle !== undefined;
  }

  protected begin(): { owner: Window; document: Document; generation: number } | undefined {
    this.cancel();
    if (!this.host.isConnected) return;
    const document = this.host.ownerDocument;
    const owner = document.defaultView;
    if (!owner) return;
    this.owner = owner;
    this.document = document;
    return { owner, document, generation: this.generation };
  }

  protected isCurrent(snapshot: { owner: Window; document: Document; generation: number }): boolean {
    return this.handle !== undefined &&
      this.owner === snapshot.owner &&
      this.document === snapshot.document &&
      this.generation === snapshot.generation &&
      this.host.isConnected &&
      this.host.ownerDocument === snapshot.document;
  }

  protected finish(): void {
    this.handle = undefined;
    this.owner = undefined;
    this.document = undefined;
  }

  cancel(): void {
    this.generation += 1;
    if (this.handle !== undefined && this.owner) this.clear(this.owner, this.handle);
    this.finish();
  }

  protected abstract clear(owner: Window, handle: number): void;
}

export class OwnedTimeout extends OwnedSchedule {
  schedule(delay: number, callback: () => void): void {
    const snapshot = this.begin();
    if (!snapshot) return;
    this.handle = snapshot.owner.setTimeout(() => {
      if (!this.isCurrent(snapshot)) return;
      this.finish();
      callback();
    }, delay);
  }

  protected clear(owner: Window, handle: number): void {
    owner.clearTimeout(handle);
  }
}

export class OwnedInterval extends OwnedSchedule {
  schedule(delay: number, callback: () => void): void {
    const snapshot = this.begin();
    if (!snapshot) return;
    this.handle = snapshot.owner.setInterval(() => {
      if (this.isCurrent(snapshot)) callback();
    }, delay);
  }

  protected clear(owner: Window, handle: number): void {
    owner.clearInterval(handle);
  }
}

export class OwnedFrame extends OwnedSchedule {
  schedule(callback: (nowMs: number) => void): void {
    const snapshot = this.begin();
    if (!snapshot) return;
    this.handle = snapshot.owner.requestAnimationFrame((nowMs) => {
      if (!this.isCurrent(snapshot)) return;
      this.finish();
      callback(nowMs);
    });
  }

  protected clear(owner: Window, handle: number): void {
    owner.cancelAnimationFrame(handle);
  }
}
