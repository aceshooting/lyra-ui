import { expect } from '@open-wc/testing';
import { createSimulationClock, SimulationClockError, type ClockScheduler, type SimulationClockCapabilities, type SimulationClockOptions } from './simulation-clock.js';

function scheduler() {
  let mono = 0, epoch = 1000, next = 0;
  const jobs = new Map<number, () => void>();
  const api: ClockScheduler = {
    monotonicNow: () => mono, epochNow: () => epoch,
    requestFrame: callback => { const id = ++next; jobs.set(id, callback); return id; },
    cancelFrame: handle => { jobs.delete(handle as number); },
  };
  return { api, jobs, advance(delta: number) { mono += delta; epoch += delta; }, wall(value: number) { epoch = value; },
    frame() { const callbacks = [...jobs.values()]; jobs.clear(); callbacks.forEach(callback => callback()); } };
}

it('derives elapsed replay time without drift and catches up after no subscribers', () => {
  const time = scheduler();
  const clock = createSimulationClock({ range: [0, 10000], instant: 100 }, { scheduler: time.api });
  expect(time.jobs.size).to.equal(0);
  clock.play(); time.advance(300); clock.setRate(2); time.advance(100);
  expect(clock.currentInstant()).to.equal(600);
  let instant = -1;
  const release = clock.subscribe(value => { instant = value.instant; });
  expect(instant).to.equal(600); expect(time.jobs.size).to.equal(1);
  time.advance(250); time.frame(); expect(instant).to.equal(1100);
  release(); expect(time.jobs.size).to.equal(0);
  time.advance(10000);
  clock.subscribe(value => { instant = value.instant; });
  expect(instant).to.equal(10000); expect(clock.snapshot.playing).to.equal(false);
  expect(time.jobs.size).to.equal(0); clock.dispose();
});

it('separates live wall time, seek and step semantics and rejects invalid mutations atomically', () => {
  const time = scheduler();
  const clock = createSimulationClock({ range: [0, 10000], instant: 0 }, { scheduler: time.api });
  clock.setMode('live'); time.wall(2000); expect(clock.currentInstant()).to.equal(2000);
  time.wall(1500); expect(clock.currentInstant()).to.equal(1500);
  clock.stepTo(100); expect(clock.snapshot.mode).to.equal('replay'); expect(clock.snapshot.playing).to.equal(false);
  clock.play(); clock.setMode('replay'); expect(clock.snapshot.playing).to.equal(true);
  clock.stepTo(500); expect(clock.snapshot.playing).to.equal(true);
  clock.seek(500); expect(clock.snapshot.playing).to.equal(false);
  const before = clock.snapshot;
  for (const rate of [0, -1, NaN, Infinity]) expect(() => clock.setRate(rate)).to.throw(SimulationClockError);
  expect(clock.snapshot).to.equal(before); clock.dispose();
});

it('delivers coherent revisions under reentrancy and isolates subscriber errors/disposal', () => {
  const time = scheduler(), errors: unknown[] = [], first: number[] = [], second: number[] = [];
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api, onSubscriberError: error => errors.push(error) });
  clock.subscribe(value => { first.push(value.instant); if (value.instant === 10) clock.seek(20); });
  clock.subscribe(value => { second.push(value.instant); if (value.instant === 10) throw new Error('subscriber'); });
  clock.seek(10);
  expect(first.slice(0, 2)).to.deep.equal([0, 10]); expect(second.slice(0, 2)).to.deep.equal([0, 10]);
  time.frame();
  expect(first.at(-1)).to.equal(20); expect(second.at(-1)).to.equal(20); expect(errors.length).to.equal(1);
  clock.play(); clock.dispose(); expect(time.jobs.size).to.equal(0); expect(clock.snapshot.playing).to.equal(false);
  expect(() => clock.play()).to.throw(SimulationClockError);
  expect(() => clock.subscribe(() => undefined)).to.throw(SimulationClockError);
  clock.dispose();
});

it('admits options without invoking accessor values', () => {
  let reads = 0;
  const options = { range: [0, 1] as const, get instant() { reads++; return 0; } };
  expect(() => createSimulationClock(options)).to.throw(SimulationClockError);
  expect(reads).to.equal(0);
});

