import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { acquireMapDrawingGesture } from './map-drawing-gesture.js';
import { acquireMapDrawingPan } from './map-drawing-pan.js';
import { MapDrawingPointer } from './map-drawing-pointer.js';
import { MapDrawing, measureDrawing, type LyraMapDrawingCancelDetail, type LyraMapDrawingCancelReason, type LyraMapDrawingMode,
  type LyraMapDrawingPoint, type LyraMapDrawingSnapshot, type LyraMapDrawingVertexEndDetail, type MapDrawingError } from './map-drawing.js';
import type { MapLibreMapCapability } from './map-loader.js';
import { mapCoordinates, mapOwnValue } from './map-readers.js';
import { snapshotMapOwnedFeatureInput } from './map-owned-feature-input.js';
import { MapOwnedFeatures } from './map-owned-features.js';
import type { MapOwnedOverlaySnapshot } from './map-overlay-admission.js';
import type { LyraMapStyleValue } from './map-style-override-admission.js';

/** A projected, viewport-clipped vertex edit handle, positioned inside the element's base part. */
export interface MapDrawingHandle { readonly index: number; readonly x: number; readonly y: number; }
/** A projected on-map measurement label: a segment, the closing segment, the area or the total length. */
export interface MapDrawingLabel { readonly kind: 'segment' | 'closing' | 'area' | 'length'; readonly value: number; readonly x: number; readonly y: number; }
/** Visual CSS pixels within which a press on the first vertex closes a polygon. */
const CLOSE_DISTANCE = 12;

/** The private element capabilities drawing uses. Generations identify the current engine. */
export interface MapDrawingHost {
  readonly element: HTMLElement & {
    readonly mapStyle: unknown;
    readonly drawMode: LyraMapDrawingMode;
    readonly pickMode: boolean;
    readonly overlays: unknown;
    readonly drawingMeasurements: boolean;
    project(lngLat: readonly [number, number]): readonly [number, number] | undefined;
    unproject(point: readonly [number, number]): readonly [number, number] | undefined;
  };
  map(): MapLibreMapCapability | undefined;
  styleLoaded(): boolean;
  generations(): readonly [style: number, connection: number];
  /** False while the selected engine loads or after initialization failed. */
  usable(): boolean;
  /** The drawing generation; an in-progress image export is tied to it. */
  epoch(): number;
  advanceEpoch(): void;
  actionAllowed(): boolean;
  interactionAllowed(): boolean;
  interactionBlocked(): boolean;
  updateActive(): boolean;
  afterUpdate(callback: () => void, key: string): void;
  emit(type: 'lr-map-draw-start' | 'lr-map-draw-change' | 'lr-map-draw-complete', state: LyraMapDrawingSnapshot): void;
  emitVertexEnd(detail: LyraMapDrawingVertexEndDetail): void;
  emitCancel(detail: LyraMapDrawingCancelDetail): void;
  showError(error?: MapDrawingError): void;
  clearError(): void;
  /** Resets `drawMode` to `none` without treating it as an authored mode change. */
  resetMode(): void;
  suppressClick(): void;
  syncCursor(): void;
  /** Requests a render of the drawing controls after a rendered drawing value changed. */
  changed(): void;
  invalidate(): void;
  check(): void;
  fail(): void;
  direction(): 'ltr' | 'rtl';
  accentColor(): string;
  resolve(value: LyraMapStyleValue, property: string): LyraMapStyleValue;
}

export { measureDrawing };

/**
 * Drawing sessions, explicit vertex editing, native gesture leases and temporary resources for one
 * element. Loaded on demand: the element keeps `drawMode`, its localized controls and the cancel
 * path of an armed mode, and delegates everything else here once this runtime has loaded.
 */
