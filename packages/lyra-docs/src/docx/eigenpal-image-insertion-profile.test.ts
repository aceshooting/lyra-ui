import assert from 'node:assert/strict';
import test from 'node:test';
import { strFromU8, strToU8, unzipSync } from 'fflate';
import { imageInsertionBytes } from '../../test/corpus.js';
import {
  MAIN, TYPES, W, W14, attrs, budget, children, customStyledCell, dependencies, fixture, limited,
  pictureFixture, styledCell, unsupported, withStyles,
} from '../../test/image-profile-fixtures.js';
import type { OoxmlElement } from '@docx-editor.dev/core/store';
const { readOoxmlPackage, readOoxmlPart, writeOoxmlPackage, TreePackageStore } = await import('@docx-editor.dev/core/store');
import { admitDocx } from './admission.js';
import { qualifyImageInsertionPackage } from './eigenpal-image-insertion-profile.js';

test('normalized body qualifies with bounded ZIP output and no canonical CT or mutation', () => {
  const h = fixture(), before = structuredClone(h.pkg), result = h.check(); assert(result.ok);
  assert(Object.isFrozen(result.value)); assert(result.value.upperZipBytes < 16777216); assert.deepEqual(h.pkg, before);
  assert.equal(h.pkg.parts.has(TYPES), false); const saved = writeOoxmlPackage(h.pkg); assert(saved.length < result.value.upperZipBytes);
});
test('bad raw CT is refused before public parsing', () => {
  for (const change of [(s: string) => s.replace('<Types ', '<Types unknown="0" '), (s: string) => s + ' '.repeat(65536),
    (s: string) => '<!DOCTYPE Types>' + s, (s: string) => s.replace('</Types>', '<!--x--></Types>'),
    (s: string) => s.replace('</Types>', '<![CDATA[ ]]></Types>'), (s: string) => s.replace('</Types>', '\r</Types>')]) {
    const h = fixture(); h.rawCt(change(new TextDecoder().decode(h.pkg.partBytes.get(TYPES)!))); let calls = 0;
    const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies, readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } });
    assert.equal(result.ok, false); assert.equal(calls, 0);
  }
});
test('CT canonical shadow, normalized map mismatch and lexical retention are handled exactly', () => {
  const h = fixture(); (h.pkg.parts as Map<string, unknown>).set(TYPES, h.pkg.parts.get(MAIN)!); assert.deepEqual(h.check(), unsupported);
  const m = fixture(); (m.pkg.contentTypes.defaults as Map<string, string>).set('png', 'image/png'); assert.deepEqual(m.check(), unsupported);
  const a = fixture(), b = fixture(); b.rawCt(new TextDecoder().decode(b.pkg.partBytes.get(TYPES)!).replace('<Types ', '<Types' + ' '.repeat(40000)));
  const small = a.check(), large = b.check(); assert(small.ok && large.ok); assert(large.value.upperZipBytes > small.value.upperZipBytes + 20000);
});
test('paragraph identities and UTF16 target boundaries refuse without repair', () => {
  for (const value of ['', '00000000', '80000000', '0000000a', '000000001']) {
    const h = fixture(); for (const a of attrs(h.paragraph)) a.value = value;
    const before = structuredClone(h.pkg); assert.deepEqual(h.check(), unsupported); assert.deepEqual(h.pkg, before);
  }
  const h = fixture('a😀z'); h.target.offset = 2; assert.deepEqual(h.check(), unsupported); h.target.offset = 3; assert(h.check().ok);
  assert.deepEqual(fixture('a'.repeat(4097)).check(), limited);
});
test('unknown story shapes and package roles fail closed', () => {
  for (const localName of ['fldSimple', 'sdt', 'instrText', 'bookmarkStart', 'hyperlink', 'ins', 'object']) {
    const h = fixture(); children(h.paragraph).push({ ...h.nodes.find(n => n.localName === 'r')!, id: 'unknown', localName } as OoxmlElement); assert.deepEqual(h.check(), unsupported);
  }
  for (const name of ['docProps/core.xml', 'word/header1.xml', 'word/footer1.xml', 'word/footnotes.xml', 'word/endnotes.xml', 'word/comments.xml', 'word/settings.xml', 'customXml/item1.xml']) {
    const h = fixture(); (h.pkg.partBytes as Map<string, Uint8Array>).set('/' + name, strToU8('<empty/>')); assert.deepEqual(h.check(), unsupported);
  }
});
test('census catches cycles and repeated IDs before the public CT reader', () => {
  for (const cycle of [false, true]) {
    const h = fixture(); children(h.paragraph).push(cycle ? h.paragraph : h.nodes.find(n => n.localName === 'r')!); let calls = 0;
    const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies, readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } });
    assert.equal(result.ok, false); assert.equal(calls, 0);
  }
});
test('prospective bound enforces exact 16MiB package and 4MiB media boundaries and three metadata reservations', () => {
  const h = fixture(); let low = 1, high = 16777216;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (h.check({ ...budget, mediaBytes: mid }).ok) low = mid; else high = mid - 1; }
  const result = h.check({ ...budget, mediaBytes: low }); assert(result.ok); assert(result.value.upperZipBytes <= 16777216);
  assert.deepEqual(h.check({ ...budget, mediaBytes: low + 1 }), limited);
  const plain = h.check(), titled = h.check({ ...budget, titleLength: 256, descriptionLength: 2048 }); assert(plain.ok && titled.ok);
  assert(titled.value.upperZipBytes >= plain.value.upperZipBytes + 3 * 6 * 2304);
});
test('budget scalar ceilings cannot overflow and reject before public parsing', () => {
  for (const input of [{ ...budget, mediaBytes: NaN }, { ...budget, pixelWidth: 8193 }, { ...budget, pixelHeight: Infinity },
    { ...budget, titleLength: -1 }, { ...budget, descriptionLength: 2049 }, { ...budget, mediaBytes: Number.MAX_SAFE_INTEGER }]) {
    const h = fixture(); let calls = 0; const result = qualifyImageInsertionPackage(h.pkg, h.target, input, { ...dependencies,
      readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } }); assert.deepEqual(result, limited); assert.equal(calls, 0);
  }
});

