import { deferredPlaceSession as place, type DeferredPlacementSession } from '../../../internal/anchored-overlay-runtime.js';
import { getInheritedPropertyDescriptor } from '../../../internal/data-descriptors.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { applyComposedFocusRepair, captureComposedFocusRepair, focusFirstAvailable,
  type ComposedFocusRepairSnapshot } from '../../../internal/focus-navigation.js';
import { activateNonmodalOverlay, type OverlayHandle } from '../../../internal/nonmodal-overlay-manager.js';
import { finiteRange } from '../../../internal/numbers.js';
import { reserveOverlayOrder } from '../../../internal/overlay-order.js';
import { collectAutofocusElements, collectFocusableElements, composedContains, deepActiveElement, observeOverlayStack,
  type OverlayStackEntrySnapshot } from '../../../internal/overlay-stack.js';
import { virtualAnchorFromRect } from '../../../internal/positioner-geometry.js';
import { admitMapAnchorOptions, type LyraMapAnchorBoundary, type LyraMapAnchorCloseDetail, type LyraMapAnchorCloseReason,
  type LyraMapAnchorSafeArea } from './map-anchor-options.js';
import { MAP_ANCHOR_SEAM, type MapAnchorChild, type MapAnchorOwnerOperation } from './map-anchor-seam.js';
import type { MapLibreMapCapability } from './map-loader.js';
import { mapOwnValue, renderedSizeKey } from './map-readers.js';

/** Controllers holding an Escape entry, across maps; Escape keeps the one containing focus on top. */
const escapeOwners = new Set<MapAnchorController>();
/** Each map's placed anchors, painted in raise order with the anchor containing focus in front. */
const rankings = new WeakMap<HTMLElement, Set<MapAnchorController>>();
const RANK = '--_lr-map-anchor-rank';
/** At most this many open child anchors of one map are placed, in document order. */
const LIMIT = 16;
let raises = 0;
/** Entries registered while focus is in another anchor go just below its entry, newest highest. */
let insertions = 0;

/** The private map capabilities every anchor of one element shares. Generations identify the current engine. */
export interface MapAnchorMapHost {
  readonly element: HTMLElement & {
    readonly anchorBoundary?: LyraMapAnchorBoundary;
    readonly anchorSafeArea?: LyraMapAnchorSafeArea;
    readonly isUpdatePending: boolean;
    project(lngLat: readonly [number, number]): readonly [number, number] | undefined;
  };
  container(): HTMLElement | undefined;
  map(): MapLibreMapCapability | undefined;
  generations(): readonly [style: number, connection: number];
  updateActive(): boolean;
  afterUpdate(callback: () => void, key: string): void;
  interactionBlocked(): boolean;
  direction(): 'ltr' | 'rtl';
}

/** One anchor's request, surface and notifications: the `anchor` slot, or one child anchor element. */
export interface MapAnchorHost extends MapAnchorMapHost {
  /** Unique per anchor, because deferred placement work is deduplicated by key. */
  readonly key: string;
  /** Owns Escape, focus return and the overlay stacking lease. */
  readonly overlayHost: HTMLElement;
  /** Set for a child anchor: it ranks, honours `[autofocus]` and repairs focus a removal dropped. */
  readonly child?: boolean;
  wrapper(): HTMLElement | undefined;
  /** The inset clipping fence inside the map allocation. */
  fence(): HTMLElement | undefined;
  /** The slot whose assigned content is placed. */
  content(): HTMLSlotElement | null | undefined;
  /** Whether the engine can place the anchor now. */
  styleLoaded(): boolean;
  /** The open request, compared by identity; `null` once withdrawn. */
  request(): readonly [number, number] | null | undefined;
  boundary(): LyraMapAnchorBoundary | undefined;
  safeArea(): LyraMapAnchorSafeArea | undefined;
  closable(): boolean;
  /** Whether the request owner has an uncommitted update. */
  pending(): boolean;
  /** Withdraws the request when `close()` accepts it. */
  retire(): void;
  emitClose(detail: LyraMapAnchorCloseDetail): void;
  /** Handles Escape instead of `close('escape')`. */
  escape?(): void;
  /** Focus-repair target after the return target. */
  fallback?(): HTMLElement | null;
  /** The focused element a removal may already have dropped to the body. */
  lost?(): Element | undefined;
  /** Placed once positioned; unplaced when hidden. */
  placed?(placed: boolean): void;
  /** Consumes a child's first-placement autofocus request, retained across engine reconnects. */
  autofocus?(): boolean;
}