export class MapDrawingController {
  private session?: MapDrawing;
  private started = false;
  private snapshotState?: LyraMapDrawingSnapshot;
  private editingState = false;
  private handlesState: readonly MapDrawingHandle[] = [];
  private labelsState: readonly MapDrawingLabel[] = [];
  /** The pointer coordinate a rubber-band segment runs to, while drawing. */
  private previewPoint?: LyraMapDrawingPoint;
  private previewFrame?: number;
  /** The style generation the temporary resources were last rendered for. */
  private resourceStyle?: number;
  private keyCleanup?: () => void;
  private selectedState = 0;
  private dispatchingState = false;
  private pointer?: MapDrawingPointer;
  private completing?: MapDrawing;
  private editAdmission = false;
  private editCancelled = false;
  private release?: () => void;
  private overlay?: OverlayHandle;
  private features?: MapOwnedFeatures;
  private abort?: AbortController;
  private resourceEpoch = 0;
  private idCounter = 0;
  private source?: string;
  private resourcesPending = false;
  private resourceWork: Promise<void> = Promise.resolve();
  private finishWork?: () => void;

  constructor(private readonly host: MapDrawingHost) {}

  /** A drawing or explicit edit session exists. */
  get active(): boolean { return this.session !== undefined; }
  get snapshot(): LyraMapDrawingSnapshot | undefined { return this.snapshotState; }
  get editing(): boolean { return this.editingState; }
  get handles(): readonly MapDrawingHandle[] { return this.handlesState; }
  /** Projected measurement labels while `drawingMeasurements` is set. */
  get labels(): readonly MapDrawingLabel[] { return this.labelsState; }
  get selected(): number { return this.selectedState; }
  /** A drawing event or native gesture admission is being dispatched. */
  get dispatching(): boolean { return this.dispatchingState; }
  /** Temporary native resources are still being prepared. */
  get pending(): boolean { return this.resourcesPending; }
  get work(): Promise<void> { return this.resourceWork; }
  /** Native ID of the temporary drawing source, which basemap interactions must never expose. */
  get sourceId(): string | undefined { return this.source; }

  ownsLayer(id: string): boolean { return this.features?.ownsLayer(id) === true; }
  consumeClick(): boolean { return this.pointer?.consumeClick() === true; }
  begin(event: PointerEvent, index: number): void { this.pointer?.begin(event, index); }

  select(index: number): void {
    if (index === this.selectedState) return;
    this.selectedState = index; this.host.changed();
  }

  private setSnapshot(value: LyraMapDrawingSnapshot | undefined): void {
    if (value === this.snapshotState) return;
    this.snapshotState = value; this.host.changed();
  }

  private setEditing(value: boolean): void {
    if (value === this.editingState) return;
    this.editingState = value; this.host.changed();
  }

  private setHandles(value: readonly MapDrawingHandle[]): void {
    if (value === this.handlesState) return;
    this.handlesState = value; this.host.changed();
  }

  edit(snapshot: LyraMapDrawingSnapshot): boolean {
    if (this.editAdmission) return false;
    this.editCancelled = false; this.editAdmission = true;
    try { return this.admitEdit(snapshot); } finally { this.editAdmission = false; }
  }

