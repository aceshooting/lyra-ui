import { expect, fixture, html } from '@open-wc/testing';
import { CollectionSourceTracker } from './collection-source-tracker.js';

it('tracks only the latest source per property without replacing it on snapshot round trips', () => {
  const tracker = new CollectionSourceTracker();
  const snapshot: unknown[] = [];
  const first: unknown[] = [];
  const second: unknown[] = [];
  expect(tracker.isRebind('rows', first, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', first, snapshot)).to.equal(true);
  expect(tracker.isRebind('columns', first, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', snapshot, snapshot)).to.equal(true);
  expect(tracker.isRebind('rows', first, snapshot)).to.equal(true);
  expect(tracker.isRebind('rows', second, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', first, snapshot)).to.equal(false);
  expect(tracker.isRebind('columns', first, snapshot)).to.equal(true);
});

it('preserves strict-equality rebinding for primitive invalid inputs and callable sources', () => {
  const tracker = new CollectionSourceTracker();
  const snapshot: unknown[] = [];
  for (const value of [undefined, null, false, 0, 'invalid', Symbol('invalid'), 1n, () => {}]) {
    expect(tracker.isRebind('rows', value, snapshot)).to.equal(false);
    expect(tracker.isRebind('rows', value, snapshot)).to.equal(true);
  }
  expect(tracker.isRebind('rows', NaN, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', NaN, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', -0, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', 0, snapshot)).to.equal(true);
});

it('recognizes cross-realm and revoked proxy identities without inspecting their properties', async () => {
  const tracker = new CollectionSourceTracker();
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  const foreign = frame.contentDocument!.createElement('div');
  const snapshot: unknown[] = [];
  expect(tracker.isRebind('rows', foreign, snapshot)).to.equal(false);
  expect(tracker.isRebind('rows', foreign, snapshot)).to.equal(true);
  const { proxy, revoke } = Proxy.revocable([], {
    get() { throw new Error('source properties must not be inspected'); },
    getPrototypeOf() { throw new Error('source prototype must not be inspected'); },
  });
  expect(tracker.isRebind('rows', proxy, snapshot)).to.equal(false);
  revoke();
  expect(tracker.isRebind('rows', proxy, snapshot)).to.equal(true);
  expect(tracker.isRebind('columns', proxy, snapshot)).to.equal(false);
});
