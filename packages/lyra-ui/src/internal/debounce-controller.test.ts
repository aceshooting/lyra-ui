import { expect, aTimeout } from '@open-wc/testing';
import { DebounceController, type DebounceTimerHost } from './debounce-controller.js';

// Real timers only -- @sinonjs/fake-timers does not work under wtr here. Every assertion below
// uses a delay short enough to keep the suite fast and a wait margin generous enough (at least
// 3x the delay, plus a fixed floor) to absorb scheduler jitter without ever asserting an exact
// timing.
const DELAY_MS = 30;
const SETTLE_WAIT_MS = 150;
const NEVER_FIRES_WAIT_MS = 150;

it('fires onSettled once, after the delay, with the pushed value', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.push(1);
  expect(settled, 'must not fire synchronously or before the delay elapses').to.deep.equal([]);

  await aTimeout(SETTLE_WAIT_MS);
  expect(settled).to.deep.equal([1]);
});

it('collapses rapid successive pushes into a single settle carrying the last value', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.push(1);
  controller.push(2);
  controller.push(3);
  await aTimeout(SETTLE_WAIT_MS);

  expect(settled).to.deep.equal([3]);
});

it('flush() fires immediately with the pending value and cancels the pending timer', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.push(42);
  controller.flush();
  expect(settled, 'flush must settle synchronously').to.deep.equal([42]);

  await aTimeout(NEVER_FIRES_WAIT_MS);
  expect(settled, 'the original timer must not also fire after flush()').to.deep.equal([42]);
});

it('flush() is a no-op when nothing is pending', () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.flush();
  expect(settled).to.deep.equal([]);
});

it('cancel() discards a pending push so it never fires', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.push(1);
  controller.cancel();
  await aTimeout(NEVER_FIRES_WAIT_MS);

  expect(settled, 'a cancelled entry must never fire').to.deep.equal([]);
});

it('cancel() is a no-op when nothing is pending', () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  expect(() => controller.cancel()).to.not.throw();
  expect(settled).to.deep.equal([]);
});

it('dispose() cancels a pending push before disposing, so it never fires', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.push(1);
  controller.dispose();
  await aTimeout(NEVER_FIRES_WAIT_MS);

  expect(settled, 'a pending entry must not fire after teardown').to.deep.equal([]);
});

it('a disposed controller ignores further push calls, guarding a post-teardown timer leak', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.dispose();
  controller.push(1);
  await aTimeout(NEVER_FIRES_WAIT_MS);

  expect(settled, 'a disposed controller must not schedule a new timer').to.deep.equal([]);
});

it('two independent controllers do not interfere: cancelling one leaves the other pending', async () => {
  const settledA: string[] = [];
  const settledB: string[] = [];
  const first = new DebounceController<string>(DELAY_MS, (value) => settledA.push(value));
  const second = new DebounceController<string>(DELAY_MS, (value) => settledB.push(value));

  first.push('first-draft');
  second.push('second-draft');
  first.cancel();
  await aTimeout(SETTLE_WAIT_MS);

  expect(settledA, 'cancelling one entry must not cancel an unrelated one').to.deep.equal([]);
  expect(settledB, 'the untouched entry must still settle').to.deep.equal(['second-draft']);
});

it('disposing every tracked controller (the disconnectedCallback shape) cancels every entry', async () => {
  const settled: string[] = [];
  const controllers = new Map<string, DebounceController<string>>([
    ['first', new DebounceController<string>(DELAY_MS, (value) => settled.push(value))],
    ['second', new DebounceController<string>(DELAY_MS, (value) => settled.push(value))],
    ['third', new DebounceController<string>(DELAY_MS, (value) => settled.push(value))],
  ]);

  for (const [id, controller] of controllers) controller.push(`${id}-draft`);
  for (const controller of controllers.values()) controller.dispose();
  await aTimeout(NEVER_FIRES_WAIT_MS);

  expect(settled, 'a disconnect-time cancel-all must leave nothing pending').to.deep.equal([]);
});