  private admitEdit(snapshot: LyraMapDrawingSnapshot): boolean {
    const host = this.host, element = host.element;
    const authoredStyle = element.mapStyle, authoredMode = element.drawMode;
    const previous = this.session, map = host.map(), [style, connection] = host.generations(), epoch = host.epoch();
    if (!map || !host.styleLoaded() || !host.usable() || element.pickMode || !host.actionAllowed() ||
      (previous && this.completing !== previous) || (this.dispatchingState && (!previous || this.completing !== previous))) return false;
    const engine = (): boolean => { const [s, c] = host.generations(); return host.map() === map && s === style && c === connection; };
    const current = (): boolean => engine() && host.epoch() === epoch && !this.editCancelled && this.session === previous &&
      element.mapStyle === authoredStyle && element.drawMode === authoredMode && !element.pickMode && host.actionAllowed();
    let candidate: MapDrawing;
    try {
      const phase = mapOwnValue(snapshot, 'phase'); if (!current() || phase !== 'completed') return false;
      const mode = mapOwnValue(snapshot, 'mode'); if (!current() || (mode !== 'line' && mode !== 'polygon')) return false;
      const vertices = mapOwnValue(snapshot, 'vertices'); if (!current() || !Array.isArray(vertices)) return false;
      const length = mapOwnValue(vertices, 'length');
      if (!current() || typeof length !== 'number' || !Number.isSafeInteger(length) || length < 2 || length > 512) return false;
      candidate = new MapDrawing(mode);
      for (let index = 0; index < length; index++) {
        const point = mapOwnValue(vertices, String(index)); if (!current()) return false;
        const result = candidate.add(point); if (!current() || !result.accepted) return false;
      }
      if (!candidate.complete().accepted || !current()) return false;
    } catch { return false; }
    if (previous) this.clear();
    const admittedEpoch = host.epoch();
    const owns = (): boolean => engine() && host.epoch() === admittedEpoch && !this.editCancelled && element.mapStyle === authoredStyle &&
      (!this.session || this.session === candidate) && !element.pickMode && element.drawMode === 'none';
    if (!owns() || !host.actionAllowed()) return false;
    // The gesture lease outlives a style swap: only the engine instance and connection bound it.
    const sameEngine = (): boolean => host.map() === map && host.generations()[1] === connection;
    const lease = acquireMapDrawingGesture(map, { current: () => sameEngine() && host.epoch() === admittedEpoch && (!this.session || this.session === candidate) });
    if (!lease.accepted || !owns() || !host.actionAllowed()) { lease.release(); return false; }
    this.release = lease.release; this.session = candidate; this.setEditing(true);
    this.started = true; this.select(0); this.setSnapshot(candidate.snapshot()); host.clearError();
    this.sync(); this.renderResources();
    return this.session === candidate;
  }

  undo(): boolean {
    const session = this.session;
    if (!session || this.dispatchingState || !this.host.interactionAllowed()) return false;
    const result = session.undo();
    if (!result.accepted) return false;
    this.setSnapshot(result.state); this.host.clearError();
    this.emitChange(session);
    if (this.session === session && this.snapshotState === result.state) this.renderResources();
    return true;
  }

  complete(): boolean {
    const session = this.session;
    if (!session || this.dispatchingState || !this.host.actionAllowed()) return false;
    const result = this.editingState ? { accepted: true, state: session.snapshot(), error: undefined } : session.complete();
    if (!result.accepted) { this.host.showError(result.error); return false; }
    this.setSnapshot(result.state);
    this.dispatchingState = true; this.completing = session;
    try { this.host.emit('lr-map-draw-complete', result.state); }
    finally { this.dispatchingState = false; this.completing = undefined; }
    if (this.session === session) this.clear();
    return true;
  }

  cancel(reason: LyraMapDrawingCancelReason, keepMode: boolean, armedMode: LyraMapDrawingMode): boolean {
    const session = this.session;
    if (!session && armedMode !== 'line' && armedMode !== 'polygon') { if (this.editAdmission) this.editCancelled = true; return false; }
    const state = session ? session.snapshot().phase !== 'cancelled' ? session.cancel().state : undefined
      : armedMode === 'line' || armedMode === 'polygon' ? new MapDrawing(armedMode).cancel().state : undefined;
    this.clear(keepMode);
    if (state) this.host.emitCancel(Object.freeze({ ...state, reason } satisfies LyraMapDrawingCancelDetail));
    return true;
  }

  private clear(keepMode = false): void {
    const host = this.host, pointer = this.pointer, release = this.release, overlay = this.overlay, mode = host.element.drawMode;
    this.pointer = undefined; this.release = undefined; this.overlay = undefined;
    this.session = undefined; this.started = false; this.setEditing(false); this.setHandles([]); this.setSnapshot(undefined); host.clearError();
    if (!keepMode && host.element.drawMode === mode) host.resetMode();
    if (pointer?.consumeClick()) host.suppressClick();
    pointer?.dispose(); release?.(); overlay?.deactivate();
    this.keyCleanup?.(); this.keyCleanup = undefined; this.clearPreview(false); this.setLabels([]);
    if (this.session) return;
    host.advanceEpoch();
    this.renderResources(); host.syncCursor();
  }

