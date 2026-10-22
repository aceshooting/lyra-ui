import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { loadMapHashRuntime } from './map-feature-loader.js';

class Control {
  readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  removed = false;
  constructor(readonly options?: Record<string, unknown>) {}
  on(type: string, callback: (event: unknown) => void) { let set = this.listeners.get(type); if (!set) this.listeners.set(type, set = new Set()); set.add(callback); }
  off(type: string, callback: (event: unknown) => void) { this.listeners.get(type)?.delete(callback); }
  fire(type: string, event: unknown = {}) { for (const callback of [...this.listeners.get(type) ?? []]) callback(event); }
}
class Geolocate extends Control {}
class Attribution extends Control {}
class ControlMap {
  static initialReady = false;
  static beforeGetCenter: (() => void) | undefined;
  static prepare: (() => Promise<void>) | undefined;
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly canvas = document.createElement('canvas');
  readonly sources = new Map<string, { setData: (data: unknown) => void; updateData: (data: unknown) => void }>();
  readonly layers = new Map<string, unknown>();
  ready = ControlMap.initialReady;
  idle = false;
  synchronousStyle = true;
  removed = false;
  center = { lng: 0, lat: 0 };
  zoom = 2;
  bearing = 0; pitch = 0; fits = 0;
  bounds: [[number, number], [number, number]] | null = null;
  readonly controls = new Set<Control>();
  constructor(readonly options: Record<string, unknown>) {
    const center = options['center'] as [number, number]; this.center = { lng: center[0], lat: center[1] };
    this.zoom = options['zoom'] as number; this.bearing = options['bearing'] as number ?? 0; this.pitch = options['pitch'] as number ?? 0;
  }
  getBearing() { return this.bearing; }
  getPitch() { return this.pitch; }
  addControl(control: Control) { this.controls.add(control); }
  removeControl(control: Control) { this.controls.delete(control); control.removed = true; }
  fitBounds() { this.fits++; }
  setMaxBounds(bounds: [[number, number], [number, number]] | null) {
    this.bounds = bounds;
    if (bounds) this.center = { lng: Math.min(bounds[1][0], Math.max(bounds[0][0], this.center.lng)), lat: Math.min(bounds[1][1], Math.max(bounds[0][1], this.center.lat)) };
  }
  on(type: string, listener: (event: Record<string, unknown>) => void): this {
    const listeners = this.listeners.get(type) ?? new Set();
    this.listeners.set(type, listeners); listeners.add(listener); return this;
  }
  off(type: string, listener: (event: Record<string, unknown>) => void): this {
    this.listeners.get(type)?.delete(listener); return this;
  }
  once(type: string, listener: (event: Record<string, unknown>) => void): this {
    const run = (event: Record<string, unknown>) => { this.off(type, run); listener(event); };
    return this.on(type, run);
  }
  fire(type: string, event: Record<string, unknown> = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener({ type, ...event });
  }
  isStyleLoaded(): boolean { return this.ready; }
  loaded(): boolean { return this.idle; }
  isMoving(): boolean { return false; }
  getCanvas(): HTMLCanvasElement { return this.canvas; }
  getCenter() { ControlMap.beforeGetCenter?.(); return this.center; }
  getZoom(): number { return this.zoom; }
  setCenter(value: [number, number]): void { this.center = { lng: value[0], lat: value[1] }; this.idle = false; }
  setZoom(value: number): void { this.zoom = value; this.idle = false; }
  jumpTo(options: { center?: [number, number]; zoom?: number; bearing?: number; pitch?: number }, data: Record<string, unknown> = {}): void {
    this.idle = false; this.fire('movestart');
    if (options.center) this.setCenter(options.center);
    if (options.zoom !== undefined) this.setZoom(options.zoom);
    if (options.bearing !== undefined) this.bearing = options.bearing;
    if (options.pitch !== undefined) this.pitch = options.pitch;
    this.setMaxBounds(this.bounds);
    this.fire('moveend', data);
  }
  resize(): void {}
  remove(): void { this.removed = true; this.listeners.clear(); }
  setStyle(): this {
    this.sources.clear(); this.layers.clear(); this.idle = false;
    this.ready = this.synchronousStyle;
    if (this.ready) this.fire('style.load');
    return this;
  }
  prepareFeatures(): Promise<void> { return ControlMap.prepare?.() ?? Promise.resolve(); }
  getSource(id: string) { return this.sources.get(id); }
  addSource(id: string): this { this.idle = false; this.sources.set(id, { setData: () => { this.idle = false; }, updateData: () => { this.idle = false; } }); return this; }
  removeSource(id: string): this { this.sources.delete(id); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string }): this { this.layers.set(layer.id, layer); return this; }
  removeLayer(id: string): this { this.layers.delete(id); return this; }
  setPaintProperty(): this { return this; }
  queryRenderedFeatures(): unknown[] { return []; }
}