interface MapAnchorPlacement {
  readonly document: Document;
  readonly map: MapLibreMapCapability | undefined;
  readonly wrapper: HTMLElement;
  readonly container: HTMLElement;
  readonly fence: HTMLElement;
  readonly direction: 'ltr' | 'rtl';
  readonly style: number;
  readonly connection: number;
  readonly boundaries: readonly Element[];
  readonly safeArea: Readonly<Required<LyraMapAnchorSafeArea>>;
  rect: DOMRect;
  current(): boolean;
  publish(): void;
  handle?: DeferredPlacementSession;
}

/**
 * Placement, focus return and closable Escape ownership for one anchor: an element's `anchor`
 * slot, or one `lr-map-anchor` child. Loaded on demand once a coordinate is requested or a child
 * opens; the elements keep their slots, localized close actions and public entry points.
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
  private placement?: MapAnchorPlacement;
  private frame?: number;
  /** When this anchor was last raised; the most recently raised one is painted in front. */
  private raisedAt = 0;
  /** The shared stack order of the current Escape entry. */
  private order = 0;
  /** The next placement starts a session: it raises the anchor and honours a child's `[autofocus]`. */
  private fresh = true;
  private listening = false;

  constructor(private readonly host: MapAnchorHost) {}

  /** True while `close()` clears `anchorLngLat`, which then must not hide the anchor a second time. */
  get closing(): boolean { return this.closingState; }

  private view(): (Window & typeof globalThis) | null {
    return (this.host.element.ownerDocument as Document | undefined)?.defaultView ?? null;
  }

  /** Rejects stale geometry immediately while retaining the placement subscriptions. */
  invalidate(): void {
    this.epoch += 1;
    this.placed = false; this.placedCoordinates = undefined;
    this.placement?.handle?.invalidate();
    this.overlay?.suspend();
  }

  stop(): void {
    this.invalidate();
    const placement = this.placement; this.placement = undefined;
    placement?.handle?.();
  }

  /** Runs `sync()` on the next animation frame, once however many callers ask. */
  schedule(): void {
    this.invalidate();
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
    const host = this.host, wrapper = host.wrapper();
    return host.element.isConnected && !!host.map() && host.styleLoaded() && this.placed &&
      !host.pending() && this.placedCoordinates === host.request() &&
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
    const host = this.host, wrapper = host.wrapper();
    if (!wrapper || !this.isOpen()) return false;
    const requestEpoch = this.epoch, map = host.map(), coordinates = host.request();
    const repair = captureComposedFocusRepair(wrapper, this.returnTarget ?? null);
    if (requestEpoch !== this.epoch || map !== host.map() || coordinates !== host.request() || !this.isOpen()) return false;
    this.closingState = true;
    try { host.retire(); } finally { this.closingState = false; }
    this.hide(false, true);
    const epoch = this.epoch;
    host.emitClose(Object.freeze({ reason } satisfies LyraMapAnchorCloseDetail));
    if (repair && epoch === this.epoch && host.request() === null) applyComposedFocusRepair(repair);
    return true;
  }

  hide(restore = true, retire = false): void {
    const host = this.host, wrapper = host.wrapper();
    const requestEpoch = this.epoch, map = host.map(), coordinates = host.request();
    const repair = restore && wrapper ? this.repairFrom(wrapper) : null;
    if (requestEpoch !== this.epoch || map !== host.map() || coordinates !== host.request()) return;
    this.stop();
    if (wrapper) wrapper.hidden = true;
    if (rankings.get(host.element)?.delete(this)) { wrapper?.style.removeProperty(RANK); MapAnchorController.rank(host.element); }
    host.placed?.(false);
    const epoch = this.epoch;
    if (retire) {
      const overlay = this.overlay; this.overlay = undefined; this.returnTarget = undefined; this.fresh = true;
      escapeOwners.delete(this);
      overlay?.deactivate({ restoreFocus: false });
    } else this.overlay?.suspend();
    if (repair && epoch === this.epoch && !this.placed) this.repair(repair);
  }

  /** Focus inside the anchor, captured before an accepted close hides it. */
  capture(): ComposedFocusRepairSnapshot | null {
    const wrapper = this.host.wrapper();
    return wrapper ? this.repairFrom(wrapper) : null;
  }

  /** Returns captured focus to the return target, else the fallback, unless focus has since moved on. */
  repair(snapshot: unknown): void {
    if (!snapshot) return;
    const repair = snapshot as ComposedFocusRepairSnapshot;
    applyComposedFocusRepair(repair, [repair.candidate, this.host.fallback?.()]);
  }

  /** Focus inside `wrapper` now, or focus a removed child anchor already dropped to the body. */
  private repairFrom(wrapper: HTMLElement): ComposedFocusRepairSnapshot | null {
    const host = this.host, document = wrapper.ownerDocument, lost = host.lost?.(), active = deepActiveElement(document);
    const candidate = (): HTMLElement | null => this.returnTarget ?? host.fallback?.() ?? null;
    const target = lost && (!active || active === document.body || active === document.documentElement) ? candidate() : null;
    return captureComposedFocusRepair(wrapper, candidate) ??
      (lost && target ? { activeElement: lost, candidate: target, document, owner: wrapper } : null);
  }

  /** Brings a placed anchor to the front of its map's paint order and, for focus or a press, of the anchors' Escape order. */
  raise(escape = true): void {
    if (!rankings.get(this.host.element)?.has(this) || !this.ranked()) return;
    this.raisedAt = ++raises;
    MapAnchorController.rank(this.host.element);
    if (escape) this.reRegister();
  }

  /** Child anchors rank; the slot anchor joins only while its map places at least one child. */
  private ranked(): boolean {
    return !!this.host.child || [...rankings.get(this.host.element) ?? []].some(member => member.host.child);
  }

  /** Joins the map's ranking once placed; the first placement of a session raises and autofocuses. */
  private enter(wrapper: HTMLElement): void {
    const host = this.host, members = rankings.get(host.element) ?? new Set<MapAnchorController>();
    rankings.set(host.element, members);
    const joined = !members.has(this);
    members.add(this);
    host.placed?.(true);
    if (!host.child && !this.listening) {
      this.listening = true;
      wrapper.addEventListener('pointerdown', () => { this.raise(); });
      wrapper.addEventListener('focusout', () => { queueMicrotask(() => { this.focusOut(); }); });
    }
    if (!this.fresh) { if (joined) MapAnchorController.rank(host.element); return; }
    this.fresh = false;
    // The new Escape entry is already ordered; opening only brings the panel to the front.
    this.raise(false);
    if (!host.autofocus?.() || composedContains(wrapper, deepActiveElement(wrapper.ownerDocument))) return;
    for (const target of collectAutofocusElements(wrapper)) {
      if (focusFirstAvailable(target) || focusFirstAvailable(collectFocusableElements(target))) break;
    }
  }

  /** Writes each placed anchor's paint rank: raise order, the anchor containing focus in front. */
  private static rank(map: HTMLElement): readonly MapAnchorController[] {
    const members = [...rankings.get(map) ?? []], ranked = members.some(member => member.host.child);
    const active = deepActiveElement(map.ownerDocument), keys = new Map<MapAnchorController, number>();
    for (const member of members) {
      const wrapper = member.host.wrapper();
      keys.set(member, wrapper && composedContains(wrapper, active) ? raises + 1 : member.raisedAt);
    }
    members.sort((a, b) => keys.get(a)! - keys.get(b)!);
    members.forEach((member, index) => {
      const style = member.host.wrapper()?.style;
      if (ranked) style?.setProperty(RANK, String(index));
      else style?.removeProperty(RANK);
    });
    return members;
  }

  /** Focus has settled outside the old control; restore recency if no anchor still holds it. */
  focusOut(): void {
    if (!this.ranked()) return;
    const members = MapAnchorController.rank(this.host.element);
    [...members].reverse().find(member => member.host.closable() && member.isOpen())?.reRegister();
  }

  /** Moves this Escape entry on top, but only past other anchors' entries and the overlays nested in them. */
  private reRegister(): void {
    const host = this.host, overlay = this.overlay, wrapper = host.wrapper();
    if (!overlay || overlay.isTopmost() || !wrapper) return;
    let entries: readonly OverlayStackEntrySnapshot[] = [];
    observeOverlayStack(host.element.ownerDocument, snapshot => { entries = snapshot.entries; })();
    const index = entries.findIndex(entry => entry.host === host.overlayHost);
    const anchored = (other: HTMLElement): boolean => [...escapeOwners].some(owner => {
      const panel = owner.host.wrapper();
      return owner !== this && (owner.host.overlayHost === other || !!panel && composedContains(panel, other));
    });
    if (index < 0 || entries.slice(index + 1).some(entry => composedContains(wrapper, entry.host) || !anchored(entry.host))) return;
    this.overlay = this.activate();
  }

  /**
   * Registers this nonmodal Escape entry: on top, or, while focus is inside another ranked anchor,
   * just below that anchor's entry, so Escape keeps closing the anchor the user is in (and the
   * overlays nested in it) before one opened meanwhile.
   */
  private activate(below = false): OverlayHandle {
    const host = this.host, document = host.element.ownerDocument;
    const focused = below ? [...escapeOwners].find(owner => {
      const wrapper = owner.host.wrapper();
      return owner !== this && owner.ranked() && !!wrapper && composedContains(wrapper, deepActiveElement(document));
    }) : undefined;
    const order = this.order = focused ? focused.order - 1 / (++insertions + 1) : reserveOverlayOrder(document)(document)!;
    return activateNonmodalOverlay({ host: host.overlayHost, panel: () => host.wrapper() ?? null,
      onEscape: () => { if (host.escape) host.escape(); else this.close('escape'); }, beforeInitialFocus: () => false,
      restoreFocusTo: () => this.returnTarget ?? null, orderReservation: destination => destination === document ? order : undefined });
  }

  /** Retires placement, Escape ownership and boundary observation before the engine is removed. */
  dispose(): void {
    this.cancelFrame();
    this.hide(true, true);
    this.boundaryObserver?.disconnect(); this.boundaryObserver = undefined; this.observedBoundaries = [];
  }

  /** Overflow retains its open request and autofocus history, but owns no placement observers. */
  suspendAdmission(): void {
    this.cancelFrame();
    this.hide();
    if (this.placement || this.placed) return;
    this.boundaryObserver?.disconnect(); this.boundaryObserver = undefined; this.observedBoundaries = [];
  }

  private syncOverlay(wrapper: HTMLElement): void {
    const host = this.host, element = host.element;
    if (!host.closable()) {
      const overlay = this.overlay; this.overlay = undefined; escapeOwners.delete(this);
      overlay?.deactivate({ restoreFocus: false }); return;
    }
    if (!this.overlay) {
      const epoch = this.epoch;
      this.captureReturnTarget(wrapper);
      if (epoch !== this.epoch || !this.placed || !element.isConnected) return;
      const overlay = this.activate(this.ranked());
      if (epoch === this.epoch && this.placed && element.isConnected && host.closable() && !this.overlay) {
        this.overlay = overlay; escapeOwners.add(this);
      } else overlay.deactivate({ restoreFocus: false });
    } else this.overlay.resume();
  }

  private hasContent(): boolean {
    return this.host.content()?.assignedNodes({ flatten: true }).some(node => node.nodeType === 1 || node.nodeType === 3 && !!node.textContent?.trim()) ?? false;
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

  /** Raises the anchor when focus enters it from outside and retains where focus came from as the return target. */
  focusIn(event: FocusEvent): void {
    const wrapper = this.host.wrapper(), previous = event.relatedTarget, view = this.view();
    if (wrapper && view && !(previous instanceof view.Element && composedContains(wrapper, previous))) this.raise();
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
    const host = this.host, position = host.request();
    if (!Array.isArray(position)) return undefined;
    const lng = mapOwnValue(position, '0'), lat = mapOwnValue(position, '1');
    if (typeof lng !== 'number' || !Number.isFinite(lng) || typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90) return undefined;
    return host.element.project([lng, lat]);
  }

  /** Owns placement only after the current deferred positioner callback has measured the anchor. */
  sync(): void {
    const host = this.host, element = host.element;
    this.invalidate();
    if (host.updateActive()) {
      const [generation, connection] = host.generations(), map = host.map();
      host.afterUpdate(() => {
        const [style, current] = host.generations();
        if (element.isConnected && current === connection && style === generation && host.map() === map) this.sync();
      }, `${host.key}-${connection}-${generation}`);
      return;
    }
    const wrapper = host.wrapper(), container = host.container(), fence = host.fence();
    if (!wrapper || !container || !fence || !element.isConnected || !host.map() || !host.styleLoaded() ||
      host.interactionBlocked() || !this.hasContent()) { this.hide(); return; }
    const epoch = this.epoch, map = host.map(), coordinates = host.request();
    const document = element.ownerDocument, [style, connection] = host.generations();
    const boundary = host.boundary(), safeArea = host.safeArea(), direction = host.direction();
    const current = (): boolean => element.isConnected && element.ownerDocument === document &&
      host.map() === map && host.styleLoaded() && host.generations()[0] === style && host.generations()[1] === connection &&
      host.wrapper() === wrapper && host.container() === container && host.fence() === fence &&
      epoch === this.epoch && host.request() === coordinates && host.boundary() === boundary &&
      host.safeArea() === safeArea && host.direction() === direction && !host.interactionBlocked();
    try {
      const admitted = admitMapAnchorOptions({ boundary, safeArea }, element.ownerDocument, { current });
      if (!admitted.ok || !current()) { if (epoch === this.epoch) this.hide(); return; }
      this.observeBoundaries(admitted.boundaries);
      const point = this.point();
      if (!current()) return;
      const width = finiteRange(container.clientWidth, 0, 0), height = finiteRange(container.clientHeight, 0, 0);
      if (!current()) return;
      const edges = admitted.safeArea;
      const start = Math.min(width, edges.inlineStart), end = Math.min(width, edges.inlineEnd);
      const top = Math.min(height, edges.blockStart), bottom = Math.min(height, edges.blockEnd);
      if (!point || !(point[0] >= 0 && point[1] >= 0 && point[0] <= width && point[1] <= height) ||
        start + end >= width || top + bottom >= height) { this.hide(); return; }
      fence.style.insetInlineStart = `${start}px`; fence.style.insetInlineEnd = `${end}px`;
      fence.style.insetBlockStart = `${top}px`; fence.style.insetBlockEnd = `${bottom}px`;
      // A child's own `dir` styles its panel; its logical safe area still follows the map.
      if (host.child) fence.style.direction = direction;
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
      const pointRect = virtualAnchorFromRect({ x: rect.left + point[0], y: rect.top + point[1] }).getBoundingClientRect();
      const publish = (): void => {
        if (!current() || !this.hasContent()) return;
        const first = !this.placed;
        if (first) this.captureReturnTarget(wrapper);
        if (!current()) return;
        this.placed = true; this.placedCoordinates = coordinates;
        this.syncOverlay(wrapper);
        if (first && current()) this.enter(wrapper);
      };
      const previous = this.placement;
      if (previous?.handle?.isActive() && previous.document === document && previous.map === map && previous.wrapper === wrapper &&
        previous.container === container && previous.fence === fence && previous.direction === direction &&
        previous.style === style && previous.connection === connection &&
        previous.boundaries.length === admitted.boundaries.length &&
        previous.boundaries.every((value, index) => value === admitted.boundaries[index]) &&
        previous.safeArea.blockStart === edges.blockStart && previous.safeArea.blockEnd === edges.blockEnd &&
        previous.safeArea.inlineStart === edges.inlineStart && previous.safeArea.inlineEnd === edges.inlineEnd) {
        previous.rect = pointRect; previous.current = current; previous.publish = publish;
        previous.handle?.update();
        return;
      }
      this.placement = undefined;
      previous?.handle?.();
      if (!current()) return;
      const placement: MapAnchorPlacement = { document, map, wrapper, container, fence, direction, style, connection,
        boundaries: admitted.boundaries, safeArea: edges, rect: pointRect, current, publish };
      this.placement = placement;
      const handle = place({ contextElement: container, getBoundingClientRect: () => placement.rect }, wrapper, {
        placement: 'top', strategy: 'absolute', offset: 12, boundary: [fence, ...admitted.boundaries], padding: 8, shiftCrossAxis: true,
        onPlaced: () => { if (this.placement === placement) placement.publish(); },
      });
      if (!current() || this.placement !== placement) {
        if (this.placement === placement) this.placement = undefined;
        handle(); return;
      }
      placement.handle = handle;
      void handle.ready.then(ready => { if (!ready && this.placement === placement && placement.current()) this.hide(); });
    } catch { if (current()) this.hide(); }
  }
}

