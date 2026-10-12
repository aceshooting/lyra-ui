import type { ImageDecodePort, OoxmlNode, OoxmlPackage } from '@docx-editor.dev/core/store';
import type { ImageInsertionEngine } from './engine-image-insertion-loader.js';
import type { OwnedDocxImageReplacement } from './image-insertion-input.js';
import { imageCandidatesInPackage } from './eigenpal-images.js';
import { admitDocx } from './admission.js';
import type { DocxResult } from './types.js';

const MAX_ZIP = 16 * 1024 * 1024;

/** Bound candidate allocation independently of the selected-picture grammar. */
function boundedPackage(pkg: OoxmlPackage, source: OwnedDocxImageReplacement): boolean {
  if (pkg.parts.size > 128 || pkg.partBytes.size > 2046 || source.bytes.length > 4 * 1024 * 1024) return false;
  let bytes = source.bytes.length + 262144, nodes = 0;
  for (const [name, value] of pkg.partBytes) {
    if (name.length > 1024 || value.length > MAX_ZIP) return false;
    bytes += value.length + name.length * 6;
    if (bytes > 64 * 1024 * 1024) return false;
  }
  for (const part of pkg.parts.values()) {
    const stack: { node: OoxmlNode; depth: number }[] = [{ node: part.root, depth: 0 }], seen = new Set<string>();
    while (stack.length) {
      const { node, depth } = stack.pop()!;
      if (++nodes > 20000 || depth >= 64 || seen.has(node.id)) return false;
      seen.add(node.id);
      if (node.kind === 'textValue') bytes += node.value.length * 6;
      else {
        if (node.attributes.length > 64 || node.namespaceBindings.length > 64 || node.children.length + stack.length > 20000 - nodes) return false;
        bytes += 1024 + 6 * (node.namespaceUri.length + node.localName.length);
        for (const attr of node.attributes) bytes += 16 + 6 * (attr.namespaceUri.length + attr.localName.length + attr.value.length);
        for (const binding of node.namespaceBindings) bytes += 16 + 6 * (binding.prefix.length + binding.namespaceUri.length);
        for (const child of node.children) stack.push({ node: child, depth: depth + 1 });
      }
      if (bytes > 64 * 1024 * 1024) return false;
    }
  }
  return true;
}

/** Validate an isolated replacement, preserving the selected image's layout and metadata. */
export async function preflightImageReplacement(pkg: OoxmlPackage,
  target: Readonly<{ drawingId: string; paragraphId: string }>, source: OwnedDocxImageReplacement,
  dependencies: ImageInsertionEngine, decodePort: ImageDecodePort,
  validate: () => DocxResult<void>, signal: AbortSignal): Promise<DocxResult<void>> {
  const current = (): DocxResult<void> => {
    const owner = validate();
    return owner.ok && signal.aborted ? { ok: false, code: 'aborted' } : owner;
  };
  try {
    const initial = current(); if (!initial.ok) return initial;
    if (!boundedPackage(pkg, source)) return { ok: false, code: 'resource-limit' };
    const part = pkg.parts.get(pkg.mainDocumentPart);
    if (!part) return { ok: false, code: 'unsupported' };
    const before = imageCandidatesInPackage(pkg, part);
    if (!before.ok) return before;
    const original = before.value.find(value => value.drawingId === target.drawingId && value.paragraphId === target.paragraphId);
    if (!original) return { ok: false, code: 'unsupported' };
    const qualified = current(); if (!qualified.ok) return qualified;
    const candidate = new dependencies.TreePackageStore(pkg, part, { historyLimit: 1, maxEditableStoryParts: 1 });
    const replaced = await candidate.replaceImage({ kind: 'body' }, target.drawingId, source.bytes,
      source.metadata.mimeType, decodePort, { expectedPackageRevision: 0, commitGuard: () => current().ok });
    const decoded = current(); if (!decoded.ok) return decoded;
    if (!replaced.ok) return { ok: false, code: replaced.reason === 'resource-limit' ? 'resource-limit' : 'invalid-document' };
    if (!replaced.change) return { ok: false, code: 'engine-failed' };
    const updated = candidate.currentPackage(), updatedPart = updated.parts.get(updated.mainDocumentPart);
    if (!updatedPart) return { ok: false, code: 'engine-failed' };
    const after = imageCandidatesInPackage(updated, updatedPart);
    if (!after.ok) return after;
    const actual = after.value.find(value => value.drawingId === target.drawingId);
    if (!actual || actual.paragraphId !== original.paragraphId || actual.width !== original.width || actual.height !== original.height ||
        actual.title !== original.title || actual.description !== original.description) return { ok: false, code: 'unsupported' };
    const bytes = dependencies.writeOoxmlPackage(updated);
    const serialized = current(); if (!serialized.ok) return serialized;
    if (bytes.length > MAX_ZIP) return { ok: false, code: 'resource-limit' };
    const admitted = await admitDocx(bytes, signal);
    const checked = current(); if (!checked.ok) return checked;
    if (!admitted.ok) return admitted;
    const zip = dependencies.readZip(bytes);
    const complete = current(); if (!complete.ok) return complete;
    if (!zip.ok) return { ok: false, code: zip.reason === 'too-large' || zip.reason === 'too-many-entries' ? 'resource-limit' : 'invalid-document' };
    return { ok: true, value: undefined };
  } catch {
    const failure = current();
    return failure.ok ? { ok: false, code: 'engine-failed' } : failure;
  }
}
