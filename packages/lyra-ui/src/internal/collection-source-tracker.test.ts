import { expect, fixture, html } from '@open-wc/testing';
import { CollectionSourceTracker, SnapshotProperty } from './collection-source-tracker.js';

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

describe('SnapshotProperty', () => {
  it('normalizes a new source once, publishes before requestUpdate and skips rebinds', () => {
    let normalized = 0;
    const property = new SnapshotProperty<readonly string[]>([], (input) => {
      normalized += 1;
      return Object.freeze(Array.isArray(input) ? input.filter((v): v is string => typeof v === 'string') : []);
    });
    const updates: Array<[PropertyKey | undefined, unknown, readonly string[]]> = [];
    const host = { requestUpdate: (name?: PropertyKey, old?: unknown) => updates.push([name, old, property.read()]) };
    const source = ['a', 1, 'b'];
    expect(property.assign(host, 'items', source)).to.equal(true);
    expect(property.read()).to.deep.equal(['a', 'b']);
    expect(updates.length).to.equal(1);
    expect(updates[0]![0]).to.equal('items');
    expect(updates[0]![2] === property.read()).to.equal(true);
    expect(property.assign(host, 'items', source)).to.equal(false);
    expect(property.assign(host, 'items', property.read())).to.equal(false);
    expect(normalized).to.equal(1);
    const before = property.read();
    expect(property.assign(host, 'items', ['c'])).to.equal(true);
    expect(updates[1]![1] === before).to.equal(true);
    expect(property.assign(host, 'items', source)).to.equal(true);
    expect(property.assign(host, 'items', null)).to.equal(true);
    expect(property.assign(host, 'items', null)).to.equal(false);
    expect(property.assign(host, 'items', 'x')).to.equal(true);
    expect(property.assign(host, 'items', 'x')).to.equal(false);
    expect(normalized).to.equal(5);
  });
});
