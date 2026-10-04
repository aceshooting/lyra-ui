import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const { readOoxmlPackage } = await import('@docx-editor.dev/core/store');
import { imageFixture } from '../../test/corpus.js';
import { imageCandidates } from './eigenpal-images.js';
import { selectImageTarget } from './eigenpal-image-navigation.js';

function fixture(kind = 'image-simple') {
  const parsed = readOoxmlPackage(imageFixture(kind)); assert(parsed.ok);
  const pkg = structuredClone(parsed.package), part = pkg.parts.get(pkg.mainDocumentPart)!;
  const nodes: OoxmlElement[] = [];
  const collect = (node: OoxmlNode) => { if (node.kind !== 'textValue') { nodes.push(node); node.children.forEach(collect); } }; collect(part.root);
  const drawings = nodes.filter(node => node.localName === 'drawing');
  let reads = 0;
  const editor = { surface: { session: { currentPackage: () => { reads++; return pkg; }, part: () => part } } } as unknown as DocxEditorInstance;
  return { pkg, part, nodes, drawings, editor, reads: () => reads };
}
function target(result: ReturnType<typeof selectImageTarget>) { assert(result.ok); return result.value; }

test('image navigation chooses document order, wraps, and copies only private target identities', () => {
  const h = fixture(), before = structuredClone(h.pkg);
  const first = target(selectImageTarget(h.editor, null, 'next'));
  const last = target(selectImageTarget(h.editor, null, 'previous'));
  assert.equal(first.drawingId, h.drawings[0]!.id); assert.equal(last.drawingId, h.drawings[1]!.id);
  assert.equal(first.unchanged, false);
  assert.equal(target(selectImageTarget(h.editor, first.drawingId, 'next')).drawingId, last.drawingId);
  assert.equal(target(selectImageTarget(h.editor, last.drawingId, 'next')).drawingId, first.drawingId);
  assert.equal(target(selectImageTarget(h.editor, first.drawingId, 'previous')).drawingId, last.drawingId);
  assert.deepEqual(h.pkg, before); assert.equal(h.reads(), 5);
});

test('navigation skips unsupported structures and keeps singleton selection unchanged', () => {
  const table = fixture('image-table');
  assert.equal(target(selectImageTarget(table.editor, null, 'next')).drawingId, table.drawings[0]!.id, 'table-cell pictures are navigable');
  for (const kind of ['image-picture-lock', 'image-frame-lock', 'image-hidden', 'image-crop', 'image-rotation']) {
    const h = fixture(kind), selected = target(selectImageTarget(h.editor, null, 'next'));
    assert.equal(selected.drawingId, h.drawings[1]!.id, kind);
    assert.equal(target(selectImageTarget(h.editor, selected.drawingId, 'next')).unchanged, true, kind);
  }
  const empty = fixture();
  for (const node of empty.nodes) (node.children as OoxmlNode[]).splice(0, node.children.length, ...node.children.filter(child => child.kind === 'textValue' || child.localName !== 'drawing'));
  assert.deepEqual(selectImageTarget(empty.editor, null, 'next'), { ok: false, code: 'no-selection' });
});


test('navigation budgets fail before selection and deduplicate shared media inspection', () => {
  const h = fixture(), bytes = h.pkg.partBytes.get('/word/media/pixel.png')!;
  for (const limits of [{ candidates: 1 }, { attempts: 1 }, { mediaBytes: bytes.length - 1 }, { nodes: 3 }, { depth: 2 }, { parts: 1 }]) {
    assert.deepEqual(imageCandidates(h.editor, limits), { ok: false, code: 'resource-limit' });
  }
  const result = imageCandidates(h.editor, { mediaBytes: bytes.length }); assert(result.ok); assert.equal(result.value.length, 2);
  const before = structuredClone(h.pkg);
  assert.equal(selectImageTarget(h.editor, null, 'next').ok, true);
  assert.deepEqual(h.pkg, before);
});

test('ambiguous document structure and global inherited hidden styles refuse navigation', () => {
  const h = fixture(), body = h.nodes.find(node => node.localName === 'body')!;
  (h.part.root.children as OoxmlNode[]).push({ ...body, id: 'another-body', children: [] });
  assert.deepEqual(selectImageTarget(h.editor, null, 'next'), { ok: false, code: 'unsupported' });
  const hidden = fixture();
  (hidden.pkg.parts as Map<string, typeof hidden.part>).set('/word/styles.xml', { ...hidden.part, name: '/word/styles.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml', root: { ...body, id: 'hidden', localName: 'vanish', children: [] } as OoxmlElement });
  assert.deepEqual(selectImageTarget(hidden.editor, null, 'next'), { ok: false, code: 'unsupported' });
});
