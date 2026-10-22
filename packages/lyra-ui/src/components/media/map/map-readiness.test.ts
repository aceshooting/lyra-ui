import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { MapReadiness, type MapReadinessOptions } from './map-readiness.js';
import './map.js';
import { LYRA_MAP_EMPTY_STYLE, type LyraMap } from './map.js';
import { loadMapOwnedFeatureRuntime } from './map-feature-loader.js';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function outcome(promise: Promise<void>) {
  const state: { settled: boolean; error?: unknown } = { settled: false };
  void promise.then(() => { state.settled = true; }, error => { state.settled = true; state.error = error; });
  return state;
}

async function settled(state: ReturnType<typeof outcome>): Promise<void> {
  await waitUntil(() => state.settled, 'readiness did not settle');
}

function scriptedReadiness(overrides: Partial<MapReadinessOptions> = {}) {
  const listeners = new Map<string, Set<() => void>>();
  let idle = false;
  let pending = false;
  let readyEvents = 0;
  let idleEvents = 0;
  const controller = new MapReadiness();
  const options: MapReadinessOptions = {
    subscribe(event, listener) {
      const set = listeners.get(event) ?? new Set();
      listeners.set(event, set); set.add(listener);
      return () => { set.delete(listener); };
    },
    restore: () => undefined,
    isStyleReady: () => false,
    isIdle: () => idle,
    ownerPending: () => pending,
    onStyleReady: () => { readyEvents += 1; },
    onIdle: () => { idleEvents += 1; },
    ...overrides,
  };
  const fire = (event: string) => { for (const listener of [...(listeners.get(event) ?? [])]) listener(); };
  controller.reset(); controller.bind(options);
  return {
    controller, options, listeners, fire,
    setIdle(value: boolean) { idle = value; },
    setPending(value: boolean) { pending = value; },
    get readyEvents() { return readyEvents; },
    get idleEvents() { return idleEvents; },
  };
}

