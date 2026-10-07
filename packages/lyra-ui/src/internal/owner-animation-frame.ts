interface PendingOwnerFrame {
  owner: Window;
  handle?: number;
  resolve(current: boolean): void;
}

/** Settles owner-realm animation-frame waits when a host moves or disconnects. */
export class OwnerAnimationFrameWaiter {
  private readonly pending = new Set<PendingOwnerFrame>();

  constructor(private readonly host: HTMLElement) {}

  wait(): Promise<boolean> {
    const owner = this.host.ownerDocument.defaultView;
    if (!owner || !this.host.isConnected) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const frame: PendingOwnerFrame = { owner, resolve };
      this.pending.add(frame);
      frame.handle = owner.requestAnimationFrame(() => {
        if (!this.pending.delete(frame)) return;
        resolve(this.host.isConnected && this.host.ownerDocument.defaultView === owner);
      });
    });
  }

  cancel(): void {
    const frames = [...this.pending];
    this.pending.clear();
    for (const frame of frames) {
      if (frame.handle !== undefined) frame.owner.cancelAnimationFrame(frame.handle);
      frame.resolve(false);
    }
  }
}