/** The map capabilities its child anchors add. */
export interface MapAnchorChildrenHost extends MapAnchorMapHost {
  /** True once the engine has loaded a style, and through later same-engine style replacements. */
  engineReady(): boolean;
  /** The focusable map region, a focus-repair fallback. */
  canvas(): HTMLElement | null;
}

interface MapAnchorChildEntry {
  readonly controller: MapAnchorController;
  readonly listener: (event: Event) => void;
  /** Among the first open anchors in document order, so it may be placed. */
  admitted: boolean;
  /** Its open state when last synchronized: a close retires the anchor, a reopen starts a session. */
  open: boolean;
  /** Where focus last was inside it, kept until focus provably leaves (a removal drops it to the body). */
  focused?: Element;
}

const CHILD_EVENTS = ['focusin', 'focusout', 'pointerdown'] as const;

/** Placement of one map's `lr-map-anchor` children, created once one of them opens. */
export class MapAnchorChildren {
  private readonly entries = new Map<MapAnchorChild, MapAnchorChildEntry>();
  private readonly admittedControllers = new Set<MapAnchorController>();
  private serial = 0;

  constructor(private readonly host: MapAnchorChildrenHost, anchors: Iterable<MapAnchorChild>) {
    for (const anchor of anchors) this.attach(anchor);
  }