describe('map current readiness', () => {
  it('waits through initial binding and recognizes already-ready peers once', async () => {
    const controller = new MapReadiness();
    controller.reset();
    const ready = outcome(controller.whenStyleReady());
    let count = 0;
    controller.bind({ subscribe: () => () => undefined, restore: () => undefined,
      isStyleReady: () => true, isIdle: () => true, ownerPending: () => false,
      onStyleReady: () => { count += 1; }, onIdle: () => undefined });
    await settled(ready);
    expect(ready.error).to.equal(undefined);
    expect(count).to.equal(1);
    await controller.whenIdle();
    controller.cancel();
  });

  it('ignores early idle and awaits asynchronous restoration', async () => {
    const work = deferred();
    const h = scriptedReadiness({ restore: () => work.promise });
    const ready = outcome(h.controller.whenStyleReady());
    const idle = outcome(h.controller.whenIdle());
    h.fire('style-ready'); h.fire('idle');
    await Promise.resolve();
    expect(ready.settled).to.equal(false);
    work.resolve(); await settled(ready);
    expect(idle.settled).to.equal(false);
    h.setIdle(true); h.fire('idle'); await settled(idle);
    expect(h.readyEvents).to.equal(1); expect(h.idleEvents).to.equal(1);
    h.controller.cancel();
  });

  it('waits for owner work started between restoration and public readiness publication', async () => {
    const work = deferred();
    const h = scriptedReadiness({ restore: () => work.promise });
    h.fire('style-ready');
    const ready = outcome(h.controller.whenStyleReady());
    await Promise.resolve();
    work.resolve(); h.setPending(true);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(ready.settled).to.equal(false); expect(h.readyEvents).to.equal(0);
    h.setPending(false); h.controller.check(); await settled(ready);
    expect(h.readyEvents).to.equal(1);
    h.controller.cancel();
  });

  it('retains idle observation and invalidates old evidence for later camera and source work', async () => {
    const h = scriptedReadiness();
    h.fire('style-ready'); await h.controller.whenStyleReady();
    h.setIdle(true); h.fire('idle'); await h.controller.whenIdle();
    expect(h.listeners.get('idle')?.size).to.equal(1);
    h.setIdle(false); h.fire('busy');
    const camera = outcome(h.controller.whenIdle());
    await Promise.resolve(); expect(camera.settled).to.equal(false);
    h.setIdle(true); h.fire('idle'); await settled(camera);
    h.setPending(true); h.controller.invalidate();
    const source = outcome(h.controller.whenIdle());
    h.fire('idle'); await Promise.resolve(); expect(source.settled).to.equal(false);
    h.setPending(false); h.setIdle(false); h.controller.check();
    await Promise.resolve(); expect(source.settled).to.equal(false);
    h.setIdle(true); h.fire('idle'); await settled(source);
    expect(h.idleEvents).to.equal(3);
    h.controller.cancel();
    expect([...h.listeners.values()].reduce((sum, value) => sum + value.size, 0)).to.equal(0);
  });

  it('requires a fresh peer idle when an old peer has no idle probe', async () => {
    const h = scriptedReadiness({ isIdle: undefined });
    h.fire('style-ready'); await h.controller.whenStyleReady();
    h.fire('idle'); await h.controller.whenIdle();
    h.controller.invalidate();
    const next = outcome(h.controller.whenIdle());
    await Promise.resolve(); expect(next.settled).to.equal(false);
    h.fire('idle'); await settled(next);
    h.controller.cancel();
  });

  it('aborts A and B, ignores old failures and publishes only C', async () => {
    const first = deferred();
    const h = scriptedReadiness({ restore: () => first.promise });
    const a = outcome(h.controller.whenStyleReady());
    h.fire('style-ready'); await Promise.resolve();
    const oldError = [...h.listeners.get('error')!];
    h.controller.reset(); h.controller.bind({ ...h.options, restore: () => undefined });
    const b = outcome(h.controller.whenStyleReady());
    h.controller.reset(); h.controller.bind({ ...h.options, restore: () => undefined });
    const c = outcome(h.controller.whenStyleReady());
    oldError.forEach(listener => listener()); first.reject(new Error('obsolete payload'));
    h.fire('style-ready'); await settled(a); await settled(b); await settled(c);
    expect((a.error as Error).name).to.equal('AbortError');
    expect((b.error as Error).name).to.equal('AbortError');
    expect(c.error).to.equal(undefined); expect(h.readyEvents).to.equal(1);
    h.controller.cancel();
  });

  it('sanitizes a current failure even after first idle and releases subscriptions', async () => {
    const h = scriptedReadiness();
    h.fire('style-ready'); await h.controller.whenStyleReady();
    h.setIdle(true); h.fire('idle'); await h.controller.whenIdle();
    h.controller.invalidate(); h.setIdle(false);
    const idle = outcome(h.controller.whenIdle());
    h.fire('error'); await settled(idle);
    expect((idle.error as Error).name).to.equal('MapReadinessError');
    expect((idle.error as Error).message).to.equal('Map readiness failed.');
    expect([...h.listeners.values()].reduce((sum, value) => sum + value.size, 0)).to.equal(0);
    h.controller.cancel();
  });

  it('does not settle an idle callback that starts new work', async () => {
    let calls = 0;
    const h = scriptedReadiness({ onIdle: () => {
      calls += 1;
      if (calls === 1) { h.setIdle(false); h.controller.invalidate(); }
    } });
    h.fire('style-ready'); await h.controller.whenStyleReady();
    const idle = outcome(h.controller.whenIdle());
    h.setIdle(true); h.fire('idle'); await Promise.resolve(); await Promise.resolve();
    expect(idle.settled).to.equal(false);
    h.setIdle(true); h.fire('idle'); await settled(idle);
    expect(calls).to.equal(2);
    h.controller.cancel();
  });

  it('does not report an old failure when aborting restoration starts a newer generation', async () => {
    let errors = 0;
    let freshReady = 0;
    const work = deferred();
    const h = scriptedReadiness({
      restore: signal => {
        signal.addEventListener('abort', () => {
          h.controller.reset();
          h.controller.bind({ ...h.options, restore: () => undefined, isStyleReady: () => true,
            onStyleReady: () => { freshReady += 1; } });
        }, { once: true });
        return work.promise;
      },
      onError: () => { errors += 1; },
    });
    h.fire('style-ready'); await Promise.resolve();
    h.controller.fail();
    await h.controller.whenStyleReady();
    expect(errors).to.equal(0); expect(freshReady).to.equal(1);
    h.controller.cancel(); work.resolve();
  });

  it('aborts a ready callback that starts another style and disconnect waiters', async () => {
    const h = scriptedReadiness({ onStyleReady: () => { h.controller.reset(); } });
    const ready = outcome(h.controller.whenStyleReady());
    h.fire('style-ready'); await settled(ready);
    expect((ready.error as Error).name).to.equal('AbortError');
    const reconnect = outcome(h.controller.whenStyleReady());
    h.controller.cancel(); await settled(reconnect);
    expect((reconnect.error as Error).name).to.equal('AbortError');
  });
});

