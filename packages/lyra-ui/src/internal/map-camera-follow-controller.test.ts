import { expect } from '@open-wc/testing';
import { prepareMapCameraFollow, startMapCameraFollow, type MapCameraFollowDependencies,
  type MapCameraFollowOwner, type MapCameraFollowScene, type MapCameraFollowTarget,
  type MapCameraFollowNotice, type MapCameraFollowSnapshot } from './map-camera-follow-controller.js';
import { admitMapViewpoint, type MapViewpoint } from './map-camera-session-data.js';

const eligible = (positionRevision = 1, center: readonly [number, number] = [10, 20]): MapCameraFollowTarget =>
  Object.freeze({ kind: 'eligible', objectKind: 'marker', positionRevision, center, altitude: 100, altitudeReference: 'terrain' });
const cleanups: (() => void)[] = [];
function harness() {
  const listeners = new Set<(notice: MapCameraFollowNotice) => void>();
  const writes: MapViewpoint[] = [], snapshots: MapCameraFollowSnapshot[] = [], ids: string[] = [];
  const commands = new WeakMap<object, MapViewpoint>();
  const state = { target: eligible(), current: true, reduced: false, captures: 0, requests: 0, watches: 0,
    subscriptions: 0, releases: 0, accept: true, throwPrepare: false,
    view: { center: [1, 2], zoom: 8, bearing: 30, pitch: 40 } as MapViewpoint,
    onCapture: undefined as (() => void) | undefined,
    onPrepare: undefined as (() => void) | undefined,
    onCommit: undefined as (() => void) | undefined,
    onSubscribe: undefined as (() => void) | undefined,
  };
  const scene: MapCameraFollowScene = {
    target(id) { ids.push(id); return state.target; },
    subscribeTargets(listener) {
      state.subscriptions++; listeners.add(listener); state.onSubscribe?.();
      let released = false;
      return () => { if (!released) { released = true; state.releases++; listeners.delete(listener); } };
    },
    watchTarget() { state.watches++; return () => { state.watches--; }; },
    subscribeFrames() { throw new Error('Ground follow must not subscribe to projection frames'); },
    current: () => state.current,
    requestFrame() { state.requests++; },
  };
  const dependencies: MapCameraFollowDependencies = {
    current: () => state.current,
    capture() { state.captures++; state.onCapture?.(); return state.view; },
    reducedMotion: () => state.reduced, scene,
  };
  const owner: MapCameraFollowOwner = {
    current: () => state.current,
    prepareGround(view) {
      if (state.throwPrepare) throw new Error('Camera unavailable');
      const command = Object.freeze({}); commands.set(command, admitMapViewpoint(view)); state.onPrepare?.(); return command;
    },
    commitGround(command) {
      if (!state.accept) return false;
      const value = commands.get(command); if (!value) throw new Error('Unknown command');
      writes.push(value); state.onCommit?.(); return true;
    },
    preparePan() { throw new Error('Ground follow must not prepare a screen pan'); },
    commitPan() { throw new Error('Ground follow must not commit a screen pan'); },
    publish(value) { snapshots.push(value); },
  };
  const start = (input: unknown = { objectId: 'target', mode: 'ground' }) => {
    const runner = startMapCameraFollow(prepareMapCameraFollow(input, dependencies), owner);
    cleanups.push(() => runner.dispose()); return runner;
  };
  return { state, scene, dependencies, owner, writes, snapshots, ids, listeners, start,
    notify(notice: MapCameraFollowNotice = { kind: 'target', objectId: 'target' }) {
      for (const listener of [...listeners]) listener(notice);
    } };
}