it('rejects malformed options and capabilities before reading time or scheduling work', () => {
  const calls: string[] = [];
  const api: ClockScheduler = {
    monotonicNow: () => { calls.push('monotonic'); return 0; },
    epochNow: () => { calls.push('epoch'); return 0; },
    requestFrame: () => { calls.push('request'); return 1; },
    cancelFrame: () => { calls.push('cancel'); },
  };
  const valid = { range: [0, 100] as const, instant: 0 };
  for (const options of [null, [], 0, { ...valid, extra: true }, { ...valid, [Symbol('extra')]: true }]) {
    expect(() => createSimulationClock(options as SimulationClockOptions, { scheduler: api }))
      .to.throw(SimulationClockError, 'invalid-options');
  }
  for (const instant of [NaN, Infinity, -Infinity, 8.64e15 + 1, -8.64e15 - 1]) {
    expect(() => createSimulationClock({ ...valid, instant }, { scheduler: api }))
      .to.throw(SimulationClockError, 'invalid-instant');
  }
  const unreadableScheduler = Object.create(null) as ClockScheduler;
  Object.defineProperty(unreadableScheduler, 'monotonicNow', { get() { throw new Error('Private scheduler failure'); } });
  for (const capabilities of [
    { scheduler: null }, { scheduler: { ...api, requestFrame: 1 } },
    { scheduler: unreadableScheduler }, { scheduler: api, onSubscriberError: 'invalid' },
  ]) {
    expect(() => createSimulationClock(valid, capabilities as unknown as SimulationClockCapabilities))
      .to.throw(SimulationClockError, 'invalid-capabilities');
  }
  expect(calls).to.deep.equal([]);
});

it('rejects invalid range updates without reading accessors or disturbing active playback', () => {
  const time = scheduler();
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  let reads = 0;
  const accessor = [0, 100];
  Object.defineProperty(accessor, '1', { get() { reads++; return 100; } });
  const revoked = Proxy.revocable([0, 100], {}); revoked.revoke();
  const invalid = [null, {}, [0], [0, 1, 2], [100, 0], [0, NaN], [0, Infinity],
    [0, 8.64e15 + 1], [, 100], accessor, Object.assign([0, 100], { extra: true }), revoked.proxy];
  const values: number[] = [];
  clock.subscribe(value => values.push(value.instant));
  clock.play();
  try {
    const before = clock.snapshot;
    for (const range of invalid) {
      expect(() => clock.setRange(range as unknown as readonly [number, number]))
        .to.throw(SimulationClockError, 'invalid-range');
      expect(clock.snapshot === before).to.equal(true);
      expect(time.jobs.size).to.equal(1);
    }
    for (const instant of [NaN, Infinity, -Infinity, 8.64e15 + 1]) {
      expect(() => clock.seek(instant)).to.throw(SimulationClockError, 'invalid-instant');
      expect(() => clock.stepTo(instant)).to.throw(SimulationClockError, 'invalid-instant');
    }
    expect(reads).to.equal(0);
    expect(values).to.deep.equal([0, 0]);
    time.advance(100); time.frame();
    expect(values.at(-1)).to.equal(100);
    expect(clock.snapshot.playing).to.equal(true);
  } finally { clock.dispose(); }
  expect(time.jobs.size).to.equal(0);
});

it('resamples wall time when a live range expands beyond the previous clamp', () => {
  const time = scheduler();
  const clock = createSimulationClock({ range: [0, 100], instant: 0 }, { scheduler: time.api });
  try {
    clock.setMode('live');
    expect(clock.snapshot.instant).to.equal(100);
    time.wall(750);
    clock.setRange([0, 1000]);
    expect(clock.snapshot.instant).to.equal(750);
    expect(clock.snapshot.reason).to.equal('range');
    expect(clock.snapshot.mode).to.equal('live');
    time.wall(300);
    clock.setRange([400, 800]);
    expect(clock.snapshot.instant).to.equal(400);
    expect(clock.currentInstant()).to.equal(400);
  } finally { clock.dispose(); }
});

