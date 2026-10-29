import { expect } from '@open-wc/testing';
import { createSimulationClock } from '../simulation-clock.js';
import { createMapCameraSessionController } from './map-camera-session-controller.js';
import { admitMapViewpoint, type MapViewpoint } from './map-camera-session-data.js';
import { registerMapCameraSession, type MapCameraPreparedCommand, type MapCameraSessionCallbacks,
  type MapCameraSessionLease } from './map-camera-session.js';
import { createMapSceneSessionFacade, registerMapSceneSession } from './map-scene-session.js';
import type { SceneTargetEntry } from './map-scene-contract.js';
import { sceneStateHarness, sceneTarget } from '../../test/map-scene-session-fixtures.js';

const cleanups: (() => void)[] = [];
const view = (zoom = 8): MapViewpoint => ({ center: [1, 2], zoom, bearing: 30, pitch: 40 });
function code(operation: () => unknown, expected: string): void {
  let actual: unknown;
  try { operation(); } catch (error) { actual = (error as { code?: unknown }).code; }
  expect(actual).to.equal(expected);
}
function setup(targets: readonly SceneTargetEntry[] = [sceneTarget('target', 12)], registerScene = true) {
  const host = document.createElement('div'), scene = sceneStateHarness();
  scene.viewport(undefined); scene.set(targets);
  const facade = createMapSceneSessionFacade({ connection: scene.connection });
  expect(facade.bindState(scene.state)).to.equal(true);
  const unregisterScene = registerScene ? registerMapSceneSession(host, facade.attachment) : () => undefined;
  let callbacks!: MapCameraSessionCallbacks;
  let acquired = false, token: object | undefined;
  const receipts = new WeakSet<object>(), preparations: MapCameraPreparedCommand[] = [], writes: MapCameraPreparedCommand[] = [];
  const retirements: { token: object; stop: boolean }[] = [];
  const state = { camera: admitMapViewpoint(view()), reduced: false, nativeReady: true, accept: true,
    acquireCount: 0, releaseCount: 0, synchronous: true, captureCount: 0,
    onCapture: undefined as (() => void) | undefined, onPrepare: undefined as (() => void) | undefined,
    onStart: undefined as (() => void) | undefined, onCommit: undefined as (() => void) | undefined,
    onRetire: undefined as (() => void) | undefined };
  const lease: MapCameraSessionLease = {
    current: () => acquired,
    capture() { state.captureCount++; state.onCapture?.(); return admitMapViewpoint(state.camera); },
    reducedMotion: () => state.reduced,
    start(next) { if (!acquired || !state.nativeReady) return false; token = next; state.onStart?.(); return true; },
    prepare(action, target, transition) {
      if (!state.nativeReady) throw Object.assign(new Error('Camera unavailable'), { code: 'unavailable' });
      const receipt = Object.freeze({ action, view: admitMapViewpoint(target), kind: transition.kind,
        ...(transition.duration === undefined ? {} : { duration: transition.duration }) });
      preparations.push(receipt); receipts.add(receipt); state.onPrepare?.(); return receipt;
    },
    commit(receipt) {
      if (!acquired || !state.accept || token !== receipt.action || !receipts.has(receipt)) return false;
      receipts.delete(receipt); state.camera = receipt.view; writes.push(receipt); state.onCommit?.();
      if (state.synchronous) callbacks.complete(receipt.action);
      return true;
    },
    retire(action, stop) {
      retirements.push({ token: action, stop }); if (token === action) token = undefined; state.onRetire?.();
    },
    release() { if (!acquired) return; acquired = false; token = undefined; state.releaseCount++; },
  };
  const unregisterCamera = registerMapCameraSession(host, { acquire(next) {
    if (acquired) throw Object.assign(new Error('Already bound'), { code: 'already-bound' });
    callbacks = next; acquired = true; state.acquireCount++; return lease;
  } });
  cleanups.push(() => { unregisterCamera(); unregisterScene(); facade.close(); });
  const controller = createMapCameraSessionController(host); cleanups.push(() => controller.dispose());
  return { host, scene, facade, unregisterScene, controller, state, writes, preparations, retirements,
    motion(reduced: boolean) { state.reduced = reduced; callbacks.motion(reduced); },
    interrupt(reason: Parameters<MapCameraSessionCallbacks['interrupt']>[0]) { callbacks.interrupt(reason); },
    complete() { const last = writes.at(-1); if (last) callbacks.complete(last.action); } };
}

