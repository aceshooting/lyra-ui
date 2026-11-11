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
    acquireCount: 0, releaseCount: 0, available: true,
    onPrepare: undefined as (() => void) | undefined,
    onStart: undefined as (() => void) | undefined,
    onCommit: undefined as (() => void) | undefined,
    onRetire: undefined as (() => void) | undefined,
  };
  const lease: MapCameraSessionLease = {
    current: () => alive && acquired && state.available,
    capture: () => admitMapViewpoint(state.camera),
    reducedMotion: () => state.reduced,
    start(token) {
      if (!alive || !acquired || !state.acceptStart) return false;
      action = token; state.onStart?.(); return true;
    },
    prepare(token, target, transition) {
      if (state.prepareFailure) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
      state.onPrepare?.();
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
    const delivered: string[] = [];
    controller.subscribe(snapshot => { delivered.push(snapshot.reason); });
    delivered.length = 0;
    const old = h.writes[0]!.action; h.complete(old);
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4, 8]);
    expect(delivered, 'later subscribers receive the replacement, not its retired predecessor').to.deep.equal(['start']);
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: true, reason: 'start' });
    h.complete(old); expect(controller.snapshot.active).to.equal(true);
    h.complete(); expect(controller.snapshot.active).to.equal(false);
    expect(delivered).to.deep.equal(['start', 'complete']);
  });

  it('rejects malformed option records without reading accessors or disturbing an active camera', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' });
    const before = controller.snapshot, retired = h.retirements.length;
    let reads = 0, deliveries = 0;
    const invalid = [null, [], 4, { unknown: true }, { [Symbol('option')]: true },
      Object.defineProperty({}, 'signal', { enumerable: true, get() { reads++; return undefined; } }),
      new Proxy({}, { ownKeys() { throw new Error('unreadable keys'); } }),
      new Proxy({}, { ownKeys() { return ['signal']; }, getOwnPropertyDescriptor() { return undefined; } }),
    ];
    for (const options of invalid) {
      code(() => createMapCameraSessionController(h.host, options as never), 'invalid-options');
      code(() => controller.subscribe(() => { deliveries++; }, options as never), 'invalid-options');
    }
    for (const options of [null, [], { unknown: true }, { [Symbol('transition')]: 'jump' },
      Object.defineProperty({}, 'kind', { enumerable: true, get() { reads++; return 'jump'; } })]) {
      code(() => controller.restore(view(8), options as never), 'invalid-options');
    }
    expect(reads).to.equal(0); expect(deliveries).to.equal(0);
    expect(h.state.acquireCount).to.equal(1); expect(controller.snapshot).to.equal(before);
    expect(h.writes.length).to.equal(1); expect(h.retirements.length).to.equal(retired);
    controller.restore(view(6)); expect(h.writes.at(-1)!.view.zoom).to.equal(6);
  });

  it('keeps the newer restore when camera preparation synchronously replaces the intent', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' });
    const previous = h.writes[0]!.action;
    h.state.onPrepare = () => { h.state.onPrepare = undefined; controller.restore(view(8)); };
    controller.restore(view(6));
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4, 8]);
    expect(h.retirements.map(entry => entry.action === previous)).to.deep.equal([true]);
    expect(controller.capture().zoom).to.equal(8);
    h.complete(previous); expect(controller.snapshot.active).to.equal(true);
    h.complete(); expect(controller.snapshot.reason).to.equal('complete');
  });

  it('retires a newly armed action if its native start disconnects the session', () => {
    const h = harness(), controller = session(h);
    h.state.onStart = () => h.interrupt('disconnect');
    controller.restore(view(6), { kind: 'fly' });
    expect(h.writes.length).to.equal(0);
    expect(h.retirements.map(entry => entry.stop)).to.deep.equal([false]);
    expect(controller.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'disconnect' });
    expect(h.state.releaseCount).to.equal(1);
    h.interrupt('engine'); controller.dispose();
    expect(h.state.releaseCount).to.equal(1); code(() => controller.capture(), 'disposed');
  });

  it('isolates native commit, retirement and reporting failures and accepts a later restore', () => {
    const h = harness(), controller = session(h); h.state.synchronous = false;
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'reportError');
    const errors: unknown[] = [];
    Object.defineProperty(globalThis, 'reportError', { configurable: true, value(error: unknown) {
      errors.push(error); throw new Error('reporting failed');
    } });
    const retirementError = new Error('native stop failed');
    try {
      h.state.onCommit = () => { throw new Error('native camera failed'); };
      h.state.onRetire = () => { throw retirementError; };
      code(() => controller.restore(view(4), { kind: 'ease' }), 'unavailable');
      expect(controller.snapshot).to.include({ mode: 'viewpoint', active: false, reason: 'engine' });
      expect(h.retirements.map(entry => entry.stop)).to.deep.equal([true]);
      expect(errors).to.deep.equal([retirementError]);
      h.state.onCommit = undefined; h.state.onRetire = undefined;
      controller.restore(view(8)); h.complete();
      expect(controller.capture().zoom).to.equal(8); expect(controller.snapshot.reason).to.equal('complete');
    } finally {
      h.state.onCommit = undefined; h.state.onRetire = undefined;
      if (descriptor) Object.defineProperty(globalThis, 'reportError', descriptor); else Reflect.deleteProperty(globalThis, 'reportError');
    }
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

  it('rejects malformed signal capabilities without acquiring or registering a listener', () => {
    const h = harness(), controller = session(h);
    let deliveries = 0;
    const signals = [null, false, {}, { aborted: false },
      { aborted: false, addEventListener() {}, removeEventListener: 1 },
      { get aborted() { throw new Error('Signal state unavailable'); } },
      { aborted: false, get addEventListener() { throw new Error('Signal listener unavailable'); } },
      { aborted: false, addEventListener() {}, get removeEventListener() { throw new Error('Signal release unavailable'); } },
    ];
    for (const signal of signals) {
      code(() => createMapCameraSessionController(h.host, { signal } as never), 'invalid-options');
      code(() => controller.subscribe(() => { deliveries++; }, { signal } as never), 'invalid-options');
    }
    for (const listener of [undefined, null, 0, 'listener', {}]) {
      code(() => controller.subscribe(listener as never), 'invalid-options');
    }
    controller.restore(view(6));
    expect(h.state.acquireCount).to.equal(1); expect(deliveries).to.equal(0);
    expect(controller.capture().zoom).to.equal(6);
  });

  it('releases acquisition when abort-listener installation fails and permits a later owner', () => {
    const h = harness(), abort = new AbortController();
    Object.defineProperty(abort.signal, 'addEventListener', { value() { throw new Error('Listener unavailable'); } });
    code(() => createMapCameraSessionController(h.host, { signal: abort.signal }), 'invalid-options');
    expect(h.state.releaseCount).to.equal(1);
    const controller = session(h); controller.restore(view(7));
    expect(h.state.acquireCount).to.equal(2); expect(controller.capture().zoom).to.equal(7);
  });

  it('disposes a newly acquired session when its signal aborts while its listener is installed', () => {
    const h = harness(), abort = new AbortController();
    const add = abort.signal.addEventListener.bind(abort.signal);
    Object.defineProperty(abort.signal, 'addEventListener', { value(...args: Parameters<AbortSignal['addEventListener']>) {
      add(...args); abort.abort();
    } });
    const controller = session(h, { signal: abort.signal });
    expect(controller.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'disposed' });
    expect(h.state.releaseCount).to.equal(1); expect(h.writes.length).to.equal(0);
    code(() => controller.restore(view(8)), 'disposed');
    controller.dispose(); expect(h.state.releaseCount).to.equal(1);
    const replacement = session(h); replacement.restore(view(9));
    expect(replacement.capture().zoom).to.equal(9);
  });

  it('does not retain a subscription whose signal refuses listener installation', () => {
    const h = harness(), controller = session(h), abort = new AbortController();
    let deliveries = 0;
    Object.defineProperty(abort.signal, 'addEventListener', { value() { throw new Error('Listener unavailable'); } });
    code(() => controller.subscribe(() => { deliveries++; }, { signal: abort.signal }), 'invalid-options');
    controller.restore(view(6)); controller.stop();
    expect(deliveries).to.equal(0); expect(controller.capture().zoom).to.equal(6);
    expect(controller.snapshot.reason).to.equal('stop');
  });

  for (const cause of ['signal-abort', 'session-dispose'] as const) {
    it(`withholds initial subscription delivery after ${cause} during listener installation`, () => {
      const h = harness(), controller = session(h), abort = new AbortController();
      const add = abort.signal.addEventListener.bind(abort.signal);
      const remove = abort.signal.removeEventListener.bind(abort.signal);
      let deliveries = 0, removals = 0;
      Object.defineProperty(abort.signal, 'addEventListener', { value(...args: Parameters<AbortSignal['addEventListener']>) {
        add(...args);
        if (cause === 'signal-abort') abort.abort(); else controller.dispose();
      } });
      Object.defineProperty(abort.signal, 'removeEventListener', { value(...args: Parameters<AbortSignal['removeEventListener']>) {
        removals++; remove(...args);
      } });
      const release = controller.subscribe(() => { deliveries++; }, { signal: abort.signal });
      expect(deliveries).to.equal(0); expect(removals).to.equal(1);
      release(); release(); expect(removals).to.equal(1);
      if (cause === 'signal-abort') {
        controller.restore(view(6)); expect(controller.capture().zoom).to.equal(6);
        expect(deliveries).to.equal(0);
      } else {
        expect(h.state.releaseCount).to.equal(1); code(() => controller.capture(), 'disposed');
      }
    });
  }

  for (const connected of [false, true]) {
    it(`classifies acquisition failure for a ${connected ? 'connected' : 'detached'} map`, () => {
      const host = document.createElement('div');
      if (connected) document.body.append(host);
      cleanup.push(() => host.remove());
      cleanup.push(registerMapCameraSession(host, { acquire() { throw new Error('Native acquisition failed'); } }));
      code(() => createMapCameraSessionController(host), connected ? 'unavailable' : 'inactive-map');
    });
  }

  it('rejects preparation after the native lease becomes unavailable without replacing the active snapshot', () => {
    const h = harness(), controller = session(h), time = clock(); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' }); const before = controller.snapshot;
    h.state.available = false;
    code(() => controller.restore(view(6)), 'unavailable');
    code(() => controller.tour(time.value, tour), 'unavailable');
    expect(controller.snapshot).to.equal(before); expect(h.writes.length).to.equal(1);
    expect(h.retirements.length).to.equal(0);
    h.state.available = true; controller.restore(view(8));
    expect(controller.capture().zoom).to.equal(8);
  });

  it('retains an active restore when tour preflight disposes its clock', () => {
    const h = harness(), controller = session(h), time = clock(); h.state.synchronous = false;
    controller.restore(view(4), { kind: 'ease' }); const before = controller.snapshot;
    h.state.onPrepare = () => { h.state.onPrepare = undefined; time.value.dispose(); };
    code(() => controller.tour(time.value, tour), 'invalid-clock');
    expect(controller.snapshot).to.equal(before); expect(h.retirements.length).to.equal(0);
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([4]);
    h.complete(); expect(controller.snapshot.reason).to.equal('complete');
  });

  it('does not attach a tour whose preflight starts a newer saved view', () => {
    const h = harness(), controller = session(h), time = clock(); h.state.synchronous = false;
    h.state.onPrepare = () => { h.state.onPrepare = undefined; controller.restore(view(8)); };
    controller.tour(time.value, tour); time.value.seek(70);
    expect(h.writes.map(command => command.view.zoom)).to.deep.equal([8]);
    expect(controller.snapshot).to.include({ mode: 'viewpoint', active: true });
    h.complete(); expect(controller.snapshot.reason).to.equal('complete');
  });

  it('does not subscribe a tour after native start disconnects its session', () => {
    const h = harness(), controller = session(h), time = clock();
    h.state.onStart = () => h.interrupt('disconnect');
    controller.tour(time.value, tour); time.value.seek(70);
    expect(h.writes.length).to.equal(0); expect(h.state.releaseCount).to.equal(1);
    expect(controller.snapshot).to.deep.equal({ mode: 'idle', active: false, reason: 'disconnect' });
  });

  it('retires a tour whose clock is disposed by its native start callback', () => {
    const h = harness(), controller = session(h), time = clock();
    h.state.onStart = () => time.value.dispose();
    controller.tour(time.value, tour);
    expect(h.writes.length).to.equal(0);
    expect(controller.snapshot).to.include({ active: false, reason: 'engine' });
    expect(h.retirements.length).to.equal(1);
    h.state.onStart = undefined; controller.restore(view(8));
    expect(controller.capture().zoom).to.equal(8);
  });

  it('releases a tour subscription after its initial native command is rejected', () => {
    const h = harness(), controller = session(h), time = clock(); h.state.accept = false;
    code(() => controller.tour(time.value, tour), 'unavailable');
    expect(controller.snapshot).to.include({ mode: 'tour', active: false, reason: 'engine' });
    expect(h.retirements.length).to.equal(1);
    h.state.accept = true; time.value.seek(70);
    expect(h.writes.length).to.equal(0);
    controller.restore(view(9)); expect(controller.capture().zoom).to.equal(9);
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
