import type { DocxMountOwnership, DocxSessionPort } from './engine-port.js';
import type { DocxResult, DocxSessionOptions } from './types.js';

const claimedMounts = new WeakSet<HTMLElement>();

/** A claim ends on any removal, including removal followed by synchronous reinsertion;
 * a batch too large to scan instead keeps the claim only while the ancestor chain is unchanged. */
function claimDocxMount(mount: HTMLElement, lost: () => void): DocxResult<DocxMountOwnership> {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined' ||
      !(mount instanceof HTMLElement) || claimedMounts.has(mount)) return { ok: false, code: 'invalid-mount' };
  const getter = (prototype: object, key: string) => Object.getOwnPropertyDescriptor(prototype, key)!.get!;
  const ownerDocument = getter(Node.prototype, 'ownerDocument'), connected = getter(Node.prototype, 'isConnected');
  const parent = getter(Node.prototype, 'parentNode'), children = getter(Node.prototype, 'childNodes');
  const root = Node.prototype.getRootNode, takeRecords = MutationObserver.prototype.takeRecords;
  const removedNodes = getter(MutationRecord.prototype, 'removedNodes'), length = getter(NodeList.prototype, 'length');
  const item = NodeList.prototype.item, disconnect = MutationObserver.prototype.disconnect;
  const apply = Reflect.apply, enqueue = queueMicrotask, owner = document;
  if (apply(ownerDocument, mount, []) !== owner || !apply(connected, mount, []) || apply(root, mount, []) !== owner ||
      apply(length, apply(children, mount, []), []) !== 0) return { ok: false, code: 'invalid-mount' };
  const ancestors = new Set<Node>();
  for (let node: Node | null = mount; node; node = apply(parent, node, [])) {
    if (ancestors.size >= 128 || ancestors.has(node)) return { ok: false, code: 'invalid-mount' };
    ancestors.add(node);
  }
  let released = false;
  let invalid = false, delivered = false, queued = false;
  const notify = () => {
    if (released || !invalid || delivered) return;
    delivered = true;
    lost();
  };
  const invalidate = () => {
    invalid = true;
    if (released || queued || delivered) return;
    queued = true;
    enqueue(() => { queued = false; notify(); });
  };
  const chainIntact = () => {
    let depth = 0;
    for (let node: Node | null = mount; node; node = apply(parent, node, [])) if (!ancestors.has(node) || ++depth > ancestors.size) return false;
    return depth === ancestors.size;
  };
  const inspectRecords = (records: MutationRecord[]) => {
    if (released || invalid) return;
    if (apply(ownerDocument, mount, []) !== owner || !apply(connected, mount, []) || apply(root, mount, []) !== owner) {
      invalidate(); return;
    }
    if (records.length > 1024) { if (!chainIntact()) invalidate(); return; }
    let remaining = 4096;
    for (const record of records) {
      const nodes = apply(removedNodes, record, []), count = apply(length, nodes, []);
      if (count > remaining) { if (!chainIntact()) invalidate(); return; }
      remaining -= count;
      for (let i = 0; i < count; i++) {
        const node = apply(item, nodes, [i]);
        if (node && ancestors.has(node)) { invalidate(); return; }
      }
    }
  };
  const observer = new MutationObserver(records => { inspectRecords(records); notify(); });
  // Only removals along the captured ownership chain matter. Watching the whole
  // document subtree would process every painted text node in every editor.
  for (const ancestor of ancestors) {
    if (ancestor !== mount) observer.observe(ancestor, { childList: true });
  }
  claimedMounts.add(mount);
  const check = () => {
    try { inspectRecords(apply(takeRecords, observer, [])); }
    catch { invalidate(); }
    return !released && !invalid;
  };
  return { ok: true, value: {
    check,
    valid() {
      const valid = check(); notify(); return valid;
    },
    release() {
      if (released) return;
      released = true;
      apply(disconnect, observer, []);
      claimedMounts.delete(mount);
    },
  } };
}

export function createBrowserDocxPort(options: DocxSessionOptions): DocxSessionPort {
  let ownership: DocxMountOwnership | null = null;
  return {
    claimMount(mount, lost) {
      const result = claimDocxMount(mount, lost);
      if (result.ok) ownership = result.value;
      return result;
    },
    async open(source, operation) {
      if (operation.signal.aborted) return { ok: false, code: 'aborted' };
      const [{ admitDocx }, { openEigenpalDocument }] = await Promise.all([import('./admission.js'), import('./eigenpal-adapter.js')]);
      if (source.kind === 'docx') {
        const admission = await admitDocx(source.bytes, operation.signal);
        if (!admission.ok) return admission;
      }
      if (operation.signal.aborted) return { ok: false, code: 'aborted' };
      if (!ownership?.valid()) return { ok: false, code: 'invalid-mount' };
      return openEigenpalDocument(options, source, operation, () => ownership?.valid() ?? false, undefined,
        () => ownership?.check?.() ?? false);
    },
  };
}
