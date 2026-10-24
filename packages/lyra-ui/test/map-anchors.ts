import { fixture, html, waitUntil } from '@open-wc/testing';
import { ControlMapEngine, FakeAttributionControl, FakeGeolocateControl } from './map-control-engine.js';
import '../src/components/media/map/map.js';
import '../src/components/media/map/map-anchor.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from '../src/components/media/map/map.js';
import type { LyraMapAnchor } from '../src/components/media/map/map-anchor.js';
import type { LyraMapAnchorCloseDetail } from '../src/components/media/map/map-anchor-options.js';

// Child-anchor suites drive lr-map through a scripted engine whose projection is per coordinate:
// ten CSS pixels per degree around the container centre, so several anchors place independently.

/** The scripted engine with a per-coordinate projection. `projected` still pins every point. */
export class AnchorMapEngine extends ControlMapEngine {
  override project(coordinate: [number, number]) {
    this.beforeProject?.();
    const container = this.options['container'] as HTMLElement;
    return this.projected ?? {
      x: container.clientWidth / 2 + (coordinate[0] - this.center.lng) * 10,
      y: container.clientHeight / 2 - (coordinate[1] - this.center.lat) * 10,
    };
  }
  /** Moves the camera as a gesture would, firing the native move and moveend events. */
  pan(lng: number, lat = this.center.lat): void {
    this.center = { lng, lat }; this.fire('move'); this.fire('moveend');
  }
  /** A settled camera animation: movestart, one move and moveend carrying the command's event data. */
  easeTo(options: { center?: [number, number]; zoom?: number }, data: Record<string, unknown> = {}): void {
    this.idle = false; this.fire('movestart', data);
    if (options.center) this.setCenter(options.center);
    if (options.zoom !== undefined) this.setZoom(options.zoom);
    this.fire('move', data); this.fire('moveend', data);
  }
}

const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const originalContext = HTMLCanvasElement.prototype.getContext;

/** Constructs maps on connection and fakes WebGL2, as the slot-anchor suites do. */
export function stubMapEnvironment(): void {
  AnchorMapEngine.initialReady = true; AnchorMapEngine.prepare = undefined;
  Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
    value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
}

export function restoreMapEnvironment(): void {
  if (originalObserver) Object.defineProperty(window, 'IntersectionObserver', originalObserver);
  else Reflect.deleteProperty(window, 'IntersectionObserver');
  HTMLCanvasElement.prototype.getContext = originalContext;
}

export interface MountedMap { readonly map: LyraMap; readonly engine: AnchorMapEngine; readonly wrapper: HTMLDivElement }

/** A 480 x 320 map whose style has loaded; `configure` runs before connection. */
export async function mountMap(configure: (map: LyraMap) => void = () => undefined, engine: typeof AnchorMapEngine = AnchorMapEngine): Promise<MountedMap> {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const map = document.createElement('lr-map') as LyraMap;
  map.engine = 'maplibre'; map.mapStyle = LYRA_MAP_EMPTY_STYLE; map.controls = { attribution: false };
  map.style.inlineSize = '480px'; map.style.blockSize = '320px';
  (map as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: engine, GeolocateControl: FakeGeolocateControl, AttributionControl: FakeAttributionControl });
  configure(map); wrapper.append(map);
  await waitUntil(() => map.map !== undefined, 'map engine constructed');
  await map.updateComplete;
  const peer = map.map as unknown as AnchorMapEngine;
  peer.fire('load'); await map.updateComplete; await map.whenStyleReady();
  return { map, engine: peer, wrapper };
}

/** Content with one action button; the button carries `label` as its text. */
export function content(label = 'Anchor action'): HTMLElement {
  const section = document.createElement('section'), button = document.createElement('button');
  button.type = 'button'; button.textContent = label; section.append(button);
  return section;
}

export interface AnchorOptions {
  readonly lngLat?: readonly [number, number] | null;
  readonly closable?: boolean;
  readonly label?: string;
  readonly open?: boolean;
  readonly content?: Node;
}

/** Creates an anchor holding `options.content` (a fresh action by default) and appends it to `parent`. */
export function addAnchor(parent: Element, options: AnchorOptions = {}): LyraMapAnchor {
  const anchor = document.createElement('lr-map-anchor');
  anchor.lngLat = options.lngLat === undefined ? [0, 0] : options.lngLat;
  anchor.closable = options.closable ?? false;
  if (options.label !== undefined) anchor.label = options.label;
  anchor.append(options.content ?? content());
  parent.append(anchor);
  anchor.open = options.open ?? true;
  return anchor;
}

export function base(anchor: LyraMapAnchor): HTMLElement {
  const panel = anchor.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
  if (!panel) throw new Error('Expected the anchor panel');
  return panel;
}

export function closeButton(anchor: LyraMapAnchor): HTMLButtonElement {
  const button = anchor.shadowRoot?.querySelector<HTMLButtonElement>('[part~="close-button"]');
  if (!button) throw new Error('Expected the close button');
  return button;
}

export function isPlaced(anchor: LyraMapAnchor): boolean {
  const panel = anchor.shadowRoot?.querySelector<HTMLElement>('[part~="base"]');
  return !!panel && !panel.hidden && panel.style.left !== '' && getComputedStyle(panel).visibility !== 'hidden' &&
    anchor.matches(':state(placed)');
}

/** Waits for real placement: shown, positioned by the deferred positioner and publishing `:state(placed)`. */
export async function placed(...anchors: LyraMapAnchor[]): Promise<void> {
  for (const anchor of anchors) await anchor.updateComplete;
  await waitUntil(() => anchors.every(isPlaced), 'anchor was not placed', { timeout: 4000 });
}

export async function hidden(...anchors: LyraMapAnchor[]): Promise<void> {
  await waitUntil(() => anchors.every(anchor => base(anchor).hidden), 'anchor did not hide', { timeout: 4000 });
}

export interface CloseLog { readonly requests: unknown[]; readonly closes: unknown[]; readonly order: string[] }

export function captureCloses(anchor: LyraMapAnchor): CloseLog {
  const log: CloseLog = { requests: [], closes: [], order: [] };
  anchor.addEventListener('lr-close-request', event => { log.requests.push(event.detail); log.order.push(`request:${(event.detail as LyraMapAnchorCloseDetail).reason}`); });
  anchor.addEventListener('lr-close', event => { log.closes.push(event.detail); log.order.push(`close:${(event.detail as LyraMapAnchorCloseDetail).reason}`); });
  return log;
}

/** The anchor's painted z-index. */
export function zIndex(anchor: LyraMapAnchor): number {
  return Number.parseInt(getComputedStyle(base(anchor)).zIndex, 10);
}

/** The deep focused element, compared by identity without handing a node to a failing assertion. */
export function deepActive(): Element | null {
  let active: Element | null = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}
