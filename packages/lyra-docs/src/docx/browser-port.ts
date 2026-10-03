import { admitDocx } from './admission.js';
import { openEigenpalDocument } from './eigenpal-adapter.js';
import type { DocxMountOwnership, DocxSessionPort } from './engine-port.js';
import type { DocxResult, DocxSessionOptions } from './types.js';

const claimedMounts = new WeakSet<HTMLElement>();

/** A claim ends on any removal, including removal followed by synchronous reinsertion. */
function claimDocxMount(mount: HTMLElement, lost: () => void): DocxResult<DocxMountOwnership> {
  if (typeof document === 'undefined' || typeof HTMLElement === 'undefined' ||
      !(mount instanceof HTMLElement) || mount.ownerDocument !== document ||
      !mount.isConnected || mount.getRootNode() !== document || mount.childNodes.length !== 0 ||
      claimedMounts.has(mount)) return { ok: false, code: 'invalid-mount' };
  const ancestors = new Set<Node>();
  for (let node: Node | null = mount; node; node = node.parentNode) ancestors.add(node);
  let released = false;
  let invalid = false;
  const inspectRecords = (records: MutationRecord[]) => {
    if (released || invalid) return;
    if (mount.ownerDocument !== document || !mount.isConnected || mount.getRootNode() !== document ||
        records.some(record => [...record.removedNodes].some(node => ancestors.has(node) || node.contains(mount)))) {
      invalid = true;
      lost();
    }
  };
  const observer = new MutationObserver(inspectRecords);
  // Only removals along the captured ownership chain matter. Watching the whole
  // document subtree would process every painted text node in every editor.
  for (const ancestor of ancestors) {
    if (ancestor !== mount) observer.observe(ancestor, { childList: true });
  }
  claimedMounts.add(mount);
  return { ok: true, value: {
    valid() {
      inspectRecords(observer.takeRecords());
      return !released && !invalid;
    },
    release() {
      if (released) return;
      released = true;
      observer.disconnect();
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
      if (source.kind === 'docx') {
        const admission = await admitDocx(source.bytes, operation.signal);
        if (!admission.ok) return admission;
      }
      if (operation.signal.aborted) return { ok: false, code: 'aborted' };
      if (!ownership?.valid()) return { ok: false, code: 'invalid-mount' };
      return openEigenpalDocument(options, source, operation, () => ownership?.valid() ?? false);
    },
  };
}
