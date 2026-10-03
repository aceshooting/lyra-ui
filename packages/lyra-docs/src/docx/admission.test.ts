import assert from 'node:assert/strict';
import { test } from 'node:test';
import { admitDocx } from './admission.js';
import { normalizeDocxAction } from './commands.js';
import { docxFixture, DOCUMENT_XML, relationship } from './admission-fixtures.js';

const invalid = { ok: false, code: 'invalid-document' };
const limited = { ok: false, code: 'resource-limit' };

test('authored hyperlink targets use the same admission policy after serialization', async () => {
  const credentialHref = new URL('https://example.com');
  credentialHref.username = 'user';
  credentialHref.password = 'pass';
  for (const href of ['https://example.com/path', 'mailto:person@example.com', '#bookmark',
    'http://example.com', credentialHref.href, 'https://example.com/back\\slash',
    'javascript:alert(1)', 'https://example.com/path with space']) {
    const authored = normalizeDocxAction({ type: 'link', href });
    const admitted = await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationship(href, 'hyperlink') }));
    assert.equal(admitted.ok, authored.ok, href);
  }
});

test('accepts stored and deflated DOCX without changing input or unknown parts', async () => {
  for (const level of [0, 6] as const) {
    const bytes = docxFixture({ 'custom/data.bin': new Uint8Array([0, 9, 255]) }, level);
    const copy = bytes.slice();
    assert.deepEqual(await admitDocx(bytes), { ok: true, value: undefined });
    assert.deepEqual(bytes, copy);
  }
});

test('refuses absent required parts, malformed ZIP and input above ceiling', async () => {
  for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) {
    assert.deepEqual(await admitDocx(docxFixture({ [name]: null })), invalid);
  }
  assert.deepEqual(await admitDocx(new Uint8Array([1, 2, 3])), invalid);
  assert.deepEqual(await admitDocx(docxFixture().subarray(0, 100)), invalid);
  assert.deepEqual(await admitDocx(new Uint8Array(4 * 1024 * 1024 + 1)), limited);
});

test('rejects XML syntax errors, DTDs, undeclared entities and deep or excessive nodes', async () => {
  for (const xml of ['<a>', '<a/><b/>', '<a>&missing;</a>', '<!DOCTYPE a [<!ENTITY x "hello">]><a>&x;</a>', '<a xmlns:x="x"><x:b></a>']) {
    assert.deepEqual(await admitDocx(docxFixture({ 'custom/test.xml': xml })), invalid);
  }
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/test.xml': '<a>'.repeat(129) + '</a>'.repeat(129) }, 6)), limited);
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/test.xml': '<a>' + '<b/>'.repeat(150_001) + '</a>' }, 6)), limited);
});

test('rejects traversal, duplicate ZIP names and CRC or local/central mismatches', async () => {
  for (const name of ['../evil.xml', '/evil.xml', 'word/../evil.xml', 'word\\evil.xml', 'word/%2e%2e/evil.xml']) {
    assert.deepEqual(await admitDocx(docxFixture({ [name]: '<a/>' })), invalid);
  }
  const bytes = docxFixture();
  const corrupt = bytes.slice();
  corrupt[50] = (corrupt[50] ?? 0) ^ 1;
  assert.deepEqual(await admitDocx(corrupt), invalid);
  const mismatch = bytes.slice();
  new DataView(mismatch.buffer).setUint16(8, 8, true);
  assert.deepEqual(await admitDocx(mismatch), invalid);
  const duplicate = docxFixture({ 'word/duplicat.xml': DOCUMENT_XML });
  const from = new TextEncoder().encode('word/duplicat.xml');
  const to = new TextEncoder().encode('word/document.xml');
  for (let i = 0; i <= duplicate.length - from.length; i++) {
    if (from.every((byte, j) => duplicate[i + j] === byte)) duplicate.set(to, i);
  }
  assert.deepEqual(await admitDocx(duplicate), invalid);
});