it('stops a delivery immediately when its first subscriber disposes the clock', () => {
  const time = scheduler();
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  const first: number[] = [], second: number[] = [];
  clock.subscribe(value => { first.push(value.instant); if (value.instant === 10) clock.dispose(); });
  clock.subscribe(value => second.push(value.instant));
  clock.play(); time.advance(10); time.frame();
  expect(first).to.deep.equal([0, 0, 10]);
  expect(second).to.deep.equal([0, 0]);
  expect(clock.snapshot.instant).to.equal(10);
  expect(clock.snapshot.playing).to.equal(false);
  expect(time.jobs.size).to.equal(0);
  clock.dispose();
});

it('rejects synchronous frame delivery without publishing playback and recovers with an asynchronous scheduler', () => {
  const time = scheduler();
  let synchronous = true;
  const cancelled: unknown[] = [];
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: {
    ...time.api,
    requestFrame: callback => {
      if (synchronous) { callback(); return 'early-frame'; }
      return time.api.requestFrame(callback);
    },
    cancelFrame: handle => { cancelled.push(handle); time.api.cancelFrame(handle); },
  } });
  const values: number[] = [];
  clock.subscribe(value => values.push(value.instant));
  try {
    const before = clock.snapshot;
    expect(() => clock.play()).to.throw(SimulationClockError, 'invalid-capabilities');
    expect(clock.snapshot === before).to.equal(true);
    expect(values).to.deep.equal([0]);
    expect(cancelled).to.deep.equal(['early-frame']);
    synchronous = false;
    clock.play(); time.advance(25); time.frame();
    expect(values).to.deep.equal([0, 0, 25]);
  } finally { clock.dispose(); }
  expect(time.jobs.size).to.equal(0);
});

it('still cancels frames and freezes the last published instant when time sampling fails during disposal', () => {
  const time = scheduler();
  let failing = false;
  const errors: unknown[] = [];
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, {
    scheduler: { ...time.api, monotonicNow: () => { if (failing) throw new Error('Private clock failure'); return time.api.monotonicNow(); } },
    onSubscriberError: error => errors.push(error),
  });
  clock.subscribe(() => undefined); clock.play(); time.advance(50); time.frame();
  failing = true;
  clock.dispose();
  expect(errors.length).to.equal(1);
  expect(errors[0]).to.be.instanceOf(SimulationClockError);
  expect((errors[0] as SimulationClockError).code).to.equal('invalid-capabilities');
  expect(clock.snapshot.instant).to.equal(50);
  expect(clock.snapshot.playing).to.equal(false);
  expect(time.jobs.size).to.equal(0);
  expect(Object.isFrozen(clock.snapshot)).to.equal(true);
  expect(() => clock.seek(0)).to.throw(SimulationClockError, 'disposed');
});

for (const reportingFails of [false, true]) {
  it(`isolates a failing subscriber error handler when platform reporting ${reportingFails ? 'also fails' : 'succeeds'}`, () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'reportError');
    const reported: unknown[] = [];
    const secondary = new Error('Error handler failed');
    Object.defineProperty(globalThis, 'reportError', { configurable: true, value(error: unknown) {
      reported.push(error);
      if (reportingFails) throw new Error('Platform reporting failed');
    } });
    const time = scheduler();
    const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, {
      scheduler: time.api, onSubscriberError: () => { throw secondary; },
    });
    try {
      const values: number[] = [];
      clock.subscribe(value => { if (value.instant === 10) throw new Error('Subscriber failed'); });
      clock.subscribe(value => values.push(value.instant));
      clock.seek(10);
      expect(reported.length).to.equal(1);
      expect(reported[0] === secondary).to.equal(true);
      expect(values).to.deep.equal([0, 10]);
      clock.seek(20);
      expect(values).to.deep.equal([0, 10, 20]);
    } finally {
      clock.dispose();
      if (descriptor) Object.defineProperty(globalThis, 'reportError', descriptor);
      else Reflect.deleteProperty(globalThis, 'reportError');
    }
  });
}