it('reports a push as pending until it settles, so a host can ask "is the user mid-edit?"', async () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  expect(controller.pending, 'nothing pushed yet').to.equal(false);
  controller.push(7);
  expect(controller.pending, 'a pushed value is pending until the delay elapses').to.equal(true);

  await aTimeout(SETTLE_WAIT_MS);
  expect(controller.pending, 'settling clears the pending flag').to.equal(false);
  expect(settled).to.deep.equal([7]);
});

it('clears the pending flag on flush() and on cancel()', () => {
  const settled: number[] = [];
  const controller = new DebounceController<number>(DELAY_MS, (value) => settled.push(value));

  controller.push(1);
  controller.flush();
  expect(controller.pending, 'flush settles the pending value').to.equal(false);

  controller.push(2);
  controller.cancel();
  expect(controller.pending, 'cancel discards the pending value').to.equal(false);
  expect(settled).to.deep.equal([1]);
});

it('exposes the latest pending value, and has already cleared it when onSettled runs', async () => {
  const observedDuringSettle: Array<string | undefined> = [];
  const controller: DebounceController<string> = new DebounceController<string>(DELAY_MS, () => {
    observedDuringSettle.push(controller.pendingValue);
  });

  expect(controller.pendingValue, 'nothing pushed yet').to.equal(undefined);
  controller.push('draft-one');
  controller.push('draft-two');
  expect(controller.pendingValue, 'only the latest push is retained').to.equal('draft-two');

  await aTimeout(SETTLE_WAIT_MS);
  expect(observedDuringSettle, 'the pending value is consumed before onSettled runs').to.deep.equal([
    undefined,
  ]);
  expect(controller.pendingValue).to.equal(undefined);
});

it('cancel() drops the pending value as well as the flag', () => {
  const controller = new DebounceController<string>(DELAY_MS, () => undefined);

  controller.push('draft');
  controller.cancel();
  expect(controller.pendingValue).to.equal(undefined);
});

it('cancelIfChanged() leaves a pending push untouched when nextValue equals the pending value', async () => {
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value));

  controller.push('typed');
  controller.cancelIfChanged('typed');
  expect(controller.pending, 'a same-value write must not cancel the pending push').to.equal(true);

  await aTimeout(SETTLE_WAIT_MS);
  expect(settled, 'the untouched push still settles on its own').to.deep.equal(['typed']);
});

it('cancelIfChanged() cancels a pending push when nextValue differs, exactly like cancel()', async () => {
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value));

  controller.push('typed');
  controller.cancelIfChanged('replaced');
  expect(controller.pending, 'a genuinely different write still supersedes the pending push').to.equal(false);

  await aTimeout(NEVER_FIRES_WAIT_MS);
  expect(settled, 'the superseded push must never fire').to.deep.equal([]);
});

it('cancelIfChanged() is a no-op when nothing is pending, exactly like cancel()', () => {
  const controller = new DebounceController<string>(DELAY_MS, () => undefined);

  expect(() => controller.cancelIfChanged('anything')).to.not.throw();
  expect(controller.pending).to.equal(false);
});

it('cancelIfChanged() accepts a custom equality comparator for a non-primitive T', async () => {
  const settled: Array<{ id: string }> = [];
  const controller = new DebounceController<{ id: string }>(DELAY_MS, (value) => settled.push(value));
  const byId = (a: { id: string }, b: { id: string }) => a.id === b.id;

  controller.push({ id: 'a' });
  // A different object identity carrying the same `id` must not cancel when the caller supplies
  // an equality comparator that says so.
  controller.cancelIfChanged({ id: 'a' }, byId);
  expect(controller.pending, 'the comparator says these are equal').to.equal(true);

  controller.cancelIfChanged({ id: 'b' }, byId);
  expect(controller.pending, 'the comparator says these differ').to.equal(false);

  await aTimeout(NEVER_FIRES_WAIT_MS);
  expect(settled).to.deep.equal([]);
});

