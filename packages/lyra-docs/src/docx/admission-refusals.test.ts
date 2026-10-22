import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admitDocx } from './admission.js';
import { CONTENT_TYPES, docxFixture, relationship } from '../../test/admission-fixtures.js';

const accepted = { ok: true, value: undefined };
const invalid = { ok: false, code: 'invalid-document' };
const limited = { ok: false, code: 'resource-limit' };
const external = { ok: false, code: 'external-resource' };

const TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MAIN = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';

const relationships = (body: string, root = 'Relationships', namespace = RELS_NS) => `<${root} xmlns="${namespace}">${body}</${root}>`;
const officeDocument = `<Relationship Id="rId1" Type="${OFFICE}/officeDocument" Target="word/document.xml"/>`;
/** An external picture link, which the package policy admits without fetching it. */
const linkedPicture = (attributes = 'Id="rId2"') => `<Relationship ${attributes} Type="${OFFICE}/image" Target="https://example.com/p.png" TargetMode="External"/>`;
const withDocumentRelationships = (body: string) => docxFixture({ 'word/_rels/document.xml.rels': relationships(body) });

/** Finds an entry in the central directory: its record, its local header and where its data starts. */
function locate(bytes: Uint8Array, name: string): { central: number; local: number; start: number } {
  const view = new DataView(bytes.buffer);
  let central = view.getUint32(bytes.length - 6, true);
  for (let count = view.getUint16(bytes.length - 12, true); count > 0; count--) {
    const nameSize = view.getUint16(central + 28, true);
    if (new TextDecoder().decode(bytes.subarray(central + 46, central + 46 + nameSize)) === name) {
      const local = view.getUint32(central + 42, true);
      return { central, local, start: local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true) };
    }
    central += 46 + nameSize + view.getUint16(central + 30, true) + view.getUint16(central + 32, true);
  }
  throw new Error(`Entry ${name} is absent`);
}
/** Rewrites the compression method of one entry in its local header and its central record. */
function withMethod(bytes: Uint8Array, name: string, method: number): Uint8Array {
  const copy = bytes.slice(), view = new DataView(copy.buffer), { central, local } = locate(copy, name);
  view.setUint16(central + 10, method, true);
  view.setUint16(local + 8, method, true);
  return copy;
}

test('refuses a compressed entry that holds no compressed data', async () => {
  const bytes = (level: 0 | 6) => docxFixture({ 'custom/empty.bin': new Uint8Array() }, level);
  assert.deepEqual(await admitDocx(bytes(0)), accepted);
  assert.deepEqual(await admitDocx(bytes(6)), accepted);
  assert.deepEqual(await admitDocx(withMethod(bytes(0), 'custom/empty.bin', 8)), invalid);
});

test('refuses a content-type map whose root or entries are malformed and keeps well-formed extensions', async () => {
  const prefixed = CONTENT_TYPES.replace(`<Types xmlns="${TYPES_NS}"`, `<Types xmlns="urn:other" xmlns:t="${TYPES_NS}"`)
    .replaceAll('<Default ', '<t:Default ').replaceAll('<Override ', '<t:Override ');
  const part = '<Override PartName="/custom/a.bin" ContentType="application/octet-stream"/>';
  const refused: [string, string][] = [
    ['a root that is not Types', CONTENT_TYPES.replace('<Types ', '<Typed ').replace('</Types>', '</Typed>')],
    ['a Types root outside the content-type namespace', prefixed],
    ['an entry outside the content-type namespace', CONTENT_TYPES.replace('<Default Extension="xml"', '<Default xmlns="urn:other" Extension="xml"')],
    ['a default without a content type', CONTENT_TYPES.replace('</Types>', '<Default Extension="bin"/></Types>')],
    ['an override with a blank content type', CONTENT_TYPES.replace('</Types>', '<Override PartName="/custom/a.bin" ContentType=" "/></Types>')],
    ['a default without an extension', CONTENT_TYPES.replace('</Types>', '<Default Extension="" ContentType="text/plain"/></Types>')],
    ['a repeated default extension', CONTENT_TYPES.replace('</Types>', '<Default Extension="XML" ContentType="text/xml"/></Types>')],
    ['an override that is not an absolute part name', CONTENT_TYPES.replace('</Types>', '<Override PartName="custom/a.bin" ContentType="text/plain"/></Types>')],
    ['an override naming a part outside the package', CONTENT_TYPES.replace('</Types>', '<Override PartName="/word/../a.bin" ContentType="text/plain"/></Types>')],
    ['a repeated override', CONTENT_TYPES.replace('</Types>', `${part}${part}</Types>`)],
    ['an entry that is neither a default nor an override', CONTENT_TYPES.replace('</Types>', '<Alias PartName="/custom/a.bin" ContentType="text/plain"/></Types>')],
  ];
  for (const [label, types] of refused) assert.deepEqual(await admitDocx(docxFixture({ '[Content_Types].xml': types })), invalid, label);
  for (const [label, types] of [
    ['the unmodified map', CONTENT_TYPES],
    ['one more default and one more override', CONTENT_TYPES.replace('</Types>', `<Default Extension="bin" ContentType="application/octet-stream"/>${part}</Types>`)],
  ] as const) assert.deepEqual(await admitDocx(docxFixture({ '[Content_Types].xml': types })), accepted, label);
});

