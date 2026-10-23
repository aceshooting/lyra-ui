import type { LyraMapDrawingPoint } from './map-drawing.js';

export interface MapDrawingPointerContext {
  readonly canvas: HTMLCanvasElement;
  current(): boolean;
  vertices(): readonly LyraMapDrawingPoint[];
  project(point: LyraMapDrawingPoint): readonly [number, number] | undefined;
  unproject(point: readonly [number, number]): LyraMapDrawingPoint | undefined;
  replace(index: number, point: LyraMapDrawingPoint): boolean;
  acquirePan(): { readonly accepted: boolean; release(): boolean };
  cancel(): void;
  /** A press on a vertex released without moving it; `distance` is its visual CSS-pixel offset. */
  tap?(index: number, distance: number): void;
  /** A drag that moved the vertex was released. */
  end?(index: number): void;
}
interface Drag {
  readonly pointer: number;
  readonly index: number;
  readonly lease: { release(): boolean };
  readonly distance: number;
  readonly start: readonly [number, number];
  capture: boolean;
  moved: boolean;
}
/** Visual CSS pixels a press may travel and still count as a tap rather than a drag. */
const TAP_SLOP = 4;
/** Canvas-local vertex drag ownership; geometry admission remains the session owner's decision. */
export class MapDrawingPointer {
  private drag?: Drag;
  private disposed = false;
  private retiring = false;
  private checkingCurrent = false;
  private beginning = false;
  private updating = false;
  private epoch = 0;
  private suppressed = false;
  constructor(private readonly context: MapDrawingPointerContext) {
    const canvas = context.canvas;
    canvas.addEventListener('pointerdown', this.down, true);
    canvas.addEventListener('pointermove', this.move, true);
    canvas.addEventListener('pointerup', this.up, true);
    canvas.addEventListener('pointercancel', this.cancelled, true);
    canvas.addEventListener('lostpointercapture', this.cancelled, true);
    canvas.addEventListener('click', this.click, true);
  }
  private current(epoch = this.epoch): boolean {
    if (this.disposed || this.checkingCurrent || epoch !== this.epoch) return false;
    this.checkingCurrent = true;
    try { const valid = this.context.current(); return valid && !this.disposed && epoch === this.epoch; } catch { return false; }
    finally { this.checkingCurrent = false; }
  }
  private coordinates(event: PointerEvent): readonly [number, number] | undefined {
    const epoch = this.epoch, rect = this.context.canvas.getBoundingClientRect();
    if (!this.current(epoch)) return undefined;
    const width = this.context.canvas.clientWidth; if (!this.current(epoch)) return undefined;
    const height = this.context.canvas.clientHeight; if (!this.current(epoch)) return undefined;
    if (![rect.left, rect.top, rect.width, rect.height, width, height, event.clientX, event.clientY].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return undefined;
    const point = [(event.clientX - rect.left) * width / rect.width, (event.clientY - rect.top) * height / rect.height] as const;
    return point.every(Number.isFinite) ? point : undefined;
  }
  /** Returns true only after acquiring this pointer's capture and a pan lease. */
  begin(event: PointerEvent, index?: number): boolean {
    if (this.beginning) return false;
    this.beginning = true;
    try { return this.beginOwned(event, index); }
    finally { this.beginning = false; }
  }
  private beginOwned(event: PointerEvent, index?: number): boolean {
    const epoch = this.epoch;
    if (!this.drag) this.suppressed = false;
    if (this.retiring || !this.current(epoch) || this.drag || !event.isPrimary || event.button !== 0 || !Number.isSafeInteger(event.pointerId)) return false;
    let lease: ReturnType<MapDrawingPointerContext['acquirePan']> | undefined;
    try {
      const point = this.coordinates(event); if (!this.current(epoch) || !point) return false;
      const vertices = this.context.vertices(); if (!this.current(epoch)) return false;
      let nearest = -1, distance = Infinity;
      if (index !== undefined && (!Number.isSafeInteger(index) || index < 0 || index >= vertices.length)) return false;
      for (let candidate = 0; candidate < vertices.length; candidate++) {
        if (index !== undefined && candidate !== index) continue;
        const projected = this.context.project(vertices[candidate]!); if (!this.current(epoch)) return false;
        if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) continue;
        // Threshold is measured in visual CSS pixels, including a transformed canvas allocation.
        const rect = this.context.canvas.getBoundingClientRect(); if (!this.current(epoch)) return false;
        const width = this.context.canvas.clientWidth; if (!this.current(epoch)) return false;
        const height = this.context.canvas.clientHeight; if (!this.current(epoch)) return false;
        if (![rect.width, rect.height, width, height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return false;
        const dx = (projected[0] - point[0]) * rect.width / width;
        const dy = (projected[1] - point[1]) * rect.height / height;
        const next = Math.hypot(dx, dy);
        if (next <= 14 && next < distance) { distance = next; nearest = candidate; }
      }
      if (!this.current(epoch) || nearest < 0) return false;
      lease = this.context.acquirePan();
      if (!this.current(epoch) || !lease.accepted) { const rejected = lease; lease = undefined; rejected.release(); return false; }
      const drag: Drag = { pointer: event.pointerId, index: nearest, lease, capture: false, distance,
        start: [event.clientX, event.clientY], moved: false };
      this.drag = drag;
      const capturedEpoch = ++this.epoch;
      drag.capture = true;
      this.context.canvas.setPointerCapture(event.pointerId);
      if (!this.current(capturedEpoch) || this.drag !== drag) { this.retire(drag); return false; }
      event.preventDefault(); this.suppressed = true;
      return true;
    } catch {
      const drag = this.drag;
      if (drag) this.retire(drag);
      else { try { lease?.release(); } catch { /* A failed lease does not acquire pointer ownership. */ } }
      return false;
    }
  }
  private retire(drag: Drag): void {
    if (this.drag !== drag) return;
    this.drag = undefined; this.epoch++;
    this.retiring = true;
    try {
      if (drag.capture) { try { this.context.canvas.releasePointerCapture(drag.pointer); } catch { /* Capture may already be lost. */ } }
      try { drag.lease.release(); } catch { /* Continue owner teardown. */ }
    } finally { this.retiring = false; }
  }
  private update(event: PointerEvent): void {
    if (this.updating) return;
    this.updating = true;
    try { this.updateOwned(event); } finally { this.updating = false; }
  }
  private updateOwned(event: PointerEvent): void {
    const drag = this.drag, epoch = this.epoch;
    if (!drag || drag.pointer !== event.pointerId) return;
    if (!this.current(epoch)) { this.retire(drag); return; }
    if (!drag.moved && Math.hypot(event.clientX - drag.start[0], event.clientY - drag.start[1]) <= TAP_SLOP) return;
    drag.moved = true;
    try {
      const point = this.coordinates(event); if (!this.current(epoch) || this.drag !== drag) { this.retire(drag); return; }
      if (!point) return;
      const coordinate = this.context.unproject(point); if (!this.current(epoch) || this.drag !== drag) { this.retire(drag); return; }
      if (!coordinate || !Number.isFinite(coordinate[0]) || !Number.isFinite(coordinate[1]) || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) return;
      this.context.replace(drag.index, coordinate);
      if (!this.current(epoch) || this.drag !== drag) this.retire(drag);
    } catch { this.retire(drag); }
  }
  private down = (event: PointerEvent): void => { this.begin(event); };
  private move = (event: PointerEvent): void => { if (this.drag?.pointer === event.pointerId) { event.preventDefault(); this.update(event); } };
  private up = (event: PointerEvent): void => {
    const drag = this.drag; if (!drag || drag.pointer !== event.pointerId) return;
    event.preventDefault(); this.update(event);
    const epoch = this.epoch, notify = this.drag === drag && this.current(epoch);
    this.retire(drag);
    if (!notify || this.disposed) return;
    try { if (drag.moved) this.context.end?.(drag.index); else this.context.tap?.(drag.index, drag.distance); }
    catch { /* The owner reports its own failures. */ }
  };
  private cancelled = (event: PointerEvent): void => {
    const drag = this.drag; if (!drag || drag.pointer !== event.pointerId) return;
    const epoch = this.epoch; const notify = this.current(epoch);
    this.retire(drag);
    if (notify && this.epoch === epoch + 1 && !this.drag && this.current()) { try { this.context.cancel(); } catch { /* Owner failure cannot retain the gesture. */ } }
  };
  private click = (event: MouseEvent): void => { if (this.consumeClick()) { event.preventDefault(); event.stopImmediatePropagation(); } };
  consumeClick(): boolean { const value = this.suppressed; this.suppressed = false; return value; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.epoch++;
    if (this.drag) this.retire(this.drag);
    this.suppressed = false;
    const canvas = this.context.canvas;
    canvas.removeEventListener('pointerdown', this.down, true);
    canvas.removeEventListener('pointermove', this.move, true);
    canvas.removeEventListener('pointerup', this.up, true);
    canvas.removeEventListener('pointercancel', this.cancelled, true);
    canvas.removeEventListener('lostpointercapture', this.cancelled, true);
    canvas.removeEventListener('click', this.click, true);
  }
}
