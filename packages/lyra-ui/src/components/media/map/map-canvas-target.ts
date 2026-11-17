import { flattenedParentElement } from '../../../internal/composed-tree.js';

interface Rect { readonly left: number; readonly top: number; readonly width: number; readonly height: number }
/** @internal Measured allocation shared only by the map layout controller and owner. */
export interface MapCanvasAllocation {
  readonly left: number; readonly top: number; readonly width: number; readonly height: number;
  readonly padding: Readonly<{ top: number; right: number; bottom: number; left: number }>;
}
const TOLERANCE = 0.5;

/** @internal Resolves a containing screen rectangle into the host's axis-aligned local coordinate space. */
export function mapCanvasAllocation(host: Rect, target: Rect, width: number, height: number): MapCanvasAllocation | undefined {
  if (![host.left, host.top, host.width, host.height, target.left, target.top, target.width, target.height, width, height].every(Number.isFinite) ||
    Math.min(host.width, host.height, target.width, target.height, width, height) <= 0 ||
    host.left < target.left - TOLERANCE || host.top < target.top - TOLERANCE ||
    host.left + host.width > target.left + target.width + TOLERANCE ||
    host.top + host.height > target.top + target.height + TOLERANCE) return undefined;
  const sx = width / host.width, sy = height / host.height;
  const left = (target.left - host.left) * sx, top = (target.top - host.top) * sy;
  const canvasWidth = target.width * sx, canvasHeight = target.height * sy;
  const padding = { left: Math.max(0, -left), top: Math.max(0, -top),
    right: Math.max(0, canvasWidth + left - width), bottom: Math.max(0, canvasHeight + top - height) };
  if (![left, top, canvasWidth, canvasHeight, ...Object.values(padding)].every(Number.isFinite)) return undefined;
  return { left, top, width: canvasWidth, height: canvasHeight, padding };
}

/** A bounded composed walk also rejects transforms whose rectangle is not an axis-aligned box. */
function compatibleAncestors(host: HTMLElement, target: unknown): boolean {
  const view = host.ownerDocument.defaultView;
  if (!view) return false;
  let current: Element | null = host, found = target === 'viewport';
  for (let count = 0; current && count < 128; count++, current = flattenedParentElement(current)) {
    if (current === target && current !== host) found = true;
    const style = view.getComputedStyle(current);
    if (style.perspective !== 'none' || style.rotate !== 'none' && style.rotate !== '0deg') return false;
    if (style.scale !== 'none' && style.scale.split(/\s+/).some(value => !Number.isFinite(parseFloat(value)) || parseFloat(value) <= 0)) return false;
    if (style.transform !== 'none') {
      const matrix = new view.DOMMatrixReadOnly(style.transform);
      if (!matrix.is2D || matrix.a <= 0 || matrix.d <= 0 || matrix.b !== 0 || matrix.c !== 0) return false;
    }
  }
  return current === null && found;
}

/** Absolute children use the padding box. CSS used dimensions retain fractional precision,
 * unlike clientWidth/clientHeight, and the rendered border box supplies the transform scale. */
function paddingBox(base: HTMLElement, rect: DOMRect, view: Window): { rect: Rect; width: number; height: number } | undefined {
  const style = view.getComputedStyle(base);
  const number = (value: string): number => parseFloat(value);
  const left = number(style.borderLeftWidth), right = number(style.borderRightWidth);
  const top = number(style.borderTopWidth), bottom = number(style.borderBottomWidth);
  const paddingX = number(style.paddingLeft) + number(style.paddingRight);
  const paddingY = number(style.paddingTop) + number(style.paddingBottom);
  const borderWidth = number(style.width) + (style.boxSizing === 'border-box' ? 0 : paddingX + left + right);
  const borderHeight = number(style.height) + (style.boxSizing === 'border-box' ? 0 : paddingY + top + bottom);
  const width = borderWidth - left - right, height = borderHeight - top - bottom;
  if (![borderWidth, borderHeight, width, height, left, right, top, bottom].every(Number.isFinite) ||
    Math.min(borderWidth, borderHeight, width, height, rect.width, rect.height) <= 0) return undefined;
  const sx = rect.width / borderWidth, sy = rect.height / borderHeight;
  return { width, height, rect: { left: rect.left + left * sx, top: rect.top + top * sy,
    width: width * sx, height: height * sy } };
}