test('public default styles compare values and tree structure while ignoring IDs and prefix spelling', () => {
  const h = withStyles(), before = structuredClone(h.pkg); assert(h.check().ok); assert.deepEqual(h.pkg, before);
  const styles = h.pkg.parts.get('/word/styles.xml')!;
  (styles.root as { id: string }).id = 'new-style-id';
  (styles.root.namespaceBindings as { prefix: string; namespaceUri: string }[])[0]!.prefix = 'word'; assert(h.check().ok);
  const child = styles.root.children.find(n => n.kind !== 'textValue')!; assert(child.kind !== 'textValue');
  children(child).push({ kind: 'textValue', id: 'changed-style-value', value: ' ' }); assert.deepEqual(h.check(), unsupported);
});
test('default reference bounds are enforced independently of current package census', () => {
  const h = withStyles(), reference = structuredClone(dependencies.defaultStylesPart);
  children(reference.root).push(reference.root);
  assert.equal(qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies, defaultStylesPart: reference }).ok, false);
});
test('shared resources and empty source rectangle qualify via the existing picture helper', () => {
  for (const kind of ['image-simple', 'image-empty-source', 'image-jpeg', 'image-gif']) {
    const h = pictureFixture(kind), before = structuredClone(h.pkg); assert(h.check().ok, kind); assert.deepEqual(h.pkg, before);
  }
});
test('skipped unsupported pictures cannot pass insertion through the navigation helper', () => {
  for (const kind of ['image-crop', 'image-rotation', 'image-hidden', 'image-picture-lock', 'image-frame-lock', 'image-table']) {
    const h = pictureFixture(kind), before = structuredClone(h.pkg); assert.deepEqual(h.check(), unsupported, kind); assert.deepEqual(h.pkg, before);
  }
});
test('image-containing target paragraphs and duplicate or exhausted docPr identities refuse', () => {
  const h = pictureFixture(); const drawing = h.nodes.find(n => n.localName === 'drawing')!;
  const paragraph = h.nodes.find(n => n.localName === 'p' && n.children.some(run => run.kind !== 'textValue' && run.children.includes(drawing as never)))!;
  h.target.paragraphId = paragraph.id; assert.deepEqual(h.check(), unsupported);
  for (const value of ['1', '4294967295']) {
    const changed = pictureFixture(); const ids = changed.nodes.filter(n => n.localName === 'docPr');
    for (const node of ids) attrs(node).find(a => a.localName === 'id')!.value = value;
    assert.equal(changed.check().ok, false);
  }
});
test('relationship map order and allocator suffix must agree with canonical relationships', () => {
  const h = pictureFixture(), records = h.pkg.relationships.get(MAIN)!;
  (records[0] as { id: string }).id = 'rId2'; assert.deepEqual(h.check(), unsupported);
  const maximum = pictureFixture(), relPart = maximum.pkg.parts.get('/word/_rels/document.xml.rels')!;
  const rel = relPart.root.children.find(n => n.kind !== 'textValue')!; assert(rel.kind !== 'textValue');
  attrs(rel).find(a => a.localName === 'Id')!.value = 'rId999999999';
  (maximum.pkg.relationships.get(MAIN)![0] as { id: string }).id = 'rId999999999';
  for (const node of maximum.nodes.filter(n => n.localName === 'blip')) attrs(node).find(a => a.localName === 'embed')!.value = 'rId999999999';
  assert.deepEqual(maximum.check(), unsupported);
});
test('finite property grammar accepts ordinary formatting and rejects revisions and hidden text', () => {
  const h = fixture(), part = h.pkg.parts.get(MAIN)!, body = part.root.children.find(n => n.kind !== 'textValue')!; assert(body.kind !== 'textValue');
  const fragment = readOoxmlPart(`<w:p xmlns:w="${W}" xmlns:w14="${W14}" w14:paraId="00000002" w14:textId="00000002"><w:pPr><w:spacing w:before="120"/><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>bold</w:t></w:r></w:p>`, { name: '/fixture.xml', contentType: 'application/xml' });
  assert(fragment.ok); const formatted = structuredClone(fragment.part.root); children(body).push(formatted); assert(h.check().ok);
  const property = formatted.children.find(n => n.kind !== 'textValue')!; assert(property.kind !== 'textValue');
  children(property).push({ ...property, id: 'hidden-property', localName: 'pPrChange', children: [] } as OoxmlElement);
  assert.deepEqual(h.check(), unsupported);
});

