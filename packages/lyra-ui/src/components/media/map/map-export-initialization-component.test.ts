import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';

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
  static constructions = 0;
  repaintCount = 0;
  styleReads = 0;
  autoRender = true;
  getStyle() { this.styleReads++; return { sources: { provider: { attribution: 'Provider credit' } } }; }
  triggerRepaint() { this.repaintCount++; if (this.autoRender) queueMicrotask(() => { if (!this.removed) { this.paint(); this.fire('render'); this.fire('idle'); } }); }
  paint() { const ctx = this.canvas.getContext('2d')!; ctx.fillStyle = '#275dab'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height); }
  static beforeGetCenter: (() => void) | undefined;
  static prepare: (() => Promise<void>) | undefined;
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly canvas = document.createElement('canvas');
  readonly sources = new Map<string, { setData: (data: unknown) => void; updateData: (data: unknown) => void }>();
  readonly layers = new Map<string, unknown>();
  ready = ControlMap.initialReady;
  idle = true;
  synchronousStyle = true;
  removed = false;
  center = { lng: 0, lat: 0 };
  zoom = 2;
  bearing = 0; pitch = 0; fits = 0;
  bounds: [[number, number], [number, number]] | null = null;
  readonly controls = new Set<Control>();
  constructor(readonly options: Record<string, unknown>) {
    ControlMap.constructions++; this.canvas.width = 192; this.canvas.height = 96;
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
    if (this.ready) { this.idle = true; this.fire('style.load'); queueMicrotask(() => this.fire('idle')); }
    return this;
  }
  prepareFeatures(): Promise<void> { return ControlMap.prepare?.() ?? Promise.resolve(); }
  getSource(id: string) { return id === 'provider' ? { attribution: 'Resolved TileJSON credit' } : this.sources.get(id); }
  addSource(id: string): this { this.idle = false; this.sources.set(id, { setData: () => { this.idle = false; }, updateData: () => { this.idle = false; } }); return this; }
  removeSource(id: string): this { this.sources.delete(id); return this; }
  getLayer(id: string): unknown { return this.layers.get(id); }
  addLayer(layer: { id: string }): this { this.layers.set(layer.id, layer); return this; }
  removeLayer(id: string): this { this.layers.delete(id); return this; }
  setPaintProperty(): this { return this; }
  queryRenderedFeatures(): unknown[] { return []; }
}