  sync(): void {
    const host = this.host, element = host.element;
    if (host.updateActive()) {
      host.afterUpdate(() => this.sync(), 'map-sync-drawing');
      return;
    }
    if (element.pickMode) { this.cancel('pick-mode', false, element.drawMode); return; }
    if (host.interactionBlocked()) { this.cancel('disabled', false, element.drawMode); return; }
    if (element.drawMode !== 'line' && element.drawMode !== 'polygon' && !this.editingState) return;
    const map = host.map();
    if (!element.isConnected || !map || !host.styleLoaded() || !host.usable()) return;
    if (!this.session) {
      const mode = element.drawMode;
      if (mode !== 'line' && mode !== 'polygon') return;
      const [, connection] = host.generations(), epoch = host.epoch();
      // Bound to the engine and connection, not the style: a session survives a style swap.
      const current = (): boolean => host.map() === map && host.epoch() === epoch && host.generations()[1] === connection;
      this.dispatchingState = true;
      let lease: ReturnType<typeof acquireMapDrawingGesture>;
      try { lease = acquireMapDrawingGesture(map, { current }); }
      finally { this.dispatchingState = false; }
      if (!lease.accepted || !current() || !element.isConnected || element.drawMode !== mode || element.pickMode || host.interactionBlocked()) {
        lease.release(); if (!lease.accepted && current()) host.showError(); return;
      }
      this.release = lease.release; host.clearError();
      this.session = new MapDrawing(mode);
      this.setSnapshot(this.session.snapshot());
    }
    this.installPointer(); this.installKeys(); this.scheduleHandles();
    if (this.resourceStyle !== host.generations()[0]) this.renderResources();
    if (!this.overlay) this.overlay = activateOverlay({
      host: element, panel: () => element.shadowRoot?.querySelector<HTMLElement>('[part="drawing-controls"]') ?? null,
      onEscape: () => { this.cancel('escape', false, element.drawMode); }, beforeInitialFocus: () => false,
      modal: false, trapFocus: false, lockScroll: false,
    });
    host.syncCursor();
  }

  private installPointer(): void {
    const host = this.host, map = host.map(), session = this.session, epoch = host.epoch(), [style, connection] = host.generations();
    if (!map || !session || this.pointer) return;
    const engine = (): boolean => { const [s, c] = host.generations(); return host.map() === map && host.epoch() === epoch && s === style && c === connection; };
    const owns = (): boolean => engine() && this.session === session;
    try {
      const canvas = map.getCanvas();
      if (!owns() || !host.interactionAllowed()) return;
      this.pointer = new MapDrawingPointer({
        // A drag continues through the render its own previous step requested; configuration
        // changes and blocking still retire it.
        canvas, current: () => owns() && host.actionAllowed(),
        vertices: () => session.snapshot().vertices,
        project: point => host.element.project(point), unproject: point => host.element.unproject(point),
        replace: (index, point) => this.replaceVertex(session, index, point),
        acquirePan: () => acquireMapDrawingPan(map, { current: () => host.map() === map && host.epoch() === epoch && host.generations()[1] === connection }),
        cancel: () => { if (owns()) this.cancel('pointercancel', false, host.element.drawMode); },
        tap: (index, distance) => { if (owns()) this.tap(session, index, distance); },
        end: index => { if (owns()) this.emitVertexEnd(session, index); },
      });
    } catch { if (owns()) host.showError(); }
  }

  private replaceVertex(session: MapDrawing, index: number, point: unknown): boolean {
    if (this.session !== session || this.dispatchingState || !this.host.actionAllowed()) return false;
    const result = session.replace(index, point);
    if (this.session !== session) return false;
    if (!result.accepted) { this.host.showError(result.error); return false; }
    this.setSnapshot(result.state); this.host.clearError(); this.select(index);
    this.emitChange(session);
    if (this.session === session && this.snapshotState === result.state) this.renderResources();
    return true;
  }

