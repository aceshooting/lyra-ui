import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlElement, OoxmlNode } from '@docx-editor.dev/core/store';
import { elementAttributes as attributes, qualificationFixture as fixture } from '../../test/image-qualification-harness.js';
import { copyImage, imageCandidates, imageCandidatesInPackage } from './eigenpal-images.js';
import type { DocxImageAction } from './types.js';

test('package picture inspection preserves navigation results, limits and canonical bytes without a surface', () => {
  for (const kind of ['image-simple', 'image-empty-source', 'image-gif', 'image-crop', 'image-table']) {
    const h = fixture(kind), before = structuredClone(h.pkg);
    for (const limits of [{}, { candidates: 0 }, { attempts: 0 }, { mediaBytes: 1 }, { nodes: 1 }]) {
      assert.deepEqual(imageCandidatesInPackage(h.pkg, h.part, limits), imageCandidates(h.editor, limits), kind);
      assert.deepEqual(h.pkg, before);
    }
  }
  const h = fixture(), foreign = { ...h.part };
  assert.deepEqual(imageCandidatesInPackage(h.pkg, foreign), { ok: false, code: 'unsupported' });
});

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
  for (const kind of ['image-picture-lock', 'image-frame-lock', 'image-hidden', 'image-crop', 'image-rotation', 'image-long-metadata']) {
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
  assert(h.qualify().ok, 'a named run style cannot hide the picture once styles carry no hidden rules');
  (owner.children[0] as unknown as { children: OoxmlNode[] }).children.push({ ...style, id: 'own-vanish', localName: 'vanish' } as OoxmlElement);
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

test('Word-authored picture markup and table-cell pictures qualify for every image action without canonical changes', () => {
  for (const kind of ['image-word', 'image-table']) {
    const h = fixture(kind), before = JSON.stringify(h.part.root);
    for (const action of [{ type: 'delete-image' }, { type: 'resize-image', widthPoints: 60, heightPoints: 30 },
      { type: 'image-description', title: 'T', description: 'D' }] as DocxImageAction[]) {
      assert.equal(h.qualify(action).ok, true, `${kind} ${action.type}`);
    }
    assert.equal(JSON.stringify(h.part.root), before);
    const candidates = imageCandidatesInPackage(h.pkg, h.part);
    assert.equal(candidates.ok && candidates.value.length, 2, kind);
  }
  assert.ok(copyImage({ ...fixture('image-word').selected, locks: { select: false, move: false, resize: false, changeAspect: true } })?.supported);
  assert.equal(copyImage({ ...fixture('image-word').selected, locks: { select: false, move: false, resize: true, changeAspect: true } })?.supported, false);
});

test('Word extension lists must be well-formed, unique a:ext records', () => {
  const h = fixture('image-word'), list = h.nodes.find(node => node.localName === 'extLst')!;
  const entries = list.children as unknown as OoxmlNode[], entry = entries[0] as OoxmlElement;
  entries.push(structuredClone(entry)); assert.equal(h.qualify().ok, false, 'duplicate extension uri');
  entries.pop(); attributes(entry)[0]!.value = 'urn:not-a-guid'; assert.equal(h.qualify().ok, false, 'non-GUID extension uri');
  attributes(entry)[0]!.value = '{FF2B5EF4-FFF2-40B4-BE49-F238E27FC236}'; assert.equal(h.qualify().ok, true);
  const inline = h.nodes.find(node => node.localName === 'inline')!;
  attributes(inline).find(value => value.localName === 'anchorId')!.value = 'nothex!!'; assert.equal(h.qualify().ok, false, 'malformed wp14 id');
});

// Count only storage of the actual fixture relationship records, never unrelated maps.
function relationshipStorage(records: readonly object[], operation: () => void): number {
  const identities = new Set(records), original = Map.prototype.set;
  let stored = 0;
  Map.prototype.set = function <K, V>(this: Map<K, V>, key: K, value: V): Map<K, V> {
    if (value !== null && typeof value === 'object' && identities.has(value)) stored++;
    return original.call(this, key, value) as Map<K, V>;
  };
  try { operation(); } finally { Map.prototype.set = original; }
  return stored;
}

for (const mode of ['navigation', 'command'] as const) {
  test(`one image ${mode} avoids storing the relationship table and retains refusals`, () => {
    for (const scenario of ['valid', 'duplicate', 'limited', 'sparse'] as const) {
      const h = fixture(), records = h.pkg.relationships.get(h.part.name)!;
      // Keep the selected drawing in the actual tree; the corpus also contains a second image.
      const drawings = h.nodes.filter(node => node.namespaceUri === h.drawing.namespaceUri && node.localName === 'drawing');
      for (const drawing of drawings) {
        if (drawing === h.drawing) continue;
        const parent = h.nodes.find(node => (node.children as readonly OoxmlNode[]).includes(drawing));
        assert.ok(parent, 'each extra drawing has an authored parent');
        const children = parent.children as OoxmlNode[];
        children.splice(children.indexOf(drawing), 1);
      }
      assert.equal(h.nodes.filter(node => (node.children as readonly OoxmlNode[]).includes(h.drawing)).length, 1);
      const image = records.find(record => record.type.endsWith('/image'))!;
      const many = Array.from({ length: 9998 }, (_, index) => ({ ...image, id: `unrelated-${index}` }));
      const entries = [...many, image];
      if (scenario === 'duplicate') entries.push({ ...image });
      if (scenario === 'sparse') entries.length++;
      (h.pkg.relationships as Map<string, readonly typeof image[]>).set(h.part.name, entries);
      let visits = 0;
      for (const record of entries) {
        if (!record) continue;
        const id = record.id;
        Object.defineProperty(record, 'id', { configurable: true, get() { visits++; return id; } });
      }
      const limits = scenario === 'limited' ? { nodes: 100 } : {};
      const stored = relationshipStorage(entries, () => {
        const result = mode === 'navigation' ? imageCandidatesInPackage(h.pkg, h.part, limits) : h.qualify({ type: 'delete-image' }, limits);
        if (scenario === 'limited') assert.deepEqual(result, { ok: false, code: 'resource-limit' });
        else if (scenario === 'duplicate') {
          if (mode === 'navigation') assert.deepEqual(result, { ok: true, value: [] });
          else assert.deepEqual(result, { ok: false, code: 'unsupported' });
        } else {
          assert.equal(result.ok, true);
          if (mode === 'navigation' && result.ok) assert.equal((result.value as readonly unknown[]).length, 1);
        }
      });
      assert.equal(stored, 0, `${scenario}: a single lookup must not populate a relationship map`);
      assert.equal(visits, scenario === 'limited' ? 0 : entries.filter(Boolean).length,
        `${scenario}: scan each present relationship exactly once, or reject the cap before scanning`);
    }
  });
}
