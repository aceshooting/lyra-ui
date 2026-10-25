import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode, RelationshipRecord } from '@docx-editor.dev/core/store';
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

type NavigationFixture = ReturnType<typeof fixture>;
function relationships(h: NavigationFixture): RelationshipRecord[] {
  return h.pkg.relationships.get(h.part.name)! as RelationshipRecord[];
}
function countRelationshipIds(h: NavigationFixture): () => number {
  let visits = 0;
  for (const relation of relationships(h)) {
    const id = relation.id;
    Object.defineProperty(relation, 'id', { configurable: true, enumerable: true, get() { visits++; return id; } });
  }
  return () => visits;
}
function padRelationships(h: NavigationFixture, count: number): void {
  const records = relationships(h), template = records[0]!;
  while (records.length < count) records.push({ ...template, id: `rIdUnused${records.length}` });
}

test('each image query visits relationship ids once while preserving ordered navigation and wrapping', () => {
  const h = fixture(); padRelationships(h, 100);
  const visits = countRelationshipIds(h), count = relationships(h).length;
  const candidates = imageCandidates(h.editor); assert(candidates.ok);
  assert.deepEqual(candidates.value.map(item => item.drawingId), h.drawings.map(item => item.id));
  assert.equal(visits(), count, 'two drawings share one complete relationship traversal');
  const first = candidates.value[0]!, last = candidates.value[1]!;
  const cases = [
    { current: null, direction: 'next', expected: first },
    { current: first.drawingId, direction: 'next', expected: last },
    { current: last.drawingId, direction: 'next', expected: first },
    { current: first.drawingId, direction: 'previous', expected: last },
    { current: null, direction: 'previous', expected: last },
  ] as const;
  for (const [index, item] of cases.entries()) {
    assert.deepEqual(target(selectImageTarget(h.editor, item.current, item.direction)), {
      drawingId: item.expected.drawingId, paragraphId: item.expected.paragraphId, unchanged: false,
    });
    assert.equal(visits(), count * (index + 2), 'each explicit query rebuilds its own index');
  }
});

test('image relationship ambiguity and media refusals retain their navigation outcomes', () => {
  const changes: readonly (readonly [string, (h: NavigationFixture) => void])[] = [
    ['identical duplicate id', h => { const records = relationships(h); records.push({ ...records.find(r => r.type.endsWith('/image'))! }); }],
    ['three identical duplicate ids', h => { const records = relationships(h), image = records.find(r => r.type.endsWith('/image'))!; records.push({ ...image }, { ...image }); }],
    ['conflicting duplicate id', h => { const records = relationships(h); records.push({ ...records.find(r => r.type.endsWith('/image'))!, rawTarget: 'media/other.png' }); }],
    ['missing relationship', h => { (h.pkg.relationships as Map<string, readonly RelationshipRecord[]>).delete(h.part.name); }],
    ['external relationship', h => { Object.assign(relationships(h).find(r => r.type.endsWith('/image'))!, { targetMode: 'External' }); }],
    ['wrong relationship type', h => { Object.assign(relationships(h).find(r => r.type.endsWith('/image'))!, { type: 'urn:not-an-image' }); }],
    ['escaping target', h => { Object.assign(relationships(h).find(r => r.type.endsWith('/image'))!, { rawTarget: '../../outside.png' }); }],
    ['missing target bytes', h => { (h.pkg.partBytes as Map<string, Uint8Array>).delete('/word/media/pixel.png'); }],
    ['mismatched MIME', h => { (h.pkg.contentTypes.defaults as Map<string, string>).set('png', 'image/jpeg'); }],
    ['unsupported bytes', h => { (h.pkg.partBytes as Map<string, Uint8Array>).set('/word/media/pixel.png', new Uint8Array([1, 2])); }],
  ];
  for (const [label, change] of changes) {
    const h = fixture(); change(h);
    assert.deepEqual(imageCandidates(h.editor), { ok: true, value: [] }, label);
    assert.deepEqual(selectImageTarget(h.editor, null, 'next'), { ok: false, code: 'no-selection' }, label);
  }
  const unrelated = fixture(), records = relationships(unrelated);
  records.push({ ...records.find(r => !r.type.endsWith('/image'))! });
  const candidates = imageCandidates(unrelated.editor); assert(candidates.ok);
  assert.deepEqual(candidates.value.map(item => item.drawingId), unrelated.drawings.map(item => item.id), 'an unqueried ambiguous id does not reject valid images');
});

test('relationship indexing stays lazy, bounded, and local to each query', () => {
  const limited = fixture(); padRelationships(limited, 501);
  const limitedVisits = countRelationshipIds(limited);
  assert.deepEqual(imageCandidates(limited.editor, { nodes: 500 }), { ok: false, code: 'resource-limit' });
  assert.equal(limitedVisits(), 0, 'reject the relationship budget before indexing entries');
  const empty = fixture(); padRelationships(empty, 501);
  for (const node of empty.nodes) (node.children as OoxmlNode[]).splice(0, node.children.length,
    ...node.children.filter(child => child.kind === 'textValue' || child.localName !== 'drawing'));
  const emptyVisits = countRelationshipIds(empty);
  assert.deepEqual(imageCandidates(empty.editor, { nodes: 500 }), { ok: true, value: [] });
  assert.equal(emptyVisits(), 0, 'no relationship access is needed without a qualifying drawing');
  const h = fixture(), records = relationships(h), image = records.find(r => r.type.endsWith('/image'))!;
  assert.equal(selectImageTarget(h.editor, null, 'next').ok, true);
  records.push({ ...image });
  assert.deepEqual(selectImageTarget(h.editor, null, 'next'), { ok: false, code: 'no-selection' }, 'same-array mutation is visible to the next query');
  records.pop(); assert.equal(selectImageTarget(h.editor, null, 'next').ok, true);
  const bytes = h.pkg.partBytes.get('/word/media/pixel.png')!;
  const shared = imageCandidates(h.editor, { mediaBytes: bytes.length }); assert(shared.ok); assert.equal(shared.value.length, 2);
  assert.deepEqual(imageCandidates(h.editor, { mediaBytes: bytes.length - 1 }), { ok: false, code: 'resource-limit' });
  (h.pkg.partBytes as Map<string, Uint8Array>).set('/word/media/pixel.png', new Uint8Array(4 * 1024 * 1024 + 1));
  assert.deepEqual(imageCandidates(h.editor), { ok: false, code: 'resource-limit' });
});

test('relationship indexing retains sparse-entry and prototype-like id lookup parity', () => {
  const sparse = fixture(); relationships(sparse).length++;
  const supported = imageCandidates(sparse.editor); assert(supported.ok); assert.equal(supported.value.length, 2);
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const h = fixture(); Object.assign(relationships(h).find(r => r.type.endsWith('/image'))!, { id });
    for (const blip of h.nodes.filter(node => node.localName === 'blip')) {
      const embed = blip.attributes.find(attribute => attribute.localName === 'embed'); assert(embed);
      Object.assign(embed, { value: id });
    }
    const candidates = imageCandidates(h.editor); assert(candidates.ok); assert.equal(candidates.value.length, 2, id);
  }
});
