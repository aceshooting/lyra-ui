import { expect, fixtureCleanup } from '@open-wc/testing';
import { createMapCameraSession, MapCameraSessionError, type MapCameraSession, type MapCameraSessionSnapshot,
  type MapCameraTour, type MapViewpoint } from './map-camera-session.js';
import * as root from './lyra.js';
import { createSimulationClock, type ClockScheduler, type SimulationClock } from './simulation-clock.js';
import type { LyraMap, LyraMapCameraInterruptDetail } from './components/media/map/map.class.js';
import { LYRA_MAP_EMPTY_STYLE } from './components/media/map/map.js';
import { loadMapControlRuntime, loadMapOwnedFeatureRuntime } from './components/media/map/map-feature-loader.js';
import { installCameraPeerEnvironment, mountCameraPeerMap, reconnectCameraPeerMap, type CameraPeer } from '../test/map-camera-peer.js';
import { sceneMarker, scenePath } from '../test/map-scene-admission-fixtures.js';

const view = (longitude = 12, zoom = 6): MapViewpoint => ({ center: [longitude, 5], zoom, bearing: 30, pitch: 40 });
const tour: MapCameraTour = { keyframes: [{ instant: 0, view: view(0, 2) }, { instant: 100, view: view(10, 4) }] };
const releases: (() => void)[] = [];
function clock(): SimulationClock {
  let next = 0;
  const jobs = new Map<number, () => void>();
  const scheduler: ClockScheduler = {
    monotonicNow: () => 0, epochNow: () => 0,
    requestFrame(callback) { const id = ++next; jobs.set(id, callback); return id; },
    cancelFrame(handle) { jobs.delete(handle as number); },
  };
  const value = createSimulationClock({ range: [0, 100], instant: 0 }, { scheduler });
  releases.push(() => value.dispose());
  return value;
}
function session(element: HTMLElement): MapCameraSession {
  const value = createMapCameraSession(element); releases.push(() => value.dispose()); return value;
}
function errorCode(operation: () => unknown): string | undefined {
  try { operation(); } catch (error) { return error instanceof MapCameraSessionError ? error.code : 'foreign'; }
  return undefined;
}
function interrupts(element: LyraMap): { reasons: string[]; flags: string[] } {
  const reasons: string[] = [], flags: string[] = [];
  element.addEventListener('lr-map-camera-interrupt', (event: CustomEvent<LyraMapCameraInterruptDetail>) => {
    reasons.push(event.detail.reason);
    flags.push(`${event.bubbles}/${event.composed}/${event.cancelable}/${Object.isFrozen(event.detail)}`);
  });
  return { reasons, flags };
}
const jumps = (peer: CameraPeer): number => peer.calls.filter(name => name === 'jumpTo').length;
const gesture = (peer: CameraPeer): void => { peer.fire('movestart', { originalEvent: new Event('pointerdown') }); };