class ReadinessMap {
  static initialReady = false;
  static prepare: (() => Promise<void>) | undefined;
  readonly listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();
  readonly canvas = document.createElement('canvas');
  readonly sources = new Map<string, { setData: (data: unknown) => void; updateData: (data: unknown) => void }>();
  readonly layers = new Map<string, unknown>();
  ready = ReadinessMap.initialReady;
  idle = false;
  synchronousStyle = true;
  removed = false;
  center = { lng: 0, lat: 0 };
  zoom = 2;
  constructor(readonly options: Record<string, unknown>) {}
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
  getCenter() { return this.center; }
  getZoom(): number { return this.zoom; }
  setCenter(value: [number, number]): void { this.center = { lng: value[0], lat: value[1] }; this.idle = false; }
  setZoom(value: number): void { this.zoom = value; this.idle = false; }
  jumpTo(options: { center?: [number, number]; zoom?: number }): void {
    this.idle = false; this.fire('movestart');
    if (options.center) this.setCenter(options.center);
    if (options.zoom !== undefined) this.setZoom(options.zoom);
    this.fire('moveend');
  }
  resize(): void {}
  remove(): void { this.removed = true; this.listeners.clear(); }
  setStyle(): this {
    this.sources.clear(); this.layers.clear(); this.idle = false;
    this.ready = this.synchronousStyle;
    if (this.ready) this.fire('style.load');
    return this;
  }
  prepareFeatures(): Promise<void> { return ReadinessMap.prepare?.() ?? Promise.resolve(); }
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
const POINTS = { type: 'FeatureCollection' as const, features: [
  { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: [1, 2] } },
] };

async function mount(configure?: (element: LyraMap) => void) {
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.mapStyle = LYRA_MAP_EMPTY_STYLE;
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: ReadinessMap });
  configure?.(element); wrapper.append(element);
  await waitUntil(() => element.map !== undefined, 'map did not initialize');
  await element.updateComplete;
  return { element, peer: element.map as unknown as ReadinessMap, wrapper };
}

async function load(element: LyraMap, peer: ReadinessMap) {
  peer.ready = true; peer.fire('load'); await element.whenStyleReady();
}

