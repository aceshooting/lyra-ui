import assert from 'node:assert/strict';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { zipEntry } from '../test/zip.mjs';
import { zipParts as parts } from './lib/harness.mjs';

const host = (page, id) => page.locator(`#${id}`);
const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const word14 = 'http://schemas.microsoft.com/office/word/2010/wordml';

async function imageResources(page, bytes) {
  const entries = parts(bytes);
  const paths = await page.evaluate(({ documentXml, relationshipsXml }) => {
    const parse = value => new DOMParser().parseFromString(value, 'application/xml');
    const document = parse(documentXml), relationships = parse(relationshipsXml);
    return [...document.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'blip')].map(blip => {
      const id = blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed');
      const relationship = [...relationships.getElementsByTagNameNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship')]
        .find(value => value.getAttribute('Id') === id);
      if (!relationship) throw new Error('Missing image relationship');
      return new URL(relationship.getAttribute('Target'), 'https://example.invalid/word/document.xml').pathname.slice(1);
    });
  }, { documentXml: zipEntry(bytes, 'word/document.xml'), relationshipsXml: zipEntry(bytes, 'word/_rels/document.xml.rels') });
  return paths.map(path => { assert(entries[path]); return entries[path]; });
}

export async function runImageExtensions(page, check, { createEditor, saveEditor }) {
  for (const table of [false, true]) await check(`image insertion into a styled ${table ? 'plain table cell' : 'body paragraph'} preserves caret, styles and one undo`, async () => {
    const id = `image-styled-${table}`; await createEditor(page, id);
    const blank = await saveEditor(page, id), entries = unzipSync(Uint8Array.from(blank));
    const paragraph = '<w:p w14:paraId="00000001" w14:textId="00000001"><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>alpha</w:t></w:r></w:p>';
    const body = table ? `<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2400"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${paragraph}</w:tc></w:tr></w:tbl>` : paragraph;
    entries['word/document.xml'] = strToU8(`<w:document xmlns:w="${word}" xmlns:w14="${word14}"><w:body>${body}</w:body></w:document>`);
    assert.equal((await host(page, id).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), [...zipSync(entries)])).ok, true);
    await page.locator(`#${id} .docx-pages`).getByText('alpha', { exact: true }).click();
    await page.keyboard.press('Home');
    if (!table) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); }
    const before = await saveEditor(page, id);
    const result = await host(page, id).evaluate(async element => element.insertImage({ bytes: await window.__docxTest.imageBytes('png'), widthPoints: 48, heightPoints: 24 }));
    assert.equal(result.ok, true, JSON.stringify(result));
    const saved = await saveEditor(page, id), xml = zipEntry(saved, 'word/document.xml');
    if (table) assert.match(xml, /<w:t[^>]*>alpha<\/w:t>/u);
    else { assert.match(xml, /<w:t[^>]*>al<\/w:t>/u); assert.match(xml, /<w:t[^>]*>pha<\/w:t>/u); }
    assert.match(xml, /w:pStyle w:val="Heading1"/u);
    assert.equal((xml.match(/<w:drawing[ >]/gu) ?? []).length, 1);
    assert.deepEqual(parts(saved)['word/styles.xml'], parts(before)['word/styles.xml']);
    assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true); assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    assert.equal((await host(page, id).evaluate(element => element.execute('redo'))).ok, true); assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
    assert.equal((await host(page, id).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved)).ok, true);
    assert.equal((await host(page, id).evaluate(element => element.selectImage('next'))).ok, true);
    await host(page, id).evaluate(element => element.remove());
  });
  await check('local image replacement preserves metadata, dimensions and opaque parts through one undo and reopen', async () => {
    const id = 'image-replace'; await createEditor(page, id, 'image-simple');
    await page.locator(`#${id} .docx-pages img`).first().click();
    await page.waitForFunction(id => document.getElementById(id).canReplaceImage().enabled, id);
    const before = await saveEditor(page, id), properties = await host(page, id).evaluate(element => ({ image: element.snapshot().image, description: element.imageDescription() }));
    const replacement = await host(page, id).evaluate(async element => {
      const bytes = await window.__docxTest.imageBytes('jpeg'), expected = [...bytes], pending = element.replaceImage(bytes);
      bytes.fill(0); return { result: await pending, expected };
    });
    assert.equal(replacement.result.ok, true, JSON.stringify(replacement.result));
    const saved = await saveEditor(page, id);
    const originalImages = await imageResources(page, before), savedImages = await imageResources(page, saved);
    assert.equal(originalImages.length, 2); assert.equal(savedImages.length, 2);
    assert.deepEqual(originalImages[0], originalImages[1]);
    assert.deepEqual([...savedImages[0]], replacement.expected);
    assert.deepEqual(savedImages[1], originalImages[1]);
    assert.deepEqual(await host(page, id).evaluate(element => ({ image: element.snapshot().image, description: element.imageDescription() })), properties);
    for (const name of ['custom/payload.bin', 'customXml/item1.xml']) if (parts(before)[name]) assert.deepEqual(parts(saved)[name], parts(before)[name]);
    assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true); assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    assert.equal((await host(page, id).evaluate(element => element.execute('redo'))).ok, true); assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
    assert.equal((await host(page, id).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved)).ok, true);
    assert.equal((await host(page, id).evaluate(element => element.selectImage('next'))).ok, true);
    assert.deepEqual(await host(page, id).evaluate(element => ({ image: element.snapshot().image, description: element.imageDescription() })), properties);
    await host(page, id).evaluate(element => element.remove());
  });
}