  /** A swapped style discards temporary resources and invalidates style-bound pointer ownership;
   * the session itself, its gesture lease and keyboard shortcuts carry over to the new style. */
  styleChanging(): void {
    const pointer = this.pointer; this.pointer = undefined;
    if (pointer?.consumeClick()) this.host.suppressClick();
    pointer?.dispose(); this.resourceStyle = undefined; this.clearPreview(false);
  }

  /** Closes a polygon from a press on its first vertex, as clicking near it closes the ring. */
  private tap(session: MapDrawing, index: number, distance: number): void {
    const state = session.snapshot();
    if (this.session !== session || this.editingState || state.mode !== 'polygon' || state.phase !== 'drawing' ||
      index !== 0 || state.vertices.length < 3 || !(distance <= CLOSE_DISTANCE)) return;
    this.complete();
  }

  private emitVertexEnd(session: MapDrawing, index: number): void {
    if (this.session !== session) return;
    const state = session.snapshot();
    if (!Number.isSafeInteger(index) || index < 0 || index >= state.vertices.length) return;
    this.dispatchingState = true;
    try { this.host.emitVertexEnd(Object.freeze({ ...state, index } satisfies LyraMapDrawingVertexEndDetail)); }
    finally { this.dispatchingState = false; }
  }

  /** Enter completes and Backspace removes the last vertex while the map canvas has focus. */
  private installKeys(): void {
    const host = this.host, map = host.map(), session = this.session;
    if (!map || !session || this.keyCleanup) return;
    let canvas: HTMLCanvasElement;
    try { canvas = map.getCanvas(); } catch { return; }
    const key = (event: KeyboardEvent): void => {
      if (this.session !== session || host.map() !== map || event.defaultPrevented || event.isComposing ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target !== canvas) return;
      if (event.key === 'Enter' && !event.repeat) { event.preventDefault(); this.complete(); }
      else if (event.key === 'Backspace' && !this.editingState) { event.preventDefault(); this.undo(); }
    };
    canvas.addEventListener('keydown', key);
    const shortcuts = canvas.getAttribute('aria-keyshortcuts');
    canvas.setAttribute('aria-keyshortcuts', this.editingState ? 'Enter' : 'Enter Backspace');
    this.keyCleanup = () => {
      canvas.removeEventListener('keydown', key);
      if (shortcuts === null) canvas.removeAttribute('aria-keyshortcuts'); else canvas.setAttribute('aria-keyshortcuts', shortcuts);
    };
  }

  /** Moves the rubber-band end to the pointer coordinate (`undefined` hides it), once per frame. */
  preview(point: LyraMapDrawingPoint | undefined): void {
    const state = this.snapshotState;
    const next = this.session && !this.editingState && state?.phase === 'drawing' && state.vertices.length > 0 ? point : undefined;
    if (next === undefined && this.previewPoint === undefined) return;
    this.previewPoint = next;
    if (this.previewFrame !== undefined) return;
    const view = this.host.element.ownerDocument.defaultView;
    const render = (): void => { this.previewFrame = undefined; if (this.session) this.renderResources(); };
    if (!view || typeof view.requestAnimationFrame !== 'function') { render(); return; }
    this.previewFrame = view.requestAnimationFrame(render);
  }

  private clearPreview(render = true): void {
    if (this.previewFrame !== undefined) this.host.element.ownerDocument.defaultView?.cancelAnimationFrame(this.previewFrame);
    this.previewFrame = undefined;
    const had = this.previewPoint !== undefined; this.previewPoint = undefined;
    if (had && render && this.session) this.renderResources();
  }

  private setLabels(value: readonly MapDrawingLabel[]): void {
    const previous = this.labelsState;
    if (value.length === previous.length && value.every((label, index) => {
      const old = previous[index]!; return old.kind === label.kind && old.value === label.value && old.x === label.x && old.y === label.y;
    })) return;
    this.labelsState = value; this.host.changed();
  }