test('unknown relationship owners refuse even when their normalized record list is empty', () => {
  const h = fixture(); (h.pkg.relationships as Map<string, readonly unknown[]>).set('/word/unknown.xml', []);
  assert.deepEqual(h.check(), unsupported);
});

test('namespace and attribute ceilings precede public parsing and unknown bindings fail closed', () => {
  for (const kind of ['attributes', 'prefix', 'bindings', 'unknown']) {
    const h = fixture();
    if (kind === 'attributes') for (let i = 0; i < 65; i++) attrs(h.paragraph).push({ namespaceUri: W, localName: `a${i}`, value: '0' });
    else {
      const bindings = h.paragraph.namespaceBindings as { prefix: string; namespaceUri: string }[];
      if (kind === 'bindings') for (let i = 0; i < 17; i++) bindings.push({ prefix: `n${i}`, namespaceUri: W });
      else bindings.push({ prefix: kind === 'prefix' ? 'x'.repeat(65) : 'x', namespaceUri: kind === 'unknown' ? 'urn:unknown' : W });
    }
    let calls = 0; const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies,
      readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } });
    assert.equal(result.ok, false); assert.equal(calls, 0);
  }
});
test('malformed current raster is refused without changing original resources', () => {
  const h = pictureFixture(), image = [...h.pkg.partBytes].find(([name]) => name.startsWith('/word/media/'))![1];
  image[image.length - 1] = image[image.length - 1]! ^ 1;
  const before = structuredClone(h.pkg); assert.deepEqual(h.check(), { ok: false, code: 'invalid-document' }); assert.deepEqual(h.pkg, before);
});