  /** Applies one child's request; `capture` returns a focus snapshot and `focus` whether it moved focus. */
  run(anchor: MapAnchorChild, operation: MapAnchorOwnerOperation, value?: unknown): unknown {
    const entry = this.entries.get(anchor);
    switch (operation) {
      case 'attach': this.sync(this.attach(anchor)); return undefined;
      case 'detach':
        if (entry) {
          for (const type of CHILD_EVENTS) anchor.removeEventListener(type, entry.listener);
          this.entries.delete(anchor); entry.controller.dispose(); this.sync(entry);
        }
        return undefined;
      case 'capture': return entry?.controller.capture();
      case 'retire':
        if (entry) {
          // The accepted close owns its captured repair, including removal from a close listener.
          entry.open = false; entry.focused = undefined; entry.controller.hide(false, true);
        }
        return undefined;
      case 'repair':
        if (value) {
          const repair = value as ComposedFocusRepairSnapshot;
          applyComposedFocusRepair(repair, [repair.candidate, this.host.canvas()]);
        }
        return undefined;
      case 'focus': return entry?.controller.focus() ?? false;
      default: if (entry) this.sync(entry); return undefined;
    }
  }

  /** Re-places every open child, or just `only` and the children whose admission it changed. */
  sync(only?: MapAnchorChildEntry): void { this.each(only, controller => { controller.sync(); }); }

