import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
const { readOoxmlPackage } = await import('@docx-editor.dev/core/store');
import { imageFixture } from '../../test/corpus.js';
import { captureImageIntent, copyImage, qualifyImageCommand } from './eigenpal-images.js';
import type { DocxImageAction } from './types.js';

function fixture(kind = 'image-simple') {
  const parsed = readOoxmlPackage(imageFixture(kind));
  assert(parsed.ok); const pkg = structuredClone(parsed.package), part = pkg.parts.get(pkg.mainDocumentPart)!;
  const nodes: OoxmlElement[] = [];
  const collect = (node: OoxmlNode) => { if (node.kind !== 'textValue') { nodes.push(node); node.children.forEach(collect); } };
  collect(part.root);
  const drawing = nodes.find(node => node.localName === 'drawing')!;
  const paragraph = nodes.find(node => node.children.some(run => run.kind !== 'textValue' && run.children.some(child => child === drawing)))!;
  const f = { revision: 0, generation: 0, id: drawing.id, paragraph: paragraph.id, offset: 0, head: 0, scope: 'body', cell: null as object | null, onPackage() {} };
  const surface = { state: () => ({ selection: { anchor: { paragraphId: f.paragraph, offset: f.offset }, head: { paragraphId: f.paragraph, offset: f.head } }, cellSelection: f.cell }),
    drawingSelectionIntent: () => ({ kind: 'pointer', drawingNodeId: f.id }), storyScope: () => ({ kind: f.scope }),
    session: { part: () => part, currentPackage: () => { f.onPackage(); return pkg; }, packageRevision: () => f.revision } };
  const editor = { surface, get mountGeneration() { return f.generation; } } as unknown as DocxEditorInstance;
  const selected = { id: drawing.id, widthEmu: 1524000, heightEmu: 762000, kind: 'inline', wrap: 'inline', hidden: false, resourceStatus: 'ready', position: null,
    hyperlink: null, rotationDegrees: 0, crop: { left: 0, top: 0, right: 0, bottom: 0 }, locks: { select: false, move: false, resize: false, changeAspect: false }, title: 'Title 1', description: 'Description 1' } as NonNullable<ReturnType<DocxEditorInstance['getSelectedImage']>>;
  const copy = copyImage(selected)!;
  const intent = captureImageIntent(editor, copy)!;
  const qualify = (action: DocxImageAction = { type: 'delete-image' }, limits?: Parameters<typeof qualifyImageCommand>[3]) => qualifyImageCommand(editor, intent, action, limits);
  return { f, editor, nodes, pkg, part, drawing, selected, copy, intent, qualify };
}
function attributes(node: OoxmlElement) { return node.attributes as unknown as { namespaceUri: string; localName: string; value: string }[]; }

test('one empty source rectangle is neutral for every image operation without modifying canonical data', () => {
  const h = fixture('image-empty-source'), before = structuredClone(h.pkg);
  for (const action of [
    { type: 'resize-image', widthPoints: 180, heightPoints: 90 },
    { type: 'image-description', title: 'Title', description: 'Description' },
    { type: 'delete-image' },
  ] as const) assert.equal(h.qualify(action).ok, true, action.type);
  assert.deepEqual(h.pkg, before); assert.equal(h.f.revision, 0);
});

test('source rectangle attributes, children, duplicates and namespace lookalikes remain unsupported', () => {
  for (const mutation of ['zero', 'crop', 'text', 'element', 'duplicate', 'namespace']) {
    const h = fixture('image-empty-source'), rectangle = h.nodes.find(node => node.localName === 'srcRect')!;
    if (mutation === 'zero' || mutation === 'crop') attributes(rectangle).push({ namespaceUri: '', localName: 'l', value: mutation === 'zero' ? '0' : '1000' });
    if (mutation === 'text') (rectangle.children as OoxmlNode[]).push({ kind: 'textValue', id: 'rectangle-text', value: ' ' } as OoxmlNode);
    if (mutation === 'element') (rectangle.children as OoxmlNode[]).push({ ...rectangle, id: 'nested-rectangle', children: [] });
    if (mutation === 'duplicate') (h.nodes.find(node => node.localName === 'blipFill')!.children as OoxmlNode[]).push({ ...rectangle, id: 'duplicate-rectangle' });
    if (mutation === 'namespace') (rectangle as { namespaceUri: string }).namespaceUri = 'urn:lookalike';
    const before = structuredClone(h.pkg);
    for (const action of [
      { type: 'resize-image', widthPoints: 180, heightPoints: 90 },
      { type: 'image-description', title: 'Title', description: 'Description' },
      { type: 'delete-image' },
    ] as const) assert.deepEqual(h.qualify(action), { ok: false, code: 'unsupported' }, `${mutation}: ${action.type}`);
    assert.deepEqual(h.pkg, before); assert.equal(h.f.revision, 0);
  }
});

