import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { zipParts } from './lib/harness.mjs';

const documentXml = bytes => strFromU8(unzipSync(Uint8Array.from(bytes))['word/document.xml']);
const remove = (page, id) => page.locator(`#${id}`).evaluate(element => element.remove());

/** Real-engine checks for fragment reads, edit batches and URL loading, through public element APIs only. */
export async function runDocumentOperations(page, check, { createEditor, saveEditor }) {
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