describe('createMapCameraSession', () => {
  let restoreEnvironment: () => void;
  before(async () => { await loadMapOwnedFeatureRuntime(); await loadMapControlRuntime(); });
  beforeEach(() => { restoreEnvironment = installCameraPeerEnvironment(); });
  afterEach(() => {
    for (const release of releases.splice(0).reverse()) release();
    fixtureCleanup(); restoreEnvironment();
  });

  it('is published from its granular entry and the root barrel', () => {
    expect(root.createMapCameraSession).to.equal(createMapCameraSession);
    expect(root.MapCameraSessionError).to.equal(MapCameraSessionError);
  });

  it('rejects hosts that are not a ready lr-map with typed error codes', async () => {
    const plain = document.createElement('div'); document.body.append(plain);
    expect(errorCode(() => createMapCameraSession(plain))).to.equal('unsupported-map');
    plain.remove();
    expect(errorCode(() => createMapCameraSession(plain))).to.equal('inactive-map');
    const { element } = await mountCameraPeerMap();
    const first = session(element);
    expect(errorCode(() => createMapCameraSession(element))).to.equal('already-bound');
    first.dispose();
    element.remove();
    expect(errorCode(() => createMapCameraSession(element))).to.equal('inactive-map');
    const error = new MapCameraSessionError('disposed');
    expect(error.name).to.equal('MapCameraSessionError'); expect(error.code).to.equal('disposed');
  });

  it('saves and restores a detached viewpoint, animating only when motion is allowed', async () => {
    const { element, peer } = await mountCameraPeerMap();
    const camera = session(element), events = interrupts(element);
    camera.restore(view(12));
    const saved = camera.capture();
    expect(saved).to.deep.equal(view(12)); expect(Object.isFrozen(saved) && Object.isFrozen(saved.center)).to.equal(true);
    camera.restore(view(40), { kind: 'fly', duration: 500 });
    expect(peer.calls.at(-1)).to.equal('flyTo');
    expect(camera.snapshot).to.include({ mode: 'viewpoint', active: true, reason: 'start' });
    peer.finish();
    expect(camera.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'complete' });
    camera.restore(saved);
    expect(camera.capture()).to.deep.equal(saved);
    expect(events.reasons).to.deep.equal([]);
  });

  it('jumps instead of animating a restore under reduced motion', async () => {
    const { element, peer } = await mountCameraPeerMap('reduce');
    const camera = session(element);
    camera.restore(view(40), { kind: 'fly', duration: 500 });
    expect(peer.calls.filter(name => name === 'flyTo' || name === 'easeTo')).to.deep.equal([]);
    expect(peer.calls.at(-1)).to.equal('jumpTo');
    expect(camera.capture()).to.deep.equal(view(40));
    expect(camera.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'complete' });
  });

  it('interpolates a clock-driven tour and holds keyframes under reduced motion', async () => {
    for (const motion of ['system', 'reduce'] as const) {
      const { element } = await mountCameraPeerMap(motion);
      const camera = session(element), shared = clock();
      camera.tour(shared, tour);
      expect(camera.snapshot).to.include({ mode: 'tour', active: true });
      shared.seek(50);
      const expected = motion === 'system' ? { center: [5, 5], zoom: 3 } : { center: [0, 5], zoom: 2 };
      expect(camera.capture()).to.include({ zoom: expected.zoom });
      expect(camera.capture().center).to.deep.equal(expected.center);
      shared.seek(100);
      expect(camera.capture()).to.deep.equal(view(10, 4));
      fixtureCleanup();
    }
  });

  it('reports a user gesture that interrupts a tour and leaves the camera to the gesture', async () => {
    const { element, peer } = await mountCameraPeerMap();
    const camera = session(element), shared = clock(), events = interrupts(element);
    const snapshots: MapCameraSessionSnapshot[] = [];
    camera.subscribe(snapshot => snapshots.push(snapshot));
    camera.tour(shared, tour); shared.seek(25);
    const writes = jumps(peer);
    gesture(peer);
    expect(events.reasons).to.deep.equal(['user']);
    expect(events.flags).to.deep.equal(['true/true/false/true']);
    expect(camera.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'user' });
    expect(peer.calls.includes('stop')).to.equal(false);
    shared.seek(75);
    expect(jumps(peer)).to.equal(writes);
    expect(snapshots.map(snapshot => `${snapshot.mode}:${snapshot.reason}`))
      .to.deep.equal(['idle:initial', 'tour:start', 'idle:user']);
    gesture(peer);
    expect(events.reasons).to.deep.equal(['user']);
  });

  it('reports external commands and style changes, but not replacement or stop', async () => {
    const { element, peer } = await mountCameraPeerMap();
    const camera = session(element), events = interrupts(element);
    element.scene = { objects: [sceneMarker('relay', 5)] };
    camera.follow({ objectId: 'relay', mode: 'ground', zoom: 6 });
    expect(camera.snapshot).to.include({ mode: 'follow', trackingStatus: 'ground', active: true });
    camera.restore(view(20));
    camera.tour(clock(), tour);
    camera.stop();
    expect(events.reasons).to.deep.equal([]);
    camera.follow({ objectId: 'relay', mode: 'ground' });
    expect(element.jumpTo({ center: [40, 20] })).to.equal(true);
    expect(events.reasons).to.deep.equal(['external']);
    camera.restore(view(20), { kind: 'ease', duration: 200 });
    element.mapStyle = { ...LYRA_MAP_EMPTY_STYLE, name: 'Replacement' };
    expect(events.reasons).to.deep.equal(['external', 'style']);
    expect(peer.calls.at(-1)).to.equal('stop');
    await element.updateComplete;
  });

  it('follows an application-moved scene object and stays put under reduced motion', async () => {
    for (const motion of ['system', 'reduce'] as const) {
      const { element, peer } = await mountCameraPeerMap(motion);
      const camera = session(element);
      element.scene = { objects: [sceneMarker('relay', 5)] };
      camera.follow({ objectId: 'relay', mode: 'ground', zoom: 6 });
      expect(peer.center).to.deep.equal([5, 0]);
      element.scene = { objects: [sceneMarker('relay', 15)] }; await element.updateComplete;
      expect(peer.center).to.deep.equal(motion === 'system' ? [15, 0] : [5, 0]);
      expect(camera.snapshot).to.include({ mode: 'follow', trackingStatus: 'ground' });
      fixtureCleanup();
    }
  });

  it('rejects invalid input without disturbing the running action', async () => {
    const { element, peer } = await mountCameraPeerMap();
    const camera = session(element), shared = clock();
    element.scene = { objects: [scenePath('route')] };
    camera.restore(view(30), { kind: 'ease', duration: 100 });
    const invalid: [string, () => void][] = [
      ['invalid-viewpoint', () => camera.restore({ ...view(), zoom: Number.NaN })],
      ['invalid-viewpoint', () => camera.restore({ ...view(), pitch: 90 })],
      ['invalid-options', () => camera.restore(view(), { duration: -1 })],
      ['invalid-options', () => camera.restore(view(), { duration: Number.POSITIVE_INFINITY })],
      ['invalid-tour', () => camera.tour(shared, { keyframes: [{ instant: 100, view: view() }, { instant: 0, view: view() }] })],
      ['invalid-tour', () => camera.tour(shared, { keyframes: [] })],
      ['invalid-clock', () => camera.tour({} as SimulationClock, tour)],
      ['invalid-follow', () => camera.follow({ objectId: '', mode: 'ground' })],
      ['invalid-follow', () => camera.follow({ objectId: 'route', mode: 'ground' })],
    ];
    expect(invalid.map(([, operation]) => errorCode(operation))).to.deep.equal(invalid.map(([code]) => code));
    expect(peer.calls.includes('stop')).to.equal(false);
    expect(camera.snapshot).to.include({ mode: 'viewpoint', active: true });
    peer.finish();
    expect(camera.snapshot).to.include({ mode: 'viewpoint', reason: 'complete' });
  });

  it('disposes on disconnect without an event and requires a fresh session after reconnect', async () => {
    const { wrapper, element, peer } = await mountCameraPeerMap();
    const camera = session(element), shared = clock(), events = interrupts(element);
    camera.tour(shared, tour);
    element.remove();
    expect(camera.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'disconnect' });
    expect(errorCode(() => camera.capture())).to.equal('disposed');
    const writes = jumps(peer); shared.seek(60);
    const next = await reconnectCameraPeerMap(wrapper, element);
    expect(jumps(peer)).to.equal(writes); expect(jumps(next)).to.equal(0);
    expect(events.reasons).to.deep.equal([]);
    const fresh = session(element);
    fresh.restore(view(22));
    expect(fresh.capture()).to.deep.equal(view(22));
  });

  it('disposes through an abort signal, dispose() and listener release idempotently', async () => {
    const { element } = await mountCameraPeerMap();
    const controller = new AbortController();
    const camera = createMapCameraSession(element, { signal: controller.signal });
    const seen: string[] = [];
    const release = camera.subscribe(snapshot => seen.push(snapshot.reason));
    controller.abort();
    expect(camera.snapshot.reason).to.equal('disposed');
    expect(errorCode(() => camera.restore(view()))).to.equal('disposed');
    camera.dispose(); release(); release();
    expect(seen).to.deep.equal(['initial', 'disposed']);
    const next = session(element);
    expect(next.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'initial' });
  });

  it('lets an interrupt listener start a newer action', async () => {
    const { element, peer } = await mountCameraPeerMap();
    const camera = session(element);
    element.addEventListener('lr-map-camera-interrupt', () => { camera.restore(view(50)); }, { once: true });
    camera.tour(clock(), tour);
    gesture(peer);
    expect(camera.capture()).to.deep.equal(view(50));
    expect(camera.snapshot).to.include({ mode: 'viewpoint', reason: 'complete' });
  });

  it('emits no camera interrupt for gestures or commands on a map without a session', async () => {
    const { element, peer } = await mountCameraPeerMap();
    const events = interrupts(element);
    gesture(peer);
    expect(element.jumpTo({ center: [20, 10] })).to.equal(true);
    element.center = [30, 10]; await element.updateComplete;
    const camera = session(element);
    gesture(peer); camera.dispose();
    expect(events.reasons).to.deep.equal([]);
  });
});