test('rejects encrypted, unsupported compression, ZIP64 and multipart archives', async () => {
  for (const kind of ['encrypted', 'method', 'zip64', 'multipart']) {
    const bytes = docxFixture();
    const view = new DataView(bytes.buffer);
    if (kind === 'encrypted') view.setUint16(6, 1, true);
    if (kind === 'method') view.setUint16(8, 99, true);
    if (kind === 'zip64') view.setUint16(bytes.length - 12, 0xffff, true);
    if (kind === 'multipart') view.setUint16(bytes.length - 18, 1, true);
    assert.deepEqual(await admitDocx(bytes), invalid);
  }
});

test('rejects declared and actual expansion beyond bounded sizes', async () => {
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/bomb.bin': new Uint8Array(8 * 1024 * 1024 + 1) }, 6)), limited);
  const bytes = docxFixture({ 'custom/bomb.bin': new Uint8Array(9 * 1024 * 1024) }, 6);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i + 46 < bytes.length; i++) {
    if (view.getUint32(i, true) === 0x02014b50 && view.getUint32(i + 24, true) > 8 * 1024 * 1024) {
      view.setUint32(i + 24, 10, true);
      view.setUint32(view.getUint32(i + 42, true) + 22, 10, true);
    }
  }
  assert.deepEqual(await admitDocx(bytes), limited);
});

test('refuses remote resources and unsafe hyperlinks but accepts safe link protocols', async () => {
  for (const [target, type] of [['https://example.com/a.png', 'image'], ['file:///secret', 'image'], ['https://example.com/font', 'font'], ['javascript:alert(1)', 'hyperlink'], ['http://example.com', 'hyperlink']]) {
    assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationship(target!, type) })), { ok: false, code: 'external-resource' });
  }
  for (const target of ['https://example.com', 'mailto:person@example.com', '#bookmark']) {
    assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationship(target, 'hyperlink') })), { ok: true, value: undefined });
  }
  assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationship('https://example.com/image', 'image', 'Internal') })), { ok: false, code: 'external-resource' });
});

test('refuses oversized image dimensions before decoding', async () => {
  const image = new Uint8Array(33);
  image.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  const view = new DataView(image.buffer);
  view.setUint32(16, 100_000);
  view.setUint32(20, 100_000);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/a.png': image })), limited);
});

test('returns typed abort before parsing and yields so in-flight cancellation works', async () => {
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await admitDocx(docxFixture(), controller.signal), { ok: false, code: 'aborted' });
  const active = new AbortController();
  const result = admitDocx(docxFixture({ 'custom/large.xml': '<a>' + 'x'.repeat(2_000_000) + '</a>' }, 6), active.signal);
  setTimeout(() => active.abort(), 0);
  assert.deepEqual(await result, { ok: false, code: 'aborted' });
});

test('accepts directory entries and package-relative image relationships', async () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvUYAAAAASUVORK5CYII=', 'base64'));
  assert.deepEqual(await admitDocx(docxFixture({
    'word/': new Uint8Array(), 'word/media/': new Uint8Array(), 'word/media/a.png': png,
    'word/_rels/document.xml.rels': relationship('media/a.png', 'image', 'Internal')
  })), { ok: true, value: undefined });
});

test('bounds ZIP entry count, aggregate expansion and XML byte size', async () => {
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < 2048; i++) entries[`custom/${i}.bin`] = new Uint8Array();
  assert.deepEqual(await admitDocx(docxFixture(entries)), limited);
  const large: Record<string, Uint8Array> = {};
  for (let i = 0; i < 5; i++) large[`custom/${i}.bin`] = new Uint8Array(8 * 1024 * 1024);
  assert.deepEqual(await admitDocx(docxFixture(large, 6)), limited);
  assert.deepEqual(await admitDocx(docxFixture({ 'custom/a.xml': '<a>' + 'x'.repeat(4 * 1024 * 1024) + '</a>' }, 6)), limited);
});

