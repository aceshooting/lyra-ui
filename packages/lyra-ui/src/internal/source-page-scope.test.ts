import { expect } from '@open-wc/testing';
import { setSourcePageScope, sourcePageScope } from './source-page-scope.js';

function registered(owner = {}) {
  const host = document.createElement('div');
  setSourcePageScope(host, owner);
  return { host, owner, scope: sourcePageScope(host)! };
}

it('rejects permits from retired hosts and already-aborted operations while accepting the current host', async () => {
  expect(sourcePageScope(document.createElement('div')) === undefined).to.equal(true);
  const first = registered(), provider = {}, signal = new AbortController();
  setSourcePageScope(first.host, first.owner);
  expect(sourcePageScope(first.host) === first.scope).to.equal(true);
  const second = registered(first.owner);
  expect(first.scope.isCurrent()).to.equal(false);
  expect(second.scope.isCurrent()).to.equal(true);
  expect(await first.scope.acquire(provider, 'page', signal.signal) === undefined).to.equal(true);
  signal.abort();
  expect(await second.scope.acquire(provider, 'page', signal.signal) === undefined).to.equal(true);
  const release = await second.scope.acquire(provider, 'page', new AbortController().signal);
  expect(typeof release).to.equal('function');
  release!();
});

it('keeps only the latest waiting request and prevents an old release from freeing its successor', async () => {
  const { scope } = registered(), provider = {}, signal = new AbortController().signal;
  const first = await scope.acquire(provider, 'page', signal);
  expect(typeof first).to.equal('function');
  const obsolete = scope.acquire(provider, 'page', signal);
  const current = scope.acquire(provider, 'page', signal);
  expect(await obsolete === undefined).to.equal(true);
  first!();
  const second = await current;
  expect(typeof second).to.equal('function');
  let thirdGranted = false;
  const waiting = scope.acquire(provider, 'page', signal).then(release => { thirdGranted = true; return release; });
  first!();
  await Promise.resolve();
  expect(thirdGranted).to.equal(false);
  second!();
  const third = await waiting;
  expect(thirdGranted).to.equal(true);
  expect(typeof third).to.equal('function');
  third!();
});

it('allows independent provider work while superseding a queued logical operation in the same lane', async () => {
  const { scope } = registered(), firstProvider = {}, secondProvider = {}, signal = new AbortController().signal;
  const page = await scope.acquire(firstProvider, 'page', signal);
  const selection = await scope.acquire(firstProvider, 'selection', signal);
  const locate = await scope.acquire(firstProvider, 'locate', signal);
  expect([page, selection, locate].map(release => typeof release)).to.deep.equal(['function', 'function', 'function']);
  const obsolete = scope.acquire(firstProvider, 'page', signal);
  const replacement = await scope.acquire(secondProvider, 'page', signal);
  expect(await obsolete === undefined).to.equal(true);
  expect(typeof replacement).to.equal('function');
  page!(); selection!(); locate!(); replacement!();
  const resumed = await scope.acquire(firstProvider, 'page', signal);
  expect(typeof resumed).to.equal('function');
  resumed!();
});

it('cancels an aborted waiter without releasing an in-flight operation', async () => {
  const { scope } = registered(), provider = {}, signal = new AbortController().signal;
  const first = await scope.acquire(provider, 'selection', signal);
  const aborted = new AbortController();
  const canceled = scope.acquire(provider, 'selection', aborted.signal);
  aborted.abort();
  expect(await canceled === undefined).to.equal(true);
  let granted = false;
  const next = scope.acquire(provider, 'selection', signal).then(release => { granted = true; return release; });
  await Promise.resolve();
  expect(granted).to.equal(false);
  first!();
  const release = await next;
  expect(typeof release).to.equal('function');
  release!();
});

it('retires queued requests when a host changes composition and lets the old composition resume after settlement', async () => {
  const first = registered(), provider = {}, signal = new AbortController().signal;
  const held = await first.scope.acquire(provider, 'locate', signal);
  const obsolete = first.scope.acquire(provider, 'locate', signal);
  setSourcePageScope(first.host, {});
  expect(first.scope.isCurrent()).to.equal(false);
  expect(await obsolete === undefined).to.equal(true);
  const replacement = registered(first.owner);
  let granted = false;
  const waiting = replacement.scope.acquire(provider, 'locate', signal).then(release => { granted = true; return release; });
  await Promise.resolve();
  expect(granted).to.equal(false);
  held!();
  const release = await waiting;
  expect(typeof release).to.equal('function');
  expect(replacement.scope.isCurrent()).to.equal(true);
  release!();
});