describe('map camera follow ground runner', () => {
  afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

  it('preflights without subscriptions, publications or camera writes', () => {
    const h = harness(); prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies);
    expect(h.state.captures).to.equal(1); expect(h.state.subscriptions).to.equal(0);
    expect(h.writes.length).to.equal(0); expect(h.snapshots.length).to.equal(0); expect(h.state.requests).to.equal(0);
  });

  it('rejects malformed options and unsupported kinds before any activation side effects', () => {
    const h = harness();
    for (const input of [{ objectId: 'target' }, { objectId: ' ', mode: 'ground' }, { objectId: 'target', mode: 'ground', zoom: NaN }]) {
      expect(() => prepareMapCameraFollow(input, h.dependencies)).to.throw();
    }
    h.state.target = { kind: 'unsupported', objectKind: 'path' };
    expect(() => prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies)).to.throw();
    expect(h.state.subscriptions).to.equal(0); expect(h.writes.length).to.equal(0); expect(h.snapshots.length).to.equal(0);
  });

  it('rejects explicit visual camera axes before activation instead of silently ignoring them', () => {
    const h = harness();
    for (const axes of [{ zoom: 9 }, { bearing: 30 }, { pitch: 40 }]) {
      expect(() => prepareMapCameraFollow({ objectId: 'target', mode: 'geographic-visual', ...axes }, h.dependencies)).to.throw();
    }
    expect(h.state.subscriptions).to.equal(0); expect(h.writes.length).to.equal(0); expect(h.snapshots.length).to.equal(0);
  });

  it('preserves the admitted object ID exactly', () => {
    const h = harness(); h.start({ objectId: '  station/🌍  ', mode: 'ground' });
    expect(h.ids.length).to.be.greaterThan(0); expect(h.ids.every(id => id === '  station/🌍  ')).to.equal(true);
  });

  it('detaches captured omitted axes and follows accepted center without terrain placement', () => {
    const h = harness(); const plan = prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies);
    h.state.view = { center: [-5, -6], zoom: 12, bearing: 60, pitch: 0 };
    const runner = startMapCameraFollow(plan, h.owner); cleanups.push(() => runner.dispose());
    expect(h.writes).to.deep.equal([{ center: [10, 20], zoom: 8, bearing: 30, pitch: 40 }]);
    expect(runner.snapshot.status).to.equal('ground'); expect(h.state.watches).to.equal(0); expect(h.state.requests).to.equal(0);
  });

  it('reads the accepted target after subscribing instead of replaying a stale preflight position', () => {
    const h = harness(); const plan = prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies);
    h.state.target = eligible(2, [11, 21]);
    const runner = startMapCameraFollow(plan, h.owner); cleanups.push(() => runner.dispose());
    expect(h.writes.length).to.equal(1); expect(h.writes[0]?.center).to.deep.equal([11, 21]);
  });

  it('uses explicit camera axes with viewpoint angle normalization', () => {
    const h = harness(); h.start({ objectId: 'target', mode: 'ground', zoom: 9, bearing: 390, pitch: 50 });
    expect(h.writes).to.deep.equal([{ center: [10, 20], zoom: 9, bearing: 30, pitch: 50 }]);
  });

  it('skips unrelated notices, equal positions and altitude-only revisions', () => {
    const h = harness(); h.start(); h.notify({ kind: 'target', objectId: 'other' }); h.notify();
    h.state.target = eligible(2); h.notify();
    expect(h.writes.length).to.equal(1);
    h.state.target = eligible(3, [11, 21]); h.notify();
    expect(h.writes.length).to.equal(2); expect(h.writes[1]?.center).to.deep.equal([11, 21]);
  });

  it('keeps missing targets armed and resumes only accepted reappearance', () => {
    const h = harness(); h.state.target = { kind: 'absent' }; const runner = h.start();
    expect(runner.snapshot.status).to.equal('missing'); expect(h.writes.length).to.equal(0);
    h.state.target = eligible(2); h.notify(); expect(h.writes.length).to.equal(1);
    h.state.target = { kind: 'absent' }; h.notify(); expect(runner.snapshot.status).to.equal('missing');
    h.state.target = eligible(3, [12, 20]); h.notify(); expect(h.writes.length).to.equal(2);
  });

  it('clears missing or unsupported status on unchanged-view eligible reappearance without another write', () => {
    const h = harness(); const runner = h.start();
    h.state.target = { kind: 'absent' }; h.notify(); h.state.target = eligible(2); h.notify();
    expect(runner.snapshot.status).to.equal('ground'); expect(h.writes.length).to.equal(1);
    h.state.target = { kind: 'unsupported', objectKind: 'arc' }; h.notify(); h.state.target = eligible(3); h.notify();
    expect(runner.snapshot.status).to.equal('ground'); expect(h.writes.length).to.equal(1);
  });

  it('does not revive a removed target from an old accepted position revision', () => {
    const h = harness(); const runner = h.start(); h.state.target = { kind: 'absent' }; h.notify();
    h.state.target = eligible(1, [12, 20]); h.notify();
    expect(runner.snapshot.status).to.equal('missing'); expect(h.writes.length).to.equal(1);
    h.state.target = eligible(2, [12, 20]); h.notify(); expect(h.writes.length).to.equal(2);
  });

  it('reports a later unsupported kind without issuing a camera write', () => {
    const h = harness(); const runner = h.start(); h.state.target = { kind: 'unsupported', objectKind: 'arc' }; h.notify();
    expect(runner.snapshot.status).to.equal('unavailable'); expect(runner.snapshot.reason).to.equal('kind'); expect(h.writes.length).to.equal(1);
    h.state.target = eligible(3, [12, 20]); h.notify(); expect(h.writes.length).to.equal(2);
  });

  it('under reduced motion performs initial ground recenter and stays static', () => {
    const h = harness(); h.state.reduced = true; h.start();
    h.state.target = eligible(2, [11, 21]); h.notify(); h.notify({ kind: 'viewport', revision: 1 });
    expect(h.writes.length).to.equal(1);
  });

  it('does not grant another correction when reduced motion changes', () => {
    const h = harness(); const runner = h.start(); runner.refreshMotion(true);
    h.state.target = eligible(2, [11, 21]); h.notify(); expect(h.writes.length).to.equal(1);
  });

  it('reads the latest motion preference before its first activated delivery', () => {
    const h = harness(); const plan = prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies);
    h.state.reduced = true;
    const runner = startMapCameraFollow(plan, h.owner); cleanups.push(() => runner.dispose());
    h.state.target = eligible(2, [11, 21]); h.notify(); expect(h.writes.length).to.equal(1);
  });

  it('uses a preference cleared before activation rather than the inert preflight value', () => {
    const h = harness(); h.state.reduced = true;
    const plan = prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies);
    h.state.reduced = false;
    const runner = startMapCameraFollow(plan, h.owner); cleanups.push(() => runner.dispose());
    h.state.target = eligible(2, [11, 21]); h.notify(); expect(h.writes.length).to.equal(2);
  });

  it('never overwrites a newer same-owner target delivered during command preparation', () => {
    const h = harness();
    h.state.onPrepare = () => {
      h.state.onPrepare = undefined; h.state.target = eligible(2, [11, 21]); h.notify();
    };
    h.start();
    expect(h.writes.length).to.equal(1); expect(h.writes[0]?.center).to.deep.equal([11, 21]);
  });

  it('hands liveness from the retired preflight intent to the newly started action', () => {
    const h = harness(); let preflightCurrent = true;
    const plan = prepareMapCameraFollow({ objectId: 'target', mode: 'ground' },
      { ...h.dependencies, current: () => preflightCurrent });
    preflightCurrent = false;
    const runner = startMapCameraFollow(plan, h.owner); cleanups.push(() => runner.dispose());
    expect(h.writes.length).to.equal(1); expect(runner.snapshot.status).to.equal('ground');
  });

  it('refuses stale preflight and never starts a runner with a forged plan', () => {
    const h = harness(); h.state.onCapture = () => { h.state.current = false; };
    expect(() => prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, h.dependencies)).to.throw();
    expect(() => startMapCameraFollow({} as ReturnType<typeof prepareMapCameraFollow>, h.owner)).to.throw();
    expect(h.writes.length).to.equal(0);
  });

  it('rechecks current ownership after preparing a ground command', () => {
    const h = harness(); h.state.onPrepare = () => { h.state.current = false; }; h.start();
    expect(h.writes.length).to.equal(0);
  });

  it('never publishes a stale result after a camera callback replaces ownership', () => {
    const h = harness(); let countAtCallback = -1;
    h.state.onCommit = () => { countAtCallback = h.snapshots.length; h.state.current = false; }; h.start();
    expect(h.writes.length).to.equal(1); expect(h.snapshots.length).to.equal(countAtCallback);
  });

  it('releases a subscription whose installation invalidates the owner', () => {
    const h = harness(); h.state.onSubscribe = () => { h.state.current = false; }; h.start();
    expect(h.listeners.size).to.equal(0); expect(h.state.releases).to.equal(1); expect(h.writes.length).to.equal(0);
  });

  it('reports rejected camera writes without inventing a successful ground state', () => {
    const h = harness(); h.state.accept = false; const runner = h.start();
    expect(runner.snapshot.status).to.equal('unavailable'); expect(runner.snapshot.reason).to.equal('engine'); expect(h.writes.length).to.equal(0);
  });

  it('fails unavailable when no scene facet exists instead of using native projection', () => {
    const h = harness(); const { scene: _scene, ...dependencies } = h.dependencies;
    const runner = startMapCameraFollow(prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, dependencies), h.owner);
    cleanups.push(() => runner.dispose());
    expect(runner.snapshot.status).to.equal('unavailable'); expect(runner.snapshot.reason).to.equal('scene'); expect(h.writes.length).to.equal(0);
  });

  it('disposes idempotently and ignores later target deliveries', () => {
    const h = harness(); const runner = h.start(); const late = [...h.listeners]; runner.dispose(); runner.dispose();
    h.state.target = eligible(2, [11, 21]); late.forEach(listener => listener({ kind: 'target', objectId: 'target' }));
    expect(h.writes.length).to.equal(1); expect(h.listeners.size).to.equal(0); expect(h.state.releases).to.equal(1);
    expect(Object.isFrozen(runner.snapshot)).to.equal(true);
  });
});
