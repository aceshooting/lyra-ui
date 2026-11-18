import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { paints, zipParts } from './lib/harness.mjs';

const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function richSection(source) {
  const parts = unzipSync(Uint8Array.from(source));
  const update = (name, replace) => { parts[name] = strToU8(replace(strFromU8(parts[name]))); };
  update('[Content_Types].xml', xml => xml.replace('</Types>', '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/></Types>'));
  update('word/_rels/document.xml.rels', xml => xml.replace('</Relationships>', '<Relationship Id="rIdComment" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/></Relationships>'));
  parts['word/comments.xml'] = strToU8('<w:comments xmlns:w="' + word + '"><w:comment w:id="0" w:author="Author"><w:p><w:r><w:t>Section note</w:t></w:r></w:p></w:comment></w:comments>');
  const pages = Array.from({ length: 3 }, (_, index) => '<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>Page ' + index + '</w:t></w:r></w:p>').join('');
  update('word/document.xml', xml => xml.replace('<w:p><w:r><w:t>Corpus opening', '<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:commentRangeStart w:id="0"/><w:r><w:t>Corpus opening')
    .replace('<w:r><w:t>Numbered item</w:t></w:r>', '<w:r><w:rPr><w:b/></w:rPr><w:t>Numbered item</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>')
    .replace('</w:body>', pages + '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/></w:sectPr></w:body>'));
  return [...zipSync(parts)];
}

async function contents(page, bytes) {
  const parts = zipParts(bytes);
  const xmlName = 'word/document.xml';
  const blocks = await page.evaluate(({ xml, word }) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const body = doc.getElementsByTagNameNS(word, 'body')[0];
    return [...body.children].map(block => new XMLSerializer().serializeToString(block));
  }, { xml: strFromU8(Uint8Array.from(parts[xmlName])), word });
  delete parts[xmlName];
  return { parts, blocks };
}

/** Verify an outline move through the mounted public API, saved OOXML and native history. */
export async function runBlockMoves(page, check, { saveEditor }) {
  await check('rich body blocks move once at their original indices and retain their undo history', async () => {
    const id = 'operations-block-move';
    const bytes = richSection(await page.evaluate(() => window.__docxTest.fixture('basic-editing')));
    const editor = page.locator('#' + id);
    const opened = await page.evaluate(async ({ id, bytes }) => {
      const element = document.createElement('lr-docx-editor');
      element.id = id;
      document.querySelector('#fixture').append(element);
      return element.open(Uint8Array.from(bytes));
    }, { id, bytes });
    try {
      assert.equal(opened.ok, true, JSON.stringify(opened));
      await editor.locator('.docx-pages').waitFor({ state: 'visible' });
      const original = await contents(page, await saveEditor(page, id));
      const aligned = await editor.evaluate(element => {
        const fragment = element.readFragment().value;
        return element.applyEdits([{ edit: { type: 'alignment', value: 'center' }, target: fragment.blocks[0].id }],
          { expectedRevision: fragment.revision });
      });
      assert.equal(aligned.ok, true);
      const previous = await contents(page, await saveEditor(page, id));
      assert.notDeepEqual(previous.blocks, original.blocks);
      const report = await editor.evaluate(async element => {
        const fragment = element.readFragment().value;
        const expectedRevision = fragment.revision;
        const move = (start, end, before) => element.applyEdits([{ edit: { type: 'move-blocks', start, end, before } }], { expectedRevision });
        const selected = element.selectFragmentBlock(fragment.blocks[1].id, { expectedRevision });
        const savedBefore = await element.save();
        if (!savedBefore.ok) throw new Error('Failed to obtain save receipt');
        const caretBefore = element.selectionBlock({ expectedRevision });
        const viewport = element.querySelector('[data-lr-docx-viewport]');
        viewport.scrollTop = 48;
        const initialScroll = viewport.scrollTop;
        let saves = 0;
        const saved = () => { saves++; };
        element.addEventListener('lr-save', saved);
        try {
          const noop = await move(0, 3, 3);
          const split = await move(0, 1, 3);
          const overlap = await move(0, 3, 2);
          const section = await move(fragment.blockCount - 1, fragment.blockCount, 0);
          const acknowledged = element.acknowledgeSaved(savedBefore.value);
          const clean = element.snapshot().dirty === false;
          const moved = await move(0, 3, 4);
          const caretAfter = element.selectionBlock();
          const obsoleteReceipt = element.acknowledgeSaved(savedBefore.value);
          const retried = await move(0, 3, 4);
          const after = element.readFragment().value;
          return { selected, noop, split, overlap, section, moved, retried, caretBefore, caretAfter, acknowledged, clean, obsoleteReceipt, after: after.blocks.map(block => block.text),
            snapshot: element.snapshot(), expectedRevision, saves, initialScroll, sameViewport: element.querySelector('[data-lr-docx-viewport]') === viewport };
        } finally { element.removeEventListener('lr-save', saved); }
      });
      const initial = report.expectedRevision;
      assert.equal(report.selected.ok, true);
      assert.deepEqual(report.noop, { ok: true, value: initial });
      assert.deepEqual(report.split, { ok: false, code: 'unsupported', step: 0 });
      assert.deepEqual(report.overlap, { ok: false, code: 'invalid-option', step: 0 });
      assert.deepEqual(report.section, { ok: false, code: 'invalid-option', step: 0 });
      assert.deepEqual(report.moved, { ok: true, value: { ...initial, value: initial.value + 1 } });
      assert.deepEqual(report.retried, { ok: false, code: 'stale-revision', step: null });
      assert.equal(report.acknowledged.ok, true, 'the same save receipt survives refused and no-op moves');
      assert.equal(report.clean, true);
      assert.deepEqual(report.obsoleteReceipt, { ok: false, code: 'stale-save' });
      assert.deepEqual(report.caretBefore, { ok: true, value: { revision: initial, index: 1 } });
      assert.deepEqual(report.caretAfter, { ok: true, value: { revision: report.moved.value, index: 2 } });
      assert.equal(report.snapshot.dirty, true);
      assert.equal(report.saves, 0);
      assert.equal(report.sameViewport, true);
      assert.deepEqual(report.after.slice(1, 4), ['Corpus opening', 'Numbered item', 'Cell A\tCell B']);
      await paints(page);
      assert.ok(report.initialScroll > 0);
      assert.equal(await editor.locator('[data-lr-docx-viewport]').evaluate(viewport => viewport.scrollTop), report.initialScroll);
      const ordered = await contents(page, await saveEditor(page, id));
      assert.deepEqual(ordered.parts, previous.parts, 'comment text, numbering, relationships and media survive');
      assert.deepEqual(ordered.blocks, [previous.blocks[3], ...previous.blocks.slice(0, 3), ...previous.blocks.slice(4)]);
      const review = await editor.evaluate(element => element.review());
      assert.ok(review.value.items.some(item => item.kind === 'comment' && item.text === 'Section note' && !item.orphaned));
      for (const [command, expected] of [['undo', previous], ['undo', original], ['redo', previous], ['redo', ordered]]) {
        assert.equal((await editor.evaluate((element, command) => element.execute(command), command)).ok, true);
        assert.deepEqual(await contents(page, await saveEditor(page, id)), expected);
      }
    } finally { await editor.evaluate(element => element.remove()); }
  });
}
