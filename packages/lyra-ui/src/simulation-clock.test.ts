import { expect } from '@open-wc/testing';
import { createSimulationClock, SimulationClockError, type ClockScheduler } from './simulation-clock.js';

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