test('refuses a main document part whose root is not a WordprocessingML document', async () => {
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  for (const xml of [`<w:body xmlns:w="${word}"/>`, '<w:document xmlns:w="urn:other"/>']) {
    assert.deepEqual(await admitDocx(docxFixture({ 'word/document.xml': xml })), invalid, xml);
  }
  assert.deepEqual(await admitDocx(docxFixture({ 'word/document.xml': `<w:document xmlns:w="${word}"/>` })), accepted);
});

test('refuses a root relationship part whose root is not a Relationships element', async () => {
  const prefixed = `<Relationships xmlns="urn:other" xmlns:r="${RELS_NS}">${officeDocument.replace('<Relationship ', '<r:Relationship ')}</Relationships>`;
  assert.deepEqual(await admitDocx(docxFixture({ '_rels/.rels': relationships(officeDocument, 'Relations') })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ '_rels/.rels': prefixed })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ '_rels/.rels': relationships(officeDocument) })), accepted);
});

test('refuses relationship entries that are misplaced, misnamed or incomplete', async () => {
  const picture = linkedPicture();
  assert.deepEqual(await admitDocx(withDocumentRelationships(picture)), accepted);
  const refused: [string, string][] = [
    ['an entry that is not a Relationship', picture.replace('<Relationship ', '<Link ')],
    ['an entry outside the relationship namespace', picture.replace('<Relationship ', '<Relationship xmlns="urn:other" ')],
    ['a Relationship nested in a Relationship', picture.replace('/>', `>${linkedPicture('Id="rId3"')}</Relationship>`)],
    ['an entry without an identifier', linkedPicture('')],
    ['a repeated identifier', picture + linkedPicture('Id="rId2"')],
    ['an entry without a type', picture.replace(` Type="${OFFICE}/image"`, '')],
    ['an entry without a target', picture.replace(' Target="https://example.com/p.png"', '')],
    ['an entry with an unknown target mode', picture.replace('TargetMode="External"', 'TargetMode="Remote"')],
  ];
  for (const [label, body] of refused) assert.deepEqual(await admitDocx(withDocumentRelationships(body)), invalid, label);
  assert.deepEqual(await admitDocx(withDocumentRelationships(picture + linkedPicture('Id="rId3"'))), accepted);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationships(picture, 'Relations') })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels':
    `<Relationships xmlns="urn:other" xmlns:r="${RELS_NS}">${picture.replace('<Relationship ', '<r:Relationship ')}</Relationships>` })), invalid);
});

test('refuses internal targets whose fragment is encoded or holds control characters, or that climb out of the package', async () => {
  const target = (value: string) => docxFixture({ 'custom/data.bin': new Uint8Array([1, 2, 3]),
    'word/_rels/document.xml.rels': relationship(value, 'oleObject', 'Internal') });
  assert.deepEqual(await admitDocx(target('../custom/data.bin#fragment')), accepted);
  for (const fragment of ['a%20b', 'a b', 'a&#9;b', 'a&#127;b']) {
    assert.deepEqual(await admitDocx(target(`../custom/data.bin#${fragment}`)), invalid, fragment);
  }
  for (const escaping of ['../../data.bin', '../custom/../../data.bin']) assert.deepEqual(await admitDocx(target(escaping)), invalid, escaping);
});

