import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { zipParts } from './lib/harness.mjs';

const documentXml = bytes => strFromU8(unzipSync(Uint8Array.from(bytes))['word/document.xml']);
const remove = (page, id) => page.locator(`#${id}`).evaluate(element => element.remove());

/** Real-engine checks for fragment reads, edit batches and URL loading, through public element APIs only. */
export async function runDocumentOperations(page, check, { createEditor, saveEditor }) {
  await check('paint identifies duplicate body paragraphs and refreshes their fragments after zoom', async () => {
    const id = 'operations-paint';
    const parts = unzipSync(Uint8Array.from(await page.evaluate(() => window.__docxTest.fixture('basic-editing'))));
    const paragraph = '<w:p><w:r><w:t>Repeated 😀 text</w:t></w:r></w:p>';
    const splitParagraph = '<w:p><w:r>' + '<w:t>Wrapped line</w:t><w:br/>'.repeat(100) + '</w:r></w:p>';
    const followingPages = Array.from({ length: 16 }, (_, index) =>
      '<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>Page ' + index + '</w:t></w:r></w:p>').join('');
    parts['word/document.xml'] = strToU8(strFromU8(parts['word/document.xml'])
      .replace('<w:body>', '<w:body>' + paragraph.repeat(2) + splitParagraph).replace('</w:body>', followingPages + '</w:body>'));
    const bytes = [...zipSync(parts)];
    const opened = await page.evaluate(async ({ id, bytes }) => {
      const editor = document.createElement('lr-docx-editor');
      editor.id = id;
      editor.paintEvents = [];
      editor.nextPaint = () => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Missing page paint notification')), 5000);
        editor.addEventListener('lr-paint', event => { clearTimeout(timeout); resolve(event.detail); }, { once: true });
      });
      editor.addEventListener('lr-paint', event => editor.paintEvents.push(event.detail));
      document.querySelector('#fixture').append(editor);
      return editor.open(Uint8Array.from(bytes));
    }, { id, bytes });
    try {
      assert.equal(opened.ok, true);
      await page.waitForFunction(id => document.getElementById(id).paintEvents.length > 0, id);
      const editor = page.locator('#' + id);
      const painted = await editor.evaluate(editor => {
        const result = editor.readFragment({ maxBlocks: 2 });
        const paragraphs = result.value.blocks.map(block => {
          const fragment = editor.querySelector('[data-lr-block-index="' + block.index + '"]');
          const range = document.createRange();
          range.selectNodeContents(fragment);
          return [block.index, block.text, range.toString()];
        });
        const detail = editor.paintEvents.at(-1);
        editor.paintEvents.length = 0;
        editor.zoom = 0.75;
        return { paragraphs, detail };
      });
      assert.deepEqual(painted.paragraphs, [[0, 'Repeated 😀 text', 'Repeated 😀 text'], [1, 'Repeated 😀 text', 'Repeated 😀 text']]);
      assert.deepEqual(painted.detail.revision, opened.value);
      assert.ok(painted.detail.pageIndexes.includes(0));
      await page.waitForFunction(id => document.getElementById(id).paintEvents.some(detail => detail.pageIndexes.includes(0)), id);
      assert.equal(await editor.locator('[data-lr-block-index="1"]').count(), 1);
      assert.ok(await editor.locator('[data-lr-block-index="2"]').count() >= 2, 'one body block can have fragments on multiple pages');
      assert.equal(await editor.locator('.docx-table-fragment [data-lr-block-index]').count(), 0);

      const last = await editor.evaluate(editor => {
        const last = editor.readFragment({ maxBlocks: 64 }).value.blocks.filter(block => block.kind === 'paragraph').at(-1);
        const pages = [...editor.querySelectorAll('.docx-page')];
        const lastPage = Number(pages.at(-1).dataset.pageIndex);
        const before = editor.querySelector('[data-lr-block-index="' + last.index + '"]') !== null;
        editor.paintEvents.length = 0;
        const viewport = editor.querySelector('[data-lr-docx-viewport]');
        viewport.scrollTop = viewport.scrollHeight;
        return { before, index: last.index, page: lastPage };
      });
      assert.equal(last.before, false, 'a virtual page has no painted paragraph');
      await page.waitForFunction(({ id, last }) => {
        const editor = document.getElementById(id);
        return editor.paintEvents.some(detail => detail.pageIndexes.includes(last.page)) &&
          editor.querySelector('[data-lr-block-index="' + last.index + '"]') !== null;
      }, { id, last });
      await editor.evaluate(editor => {
        editor.paintEvents.length = 0;
        const viewport = editor.querySelector('[data-lr-docx-viewport]');
        viewport.scrollTop = 0;
      });
      await page.waitForFunction(({ id, last }) => {
        const editor = document.getElementById(id);
        return editor.paintEvents.some(detail => detail.pageIndexes.includes(last.page)) &&
          editor.querySelector('[data-lr-block-index="' + last.index + '"]') === null;
      }, { id, last });

      const original = await editor.evaluate(editor => {
        const first = editor.readFragment({ maxBlocks: 2 }).value.blocks[0];
        editor.selectFragmentBlock(first.id);
        editor.focusEditor();
        editor.paintEvents.length = 0;
        return editor.snapshot().revision.value;
      });
      await page.keyboard.press('Enter');
      await page.waitForFunction(({ id, original }) => {
        const editor = document.getElementById(id);
        if (!editor.paintEvents.some(detail => detail.revision.value > original)) return false;
        const blocks = editor.readFragment({ maxBlocks: 3 });
        if (!blocks.ok) return false;
        return blocks.value.blocks.map(block => block.text).join('|') === '|Repeated 😀 text|Repeated 😀 text' &&
          [1, 2].every(index => editor.querySelector('[data-lr-block-index="' + index + '"]')?.textContent === 'Repeated 😀 text');
      }, { id, original });
      assert.equal((await editor.evaluate(editor => editor.execute('undo'))).ok, true);
      await page.waitForFunction(id => document.getElementById(id).querySelector('[data-lr-block-index="0"]')?.textContent === 'Repeated 😀 text', id);

      // A retained page can repaint its furniture without touching its body.
      const furniture = await editor.evaluate(async editor => {
        const layer = editor.querySelector('.docx-page .docx-hf');
        const page = layer.closest('[data-page-index]');
        const nextPaint = editor.nextPaint();
        layer.append(document.createTextNode('Updated header'));
        return { detail: await nextPaint, page: Number(page.dataset.pageIndex),
          indexed: layer.querySelector('[data-lr-block-index]') !== null };
      });
      assert.ok(furniture.detail.pageIndexes.includes(furniture.page));
      assert.equal(furniture.indexed, false);

      // Exercise in-place painter recycling without making it depend on an engine optimization.
      const recycled = await editor.evaluate(async editor => {
        const fragment = editor.querySelector('[data-lr-block-index="1"]');
        const page = fragment.closest('[data-page-index]');
        const nextPaint = editor.nextPaint();
        const oldIndex = Number(page.dataset.pageIndex);
        page.dataset.pageIndex = '70';
        fragment.removeAttribute('data-paragraph-id');
        const detail = await nextPaint;
        const stale = fragment.hasAttribute('data-lr-block-index');
        editor.paintEvents.length = 0;
        page.dataset.pageIndex = String(oldIndex);
        await Promise.resolve();
        editor.remove();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { stale, pages: detail.pageIndexes, oldIndex, laterEvents: editor.paintEvents.length };
      });
      assert.equal(recycled.stale, false);
      assert.ok([recycled.oldIndex, 70].every(index => recycled.pages.includes(index)));
      assert.equal(recycled.laterEvents, 0);
    } finally { await page.evaluate(id => document.getElementById(id)?.remove(), id); }
  });

  await check('selection location joins the current outline and catalog reports authored heading levels', async () => {
    const id = 'operations-outline-metadata';
    const parts = unzipSync(Uint8Array.from(await page.evaluate(() => window.__docxTest.fixture('basic-editing'))));
    const styles =
      '<w:style w:type="paragraph" w:styleId="LocalTitle"><w:name w:val="Titre du service"/>' +
      '<w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="LocalSubheading"><w:name w:val="Rubrique interne"/>' +
      '<w:basedOn w:val="LocalTitle"/></w:style>';
    parts['word/styles.xml'] = strToU8(strFromU8(parts['word/styles.xml']).replace('</w:styles>', styles + '</w:styles>'));
    const paragraph = (text, styleId) => '<w:p>' + (styleId ? '<w:pPr><w:pStyle w:val="' + styleId + '"/></w:pPr>' : '') +
      '<w:r><w:t>' + text + '</w:t></w:r></w:p>';
    const additional = paragraph('Première section', 'LocalTitle') + paragraph('Paragraph in the first section') +
      paragraph('Deuxième section', 'LocalSubheading');
    parts['word/document.xml'] = strToU8(strFromU8(parts['word/document.xml']).replace('<w:body>', '<w:body>' + additional));
    const bytes = [...zipSync(parts)];
    try {
      const mounted = await page.evaluate(({ id, bytes }) => {
        const editor = document.createElement('lr-docx-editor');
        editor.id = id;
        document.querySelector('#fixture').append(editor);
        return editor.open(Uint8Array.from(bytes));
      }, { id, bytes });
      assert.equal(mounted.ok, true, JSON.stringify(mounted));
      const editor = page.locator('#' + id);
      const before = await editor.evaluate(element => {
        const fragment = element.readFragment({ maxBlocks: 4 }).value;
        const outline = element.outline().value;
        const catalog = element.paragraphStyles().value;
        const selectionChanges = [];
        element.addEventListener('lr-selection-change', event => selectionChanges.push(event.detail.selection.version));
        const selected = element.selectFragmentBlock(fragment.blocks[3].id, { expectedRevision: fragment.revision });
        element.focusEditor();
        const location = element.selectionBlock({ expectedRevision: outline.revision });
        const last = location.ok ? outline.items.findLast(row => row.blockIndex <= location.value.index) : null;
        return { fragment, outline, catalog, selected, location, last, selectionChanges, dirty: element.snapshot().dirty };
      });
      assert.deepEqual(before.catalog.items.filter(style => style.id.startsWith('Local')).map(style => [style.id, style.outlineLevel]).sort(),
        [['LocalSubheading', 1], ['LocalTitle', 1]]);
      assert.deepEqual(before.fragment.blocks.map(block => [block.index, block.headingLevel]), [[0, 1], [1, null], [2, 1], [3, null]]);
      assert.deepEqual(before.outline.items.slice(0, 2).map(row => [row.blockIndex, row.level]), [[0, 1], [2, 1]]);
      assert.equal(before.selected.ok, true);
      assert.deepEqual(before.location, { ok: true, value: { index: 3, revision: mounted.value } });
      assert.equal(before.last.text, 'Deuxième section');
      assert.ok(before.selectionChanges.length > 0);
      assert.equal(before.dirty, false);

      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(({ id, revision }) => {
        const location = document.getElementById(id).selectionBlock({ expectedRevision: revision });
        return location.ok && location.value.index === 2;
      }, { id, revision: mounted.value });

      const changed = await editor.evaluate(async (element, { initial, styleId }) => {
        const previous = element.readFragment({ start: 1, maxBlocks: 1 }).value.blocks[0];
        const edited = await element.applyEdits([{ edit: { type: 'paragraph-style', styleId }, target: previous.id }],
          { expectedRevision: initial });
        return { edited, stale: element.selectionBlock({ expectedRevision: initial }),
          fragment: element.readFragment({ start: 1, maxBlocks: 1, expectedRevision: edited.value }) };
      }, { initial: mounted.value, styleId: before.catalog.items.find(style => style.id === 'LocalSubheading').id });
      assert.equal(changed.edited.ok, true);
      assert.deepEqual(changed.stale, { ok: false, code: 'stale-revision' });
      assert.equal(changed.fragment.value.blocks[0].headingLevel, 1);
      assert.equal((await editor.evaluate(element => element.execute('undo'))).ok, true);
      const undone = await editor.evaluate(element => element.readFragment({ start: 1, maxBlocks: 1 }));
      assert.equal(undone.value.blocks[0].headingLevel, null);
    } finally { await remove(page, id); }
  });

  await check('fragment reads copy bounded body block slices and navigate without editing', async () => {
    const id = 'operations-fragment'; await createEditor(page, id, 'basic-editing');
    try {
      const before = await saveEditor(page, id);
      const report = await page.locator(`#${id}`).evaluate(element => {
        const snapshot = element.snapshot();
        const all = element.readFragment({ maxBlocks: 64 });
        const slice = element.readFragment({ start: 1, maxBlocks: 2 });
        const clipped = element.readFragment({ maxText: 4 });
        const end = element.readFragment({ start: all.value.blockCount });
        const beyond = element.readFragment({ start: all.value.blockCount + 1 });
        const selected = element.selectFragmentBlock(all.value.blocks[1].id, { expectedRevision: all.value.revision });
        return { snapshot, all, slice, clipped, end, beyond, selected, after: element.snapshot() };
      });
      assert.equal(report.all.ok, true, JSON.stringify(report.all));
      const blocks = report.all.value.blocks;
      assert.deepEqual(blocks.slice(0, 3).map(block => [block.index, block.kind, block.text]),
        [[0, 'paragraph', 'Corpus opening'], [1, 'paragraph', 'Numbered item'], [2, 'table', 'Cell A\tCell B']]);
      assert.deepEqual([report.all.value.blockCount, report.all.value.next, report.all.value.truncated], [blocks.length, null, false]);
      assert(blocks.every(block => (typeof block.id === 'string') === (block.kind === 'paragraph')));
      assert.deepEqual([report.slice.value.blocks.map(block => block.index), report.slice.value.next], [[1, 2], 3]);
      assert.deepEqual([report.clipped.value.blocks.map(block => [block.text, block.textTruncated]), report.clipped.value.truncated, report.clipped.value.next],
        [[['Corp', true]], true, 1]);
      assert.deepEqual([report.end.value.blocks, report.end.value.next], [[], null]);
      assert.deepEqual(report.beyond, { ok: false, code: 'invalid-option' });
      assert.deepEqual(report.selected, { ok: true, value: undefined });
      assert.deepEqual([report.after.revision, report.after.dirty], [report.snapshot.revision, report.snapshot.dirty]);
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before), 'reading and navigating change nothing');
    } finally { await remove(page, id); }
  });

  await check('an edit batch commits once, undoes as one step, and refused batches leave the document unchanged', async () => {
    const id = 'operations-batch'; await createEditor(page, id, 'basic-editing');
    try {
      const original = documentXml(await saveEditor(page, id));
      const committed = await page.locator(`#${id}`).evaluate(async element => {
        const fragment = element.readFragment();
        const [first, second] = fragment.value.blocks;
        const result = await element.applyEdits([
          { edit: { type: 'alignment', value: 'center' }, target: first.id },
          { edit: { type: 'line-spacing', multiple: 2 }, target: second.id },
          { edit: { type: 'paragraph-style', styleId: 'CustomHeading' }, target: first.id },
        ], { expectedRevision: fragment.value.revision });
        const retry = await element.applyEdits([{ edit: { type: 'alignment', value: 'right' }, target: first.id }],
          { expectedRevision: fragment.value.revision });
        return { before: fragment.value.revision, result, retry, after: element.snapshot() };
      });
      assert.deepEqual(committed.result, { ok: true, value: { ...committed.before, value: committed.before.value + 1 } });
      assert.deepEqual(committed.retry, { ok: false, code: 'stale-revision', step: null }, 'a retried batch never applies twice');
      assert.deepEqual([committed.after.revision, committed.after.dirty], [committed.result.value, true]);
      const edited = documentXml(await saveEditor(page, id));
      assert.match(edited, /<w:jc w:val="center"\/>/u);
      assert.match(edited, /<w:spacing[^>]*w:line="480"/u);
      const styled = xml => xml.match(/<w:pStyle w:val="CustomHeading"\/>/gu)?.length ?? 0;
      assert.equal(styled(edited), styled(original) + 1);

      const refused = await page.locator(`#${id}`).evaluate(async element => {
        const fragment = element.readFragment();
        const revision = fragment.value.revision, target = fragment.value.blocks[0].id;
        return {
          revision,
          style: await element.applyEdits([{ edit: { type: 'alignment', value: 'right' }, target },
            { edit: { type: 'paragraph-style', styleId: 'NoSuchStyle' }, target }], { expectedRevision: revision }),
          list: await element.applyEdits([{ edit: 'bold' }, { edit: { type: 'toggle-list', kind: 'bullet' }, target }], { expectedRevision: revision }),
          targetedRun: await element.applyEdits([{ edit: 'bold', target }], { expectedRevision: revision }),
          after: element.snapshot().revision,
        };
      });
      assert.deepEqual(refused.style, { ok: false, code: 'invalid-option', step: 1 });
      assert.deepEqual(refused.list, { ok: false, code: 'unsupported', step: 1 });
      assert.deepEqual(refused.targetedRun, { ok: false, code: 'invalid-option', step: 0 });
      assert.deepEqual(refused.after, refused.revision);
      assert.equal(documentXml(await saveEditor(page, id)), edited, 'refused batches leave the document unchanged');

      const undone = await page.locator(`#${id}`).evaluate(element => element.execute('undo'));
      assert.equal(undone.ok, true, JSON.stringify(undone));
      assert.equal(documentXml(await saveEditor(page, id)), original, 'one undo reverts the whole batch');
    } finally { await remove(page, id); }
  });

  await check('openUrl opens a same-origin blob URL and fails closed for unsafe or cancelled sources', async () => {
    const bytes = [...await page.evaluate(() => window.__docxTest.fixture('basic-editing'))];
    const report = await page.evaluate(async bytes => {
      const make = id => { const element = document.createElement('lr-docx-editor'); element.id = id; document.querySelector('#fixture').append(element); return element; };
      const url = URL.createObjectURL(new Blob([Uint8Array.from(bytes)]));
      try {
        const loaded = make('operations-url');
        const opened = await loaded.openUrl(url, { name: 'Remote.docx' });
        await loaded.updateComplete;
        const fragment = loaded.readFragment({ maxBlocks: 1 });
        const unsafe = make('operations-url-unsafe');
        const refused = await unsafe.openUrl('javascript:alert(1)');
        await unsafe.updateComplete;
        // Mid-request cancellation is covered by unit tests; an aborted request is a browser request failure here.
        const cancelled = make('operations-url-cancelled'), controller = new AbortController();
        controller.abort();
        const aborted = await cancelled.openUrl(url, { signal: controller.signal });
        await cancelled.updateComplete;
        const errorText = element => element.shadowRoot.querySelector('[part="error"]')?.textContent?.trim() ?? '';
        return {
          opened, status: loaded.snapshot()?.status, filename: loaded.shadowRoot.querySelector('[part="filename"]')?.textContent?.trim(),
          text: fragment.ok ? fragment.value.blocks[0].text : null,
          refused, unsafeError: errorText(unsafe), unsafeRole: unsafe.shadowRoot.querySelector('[part="error"]')?.getAttribute('role') ?? null,
          aborted, cancelledError: errorText(cancelled), cancelledSnapshot: cancelled.snapshot(),
        };
      } finally {
        URL.revokeObjectURL(url);
        for (const id of ['operations-url', 'operations-url-unsafe', 'operations-url-cancelled']) document.getElementById(id)?.remove();
      }
    }, bytes);
    assert.equal(report.opened.ok, true, JSON.stringify(report.opened));
    assert.deepEqual([report.status, report.filename, report.text], ['ready', 'Remote.docx', 'Corpus opening']);
    assert.deepEqual(report.refused, { ok: false, code: 'invalid-option' });
    assert.ok(report.unsafeError.length > 0, 'an unsafe URL shows the localized error state');
    assert.doesNotMatch(report.unsafeError, /javascript/iu, 'the error never echoes the source');
    assert.equal(report.unsafeRole, null, 'the visible fallback is not a live region');
    assert.deepEqual(report.aborted, { ok: false, code: 'aborted' });
    assert.deepEqual([report.cancelledError, report.cancelledSnapshot], ['', null], 'cancellation is not an error');
  });
}
