import type { ImageDecodePort, OoxmlPackage } from '@docx-editor.dev/core/store';
import type { ImageInsertionEngine } from './engine-image-insertion-loader.js';
import type { OwnedDocxImageInput } from './image-insertion-input.js';
import type { DocxResult } from './types.js';
import { qualifyImageInsertionPackage } from './eigenpal-image-insertion-profile.js';
import { admitDocx } from './admission.js';

/** Qualify one isolated candidate; no live document mutation occurs here. */
export async function preflightImageInsertion(pkg: OoxmlPackage,
  target: Readonly<{ paragraphId: string; offset: number }>, source: OwnedDocxImageInput,
  dependencies: ImageInsertionEngine, decodePort: ImageDecodePort,
  validate: () => DocxResult<void>, signal: AbortSignal): Promise<DocxResult<void>> {
  const current = (): DocxResult<void> => {
    const owner = validate();
    return owner.ok && signal.aborted ? { ok: false, code: 'aborted' } : owner;
  };
  const original = current(); if (!original.ok) return original;
  const profile = qualifyImageInsertionPackage(pkg, target, { mediaBytes: source.bytes.length,
    pixelWidth: source.metadata.pixelWidth, pixelHeight: source.metadata.pixelHeight,
    titleLength: source.title.length, descriptionLength: source.description.length }, dependencies);
  if (!profile.ok) return profile;
  const before = current(); if (!before.ok) return before;
  let candidate: InstanceType<ImageInsertionEngine['TreePackageStore']> | null = null;
  let bytes: Uint8Array | null = null;
  try {
    candidate = new dependencies.TreePackageStore(pkg, pkg.parts.get(pkg.mainDocumentPart)!, { historyLimit: 1, maxEditableStoryParts: 1 });
    const inserted = await candidate.insertImage({ kind: 'body' }, { ...target, bytes: source.bytes, mime: source.metadata.mimeType,
      widthPoints: source.widthPoints, heightPoints: source.heightPoints, title: source.title, description: source.description,
      expectedPackageRevision: 0, decodePort, commitGuard: () => current().ok });
    const decoded = current(); if (!decoded.ok) return decoded;
    if (!inserted.ok) return { ok: false, code: inserted.reason === 'resource-limit' ? 'resource-limit' : 'invalid-document' };
    if (!inserted.change) return { ok: false, code: 'engine-failed' };
    bytes = dependencies.writeOoxmlPackage(candidate.currentPackage());
    candidate = null;
    const serialized = current(); if (!serialized.ok) return serialized;
    if (bytes.length > 4194304 || bytes.length > profile.value.upperZipBytes) return { ok: false, code: 'resource-limit' };
    const admitted = await admitDocx(bytes, signal);
    const afterAdmission = current(); if (!afterAdmission.ok) return afterAdmission;
    if (!admitted.ok) return admitted;
    const zip = dependencies.readZip(bytes);
    const afterZip = current(); if (!afterZip.ok) return afterZip;
    if (!zip.ok) return { ok: false, code: zip.reason === 'too-large' || zip.reason === 'too-many-entries' ? 'resource-limit' : 'invalid-document' };
    return { ok: true, value: undefined };
  } catch {
    const failure = current();
    return failure.ok ? { ok: false, code: 'engine-failed' } : failure;
  } finally {
    candidate = null; bytes = null;
  }
}
