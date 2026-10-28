import { expect } from '@open-wc/testing';
import { createSimulationClock, type ClockScheduler, type SimulationClock } from '../simulation-clock.js';
import { admitMapViewpoint, type MapViewpoint } from './map-camera-session-data.js';
import { registerMapCameraSession, type MapCameraSessionCallbacks, type MapCameraSessionLease,
  type MapCameraPreparedCommand } from './map-camera-session.js';
import { createMapCameraSessionController } from './map-camera-session-controller.js';

const view = (zoom = 2): MapViewpoint => ({ center: [0, 0], zoom, bearing: 0, pitch: 0 });
const tour = { keyframes: [{ instant: 0, view: view(0) }, { instant: 100, view: view(10) }] };
const cleanup: (() => void)[] = [];
function code(operation: () => unknown, expected: string): void {
  let actual: unknown;
  try { operation(); } catch (error) { actual = (error as { code?: unknown }).code; }
  expect(actual).to.equal(expected);
}
function clock() {
  let mono = 0, wall = 0, next = 0;
  const jobs = new Map<number, () => void>();
  const scheduler: ClockScheduler = {
    monotonicNow: () => mono, epochNow: () => wall,
    requestFrame(callback) { const id = ++next; jobs.set(id, callback); return id; },
    cancelFrame(handle) { jobs.delete(handle as number); },
  };
  const value = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler });
  cleanup.push(() => value.dispose());
  return { value, jobs, advance(delta: number) { mono += delta; wall += delta; }, wall(value: number) { wall = value; },
    frame() { const pending = [...jobs.values()]; jobs.clear(); pending.forEach(callback => callback()); } };
}
function harness() {
  const host = document.createElement('div');
  let callbacks!: MapCameraSessionCallbacks;
  let alive = true, acquired = false;
  let action: object | undefined;
  const prepared = new WeakSet<object>();
  const writes: MapCameraPreparedCommand[] = [], retirements: { action: object; stop: boolean }[] = [];
  const state = {
    camera: admitMapViewpoint(view()), reduced: false, synchronous: true, accept: true, acceptStart: true, prepareFailure: false,
    acquireCount: 0, releaseCount: 0,
    onCommit: undefined as (() => void) | undefined,
    onRetire: undefined as (() => void) | undefined,
  };
  const lease: MapCameraSessionLease = {
    current: () => alive && acquired,
    capture: () => admitMapViewpoint(state.camera),
    reducedMotion: () => state.reduced,
    start(token) { if (!alive || !acquired || !state.acceptStart) return false; action = token; return true; },
    prepare(token, target, transition) {
      if (state.prepareFailure) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
      const result = Object.freeze({ action: token, view: admitMapViewpoint(target), kind: state.reduced ? 'jump' as const : transition.kind,
        ...(transition.duration === undefined ? {} : { duration: transition.duration }) });
      prepared.add(result); return result;
    },
    commit(command) {
      if (!alive || !acquired || !prepared.has(command) || !state.accept) return false;
      action = command.action; state.camera = command.view; writes.push(command);
      state.onCommit?.();
      if (state.synchronous) callbacks.complete(command.action);
      return true;
    },
    retire(token, stopAnimation) {
      retirements.push({ action: token, stop: stopAnimation });
      if (action === token) action = undefined;
      state.onRetire?.();
    },
    release() { if (!acquired) return; acquired = false; state.releaseCount++; },
  };
  const unregister = registerMapCameraSession(host, {
    acquire(nextCallbacks) {
      if (acquired) throw Object.assign(new Error('already-bound'), { code: 'already-bound' });
      callbacks = nextCallbacks; acquired = true; state.acquireCount++; return lease;
    },
  });
  cleanup.push(() => { alive = false; unregister(); });
  return { host, state, writes, retirements,
    complete(token: object = writes.at(-1)!.action) { callbacks.complete(token); },
    interrupt(reason: Parameters<MapCameraSessionCallbacks['interrupt']>[0]) { callbacks.interrupt(reason); },
    motion(reduced: boolean) { state.reduced = reduced; callbacks.motion(reduced); } };
}
function session(h: ReturnType<typeof harness>, options?: { signal?: AbortSignal }) {
  const value = createMapCameraSessionController(h.host, options); cleanup.push(() => value.dispose()); return value;
}

