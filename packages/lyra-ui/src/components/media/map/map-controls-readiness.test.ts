import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { loadMapControlRuntime } from './map-feature-loader.js';
import { MapControlsLifecycle } from './map-controls-lifecycle.js';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';

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
describe('lr-map controls readiness', () => {
  before(() => loadMapControlRuntime());
  beforeEach(() => {
    originalUrl = location.href; originalState = history.state;
    ControlMap.initialReady = true;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup(); history.replaceState(originalState, '', originalUrl);
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('waits before interaction construction, installs default attribution, and does not activate location', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const element = document.createElement('lr-map') as LyraMap;
    element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.initialization = 'interaction';
    let triggered = 0;
    class PassiveGeolocate extends Geolocate { trigger() { triggered++; } }
    (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({
      Map: ControlMap, GeolocateControl: PassiveGeolocate, AttributionControl: Attribution,
    });
    element.controls = { geolocate: true };
    wrapper.append(element); await element.updateComplete;
    let ready = false;
    const pending = element.whenControlsReady().then(() => { ready = true; });
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(ready).to.equal(false); expect(element.map === undefined).to.equal(true);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="initialization-activate"]') !== null);
    element.shadowRoot!.querySelector<HTMLButtonElement>('[part="initialization-activate"]')!.click();
    await pending;
    expect((element.map as unknown as ControlMap).controls.size).to.equal(2);
    expect(triggered).to.equal(0);
  });

  it('preserves installed controls readiness across a style-only replacement', async () => {
    const { element, peer } = await mount();
    await element.whenControlsReady();
    const installed = [...peer.controls];
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenControlsReady(); await element.updateComplete;
    expect(peer.controls.size).to.equal(1);
    expect([...peer.controls][0] === installed[0]).to.equal(true);
  });

  it('rejects a superseded wait immediately and ignores its late import completion', async () => {
    const { element, peer } = await mount(el => { el.controls = { attribution: false }; });
    await element.whenControlsReady();
    const releases: ((constructor: typeof Control) => void)[] = [];
    (element as unknown as { controlLifecycle: MapControlsLifecycle }).controlLifecycle =
      new MapControlsLifecycle(() => new Promise(resolve => { releases.push(resolve); }));
    element.controls = { navigation: true, attribution: false };
    const first = element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name);
    await waitUntil(() => releases.length === 1);
    element.controls = { scale: true, attribution: false };
    expect(await first).to.equal('AbortError');
    let ready = false;
    const second = element.whenControlsReady().then(() => { ready = true; });
    await waitUntil(() => releases.length === 2);
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(ready).to.equal(false); expect(peer.controls.size).to.equal(0);
    releases[1]!(Control); await second; expect(peer.controls.size).to.equal(1);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    releases[0]!(Control); await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(peer.controls.size).to.equal(1);
    element.controls = { attribution: false };
    await element.whenControlsReady(); expect(peer.controls.size).to.equal(0);
  });

  it('rejects pending controls on disconnect and starts a fresh map on reconnect', async () => {
    const { element, peer, wrapper } = await mount(el => { el.controls = { attribution: false }; });
    await element.whenControlsReady();
    let release!: (constructor: typeof Control) => void;
    (element as unknown as { controlLifecycle: MapControlsLifecycle }).controlLifecycle =
      new MapControlsLifecycle(() => new Promise(resolve => { release = resolve; }));
    element.controls = { navigation: true, attribution: false };
    const pending = element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name);
    await waitUntil(() => release !== undefined);
    element.remove(); expect(await pending).to.equal('AbortError');
    expect(await element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name)).to.equal('AbortError');
    element.controls = { attribution: false }; wrapper.append(element);
    await element.whenControlsReady();
    release(Control); await new Promise<void>(resolve => setTimeout(resolve, 0));
    expect(peer.removed).to.equal(true); expect(peer.controls.size).to.equal(0);
    expect(element.map !== undefined && (element.map as unknown) !== peer).to.equal(true);
  });

  it('rejects partial installation and exposes the unregistered English fallback without raw errors', async () => {
    expectLocaleFallback('zz', ['loading', 'map', 'mapMarker', 'close', 'mapToggleAttribution', 'mapFeedback',
      'zoomIn', 'zoomOut', 'mapResetNorth', 'mapGeolocateFindLocation', 'mapGeolocateUnavailable',
      'mapScaleFeet', 'mapScaleMeters', 'mapScaleKilometers', 'mapScaleMiles', 'mapScaleNauticalMiles',
      'mapControlUnavailable']);
    const { element, peer } = await mount(el => { el.controls = { attribution: false }; el.locale = 'zz'; });
    await element.whenControlsReady();
    (element as unknown as { controlLifecycle: MapControlsLifecycle }).controlLifecycle = new MapControlsLifecycle(async kind => {
      if (kind === 'navigation') throw new Error('Sensitive peer detail');
      return Control;
    });
    element.controls = { navigation: true, scale: true, attribution: false };
    expect(await element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name)).to.equal('MapReadinessError');
    await waitUntil(() => peer.controls.size === 1);
    await waitUntil(() => Boolean(element.shadowRoot!.querySelector('[part="configuration-error"]')?.textContent?.trim()));
    const feedback = element.shadowRoot!.querySelector('[part="configuration-error"]')!.textContent!;
    expect(feedback).to.include('A map control could not be loaded');
    expect(feedback).not.to.include('Sensitive peer detail');
  });

  it('rejects missing native control capabilities and invalid configuration instead of hanging', async () => {
    const { element, peer } = await mount(el => { el.controls = { attribution: false }; });
    await element.whenControlsReady();
    Reflect.set(peer, 'addControl', undefined);
    element.controls = { navigation: true, attribution: false };
    expect(await element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name)).to.equal('MapReadinessError');
    element.controls = { attribution: false };
    await element.whenControlsReady();
    Reflect.set(peer, 'addControl', ControlMap.prototype.addControl);
    element.controls = { navigation: { order: NaN }, attribution: false };
    expect(await element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name)).to.equal('MapReadinessError');
  });

  it('rejects unavailable default attribution and initialization failures', async () => {
    const { element } = await mount(el => { el.controls = { attribution: false }; });
    await element.whenControlsReady();
    (element as unknown as { controlLifecycle: MapControlsLifecycle }).controlLifecycle = new MapControlsLifecycle(async () => undefined);
    element.controls = undefined;
    expect(await element.whenControlsReady().then(() => 'resolved', (error: Error) => error.name)).to.equal('MapReadinessError');
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const failed = document.createElement('lr-map') as LyraMap;
    failed.engine = 'maplibre'; failed.mapStyle = LYRA_MAP_EMPTY_STYLE;
    (failed as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => null;
    wrapper.append(failed);
    expect(await failed.whenControlsReady().then(() => 'resolved', (error: Error) => error.name)).to.equal('MapReadinessError');
  });
});
