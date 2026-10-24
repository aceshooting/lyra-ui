import { deferredPlaceReady as place } from '../../../internal/anchored-overlay-runtime.js';
import { getInheritedPropertyDescriptor } from '../../../internal/data-descriptors.js';
import { applyComposedFocusRepair, captureComposedFocusRepair, focusFirstAvailable } from '../../../internal/focus-navigation.js';
import { finiteRange } from '../../../internal/numbers.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { collectFocusableElements, composedContains, deepActiveElement } from '../../../internal/overlay-stack.js';
import { virtualAnchorFromRect } from '../../../internal/positioner-geometry.js';
import { admitMapAnchorOptions, type LyraMapAnchorBoundary, type LyraMapAnchorCloseDetail, type LyraMapAnchorCloseReason,
  type LyraMapAnchorSafeArea } from './map-anchor-options.js';
import type { MapLibreMapCapability } from './map-loader.js';
import { mapOwnValue, renderedSizeKey } from './map-readers.js';

/** The private element capabilities anchor placement uses. Generations identify the current engine. */
export interface MapAnchorHost {
  readonly element: HTMLElement & {
    anchorLngLat?: readonly [number, number] | null;
    readonly anchorBoundary?: LyraMapAnchorBoundary;
    readonly anchorSafeArea?: LyraMapAnchorSafeArea;
    readonly anchorClosable: boolean;
    readonly isUpdatePending: boolean;
    project(lngLat: readonly [number, number]): readonly [number, number] | undefined;
  };
  wrapper(): HTMLElement | undefined;
  container(): HTMLElement | undefined;
  /** The inset clipping fence inside the map allocation. */
  fence(): HTMLElement | undefined;
  map(): MapLibreMapCapability | undefined;
  styleLoaded(): boolean;
  generations(): readonly [style: number, connection: number];
  updateActive(): boolean;
  afterUpdate(callback: () => void, key: string): void;
  interactionBlocked(): boolean;
  direction(): 'ltr' | 'rtl';
  emitClose(detail: LyraMapAnchorCloseDetail): void;
}

/**
 * Placement, focus return and closable Escape ownership for one element's `anchor` slot. Loaded
 * on demand once a coordinate is requested; the element keeps the slot, the localized close
 * action and the public `closeAnchor()`/`focusAnchor()` entry points.
 */
export class MapAnchorController {
  private epoch = 0;
  private placed = false;
  private placedCoordinates?: readonly [number, number] | null;
  private closingState = false;
  private overlay?: OverlayHandle;
  private returnTarget?: HTMLElement;
  private boundaryObserver?: ResizeObserver;
  private observedBoundaries: readonly Element[] = [];
  private cleanup?: () => void;
  private frame?: number;

  constructor(private readonly host: MapAnchorHost) {}

  /** True while `close()` clears `anchorLngLat`, which then must not hide the anchor a second time. */
  get closing(): boolean { return this.closingState; }

  private view(): (Window & typeof globalThis) | null {
    return (this.host.element.ownerDocument as Document | undefined)?.defaultView ?? null;
  }

  stop(): void {
    this.epoch += 1;
    this.placed = false; this.placedCoordinates = undefined;
    const cleanup = this.cleanup; this.cleanup = undefined;
    cleanup?.();
    this.overlay?.suspend();
  }

  /** Runs `sync()` on the next animation frame, once however many callers ask. */
  schedule(): void {
    this.stop();
    if (this.frame !== undefined) return;
    const view = this.view();
    if (!view || typeof view.requestAnimationFrame !== 'function') {
      this.sync();
      return;
    }
    this.frame = view.requestAnimationFrame(() => {
      this.frame = undefined;
      this.sync();
    });
  }

  private cancelFrame(): void {
    if (this.frame === undefined) return;
    this.view()?.cancelAnimationFrame?.(this.frame);
    this.frame = undefined;
  }

  focus(): boolean {
    const wrapper = this.host.wrapper();
    if (!wrapper || !this.isOpen()) return false;
    const epoch = this.epoch;
    const targets = collectFocusableElements(wrapper);
    if (epoch !== this.epoch || !this.isOpen() || targets.length === 0) return false;
    this.captureReturnTarget(wrapper);
    if (epoch !== this.epoch || !this.isOpen()) return false;
    const focused = focusFirstAvailable(targets);
    return focused && epoch === this.epoch && this.isOpen();
  }

  private isOpen(): boolean {
    const host = this.host, element = host.element, wrapper = host.wrapper();
    return element.isConnected && !!host.map() && host.styleLoaded() && this.placed &&
      !element.isUpdatePending && this.placedCoordinates === element.anchorLngLat &&
      !!wrapper && !wrapper.hidden && !host.interactionBlocked() && this.hasContent();
  }