test('admits an internal hyperlink only for a bookmark or an existing part', async () => {
  const link = (value: string, type = 'hyperlink') => docxFixture({ 'custom/page.xml': '<page/>',
    'word/_rels/document.xml.rels': relationship(value, type, 'Internal') });
  assert.deepEqual(await admitDocx(link('#chapter')), accepted);
  assert.deepEqual(await admitDocx(link('../custom/page.xml')), accepted);
  assert.deepEqual(await admitDocx(link('../custom/missing.xml')), invalid);
  assert.deepEqual(await admitDocx(link('#chapter', 'image')), invalid);
  assert.deepEqual(await admitDocx(link('javascript:alert(1)')), external);
});

test('requires one main-document relationship that names the document part and its content type', async () => {
  const extra = (relationshipXml: string) => relationships(officeDocument + relationshipXml);
  const sibling = `<Relationship Id="rId9" Type="${OFFICE}/officeDocument" Target="custom/other.xml"/>`;
  const again = `<Relationship Id="rId9" Type="${OFFICE}/officeDocument" Target="word/document.xml"/>`;
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/other.xml': '<other/>', '_rels/.rels': extra('') })), accepted);
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/other.xml': '<other/>', '_rels/.rels': extra(sibling) })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ '_rels/.rels': extra(again) })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ '_rels/.rels': relationships('') })), invalid);
  const contentType = (type: string) => CONTENT_TYPES.replace(MAIN, type);
  for (const type of ['application/vnd.ms-word.document.macroEnabled.main+xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml']) {
    assert.deepEqual(await admitDocx(docxFixture({ '[Content_Types].xml': contentType(type) })), invalid, type);
  }
  assert.deepEqual(await admitDocx(docxFixture({ '[Content_Types].xml': contentType(` ${MAIN.toUpperCase()} `) })), accepted);
  assert.deepEqual(await admitDocx(docxFixture({ '[Content_Types].xml': CONTENT_TYPES.replace(/<Override[^>]*\/>/, '') })), invalid);
});

test('counts text, CDATA and comment nodes against the package node budget', async () => {
  const part = (content: string) => docxFixture({ 'custom/many.xml': `<a>${content}</a>` });
  for (const [label, unit] of [['comment', '<!---->'], ['CDATA section', '<![CDATA[]]>'], ['text run', 'x<!---->']] as const) {
    assert.deepEqual(await admitDocx(part(unit.repeat(10_000))), accepted, `${label} below the budget`);
    assert.deepEqual(await admitDocx(part(unit.repeat(label === 'text run' ? 125_001 : 250_001))), limited, label);
  }
});

test('refuses XML that cannot be decoded, has no root element or sits in a damaged compressed stream', async () => {
  const utf8 = (...bytes: number[]) => Uint8Array.from([0x3c, 0x61, 0x3e, ...bytes, 0x3c, 0x2f, 0x61, 0x3e]);
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/text.xml': utf8(0xc3, 0xa9) })), accepted);
  for (const damaged of [utf8(0xc3, 0x28), utf8(0xff), utf8(0xed, 0xa0, 0x80)]) {
    assert.deepEqual(await admitDocx(docxFixture({ 'custom/text.xml': damaged })), invalid);
  }
  for (const xml of ['', '   ', '<!-- only a comment -->', '<?xml version="1.0"?>']) {
    assert.deepEqual(await admitDocx(docxFixture({ 'custom/empty.xml': xml })), invalid, JSON.stringify(xml));
  }
  const bytes = docxFixture({ 'custom/words.xml': `<a>${'hello '.repeat(2000)}</a>` }, 6);
  assert.deepEqual(await admitDocx(bytes), accepted);
  // The first deflate byte carries the block type; 3 is reserved and no decoder accepts it.
  const first = locate(bytes, 'custom/words.xml').start;
  bytes[first] = (bytes[first] ?? 0) | 0x06;
  assert.deepEqual(await admitDocx(bytes), invalid);
});

test('refuses input that is not a byte array before reading it as an archive', async () => {
  const bytes = docxFixture();
  assert.deepEqual(await admitDocx(Buffer.from(bytes)), accepted);
  for (const input of [Array.from(bytes), bytes.buffer, new DataView(bytes.buffer), 'PK', null, undefined]) {
    assert.deepEqual(await admitDocx(input as unknown as Uint8Array), invalid, String(input));
  }
  // An array-like claiming to exceed the input ceiling is still not an archive: no size verdict applies.
  assert.deepEqual(await admitDocx({ length: 17 * 1024 * 1024 } as unknown as Uint8Array), invalid);
});
