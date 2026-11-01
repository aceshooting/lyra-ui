import { expect } from '@open-wc/testing';
import { createMapCameraFollowScene } from './map-camera-follow-scene.js';
import { createMapSceneSessionFacade } from './map-scene-session.js';
import { admitMapCameraFollowProfile } from './map-camera-follow-data.js';
import { prepareMapCameraFollow, startMapCameraFollow } from './map-camera-follow-controller.js';
import type { MapCameraFollowFrame, MapCameraFollowNotice, MapCameraFollowOwner,
  MapCameraFollowScene } from './map-camera-follow-controller.js';
import type { MapViewpoint } from './map-camera-session-data.js';
import type { MapSceneSessionAttachment, SceneTargetFact, SceneTargetProjection } from './map-scene-contract.js';
import { sceneBackingHarness, sceneStateHarness, sceneTarget, sceneViewport } from '../../test/map-scene-session-fixtures.js';

const cleanups: (() => void)[] = [];
function setup(ready = true, fact = sceneTarget()) {
  const h = sceneStateHarness(); h.set([fact]);
  const facade = createMapSceneSessionFacade({ connection: h.connection });
  const b = sceneBackingHarness(h);
  cleanups.push(() => facade.close());
  if (ready) { facade.bindState(h.state); facade.promote(b.backing); }
  const scene: MapCameraFollowScene = createMapCameraFollowScene(facade.attachment);
  return { h, fact, facade, b, scene };
}
function frames(scene: MapCameraFollowScene, objectId = 'target') {
  const values: MapCameraFollowFrame[] = [];
  cleanups.push(scene.subscribeFrames(objectId, value => values.push(value)));
  return values;
}
function latest(values: readonly MapCameraFollowFrame[]): MapCameraFollowFrame {
  const value = values[values.length - 1];
  if (!value) throw new Error('Expected a completed follow observation');
  return value;
}
function visible(revision: number, offset = 20): SceneTargetProjection {
  return Object.freeze({ acceptedPositionRevision: revision, status: 'resolved', visible: true,
    point: Object.freeze([320 + offset, 240] as const) });
}
function runnerHarness(scene: MapCameraFollowScene, mode: 'ground' | 'geographic-visual' = 'geographic-visual', reduced = false) {
  const ground: MapViewpoint[] = [], pans: (readonly [number, number])[] = [];
  const preparedPans = new WeakMap<object, readonly [number, number]>();
  const preparedGround = new WeakMap<object, MapViewpoint>();
  const state: { current: boolean; onPrepare?: () => void; onGroundPrepare?: () => void } = { current: true };
  const owner: MapCameraFollowOwner = {
    current: () => state.current,
    prepareGround(view) { const receipt = Object.freeze({}); preparedGround.set(receipt, view); state.onGroundPrepare?.(); return receipt; },
    commitGround(receipt) {
      const view = preparedGround.get(receipt); if (!view) throw new Error('Unknown ground receipt');
      ground.push(view); return true;
    },
    preparePan(offset) { const receipt = Object.freeze({}); preparedPans.set(receipt, offset); state.onPrepare?.(); return receipt; },
    commitPan(receipt) {
      const offset = preparedPans.get(receipt); if (!offset) throw new Error('Unknown pan receipt');
      pans.push(offset); return true;
    },
    publish() {},
  };
  const start = () => {
    const plan = prepareMapCameraFollow({ objectId: 'target', mode }, { current: () => state.current,
      capture: () => ({ center: [1, 2], zoom: 8, bearing: 30, pitch: 40 }), reducedMotion: () => reduced, scene });
    const runner = startMapCameraFollow(plan, owner); cleanups.push(() => runner.dispose()); return runner;
  };
  return { start, state, ground, pans };
}