describe('internal camera session saved views and tours', () => {
  afterEach(() => { for (const release of cleanup.splice(0).reverse()) release(); });

  it('captures detached frozen camera state and completes synchronous jumps once', () => {
    const h = harness(), controller = session(h), captured = controller.capture();
    expect(captured).to.deep.equal(view()); expect(captured === h.state.camera).to.equal(false);
    expect(Object.isFrozen(captured) && Object.isFrozen(captured.center)).to.equal(true);
    const states: unknown[] = []; controller.subscribe(snapshot => { states.push(snapshot); });
    controller.restore(view(4));
    expect(h.writes.length).to.equal(1); expect(h.writes[0]!.kind).to.equal('jump');
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'complete' });
    const count = states.length; h.complete(); expect(states.length).to.equal(count);
  });

  it('preserves an active restore on malformed data, transition, tour or clock admission', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease', duration: 100 });
    const before = controller.snapshot, retired = h.retirements.length;
    code(() => controller.restore({ ...view(), zoom: NaN }), 'invalid-viewpoint');
    code(() => controller.restore(view(), { kind: 'slide' } as never), 'invalid-options');
    code(() => controller.tour({} as SimulationClock, tour), 'invalid-clock');
    const time = clock(); code(() => controller.tour(time.value, { keyframes: [] }), 'invalid-tour');
    time.value.dispose(); code(() => controller.tour(time.value, tour), 'invalid-clock');
    expect(controller.snapshot).to.equal(before); expect(h.retirements.length).to.equal(retired); expect(h.writes.length).to.equal(1);
    h.state.prepareFailure = true; code(() => controller.restore(view(6)), 'unavailable');
    expect(controller.snapshot).to.equal(before); expect(h.retirements.length).to.equal(retired);
  });

  it('matches asynchronous completion and lets a newer restore win inside completion delivery', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'fly', duration: 100 });
    h.complete({}); expect(controller.snapshot.active).to.equal(true);
    let replaced = false;
    controller.subscribe(snapshot => {
      if (!replaced && snapshot.reason === 'complete') { replaced = true; controller.restore(view(8), { kind: 'ease' }); }
    });
    const old = h.writes[0]!.action; h.complete(old);
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4, 8]);
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: true, reason: 'start' });
    h.complete(old); expect(controller.snapshot.active).to.equal(true);
    h.complete(); expect(controller.snapshot.active).to.equal(false);
  });

  it('invalidates before stop callbacks and never revives a retired action', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' }); const old = h.writes[0]!.action;
    h.state.onRetire = () => { h.state.onRetire = undefined; h.complete(old); controller.restore(view(8)); };
    controller.stop();
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4, 8]);
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: true, reason: 'start' });
    h.complete(old); expect(controller.snapshot.active).to.equal(true);
  });

  it('reports inactive engine status without publishing active when action start fails', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' });
    const states: { active: boolean; reason: string }[] = []; const unsubscribe = controller.subscribe(snapshot => states.push(snapshot));
    states.length = 0; h.state.acceptStart = false;
    code(() => controller.restore(view(8)), 'unavailable');
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'engine' });
    expect(states.map(snapshot => snapshot.active)).to.deep.equal([false]);
    expect(h.writes.length).to.equal(1); unsubscribe();
  });

  it('uses inactive engine status and unavailable error for a stale or rejected commit', () => {
    const h = harness(), controller = session(h); h.state.accept = false;
    code(() => controller.restore(view(4)), 'unavailable');
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'engine' });
    expect(h.writes.length).to.equal(0);
  });

  it('validates pre-aborted options without acquiring and disposes active sessions idempotently', () => {
    const h = harness(), abort = new AbortController(); abort.abort();
    const inert = session(h, { signal: abort.signal }); expect(h.state.acquireCount).to.equal(0);
    code(() => inert.capture(), 'disposed'); code(() => inert.subscribe(() => undefined), 'disposed');
    inert.dispose(); inert.dispose();
    const activeAbort = new AbortController(), controller = session(h, { signal: activeAbort.signal });
    controller.restore(view(4)); activeAbort.abort(); controller.dispose();
    expect(h.state.releaseCount).to.equal(1); code(() => controller.restore(view(5)), 'disposed');
  });

  it('honors subscription removal, pre-aborted subscriptions and isolated listener errors', () => {
    const h = harness(), controller = session(h), errors: unknown[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'reportError');
    Object.defineProperty(globalThis, 'reportError', { configurable: true, value: (error: unknown) => { errors.push(error); } });
    let releaseThrowing: () => void = () => undefined;
    try {
      let second = 0, armed = false; let releaseSecond: () => void = () => undefined;
      controller.subscribe(() => { if (armed) releaseSecond(); });
      releaseSecond = controller.subscribe(() => { second++; });
      const abort = new AbortController(); abort.abort();
      controller.subscribe(() => { throw new Error('pre-aborted'); }, { signal: abort.signal });
      releaseThrowing = controller.subscribe(() => { throw new Error('subscriber'); });
      second = 0; armed = true; controller.restore(view(4));
      expect(second).to.equal(0); expect(errors.length).to.be.greaterThan(0);
      expect(controller.snapshot.reason).to.equal('complete');
    } finally {
      releaseThrowing();
      if (descriptor) Object.defineProperty(globalThis, 'reportError', descriptor); else Reflect.deleteProperty(globalThis, 'reportError');
    }
  });

  it('samples immediate, backward, rate and live deliveries without changing the shared clock', () => {
    const h = harness(), controller = session(h), time = clock(); time.value.seek(20);
    const before = time.value.snapshot; controller.tour(time.value, tour);
    expect(time.value.snapshot).to.equal(before); expect(h.writes.at(-1)!.view.zoom).to.equal(2);
    time.value.seek(70); expect(h.writes.at(-1)!.view.zoom).to.equal(7);
    time.value.seek(10); expect(h.writes.at(-1)!.view.zoom).to.equal(1);
    time.value.play(); time.value.setRate(2); time.advance(10); time.frame();
    expect(h.writes.at(-1)!.view.zoom).to.equal(3);
    time.wall(80); time.value.setMode('live'); expect(h.writes.at(-1)!.view.zoom).to.equal(8);
    time.wall(150); time.frame(); expect(h.writes.at(-1)!.view.zoom).to.equal(10);
    expect(controller.snapshot).to.include({ mode: 'tour', active: true });
    const count = h.writes.length; time.wall(200); time.frame(); expect(h.writes.length).to.equal(count);
    controller.stop(); const stopped = h.writes.length; time.wall(50); time.frame(); expect(h.writes.length).to.equal(stopped);
    expect(time.value.snapshot.mode).to.equal('live');
  });

  it('waits for delivered revisions when attaching inside dispatch and coalesces pending seeks', () => {
    const h = harness(), controller = session(h), time = clock();
    time.value.subscribe(snapshot => {
      if (snapshot.instant === 10) { time.value.seek(30); time.value.seek(40); controller.tour(time.value, tour); }
    });
    time.value.seek(10); expect(h.writes.length).to.equal(0);
    time.frame(); expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4]);
    time.value.seek(60); expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4, 6]);
  });

  it('retires on clock disposal during delivery and ignores later completion callbacks', () => {
    const h = harness(), controller = session(h), time = clock(); controller.tour(time.value, tour);
    h.state.onCommit = () => { if (h.writes.at(-1)!.view.zoom === 5) time.value.dispose(); };
    time.value.seek(50);
    expect(controller.snapshot).to.include({ active: false, reason: 'engine' });
    const count = h.writes.length; h.complete(); expect(h.writes.length).to.equal(count); expect(controller.snapshot.active).to.equal(false);
    expect(time.jobs.size).to.equal(0);
  });

  for (const reason of ['user', 'external', 'style', 'engine', 'disconnect'] as const) {
    it(`prevents clock-driven writes after ${reason} interruption`, () => {
      const h = harness(), controller = session(h), time = clock(); controller.tour(time.value, tour);
      h.interrupt(reason); const count = h.writes.length; time.value.seek(50); time.frame();
      expect(h.writes.length).to.equal(count); expect(controller.snapshot.active).to.equal(false);
      if (reason === 'disconnect') code(() => controller.capture(), 'disposed');
    });
  }

  it('holds tours under reduced motion and finishes only the current animated target on reduction', () => {
    const h = harness(), controller = session(h), time = clock(); h.state.reduced = true;
    controller.tour(time.value, tour); const count = h.writes.length;
    time.value.seek(50); expect(h.writes.length).to.equal(count);
    time.value.seek(100); expect(h.writes.at(-1)!.view.zoom).to.equal(10);
    h.motion(false); h.state.synchronous = false; controller.restore(view(6), { kind: 'fly' });
    h.motion(true); expect(h.writes.at(-1)!.kind).to.equal('jump'); expect(h.writes.at(-1)!.view.zoom).to.equal(6);
    expect(h.retirements.some(entry => entry.stop)).to.equal(true);
    h.complete(); const done = h.writes.length; h.motion(false); expect(h.writes.length).to.equal(done);
  });

  it('does not jump the old reduced-motion target after retirement reenters a newer action', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' });
    h.state.onRetire = () => { h.state.onRetire = undefined; controller.restore(view(8)); };
    h.motion(true);
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4, 8]);
  });
});