// These assertions join the real controller, registered scene facade and follow adapter.
// Native command ownership is modeled here; component/native engine evidence is separate.
describe('camera session ground follow', () => {
  afterEach(() => { for (const release of cleanups.splice(0).reverse()) release(); });

  it('follows accepted geography through the sole camera lease without a frame backend', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' });
    expect(h.state.acquireCount).to.equal(1);
    expect(h.writes.map(command => command.view)).to.deep.equal([{ ...view(), center: [12, 0] }]);
    expect(h.writes[0]!.kind).to.equal('jump');
    expect(h.controller.snapshot).to.deep.equal({ mode: 'follow', active: true, reason: 'start',
      objectId: 'target', followMode: 'ground', trackingStatus: 'ground', corrections: 0 });
    expect(Object.isFrozen(h.controller.snapshot)).to.equal(true);
    expect(h.scene.snapshot.viewport).to.equal(undefined);
  });

  it('discards inert native preflight and prepares the accepted target afresh', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground', zoom: 10 });
    expect(h.preparations.length).to.be.greaterThan(1);
    expect(h.preparations[0]!.view.center).to.deep.equal([1, 2]);
    expect(h.writes.includes(h.preparations[0]!)).to.equal(false);
    expect(h.writes[0]!.view).to.deep.equal({ ...view(10), center: [12, 0] });
  });

  it('keeps synchronous native completion from completing an armed follow', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' }); h.complete();
    h.scene.set([sceneTarget('target', 20, 2)]);
    expect(h.writes.map(command => command.view.center)).to.deep.equal([[12, 0], [20, 0]]);
    expect(h.controller.snapshot).to.include({ mode: 'follow', active: true, trackingStatus: 'ground' });
  });

  it('arms missing targets and delivers clear and fresh same-position reappearance', () => {
    const h = setup([]), observed: string[] = [];
    h.controller.subscribe(snapshot => { if (snapshot.mode === 'follow') observed.push(snapshot.trackingStatus); });
    h.controller.follow({ objectId: 'target', mode: 'ground' });
    expect(h.controller.snapshot).to.include({ active: false, trackingStatus: 'missing' }); expect(h.writes.length).to.equal(0);
    h.scene.set([sceneTarget('target', 12, 1)]); h.scene.set([]); h.scene.set([sceneTarget('target', 12, 2)]);
    expect(observed).to.include('missing'); expect(observed).to.include('ground');
    expect(h.controller.snapshot).to.include({ active: true, trackingStatus: 'ground' });
    expect(h.writes.length).to.equal(1);
    expect(h.writes.every(command => command.view.center[0] === 12)).to.equal(true);
  });

  it('publishes ground to missing and back despite unchanged mode and reason', () => {
    const h = setup(), observed: string[] = [];
    h.controller.follow({ objectId: 'target', mode: 'ground' });
    h.controller.subscribe(snapshot => { if (snapshot.mode === 'follow') observed.push(snapshot.trackingStatus); });
    h.scene.set([]); h.scene.set([sceneTarget('target', 18, 2)]);
    expect(observed).to.deep.equal(['ground', 'missing', 'ground']);
  });

  it('retains exact IDs and authored model altitude independently of ground commands', () => {
    const id = '  object/🌍  ', fact = Object.freeze({ ...sceneTarget(id, -17), kind: 'model' as const,
      position: Object.freeze({ lngLat: Object.freeze([-17, 23] as const), altitude: 500, altitudeReference: 'terrain' as const }) });
    const h = setup([fact]); h.controller.follow({ objectId: id, mode: 'ground' });
    expect(h.writes[0]!.view.center).to.deep.equal([-17, 23]);
    expect(h.facade.attachment.target(id)).to.deep.equal({ status: 'accepted', target: fact });
    expect(h.facade.attachment.target(id.trim())).to.deep.equal({ status: 'absent' });
  });

  it('captures omitted axes once and detaches mutable follow intent', () => {
    const h = setup(), intent = { objectId: 'target', mode: 'ground' as const, zoom: 9 };
    h.controller.follow(intent); const captures = h.state.captureCount; expect(captures).to.equal(1);
    intent.objectId = 'other'; intent.zoom = 15; h.state.camera = view(18);
    h.scene.set([sceneTarget('target', 21, 2)]);
    expect(h.writes.at(-1)!.view).to.deep.equal({ ...view(9), center: [21, 0] });
    expect(h.state.captureCount).to.equal(captures);
  });

  it('does not move for metadata-only accepted revisions', () => {
    const fact = sceneTarget('target', 12), h = setup([fact]); h.controller.follow({ objectId: 'target', mode: 'ground' });
    const before = h.controller.snapshot; h.scene.set([fact]);
    expect(h.writes.length).to.equal(1); expect(h.controller.snapshot).to.equal(before);
  });

  it('rejects accessor and malformed intent without reading getters or retiring a restore', () => {
    const h = setup(); h.state.synchronous = false; h.controller.restore(view(5), { kind: 'ease' });
    let reads = 0; const input = { get objectId() { reads++; return 'target'; }, mode: 'ground' };
    const before = h.controller.snapshot, retired = h.retirements.length;
    code(() => h.controller.follow(input), 'invalid-follow');
    code(() => h.controller.follow({ objectId: '', mode: 'ground' }), 'invalid-follow');
    code(() => h.controller.follow({ objectId: 'target', mode: 'ground', zoom: NaN }), 'invalid-follow');
    expect(reads).to.equal(0); expect(h.controller.snapshot).to.equal(before);
    expect(h.retirements.length).to.equal(retired); expect(h.writes.length).to.equal(1);
  });

  for (const kind of ['path', 'arc'] as const) {
    it(`rejects initial ${kind} before retiring an active restore`, () => {
      const h = setup([Object.freeze({ id: 'target', kind })]); h.state.synchronous = false;
      h.controller.restore(view(5), { kind: 'ease' }); const before = h.controller.snapshot, retired = h.retirements.length;
      code(() => h.controller.follow({ objectId: 'target', mode: 'ground' }), 'invalid-follow');
      expect(h.controller.snapshot).to.equal(before); expect(h.retirements.length).to.equal(retired);
    });
  }

  for (const present of [true, false]) {
    it(`preserves the old animation when native ground preflight refuses a ${present ? 'present' : 'missing'} target`, () => {
      const h = setup(present ? [sceneTarget()] : []); h.state.synchronous = false;
      h.controller.restore(view(5), { kind: 'ease' }); const before = h.controller.snapshot, retired = h.retirements.length;
      h.state.nativeReady = false;
      code(() => h.controller.follow({ objectId: 'target', mode: 'ground' }), 'unavailable');
      expect(h.controller.snapshot).to.equal(before); expect(h.retirements.length).to.equal(retired); expect(h.writes.length).to.equal(1);
    });
  }

  it('refuses visual integration before replacing the existing ground action', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' }); const before = h.controller.snapshot;
    code(() => h.controller.follow({ objectId: 'target', mode: 'geographic-visual' }), 'unavailable');
    expect(h.controller.snapshot).to.equal(before); h.scene.set([sceneTarget('target', 13, 2)]);
    expect(h.writes.length).to.equal(2);
  });

  it('refuses an absent scene registration before retiring the prior action', () => {
    const h = setup([], false); h.state.synchronous = false;
    h.controller.restore(view(5), { kind: 'ease' }); const before = h.controller.snapshot, retired = h.retirements.length;
    code(() => h.controller.follow({ objectId: 'target', mode: 'ground' }), 'unavailable');
    expect(h.controller.snapshot).to.equal(before); expect(h.retirements.length).to.equal(retired);
  });

  it('lets a newer action from native preflight win without follow writes', () => {
    const h = setup(); h.state.onPrepare = () => { h.state.onPrepare = undefined; h.controller.restore(view(16)); };
    h.controller.follow({ objectId: 'target', mode: 'ground' });
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([16]);
    expect(h.controller.snapshot.mode).to.equal('viewpoint');
  });

  it('lets a newer action from camera capture win before native follow admission', () => {
    const h = setup(); h.state.onCapture = () => { h.state.onCapture = undefined; h.controller.restore(view(16)); };
    try { h.controller.follow({ objectId: 'target', mode: 'ground' }); } catch (error) {
      expect((error as { code?: unknown }).code).to.equal('unavailable');
    }
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([16]);
    expect(h.controller.snapshot.mode).to.equal('viewpoint');
  });

  it('honors stop from the start notification before any ground write', () => {
    const h = setup(); h.controller.subscribe(snapshot => {
      if (snapshot.mode === 'follow' && snapshot.reason === 'start') h.controller.stop();
    });
    h.controller.follow({ objectId: 'target', mode: 'ground' }); h.scene.set([sceneTarget('target', 19, 2)]);
    expect(h.writes.length).to.equal(0); expect(h.controller.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'stop' });
  });

  it('honors a new restore during old-action retirement before follow begins', () => {
    const h = setup(); h.state.synchronous = false; h.controller.restore(view(5), { kind: 'ease' });
    h.state.onRetire = () => { h.state.onRetire = undefined; h.controller.restore(view(16)); };
    h.controller.follow({ objectId: 'target', mode: 'ground' });
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([5, 16]);
    expect(h.controller.snapshot.mode).to.equal('viewpoint');
  });

  it('applies reduced motion synchronously during the first command before another target can write', () => {
    const h = setup(); h.state.onCommit = () => {
      h.state.onCommit = undefined; h.motion(true); h.scene.set([sceneTarget('target', 20, 2)]);
    };
    h.controller.follow({ objectId: 'target', mode: 'ground' }); h.motion(false); h.scene.set([sceneTarget('target', 30, 3)]);
    expect(h.writes.map(command => command.view.center)).to.deep.equal([[12, 0]]);
    expect(h.controller.snapshot).to.include({ mode: 'follow', trackingStatus: 'ground', active: true });
  });

  it('retains pre-runner true then false motion and never replenishes its lifetime allowance', () => {
    const h = setup(); h.state.onStart = () => { h.motion(true); h.motion(false); };
    h.controller.follow({ objectId: 'target', mode: 'ground' }); h.scene.set([sceneTarget('target', 20, 2)]);
    expect(h.writes.length).to.equal(1);
    h.controller.follow({ objectId: 'target', mode: 'ground' }); expect(h.writes.length).to.equal(2);
  });

  it('keeps initially reduced ground follow armed after its single permitted write', () => {
    const h = setup(); h.state.reduced = true; h.controller.follow({ objectId: 'target', mode: 'ground' });
    h.scene.set([sceneTarget('target', 20, 2)]); h.motion(false); h.scene.set([sceneTarget('target', 30, 3)]);
    expect(h.writes.length).to.equal(1); expect(h.controller.snapshot).to.include({ trackingStatus: 'ground', active: true });
  });

  for (const reason of ['user', 'external', 'style', 'engine', 'disconnect'] as const) {
    it(`retires follow on ${reason} before subsequent accepted positions`, () => {
      const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' }); h.interrupt(reason);
      h.scene.set([sceneTarget('target', 20, 2)]); expect(h.writes.length).to.equal(1);
      expect(h.controller.snapshot).to.deep.equal({ mode: 'idle', active: false, reason });
      if (reason === 'disconnect') code(() => h.controller.follow({ objectId: 'target', mode: 'ground' }), 'disposed');
    });
  }

  it('stops pending follow and restores exact non-follow snapshot shapes', () => {
    const h = setup([]); h.controller.follow({ objectId: 'target', mode: 'ground' }); h.controller.stop();
    h.scene.set([sceneTarget('target', 20, 2)]); expect(h.writes.length).to.equal(0);
    h.controller.restore(view(6)); expect(h.controller.snapshot).to.deep.equal({ mode: 'viewpoint', active: false, reason: 'complete' });
  });

  it('ends a failed scene-state read during delivery until a new explicit follow is requested', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' });
    h.state.onPrepare = () => { h.state.onPrepare = undefined; h.scene.hooks.captureError = true; };
    h.scene.set([sceneTarget('target', 20, 2)]);
    expect(h.controller.snapshot).to.include({ mode: 'follow', active: false, reason: 'engine',
      trackingStatus: 'unavailable', unavailableReason: 'engine' });
    h.scene.hooks.captureError = false; h.scene.emit(); expect(h.writes.length).to.equal(1);
    h.controller.follow({ objectId: 'target', mode: 'ground' }); expect(h.writes.length).to.equal(2);
  });

  it('ends a refused ground commit and does not auto-resume after native recovery', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' }); h.state.accept = false;
    h.scene.set([sceneTarget('target', 20, 2)]);
    expect(h.controller.snapshot).to.include({ active: false, reason: 'engine', trackingStatus: 'unavailable', unavailableReason: 'engine' });
    h.state.accept = true; h.scene.set([sceneTarget('target', 30, 3)]); expect(h.writes.length).to.equal(1);
  });

  it('replaces a tour without changing the application clock and retires follow for a new tour', () => {
    const h = setup(), clock = createSimulationClock({ range: [0, 100], instant: 20 });
    cleanups.push(() => clock.dispose()); const tour = { keyframes: [{ instant: 0, view: view(4) }, { instant: 100, view: view(14) }] };
    h.controller.tour(clock, tour); const before = clock.snapshot;
    h.controller.follow({ objectId: 'target', mode: 'ground' }); expect(clock.snapshot).to.equal(before);
    const count = h.writes.length; clock.seek(50); expect(h.writes.length).to.equal(count);
    h.controller.tour(clock, tour); const after = h.writes.length;
    h.scene.set([sceneTarget('target', 20, 2)]); expect(h.writes.length).to.equal(after);
    expect(h.controller.snapshot).to.deep.equal({ mode: 'tour', active: true, reason: 'start' });
  });

  it('disposes idempotently and prevents any later scene delivery', () => {
    const h = setup(); h.controller.follow({ objectId: 'target', mode: 'ground' });
    h.controller.dispose(); h.controller.dispose(); h.scene.set([sceneTarget('target', 20, 2)]);
    expect(h.writes.length).to.equal(1); expect(h.state.releaseCount).to.equal(1);
    code(() => h.controller.follow({ objectId: 'target', mode: 'ground' }), 'disposed');
  });
});
