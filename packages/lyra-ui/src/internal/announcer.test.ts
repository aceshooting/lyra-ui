import { expect, waitUntil } from '@open-wc/testing';
import { Announcer } from './announcer.js';

/** Real-timer throttle window used across these tests -- generous enough that
 *  normal CI scheduling jitter never flips a pass/fail outcome. */
const THROTTLE_MS = 60;

it('defaults throttleMs to 500 when not provided', () => {
  const a = new Announcer({ onFlush: () => {} });
  expect(a.throttleMs).to.equal(500);
});

it('flushes a single announce() call after the throttle window elapses', async () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: (text) => flushes.push(text) });

  a.announce('hello');
  expect(flushes, 'must not flush synchronously').to.deep.equal([]);

  await waitUntil(() => flushes.length === 1, 'expected one flush', { timeout: 2000 });
  expect(flushes).to.deep.equal(['hello']);
});

it('collapses repeated calls within a window to only the latest text', async () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: (text) => flushes.push(text) });

  a.announce('a');
  a.announce('b');
  a.announce('c');

  await waitUntil(() => flushes.length === 1, 'expected exactly one flush', { timeout: 2000 });
  expect(flushes, 'superseded text must be dropped, not queued or concatenated').to.deep.equal(['c']);
});

it('anchors the flush deadline to the first call in a burst, not later calls', async () => {
  const flushes: string[] = [];
  let flushElapsed: number | undefined;
  const start = performance.now();
  const a = new Announcer({
    throttleMs: THROTTLE_MS,
    onFlush: (text) => {
      flushElapsed ??= performance.now() - start;
      flushes.push(text);
    },
  });

  a.announce('a');
  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS / 2));
  a.announce('b'); // still inside the first call's window

  await waitUntil(() => flushes.length === 1, 'expected exactly one flush', { timeout: 2000 });

  // Timestamp is captured inside onFlush itself, not after waitUntil
  // resolves -- waitUntil's own poll `interval` (50ms by default) can add
  // slack on top of the real flush time, which previously made this
  // assertion measure polling granularity instead of the timer's actual
  // deadline. A (wrong) sliding-window reset would push the deadline out to
  // ~1.5x THROTTLE_MS from `start`; trailing-edge-from-first-call lands
  // close to 1x. Assert well below the reset case's deadline.
  expect(flushElapsed).to.be.below(THROTTLE_MS * 1.4);
  expect(flushes).to.deep.equal(['b']);
});

it('force: true flushes immediately, synchronously, regardless of any pending window', () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: 5000, onFlush: (text) => flushes.push(text) });

  a.announce('queued');
  a.announce('final', { force: true });

  expect(flushes, 'force must not wait for the 5s window').to.deep.equal(['final']);
});

it('force: true with nothing already pending still flushes its own text', () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: 5000, onFlush: (text) => flushes.push(text) });

  a.announce('only', { force: true });

  expect(flushes).to.deep.equal(['only']);
});

it('a forced flush cancels the scheduled trailing-edge flush so it never double-fires', async () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: (text) => flushes.push(text) });

  a.announce('a');
  a.announce('b', { force: true });

  // Wait well past the original window; if the timer weren't cancelled,
  // a second (stale) flush of 'a' would land here.
  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS * 2));
  expect(flushes).to.deep.equal(['b']);
});

it('cancel() drops a pending announcement without flushing it', async () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: (text) => flushes.push(text) });

  a.announce('a');
  a.cancel();

  await new Promise((resolve) => setTimeout(resolve, THROTTLE_MS * 2));
  expect(flushes).to.deep.equal([]);
});

it('cancel() is a no-op when nothing is pending', () => {
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: () => {} });
  expect(() => a.cancel()).to.not.throw();
});

it('exposes isPending/pendingText while a burst is in progress, and clears them after flush', async () => {
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: () => {} });

  expect(a.isPending).to.be.false;
  expect(a.pendingText).to.be.undefined;

  a.announce('a');
  expect(a.isPending).to.be.true;
  expect(a.pendingText).to.equal('a');

  await waitUntil(() => !a.isPending, 'expected the burst to flush', { timeout: 2000 });
  expect(a.pendingText).to.be.undefined;
});

it('separate, non-overlapping bursts each flush independently', async () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: (text) => flushes.push(text) });

  a.announce('a');
  await waitUntil(() => flushes.length === 1, 'expected the first burst to flush', { timeout: 2000 });

  a.announce('b');
  await waitUntil(() => flushes.length === 2, 'expected the second burst to flush', { timeout: 2000 });

  expect(flushes).to.deep.equal(['a', 'b']);
});

it('changing throttleMs between bursts affects the next burst, not one already scheduled', async () => {
  const flushes: string[] = [];
  const a = new Announcer({ throttleMs: THROTTLE_MS, onFlush: (text) => flushes.push(text) });

  a.announce('a');
  a.throttleMs = 5; // must not retroactively reschedule the in-flight timer
  await new Promise((resolve) => setTimeout(resolve, 15));
  expect(flushes, 'the in-flight burst should still be waiting out its original window').to.deep.equal([]);

  await waitUntil(() => flushes.length === 1, 'expected the first burst to flush eventually', {
    timeout: 2000,
  });
  expect(flushes).to.deep.equal(['a']);
});
