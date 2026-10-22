import assert from 'node:assert/strict';
import test from 'node:test';
import { installMountFakes } from '../../test/mount-fakes.js';
import { createBrowserDocxPort } from './browser-port.js';
const claimDocxMount = (mount: HTMLElement, lost: () => void) => createBrowserDocxPort({ mount }).claimMount(mount, lost);

test('callback-free mount checks retain exactly-once loss delivery and ignore overridden DOM members', async () => {
  const { Observer, RecordFake, mount, restore } = installMountFakes();
  try {
    for (const terminal of ['microtask', 'valid', 'release']) {
      const node = mount(); let losses = 0;
      const claim = claimDocxMount(node as unknown as HTMLElement, () => { losses++; }); assert(claim.ok);
      Observer.latest.records.push(new RecordFake([node]));
      assert.equal(claim.value.check?.(), false); assert.equal(losses, 0);
      if (terminal === 'valid') { assert.equal(claim.value.valid(), false); assert.equal(losses, 1); }
      if (terminal === 'release') claim.value.release();
      await Promise.resolve(); assert.equal(losses, terminal === 'release' ? 0 : 1);
      claim.value.valid(); await Promise.resolve(); assert.equal(losses, terminal === 'release' ? 0 : 1);
      claim.value.release();
    }
    const node = mount(); let reads = 0;
    const claim = claimDocxMount(node as unknown as HTMLElement, () => {}); assert(claim.ok);
    for (const key of ['ownerDocument', 'isConnected', 'getRootNode']) Object.defineProperty(node, key, { get() { reads++; throw new Error('author override'); } });
    assert.equal(claim.value.check?.(), true); assert.equal(reads, 0);
    Observer.latest.records = Array.from({ length: 1025 }, () => new RecordFake([]));
    assert.equal(claim.value.check?.(), true);
    node.parent = mount();
    Observer.latest.records = Array.from({ length: 1025 }, () => new RecordFake([]));
    assert.equal(claim.value.check?.(), false); claim.value.release();
    const removed = mount(), other = claimDocxMount(removed as unknown as HTMLElement, () => {}); assert(other.ok);
    Observer.latest.records = [new RecordFake(Array.from({ length: 4097 }, mount))];
    assert.equal(other.value.check?.(), true);
    removed.parent = mount();
    Observer.latest.records = [new RecordFake(Array.from({ length: 4097 }, mount))];
    assert.equal(other.value.check?.(), false); other.value.release();
  } finally {
    restore();
  }
});

test('a mount nested deeper than 128 ancestors, or inside a cyclic ancestry, cannot be claimed', () => {
  const { document, mount, restore, NodeFake, Observer } = installMountFakes();
  try {
    /** A mount with `depth` ancestors above it, the document the last of them. */
    const nested = (depth: number) => {
      let parent = document;
      for (let level = 1; level < depth; level++) {
        const node = new NodeFake();
        node.parent = parent; node.document = document;
        parent = node;
      }
      const node = new NodeFake();
      node.parent = parent; node.document = document;
      return node;
    };
    const refused = { ok: false, code: 'invalid-mount' };
    // The mount and 127 ancestors are the longest chain that can be watched.
    const longest = claimDocxMount(nested(127) as unknown as HTMLElement, () => {});
    assert(longest.ok);
    longest.value.release();
    const deep = nested(128), created = Observer.created;
    assert.deepEqual(claimDocxMount(deep as unknown as HTMLElement, () => {}), refused);
    assert.equal(Observer.created, created, 'a refused claim watches nothing');
    // Nothing stays claimed: once its chain is short enough the same mount can be claimed.
    deep.parent = document;
    const shortened = claimDocxMount(deep as unknown as HTMLElement, () => {});
    assert(shortened.ok);
    shortened.value.release();

    const first = mount(), second = mount();
    first.parent = second; second.parent = first;
    assert.deepEqual(claimDocxMount(first as unknown as HTMLElement, () => {}), refused);
    first.parent = document;
    const repaired = claimDocxMount(first as unknown as HTMLElement, () => {});
    assert(repaired.ok);
    repaired.value.release();
  } finally {
    restore();
  }
});

test('an ownership check that cannot read the mount marks it lost, exactly once', async () => {
  const { mount, restore } = installMountFakes();
  try {
    for (const terminal of ['microtask', 'valid'] as const) {
      const node = mount();
      let losses = 0;
      const claim = claimDocxMount(node as unknown as HTMLElement, () => { losses++; });
      assert(claim.ok);
      assert.equal(claim.value.check?.(), true, terminal);
      node.unreadable = true;
      assert.equal(claim.value.check?.(), false, terminal);
      assert.equal(losses, 0, `${terminal}: the loss is delivered after the check returns`);
      if (terminal === 'valid') { assert.equal(claim.value.valid(), false); assert.equal(losses, 1); }
      await Promise.resolve();
      assert.equal(losses, 1, terminal);
      // A mount that becomes readable again stays lost, and the loss is never delivered twice.
      node.unreadable = false;
      assert.equal(claim.value.check?.(), false, terminal);
      claim.value.valid();
      await Promise.resolve();
      assert.equal(losses, 1, terminal);
      claim.value.release();
    }
  } finally {
    restore();
  }
});