test('plain image commands qualify canonical structure and compare exact committed values before dispatch', () => {
  const h = fixture();
  for (const action of [{ type: 'resize-image', widthPoints: 120, heightPoints: 60 }, { type: 'image-description', title: 'Title 1', description: 'Description 1' }] as const) {
    const result = h.qualify(action); assert(result.ok); assert.equal(result.value.unchanged, true); assert.equal(result.value.valid(), true);
  }
  const resized = h.qualify({ type: 'resize-image', widthPoints: 120.123456, heightPoints: 72 }); assert(resized.ok);
  assert.deepEqual(resized.value.command, { type: 'setImageProperties', drawingNodeId: h.drawing.id, expectedPackageRevision: 0,
    selectionParagraphId: h.f.paragraph, selectionOffset: 0, widthEmu: Math.round(120.123456 * 12700), heightEmu: 914400 });
  assert.equal(resized.value.unchanged, false);
  assert(h.qualify().ok);
  assert(fixture('image-gif').qualify().ok);
  for (const ext of h.nodes.filter(node => ['extent', 'ext'].includes(node.localName))) attributes(ext).find(a => a.localName === 'cx')!.value = '20000000';
  assert(h.qualify().ok, 'delete does not impose authored resize bounds on existing dimensions');
});

test('copied context and complete bounded metadata never leak engine objects or identifiers', () => {
  const h = fixture(); assert.deepEqual(h.copy.context, { widthPoints: 120, heightPoints: 60 });
  assert(Object.isFrozen(h.copy.context)); assert(h.copy.description.ok); assert(Object.isFrozen(h.copy.description.value));
  assert.equal(copyImage(null), null);
  assert.equal(copyImage({ ...h.selected, widthEmu: NaN }), null);
  assert.deepEqual(copyImage({ ...h.selected, title: 'x'.repeat(257) })!.description, { ok: false, code: 'resource-limit' });
  assert.deepEqual(copyImage({ ...h.selected, description: '\ud800' })!.description, { ok: false, code: 'unsupported' });
  for (const patch of [{ hidden: true }, { rotationDegrees: 1 }, { kind: 'anchor' }, { resourceStatus: 'loading' }]) {
    assert.equal(copyImage({ ...h.selected, ...patch } as typeof h.selected)!.supported, false);
  }
});

test('locks, excluded topology, metadata and transformations refuse without canonical changes', () => {
  for (const kind of ['image-picture-lock', 'image-frame-lock', 'image-table', 'image-hidden', 'image-crop', 'image-rotation', 'image-long-metadata']) {
    const h = fixture(kind), before = JSON.stringify(h.part.root);
    assert.deepEqual(h.qualify(), { ok: false, code: kind === 'image-long-metadata' ? 'resource-limit' : 'unsupported' }, kind);
    assert.equal(JSON.stringify(h.part.root), before);
  }
  const h = fixture('image-picture-lock'), lock = h.nodes.find(node => node.localName === 'picLocks')!;
  for (const value of ['true', '1', 'bogus', '']) { attributes(lock)[0]!.value = value; assert.equal(h.qualify().ok, false); }
  for (const value of ['false', '0']) { attributes(lock)[0]!.value = value; assert.equal(h.qualify().ok, true); }
});

test('bounded canonical reads reject each budget before work and preserve original intent', () => {
  for (const limits of [{ parts: 0 }, { nodes: 1 }, { depth: 2 }, { attributes: 0 }, { drawing: 1 }]) {
    assert.deepEqual(fixture().qualify({ type: 'delete-image' }, limits), { ok: false, code: 'resource-limit' });
  }
  for (const change of ['revision', 'generation', 'id', 'paragraph', 'offset', 'head', 'scope', 'cell'] as const) {
    const h = fixture();
    Object.assign(h.f, { [change]: typeof h.f[change] === 'number' ? 1 : change === 'cell' ? {} : 'other' });
    assert.equal(h.intent.valid(), false, change);
    assert.deepEqual(h.qualify(), { ok: false, code: 'stale-selection' });
  }
  const h = fixture(); h.f.onPackage = () => { h.f.revision++; };
  assert.deepEqual(h.qualify(), { ok: false, code: 'stale-selection' });
});