  private captureReturnTarget(wrapper: HTMLElement): void {
    const active = deepActiveElement(this.host.element.ownerDocument);
    if (!active || composedContains(wrapper, active)) return;
    try {
      const descriptor = getInheritedPropertyDescriptor(active, 'focus');
      if (descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function') {
        this.returnTarget = active as HTMLElement;
        this.overlay?.updateRestoreFocusTo(this.returnTarget);
      }
    } catch { /* A missing focus capability does not create a return target. */ }
  }

  close(reason: LyraMapAnchorCloseReason): boolean {
    const host = this.host, element = host.element, wrapper = host.wrapper();
    if (!wrapper || !this.isOpen()) return false;
    const requestEpoch = this.epoch, map = host.map(), coordinates = element.anchorLngLat;
    const repair = captureComposedFocusRepair(wrapper, this.returnTarget ?? null);
    if (requestEpoch !== this.epoch || map !== host.map() || coordinates !== element.anchorLngLat || !this.isOpen()) return false;
    this.closingState = true;
    try { element.anchorLngLat = null; } finally { this.closingState = false; }
    this.hide(false, true);
    const epoch = this.epoch;
    host.emitClose(Object.freeze({ reason } satisfies LyraMapAnchorCloseDetail));
    if (repair && epoch === this.epoch && element.anchorLngLat === null) applyComposedFocusRepair(repair);
    return true;
  }

  hide(restore = true, retire = false): void {
    const host = this.host, element = host.element, wrapper = host.wrapper();
    const requestEpoch = this.epoch, map = host.map(), coordinates = element.anchorLngLat;
    const repair = restore && wrapper ? captureComposedFocusRepair(wrapper, this.returnTarget ?? null) : null;
    if (requestEpoch !== this.epoch || map !== host.map() || coordinates !== element.anchorLngLat) return;
    this.stop();
    if (wrapper) wrapper.hidden = true;
    const epoch = this.epoch;
    if (retire) {
      const overlay = this.overlay; this.overlay = undefined; this.returnTarget = undefined;
      overlay?.deactivate({ restoreFocus: false });
    } else this.overlay?.suspend();
    if (repair && epoch === this.epoch && !this.placed) applyComposedFocusRepair(repair);
  }

  /** Retires placement, Escape ownership and boundary observation before the engine is removed. */
  dispose(): void {
    this.cancelFrame();
    this.hide(true, true);
    this.boundaryObserver?.disconnect(); this.boundaryObserver = undefined; this.observedBoundaries = [];
  }

  private syncOverlay(wrapper: HTMLElement): void {
    const host = this.host, element = host.element;
    if (!element.anchorClosable) {
      const overlay = this.overlay; this.overlay = undefined;
      overlay?.deactivate({ restoreFocus: false }); return;
    }
    if (!this.overlay) {
      const epoch = this.epoch;
      this.captureReturnTarget(wrapper);
      if (epoch !== this.epoch || !this.placed || !element.isConnected) return;
      const overlay = activateOverlay({ host: element, panel: () => host.wrapper() ?? null,
        onEscape: () => { this.close('escape'); }, beforeInitialFocus: () => false,
        restoreFocusTo: () => this.returnTarget ?? null, modal: false, trapFocus: false, lockScroll: false });
      if (epoch === this.epoch && this.placed && element.isConnected && element.anchorClosable && !this.overlay) this.overlay = overlay;
      else overlay.deactivate({ restoreFocus: false });
    } else this.overlay.resume();
  }