test('pretty-printed content types accept XML whitespace between declarations without mutation', () => {
  const h = fixture(), compact = h.check(); assert(compact.ok);
  const raw = new TextDecoder().decode(h.pkg.partBytes.get(TYPES)!);
  h.rawCt(raw.replaceAll('><', '>\n\t  <'));
  const before = structuredClone(h.pkg); let calls = 0;
  const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies,
    readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } });
  assert(result.ok); assert.equal(calls, 1);
  // Small lexical whitespace stays below the unchanged parsed XML reservation.
  assert.equal(result.value.upperZipBytes, compact.value.upperZipBytes);
  assert(result.value.upperZipBytes <= 16777216);
  assert.equal(h.pkg.parts.has(TYPES), false); assert.deepEqual(h.pkg, before);
});

test('content types reject mixed text and nonempty declaration leaves before public parsing', () => {
  for (const [label, change] of [
    ['literal text', (s: string) => s.replace('</Types>', 'unexpected</Types>')],
    ['entity text', (s: string) => s.replace('</Types>', '&#65;</Types>')],
    ['non-XML whitespace', (s: string) => s.replace('</Types>', '&#xA0;</Types>')],
    ['whitespace in declaration', (s: string) => s.replace('/>', '> \n\t</Default>')]
  ] as const) {
    const h = fixture(); h.rawCt(change(new TextDecoder().decode(h.pkg.partBytes.get(TYPES)!)));
    const before = structuredClone(h.pkg); let calls = 0;
    const result = qualifyImageInsertionPackage(h.pkg, h.target, budget, { ...dependencies,
      readOoxmlPart: (...args) => { calls++; return readOoxmlPart(...args); } });
    assert.deepEqual(result, unsupported, label); assert.equal(calls, 0, label);
    assert.equal(h.pkg.parts.has(TYPES), false); assert.deepEqual(h.pkg, before, label);
  }
});

test('named paragraph and character styles qualify in body paragraphs and plain table cells', () => {
  for (const table of [false, true]) { const h = styledCell(table), before = structuredClone(h.pkg); assert(h.check().ok); assert.deepEqual(h.pkg, before); }
});
test('style references must exist with the correct kind and plain tables reject merges and nesting', () => {
  for (const value of ['missing', 'DefaultParagraphFont']) { const h = styledCell(); attrs(h.nodes.find(n => n.localName === 'pStyle')!)[0]!.value = value; assert.deepEqual(h.check(), unsupported); }
  for (const localName of ['gridSpan', 'vMerge', 'sdt', 'tbl']) {
    const h = styledCell(true), cell = h.nodes.find(n => n.localName === 'tc')!;
    children(cell).push({ ...cell, id: 'unsupported-cell-child', localName, children: [] } as OoxmlElement); assert.deepEqual(h.check(), unsupported);
  }
});