class VisibilityObserver {
  static instances: VisibilityObserver[] = [];
  target?: Element;
  disconnected = false;
  constructor(readonly callback: IntersectionObserverCallback) { VisibilityObserver.instances.push(this); }
  observe(target: Element) { this.target = target; }
  disconnect() { this.disconnected = true; }
  admit() { if (this.target) this.callback([{ target: this.target, isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
}
const originalObserver = Object.getOwnPropertyDescriptor(window, 'IntersectionObserver');
const originalIdle = Object.getOwnPropertyDescriptor(window, 'requestIdleCallback');
const originalCancelIdle = Object.getOwnPropertyDescriptor(window, 'cancelIdleCallback');
const originalContext = HTMLCanvasElement.prototype.getContext;
const originalToBlob = HTMLCanvasElement.prototype.toBlob;
let idleCallbacks: Map<number, IdleRequestCallback>;
let idleId = 0;
function restore(name: string, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(window, name, descriptor); else Reflect.deleteProperty(window, name);
}
async function setup(configure: (element: LyraMap) => void = () => undefined) {
  const wrapper = await fixture<HTMLDivElement>(html`<div style="width:320px;height:240px"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.engine = 'maplibre'; element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ControlMap, GeolocateControl: Geolocate, AttributionControl: Attribution });
  configure(element); wrapper.append(element); await element.updateComplete;
  return { element, wrapper };
}
async function mount(configure: (element: LyraMap) => void = () => undefined) {
  const result = await setup(element => { element.initialization = 'eager'; configure(element); });
  await waitUntil(() => result.element.map !== undefined);
  const peer = result.element.map as unknown as ControlMap;
  await result.element.updateComplete; peer.idle = true; peer.fire('idle');
  await result.element.whenIdle();
  return { ...result, peer };
}
async function rejects(work: Promise<Blob>, code: string) {
  let caught: unknown;
  try { await work; } catch (error) { caught = error; }
  expect((caught as { code?: string } | undefined)?.code).to.equal(code);
  expect(String(caught)).not.to.include('Native diagnostic sentinel');
}
async function dimensions(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const result = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return result;
}
describe('lr-map initialization and current-frame export', () => {
  beforeEach(() => {
    ControlMap.initialReady = true; ControlMap.constructions = 0; ControlMap.prepare = undefined; ControlMap.beforeGetCenter = undefined;
    VisibilityObserver.instances = []; idleCallbacks = new Map(); idleId = 0;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: VisibilityObserver });
    Object.defineProperty(window, 'requestIdleCallback', { configurable: true, value: (callback: IdleRequestCallback) => { const id = ++idleId; idleCallbacks.set(id, callback); return id; } });
    Object.defineProperty(window, 'cancelIdleCallback', { configurable: true, value: (id: number) => idleCallbacks.delete(id) });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => {
    fixtureCleanup(); restore('IntersectionObserver', originalObserver); restore('requestIdleCallback', originalIdle); restore('cancelIdleCallback', originalCancelIdle);
    HTMLCanvasElement.prototype.getContext = originalContext; HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });
  it('keeps unset initialization visible and performs no native export work before admission', async () => {
    const { element } = await setup();
    expect(element.initialization).to.equal('visible'); expect(ControlMap.constructions).to.equal(0);
    await waitUntil(() => element.shadowRoot!.querySelector('[part="initialization-placeholder"]') !== null);
    const observer = VisibilityObserver.instances.find(value => value.target === element)!; observer.admit();
    await waitUntil(() => element.map !== undefined);
    const peer = element.map as unknown as ControlMap;
    expect(peer.repaintCount).to.equal(0); expect(peer.listeners.get('render')?.size ?? 0).to.equal(0);
  });
  it('admits eager construction without intersection or idle callbacks exactly once', async () => {
    const { element, peer } = await mount();
    expect(ControlMap.constructions).to.equal(1); expect(idleCallbacks.size).to.equal(0);
    element.initialization = 'idle'; await element.updateComplete;
    expect(ControlMap.constructions).to.equal(1); expect(peer.removed).to.equal(false);
  });
  it('cancels stale idle admission on disconnect and creates a new reconnect transaction', async () => {
    const { element, wrapper } = await setup(el => { el.initialization = 'idle'; });
    const stale = [...idleCallbacks.values()][0]!;
    element.remove(); expect(idleCallbacks.size).to.equal(0);
    stale({ didTimeout: false, timeRemaining: () => 10 }); expect(ControlMap.constructions).to.equal(0);
    wrapper.append(element); await element.updateComplete;
    [...idleCallbacks.values()][0]!({ didTimeout: false, timeRemaining: () => 10 });
    await waitUntil(() => element.map !== undefined); expect(ControlMap.constructions).to.equal(1);
  });
  it('reconfigures pending visible admission to eager and rejects the old observer callback', async () => {
    const { element } = await setup(); const stale = VisibilityObserver.instances.find(value => value.target === element)!;
    element.initialization = 'eager'; await element.updateComplete;
    await waitUntil(() => element.map !== undefined); stale.admit();
    expect(ControlMap.constructions).to.equal(1); expect(stale.disconnected).to.equal(true);
  });
  it('captures a fresh real PNG with complete provider footer when native attribution is disabled', async () => {
    const { element, peer } = await mount(el => { el.controls = { attribution: false }; });
    expect(peer.options['attributionControl']).to.equal(false);
    const reads = peer.styleReads;
    const painted: string[] = [], fillText = CanvasRenderingContext2D.prototype.fillText;
    let blob: Blob;
    CanvasRenderingContext2D.prototype.fillText = function(text: string, x: number, y: number, maxWidth?: number) {
      painted.push(text);
      if (maxWidth === undefined) fillText.call(this, text, x, y); else fillText.call(this, text, x, y, maxWidth);
    };
    try { blob = await element.exportImage(); }
    finally { CanvasRenderingContext2D.prototype.fillText = fillText; }
    const size = await dimensions(blob);
    expect(painted.join('')).to.include('Provider credit'); expect(painted.join('')).to.include('Resolved TileJSON credit');
    expect(blob.type).to.equal('image/png'); expect(size.width).to.equal(192); expect(size.height).to.be.greaterThan(96);
    expect(peer.repaintCount).to.equal(1); expect(peer.styleReads - reads).to.equal(1);
    const bitmap = await createImageBitmap(blob), canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(bitmap, 0, 0); bitmap.close();
    expect([...ctx.getImageData(0, 0, 1, 1).data]).to.deep.equal([39, 93, 171, 255]);
  });
  it('skips style/credit capabilities entirely when attribution is false', async () => {
    const { element, peer } = await mount();
    Object.defineProperty(peer, 'getStyle', { value: undefined });
    const blob = await element.exportImage({ attribution: false });
    expect(await dimensions(blob)).to.deep.equal({ width: 192, height: 96 });
  });
  it('admits one active export and rejects busy without interrupting the first fresh render', async () => {
    const { element, peer } = await mount(); peer.autoRender = false;
    const first = element.exportImage({ attribution: false });
    await rejects(element.exportImage({ attribution: false }), 'busy');
    await waitUntil(() => peer.repaintCount === 1); peer.paint(); peer.fire('render');
    expect((await first).type).to.equal('image/png');
    expect(peer.listeners.get('render')?.size ?? 0).to.equal(0);
  });
  it('rejects malformed options before requesting a frame and freezes the public error detail', async () => {
    const { element, peer } = await mount(); const details: unknown[] = [];
    element.addEventListener('lr-map-export-error', event => details.push((event as CustomEvent).detail));
    await rejects(element.exportImage({ type: 'invalid' } as unknown as Parameters<LyraMap['exportImage']>[0]), 'invalid-options');
    expect(peer.repaintCount).to.equal(0); expect(details.length).to.equal(1);
    expect(Object.isFrozen(details[0])).to.equal(true); expect(details[0]).to.deep.equal({ code: 'invalid-options' });
  });
  it('cancels an awaiting fresh render on style replacement and removes the exact listener', async () => {
    const { element, peer } = await mount(); peer.autoRender = false;
    const pending = element.exportImage({ attribution: false });
    const rejected = rejects(pending, 'cancelled'); await waitUntil(() => peer.repaintCount === 1);
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.updateComplete;
    await rejected; peer.fire('render'); expect(peer.listeners.get('render')?.size ?? 0).to.equal(0);
  });
  it('cancels disconnect without reporting an error against a detached owner', async () => {
    const { element, peer } = await mount(); let errors = 0;
    element.addEventListener('lr-map-export-error', () => errors++); peer.autoRender = false;
    const pending = rejects(element.exportImage({ attribution: false }), 'cancelled');
    await waitUntil(() => peer.repaintCount === 1); element.remove(); await pending;
    expect(errors).to.equal(0); expect(peer.listeners.get('render')?.size ?? 0).to.equal(0);
  });
  it('sanitizes failed readiness and does not request a frame', async () => {
    const { element, peer } = await mount();
    Object.defineProperty(element, 'whenIdle', { value: () => Promise.reject(new Error('Native diagnostic sentinel')) });
    await rejects(element.exportImage(), 'not-ready'); expect(peer.repaintCount).to.equal(0);
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.include('Map image could not be exported');
    expect(element.shadowRoot!.textContent).not.to.include('Native diagnostic sentinel');
  });
  it('sanitizes real canvas capture failure', async () => {
    const { element, peer } = await mount();
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === '2d' && this !== peer.canvas ? null : getContext.call(this, id as never, ...(rest as [])); } as typeof getContext;
    await rejects(element.exportImage({ attribution: false }), 'capture-failed');
  });
  it('reports encoding failure and permits a later successful export', async () => {
    const { element } = await mount();
    HTMLCanvasElement.prototype.toBlob = function() { throw new Error('Native diagnostic sentinel'); };
    await rejects(element.exportImage({ attribution: false }), 'encoding-failed');
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    expect((await element.exportImage({ attribution: false })).type).to.equal('image/png');
  });
  it('uses an explicit localized export failure override in the rendered fallback', async () => {
    const { element, peer } = await mount(el => { el.strings = { mapExportUnavailable: 'Export unavailable locally' }; });
    Object.defineProperty(peer, 'getStyle', { value: undefined });
    await rejects(element.exportImage(), 'attribution-failed'); await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.include('Export unavailable locally');
  });
  it('rejects export before native admission with the default English fallback', async () => {
    const { element } = await setup();
    await rejects(element.exportImage(), 'not-ready'); await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.include('Map image could not be exported'); expect(ControlMap.constructions).to.equal(0);
  });
  it('snapshots a changing attribution descriptor once and paints its admitted footer', async () => {
    const { element } = await mount(); let reads = 0;
    const options = new Proxy({ attribution: true }, {
      getOwnPropertyDescriptor(target, key) {
        if (key === 'attribution') { reads++; return { configurable: true, enumerable: true, writable: true, value: reads === 1 }; }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const blob = await element.exportImage(options);
    expect(reads).to.equal(1); expect((await dimensions(blob)).height).to.be.greaterThan(96);
  });
  it('does not encode a frame when a native readiness probe authors a replacement style', async () => {
    for (const probe of ['isMoving', 'loaded'] as const) {
      const { element, peer } = await mount(); peer.autoRender = false;
      const pending = rejects(element.exportImage({ attribution: false }), 'cancelled');
      await waitUntil(() => peer.repaintCount === 1);
      let encoded = 0; const toBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(callback, type, quality) { encoded++; toBlob.call(this, callback, type, quality); };
      const original = peer[probe];
      peer[probe] = () => { peer[probe] = original; element.mapStyle = { version: 8, sources: {}, layers: [] }; return probe === 'loaded'; };
      try { peer.fire('render'); expect(encoded).to.equal(0); await element.updateComplete; await pending; }
      finally { HTMLCanvasElement.prototype.toBlob = toBlob; }
      element.remove();
    }
  });
  it('recovers after a throwing native render readiness probe aborts the previous owner', async () => {
    const { element, peer } = await mount(); peer.autoRender = false;
    const pending = rejects(element.exportImage({ attribution: false }), 'cancelled');
    await waitUntil(() => peer.repaintCount === 1);
    const loaded = peer.loaded;
    peer.loaded = () => { throw new Error('Native diagnostic sentinel'); };
    peer.fire('render'); await pending;
    peer.loaded = loaded; peer.autoRender = true;
    expect((await element.exportImage({ attribution: false })).type).to.equal('image/png');
    expect(peer.listeners.get('render')?.size ?? 0).to.equal(0);
  });
  it('resets old export feedback when disconnected and reconnected', async () => {
    const { element, wrapper } = await mount();
    await rejects(element.exportImage({ type: 'invalid' } as unknown as Parameters<LyraMap['exportImage']>[0]), 'invalid-options');
    await element.updateComplete; expect(element.shadowRoot!.textContent).to.include('Map image could not be exported');
    element.remove(); wrapper.append(element);
    await waitUntil(() => element.map !== undefined); await element.updateComplete;
    expect(element.shadowRoot!.textContent).not.to.include('Map image could not be exported');
  });

});
