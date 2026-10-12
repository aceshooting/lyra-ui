import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { zipParts } from './lib/harness.mjs';

function withHeadings(source) {
  const entries = unzipSync(Uint8Array.from(source));
  entries['word/document.xml'] = strToU8(strFromU8(entries['word/document.xml'])
    .replace('<w:p><w:r><w:t>Corpus opening', '<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Corpus opening')
    .replace('<w:p><w:pPr><w:numPr>', '<w:p><w:pPr><w:outlineLvl w:val="2"/><w:numPr>')
    .replace('</w:body>', '<w:p><w:pPr><w:pStyle w:val="OutlineChild"/></w:pPr><w:r><w:t>Inherited heading</w:t></w:r></w:p></w:body>'));
  entries['word/styles.xml'] = strToU8(strFromU8(entries['word/styles.xml']).replace('</w:styles>',
    '<w:style w:type="paragraph" w:styleId="OutlineParent"><w:name w:val="Outline parent"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="OutlineChild"><w:name w:val="Outline child"/><w:basedOn w:val="OutlineParent"/></w:style></w:styles>'));
  return [...zipSync(entries, { level: 6 })];
}

/** Public facade checks shared by every browser engine; creates no engine introspection seam. */
export async function runDocumentInspection(page, check, { createEditor, saveEditor }) {
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  const seed = await createEditor(page, 'inspection-seed', 'basic-editing');
  await page.locator('#inspection-seed').evaluate(element => element.remove());
  const bytes = withHeadings(seed);
  for (const readOnly of [false, true]) {
    await check(`body outline and metadata diagnostics are bounded readonly queries (${readOnly ? 'viewing' : 'editing'})`, async () => {
      const id = `inspection-${readOnly}`;
      const opened = await page.evaluate(async ({ id, bytes, readOnly }) => {
        const element = document.createElement('lr-docx-editor'); element.id = id; element.readOnly = readOnly;
        document.querySelector('#fixture').append(element); return element.open(Uint8Array.from(bytes));
      }, { id, bytes, readOnly });
      assert.equal(opened.ok, true, JSON.stringify(opened));
      await page.locator(`#${id} .docx-pages`).waitFor({ state: 'visible' });
      const beforeBytes = await saveEditor(page, id);
      const report = await page.locator(`#${id}`).evaluate(element => {
        const before = element.snapshot(); const outline = element.outline(), inspection = element.inspectDocument();
        const after = element.snapshot(); return { before, after, outline, inspection };
      });
      assert.equal(report.outline.ok, true, JSON.stringify(report.outline));
      assert.equal(report.inspection.ok, true, JSON.stringify(report.inspection));
      assert.deepEqual(report.after, report.before);
      assert.deepEqual(report.outline.value.items.map(({ level, text }) => [level, text]),
        [[1, 'Corpus opening'], [3, 'Numbered item'], [2, 'Inherited heading']]);
      assert.equal(report.outline.value.truncated, false);
      assert.equal(report.inspection.value.scope, 'body');
      assert(report.inspection.value.diagnostics.some(item => item.rule === 'heading-level-skipped'));
      assert(report.inspection.value.diagnostics.some(item => item.rule === 'image-description-missing'));
      assert(report.inspection.value.diagnostics.some(item => item.rule === 'table-header-missing'));
      assert(report.inspection.value.capabilities.every(item => item.preserved === 'unverified' && item.renderable === 'unverified'));
      const diagnostic = report.inspection.value.diagnostics.find(item => item.rule === 'table-header-missing');
      assert.equal(typeof diagnostic.locationId, 'string');
      assert.equal((await page.locator(`#${id}`).evaluate((element, target) => element.selectDiagnostic(target), diagnostic.locationId)).ok, true);
      assert.equal((await page.locator(`#${id}`).evaluate((element, target) => element.selectOutlineItem(target), report.outline.value.items[1].id)).ok, true);
      const selected = await page.locator(`#${id}`).evaluate(element => element.snapshot());
      assert.deepEqual(selected.revision, report.before.revision); assert.equal(selected.dirty, report.before.dirty);
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(beforeBytes));
      if (!readOnly) {
        assert.equal((await page.locator(`#${id}`).evaluate(element => element.focusEditor())).ok, true);
        await page.keyboard.insertText('Heading navigation sentinel ');
        await page.waitForFunction(({ id, revision }) => document.getElementById(id).snapshot().revision.value > revision,
          { id, revision: report.before.revision.value });
        assert.match(strFromU8(unzipSync(Uint8Array.from(await saveEditor(page, id)))['word/document.xml']),
          /Heading navigation sentinel Numbered item/);
        const stale = await page.locator(`#${id}`).evaluate((element, target) => element.selectOutlineItem(target), report.outline.value.items[0].id);
        assert.deepEqual(stale, { ok: false, code: 'stale-revision' });
      }
      await page.locator(`#${id}`).evaluate(element => element.remove());
    });
  }
}
