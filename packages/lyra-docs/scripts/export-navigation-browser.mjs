import assert from 'node:assert/strict';
import { zipEntry } from '../test/zip.mjs';
import { wordText } from '../test/xml.mjs';

export async function runExportNavigation(page, check, { createEditor }) {
  await check('individual navigation parts style one toggle while shared styles and other panels remain available', async () => {
    const id = 'individual-panel-parts';
    await createEditor(page, id);
    const editor = page.locator(`#${id}`);
    const css = await page.addStyleTag({ content: `
      #${id}::part(document-panel-toggle) { outline: 2px solid rgb(31, 79, 191); }
      #${id}::part(outline-toggle) { display: none; }
      #${id}::part(checks-toggle) { border-inline-start: 3px solid rgb(19, 101, 68); }
      #${id}::part(review-toggle) { border-inline-end: 4px solid rgb(124, 37, 94); }
    ` });
    try {
      for (const placement of ['separate', 'first-row']) {
        await editor.evaluate(async (element, placement) => { element.documentToolsPlacement = placement; await element.updateComplete; }, placement);
        const chrome = await editor.evaluate(element => {
          const nav = element.shadowRoot.querySelector('[part="navigation-tools"]');
          const panels = [...nav.querySelectorAll('[part~="document-panel-toggle"]')];
          return panels.map(toggle => {
            const style = getComputedStyle(toggle);
            return [toggle.id, style.outlineColor, style.display === 'none', style.borderInlineStartWidth, style.borderInlineEndWidth];
          });
        });
        assert.deepEqual(chrome.map(([id, shared, hidden]) => [id, shared, hidden]), [
          ['tool-outline', 'rgb(31, 79, 191)', true], ['tool-checks', 'rgb(31, 79, 191)', false],
          ['tool-review', 'rgb(31, 79, 191)', false],
        ]);
        assert.equal(chrome[1][3], '3px');
        assert.equal(chrome[2][4], '4px');
        for (const [key, title] of [['checks', 'Document checks'], ['review', 'Review']]) {
          const button = editor.locator(`[part~="${key}-toggle"]`).getByRole('button', { name: title, exact: true });
          await button.click();
          assert.equal(await button.getAttribute('aria-pressed'), 'true');
          assert.equal(await editor.locator('[part="document-panel-heading"]').textContent(), title);
          await editor.locator('[part="document-panel-close"]').click();
        }
      }
    } finally {
      await css.evaluate(node => node.remove());
      await editor.evaluate(element => element.remove());
    }
  });

  await check('export returns the edited DOCX without emitting Save or superseding a pending persistence receipt', async () => {
    const id = 'export-with-receipt';
    await createEditor(page, id);
    const editor = page.locator(`#${id}`);
    try {
      await editor.locator('.docx-pages').click();
      await page.keyboard.insertText('Retain this draft');
      await page.waitForFunction(id => document.getElementById(id).snapshot()?.dirty, id);
      const state = await editor.evaluate(async element => {
        let emitted = 0;
        const received = [];
        element.addEventListener('lr-save', event => { emitted++; received.push(event.detail.receipt); });
        const saved = await element.save();
        if (!saved.ok) return { code: saved.code };
        const original = saved.value.revision;
        const exported = await element.exportBytes({ expectedRevision: original });
        if (!exported.ok) return { code: exported.code };
        const afterExport = element.snapshot();
        const countAfterExport = emitted;
        const ack = element.acknowledgeSaved(saved.value);
        const afterAck = element.snapshot();
        const later = await element.save();
        return {
          bytes: [...exported.value], original, current: afterExport.revision, dirtyAfterExport: afterExport.dirty,
          dirtyAfterAck: afterAck.dirty, acknowledged: ack.ok, countAfterExport, emitted,
          sameReceipts: saved.value === received[0] && later.ok && later.value === received[1],
        };
      });
      assert.equal(state.code, undefined);
      assert.equal(wordText(zipEntry(state.bytes, 'word/document.xml')), 'Retain this draft');
      assert.deepEqual(state.current, state.original);
      assert.deepEqual([state.dirtyAfterExport, state.acknowledged, state.dirtyAfterAck, state.countAfterExport, state.emitted,
        state.sameReceipts], [true, true, false, 1, 2, true]);
    } finally { await editor.evaluate(element => element.remove()); }
  });
}