test('malformed, ambiguous, inherited hidden and unsupported media forms fail closed', () => {
  const h = fixture(), blip = h.nodes.find(node => node.localName === 'blip')!;
  attributes(blip)[0]!.value = 'missing'; assert.equal(h.qualify().ok, false);
  const mime = fixture(); (mime.pkg.contentTypes.defaults as Map<string, string>).set('png', 'image/jpeg'); assert.equal(mime.qualify().ok, false);
  const bytes = fixture(); (bytes.pkg.partBytes as Map<string, Uint8Array>).set('/word/media/pixel.png', new Uint8Array([1, 2])); assert.equal(bytes.qualify().ok, false);
  const duplicate = fixture(); (duplicate.drawing.children as OoxmlNode[]).push(duplicate.drawing.children[0]!); assert.equal(duplicate.qualify().ok, false);
  const attrs = fixture(), ext = attrs.nodes.find(node => node.localName === 'extent')!; attributes(ext).push({ ...attributes(ext)[0]! }); assert.equal(attrs.qualify().ok, false);
  const external = fixture(); const relations = external.pkg.relationships.get(external.part.name)!;
  const rel = relations.find(r => r.type.endsWith('/image'))!; Object.assign(rel, { targetMode: 'External' }); assert.equal(external.qualify().ok, false);
});


test('unknown drawing attributes and enabled flip flags refuse even when the public candidate omits them', () => {
  for (const [name, attributeName, value] of [['docPr', 'futureBehavior', '1'], ['xfrm', 'flipH', '1'], ['inline', 'distT', '1']]) {
    const h = fixture(); attributes(h.nodes.find(node => node.localName === name)!).push({ namespaceUri: '', localName: attributeName!, value: value! });
    assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
  }
});

test('duplicate body ownership is ambiguous and refused', () => {
  const h = fixture(), body = h.nodes.find(node => node.localName === 'body')!;
  (h.part.root.children as OoxmlNode[]).push({ ...body, id: 'second-body', children: [] } as OoxmlElement);
  assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
});

test('visibility checks apply to owning properties and refuse inherited hidden styling', () => {
  const h = fixture(), paragraph = h.nodes.find(node => node.id === h.f.paragraph)!;
  const style = { ...paragraph, id: 'sibling-style', localName: 'rStyle', kind: 'generic', children: [] } as OoxmlElement;
  const properties = { ...style, id: 'sibling-properties', localName: 'rPr', children: [style] } as OoxmlElement;
  const sibling = { ...style, id: 'sibling-run', localName: 'r', children: [properties] } as OoxmlElement;
  (paragraph.children as OoxmlNode[]).push(sibling);
  assert(h.qualify().ok, 'an unrelated sibling run does not determine image visibility');
  const owner = h.nodes.find(node => node.children.some(child => child === h.drawing))!;
  (owner.children as OoxmlNode[]).unshift({ ...properties, id: 'own-properties', children: [{ ...style, id: 'own-style' }] } as OoxmlElement);
  assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
  const hidden = fixture();
  (hidden.pkg.parts as Map<string, typeof hidden.part>).set('/word/styles.xml', { ...hidden.part, name: '/word/styles.xml', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml', root: { ...style, localName: 'vanish', id: 'hidden-style' } as OoxmlElement });
  assert.deepEqual(hidden.qualify(), { ok: false, code: 'unsupported' });
});

test('incomplete picture structure refuses rather than synthesizing missing canonical properties', () => {
  for (const name of ['nvPicPr', 'cNvPr', 'cNvPicPr', 'off', 'prstGeom', 'avLst', 'stretch', 'fillRect']) {
    const h = fixture(), node = h.nodes.find(node => node.localName === name)!;
    const parent = h.nodes.find(candidate => candidate.children.some(child => child === node))!;
    (parent.children as OoxmlNode[]).splice(parent.children.findIndex(child => child === node), 1);
    assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' }, name);
  }
});

test('rotation requires numeric neutral spelling and cannot use boolean false', () => {
  const h = fixture(), transform = h.nodes.find(node => node.localName === 'xfrm')!;
  attributes(transform).push({ namespaceUri: '', localName: 'rot', value: 'false' });
  assert.deepEqual(h.qualify(), { ok: false, code: 'unsupported' });
  attributes(transform).at(-1)!.value = '0'; assert(h.qualify().ok);
});


test('plain raster final size is the outer extent while positive inner geometry remains independent', () => {
  const h = fixture(), outer = h.nodes.find(node => node.localName === 'extent')!;
  attributes(outer).find(a => a.localName === 'cx')!.value = '12700';
  attributes(outer).find(a => a.localName === 'cy')!.value = '12700';
  const before = structuredClone(h.pkg);
  const unchanged = h.qualify({ type: 'resize-image', widthPoints: 1, heightPoints: 1 });
  assert(unchanged.ok); assert.equal(unchanged.value.unchanged, true);
  assert(h.qualify({ type: 'resize-image', widthPoints: 1440, heightPoints: 1440 }).ok);
  assert(h.qualify({ type: 'image-description', title: 'After resize', description: '' }).ok);
  assert(h.qualify({ type: 'delete-image' }).ok);
  assert.deepEqual(h.pkg, before);
});