it('keeps independent subscription tokens and cancels queued installation', () => {
  const time = scheduler(), clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  let duplicateCalls = 0, queuedCalls = 0;
  const duplicate = () => duplicateCalls++;
  const first = clock.subscribe(duplicate), second = clock.subscribe(duplicate);
  duplicateCalls = 0; first(); clock.seek(1); expect(duplicateCalls).to.equal(1);
  first(); clock.seek(2); expect(duplicateCalls).to.equal(2);
  clock.subscribe(value => { if (value.instant === 3) { const release = clock.subscribe(() => queuedCalls++); release(); } });
  clock.seek(3); time.frame(); expect(queuedCalls).to.equal(0);
  second(); clock.dispose();
});

it('coalesces reentrant commands into one later desired-state delivery', () => {
  const time = scheduler(), clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  const observed: number[] = [];
  clock.subscribe(value => { if (value.instant === 1) { clock.seek(10); clock.seek(20); } });
  clock.subscribe(value => observed.push(value.instant));
  clock.seek(1); expect(observed).to.deep.equal([0, 1]);
  time.frame(); expect(observed).to.deep.equal([0, 1, 20]);
  clock.dispose();
});

it('retains an analytical anchor independent of scheduler read overhead', () => {
  let mono = 0, callback: (() => void) | undefined;
  const clock = createSimulationClock({ range: [0, 10000], instant: 0 }, { scheduler: {
    monotonicNow: () => ++mono, epochNow: () => 0,
    requestFrame: next => { callback = next; return next; }, cancelFrame: () => { callback = undefined; },
  } });
  clock.subscribe(() => undefined); clock.play();
  const start = mono;
  for (let i = 0; i < 5; i++) { mono += 10; callback?.(); }
  const elapsedAtRead = mono + 1 - start;
  expect(clock.currentInstant()).to.equal(elapsedAtRead);
  clock.dispose();
});

it('rejects scheduling failure before publishing or retaining a new subscription', () => {
  let failing = true, calls = 0;
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: {
    monotonicNow: () => 0, epochNow: () => 0,
    requestFrame: () => { if (failing) throw new Error('unavailable scheduler'); return 1; }, cancelFrame: () => undefined,
  } });
  clock.subscribe(() => calls++);
  const before = clock.snapshot;
  expect(() => clock.play()).to.throw(SimulationClockError);
  expect(clock.snapshot).to.equal(before); expect(calls).to.equal(1);
  clock.dispose();

  const other = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: {
    monotonicNow: () => 0, epochNow: () => 0,
    requestFrame: () => { if (failing) throw new Error('unavailable scheduler'); return 1; }, cancelFrame: () => undefined,
  } });
  other.play(); let leaked = 0;
  expect(() => other.subscribe(() => leaked++)).to.throw(SimulationClockError);
  failing = false; other.seek(10); expect(leaked).to.equal(0);
  other.dispose();
});

for (const mode of ['replay', 'live'] as const) {
  it(`does not schedule or deliver an already-aborted ${mode} subscription`, () => {
    const time = scheduler(), controller = new AbortController();
    const clock = createSimulationClock({ range: [0, 10000], instant: 0 }, { scheduler: time.api });
    try {
      clock.setMode(mode);
      if (mode === 'replay') clock.play();
      controller.abort();
      let deliveries = 0;
      const release = clock.subscribe(() => deliveries++, { signal: controller.signal });
      expect(deliveries).to.equal(0);
      expect(time.jobs.size).to.equal(0);
      release(); release();
      time.advance(10);
      time.frame();
      expect(deliveries).to.equal(0);
      const values: number[] = [];
      clock.subscribe(value => values.push(value.instant));
      expect(values.length).to.equal(1);
      expect(time.jobs.size).to.equal(1);
    } finally { clock.dispose(); }
  });
}

it('aborts one subscriber without interrupting another and cancels scheduling after the last abort', () => {
  const time = scheduler(), first = new AbortController(), second = new AbortController();
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  const a: number[] = [], b: number[] = [];
  try {
    clock.subscribe(value => a.push(value.instant), { signal: first.signal });
    clock.subscribe(value => b.push(value.instant), { signal: second.signal });
    clock.play();
    first.abort();
    expect(time.jobs.size).to.equal(1);
    time.advance(10); time.frame();
    expect(a).to.deep.equal([0, 0]);
    expect(b).to.deep.equal([0, 0, 10]);
    second.abort();
    expect(time.jobs.size).to.equal(0);
    time.advance(10); time.frame();
    expect(b).to.deep.equal([0, 0, 10]);
  } finally { clock.dispose(); }
});

