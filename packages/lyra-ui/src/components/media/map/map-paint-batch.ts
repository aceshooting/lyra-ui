export interface MapPaintBatchPeer {
  setPaintProperty(id: string, property: string, value: unknown): unknown;
  triggerRepaint?(): unknown;
}
function aborted(): never { throw new DOMException('Map paint work was cancelled.', 'AbortError'); }
/** One repaint after actual synchronous paint mutations, never after retirement or a no-op. */
export class MapPaintBatch {
  private peer?: MapPaintBatchPeer;
  private style?: unknown;
  private values = new Map<string, { readonly id: string; readonly value: string | undefined }>();
  private active?: { readonly peer: MapPaintBatchPeer; readonly current: () => boolean; dirty: boolean };

  run(peer: MapPaintBatchPeer, style: unknown, current: () => boolean, apply: () => void): void {
    if (this.active) { if (this.active.peer !== peer || !this.active.current() || !current()) aborted(); apply(); return; }
    if (!current()) aborted();
    if (peer !== this.peer || !Object.is(this.style, style)) { this.values.clear(); this.peer = peer; this.style = style; }
    const batch = { peer, current, dirty: false }; this.active = batch;
    try {
      apply();
      if (!current()) aborted();
      if (batch.dirty && typeof peer.triggerRepaint === 'function') {
        peer.triggerRepaint();
        if (!current()) aborted();
      }
    } catch (error) { this.values.clear(); throw error; }
    finally { if (this.active === batch) this.active = undefined; }
  }

  invalidate(id: string): void {
    for (const [key, entry] of this.values) if (entry.id === id) this.values.delete(key);
  }

  write(id: string, property: string, value: unknown): void {
    const batch = this.active;
    if (!batch || !batch.current()) aborted();
    const key = JSON.stringify([id, property]), signature = JSON.stringify(value), previous = this.values.get(key);
    if (previous && previous.value === signature) return;
    batch.peer.setPaintProperty(id, property, value);
    if (!batch.current()) aborted();
    this.values.set(key, { id, value: signature }); batch.dirty = true;
  }
}
