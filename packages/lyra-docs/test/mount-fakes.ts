/**
 * Minimal DOM doubles for mount ownership: only the members the browser port reads from the platform
 * prototypes, installed as globals for one test and restored afterwards.
 */

export class Nodes {
  constructor(readonly values: NodeFake[]) {}
  get length() { return this.values.length; }
  item(index: number) { return this.values[index] ?? null; }
  [Symbol.iterator]() { return this.values[Symbol.iterator](); }
}

export class NodeFake {
  parent: NodeFake | null = null; document: NodeFake | null = null; connected = true;
  /** While set, reading the node's owner document throws, as a node the platform can no longer inspect would. */
  unreadable = false;
  get ownerDocument() { if (this.unreadable) throw new Error('unreadable node'); return this.document; }
  get isConnected() { return this.connected; }
  get parentNode() { return this.parent; }
  get childNodes() { return new Nodes([]); }
  getRootNode() { return this.document ?? this; }
  contains(node: NodeFake) { return node === this; }
}

export class RecordFake {
  constructor(readonly removed: NodeFake[]) {}
  get removedNodes() { return new Nodes(this.removed); }
}

export class Observer {
  static latest: Observer;
  /** How many observers were ever constructed. */
  static created = 0;
  records: RecordFake[] = []; disconnected = false;
  constructor(readonly callback: (records: RecordFake[]) => void) { Observer.latest = this; Observer.created++; }
  observe() {} disconnect() { this.disconnected = true; }
  takeRecords() { const records = this.records; this.records = []; return records; }
}

export function installMountFakes() {
  const document = new NodeFake();
  const values = { document, Node: NodeFake, HTMLElement: NodeFake, NodeList: Nodes, MutationRecord: RecordFake, MutationObserver: Observer };
  const previous = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, value });
  /** A node attached directly to the document. */
  const mount = () => { const node = new NodeFake(); node.parent = document; node.document = document; return node; };
  const restore = () => {
    for (const [key, value] of previous) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  };
  return { document, mount, restore, NodeFake, RecordFake, Observer };
}
