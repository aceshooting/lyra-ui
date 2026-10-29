import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import { mapCameraSessionAttachment, type MapCameraSessionCallbacks } from '../../../internal/map-camera-session.js';
import { admitMapViewpoint } from '../../../internal/map-camera-session-data.js';
import { createMapCameraSessionController } from '../../../internal/map-camera-session-controller.js';
import { createSimulationClock } from '../../../simulation-clock.js';
import { LyraMap, LYRA_MAP_EMPTY_STYLE } from './map.js';
import { loadMapOwnedFeatureRuntime, loadMapControlRuntime } from './map-feature-loader.js';
import { sceneMarker, sceneModel, scenePath } from '../../../../test/map-scene-admission-fixtures.js';
import { mapSceneSessionAttachment } from '../../../internal/map-scene-session.js';

type PeerEvent = Record<string, unknown>;
interface CameraOptions { center?: readonly number[]; zoom?: number; bearing?: number; pitch?: number; duration?: number; }
class CameraPeer {
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
const view = (longitude = 12) => admitMapViewpoint({ center: [longitude, 5], zoom: 6, bearing: 30, pitch: 40 });
async function mount() {
  const wrapper = await fixture<HTMLDivElement>(html`<div data-lr-motion="system"></div>`);
  const element = document.createElement('lr-map') as LyraMap;
  element.initialization = 'eager'; element.mapStyle = LYRA_MAP_EMPTY_STYLE; element.controls = { attribution: false };
  (element as unknown as { loadLibrary: () => Promise<unknown> }).loadLibrary = async () => ({ Map: CameraPeer });
  wrapper.append(element); await waitUntil(() => element.map !== undefined);
  const peer = element.map as unknown as CameraPeer; peer.ready = true; peer.fire('load');
  await element.whenStyleReady(); await element.updateComplete;
  return { wrapper, element, peer };
}
function acquire(element: LyraMap, overrides: Partial<MapCameraSessionCallbacks> = {}) {
  const completed: object[] = [], interrupted: string[] = [];
  const attachment = mapCameraSessionAttachment(element);
  expect(attachment !== undefined).to.equal(true);
  const lease = attachment!.acquire({ complete: action => completed.push(action), interrupt: reason => interrupted.push(reason), motion: () => {}, ...overrides });
  return { lease, completed, interrupted };
}

describe('map camera session component attachment', () => {
  before(async () => { await loadMapOwnedFeatureRuntime(); await loadMapControlRuntime(); });
  beforeEach(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, writable: true,
      value(this: HTMLCanvasElement, id: string, ...rest: unknown[]) { return id === 'webgl2' ? {} : originalContext.call(this, id as never, ...(rest as [])); } });
  });
  afterEach(() => { fixtureCleanup(); Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: originalObserver }); HTMLCanvasElement.prototype.getContext = originalContext; });

  it('keeps ordinary map camera commands and reflected command events unchanged without a lease', async () => {
    const { element, peer } = await mount(); const seen: string[] = [];
    element.addEventListener('lr-map-view-change', event => seen.push(event.detail.source));
    expect(element.jumpTo({ center: [8, 9], zoom: 7 })).to.equal(true); await element.updateComplete;
    expect(element.center).to.deep.equal([8, 9]); expect(element.zoom).to.equal(7); expect(seen).to.deep.equal(['command']);
    expect(peer.calls.filter(name => name === 'setCenter' || name === 'setZoom')).to.deep.equal([]);
  });
  it('registers only component instances and enforces one current lease', async () => {
    expect(mapCameraSessionAttachment(document.createElement('div'))).to.equal(undefined);
    const { element } = await mount(); const { lease } = acquire(element);
    expect(() => acquire(element)).to.throw(); lease.release(); lease.release();
    const next = acquire(element).lease; expect(lease.current()).to.equal(false); expect(next.current()).to.equal(true);
  });
  it('captures every native camera field without retaining peer or caller arrays', async () => {
    const { element, peer } = await mount(); const { lease } = acquire(element);
    peer.center = [11, 22]; peer.zoom = 7; peer.bearing = 35; peer.pitch = 42;
    const captured = lease.capture(); peer.center[0] = 99;
    expect(captured).to.deep.equal({ center: [11, 22], zoom: 7, bearing: 35, pitch: 42 });
    expect(Object.isFrozen(captured) && Object.isFrozen(captured.center)).to.equal(true);
  });
  it('requires real bearing and pitch getters instead of defaulting them', async () => {
    const { element, peer } = await mount(); Reflect.set(peer, 'getBearing', undefined);
    expect(() => acquire(element)).to.throw();
    Reflect.set(peer, 'getBearing', () => 0); Reflect.set(peer, 'getPitch', undefined);
    expect(() => acquire(element)).to.throw();
  });
  it('admits jump without stop but rejects animated preparation without disturbing it', async () => {
    const { element, peer } = await mount(); const { lease, completed } = acquire(element); Reflect.set(peer, 'stop', undefined);
    const action = {}; const prepared = lease.prepare(action, view(), { kind: 'jump' });
    expect(() => lease.prepare({}, view(), { kind: 'ease', duration: 100 })).to.throw();
    expect(peer.calls.includes('jumpTo')).to.equal(false); expect(lease.commit(prepared)).to.equal(true);
    expect(completed).to.deep.equal([action]);
  });
  it('requires observable movement and cancellation only for a moving replacement', async () => {
    const { element, peer } = await mount(); const { lease } = acquire(element);
    const moving = peer.isMoving;
    Reflect.set(peer, 'isMoving', undefined); expect(() => lease.prepare({}, view(), { kind: 'jump' })).to.throw();
    peer.isMoving = moving; peer.moving = true; Reflect.set(peer, 'stop', undefined);
    expect(() => lease.prepare({}, view(), { kind: 'jump' })).to.throw();
    expect(peer.calls.includes('jumpTo')).to.equal(false); expect(peer.moving).to.equal(true);
  });
  it('completes a synchronous owned jump only after its existing reflected event', async () => {
    const { element, peer } = await mount(); const order: string[] = [];
    element.addEventListener('lr-map-view-change', event => { expect(event.detail.source).to.equal('command'); order.push('event'); });
    const { lease } = acquire(element, { complete: () => { expect(element.center).to.deep.equal([12, 5]); order.push('complete'); } });
    expect(lease.commit(lease.prepare({}, view(), { kind: 'jump' }))).to.equal(true); await element.updateComplete;
    expect(order).to.deep.equal(['event', 'complete']); expect(peer.calls.filter(name => name === 'setCenter' || name === 'setZoom')).to.deep.equal([]);
  });
  it('does not report completion when a native command emits moveend and then throws', async () => {
    const { element, peer } = await mount(); const { lease, completed } = acquire(element); peer.failAfterMove = true;
    expect(lease.commit(lease.prepare({}, view(), { kind: 'jump' }))).to.equal(false);
    expect(completed).to.deep.equal([]);
  });
  it('unwinds failed canvas capability acquisition before the next owner tries', async () => {
    const { element, peer } = await mount(); const original = peer.getCanvas;
    peer.getCanvas = () => { throw new Error('Canvas unavailable'); };
    expect(() => acquire(element)).to.throw(); peer.getCanvas = original;
    expect(acquire(element).lease.current()).to.equal(true);
  });
  it('does not install context observers after acquisition disconnects reentrantly', async () => {
    const { wrapper, element, peer } = await mount(); let registrations = 0;
    Object.defineProperty(peer.canvas, 'addEventListener', { configurable: true, value: () => { registrations++; } });
    peer.getCanvas = () => { element.remove(); return peer.canvas; };
    expect(() => acquire(element)).to.throw(); expect(registrations).to.equal(0);
    wrapper.append(element); await waitUntil(() => element.map !== undefined);
    const next = element.map as unknown as CameraPeer; next.ready = true; next.fire('load'); await element.whenStyleReady(); await element.updateComplete;
    expect(acquire(element).lease.current()).to.equal(true);
  });
  it('ignores unrelated completion and retires the token before synchronous stop completion', async () => {
    const { element, peer } = await mount(); const { lease, completed } = acquire(element); const action = {};
    expect(lease.commit(lease.prepare(action, view(), { kind: 'ease', duration: 100 }))).to.equal(true);
    peer.fire('moveend', {}); expect(completed).to.deep.equal([]);
    lease.retire(action, true); expect(peer.calls.filter(name => name === 'stop')).to.have.length(1); expect(completed).to.deep.equal([]);
    lease.retire(action, true); expect(peer.calls.filter(name => name === 'stop')).to.have.length(1);
  });
  it('lets a new action started inside the reflected event supersede old completion', async () => {
    const { element, peer } = await mount(); const { lease, completed } = acquire(element); const first = {}, second = {}; let replaced = false;
    element.addEventListener('lr-map-view-change', () => {
      if (replaced) return; replaced = true; lease.retire(first, false);
      lease.commit(lease.prepare(second, view(25), { kind: 'ease', duration: 100 }));
    });
    lease.commit(lease.prepare(first, view(), { kind: 'jump' })); expect(completed).to.deep.equal([]);
    peer.finish(); expect(completed).to.deep.equal([second]); expect(element.center).to.deep.equal([25, 5]);
  });
  it('preserves ownership on equal controlled mirrors and cancels unequal intent before its write', async () => {
    const { element, peer } = await mount(); const { lease, interrupted } = acquire(element);
    lease.commit(lease.prepare({}, view(), { kind: 'jump' })); peer.calls.length = 0;
    element.center = [...element.center]; element.zoom = element.zoom; await element.updateComplete;
    expect(interrupted).to.deep.equal([]); expect(peer.calls.filter(name => name === 'setCenter' || name === 'setZoom')).to.deep.equal([]);
    element.center = [30, 10]; expect(interrupted).to.deep.equal(['external']);
    await element.updateComplete; expect(peer.center).to.deep.equal([30, 10]);
  });
  it('invalidates a prepared command on style replacement before any stale camera write', async () => {
    const { element, peer } = await mount(); const { lease, interrupted } = acquire(element);
    const prepared = lease.prepare({}, view(), { kind: 'jump' }); peer.calls.length = 0;
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE }; expect(interrupted).to.deep.equal(['style']);
    expect(lease.commit(prepared)).to.equal(false); expect(peer.calls.includes('jumpTo')).to.equal(false);
  });
  it('preserves an active command when another preparation is rejected', async () => {
    const { element, peer } = await mount(); const { lease, completed } = acquire(element); const action = {};
    lease.commit(lease.prepare(action, view(), { kind: 'ease', duration: 100 })); Reflect.set(peer, 'flyTo', undefined);
    expect(() => lease.prepare({}, view(33), { kind: 'fly' })).to.throw();
    expect(peer.calls.includes('stop')).to.equal(false); peer.finish(); expect(completed).to.deep.equal([action]);
  });
  for (const type of ['movestart', 'boxzoomstart']) {
    it(`retires on native ${type} user intent without stopping the incoming gesture`, async () => {
      const { element, peer } = await mount(); const { lease, interrupted, completed } = acquire(element);
      lease.commit(lease.prepare({}, view(), { kind: 'ease', duration: 100 }));
      peer.fire(type, { originalEvent: new Event('pointerdown') }); expect(interrupted).to.deep.equal(['user']);
      expect(peer.calls.includes('stop')).to.equal(false); peer.finish(); expect(completed).to.deep.equal([]);
    });
  }
  it('retires on untagged native movement but ignores ordinary resize and data updates', async () => {
    const { element, peer } = await mount(); const { lease, interrupted } = acquire(element);
    lease.commit(lease.prepare({}, view(), { kind: 'ease', duration: 100 })); peer.resize(); element.strings = { map: 'Regional map' }; await element.updateComplete;
    expect(interrupted).to.deep.equal([]); peer.fire('movestart'); expect(interrupted).to.deep.equal(['external']); expect(peer.calls.includes('stop')).to.equal(false);
  });
  it('interrupts before a valid external component command and rejects old completion', async () => {
    const { element, peer } = await mount(); const { lease, interrupted, completed } = acquire(element);
    lease.commit(lease.prepare({}, view(), { kind: 'ease', duration: 100 }));
    element.jumpTo({ center: [40, 20] }); await element.updateComplete;
    expect(interrupted).to.deep.equal(['external']); expect(completed).to.deep.equal([]); expect(element.center).to.deep.equal([40, 20]);
    expect(peer.calls.filter(name => name === 'jumpTo' || name === 'easeTo' || name === 'flyTo').at(-1)).to.equal('jumpTo');
  });
  it('cancels valid fits before their camera mutation', async () => {
    const { element } = await mount(); const { lease, interrupted } = acquire(element);
    lease.commit(lease.prepare({}, view(), { kind: 'ease', duration: 100 }));
    expect(element.fitBounds([[0, 0], [10, 10]], { animate: false })).to.equal(true);
    expect(interrupted).to.deep.equal(['external']);
  });
  for (const property of ['mapStyle', 'maxZoom'] as const) {
    it(`rejects reentrant admission before pending ${property} reconciliation`, async () => {
      const { element, peer } = await mount(); let rejected = false;
      const { lease } = acquire(element, { interrupt: () => {
        try { lease.prepare({}, view(70), { kind: 'jump' }); } catch { rejected = true; }
      } });
      if (property === 'mapStyle') element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE };
      else element.maxZoom = 12;
      expect(rejected).to.equal(true); expect(peer.calls.includes('jumpTo')).to.equal(false);
      await element.updateComplete;
    });
  }
  it('refuses session admission while older authored camera commands are queued', async () => {
    const { element, peer } = await mount(); const { lease } = acquire(element);
    element.center = [15, 10];
    expect(element.jumpTo({ center: [25, 20], zoom: 8 })).to.equal(true);
    expect(() => lease.prepare({}, view(70), { kind: 'jump' })).to.throw();
    expect(peer.calls.includes('jumpTo')).to.equal(false);
    await element.updateComplete; await Promise.resolve();
    expect(peer.center).to.deep.equal([25, 20]);
  });
  it('interrupts a replacement tour before its deferred first clock delivery', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    const jobs = new Map<number, () => void>(); let next = 0;
    const clock = createSimulationClock({ range: [0, 100], instant: 0 }, { scheduler: {
      monotonicNow: () => 0, epochNow: () => 0,
      requestFrame(callback) { const id = ++next; jobs.set(id, callback); return id; }, cancelFrame(handle) { jobs.delete(handle as number); },
    } });
    let attached = false;
    const unsubscribe = clock.subscribe(snapshot => {
      if (attached || snapshot.reason !== 'seek') return; attached = true;
      controller.tour(clock, { keyframes: [{ instant: 0, view: view(10) }, { instant: 100, view: view(20) }] });
    });
    try {
      controller.restore(view()); peer.fire('movestart', { originalEvent: new Event('pointerdown') });
      const writes = peer.calls.filter(name => name === 'jumpTo').length;
      clock.seek(25); expect(controller.snapshot).to.include({ mode: 'tour', active: true });
      expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
      peer.fire('movestart', { originalEvent: new Event('pointerdown') });
      expect(controller.snapshot).to.include({ mode: 'idle', active: false, reason: 'user' });
      const pending = [...jobs.values()]; jobs.clear(); pending.forEach(callback => callback());
      expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
    } finally { unsubscribe(); controller.dispose(); clock.dispose(); }
  });
  it('releases disconnected identity permanently and never revives it on reconnect', async () => {
    const { wrapper, element } = await mount(); const { lease, interrupted } = acquire(element);
    const pending = lease.prepare({}, view(), { kind: 'jump' }); element.remove();
    expect(interrupted).to.deep.equal(['disconnect']); expect(lease.current()).to.equal(false); expect(lease.commit(pending)).to.equal(false);
    wrapper.append(element); await waitUntil(() => element.map !== undefined);
    const peer = element.map as unknown as CameraPeer; peer.ready = true; peer.fire('load'); await element.whenStyleReady();
    expect(acquire(element).lease.current()).to.equal(true); expect(lease.current()).to.equal(false);
  });

  it('follows actual accepted scene replacements through missing, clear and same-position reappearance', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    const events: string[] = [];
    element.addEventListener('lr-map-view-change', event => events.push(event.detail.source));
    controller.follow({ objectId: 'target', mode: 'ground', zoom: 6, bearing: 30, pitch: 40 });
    expect(controller.snapshot).to.include({ mode: 'follow', trackingStatus: 'missing', active: false });
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(0);
    element.scene = { objects: [sceneMarker('target', 12)] }; await element.updateComplete;
    expect(controller.capture()).to.deep.equal({ center: [12, 0], zoom: 6, bearing: 30, pitch: 40 });
    expect(controller.snapshot).to.include({ mode: 'follow', trackingStatus: 'ground', active: true });
    expect(element.center).to.deep.equal([12, 0]); expect(element.zoom).to.equal(6);
    element.scene = undefined;
    expect(controller.snapshot).to.include({ trackingStatus: 'missing', active: false });
    element.scene = { objects: [sceneMarker('target', 12)] }; await element.updateComplete;
    expect(controller.snapshot).to.include({ trackingStatus: 'ground', active: true });
    expect(events).to.deep.equal(['command']);
    element.scene = { objects: [sceneMarker('target', 18)] }; await element.updateComplete;
    expect(controller.capture()).to.deep.equal({ center: [18, 0], zoom: 6, bearing: 30, pitch: 40 });
    expect(events).to.deep.equal(['command', 'command']);
    expect(peer.calls.filter(name => name === 'setCenter' || name === 'setZoom')).to.deep.equal([]);
  });

  it('uses accepted model geography without waiting for rendering and ignores source-only updates', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    controller.restore(view());
    const bytes = new Uint8Array([1, 2, 3]);
    const model = { ...sceneModel('asset', { format: 'glb', bytes }),
      position: { lngLat: [8, 4] as [number, number], altitude: 250, altitudeReference: 'terrain' as const } };
    element.scene = { objects: [model] };
    controller.follow({ objectId: 'asset', mode: 'ground' });
    structuredClone(bytes.buffer, { transfer: [bytes.buffer] }); model.position.lngLat[0] = 90;
    await element.updateComplete;
    expect(controller.capture()).to.deep.equal({ center: [8, 4], zoom: 6, bearing: 30, pitch: 40 });
    const writes = peer.calls.filter(name => name === 'jumpTo').length;
    element.scene = { objects: [{ ...sceneModel('asset'), label: 'Replacement source',
      position: { lngLat: [8, 4], altitude: 250, altitudeReference: 'terrain' } }] };
    await element.updateComplete;
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
    const fact = mapSceneSessionAttachment(element)!.target('asset');
    expect(fact.status === 'accepted' && fact.target.position.altitude).to.equal(250);
    expect(fact.status === 'accepted' && fact.target.position.altitudeReference).to.equal('terrain');
    expect(controller.snapshot).to.include({ trackingStatus: 'ground', active: true });
  });

  it('preserves the accepted follow target when a replacement scene is invalid', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [sceneMarker('target', 5)] };
    controller.follow({ objectId: 'target', mode: 'ground' });
    const writes = peer.calls.filter(name => name === 'jumpTo').length;
    element.scene = { objects: [sceneMarker('target', 25), sceneMarker('target', 35)] };
    await element.updateComplete;
    expect(peer.center).to.deep.equal([5, 0]);
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
    expect(controller.snapshot).to.include({ trackingStatus: 'ground', active: true });
    element.scene = { objects: [sceneMarker('target', 15)] }; await element.updateComplete;
    expect(peer.center).to.deep.equal([15, 0]);
  });

  it('rejects a real scene path before stopping an existing camera animation', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [scenePath('route')] };
    controller.restore(view(), { kind: 'ease', duration: 100 });
    expect(() => controller.follow({ objectId: 'route', mode: 'ground' })).to.throw('invalid-follow');
    expect(peer.calls.includes('stop')).to.equal(false); expect(peer.moving).to.equal(true);
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: true });
    peer.finish(); expect(controller.snapshot.reason).to.equal('complete');
  });

  it('keeps a reentrant restore from the follow command event ahead of later scene updates', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [sceneMarker('target', 5)] }; let replaced = false;
    element.addEventListener('lr-map-view-change', event => {
      if (replaced || event.detail.source !== 'command') return;
      replaced = true; controller.restore(view(45));
      element.scene = { objects: [sceneMarker('target', 25)] };
    });
    controller.follow({ objectId: 'target', mode: 'ground' }); await element.updateComplete;
    expect(replaced).to.equal(true); expect(controller.capture()).to.deep.equal(view(45));
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'complete' });
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(2);
    element.scene = { objects: [sceneMarker('target', 35)] }; await element.updateComplete;
    expect(controller.capture()).to.deep.equal(view(45));
  });

  it('retains scene intent across style replacement without automatically resuming follow', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [sceneMarker('target', 5)] };
    const attachment = mapSceneSessionAttachment(element);
    controller.follow({ objectId: 'target', mode: 'ground' });
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Replacement' };
    expect(controller.snapshot).to.include({ active: false, reason: 'style' });
    await element.updateComplete; await element.whenStyleReady();
    const writes = peer.calls.filter(name => name === 'jumpTo').length;
    element.scene = { objects: [sceneMarker('target', 25)] }; await element.updateComplete;
    expect(mapSceneSessionAttachment(element) === attachment).to.equal(true);
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
    controller.follow({ objectId: 'target', mode: 'ground' });
    expect(peer.center).to.deep.equal([25, 0]);
    expect(controller.snapshot).to.include({ trackingStatus: 'ground', active: true });
  });

  it('retires scene-driven follow permanently on disconnect and requires a fresh session on reconnect', async () => {
    const { wrapper, element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [sceneMarker('target', 5)] };
    controller.follow({ objectId: 'target', mode: 'ground' });
    const oldAttachment = mapSceneSessionAttachment(element);
    element.remove(); expect(controller.snapshot.reason).to.equal('disconnect');
    const writes = peer.calls.filter(name => name === 'jumpTo').length;
    element.scene = { objects: [sceneMarker('target', 25)] };
    wrapper.append(element); await waitUntil(() => element.map !== undefined);
    const next = element.map as unknown as CameraPeer;
    next.ready = true; next.fire('load'); await element.whenStyleReady(); await element.updateComplete;
    expect(mapSceneSessionAttachment(element) === oldAttachment).to.equal(false);
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
    expect(next.calls.filter(name => name === 'jumpTo').length).to.equal(0);
    expect(() => controller.follow({ objectId: 'target', mode: 'ground' })).to.throw('disposed');
    const fresh = createMapCameraSessionController(element); fresh.follow({ objectId: 'target', mode: 'ground' });
    expect(next.center).to.deep.equal([25, 0]); expect(fresh.snapshot.active).to.equal(true);
  });

  it('keeps equal controlled camera mirrors but lets unequal intent interrupt scene follow', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [sceneMarker('target', 5)] };
    controller.follow({ objectId: 'target', mode: 'ground', zoom: 6 }); await element.updateComplete;
    element.center = [...element.center]; element.zoom = element.zoom; await element.updateComplete;
    expect(controller.snapshot).to.include({ active: true, trackingStatus: 'ground' });
    element.scene = { objects: [sceneMarker('target', 15)] }; await element.updateComplete;
    expect(peer.center).to.deep.equal([15, 0]);
    element.center = [30, 10]; expect(controller.snapshot).to.include({ active: false, reason: 'external' });
    await element.updateComplete;
    const writes = peer.calls.filter(name => name === 'jumpTo').length;
    element.scene = { objects: [sceneMarker('target', 25)] }; await element.updateComplete;
    expect(peer.center).to.deep.equal([30, 10]);
    expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
    controller.follow({ objectId: 'target', mode: 'ground' });
    expect(element.jumpTo({ center: [40, 20], zoom: 7 })).to.equal(true);
    expect(controller.snapshot).to.include({ active: false, reason: 'external' });
    element.scene = { objects: [sceneMarker('target', 35)] }; await element.updateComplete;
    expect(peer.center).to.deep.equal([40, 20]); expect(peer.zoom).to.equal(7);
  });

  it('disposes the camera and scene connection together when a following map is adopted', async () => {
    const { element, peer } = await mount(); const controller = createMapCameraSessionController(element);
    element.scene = { objects: [sceneMarker('target', 5)] };
    controller.follow({ objectId: 'target', mode: 'ground' });
    const attachment = mapSceneSessionAttachment(element);
    const frame = await fixture<HTMLIFrameElement>(html`<iframe title="Map camera owner document"></iframe>`);
    const targetDocument = frame.contentDocument;
    if (!targetDocument?.body) throw new Error('Expected owner document');
    targetDocument.body.append(targetDocument.adoptNode(element));
    try {
      expect(controller.snapshot).to.include({ active: false, reason: 'disconnect' });
      expect(() => controller.capture()).to.throw('disposed');
      expect(mapSceneSessionAttachment(element) === attachment).to.equal(false);
      expect(attachment?.target('target').status).to.equal('absent');
      const writes = peer.calls.filter(name => name === 'jumpTo').length;
      element.scene = { objects: [sceneMarker('target', 25)] }; await element.updateComplete;
      expect(peer.calls.filter(name => name === 'jumpTo').length).to.equal(writes);
      expect(mapSceneSessionAttachment(element)?.target('target').status).to.equal('accepted');
    } finally { element.remove(); }
  });
});