  private hasContent(): boolean {
    const slot = this.host.element.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="anchor"]');
    return slot?.assignedNodes({ flatten: true }).some(node => node.nodeType === 1 || node.nodeType === 3 && !!node.textContent?.trim()) ?? false;
  }

  private observeBoundaries(boundaries: readonly Element[]): void {
    if (boundaries.length === this.observedBoundaries.length && boundaries.every((value, index) => value === this.observedBoundaries[index])) return;
    this.boundaryObserver?.disconnect(); this.boundaryObserver = undefined;
    this.observedBoundaries = [...boundaries];
    const ResizeObserverClass = this.view()?.ResizeObserver;
    if (!ResizeObserverClass || boundaries.length === 0) return;
    let sizes = boundaries.map(renderedSizeKey);
    this.boundaryObserver = new ResizeObserverClass(() => {
      const next = boundaries.map(renderedSizeKey);
      if (next.every((value, index) => value === sizes[index])) return;
      sizes = next;
      if (this.host.element.isConnected) this.schedule();
    });
    for (const boundary of boundaries) this.boundaryObserver.observe(boundary);
  }

  /** Retains the element focus came from as the return target when focus enters the anchor. */
  focusIn(event: FocusEvent): void {
    const wrapper = this.host.wrapper(), previous = event.relatedTarget, view = this.view();
    if (!wrapper || !view || !(previous instanceof view.Element) || previous.ownerDocument !== this.host.element.ownerDocument || composedContains(wrapper, previous)) return;
    try {
      const descriptor = getInheritedPropertyDescriptor(previous, 'focus');
      if (descriptor && Object.hasOwn(descriptor, 'value') && typeof descriptor.value === 'function') {
        this.returnTarget = previous as HTMLElement; this.overlay?.updateRestoreFocusTo(this.returnTarget);
      }
    } catch { /* An unavailable previous focus target is not retained. */ }
  }

  /** The anchor's container-relative pixel position while its safe own coordinates are on screen. */
  private point(): readonly [number, number] | undefined {
    const host = this.host, position = host.element.anchorLngLat, container = host.container();
    if (!container || !Array.isArray(position)) return undefined;
    const lng = mapOwnValue(position, '0'), lat = mapOwnValue(position, '1');
    if (typeof lng !== 'number' || !Number.isFinite(lng) || typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) return undefined;
    const point = host.element.project([lng, lat]);
    if (!point) return undefined;
    const [x, y] = point;
    return x >= 0 && y >= 0 && x <= container.clientWidth && y <= container.clientHeight ? point : undefined;
  }

  /** Owns placement only after the current deferred positioner callback has measured the anchor. */
  sync(): void {
    const host = this.host, element = host.element;
    if (host.updateActive()) {
      const [generation, connection] = host.generations(), map = host.map();
      host.afterUpdate(() => {
        const [style, current] = host.generations();
        if (element.isConnected && current === connection && style === generation && host.map() === map) this.sync();
      }, `map-anchor-${connection}-${generation}`);
      return;
    }
    const wrapper = host.wrapper(), container = host.container(), fence = host.fence();
    if (!wrapper || !container || !fence || !element.isConnected || !host.map() || !host.styleLoaded() ||
      host.interactionBlocked() || !this.hasContent()) { this.hide(); return; }
    this.stop();
    const epoch = this.epoch, map = host.map(), coordinates = element.anchorLngLat;
    const boundary = element.anchorBoundary, safeArea = element.anchorSafeArea, direction = host.direction();
    const current = (): boolean => element.isConnected && host.map() === map && host.styleLoaded() &&
      epoch === this.epoch && element.anchorLngLat === coordinates && element.anchorBoundary === boundary &&
      element.anchorSafeArea === safeArea && host.direction() === direction && !host.interactionBlocked();
    try {
      const admitted = admitMapAnchorOptions({ boundary, safeArea }, element.ownerDocument, { current });
      if (!admitted.ok || !current()) { if (epoch === this.epoch) this.hide(); return; }
      this.observeBoundaries(admitted.boundaries);
      const point = this.point();
      if (!current()) return;
      const width = finiteRange(container.clientWidth, 0, 0), height = finiteRange(container.clientHeight, 0, 0);
      const edges = admitted.safeArea;
      const start = Math.min(width, edges.inlineStart), end = Math.min(width, edges.inlineEnd);
      const top = Math.min(height, edges.blockStart), bottom = Math.min(height, edges.blockEnd);
      if (!point || start + end >= width || top + bottom >= height) { this.hide(); return; }
      fence.style.insetInlineStart = `${start}px`; fence.style.insetInlineEnd = `${end}px`;
      fence.style.insetBlockStart = `${top}px`; fence.style.insetBlockEnd = `${bottom}px`;
      const clip = fence.getBoundingClientRect();
      let left = clip.left, right = clip.right, upper = clip.top, lower = clip.bottom;
      for (const clipping of admitted.boundaries) {
        const bounds = clipping.getBoundingClientRect();
        if (!current()) return;
        left = Math.max(left, bounds.left); right = Math.min(right, bounds.right);
        upper = Math.max(upper, bounds.top); lower = Math.min(lower, bounds.bottom);
      }
      if (!(right - left > 16 && lower - upper > 16)) { this.hide(); return; }
      wrapper.hidden = false;
      const rect = container.getBoundingClientRect();
      if (!current()) return;
      const placement = place(virtualAnchorFromRect({ x: rect.left + point[0], y: rect.top + point[1], contextElement: container }), wrapper, {
        placement: 'top', strategy: 'absolute', offset: 12, boundary: [fence, ...admitted.boundaries], padding: 8, shiftCrossAxis: true,
        onPlaced: () => {
          if (!current() || !this.hasContent()) return;
          if (!this.placed) this.captureReturnTarget(wrapper);
          if (!current()) return;
          this.placed = true; this.placedCoordinates = coordinates;
          this.syncOverlay(wrapper);
        },
      });
      if (!current()) { placement(); return; }
      this.cleanup = placement;
      void placement.ready.then(ready => { if (!ready && current()) this.hide(); });
    } catch { if (current()) this.hide(); }
  }
}
