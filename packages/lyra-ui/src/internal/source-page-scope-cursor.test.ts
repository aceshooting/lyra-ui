import { expect } from '@open-wc/testing';
import { setSourcePageScope, shareSourcePageQueries, sourcePageScope } from './source-page-scope.js';

it('shares opted-in page permits across provider identities without serializing selection or locate', async () => {
  const host = document.createElement('div');
  setSourcePageScope(host, host);
  shareSourcePageQueries(host);
  shareSourcePageQueries(host);
  const scope = sourcePageScope(host)!;
  const signal = new AbortController().signal;
  const first = await scope.acquire({}, 'page', signal);
  let granted = false;
  const waiting = scope.acquire({}, 'page', signal).then(release => { granted = true; return release; });
  const selection = await scope.acquire({}, 'selection', signal);
  const locate = await scope.acquire({}, 'locate', signal);
  expect(granted).to.equal(false);
  expect([selection, locate].map(value => typeof value)).to.deep.equal(['function', 'function']);
  first!();
  const second = await waiting;
  expect(granted).to.equal(true);
  second!(); selection!(); locate!();
});

it('retains the shared callback permit across a composition host replacement', async () => {
  const owner = {}, first = document.createElement('div'), second = document.createElement('div');
  setSourcePageScope(first, owner);
  shareSourcePageQueries(first);
  const release = await sourcePageScope(first)!.acquire({}, 'page', new AbortController().signal);
  setSourcePageScope(second, owner);
  shareSourcePageQueries(second);
  let granted = false;
  const waiting = sourcePageScope(second)!.acquire({}, 'page', new AbortController().signal)
    .then(value => { granted = true; return value; });
  await Promise.resolve();
  expect(granted).to.equal(false);
  release!();
  const next = await waiting;
  expect(granted).to.equal(true);
  next!();
});

it('rejects missing, retired and late first opt-in without moving an acquired permit', async () => {
  const host = document.createElement('div');
  expect(() => shareSourcePageQueries(host)).to.throw(TypeError);
  const owner = {};
  setSourcePageScope(host, owner);
  const scope = sourcePageScope(host)!;
  const release = await scope.acquire({}, 'page', new AbortController().signal);
  expect(() => shareSourcePageQueries(host)).to.throw(RangeError);
  release!();
  expect(() => shareSourcePageQueries(host)).to.throw(RangeError);
  setSourcePageScope(document.createElement('div'), owner);
  expect(() => shareSourcePageQueries(host)).to.throw(TypeError);
});

it('publishes replacement authority before notifying retirement and preserves a reentrant newer host', () => {
  const owner = {}, first = document.createElement('div'), second = document.createElement('div'), newest = document.createElement('div');
  setSourcePageScope(first, owner);
  const initial = sourcePageScope(first)!;
  let replacementWasCurrent = false;
  initial.onInvalidate(() => {
    replacementWasCurrent = sourcePageScope(second)?.isCurrent() === true;
    setSourcePageScope(newest, owner);
  });
  let removedCalls = 0;
  const unsubscribe = initial.onInvalidate(() => { removedCalls++; });
  unsubscribe();
  setSourcePageScope(second, owner);
  expect(replacementWasCurrent).to.equal(true);
  expect(removedCalls).to.equal(0);
  expect(initial.isCurrent()).to.equal(false);
  expect(sourcePageScope(second)!.isCurrent()).to.equal(false);
  expect(sourcePageScope(newest)!.isCurrent()).to.equal(true);
  let retiredCalls = 0;
  initial.onInvalidate(() => { retiredCalls++; });
  expect(retiredCalls).to.equal(1);
});
