import { expect } from '@open-wc/testing';
import { prepareMapCameraFollow, startMapCameraFollow, type MapCameraFollowDependencies,
  type MapCameraFollowNotice, type MapCameraFollowOwner, type MapCameraFollowRunner,
  type MapCameraFollowScene, type MapCameraFollowTarget } from './map-camera-follow-controller.js';
import type { MapViewpoint } from './map-camera-session-data.js';

type StartupOwner = MapCameraFollowOwner & { ready?(runner: MapCameraFollowRunner): void };
const cleanups: (() => void)[] = [];
const target = (revision = 1): MapCameraFollowTarget => Object.freeze({ kind: 'eligible', objectKind: 'marker',
  positionRevision: revision, center: Object.freeze([revision, 20] as const), altitude: 0, altitudeReference: 'sea-level' });

function harness() {
  const listeners = new Set<(notice: MapCameraFollowNotice) => void>();
  const commands = new WeakMap<object, MapViewpoint>();
  const writes: MapViewpoint[] = [], events: string[] = [];
  const state: { current: boolean; reduced: boolean; target: MapCameraFollowTarget; subscriptions: number;
    releases: number; onMotionRead?: () => void; onCommit?: () => void } = {
    current: true, reduced: false, target: target(), subscriptions: 0, releases: 0,
  };
  const scene: MapCameraFollowScene = {
    target: () => state.target,
    subscribeTargets(listener) {
      events.push('subscribe'); state.subscriptions++; listeners.add(listener);
      let active = true;
      return () => { if (active) { active = false; state.releases++; listeners.delete(listener); } };
    },
    watchTarget() { throw new Error('Ground follow cannot acquire a projection watch'); },
    subscribeFrames() { throw new Error('Ground follow cannot subscribe to projection frames'); },
    current: () => state.current,
    requestFrame() { throw new Error('Ground follow cannot request a projection frame'); },
  };
  const dependencies: MapCameraFollowDependencies = {
    current: () => state.current,
    capture: () => ({ center: [0, 0], zoom: 8, bearing: 0, pitch: 0 }),
    reducedMotion() { events.push('motion'); state.onMotionRead?.(); return state.reduced; },
    scene,
  };
  const owner: StartupOwner = {
    current: () => state.current,
    prepareGround(view) { events.push('prepare'); const receipt = Object.freeze({}); commands.set(receipt, view); return receipt; },
    commitGround(receipt) {
      const view = commands.get(receipt); if (!view) throw new Error('Unknown ground receipt');
      events.push('commit'); writes.push(view); state.onCommit?.(); return true;
    },
    preparePan() { throw new Error('Ground follow cannot prepare a pan'); },
    commitPan() { throw new Error('Ground follow cannot commit a pan'); },
    publish() { events.push('publish'); },
  };
  const prepare = () => prepareMapCameraFollow({ objectId: 'target', mode: 'ground' }, dependencies);
  return { state, owner, writes, events, listeners, prepare,
    start(plan = prepare()) {
      const runner = startMapCameraFollow(plan, owner); cleanups.push(() => runner.dispose()); return runner;
    },
    change(revision: number) {
      state.target = target(revision);
      for (const listener of [...listeners]) listener({ kind: 'target', objectId: 'target' });
    },
  };
}

describe('map camera follow startup handoff', () => {
  afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); });

  it('hands off the returned runner after motion sampling and before subscriptions or writes', () => {
    const h = harness(); const plan = h.prepare(); h.events.length = 0;
    const handedOff: MapCameraFollowRunner[] = [];
    h.owner.ready = runner => { h.events.push('ready'); handedOff.push(runner); };
    const runner = h.start(plan);
    expect(handedOff.length).to.equal(1); expect(handedOff[0] === runner).to.equal(true);
    expect(h.events).to.deep.equal(['motion', 'ready', 'subscribe', 'prepare', 'commit', 'publish']);
    expect(h.writes.length).to.equal(1);
  });

  it('applies motion restriction before a nested target can issue a second startup command', () => {
    const h = harness(); let ready: MapCameraFollowRunner | undefined;
    h.owner.ready = runner => { ready = runner; };
    h.state.onCommit = () => {
      h.state.onCommit = undefined; h.state.reduced = true; ready?.refreshMotion(true); h.change(2);
    };
    const runner = h.start();
    expect(ready === runner).to.equal(true);
    expect(h.writes.map(view => view.center)).to.deep.equal([[1, 20]]);
    h.state.reduced = false; runner.refreshMotion(false); h.change(3);
    expect(h.writes.length).to.equal(1); expect(runner.snapshot.status).to.equal('ground');
  });

  it('installs no subscriptions or writes when readiness disposes the runner', () => {
    const h = harness(); let readyCalls = 0;
    h.owner.ready = runner => { readyCalls++; runner.dispose(); runner.dispose(); };
    const runner = h.start(); h.change(2); runner.dispose();
    expect(readyCalls).to.equal(1); expect(h.state.subscriptions).to.equal(0);
    expect(h.state.releases).to.equal(0); expect(h.writes).to.deep.equal([]);
  });

  it('leaves a replacement owner intact when readiness retires the starting owner', () => {
    const old = harness(), replacement = harness(); let replacements = 0;
    old.owner.ready = () => { old.state.current = false; replacements++; replacement.start(); };
    old.start(); old.change(2); replacement.change(2);
    expect(replacements).to.equal(1); expect(old.state.subscriptions).to.equal(0);
    expect(old.writes).to.deep.equal([]);
    expect(replacement.writes.map(view => view.center)).to.deep.equal([[1, 20], [2, 20]]);
    expect(replacement.state.releases).to.equal(0);
  });

  it('replays a pre-readiness true then false observation before the first delivery', () => {
    const h = harness(); const plan = h.prepare(); let observedRestriction = false, readyCalls = 0;
    const motion = (reduced: boolean) => { h.state.reduced = reduced; observedRestriction ||= reduced; };
    h.state.onMotionRead = () => { h.state.onMotionRead = undefined; motion(true); motion(false); };
    h.owner.ready = runner => { readyCalls++; if (observedRestriction) runner.refreshMotion(true); };
    h.state.onCommit = () => { h.state.onCommit = undefined; h.change(2); };
    h.start(plan);
    expect(readyCalls).to.equal(1); expect(h.state.reduced).to.equal(false);
    expect(h.writes.map(view => view.center)).to.deep.equal([[1, 20]]);
  });

  it('reports startup failure without subscriptions when the readiness hook throws', () => {
    const h = harness(); let readyCalls = 0;
    h.owner.ready = () => { readyCalls++; throw new Error('Owner unavailable'); };
    const runner = h.start(); h.change(2);
    expect(readyCalls).to.equal(1); expect(h.state.subscriptions).to.equal(0);
    expect(h.writes).to.deep.equal([]);
    expect(runner.snapshot).to.include({ status: 'unavailable', reason: 'engine' });
  });

  it('preserves latest-motion sampling and successive ground delivery without a readiness hook', () => {
    const h = harness(); h.state.reduced = true; const plan = h.prepare(); h.state.reduced = false;
    const runner = h.start(plan); h.change(2);
    expect(h.writes.map(view => view.center)).to.deep.equal([[1, 20], [2, 20]]);
    expect(runner.snapshot.status).to.equal('ground'); expect(h.state.subscriptions).to.equal(1);
    runner.dispose(); runner.dispose(); expect(h.state.releases).to.equal(1);
  });
});