test('bounded visible custom paragraph styles qualify while hidden inheritance, missing parents and cycles refuse', () => {
  const h = customStyledCell(), before = structuredClone(h.pkg); assert(h.check().ok); assert.deepEqual(h.pkg, before);
  for (const hidden of ['vanish', 'webHidden', 'specVanish']) assert.deepEqual(customStyledCell(`<w:rPr><w:${hidden}/></w:rPr>`).check(), unsupported);
  assert.deepEqual(customStyledCell('', 'missing').check(), unsupported); assert.deepEqual(customStyledCell('', 'Custom').check(), unsupported);
});
test('custom style UI priority accepts bounded integers and refuses malformed or absent values without mutation', () => {
  for (const value of ['0', '1', '99', undefined, '', '-1', '100', '1.5', '01', ' 1', '1e1', '9007199254740992']) {
    const h = customStyledCell(`<w:uiPriority${value === undefined ? '' : ` w:val="${value}"`}/>`), before = structuredClone(h.pkg);
    if (value === '0' || value === '1' || value === '99') assert(h.check().ok, value);
    else assert.deepEqual(h.check(), unsupported, String(value));
    assert.deepEqual(h.pkg, before, String(value));
  }
});
test('custom style visibility metadata accepts only boolean leaves without changing document visibility', () => {
  for (const name of ['qFormat', 'semiHidden', 'unhideWhenUsed']) {
    for (const value of [undefined, '0', '1', 'true', 'false', 'on', 'off', '', '2', 'TRUE', 'yes', ' true']) {
      const h = customStyledCell(`<w:${name}${value === undefined ? '' : ` w:val="${value}"`}/>`), before = structuredClone(h.pkg);
      const label = `${name}: ${String(value)}`;
      if (value === undefined || ['0', '1', 'true', 'false', 'on', 'off'].includes(value)) assert(h.check().ok, label);
      else assert.deepEqual(h.check(), unsupported, label);
      assert.deepEqual(h.pkg, before, label);
    }
    for (const metadata of [`<w:${name}/><w:${name}/>`, `<w:${name} w:unknown="1"/>`, `<w:${name}><w:b/></w:${name}>`]) {
      const h = customStyledCell(metadata), before = structuredClone(h.pkg);
      assert.deepEqual(h.check(), unsupported, metadata); assert.deepEqual(h.pkg, before, metadata);
    }
  }
});


test('styled paragraph and table insertion preserve text, styles and original package through one undo and admitted reopen', async () => {
  for (const table of [false, true]) {
    const h = styledCell(table), before = writeOoxmlPackage(h.pkg), engine = new TreePackageStore(h.pkg, h.pkg.parts.get(MAIN)!, { historyLimit: 10 });
    assert(h.check().ok);
    const result = await engine.insertImage({ kind: 'body' }, { ...h.target, bytes: imageInsertionBytes('png'), mime: 'image/png',
      widthPoints: 48, heightPoints: 24, expectedPackageRevision: 0,
      decodePort: { async decode() { return { pixelWidth: 64, pixelHeight: 32, dpiX: 96, dpiY: 96 }; } } });
    assert(result.ok && result.change, JSON.stringify({ table, result }));
    const saved = writeOoxmlPackage(engine.currentPackage()), entries = unzipSync(saved), xml = strFromU8(entries['word/document.xml']!);
    if (table) assert.match(xml, /<w:t[^>]*>alpha<\/w:t>/u);
    else { assert.match(xml, /<w:t[^>]*>al<\/w:t>/u); assert.match(xml, /<w:t[^>]*>pha<\/w:t>/u); }
    assert(xml.includes('w:pStyle w:val="Heading1"')); assert.deepEqual(entries['word/styles.xml'], unzipSync(before)['word/styles.xml']);
    assert((await admitDocx(saved, new AbortController().signal)).ok); assert(readOoxmlPackage(saved).ok);
    assert(engine.undo()); assert.deepEqual(writeOoxmlPackage(engine.currentPackage()), before); assert.equal(engine.undo(), null);
    assert(engine.redo()); assert.deepEqual(writeOoxmlPackage(engine.currentPackage()), saved); assert.deepEqual(writeOoxmlPackage(h.pkg), before);
  }
});


test('plain cell insertion refuses an interior text-run caret without relocation', () => {
  const h = styledCell(true); h.target.offset = 2; const before = structuredClone(h.pkg);
  assert.deepEqual(h.check(), unsupported); assert.deepEqual(h.pkg, before);
  h.target.offset = 5; assert(h.check().ok);
});