test('checks XML selected by content type and rejects malformed image headers and missing internal targets', async () => {
  const content = '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/custom/data.bin" ContentType="application/xml"/></Types>';
  assert.deepEqual(await admitDocx(docxFixture({ '[Content_Types].xml': content, 'custom/data.bin': '<a>' })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/a.png': new Uint8Array([1, 2, 3]) })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationship('media/missing.png', 'image', 'Internal') })), invalid);
});

test('never fetches an external resource while refusing it', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('must not fetch'); };
  try {
    assert.deepEqual(await admitDocx(docxFixture({ 'word/_rels/document.xml.rels': relationship('https://example.com/tracker.png') })), { ok: false, code: 'external-resource' });
    assert.equal(calls, 0);
  } finally { globalThis.fetch = oldFetch; }
});

test('checks every relationship image target regardless of name, MIME or ZIP order', async () => {
  const hugePng = new Uint8Array(33);
  hugePng.set([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
  new DataView(hugePng.buffer).setUint32(16, 100_000);
  new DataView(hugePng.buffer).setUint32(20, 100_000);
  for (const type of ['application/octet-stream', 'Image/PNG']) {
    for (const imageFirst of [true, false]) {
      const parts: Record<string, string | Uint8Array> = {
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/custom/payload.bin" ContentType="' + type + '"/></Types>'
      };
      const rel = relationship('../custom/payload.bin', 'image', 'Internal');
      if (imageFirst) parts['custom/payload.bin'] = hugePng;
      parts['word/_rels/document.xml.rels'] = rel;
      if (!imageFirst) parts['custom/payload.bin'] = hugePng;
      assert.deepEqual(await admitDocx(docxFixture(parts)), limited);
      parts['custom/payload.bin'] = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
      assert.deepEqual(await admitDocx(docxFixture(parts)), invalid);
    }
  }
});

test('refuses unqualified embedded fonts and alternate-content resource relationships', async () => {
  for (const type of ['font', 'aFChunk', 'oleObject', 'package', 'control']) {
    assert.deepEqual(await admitDocx(docxFixture({
      'custom/payload.bin': new Uint8Array([1, 2, 3]),
      'word/_rels/document.xml.rels': relationship('../custom/payload.bin', type, 'Internal')
    })), invalid);
  }
});

test('bounds aggregate decoded image pixels and count, deduplicating repeated targets', async () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvUYAAAAASUVORK5CYII=', 'base64'));
  const makeImages = (count: number, width: number, same = false) => {
    const parts: Record<string, string | Uint8Array> = {};
    const image = png.slice();
    new DataView(image.buffer).setUint32(16, width);
    new DataView(image.buffer).setUint32(20, width);
    let relationships = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (let i = 0; i < count; i++) {
      const name = `custom/${same ? 0 : i}.bin`;
      parts[name] = image;
      relationships += `<Relationship Id="r${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../${name}"/>`;
    }
    parts['word/_rels/document.xml.rels'] = relationships + '</Relationships>';
    return docxFixture(parts, 6);
  };
  assert.deepEqual(await admitDocx(makeImages(3, 4000)), limited);
  assert.deepEqual(await admitDocx(makeImages(129, 1)), limited);
  assert.deepEqual(await admitDocx(makeImages(3, 4000, true)), { ok: true, value: undefined });
});

test('refuses animated PNG and GIF decoded-frame amplification', async () => {
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvUYAAAAASUVORK5CYII=', 'base64'));
  const animatedPng = new Uint8Array(png.length + 20);
  animatedPng.set(png.subarray(0, 33));
  animatedPng.set([0, 0, 0, 8, 97, 99, 84, 76, 0, 0, 0, 2], 33);
  animatedPng.set(png.subarray(33), 53);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/a.png': animatedPng })), invalid);
  const gif = Uint8Array.from(Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'));
  const animatedGif = new Uint8Array(gif.length + 13);
  animatedGif.set(gif.subarray(0, gif.length - 1));
  animatedGif.set(gif.subarray(19, gif.length - 1), gif.length - 1);
  animatedGif[animatedGif.length - 1] = 59;
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/a.gif': animatedGif })), invalid);
  assert.deepEqual(await admitDocx(docxFixture({ 'word/media/a.gif': gif })), { ok: true, value: undefined });
});