const VARIABLES = ['left', 'top', 'width', 'height', 'inset-top', 'inset-right', 'inset-bottom', 'inset-left'] as const;
interface AllocationHost {
  readonly element: HTMLElement;
  base(): HTMLElement | undefined;
  target(): unknown;
  changed(allocation: MapCanvasAllocation | undefined): void;
}

/** @internal Tracks only an opted-in allocation. The engine and all DOM nodes retain their original owner. */
export class MapCanvasAllocationController {
  private frame?: { view: Window; id: number };
  private base?: HTMLElement;
  private key = '';
  private updating = false;
  private stopped = false;
  constructor(private readonly host: AllocationHost) {}
  refresh(): void {
    if (this.stopped || this.updating) return;
    this.updating = true;
    try {
      const host = this.host.element, base = this.host.base(), target = this.host.target();
      let allocation: MapCanvasAllocation | undefined;
      const view = host.ownerDocument.defaultView;
      if (host.isConnected && base && target !== undefined && view) {
        try {
          const candidate = target as HTMLElement | null;
          const validTarget = target === 'viewport' || candidate !== null && typeof candidate === 'object' &&
            candidate !== host && candidate.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
            candidate.ownerDocument === host.ownerDocument && candidate.isConnected;
          if (validTarget && compatibleAncestors(base, target)) {
            const rect = base.getBoundingClientRect();
            const viewport = view.visualViewport;
            const targetRect = target === 'viewport'
              ? { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
                width: viewport?.width ?? host.ownerDocument.documentElement.clientWidth,
                height: viewport?.height ?? host.ownerDocument.documentElement.clientHeight }
              : (target as HTMLElement).ownerDocument === host.ownerDocument && (target as HTMLElement).isConnected
                ? (target as HTMLElement).getBoundingClientRect() : undefined;
            const box = paddingBox(base, rect, view);
            if (targetRect && box) allocation = mapCanvasAllocation(box.rect, targetRect, box.width, box.height);
          }
        } catch { /* An unavailable target restores the component's own allocation. */ }
      }
      const values = allocation ? [allocation.left, allocation.top, allocation.width, allocation.height,
        allocation.padding.top, allocation.padding.right, allocation.padding.bottom, allocation.padding.left] : [];
      const key = values.map(value => Math.round(value * 1000) / 1000).join(',');
      if (base !== this.base || key !== this.key) {
        if (this.base && this.base !== base) this.clear(this.base);
        this.base = base; this.key = key;
        if (base) {
          VARIABLES.forEach((name, index) => {
            if (allocation) base.style.setProperty(`--_lr-map-canvas-${name}`, `${values[index]}px`);
            else base.style.removeProperty(`--_lr-map-canvas-${name}`);
          });
        }
        this.host.changed(allocation);
      }
      if (this.stopped) return;
      if (host.isConnected && this.host.target() !== undefined && view && host.ownerDocument.defaultView === view) this.schedule(view);
      else this.cancel();
    } finally { this.updating = false; }
  }
  private schedule(view: Window): void {
    if (this.frame?.view === view) return;
    this.cancel();
    const id = view.requestAnimationFrame(() => {
      if (this.frame?.id !== id || this.frame.view !== view) return;
      this.frame = undefined; this.refresh();
    });
    this.frame = { view, id };
  }
  private cancel(): void {
    if (this.frame) this.frame.view.cancelAnimationFrame(this.frame.id);
    this.frame = undefined;
  }
  private clear(base: HTMLElement): void {
    for (const name of VARIABLES) base.style.removeProperty(`--_lr-map-canvas-${name}`);
  }
  dispose(): void {
    this.stopped = true; this.cancel();
    if (this.base) this.clear(this.base);
    this.base = undefined;
  }
}