  schedule(): void { this.each(undefined, controller => { controller.schedule(); }); }

  invalidate(): void { for (const controller of this.admittedControllers) controller.invalidate(); }

  stop(): void { for (const { controller } of this.entries.values()) controller.stop(); }

  /** Hides every open child while the map is interaction-blocked. */
  hide(): void { for (const { controller, open } of this.entries.values()) if (open) controller.hide(); }

  /** Retires every child's placement before the engine is removed; their `open` requests remain. */
  dispose(): void { for (const { controller } of this.entries.values()) controller.dispose(); }

  private each(only: MapAnchorChildEntry | undefined, place: (controller: MapAnchorController) => void): void {
    const changed = this.admit();
    for (const [anchor, entry] of this.entries) {
      if (only && entry !== only && !changed.has(entry)) continue;
      if (anchor.open) {
        entry.open = true;
        if (entry.admitted) place(entry.controller);
        else if (changed.has(entry)) entry.controller.suspendAdmission();
      }
      else if (entry.open) { entry.open = false; entry.controller.hide(true, true); }
    }
  }

  /** Admits the first open children in document order; returns those whose admission changed. */
  private admit(): Set<MapAnchorChildEntry> {
    // Only the first LIMIT candidates matter. Keeping that bounded list ordered avoids sorting
    // every overflow child and still sees document reordering without a persistent order cache.
    const first: MapAnchorChild[] = [];
    let open = 0, overflow: MapAnchorChild | undefined;
    for (const anchor of this.entries.keys()) {
      if (!anchor.open) continue;
      if (++open > LIMIT) overflow ??= anchor;
      if (first.length === LIMIT && anchor.compareDocumentPosition(first[LIMIT - 1]!) & 2) continue;
      let low = 0, high = first.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (anchor.compareDocumentPosition(first[middle]!) & 2) low = middle + 1;
        else high = middle;
      }
      first.splice(low, 0, anchor);
      if (first.length > LIMIT) first.pop();
    }
    if (overflow) devWarnOnce('lyra-map-anchor-limit', `<${this.host.element.localName}>: only the first ${LIMIT} open <${overflow.localName}> children are placed; later ones stay hidden until one closes.`);
    const selected = new Set(first);
    const changed = new Set<MapAnchorChildEntry>();
    this.admittedControllers.clear();
    for (const [anchor, entry] of this.entries) {
      const admitted = selected.has(anchor);
      if (admitted !== entry.admitted) { entry.admitted = admitted; changed.add(entry); }
      if (admitted) this.admittedControllers.add(entry.controller);
    }
    return changed;
  }

  private attach(anchor: MapAnchorChild): MapAnchorChildEntry {
    const existing = this.entries.get(anchor);
    if (existing) return existing;
    const host = this.host, shadow = (selector: string): HTMLElement | undefined => anchor.shadowRoot?.querySelector<HTMLElement>(selector) ?? undefined;
    const controller = new MapAnchorController({
      ...host,
      key: `map-anchor-child-${++this.serial}`,
      overlayHost: anchor,
      child: true,
      wrapper: () => shadow('[part~="base"]'),
      fence: () => shadow('.fence'),
      content: () => anchor.shadowRoot?.querySelector<HTMLSlotElement>('slot:not([name])'),
      styleLoaded: () => host.engineReady(),
      request: () => anchor.open && entry.admitted && !anchor.hidden ? anchor.lngLat : null,
      boundary: () => anchor.boundary === undefined ? host.element.anchorBoundary : anchor.boundary,
      safeArea: () => anchor.safeArea === undefined ? host.element.anchorSafeArea : anchor.safeArea,
      closable: () => anchor.closable,
      pending: () => anchor.isUpdatePending,
      retire: () => undefined,
      emitClose: () => undefined,
      escape: () => { anchor[MAP_ANCHOR_SEAM]('escape'); },
      fallback: () => host.canvas(),
      lost: () => entry.focused,
      placed: placed => { anchor[MAP_ANCHOR_SEAM](placed ? 'placed' : 'unplaced'); },
      autofocus: () => anchor[MAP_ANCHOR_SEAM]('autofocus'),
    });
    const entry: MapAnchorChildEntry = {
      controller, admitted: false, open: false,
      listener: event => {
        if (event.type === 'pointerdown') { controller.raise(); return; }
        const focus = event as FocusEvent, next = focus.relatedTarget as Element | null;
        if (event.type === 'focusout') queueMicrotask(() => { controller.focusOut(); });
        if (event.type === 'focusin') { entry.focused = focus.composedPath()[0] as Element; controller.focusIn(focus); }
        else if (next) { if (!composedContains(anchor, next)) entry.focused = undefined; }
        // Without a related target, focus either left for the body or went with a removed node.
        // Keep a disconnected target until hiding can repair focus after content removal.
        else queueMicrotask(() => {
          if (anchor.isConnected && entry.focused?.isConnected && !composedContains(anchor, deepActiveElement(anchor.ownerDocument))) entry.focused = undefined;
        });
      },
    };
    for (const type of CHILD_EVENTS) anchor.addEventListener(type, entry.listener);
    this.entries.set(anchor, entry);
    return entry;
  }
}