const originalObserver = window.IntersectionObserver;
const originalContext = HTMLCanvasElement.prototype.getContext;
let originalUrl: string;
let originalState: unknown;
async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined); await element.updateComplete;
  const peer = element.map as unknown as ControlMap;
  return { element, peer, wrapper };
}
describe('lr-map controls and named URL ownership', () => {
  // Exercises the steady state after the on-demand runtime has loaded; map-lazy-runtimes.test.ts covers the loading itself.
  before(() => loadMapHashRuntime());
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state;
    ControlMap.initialReady = true;
    ControlMap.beforeGetCenter = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    ControlMap.beforeGetCenter = undefined;
    fixtureCleanup(); history.replaceState(originalState, '', originalUrl);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });
  it('keeps hash unset and default attribution singular without triggering location', async () => {
    history.replaceState({}, '', '#section&map=9/40/20');
    const { element, peer } = await mount(); await waitUntil(() => peer.controls.size === 1);
    expect(peer.options['attributionControl']).to.equal(false); expect([...peer.controls][0] instanceof Attribution).to.equal(true);
    expect(peer.zoom).to.equal(element.zoom); expect(peer.zoom).not.to.equal(9); expect(location.hash).to.equal('#section&map=9/40/20');
    expect([...peer.controls].some(control => control instanceof Geolocate)).to.equal(false);
  });
  it('seeds an initially enabled missing URL field after map construction', async () => {
    history.replaceState({}, '', '#section'); const { peer } = await mount(el => { el.hash = true; });
    expect(location.hash).to.equal(`#section&map=${peer.zoom}/${peer.center.lat}/${peer.center.lng}`);
  });
  it('gives a valid initial hash precedence over a queued fit and retains bearing/pitch', async () => {
    history.replaceState({}, '', '#section&map=9/40/20/45/30');
    const { element, peer } = await mount(el => { el.hash = true; el.fitBounds([[1, 2], [3, 4]]); });
    await element.updateComplete; expect(peer.fits).to.equal(0); expect(peer.center).to.deep.equal({ lng: 20, lat: 40 });
    expect(peer.zoom).to.equal(9); expect(peer.bearing).to.equal(45); expect(peer.pitch).to.equal(30); expect(element.center).to.deep.equal([20, 40]);
  });
  it('preserves a newer authored camera when an initial native hash read reenters', async () => {
    history.replaceState({}, '', '#map=9/40/20');
    let reads = 0;
    const { element, peer } = await mount(el => {
      el.hash = true;
      ControlMap.beforeGetCenter = () => {
        ControlMap.beforeGetCenter = undefined;
        reads++;
        el.center = [7, 8]; el.zoom = 11;
      };
    });
    await element.updateComplete;
    expect(reads).to.equal(1);
    expect(element.center).to.deep.equal([7, 8]); expect(element.zoom).to.equal(11);
    await waitUntil(() => peer.center.lng === 7 && peer.center.lat === 8 && peer.zoom === 11);
  });
  it('keeps initial hash under maxBounds and malformed hashes preserve queued fit', async () => {
    history.replaceState({}, '', '#map=9/40/20');
    const first = await mount(el => { el.hash = true; el.maxBounds = [[-5, -5], [5, 5]]; });
    expect(first.peer.center).to.deep.equal({ lng: 5, lat: 5 }); first.element.remove();
    history.replaceState({}, '', '#map=bad');
    const next = await mount(el => { el.hash = true; el.fitBounds([[1, 2], [3, 4]]); });
    await waitUntil(() => next.peer.fits === 1); expect(location.hash).to.equal('#map=bad');
  });
  it('owns one connected window/key and exposes localized conflict without takeover', async () => {
    const first = await mount(el => { el.hash = true; });
    const second = await mount(el => { el.hash = true; el.strings = { mapHashConflict: 'URL field occupied' }; });
    expect(second.element.shadowRoot!.textContent).to.include('URL field occupied'); first.element.remove();
    history.replaceState({}, '', '#map=8/1/2'); window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(second.peer.zoom).not.to.equal(8); second.element.hash = false; await second.element.updateComplete;
    second.element.hash = true; await second.element.updateComplete; expect(second.peer.zoom).to.equal(8);
  });
  it('reads history navigation and writes only its current named fragment', async () => {
    const { element, peer } = await mount(el => { el.hash = 'camera'; });
    history.replaceState({ preserved: true }, '', '#section&camera=8/2/1'); window.dispatchEvent(new PopStateEvent('popstate'));
    expect(peer.center).to.deep.equal({ lng: 1, lat: 2 }); expect(peer.zoom).to.equal(8);
    history.replaceState({ preserved: true }, '', '#new-section&camera=8/2/1'); peer.zoom = 7; peer.fire('moveend', { originalEvent: {} });
    expect(location.hash).to.equal('#new-section&camera=7/2/1'); expect(history.state).to.deep.equal({ preserved: true });
    element.hash = false; await element.updateComplete; peer.zoom = 6; peer.fire('moveend'); expect(location.hash).to.equal('#new-section&camera=7/2/1');
  });
  it('seeds a newly enabled or renamed field while leaving the former field intact', async () => {
    history.replaceState({}, '', '#section'); const { element, peer } = await mount();
    element.hash = true; await element.updateComplete;
    expect(location.hash).to.equal(`#section&map=${peer.zoom}/${peer.center.lat}/${peer.center.lng}`);
    const prior = location.hash; element.hash = 'second'; await element.updateComplete;
    expect(location.hash).to.equal(`${prior}&second=${peer.zoom}/${peer.center.lat}/${peer.center.lng}`);
  });
  it('does not apply or publish a hash camera after native getters disconnect its owner', async () => {
    const first = await mount(el => { el.hash = true; }); let writes = 0;
    first.peer.getBearing = () => { first.element.remove(); return 0; };
    first.peer.jumpTo = () => { writes++; };
    history.replaceState({}, '', '#map=9/2/1'); window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(writes).to.equal(0);
    const second = await mount(el => { el.hash = true; });
    history.replaceState({}, '', '#section&map=8/2/1'); second.peer.zoom = 4;
    second.peer.getPitch = () => { second.element.remove(); return 0; };
    second.peer.fire('moveend'); expect(location.hash).to.equal('#section&map=8/2/1');
  });
  it('changes live attribution without duplicates and sanitizes custom text', async () => {
    const { element, peer } = await mount(); await waitUntil(() => peer.controls.size === 1);
    element.controls = { attribution: false }; await element.updateComplete; await waitUntil(() => peer.controls.size === 0);
    element.controls = { attribution: { customAttribution: '<b>Provider</b>' } }; await element.updateComplete;
    await waitUntil(() => peer.controls.size === 1); expect([...peer.controls][0]!.options?.['customAttribution']).to.equal('&lt;b&gt;Provider&lt;/b&gt;');
    element.controls = undefined; await element.updateComplete; await waitUntil(() => peer.controls.size === 1);
    expect([...peer.controls][0]!.options?.['customAttribution']).to.equal(undefined);
  });
  it('emits sanitized location failures, localizes feedback and retires callbacks on reconfigure', async () => {
    const { element, peer } = await mount(el => { el.controls = { geolocate: true, attribution: false }; el.strings = { mapGeolocatePermissionDenied: 'Location denied' }; });
    await waitUntil(() => peer.controls.size === 1); const control = [...peer.controls][0]!;
    const errors: unknown[] = [], bounds: unknown[] = [];
    element.addEventListener('lr-map-geolocate-error', event => errors.push((event as CustomEvent).detail));
    element.addEventListener('lr-map-geolocate-out-of-bounds', event => bounds.push((event as CustomEvent).detail));
    control.fire('error', { code: 1, message: 'private native detail', coords: { latitude: 42 } }); await element.updateComplete;
    expect(errors).to.deep.equal([{ code: 'permission-denied' }]); expect(element.shadowRoot!.textContent).to.include('Location denied');
    expect(element.shadowRoot!.textContent).not.to.include('private native detail');
    control.fire('outofmaxbounds', { coords: { latitude: 42 } }); expect(bounds).to.deep.equal([{ code: 'out-of-bounds' }]);
    control.fire('geolocate', { coords: { latitude: 42 } }); await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part=configuration-error]') === null).to.equal(true);
    expect(errors.length).to.equal(1);
    element.controls = { attribution: false }; await element.updateComplete; control.fire('error', { code: 2 }); expect(errors.length).to.equal(1); expect(control.removed).to.equal(true);
  });
  it('updates geolocation and scale chrome labels through live string overrides', async () => {
    const { element } = await mount();
    const container = element.shadowRoot!.querySelector('[part="container"]')!;
    const button = document.createElement('button'); button.className = 'maplibregl-ctrl-geolocate';
    const scale = document.createElement('div'); scale.className = 'maplibregl-ctrl-scale'; scale.textContent = '10 km';
    container.append(button, scale); element.strings = { mapGeolocateFindLocation: 'Locate here', mapGeolocateUnavailable: 'Unavailable here', mapScaleKilometers: 'kilometres' };
    await element.updateComplete; expect(button.getAttribute('aria-label')).to.equal('Locate here'); expect(scale.textContent).to.equal('10 kilometres');
    button.disabled = true; await waitUntil(() => button.getAttribute('aria-label') === 'Unavailable here');
  });
});
