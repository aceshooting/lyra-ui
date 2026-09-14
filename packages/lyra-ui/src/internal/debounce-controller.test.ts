import { expect, aTimeout } from '@open-wc/testing';
import { DebounceController } from './debounce-controller.js';

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
