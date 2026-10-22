import assert from 'node:assert/strict';
import type { OoxmlNode } from '@docx-editor.dev/core/store';
const store = await import('@docx-editor.dev/core/store');
const { blankDocumentBytes } = await import('@docx-editor.dev/core/editor');
import { imageCandidatesInPackage } from '../src/docx/eigenpal-images.js';
import { deriveImageInsertionEngine } from '../src/docx/engine-image-insertion-loader.js';
import { normalizeImageInsertion, normalizeImageReplacement } from '../src/docx/image-insertion-input.js';
import type { DocxResult } from '../src/docx/types.js';
import { docxFixture } from './admission-fixtures.js';
import { imageFixture, imageInsertionBytes } from './corpus.js';

export const valid = (): DocxResult<void> => ({ ok: true, value: undefined });
/** The optional engine capability the preflights run against. */
export const engine = deriveImageInsertionEngine(blankDocumentBytes, store)!;
export const decodePort = { async decode() { return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } };

/** A one-paragraph text document with the insertion caret inside the paragraph. */
export function insertionFixture() {
  const read = store.readOoxmlPackage(docxFixture({ 'word/document.xml': '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body><w:p w14:paraId="00000001" w14:textId="00000001"><w:r><w:t>alpha</w:t></w:r></w:p></w:body></w:document>' })); assert(read.ok);
  const pkg = read.package, body = pkg.parts.get(pkg.mainDocumentPart)!.root.children[0]!; assert(body.kind !== 'textValue');
  const paragraph = body.children[0]!;
  return { pkg, dependencies: engine, target: { paragraphId: paragraph.id, offset: 2 }, signal: new AbortController().signal };
}
/** Owned insertion input for one of the declared raster formats. */
export function insertionSource(kind: 'png' | 'jpeg' | 'gif' = 'png') {
  const checked = normalizeImageInsertion({ bytes: imageInsertionBytes(kind), widthPoints: 48, heightPoints: 24, title: 'A & 😀', description: 'one\ntwo' }, {}, valid);
  assert(checked.ok); return checked.value.source;
}

/** A document with two pictures; the target names the first one. */
export function replacementFixture(kind = 'image-simple') {
  const read = store.readOoxmlPackage(imageFixture(kind)); assert(read.ok);
  const pkg = read.package, candidates = imageCandidatesInPackage(pkg, pkg.parts.get(pkg.mainDocumentPart)!); assert(candidates.ok);
  const stack: { node: OoxmlNode; paragraphId: string }[] = [{ node: pkg.parts.get(pkg.mainDocumentPart)!.root, paragraphId: '' }];
  while (stack.length) {
    const { node, paragraphId } = stack.pop()!; if (node.kind === 'textValue') continue;
    if (node.localName === 'drawing') return { pkg, target: candidates.value.find(value => value.drawingId === node.id) ??
      { drawingId: node.id, paragraphId, width: 0, height: 0, title: '', description: '' } };
    for (const child of [...node.children].reverse()) stack.push({ node: child, paragraphId: node.localName === 'p' ? node.id : paragraphId });
  }
  throw new Error('missing drawing');
}
/** Owned replacement bytes for one of the declared raster formats. */
export function replacementSource(kind: 'png' | 'jpeg' | 'gif' = 'png') {
  const result = normalizeImageReplacement(imageInsertionBytes(kind), {}, valid); assert(result.ok); return result.value.source;
}
