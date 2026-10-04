import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserDocxPort } from './browser-port.js';
const claimDocxMount = (mount: HTMLElement, lost: () => void) => createBrowserDocxPort({ mount }).claimMount(mount, lost);

test('callback-free mount checks retain exactly-once loss delivery and ignore overridden DOM members', async () => {
  class Nodes {
    constructor(readonly values: NodeFake[]) {}
    get length() { return this.values.length; }
    item(index: number) { return this.values[index] ?? null; }
    [Symbol.iterator]() { return this.values[Symbol.iterator](); }
  }
  class NodeFake {
    parent: NodeFake | null = null; document: NodeFake | null = null; connected = true;
    get ownerDocument() { return this.document; }
    get isConnected() { return this.connected; }
    get parentNode() { return this.parent; }
    get childNodes() { return new Nodes([]); }
    getRootNode() { return this.document ?? this; }
    contains(node: NodeFake) { return node === this; }
  }
  class RecordFake { constructor(readonly removed: NodeFake[]) {} get removedNodes() { return new Nodes(this.removed); } }
  class Observer {
    static latest: Observer;
    records: RecordFake[] = []; disconnected = false;
    constructor(readonly callback: (records: RecordFake[]) => void) { Observer.latest = this; }
    observe() {} disconnect() { this.disconnected = true; }
    takeRecords() { const records = this.records; this.records = []; return records; }
  }
  const document = new NodeFake();
  const values = { document, Node: NodeFake, HTMLElement: NodeFake, NodeList: Nodes, MutationRecord: RecordFake, MutationObserver: Observer };
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  const mount = () => { const node = new NodeFake(); node.parent = document; node.document = document; return node; };
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
    assert.equal(claim.value.check?.(), false); claim.value.release();
    const removed = mount(), other = claimDocxMount(removed as unknown as HTMLElement, () => {}); assert(other.ok);
    Observer.latest.records = [new RecordFake(Array.from({ length: 4097 }, mount))];
    assert.equal(other.value.check?.(), false); other.value.release();
  } finally {
    for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  }
});