  /** Re-renders temporary resources in the current drawing color after a theme change. */
  repaint(): void { if (this.session) this.renderResources(); }

  scheduleHandles(): void {
    this.host.afterUpdate(() => this.syncHandles(), 'map-drawing-handles');
  }

  private syncHandles(): void {
    const host = this.host, map = host.map(), session = this.session, state = this.snapshotState, epoch = host.epoch();
    const current = (): boolean => host.map() === map && this.session === session && this.snapshotState === state && host.epoch() === epoch && host.interactionAllowed();
    const next: MapDrawingHandle[] = [];
    const labels: MapDrawingLabel[] = [];
    if (map && session && state && current()) {
      try {
        const canvas = map.getCanvas(); if (!current()) return;
        const base = host.element.shadowRoot?.querySelector<HTMLElement>('[part="base"]');
        if (base) {
          const viewport = canvas.getBoundingClientRect(); if (!current()) return;
          const rect = base.getBoundingClientRect(); if (!current()) return;
          const width = canvas.clientWidth, height = canvas.clientHeight, baseWidth = base.clientWidth, baseHeight = base.clientHeight;
          if ([viewport.left, viewport.top, viewport.width, viewport.height, rect.left, rect.top, rect.width, rect.height, width, height, baseWidth, baseHeight].every(Number.isFinite) &&
            Math.min(width, height, baseWidth, baseHeight, viewport.width, viewport.height, rect.width, rect.height) > 0) {
            for (let index = 0; index < state.vertices.length; index++) {
              const point = host.element.project(state.vertices[index]!); if (!current()) return;
              if (!point || point[0] < 0 || point[1] < 0 || point[0] > width || point[1] > height) continue;
              const x = (viewport.left - rect.left + point[0] * viewport.width / width) * baseWidth / rect.width;
              const y = (viewport.top - rect.top + point[1] * viewport.height / height) * baseHeight / rect.height;
              if (Number.isFinite(x) && Number.isFinite(y)) next.push({ index, x, y });
            }
            if (host.element.drawingMeasurements && state.vertices.length > 1) {
              // Labels share the handles' viewport projection, so they follow pans, zooms and resizes.
              const place = (kind: MapDrawingLabel['kind'], value: number, ...points: LyraMapDrawingPoint[]): void => {
                let sx = 0, sy = 0;
                for (const point of points) {
                  const projected = host.element.project(point); if (!projected) return;
                  sx += projected[0] / points.length; sy += projected[1] / points.length;
                }
                if (!(sx >= 0 && sy >= 0 && sx <= width && sy <= height) || !Number.isFinite(value)) return;
                const x = (viewport.left - rect.left + sx * viewport.width / width) * baseWidth / rect.width;
                const y = (viewport.top - rect.top + sy * viewport.height / height) * baseHeight / rect.height;
                if (Number.isFinite(x) && Number.isFinite(y)) labels.push({ kind, value, x, y });
              };
              const vertices = state.vertices, measured = measureDrawing(state.mode, vertices);
              measured.segments.forEach((value, index) => { place('segment', value, vertices[index]!, vertices[index + 1]!); });
              if (measured.closing !== undefined) place('closing', measured.closing, vertices[vertices.length - 1]!, vertices[0]!);
              if (measured.area !== undefined && measured.centroid) place('area', measured.area, measured.centroid);
              if (state.mode === 'line') place('length', measured.length, vertices[vertices.length - 1]!);
              if (!current()) return;
            }
          }
        }
      } catch { if (!current()) return; }
    }
    if (next.length && !next.some(handle => handle.index === this.selectedState)) this.select(next[0]!.index);
    if (next.length !== this.handlesState.length || next.some((handle, index) => {
      const previous = this.handlesState[index]; return !previous || previous.index !== handle.index || previous.x !== handle.x || previous.y !== handle.y;
    })) this.setHandles(next);
    this.setLabels(labels);
  }

