import type { LyraMapAnchorSafeArea } from './map-anchor-options.js';

/** What the avoidance needs from its map: the allocation, the reading direction and a change hook. */
export interface MapAnchorAvoidHost {
  readonly element: HTMLElement;
  direction(): 'ltr' | 'rtl';
  changed(): void;
  /** Extra CSS pixels added to every edge an obstacle reserves; edges it leaves free stay zero. */
  gap?(): number;
}

type Edges = { top: number; right: number; bottom: number; left: number };

/**
 * Physical reservation that keeps an obstacle's overlap with the map clear: the cheapest edge the
 * overlap can be pushed back to, so a header reserves the top and a side panel its own side.
 */
export function obstacleEdges(map: DOMRectReadOnly, obstacle: DOMRectReadOnly): Edges | undefined {
  const top = Math.max(map.top, obstacle.top), bottom = Math.min(map.bottom, obstacle.bottom);
  const left = Math.max(map.left, obstacle.left), right = Math.min(map.right, obstacle.right);
  if (!(bottom > top && right > left)) return undefined;
  const options: [keyof Edges, number][] = [['top', bottom - map.top], ['bottom', map.bottom - top], ['left', right - map.left], ['right', map.right - left]];
  let best = options[0]!;
  for (const option of options) if (option[1] < best[1]) best = option;
  return { top: 0, right: 0, bottom: 0, left: 0, [best[0]]: best[1] };
}

/** Merges an authored safe area with an avoidance area edge by edge, taking the larger inset. An
 * authored value that is not a plain set of finite nonnegative data edges is returned unchanged,
 * so placement still fails closed on it. */
export function mergeSafeAreas(authored: LyraMapAnchorSafeArea | undefined, avoid: LyraMapAnchorSafeArea | undefined): LyraMapAnchorSafeArea | undefined {
  if (!avoid || authored === undefined) return authored ?? avoid;
  if (authored === null || typeof authored !== 'object') return authored;
  const merged: Record<string, number> = {};
  for (const key of ['blockStart', 'inlineEnd', 'blockEnd', 'inlineStart'] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(authored, key);
    const value = (descriptor?.value as unknown) ?? 0;
    if (descriptor && !Object.hasOwn(descriptor, 'value') || typeof value !== 'number' || !Number.isFinite(value) || value < 0) return authored;
    merged[key] = Math.max(value, avoid[key] ?? 0);
  }
  return Object.freeze(merged);
}

/**
 * Observes application chrome that overlaps a map and publishes the overlap as a logical safe
 * area. Size changes, scrolling and visual-viewport changes are coalesced into one measurement per
 * animation frame.
 */
export class MapAnchorAvoidance {
  private elements: readonly Element[] = [];
  private observer?: ResizeObserver;
  private frame?: { view: Window; handle: number };
  private view?: Window;
  private current?: LyraMapAnchorSafeArea;
  private readonly schedule = (): void => {
    const view = this.view;
    if (!view || this.frame) return;
    const frame = { view, handle: 0 };
    this.frame = frame;
    frame.handle = view.requestAnimationFrame(() => { if (this.frame === frame) { this.frame = undefined; this.measure(); } });
  };

  constructor(private readonly host: MapAnchorAvoidHost) {}

  /** The avoided overlap as logical edges, or `undefined` when nothing overlaps. */
  get area(): LyraMapAnchorSafeArea | undefined { return this.current; }

  /** Observes these obstacles instead of the previous ones; an empty list stops observing. */
  observe(elements: readonly Element[] | undefined): void {
    this.disconnect();
    const list = Array.isArray(elements) ? elements.filter((element): element is Element => element instanceof Element) : [];
    const view = this.host.element.ownerDocument.defaultView;
    if (!list.length || !view) { this.publish(undefined); return; }
    this.elements = list; this.view = view;
    this.observer = new view.ResizeObserver(this.schedule);
    for (const element of [this.host.element, ...list]) this.observer.observe(element);
    view.addEventListener('scroll', this.schedule, { capture: true, passive: true });
    view.addEventListener('resize', this.schedule, { passive: true });
    view.visualViewport?.addEventListener('resize', this.schedule, { passive: true });
    view.visualViewport?.addEventListener('scroll', this.schedule, { passive: true });
    this.measure();
  }

  /** Re-measures on the next frame, for a direction change the observers cannot see. */
  refresh(): void { this.schedule(); }

  /** Stops every observer and listener; the last area is kept until the next `observe()`. */
  disconnect(): void {
    const view = this.view;
    this.observer?.disconnect(); this.observer = undefined;
    if (this.frame) { this.frame.view.cancelAnimationFrame(this.frame.handle); this.frame = undefined; }
    if (view) {
      view.removeEventListener('scroll', this.schedule, { capture: true });
      view.removeEventListener('resize', this.schedule);
      view.visualViewport?.removeEventListener('resize', this.schedule);
      view.visualViewport?.removeEventListener('scroll', this.schedule);
    }
    this.view = undefined; this.elements = [];
  }

  private measure(): void {
    const map = this.host.element.getBoundingClientRect();
    const edges: Edges = { top: 0, right: 0, bottom: 0, left: 0 };
    for (const element of this.elements) {
      if (!element.isConnected) continue;
      const overlap = obstacleEdges(map, element.getBoundingClientRect());
      if (!overlap) continue;
      for (const key of ['top', 'right', 'bottom', 'left'] as const) edges[key] = Math.max(edges[key], overlap[key]);
    }
    const rawGap = this.host.gap?.() ?? 0;
    const gap = Number.isFinite(rawGap) && rawGap > 0 ? rawGap : 0;
    if (gap) for (const key of ['top', 'right', 'bottom', 'left'] as const) if (edges[key] > 0) edges[key] += gap;
    const rtl = this.host.direction() === 'rtl';
    const area = edges.top || edges.right || edges.bottom || edges.left
      ? Object.freeze({ blockStart: edges.top, blockEnd: edges.bottom, inlineStart: rtl ? edges.right : edges.left, inlineEnd: rtl ? edges.left : edges.right })
      : undefined;
    this.publish(area);
  }

  private publish(area: LyraMapAnchorSafeArea | undefined): void {
    const previous = this.current;
    if (previous === area || previous && area && (['blockStart', 'blockEnd', 'inlineStart', 'inlineEnd'] as const).every(key => previous[key] === area[key])) return;
    this.current = area;
    this.host.changed();
  }
}