it('an abort from an earlier subscriber suppresses later delivery in the same revision', () => {
  const time = scheduler(), controller = new AbortController();
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  const values: number[] = [];
  try {
    clock.subscribe(value => { if (value.instant === 10) controller.abort(); });
    clock.subscribe(value => values.push(value.instant), { signal: controller.signal });
    clock.seek(10); clock.seek(20);
    expect(values).to.deep.equal([0]);
    expect(clock.snapshot.instant).to.equal(20);
  } finally { clock.dispose(); }
});

it('aborting a reentrant subscription prevents its deferred initial delivery', () => {
  const time = scheduler(), controller = new AbortController();
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  let deliveries = 0;
  try {
    clock.subscribe(value => {
      if (value.instant === 10) {
        clock.subscribe(() => deliveries++, { signal: controller.signal });
        controller.abort();
      }
    });
    clock.seek(10);
    expect(time.jobs.size).to.equal(0);
    time.frame(); clock.seek(20);
    expect(deliveries).to.equal(0);
  } finally { clock.dispose(); }
});

it('reports a throwing initial subscriber and continues delivering to healthy subscribers', () => {
  const time = scheduler(), errors: unknown[] = [], problem = new Error('Subscriber unavailable');
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api, onSubscriberError: error => errors.push(error) });
  const values: number[] = [];
  try {
    const release = clock.subscribe(() => { throw problem; });
    expect(errors).to.deep.equal([problem]);
    clock.subscribe(value => values.push(value.instant));
    clock.seek(10);
    expect(values).to.deep.equal([0, 10]);
    expect(errors).to.deep.equal([problem, problem]);
    release();
    clock.seek(20);
    expect(errors).to.have.length(2);
    expect(values).to.deep.equal([0, 10, 20]);
  } finally { clock.dispose(); }
});

it('ignores an uncancelled old frame after cancellation throws and permits fresh playback', () => {
  const time = scheduler(), errors: unknown[] = [], problem = new Error('Frame cancellation unavailable');
  let failing = true;
  const clock = createSimulationClock({ range: [0, 1000], instant: 0 }, {
    scheduler: { ...time.api, cancelFrame: handle => { if (failing) throw problem; time.api.cancelFrame(handle); } },
    onSubscriberError: error => errors.push(error),
  });
  const values: number[] = [];
  try {
    clock.subscribe(value => values.push(value.instant));
    clock.play(); clock.pause();
    expect(errors).to.deep.equal([problem]);
    const paused = clock.snapshot;
    time.advance(10); time.frame();
    expect(clock.snapshot).to.equal(paused);
    expect(time.jobs.size).to.equal(0);
    expect(values).to.deep.equal([0, 0, 0]);
    failing = false;
    clock.play(); time.advance(10); time.frame();
    expect(values.at(-1)).to.equal(10);
    expect(time.jobs.size).to.equal(1);
  } finally { failing = false; clock.dispose(); }
});

for (const [name, signal] of [
  ['null', null], ['false', false], ['zero', 0], ['empty string', ''], ['empty object', {}],
] as const) {
  it(`rejects the ${name} subscription signal with the public validation error and retains no listener`, () => {
    const time = scheduler(), clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
    let deliveries = 0;
    try {
      const before = clock.snapshot;
      expect(() => clock.subscribe(() => deliveries++, { signal: signal as unknown as AbortSignal }))
        .to.throw(SimulationClockError, 'invalid-options');
      expect(clock.snapshot).to.equal(before);
      expect(time.jobs.size).to.equal(0);
      clock.seek(10);
      expect(deliveries).to.equal(0);
      clock.subscribe(() => deliveries++);
      expect(deliveries).to.equal(1);
    } finally { clock.dispose(); }
  });
}

it('accepts an explicitly absent subscription signal', () => {
  const time = scheduler(), clock = createSimulationClock({ range: [0, 1000], instant: 0 }, { scheduler: time.api });
  const values: number[] = [];
  try {
    clock.subscribe(value => values.push(value.instant), { signal: undefined });
    clock.seek(10);
    expect(values).to.deep.equal([0, 10]);
  } finally { clock.dispose(); }
});