  vertexKey(event: KeyboardEvent, index: number): void {
    const host = this.host, session = this.session, state = this.snapshotState, map = host.map(), epoch = host.epoch();
    if (!session || !state || !map || this.dispatchingState || !host.interactionAllowed()) return;
    const current = (): boolean => this.session === session && this.snapshotState === state && host.map() === map && host.epoch() === epoch && host.interactionAllowed();
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Home' || event.key === 'End' || event.key === 'PageUp' || event.key === 'PageDown') {
      const handles = this.handlesState, position = handles.findIndex(handle => handle.index === index);
      const selected = event.key === 'Home' ? 0 : event.key === 'End' ? handles.length - 1
        : Math.max(0, Math.min(handles.length - 1, position + (event.key === 'PageUp' ? -1 : 1)));
      const handle = handles[selected];
      if (handle && current()) {
        this.select(handle.index);
        host.element.shadowRoot?.querySelectorAll<HTMLButtonElement>('[part="drawing-vertex"]')[selected]?.focus();
      }
      return;
    }
    const vertex = state.vertices[index]; if (!vertex) return;
    const point = host.element.project(vertex); if (!point || !current()) return;
    const step = event.shiftKey ? 32 : 8, rtl = host.direction() === 'rtl' ? -1 : 1;
    const dx = event.key === 'ArrowLeft' ? -step * rtl : event.key === 'ArrowRight' ? step * rtl : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const coordinate = host.element.unproject([point[0] + dx, point[1] + dy]);
    if (coordinate && current() && this.replaceVertex(session, index, coordinate)) this.emitVertexEnd(session, index);
  }

  private emitChange(session: MapDrawing): void {
    if (this.session !== session) return;
    this.dispatchingState = true;
    try { this.host.emit('lr-map-draw-change', session.snapshot()); }
    finally { this.dispatchingState = false; }
  }

  add(point: unknown): boolean {
    const session = this.session;
    if (!session || this.dispatchingState || !this.host.interactionAllowed()) return false;
    const first = !this.started;
    const result = session.add(point);
    if (!result.accepted) { this.host.showError(result.error); return false; }
    this.setSnapshot(result.state); this.host.clearError();
    if (first) {
      this.started = true;
      this.dispatchingState = true;
      try { this.host.emit('lr-map-draw-start', result.state); }
      finally { this.dispatchingState = false; }
    }
    this.emitChange(session);
    if (this.session === session && this.snapshotState === result.state) this.renderResources();
    return true;
  }

  addCenter(): void {
    const host = this.host, map = host.map(), session = this.session, epoch = host.epoch();
    if (!map || !session || this.dispatchingState || !host.interactionAllowed()) return;
    try {
      const point = mapCoordinates(map.getCenter());
      if (host.map() === map && this.session === session && host.epoch() === epoch && point) this.add(point);
    } catch { if (this.session === session) host.showError(); }
  }

  /** Stops temporary resource work; a replaced style also forgets its native source ID. */
  cancelResources(forgetSource = false): void {
    this.features?.cancel(); this.abort?.abort(); this.finishWork?.();
    this.abort = undefined; this.finishWork = undefined; this.resourcesPending = false;
    if (forgetSource) this.source = undefined;
  }

  /** Releases temporary resource ownership once the engine itself has been removed. */
  disposeResources(): void {
    this.features?.dispose(); this.source = undefined;
  }

  private renderResources(): void {
    const host = this.host, map = host.map();
    this.cancelResources();
    if (!map || !host.styleLoaded() || !host.element.isConnected) return;
    const state = this.snapshotState, [style] = host.generations(), epoch = ++this.resourceEpoch;
    this.resourceStyle = style;
    const controller = new AbortController(); this.abort = controller;
    const current = (): boolean => host.map() === map && host.generations()[0] === style && epoch === this.resourceEpoch &&
      host.element.isConnected && !controller.signal.aborted;
    const vertices = state && (state.phase === 'drawing' || this.editingState && state.phase === 'completed') ? state.vertices : [];
    this.scheduleHandles();
    if (!vertices.length && !this.source) return;
    this.resourcesPending = true; host.invalidate();
    let finish!: () => void;
    this.resourceWork = new Promise<void>(resolve => { finish = resolve; }); this.finishWork = finish;
    const run = async (): Promise<void> => {
      try {
        let id = this.source;
        if (vertices.length && !id) {
          const reserved = snapshotMapOwnedFeatureInput({ overlays: host.element.overlays, images: [], styleOverrides: [] }).overlays as MapOwnedOverlaySnapshot;
          const used = new Set([...reserved.sources.map(row => row.id), ...reserved.layers.map(row => row.layer.id)]);
          for (let attempt = 0; attempt < 512 && current(); attempt++) {
            const candidate = `lr-drawing-${this.idCounter++}`;
            const ids = [candidate, `${candidate}-points`, `${candidate}-line`, `${candidate}-fill`, `${candidate}-preview`];
            if (ids.some(value => used.has(value) || map.getSource(value) || map.getLayer(value))) continue;
            if (current()) id = candidate;
            break;
          }
          if (!id) throw new Error('Drawing resources are unavailable.');
          this.source = id;
        }
        if (!current()) return;
        const features: unknown[] = vertices.map(point => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [...point] } }));
        if (vertices.length > 1) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: vertices.map(point => [...point]) } });
        if (state?.mode === 'polygon' && vertices.length > 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...vertices.map(point => [...point]), [...vertices[0]!]]] } });
        // Rubber band: from the last vertex to the pointer and, for a polygon, back to the first.
        const preview = this.previewPoint, drawingPhase = state?.phase === 'drawing' && !this.editingState;
        if (preview && drawingPhase && vertices.length) {
          const last = vertices[vertices.length - 1]!;
          const band = state?.mode === 'polygon' && vertices.length > 1 ? [[...last], [...preview], [...vertices[0]!]] : [[...last], [...preview]];
          features.push({ type: 'Feature', properties: { preview: true }, geometry: { type: 'LineString', coordinates: band } });
        }
        const color = host.accentColor();
        const layers = vertices.length ? [
          { layer: { id: `${id}-fill`, type: 'fill', source: id, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': color, 'fill-opacity': 0.2 } } },
          { layer: { id: `${id}-line`, type: 'line', source: id, filter: ['all', ['==', '$type', 'LineString'], ['!has', 'preview']], paint: { 'line-color': color, 'line-width': 2 } } },
          { layer: { id: `${id}-preview`, type: 'line', source: id, filter: ['all', ['==', '$type', 'LineString'], ['has', 'preview']], paint: { 'line-color': color, 'line-width': 2, 'line-dasharray': [2, 2] } } },
          { layer: { id: `${id}-points`, type: 'circle', source: id, filter: ['==', '$type', 'Point'], paint: { 'circle-color': color, 'circle-radius': 5 } } },
        ] : [];
        await (this.features ??= new MapOwnedFeatures()).reconcile(map, style, { overlays: { sources: vertices.length ? [{ id, source: { type: 'geojson', data: { type: 'FeatureCollection', features } } }] : [], layers }, images: [], styleOverrides: [] }, {
          owner: host.element, signal: controller.signal, isCurrent: current, isGeneratedLayer: () => false,
          resolve: (value, property) => host.resolve(value, property),
        });
        if (current() && !vertices.length) this.source = undefined;
      } catch {
        if (current()) { host.showError(); host.fail(); }
      } finally {
        finish();
        if (current()) { this.resourcesPending = false; this.abort = undefined; this.finishWork = undefined; host.check(); }
      }
    };
    // Native resource callbacks may synchronously cancel or replace a drawing. Reconcile after
    // their mutation stack unwinds, so cleanup never reenters the owned-resource transaction.
    queueMicrotask(() => { if (current()) void run(); else finish(); });
  }
}