describe('camera follow adapter for completed scene facts', () => {
  afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

  it('constructs without subscriptions, demand, state binding or frame work', () => {
    const { h, b, scene } = setup(false);
    expect(scene.target('target')).to.deep.equal({ kind: 'absent' });
    expect(h.subscriptions).to.equal(0); expect(b.subscriptions).to.equal(0);
    expect(b.acquired).to.deep.equal([]); expect(b.requests).to.equal(0); expect(b.projects).to.equal(0);
  });

  it('maps exact model IDs and authored altitude while asset and terrain placement remain independent', () => {
    const id = '  station/🌍  ';
    const fact: SceneTargetFact = Object.freeze({ ...sceneTarget(id, 17, 4), kind: 'model',
      position: Object.freeze({ lngLat: Object.freeze([17, 23] as const), altitude: -150, altitudeReference: 'terrain' }) });
    const { scene, b } = setup(true, fact);
    expect(scene.target(id)).to.deep.equal({ kind: 'eligible', objectKind: 'model', positionRevision: 4,
      center: [17, 23], altitude: -150, altitudeReference: 'terrain' });
    expect(scene.target(id.trim())).to.deep.equal({ kind: 'absent' });
    expect(b.projects).to.equal(0); expect(b.acquired).to.deep.equal([]);
  });

  it('distinguishes missing targets from both unsupported object kinds', () => {
    const { h, scene } = setup();
    h.set([Object.freeze({ id: 'route', kind: 'path' }), Object.freeze({ id: 'arc', kind: 'arc' })]);
    expect(scene.target('target')).to.deep.equal({ kind: 'absent' });
    expect(scene.target('route')).to.deep.equal({ kind: 'unsupported', objectKind: 'path' });
    expect(scene.target('arc')).to.deep.equal({ kind: 'unsupported', objectKind: 'arc' });
  });

  it('returns a detached immutable target value without replacing the authoritative fact', () => {
    const { fact, scene, facade } = setup();
    const value = scene.target('target');
    if (value.kind !== 'eligible') throw new Error('Expected eligible target');
    expect(Object.isFrozen(value)).to.equal(true); expect(Object.isFrozen(value.center)).to.equal(true);
    expect(value.center === fact.position.lngLat).to.equal(false);
    const source = facade.attachment.target('target');
    expect(source.status === 'accepted' && source.target === fact).to.equal(true);
  });

  it('combines target and allocation subscriptions without losing held-load promotion notices', () => {
    const { h, facade, b, scene } = setup(false); const notices: MapCameraFollowNotice[] = [];
    const release = scene.subscribeTargets(notice => notices.push(notice)); cleanups.push(release);
    facade.bindState(h.state); facade.promote(b.backing);
    expect(notices.filter(notice => notice.kind === 'target')).to.deep.equal([{ kind: 'target', objectId: 'target' }]);
    expect(notices.filter(notice => notice.kind === 'viewport')).to.deep.equal([{ kind: 'viewport', revision: 1 }]);
    release(); release(); h.set([sceneTarget('target', 3, 2)]); h.viewport(sceneViewport(2, 800));
    expect(notices.length).to.equal(2);
  });

  it('does not translate accepted metadata or sampling-frame changes into reset notices', () => {
    const { h, fact, scene, b } = setup(); const notices: MapCameraFollowNotice[] = [];
    cleanups.push(scene.subscribeTargets(notice => notices.push(notice)));
    h.set([fact], { registryRevision: h.snapshot.registryRevision });
    b.emit(b.frame(1, {}, { samplingViewRevision: 8, paintRevision: 9, placementRevision: 10 }));
    expect(notices).to.deep.equal([]);
    h.viewport(sceneViewport(2, 800));
    expect(notices).to.deep.equal([{ kind: 'viewport', revision: 2 }]);
  });

  it('retains target subscriptions through clear and fresh same-position reappearance', () => {
    const { h, scene } = setup(); const observed: string[] = [];
    cleanups.push(scene.subscribeTargets(notice => {
      if (notice.kind !== 'target') return;
      const value = scene.target(notice.objectId);
      observed.push(value.kind === 'eligible' ? `eligible:${value.positionRevision}` : value.kind);
    }));
    h.set([]); h.set([sceneTarget('target', 0, 3)]);
    expect(observed).to.deep.equal(['absent', 'eligible:3']);
  });

  it('releases the first observer when installing the allocation observer throws', () => {
    const { h, facade } = setup(); let released = 0, delivered = 0;
    const source: MapSceneSessionAttachment = { ...facade.attachment,
      subscribeTargets(listener) {
        const release = facade.attachment.subscribeTargets(listener);
        return () => { released++; release(); };
      },
      subscribeViewport() { throw new Error('Allocation observer unavailable'); },
    };
    const scene = createMapCameraFollowScene(source);
    expect(() => scene.subscribeTargets(() => delivered++)).to.throw();
    h.set([sceneTarget('target', 2, 2)]);
    expect(released).to.equal(1); expect(delivered).to.equal(0);
  });

  it('continues independent observer cleanup when one release throws', () => {
    const { facade } = setup(); let targets = 0, allocations = 0;
    const source: MapSceneSessionAttachment = { ...facade.attachment,
      subscribeTargets() { return () => { targets++; throw new Error('Release failed'); }; },
      subscribeViewport() { return () => { allocations++; }; },
    };
    const release = createMapCameraFollowScene(source).subscribeTargets(() => {});
    try { release(); } catch { /* Both independently acquired handles must still retire. */ }
    try { release(); } catch { /* An idempotent release does not retry either handle. */ }
    expect(targets).to.equal(1); expect(allocations).to.equal(1);
  });

  it('stops a multi-ID notice after its subscription is released reentrantly', () => {
    const { h, scene } = setup(); const ids: string[] = [];
    let release = () => {};
    release = scene.subscribeTargets(notice => { if (notice.kind === 'target') { ids.push(notice.objectId); release(); } });
    cleanups.push(release);
    h.set([sceneTarget('target', 1, 2), sceneTarget('other', 2, 3)]);
    expect(ids).to.deep.equal(['target']);
  });

  it('preserves pre-load demand and releases it exactly once after promotion', () => {
    const { h, facade, b, scene } = setup(false);
    const release = scene.watchTarget('target'); cleanups.push(release);
    scene.requestFrame('target'); scene.requestFrame('target');
    expect(b.acquired).to.deep.equal([]); expect(b.requests).to.equal(0);
    facade.bindState(h.state); facade.promote(b.backing);
    expect(b.acquired).to.deep.equal(['target']); expect(b.requests).to.equal(1);
    release(); release(); expect(b.retired).to.deep.equal(['target']);
  });

  it('does not resurrect a watch released before promotion or own the facade lifetime', () => {
    const { h, facade, b, scene } = setup(false);
    const release = scene.watchTarget('target'); release(); release();
    const stopFrames = scene.subscribeFrames('target', () => {}); stopFrames(); stopFrames();
    facade.bindState(h.state); facade.promote(b.backing);
    expect(b.acquired).to.deep.equal([]); expect(scene.target('target').kind).to.equal('eligible');
    expect(h.releases).to.equal(0); expect(b.releases).to.equal(0);
  });

  it('maps completed issue serial, CSS dimensions and a detached visible point', () => {
    const { scene, b } = setup(); const received = frames(scene);
    b.setProjection(visible(1)); const original = b.frame(41); b.emit(original);
    const value = latest(received);
    expect(value.serial).to.equal(41); expect([value.width, value.height]).to.deep.equal([640, 480]);
    expect(value.result).to.deep.equal({ status: 'visible', point: [340, 240] });
    expect(Object.isFrozen(value)).to.equal(true); expect(Object.isFrozen(value.stamp)).to.equal(true);
    expect(Object.isFrozen(value.result)).to.equal(true);
    if (value.result.status === 'visible') expect(Object.isFrozen(value.result.point)).to.equal(true);
    expect(b.projectArguments.length).to.be.greaterThan(0);
    expect(b.projectArguments.every(argument => argument.frame === original && argument.id === 'target')).to.equal(true);
  });

  it('uses the unrounded native control helper without leaking extra keys into the strict profile', () => {
    const { scene, b } = setup(); const received = frames(scene);
    const source = b.frame(1);
    if (!source.cameraProfile) throw new Error('Expected fixture camera profile');
    const original = b.frame(1, { projectionTransition: 0,
      cameraProfile: Object.freeze({ ...source.cameraProfile, latitude: 60, zoom: 20, nativeControlTransition: Number.MIN_VALUE }) });
    b.emit(original); const positive = latest(received);
    expect(admitMapCameraFollowProfile(positive.profile)).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
    expect((positive.profile as Record<string, unknown>)['projectionTransition']).to.equal(Number.MIN_VALUE);
    expect(Object.hasOwn(positive.profile as object, 'nativeControlTransition')).to.equal(false);
    b.emit(b.frame(2, { projectionTransition: 0,
      cameraProfile: Object.freeze({ ...source.cameraProfile, latitude: 60, zoom: 20, nativeControlTransition: 0 }) }));
    expect(admitMapCameraFollowProfile(latest(received).profile)).to.deep.equal({ status: 'admitted', helper: 'mercator' });
  });

  it('keeps unavailable camera facts explicit instead of deriving them from shader zero', () => {
    const { scene, b } = setup(); const received = frames(scene);
    b.emit(b.frame(1, { cameraProfile: undefined, projectionTransition: 0 }));
    const value = latest(received);
    expect(value.profile).to.equal(undefined);
    expect(admitMapCameraFollowProfile(value.profile)).to.deep.equal({ status: 'unavailable', reason: 'camera-domain' });
  });

  it('maps every pending and nonvisible result without manufacturing visible points', () => {
    const { scene, b } = setup(); const received = frames(scene);
    const cases = [
      ['terrain-pending', 'pending'], ['model-pending', 'pending'], ['visibility-pending', 'pending'],
      ['terrain-unavailable', 'unavailable'], ['clipped', 'clipped'], ['occluded', 'occluded'], ['unavailable', 'unavailable'],
    ] as const;
    for (const [index, [status, expected]] of cases.entries()) {
      b.setProjection(Object.freeze({ acceptedPositionRevision: 1, status, visible: false })); b.emit(b.frame(index + 1));
      expect(latest(received).result).to.deep.equal({ status: expected });
    }
    expect(received.length).to.equal(cases.length);
  });

  it('requires resolved and visible together and refuses an unavailable projection', () => {
    const { facade, b } = setup(); const normal = createMapCameraFollowScene(facade.attachment);
    const received = frames(normal);
    b.setProjection(Object.freeze({ acceptedPositionRevision: 1, status: 'resolved', visible: false, point: [10, 20] as const }));
    b.emit(b.frame(1)); expect(latest(received).result).to.deep.equal({ status: 'unavailable' });
    const unavailable = createMapCameraFollowScene({ ...facade.attachment, projectTarget: () => undefined });
    const missing = frames(unavailable); b.emit(b.frame(2));
    expect(latest(missing).result).to.deep.equal({ status: 'unavailable' });
  });

  it('never converts malformed or missing resolved points into visible observations', () => {
    const { scene, b } = setup(); const received = frames(scene);
    const points = [undefined, [NaN, 240], [340, Infinity], [340], [340, 240, 1]];
    for (const [index, point] of points.entries()) {
      b.setProjection({ acceptedPositionRevision: 1, status: 'resolved', visible: true,
        ...(point === undefined ? {} : { point }) } as unknown as SceneTargetProjection);
      b.emit(b.frame(index + 1));
      expect(latest(received).result).to.deep.equal({ status: 'unavailable' });
    }
    expect(received.length).to.equal(points.length);
  });

  it('returns the exact original frame and target receipts when checking a detached stamp', () => {
    const { fact, scene, b, facade } = setup(); const received = frames(scene);
    const original = b.frame(8, {}, { layoutRevision: 7, paintRevision: 11, placementRevision: 13 }); b.emit(original);
    const stamp = latest(received).stamp; b.currentArguments.length = 0;
    expect(scene.current(stamp)).to.equal(true); expect(b.currentArguments.length).to.be.greaterThan(0);
    expect(b.currentArguments.every(argument => argument.frame === original && argument.target === fact)).to.equal(true);
    expect(scene.current({ ...stamp })).to.equal(false);
    expect(createMapCameraFollowScene(facade.attachment).current(stamp)).to.equal(false);
  });

  it('rejects a previously delivered stamp after metadata-only accepted authority changes', () => {
    const { h, fact, scene, b } = setup(); const received = frames(scene); const notices: MapCameraFollowNotice[] = [];
    cleanups.push(scene.subscribeTargets(notice => notices.push(notice)));
    b.emit(b.frame(1)); const old = latest(received).stamp;
    h.set([fact], { registryRevision: h.snapshot.registryRevision, notify: false });
    expect(scene.current(old)).to.equal(false); h.emit(); expect(notices).to.deep.equal([]);
    b.emit(b.frame(2)); expect(scene.current(latest(received).stamp)).to.equal(true);
  });

  it('does not publish an old-target projection after a same-action target replacement during projection', () => {
    const { h, scene, b } = setup(); const received = frames(scene);
    b.hooks.project = () => { b.hooks.project = undefined; h.set([sceneTarget('target', 8, 2)]); };
    b.emit(b.frame(1)); expect(received.length).to.equal(0);
    b.emit(b.frame(2)); expect(latest(received).stamp.position).to.equal(2);
  });

  it('stops in-flight frame delivery when projection reenters unsubscribe or connection close', () => {
    for (const interruption of ['unsubscribe', 'close'] as const) {
      const { facade, scene, b } = setup(); const received: MapCameraFollowFrame[] = [];
      const release = scene.subscribeFrames('target', frame => received.push(frame)); cleanups.push(release);
      b.hooks.project = () => {
        b.hooks.project = undefined;
        if (interruption === 'unsubscribe') release(); else facade.close();
      };
      b.emit(b.frame(1)); expect(received.length).to.equal(0);
      b.emit(b.frame(2)); expect(received.length).to.equal(0);
    }
  });

  it('invalidates original stamps across frame-backing replacement without target movement', () => {
    const { h, facade, scene, b } = setup(); const received = frames(scene);
    b.emit(b.frame(1)); const old = latest(received).stamp;
    const replacement = sceneBackingHarness(h); facade.promote(replacement.backing);
    expect(scene.current(old)).to.equal(false); b.listenerHistory[0]?.(b.frame(2));
    expect(received.length).to.equal(1);
    replacement.emit(replacement.frame(3)); expect(scene.current(latest(received).stamp)).to.equal(true);
  });

  it('does not deliver after frame unsubscribe or close and rejects closed-frame stamps', () => {
    const { facade, scene, b } = setup(); const received: MapCameraFollowFrame[] = [];
    const release = scene.subscribeFrames('target', frame => received.push(frame)); cleanups.push(release);
    b.emit(b.frame(1)); const stamp = latest(received).stamp;
    release(); release(); b.emit(b.frame(2)); expect(received.length).to.equal(1);
    facade.close(); expect(scene.current(stamp)).to.equal(false); b.listenerHistory[0]?.(b.frame(3));
    expect(received.length).to.equal(1);
  });

  it('does not turn frame or profile allocation mismatches into follow observations', () => {
    const { scene, b } = setup(); const received = frames(scene); const original = b.frame(1);
    if (!original.cameraProfile) throw new Error('Expected fixture camera profile');
    b.emit(b.frame(1, { width: 800 }));
    b.emit(b.frame(2, { cameraProfile: Object.freeze({ ...original.cameraProfile, width: 800 }) }));
    expect(received.length).to.equal(0);
    b.emit(b.frame(3)); expect(received.length).to.equal(1);
  });

  it('keeps ground follow on authoritative accepted intent through frame installation failure', () => {
    const { h, facade, scene, b } = setup(); const owner = runnerHarness(scene, 'ground'); const runner = owner.start();
    const replacement = sceneBackingHarness(h);
    replacement.hooks.subscribe = () => { h.set([sceneTarget('target', 12, 2)]); throw new Error('Frame unavailable'); };
    expect(facade.promote(replacement.backing)).to.equal(false);
    expect(owner.ground.map(view => view.center)).to.deep.equal([[0, 0], [12, 0]]);
    expect(runner.snapshot.status).to.equal('ground'); expect(b.acquired).to.deep.equal([]);
    expect(b.projects).to.equal(0); expect(owner.pans).to.deep.equal([]);
  });

  it('arms visual follow before held promotion and corrects only a completed eligible observation', () => {
    const { h, facade, scene, b } = setup(false); const owner = runnerHarness(scene); const runner = owner.start();
    expect(runner.snapshot.status).to.equal('missing'); expect(owner.pans).to.deep.equal([]);
    facade.bindState(h.state); facade.promote(b.backing);
    expect(owner.ground).to.deep.equal([]); expect(owner.pans).to.deep.equal([]); expect(b.acquired).to.deep.equal(['target']);
    b.setProjection(visible(1)); b.emit(b.frame(1));
    expect(owner.pans).to.deep.equal([[20, 0]]); expect(runner.snapshot.corrections).to.equal(1);
    runner.dispose(); runner.dispose(); expect(b.retired).to.deep.equal(['target']);
  });

  it('retains the runner local delivery guard when target replacement reenters pan preparation', () => {
    const { h, scene, b } = setup(); const owner = runnerHarness(scene); const runner = owner.start();
    owner.state.onPrepare = () => { owner.state.onPrepare = undefined; h.set([sceneTarget('target', 6, 2)]); };
    b.setProjection(visible(1)); b.emit(b.frame(1));
    expect(owner.pans).to.deep.equal([]);
    b.setProjection(visible(2, 15)); b.emit(b.frame(2));
    expect(owner.pans).to.deep.equal([[15, 0]]); expect(runner.snapshot.corrections).to.equal(1);
  });

  it('does not replenish corrections from accepted metadata or own sampling and paint changes', () => {
    const { h, fact, scene, b } = setup(); const owner = runnerHarness(scene); const runner = owner.start();
    for (const [index, offset] of [40, 30, 20, 10, 5].entries()) {
      h.set([fact], { registryRevision: h.snapshot.registryRevision }); b.setProjection(visible(1, offset));
      b.emit(b.frame(index + 1, {}, { samplingViewRevision: index + 1, paintRevision: index + 1 }));
    }
    expect(owner.pans.length).to.equal(4); expect(runner.snapshot).to.include({ status: 'limited', corrections: 4 });
  });

  it('grants a new attempt only for changed external allocation after a limited attempt', () => {
    const { h, scene, b } = setup(); const owner = runnerHarness(scene); const runner = owner.start();
    for (const [index, offset] of [40, 30, 20, 10, 5].entries()) { b.setProjection(visible(1, offset)); b.emit(b.frame(index + 1)); }
    expect(owner.pans.length).to.equal(4);
    h.viewport(sceneViewport(2, 800));
    b.setProjection(Object.freeze({ acceptedPositionRevision: 1, status: 'resolved', visible: true, point: [410, 240] as const }));
    b.emit(b.frame(6)); expect(owner.pans.length).to.equal(5);
    expect(owner.pans[4]).to.deep.equal([10, 0]); expect(runner.snapshot.corrections).to.equal(1);
  });

  it('preserves the runner lifetime reduced-motion allowance across target and viewport changes', () => {
    const { h, scene, b } = setup(); const owner = runnerHarness(scene, 'geographic-visual', true); const runner = owner.start();
    b.setProjection(visible(1)); b.emit(b.frame(1)); expect(owner.pans.length).to.equal(1);
    h.set([sceneTarget('target', 3, 2)]); h.viewport(sceneViewport(2, 800));
    b.setProjection(Object.freeze({ acceptedPositionRevision: 2, status: 'resolved', visible: true, point: [420, 240] as const }));
    b.emit(b.frame(2)); expect(owner.pans.length).to.equal(1); expect(runner.snapshot.status).to.equal('limited');
  });

  it('requires explicit new follow after a state-capability failure instead of auto-resuming', () => {
    const { h, scene } = setup(); const owner = runnerHarness(scene, 'ground'); const runner = owner.start();
    h.hooks.captureError = true;
    owner.state.onGroundPrepare = undefined;
    expect(() => scene.target('target')).to.throw(TypeError);
    h.hooks.captureError = false; h.set([sceneTarget('target', 4, 2)]);
    owner.state.onGroundPrepare = () => { owner.state.onGroundPrepare = undefined; h.hooks.captureError = true; };
    h.set([sceneTarget('target', 8, 3)]);
    expect(runner.snapshot).to.include({ status: 'unavailable', reason: 'engine' });
    const previousWrites = owner.ground.length;
    h.hooks.captureError = false; h.set([sceneTarget('target', 12, 4)]);
    expect(owner.ground.length).to.equal(previousWrites);
    const replacement = owner.start(); expect(replacement.snapshot.status).to.equal('ground');
    expect(owner.ground[owner.ground.length - 1]?.center).to.deep.equal([12, 0]);
  });
});
