/** Owns only its last inline cursor write and preserves intervening native or application writes. */
export class MapCursorOwner {
  private canvas?: HTMLCanvasElement;
  private baseline = '';
  private baselinePriority = '';
  private written?: string;
  set(canvas: HTMLCanvasElement | undefined, mode: 'pick' | 'drawing' | 'hover' | undefined): void {
    if (this.canvas !== canvas) { this.clear(); this.canvas = canvas; }
    if (!canvas) return;
    const current = canvas.style.getPropertyValue('cursor');
    if (this.written === undefined || current !== this.written || canvas.style.getPropertyPriority('cursor') !== '') {
      this.baseline = current; this.baselinePriority = canvas.style.getPropertyPriority('cursor');
    }
    if (!mode) { this.clear(); return; }
    this.written = mode === 'hover' ? 'pointer' : 'crosshair';
    canvas.style.setProperty('cursor', this.written);
  }
  clear(): void {
    const canvas = this.canvas, written = this.written;
    this.canvas = undefined; this.written = undefined;
    if (canvas && written !== undefined && canvas.style.getPropertyValue('cursor') === written && canvas.style.getPropertyPriority('cursor') === '') {
      if (this.baseline) canvas.style.setProperty('cursor', this.baseline, this.baselinePriority);
      else canvas.style.removeProperty('cursor');
    }
  }
}
