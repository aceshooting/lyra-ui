import { fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraMap } from '../src/components/media/map/map.class.js';
import { LYRA_MAP_EMPTY_STYLE } from '../src/components/media/map/map-empty-style.js';

/** Scripted engine camera: synchronous jumps, explicit animation completion through `finish()`. */
export type PeerEvent = Record<string, unknown>;
export interface CameraOptions { center?: readonly number[]; zoom?: number; bearing?: number; pitch?: number; duration?: number; }
export class CameraPeer {
  readonly canvas = document.createElement('canvas');
  readonly listeners = new Map<string, Set<(event: PeerEvent) => void>>();
  readonly calls: string[] = [];
  center = [0, 0]; zoom = 2; bearing = 0; pitch = 0;
  ready = false; moving = false; removed = false; failAfterMove = false;
  pending?: PeerEvent;
  style: Record<string, unknown>;
  constructor(options: { container: HTMLElement; style: Record<string, unknown>; center: number[]; zoom: number }) {
    options.container.append(this.canvas); this.style = options.style;
    this.center = [...options.center]; this.zoom = options.zoom;
  }
  on(type: string, listener: (event: PeerEvent) => void): this { const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); return this; }
  off(type: string, listener: (event: PeerEvent) => void): this { this.listeners.get(type)?.delete(listener); return this; }
  once(type: string, listener: (event: PeerEvent) => void): this { const wrapped = (event: PeerEvent) => { this.off(type, wrapped); listener(event); }; return this.on(type, wrapped); }
  fire(type: string, event: PeerEvent = {}): void { for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event); }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getContainer(): HTMLElement { return this.canvas.parentElement!; }
  getCenter() { return { lng: this.center[0]!, lat: this.center[1]! }; }
  getZoom(): number { return this.zoom; }
  getBearing(): number { return this.bearing; }
  getPitch(): number { return this.pitch; }
  getStyle(): Record<string, unknown> { return this.style; }
  getProjection(): unknown { return this.style['projection']; }
  getTerrain(): unknown { return this.style['terrain'] ?? null; }
  getSource(): undefined { return undefined; }
  getLayer(): undefined { return undefined; }
  queryRenderedFeatures(): unknown[] { return []; }
  loaded(): boolean { return this.ready; }
  isStyleLoaded(): boolean { return this.ready; }
  isMoving(): boolean { return this.moving; }
  prepareFeatures(): Promise<void> { return Promise.resolve(); }
  setCenter(center: readonly number[]): this { this.calls.push('setCenter'); this.center = [...center]; return this; }
  setZoom(zoom: number): this { this.calls.push('setZoom'); this.zoom = zoom; return this; }
  setMinZoom(): this { return this; }
  setMaxZoom(): this { return this; }
  setMaxBounds(): this { return this; }
  setPadding(): this { return this; }
  setProjection(value: unknown): this { this.calls.push('setProjection'); this.style = { ...this.style, projection: value }; return this; }
  setTerrain(value: unknown): this { this.calls.push('setTerrain'); this.style = { ...this.style, terrain: value }; return this; }
  setStyle(style: Record<string, unknown>): this { this.calls.push('setStyle'); this.style = style; this.fire('style.load'); return this; }
  resize(): void { this.calls.push('resize'); }
  remove(): void { this.removed = true; this.listeners.clear(); }
  jumpTo(options: CameraOptions, event: PeerEvent = {}): this { return this.move('jumpTo', options, event, true); }
  easeTo(options: CameraOptions, event: PeerEvent = {}): this { return this.move('easeTo', options, event, false); }
  flyTo(options: CameraOptions, event: PeerEvent = {}): this { return this.move('flyTo', options, event, false); }
  fitBounds(_bounds: unknown, _options: unknown, event: PeerEvent = {}): this { return this.move('fitBounds', { center: [3, 4], zoom: 5 }, event, true); }
  stop(): this { this.calls.push('stop'); this.finish(); return this; }
  finish(): void { if (!this.pending) return; const event = this.pending; this.pending = undefined; this.moving = false; this.fire('moveend', event); }
  private move(name: string, options: CameraOptions, event: PeerEvent, immediate: boolean): this {
    this.calls.push(name); this.moving = true; this.fire('movestart', event);
    if (options.center) this.center = [...options.center];
    if (options.zoom !== undefined) this.zoom = options.zoom;
    if (options.bearing !== undefined) this.bearing = options.bearing;
    if (options.pitch !== undefined) this.pitch = options.pitch;
    this.pending = event; this.fire('move', event); if (immediate) this.finish();
    if (this.failAfterMove) throw new Error('Camera failed after its event'); return this;
  }
}
const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
/** Installs the WebGL2 and observer stubs a scripted peer needs; returns their restoration. */
export function installCameraPeerEnvironment(): () => void {
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
    value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  return () => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  };
}
/** Mounts a style-ready `lr-map` over a `CameraPeer`; `motion` sets the wrapper's `data-lr-motion`. */
export async function mountCameraPeerMap(motion: 'system' | 'reduce' = 'system') {
  const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-motion=${motion}></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: CameraPeer });
  wrapper.append(element); await waitUntil(() => element.map !== undefined);
  const peer = element.map as unknown as CameraPeer; peer.ready = true; peer.fire('load');
  await element.whenStyleReady(); await element.updateComplete;
  return { wrapper, element, peer };
}
/** Reconnects a mounted map and readies its replacement peer. */
export async function reconnectCameraPeerMap(wrapper: HTMLElement, element: LyraMap): Promise<CameraPeer> {
  wrapper.append(element); await waitUntil(() => element.map !== undefined);
  const peer = element.map as unknown as CameraPeer; peer.ready = true; peer.fire('load');
  await element.whenStyleReady(); await element.updateComplete;
  return peer;
}