it('re-reads delayMs on every push, so a host can retune its own debounce between edits', async () => {
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value));

  controller.delayMs = 10_000;
  controller.push('slow');
  await aTimeout(SETTLE_WAIT_MS);
  expect(settled, 'the retuned delay applies to the push that follows it').to.deep.equal([]);

  controller.delayMs = DELAY_MS;
  controller.push('fast');
  await aTimeout(SETTLE_WAIT_MS);
  expect(settled).to.deep.equal(['fast']);
});

/** A `setTimeout`/`clearTimeout` pair that records every call, standing in for another realm's
 *  window (the shape `<lr-combobox>`/`<lr-data-grid>` schedule on when they are adopted into a
 *  different document). */
function trackingTimerHost() {
  // The handle type is whatever the ambient `setTimeout` returns -- a number in a browser, a
  // `Timeout` object under the test tree's Node types. The controller only ever round-trips the
  // handle back to this same host, so the id is tunnelled through that opaque type rather than
  // widening the shared interface to accommodate a fixture.
  type Handle = ReturnType<typeof setTimeout>;
  const scheduled: Array<{ id: number; handler: () => void }> = [];
  const cleared: number[] = [];
  let nextId = 1;
  const host: DebounceTimerHost = {
    setTimeout(handler: () => void, _timeoutMs: number): Handle {
      const id = nextId++;
      scheduled.push({ id, handler });
      return id as unknown as Handle;
    },
    clearTimeout(handle: Handle): void {
      cleared.push(handle as unknown as number);
    },
  };
  return { scheduled, cleared, host };
}

it('schedules on the caller-supplied timer host instead of the ambient one', async () => {
  const { scheduled, cleared, host } = trackingTimerHost();
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value), () => host);

  controller.push('owned');
  expect(scheduled.length, 'the supplied host owns the timer').to.equal(1);
  await aTimeout(SETTLE_WAIT_MS);
  expect(settled, 'the ambient timer queue must not settle a host-owned debounce').to.deep.equal([]);

  scheduled[0]!.handler();
  expect(settled, "the host's own callback settles it").to.deep.equal(['owned']);

  controller.push('second');
  controller.cancel();
  expect(cleared, 'cancel clears through the host that scheduled it').to.deep.equal([2]);
});

it('falls back to the ambient timer queue when the host resolver has no realm to offer', async () => {
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value), () => null);

  controller.push('detached');
  await aTimeout(SETTLE_WAIT_MS);
  expect(settled).to.deep.equal(['detached']);
});

it('ignores a superseded callback that was already queued, keeping the newer timer cancellable', () => {
  const { scheduled, cleared, host } = trackingTimerHost();
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value), () => host);

  controller.push('stale');
  controller.push('current');
  expect(cleared, 'the superseded timer is cleared').to.deep.equal([1]);

  // A callback whose task was already queued when the newer push landed still arrives. It must
  // neither settle nor forget the newer timer, or teardown could no longer cancel that timer.
  scheduled[0]!.handler();
  expect(settled, 'a superseded callback must not settle').to.deep.equal([]);
  expect(controller.pending, 'the newer push is still pending').to.equal(true);

  controller.cancel();
  expect(cleared, 'the newer timer is still cancellable after the stale callback ran').to.deep.equal([1, 2]);
});

it('makes a fired callback inert if it is somehow invoked twice', () => {
  const { scheduled, host } = trackingTimerHost();
  const settled: string[] = [];
  const controller = new DebounceController<string>(DELAY_MS, (value) => settled.push(value), () => host);

  controller.push('once');
  scheduled[0]!.handler();
  scheduled[0]!.handler();
  expect(settled, 'a second invocation of the same callback settles nothing').to.deep.equal(['once']);
});