describe('lr-map public readiness', () => {
  // Exercises the steady state after the on-demand runtime has loaded; map-lazy-runtimes.test.ts covers the loading itself.
  before(() => loadMapOwnedFeatureRuntime());
  beforeEach(() => {
    ReadinessMap.initialReady = false; ReadinessMap.prepare = undefined;
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
        return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as []));
      } });
  });
  afterEach(() => {
    fixtureCleanup();
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver });
    HTMLCanvasElement.prototype.getContext = originalContext;
  });

  it('starts native preparation synchronously on load while style publication waits for completion', async () => {
    const pending = deferred(); let calls = 0; let ready = 0;
    ReadinessMap.prepare = () => { calls++; return pending.promise; };
    const { element, peer } = await mount(el => { el.dataLayers = [{ sourceId: 'points', geojson: POINTS }];
      el.addEventListener('lr-map-style-load', () => { ready++; }); });
    peer.ready = true; peer.fire('load');
    expect(calls).to.equal(1); expect(peer.layers.size).to.equal(0); expect(ready).to.equal(0);
    peer.fire('style.load'); expect(calls).to.equal(1);
    pending.resolve(); await element.whenStyleReady(); expect(ready).to.equal(1);
  });

  it('preserves synchronous load publication for an event-only native peer with unset owned options', async () => {
    let loads = 0;
    const { element, peer, wrapper } = await mount(el => el.addEventListener('lr-map-load', () => { loads++; }));
    Object.defineProperty(peer, 'prepareFeatures', { value: undefined });
    peer.ready = true; peer.fire('load'); expect(loads).to.equal(1);
    peer.fire('load'); expect(loads).to.equal(1);
    element.remove(); wrapper.append(element); await waitUntil(() => element.map !== undefined);
    const replacement = element.map as unknown as ReadinessMap;
    Object.defineProperty(replacement, 'prepareFeatures', { value: undefined });
    replacement.ready = true; replacement.fire('load'); expect(loads).to.equal(2);
    await element.whenStyleReady();
  });

  it('keeps an already-ready initialization failure visible after synchronous restoration fails', async () => {
    ReadinessMap.initialReady = true;
    const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
    const element = document.createElement('lr-map') as LyraMap;
    element.mapStyle = LYRA_MAP_EMPTY_STYLE;
    element.overlays = { sources: [{ id: 'invalid', source: { type: 'geojson', data: () => undefined } }] };
    element.strings = { mapInitializationFailed: 'Map restoration unavailable' };
    let observations = 0; let peer: ReadinessMap | undefined;
    const seam = element as unknown as { loadLibrary: () => Promise<unknown>; observeMapAllocation: () => void };
    seam.loadLibrary = async () => ({ Map: class extends ReadinessMap {
      constructor(options: Record<string, unknown>) { super(options); this.idle = true; peer = this; }
    } });
    seam.observeMapAllocation = () => { observations++; };
    wrapper.append(element);
    await waitUntil(() => element.shadowRoot?.querySelector('[part="error"]') !== null && element.shadowRoot?.querySelector('[part="error"]') !== undefined);
    await element.updateComplete;
    expect(element.map === undefined).to.equal(true);
    expect(peer?.removed).to.equal(true); expect(observations).to.equal(0);
    expect(element.shadowRoot?.querySelector('[part="error"]')?.textContent).to.include('Map restoration unavailable');
  });

  it('does not substitute a loaded-state probe for the native load event', async () => {
    let loads = 0;
    const { element, peer } = await mount(el => {
      el.addEventListener('lr-map-load', () => { loads++; });
      (el as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: class extends ReadinessMap {
        constructor(options: Record<string, unknown>) { super(options); this.ready = true; this.idle = true; }
      } });
    });
    await element.whenStyleReady(); expect(loads).to.equal(0);
    peer.fire('load'); expect(loads).to.equal(1);
    peer.fire('load'); expect(loads).to.equal(1);
  });

  it('handles constructor-ready state, synchronous style swaps and exactly one ready event per style', async () => {
    ReadinessMap.initialReady = true;
    const events: number[] = [];
    const { element, peer } = await mount(el => el.addEventListener('lr-map-style-load', event => {
      events.push((event as CustomEvent<{ generation: number }>).detail.generation);
    }));
    await element.whenStyleReady();
    peer.fire('load'); peer.fire('style.load'); await Promise.resolve();
    expect(events.length).to.equal(1);
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady();
    expect(events.length).to.equal(2); expect(events[1]!).to.be.greaterThan(events[0]!);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
  });

  it('awaits real feature preparation and follows a newer same-style data request', async () => {
    const first = deferred(); const second = deferred(); let calls = 0;
    ReadinessMap.prepare = () => (++calls === 1 ? first.promise : second.promise);
    const { element, peer } = await mount(el => { el.dataLayers = [{ sourceId: 'a', geojson: POINTS }]; });
    peer.ready = true; peer.fire('load');
    const ready = outcome(element.whenStyleReady());
    await waitUntil(() => calls === 1);
    element.dataLayers = [{ sourceId: 'b', geojson: POINTS }]; await element.updateComplete;
    await waitUntil(() => calls === 2);
    peer.idle = true; peer.fire('idle'); first.resolve();
    await Promise.resolve(); expect(ready.settled).to.equal(false);
    second.resolve(); await settled(ready);
    expect(ready.error).to.equal(undefined); expect(peer.sources.size).to.equal(1);
    const idle = outcome(element.whenIdle()); await Promise.resolve(); expect(idle.settled).to.equal(false);
    peer.idle = true; peer.fire('idle'); await settled(idle);
  });

  it('waits again after the initial idle for camera and incremental source updates', async () => {
    let idleEvents = 0;
    const { element, peer } = await mount(el => {
      el.dataLayers = [{ sourceId: 'points', geojson: POINTS }];
      el.addEventListener('lr-map-idle', () => { idleEvents += 1; });
    });
    await load(element, peer); peer.idle = true; peer.fire('idle'); await element.whenIdle();
    element.jumpTo({ center: [4, 5] });
    const camera = outcome(element.whenIdle()); await Promise.resolve(); expect(camera.settled).to.equal(false);
    peer.idle = true; peer.fire('idle'); await settled(camera);
    element.dataLayers = [{ sourceId: 'points', geojson: { ...POINTS, features: [] } }];
    const source = outcome(element.whenIdle());
    await element.updateComplete; await Promise.resolve(); expect(source.settled).to.equal(false);
    peer.idle = true; peer.fire('idle'); await settled(source);
    expect(idleEvents).to.equal(3);
    expect(element.updateSourceData('points', { removeAll: true })).to.equal(true);
    const incremental = outcome(element.whenIdle());
    await Promise.resolve(); expect(incremental.settled).to.equal(false);
    peer.idle = true; peer.fire('idle'); await settled(incremental);
    expect(idleEvents).to.equal(4);
  });

  it('aborts rapid styles and old callbacks, then reconnects with fresh promises', async () => {
    const { element, peer, wrapper } = await mount(); await load(element, peer);
    peer.synchronousStyle = false;
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.updateComplete;
    const a = outcome(element.whenStyleReady());
    const oldCallbacks = [...(peer.listeners.get('error') ?? [])];
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.updateComplete;
    const b = outcome(element.whenStyleReady());
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.updateComplete;
    const c = outcome(element.whenStyleReady());
    oldCallbacks.forEach(callback => callback({ error: new Error('obsolete') }));
    peer.ready = true; peer.fire('style.load');
    await settled(a); await settled(b); await settled(c);
    expect((a.error as Error).name).to.equal('AbortError'); expect((b.error as Error).name).to.equal('AbortError');
    expect(c.error).to.equal(undefined);
    const idle = outcome(element.whenIdle()); element.remove(); await settled(idle);
    expect((idle.error as Error).name).to.equal('AbortError'); expect(peer.listeners.size).to.equal(0);
    wrapper.append(element);
    const again = outcome(element.whenStyleReady());
    await waitUntil(() => element.map !== undefined);
    const replacement = element.map as unknown as ReadinessMap;
    replacement.ready = true; replacement.fire('load'); await settled(again);
    expect(again.error).to.equal(undefined); expect(replacement === peer).to.equal(false);
  });

  it('publishes native map load once when a later peer listener queues a non-data update', async () => {
    let loads = 0;
    const { element, peer } = await mount(el => el.addEventListener('lr-map-load', () => { loads += 1; }));
    peer.ready = true; peer.fire('style.load'); await element.whenStyleReady();
    expect(loads).to.equal(0);
    peer.on('load', () => { element.zoom = 4; });
    peer.fire('load');
    await element.updateComplete;
    await waitUntil(() => loads === 1, 'native map load was lost during a pending update');
    peer.fire('load'); await element.updateComplete; await Promise.resolve();
    expect(loads).to.equal(1);
  });

  it('makes captured old readiness callbacks inert on a legacy peer without off', async () => {
    let readyEvents = 0;
    const { element, peer } = await mount(el => el.addEventListener('lr-map-style-load', () => { readyEvents += 1; }));
    await load(element, peer);
    Object.defineProperty(peer, 'off', { configurable: true, value: undefined });
    const oldErrors = [...(peer.listeners.get('error') ?? [])];
    const oldStyles = [...(peer.listeners.get('style.load') ?? [])];
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady(); expect(readyEvents).to.equal(2);
    const idle = outcome(element.whenIdle());
    oldErrors.forEach(callback => callback({ error: new Error('obsolete callback') }));
    await Promise.resolve(); expect(idle.settled).to.equal(false);
    peer.idle = true; peer.fire('idle'); await settled(idle);
    element.remove();
    oldStyles.forEach(callback => callback({}));
    await Promise.resolve(); expect(readyEvents).to.equal(2);
  });

  it('does not publish idle or settle an old style from a reentrant style-ready listener', async () => {
    let readyEvents = 0;
    const { element, peer } = await mount(el => el.addEventListener('lr-map-style-load', () => {
      readyEvents += 1;
      if (readyEvents === 1) el.mapStyle = { version: 8, sources: {}, layers: [] };
    }));
    const first = outcome(element.whenStyleReady());
    peer.ready = true; peer.fire('load'); await settled(first);
    expect((first.error as Error).name).to.equal('AbortError');
    await element.whenStyleReady(); expect(readyEvents).to.equal(2);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
  });

  it('waits through an idle listener that starts a new camera move', async () => {
    const { element, peer } = await mount(); await load(element, peer);
    let events = 0;
    element.addEventListener('lr-map-idle', () => {
      events += 1;
      if (events === 1) element.jumpTo({ center: [8, 9] });
    });
    const idle = outcome(element.whenIdle());
    peer.idle = true; peer.fire('idle');
    await waitUntil(() => events === 1); expect(idle.settled).to.equal(false);
    peer.idle = true; peer.fire('idle'); await settled(idle);
    expect(events).to.equal(2);
  });

  it('sanitizes a preparation rejection and ignores its stale predecessor', async () => {
    const first = deferred(); const second = deferred(); let calls = 0;
    ReadinessMap.prepare = () => (++calls === 1 ? first.promise : second.promise);
    const { element, peer } = await mount();
    peer.ready = true; peer.fire('load'); await waitUntil(() => calls === 1);
    const old = outcome(element.whenStyleReady());
    element.mapStyle = { version: 8, sources: {}, layers: [] }; await element.updateComplete;
    const current = outcome(element.whenStyleReady());
    await waitUntil(() => calls === 2);
    first.reject(new Error('obsolete preparation')); await Promise.resolve();
    expect(current.settled).to.equal(false);
    second.reject(new Error('private preparation payload')); await settled(current); await settled(old);
    expect((old.error as Error).name).to.equal('AbortError');
    expect((current.error as Error).message).to.equal('Map readiness failed.');
  });

  it('rejects later idle waits on a tile error without removing a rendered map', async () => {
    const { element, peer } = await mount(); await load(element, peer);
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
    peer.idle = false; peer.fire('dataloading');
    const idle = outcome(element.whenIdle());
    const diagnostic = new Error('tile request failed');
    const originalError = console.error; let diagnostics = 0;
    console.error = (...args: unknown[]) => {
      if (args.length === 2 && args[0] === 'lr-map:' && args[1] === diagnostic) { diagnostics++; return; }
      Reflect.apply(originalError, console, args);
    };
    try { peer.fire('error', { error: diagnostic }); await settled(idle); }
    finally { console.error = originalError; }
    expect(diagnostics).to.equal(1);
    expect((idle.error as Error).name).to.equal('MapReadinessError');
    expect(peer.removed).to.equal(false);
    element.mapStyle = { version: 8, sources: {}, layers: [] };
    await element.whenStyleReady();
    peer.idle = true; peer.fire('idle'); await element.whenIdle();
  });

  it('rejects current peer failures with a stable error rather than peer message text', async () => {
    const { element, peer } = await mount();
    const ready = outcome(element.whenStyleReady());
    peer.fire('error', { error: new Error('sensitive peer payload') }); await settled(ready);
    expect((ready.error as Error).name).to.equal('MapReadinessError');
    expect((ready.error as Error).message).to.equal('Map readiness failed.');
  });
});
