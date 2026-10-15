import assert from 'node:assert/strict';
import { paints, assertNoAxeViolations } from './lib/harness.mjs';
import { wordText } from '../test/xml.mjs';
import { zipEntry } from '../test/zip.mjs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/** Command ownership, original selection and fresh revision-scoped search navigation. */
export async function runCommandsAndSearch(page, check, { createEditor, saveEditor }) {
  const host = id => page.locator(`#${id}`);
  const remove = id => page.evaluate(id => document.getElementById(id)?.remove(), id);
  const palette = id => host(id).locator('[part="command-palette"]');

  await check('commands retain the original text selection and have no global hotkey owner', async () => {
    const id = 'commands-original';
    await createEditor(page, id);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.insertText('Original text');
    await paints(page);
    await page.keyboard.press('ControlOrMeta+A');
    await page.waitForFunction(id => document.getElementById(id).snapshot().selection.kind === 'text', id);
    await page.keyboard.press('ControlOrMeta+K');
    await palette(id).getByRole('dialog').waitFor({ state: 'visible' });
    assert.equal(await palette(id).getAttribute('hotkey'), '');
    await assertNoAxeViolations(page, id);
    await palette(id).getByRole('searchbox').fill('Bold');
    await page.keyboard.press('Enter');
    await palette(id).getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await host(id).evaluate(element => element.snapshot().commands.bold.active), true);
    const bytes = await saveEditor(page, id);
    assert.equal(wordText(zipEntry(bytes, 'word/document.xml')), 'Original text');
    assert.match(zipEntry(bytes, 'word/document.xml'), /<w:b(?:\s|\/|>)/u);
    await page.evaluate(() => {
      const input = document.createElement('input'); input.id = 'outside-commands'; document.querySelector('#fixture').append(input);
    });
    await page.locator('#outside-commands').focus();
    assert.equal(await page.locator('#outside-commands').evaluate(input => {
      const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, composed: true, cancelable: true });
      input.dispatchEvent(event); return event.defaultPrevented;
    }), false);
    assert.equal(await palette(id).evaluate(element => element.open), false);
    await page.locator('#outside-commands').evaluate(element => element.remove());
    await remove(id);
  });

  await check('Ctrl+S serializes the focused document and prevents browser default', async () => {
    const id = 'commands-save-shortcut';
    await createEditor(page, id);
    try {
      await host(id).locator('.docx-pages').click();
      await page.keyboard.insertText('Shortcut save content');
      await page.waitForFunction(id => document.getElementById(id).snapshot().dirty, id);
      await host(id).evaluate(element => {
        const state = { keydownPrevented: null, receipt: null, keydownListener: null };
        const onKeyDown = event => {
          if (event.key.toLowerCase() !== 's') return;
          state.keydownPrevented = event.defaultPrevented;
          element.removeEventListener('keydown', onKeyDown, true);
        };
        state.keydownListener = onKeyDown;
        element.addEventListener('keydown', onKeyDown, true);
        element.addEventListener('lr-save', event => {
          state.receipt = {
            revision: event.detail.receipt.revision,
            bytes: [...event.detail.receipt.bytes]
          };
        }, { once: true });
        window.__shortcutSaveState = state;
      });
      await page.keyboard.press('ControlOrMeta+s');
      await page.waitForFunction(() => {
        const state = window.__shortcutSaveState;
        return Boolean(state && state.keydownPrevented !== null && state.receipt !== null);
      }, null, { timeout: 5000 });
      const observed = await page.evaluate(() => window.__shortcutSaveState);
      assert.equal(observed.keydownPrevented, true, 'the editor owns the save chord while its document is focused');
      assert.ok(observed.receipt.revision);
      assert.ok(observed.receipt.bytes.length > 0);
      assert.equal(wordText(zipEntry(observed.receipt.bytes, 'word/document.xml')), 'Shortcut save content');
      assert.equal(await host(id).evaluate(element => element.snapshot().dirty), true,
        'serialization alone is not persistence acknowledgement');
    } finally {
      await host(id).evaluate(element => {
        const state = window.__shortcutSaveState;
        if (state?.keydownListener) element.removeEventListener('keydown', state.keydownListener, true);
        delete window.__shortcutSaveState;
      });
      await remove(id);
    }
  });

  await check('stale original selections and forged command rows cannot edit from the palette', async () => {
    const id = 'commands-stale';
    await createEditor(page, id);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.insertText('Text');
    await paints(page);
    await page.keyboard.press('ControlOrMeta+A');
    await page.waitForFunction(id => document.getElementById(id).snapshot().selection.kind === 'text', id);
    await page.keyboard.press('ControlOrMeta+K');
    await palette(id).getByRole('dialog').waitFor({ state: 'visible' });
    const forged = await palette(id).evaluate(async element => {
      const editor = element.getRootNode().host;
      const before = editor.snapshot().revision.value;
      const row = element.commands.find(row => row.commandId === 'bold');
      element.dispatchEvent(new CustomEvent('lr-select', { bubbles: true, composed: true, detail: { command: { ...row } } }));
      element.close(); await element.updateComplete; await editor.updateComplete;
      return { before, after: editor.snapshot().revision.value };
    });
    assert.equal(forged.after, forged.before);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.waitForFunction(id => document.getElementById(id).snapshot().selection.kind === 'text', id);
    await page.keyboard.press('ControlOrMeta+K');
    await palette(id).getByRole('dialog').waitFor({ state: 'visible' });
    const changed = await host(id).evaluate(async element => {
      const before = element.snapshot().revision.value;
      const result = await element.execute('italic');
      return { ok: result.ok, delta: element.snapshot().revision.value - before };
    });
    assert.deepEqual(changed, { ok: true, delta: 1 });
    await paints(page);
    const rows = await palette(id).evaluate(element => element.commands.map(row => ({ disabled: row.disabled, description: row.description })));
    assert.ok(rows.every(row => row.disabled));
    assert.ok(rows.every(row => row.description.includes('original selection changed')));
    await page.keyboard.press('Escape');
    await remove(id);
  });

  await check('localized palette rows route panels and retain the original range for a comment', async () => {
    const id = 'commands-panels'; await createEditor(page, id);
    try {
      await host(id).locator('.docx-pages').click(); await page.keyboard.insertText('Panel navigation');
      await paints(page); await page.keyboard.press('ControlOrMeta+A');
      await page.waitForFunction(id => document.getElementById(id).snapshot().selection.kind === 'text', id);
      const before = await host(id).evaluate(element => element.snapshot().revision);
      for (const [key, label] of [['outline', 'Document map'], ['checks', 'Body checks'], ['review', 'Discussion']]) {
        await host(id).locator('.docx-pages').click(); await page.keyboard.press('ControlOrMeta+A');
        await page.waitForFunction(id => document.getElementById(id).snapshot().selection.kind === 'text', id);
        await page.keyboard.press('ControlOrMeta+K');
        await palette(id).getByRole('dialog').waitFor({ state: 'visible' });
        await host(id).evaluate(async (element, strings) => { element.strings = strings; await element.updateComplete; },
          { [`docxEditor${key[0].toUpperCase()}${key.slice(1)}`]: label });
        await page.waitForFunction(({ id, key, label }) => document.getElementById(id).shadowRoot
          .querySelector('[part="command-palette"]').commands.some(row => row.commandId === key && row.label === label), { id, key, label });
        await palette(id).getByRole('searchbox').fill(label); await page.keyboard.press('Enter');
        await palette(id).getByRole('dialog').waitFor({ state: 'hidden' });
        assert.equal(await host(id).locator('[part="document-panel-heading"]').textContent(), label);
        assert.deepEqual(await host(id).evaluate(element => element.snapshot().revision), before);
        if (key === 'review') {
          await host(id).locator('[part="review-author"]').getByRole('textbox').fill('Reviewer');
          await host(id).locator('[part="review-text"]').getByRole('textbox').fill('Saved original selection');
          await host(id).evaluate(async element => { await element.updateComplete; });
          assert.equal(await host(id).locator('[part="review-submit"]').getByRole('button').isEnabled(), true);
          await host(id).locator('[part="review-submit"]').getByRole('button').click();
          await host(id).locator('[part="review-item-text"]').filter({ hasText: 'Saved original selection' }).waitFor();
          assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), before.value + 1);
        }
        await host(id).locator('[part="document-panel-close"]').getByRole('button').click();
      }
      assert.equal(wordText(zipEntry(await saveEditor(page, id), 'word/document.xml')), 'Panel navigation');
    } finally { await remove(id); }
  });

  await check('numbered search excerpts select current matches and replacement advances using fresh results', async () => {
    const id = 'search-excerpts';
    await createEditor(page, id);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.insertText('First needle, second needle, final needle.');
    await page.keyboard.press('ControlOrMeta+F');
    await host(id).locator('[part="find-query"]').getByRole('searchbox').fill('needle');
    await host(id).locator('[part="find-submit"]').click();
    assert.equal(await host(id).locator('[part="find-match"]').count(), 3);
    await assertNoAxeViolations(page, id);
    assert.ok((await host(id).locator('[part="find-match"]').nth(1).textContent()).includes('second'));
    await host(id).locator('[part="find-match"]').nth(1).click();
    assert.equal(await host(id).locator('[part="find-current"]').textContent(), 'Match 2 of 3');
    await host(id).locator('[part="find-replace"]').getByRole('textbox').fill('thread');
    await host(id).locator('[part="find-replace-button"]').click();
    assert.equal(await host(id).locator('[part="find-match"]').count(), 2);
    assert.equal(await host(id).locator('[part="find-current"]').textContent(), 'Match 2 of 2');
    await host(id).locator('[part="find-replace-button"]').click();
    assert.equal(await host(id).locator('[part="find-match"]').count(), 1);
    assert.equal(wordText(zipEntry(await saveEditor(page, id), 'word/document.xml')), 'First needle, second thread, final thread.');
    await host(id).evaluate(element => { element.style.inlineSize = '320px'; element.setAttribute('dir', 'rtl');
      element.strings = { docxEditorFindCurrent: 'Current {current} / {count}', docxEditorCommands: 'Find editor commands' }; });
    await paints(page);
    assert.equal(await host(id).locator('[part="find-current"]').textContent(), 'Current 1 / 1');
    assert.equal(await host(id).locator('[part="commands-button"]').getAttribute('aria-label'), 'Find editor commands');
    const layout = await host(id).locator('[part="find-results"]').evaluate(element => {
      const button = element.querySelector('button'); const rect = button.getBoundingClientRect();
      return { scroll: element.scrollWidth, width: element.clientWidth, buttonWidth: rect.width, buttonHeight: rect.height,
        direction: getComputedStyle(element).direction };
    });
    assert.ok(layout.scroll <= layout.width + 1);
    assert.ok(layout.buttonWidth >= 24 && layout.buttonHeight >= 24);
    assert.equal(layout.direction, 'rtl');
    await remove(id);
  });

  await check('read-only commands explain editing refusals while search navigation remains available', async () => {
    const id = 'search-readonly';
    const source = [...await page.evaluate(() => window.__docxTest.fixture('basic-editing'))];
    assert.equal(await page.evaluate(async ({ id, source }) => {
      const editor = document.createElement('lr-docx-editor'); editor.id = id; editor.readOnly = true;
      document.querySelector('#fixture').append(editor); return (await editor.open(Uint8Array.from(source))).ok;
    }, { id, source }), true);
    await host(id).locator('.docx-pages').click();
    await page.keyboard.press('ControlOrMeta+K');
    await palette(id).getByRole('dialog').waitFor({ state: 'visible' });
    const rows = await palette(id).evaluate(element => ({
      bold: element.commands.find(row => row.commandId === 'bold'), find: element.commands.find(row => row.commandId === 'find') }));
    assert.equal(rows.bold.disabled, true); assert.ok(rows.bold.description.includes('read-only'));
    assert.equal(rows.find.disabled, false);
    await palette(id).getByRole('searchbox').fill('Find and replace'); await page.keyboard.press('Enter');
    await host(id).locator('[part="find-query"]').getByRole('searchbox').fill('Café');
    await host(id).locator('[part="find-submit"]').click();
    await host(id).locator('[part="find-match"]').first().click();
    assert.equal(await host(id).evaluate(element => element.snapshot().dirty), false);
    assert.equal(await host(id).locator('[part="find-replace-button"]').evaluate(element => element.disabled), true);
    await remove(id);
  });
  await check('replace and advance skips newly created and case-insensitive literal matches', async () => {
    for (const replacement of ['needle needle', 'NEEDLE']) {
      const id = 'search-created-matches'; await createEditor(page, id);
      try {
        await host(id).locator('.docx-pages').click(); await page.keyboard.insertText('needle, next needle');
        await page.keyboard.press('ControlOrMeta+F');
        await host(id).locator('[part="find-query"]').getByRole('searchbox').fill('needle');
        await host(id).locator('[part="find-submit"]').click(); await host(id).locator('[part="find-match"]').first().click();
        await host(id).locator('[part="find-replace"]').getByRole('textbox').fill(replacement);
        await host(id).locator('[part="find-replace-button"]').click();
        const current = await host(id).locator('[part="find-match"][aria-current="true"]').textContent();
        assert.ok(current.includes('next needle'), current);
        await host(id).locator('[part="find-replace"]').getByRole('textbox').fill('thread');
        await host(id).locator('[part="find-replace-button"]').click();
        assert.equal(wordText(zipEntry(await saveEditor(page, id), 'word/document.xml')), `${replacement}, next thread`);
      } finally { await remove(id); }
    }
  });

  await check('populated outline and body checks expose actual locations, scope, capability uncertainty and accessible panels', async () => {
    const id = 'panels-body'; const source = await createEditor(page, id, 'basic-editing');
    try {
      const entries = unzipSync(Uint8Array.from(source));
      entries['word/document.xml'] = strToU8(strFromU8(entries['word/document.xml'])
        .replace('<w:p><w:r><w:t>Corpus opening', '<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Corpus opening')
        .replace('</w:body>', '<w:p><w:pPr><w:pStyle w:val="MissingInspectionStyle"/></w:pPr><w:r><w:t>Unclassified heading</w:t></w:r></w:p></w:body>'));
      assert.equal((await host(id).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), [...zipSync(entries)])).ok, true);
      await host(id).getByRole('button', { name: 'Outline', exact: true }).click();
      assert.equal(await host(id).locator('[part="document-target"]').count(), 1);
      assert.equal((await host(id).locator('[part="document-target"]').textContent()).trim(), 'Level 1: Corpus opening');
      assert.equal(await host(id).locator('[part="document-target"]').getAttribute('aria-label'), null);
      const before = await host(id).evaluate(element => element.snapshot().revision);
      await host(id).locator('[part="document-target"]').click();
      assert.deepEqual(await host(id).evaluate(element => element.snapshot().revision), before);
      await assertNoAxeViolations(page, id);
      await host(id).getByRole('button', { name: 'Document checks', exact: true }).click();
      assert.ok((await host(id).locator('[part="inspection-scope"]').textContent()).includes('not an accessibility certification'));
      assert.ok((await host(id).locator('[part="inspection-capabilities"]').textContent()).includes('unverified'));
      assert.ok(await host(id).locator('[part="diagnostic-target"]').count());
      const diagnosticRows = await host(id).locator('[part="inspection-items"] li').allTextContents();
      assert.ok(diagnosticRows.some(text => text.includes('Some Body headings content could not be inspected.')), diagnosticRows.join(' | '));
      await host(id).locator('[part="diagnostic-target"]').first().click();
      assert.deepEqual(await host(id).evaluate(element => element.snapshot().revision), before);
      await assertNoAxeViolations(page, id);
      await host(id).locator('.docx-pages').getByText('Corpus opening', { exact: true }).click();
      await page.keyboard.insertText('Updated');
      await page.waitForFunction(({ id, revision }) => document.getElementById(id).snapshot().revision.value > revision,
        { id, revision: before.value });
      await host(id).evaluate(async element => { await element.updateComplete; });
      assert.equal(await host(id).locator('[part="diagnostic-target"]').count(), 0);
      await host(id).locator('[part="document-panel-refresh"]').click();
      assert.ok(await host(id).locator('[part="diagnostic-target"]').count());
    } finally { await remove(id); }
  });

  await check('document utility controls keep localized names and deferred panel focus respects an outside claim', async () => {
    const id = 'panel-focus'; await createEditor(page, id);
    try {
      assert.equal(await host(id).locator('[part="image-replace-trigger"]').getByRole('button').isEnabled(), false);
      await host(id).evaluate(async element => { element.strings = { docxEditorCommands: 'Command menu', docxEditorOutline: 'Document map',
        docxEditorChecks: 'Body checks', docxEditorReview: 'Document review', docxEditorReplaceImage: 'Change picture' }; await element.updateComplete; });
      for (const [key, label] of [['commands', 'Command menu'], ['outline', 'Document map'], ['checks', 'Body checks'],
        ['review', 'Document review'], ['image-replace', 'Change picture']]) {
        assert.equal(await host(id).locator(`#tool-${key}`).getByRole('button', { name: label, exact: true }).count(), 1);
        assert.equal(await host(id).locator(`lr-tooltip[for="tool-${key}"]`).getAttribute('content'), label);
      }
      const focus = await host(id).evaluate(async element => {
        const outside = document.createElement('input'); outside.id = 'outside-panel-focus';
        outside.setAttribute('aria-label', 'Outside document field'); document.querySelector('#fixture').append(outside);
        element.shadowRoot.querySelector('#tool-outline').click(); outside.focus();
        await element.updateComplete;
        return { outsideFocused: document.activeElement === outside, panel: element.shadowRoot.querySelector('[part="document-panel-heading"]')?.textContent };
      });
      assert.deepEqual(focus, { outsideFocused: true, panel: 'Document map' });
      await paints(page);
      assert.equal(await page.locator('#outside-panel-focus').evaluate(element => document.activeElement === element), true);
      await host(id).locator('[part="document-panel-close"]').getByRole('button').click();
      await host(id).evaluate(element => { element.strings = {}; });
      await host(id).getByRole('button', { name: 'Outline', exact: true }).click();
      assert.equal(await host(id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'document-panel-heading');
    } finally { await page.locator('#outside-panel-focus').evaluate(element => element.remove()).catch(() => undefined); await remove(id); }
  });

  await check('Review retains original selection for comments and renders real tracking state without dirtying mode changes', async () => {
    const id = 'panel-review'; await createEditor(page, id);
    try {
      await host(id).locator('.docx-pages').click();
      await host(id).getByRole('button', { name: 'Review', exact: true }).click();
      assert.equal(await host(id).locator('[part="review-submit"]').getByRole('button').isEnabled(), false);
      assert.ok((await host(id).locator('[part="document-panel"]').textContent()).includes('Select document text before opening Review'));
      await host(id).evaluate(async element => { element.strings = { docxEditorReviewSelectText: 'Choose document words first.' }; await element.updateComplete; });
      assert.ok((await host(id).locator('[part="document-panel"]').textContent()).includes('Choose document words first.'));
      await host(id).evaluate(element => { element.strings = {}; });
      await host(id).locator('[part="document-panel-close"]').getByRole('button').click();
      await host(id).locator('.docx-pages').click(); await page.keyboard.insertText('Original discussion'); await paints(page); await page.keyboard.press('ControlOrMeta+A');
      await page.waitForFunction(id => document.getElementById(id).snapshot().selection.kind === 'text', id);
      await host(id).getByRole('button', { name: 'Review', exact: true }).click();
      await host(id).locator('[part="review-author"]').getByRole('textbox').fill('Reviewer');
      await host(id).locator('[part="review-text"]').getByRole('textbox').fill('Please clarify.');
      const commentRevision = await host(id).evaluate(element => element.snapshot().revision.value);
      await host(id).locator('[part="review-submit"]').getByRole('button').click();
      const commentResult = await host(id).evaluate(async element => { await element.updateComplete;
        return { revision: element.snapshot().revision.value, refusal: element.shadowRoot.querySelector('[part="edit-error"]')?.textContent ?? null }; });
      assert.deepEqual(commentResult, { revision: commentRevision + 1, refusal: null });
      assert.equal(await host(id).locator('[part="review-item-text"]').textContent(), 'Please clarify.');
      await assertNoAxeViolations(page, id);
      await host(id).locator('[part="review-reply"]').getByRole('button').click();
      await host(id).locator('[part="review-text"]').getByRole('textbox').fill('Cancelled reply');
      await host(id).locator('[part="review-reply-cancel"]').getByRole('button').click();
      assert.equal(await host(id).locator('[part="review-reply-cancel"]').count(), 0);
      assert.equal(await host(id).locator('[part="review-submit"]').getByRole('button').isEnabled(), false);
      assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), commentRevision + 1);
      await host(id).locator('[part="review-reply"]').getByRole('button').click();
      await host(id).locator('[part="review-text"]').getByRole('textbox').fill('A reply.');
      await host(id).locator('[part="review-submit"]').getByRole('button').click();
      assert.equal(await host(id).locator('[part="review-item-text"]').count(), 2);
      assert.equal(wordText(zipEntry(await saveEditor(page, id), 'word/document.xml')), 'Original discussion');
      const before = await host(id).evaluate(element => element.snapshot().revision.value);
      await host(id).locator('[part="review-track"]').getByRole('button').click();
      assert.equal((await host(id).locator('[part="review-track"]').textContent()).trim(), 'Stop tracking changes');
      assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), before);
      await host(id).locator('[part="review-track"]').getByRole('button').click();
      assert.equal((await host(id).locator('[part="review-track"]').textContent()).trim(), 'Start tracking changes');
      await host(id).evaluate(element => { element.style.inlineSize = '320px'; element.setAttribute('dir', 'rtl'); });
      await assertNoAxeViolations(page, id);
      const rootComment = host(id).locator('[part="review-items"] > li').first();
      await rootComment.getByRole('button', { name: 'Resolve', exact: true }).click();
      await rootComment.getByRole('button', { name: 'Reopen', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await rootComment.getByRole('button', { name: 'Resolve', exact: true }).count(), 0);
      await rootComment.getByRole('button', { name: 'Reopen', exact: true }).click();
      await rootComment.getByRole('button', { name: 'Resolve', exact: true }).waitFor({ state: 'visible' });
      assert.equal(await rootComment.getByRole('button', { name: 'Reopen', exact: true }).count(), 0);
      const navigateRevision = await host(id).evaluate(element => element.snapshot().revision.value);
      await rootComment.locator('[part="review-target"]').getByRole('button').click();
      assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), navigateRevision);
      await rootComment.getByRole('button', { name: 'Delete comment', exact: true }).click();
      assert.equal(await host(id).locator('[part="review-item-text"]').count(), 0);
      assert.equal(wordText(zipEntry(await saveEditor(page, id), 'word/document.xml')), 'Original discussion');
    } finally { await remove(id); }
  });

  await check('table formatting dialog keeps its original cell and exposes accessible bounded requested values', async () => {
    const id = 'panel-table'; await createEditor(page, id, 'table-simple');
    try {
      await host(id).locator('.docx-pages').getByText('A11', { exact: true }).click(); await page.keyboard.press('ArrowLeft');
      await host(id).locator('[part="table-format-trigger"]').getByRole('button').click();
      await host(id).locator('[part="table-format-fields"]').waitFor({ state: 'visible' });
      await assertNoAxeViolations(page, id);
      await host(id).locator('[part="table-shading"]').getByRole('textbox').focus();
      const composing = await host(id).locator('[part="table-shading"]').getByRole('textbox').evaluate(input => {
        const event = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, composed: true, cancelable: true });
        input.dispatchEvent(event); return event.defaultPrevented;
      });
      assert.equal(composing, false);
      assert.equal(await host(id).locator('[part="table-format-popover"]').evaluate(element => element.open), true);
      await page.keyboard.press('Escape');
      await host(id).locator('[part="table-format-fields"]').waitFor({ state: 'hidden' });
      assert.equal(await host(id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'table-format-trigger');
      await host(id).locator('[part="table-format-trigger"]').getByRole('button').click();
      await host(id).locator('[part="table-shading"]').getByRole('textbox').fill('#ABCDEF');
      await host(id).locator('[part="table-shading-apply"]').getByRole('button').click();
      const xml = zipEntry(await saveEditor(page, id), 'word/document.xml');
      assert.equal((xml.match(/w:fill="ABCDEF"/gu) ?? []).length, 1);
      await host(id).locator('.docx-pages').getByText('A11', { exact: true }).click(); await page.keyboard.press('ArrowLeft');
      await host(id).locator('[part="table-format-trigger"]').getByRole('button').click();
      await host(id).locator('[part="table-header-on"]').getByRole('button').click();
      assert.match(zipEntry(await saveEditor(page, id), 'word/document.xml'), /w:tblHeader/);
    } finally { await remove(id); }
  });

  await check('Replace image picker preserves original dimensions and metadata as one undoable edit', async () => {
    const id = 'panel-replacement'; await createEditor(page, id, 'image-simple');
    try {
      await host(id).locator('.docx-pages img').first().click();
      const before = await host(id).evaluate(element => ({ revision: element.snapshot().revision.value, image: element.snapshot().image, description: element.imageDescription() }));
      const bytes = [...await page.evaluate(() => window.__docxTest.imageBytes('jpeg'))];
      const chosen = page.waitForEvent('filechooser'); await host(id).locator('[part="image-replace-trigger"]').getByRole('button').click();
      await (await chosen).setFiles({ name: 'replacement.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) });
      await host(id).locator('[part="image-replace-status"]').filter({ hasText: 'Image replaced' }).waitFor();
      const after = await host(id).evaluate(element => ({ revision: element.snapshot().revision.value, image: element.snapshot().image, description: element.imageDescription() }));
      assert.equal(after.revision, before.revision + 1); assert.deepEqual(after.image, before.image); assert.deepEqual(after.description, before.description);
      assert.equal((await host(id).evaluate(element => element.execute('undo'))).ok, true);
      assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), after.revision + 1);
    } finally { await remove(id); }
  });

  await check('replacement picker cancellation and invalid files preserve the image and allow another attempt', async () => {
    const id = 'replacement-refusals'; await createEditor(page, id, 'image-simple');
    try {
      await host(id).locator('.docx-pages img').first().click();
      await page.waitForFunction(id => Boolean(document.getElementById(id).snapshot().image), id);
      await host(id).evaluate(async element => { element.strings = {
        docxEditorImageInsertLimit: 'Replacement exceeds limits.', docxEditorImageInsertInvalid: 'Replacement cannot be read.',
        docxEditorImageInsertUnsupported: 'Replacement cannot be read.' }; await element.updateComplete; });
      const before = await host(id).evaluate(element => ({ revision: element.snapshot().revision, image: element.snapshot().image,
        description: element.imageDescription() }));
      const choose = async () => {
        const pending = page.waitForEvent('filechooser');
        await host(id).locator('[part="image-replace-trigger"]').getByRole('button').click(); return pending;
      };
      await choose();
      await host(id).locator('[part="image-replace-file"]').evaluate(input => input.dispatchEvent(new Event('cancel')));
      await host(id).locator('[part="image-replace-status"]').waitFor({ state: 'detached' });
      assert.equal(await host(id).locator('[part="image-replace-trigger"]').getByRole('button').isEnabled(), true);
      for (const [buffer, feedback] of [[Buffer.alloc(0), 'Replacement exceeds limits.'],
        [Buffer.from('This is not an image'), 'Replacement cannot be read.']]) {
        await (await choose()).setFiles({ name: 'invalid.png', mimeType: 'image/png', buffer });
        await host(id).locator('[part="image-replace-status"]').filter({ hasText: feedback }).waitFor();
        assert.deepEqual(await host(id).evaluate(element => ({ revision: element.snapshot().revision, image: element.snapshot().image,
          description: element.imageDescription() })), before);
        assert.equal(await host(id).locator('[part="image-replace-trigger"]').getByRole('button').isEnabled(), true);
      }
      const bytes = [...await page.evaluate(() => window.__docxTest.imageBytes('jpeg'))];
      await (await choose()).setFiles({ name: 'valid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) });
      await host(id).locator('[part="image-replace-status"]').filter({ hasText: 'Image replaced' }).waitFor();
      assert.equal(await host(id).locator('[part="edit-error"]').count(), 0);
      assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), before.revision.value + 1);
      assert.deepEqual(await host(id).evaluate(element => element.snapshot().image), before.image);
    } finally { await remove(id); }
  });

  await check('table formatting draft controls cancel without editing and apply chosen border values', async () => {
    const id = 'table-format-drafts'; await createEditor(page, id, 'table-simple');
    try {
      await host(id).locator('.docx-pages').getByText('A11', { exact: true }).click(); await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(id => Boolean(document.getElementById(id).snapshot().table), id);
      const before = await host(id).evaluate(element => element.snapshot().revision);
      await host(id).locator('[part="table-format-trigger"]').getByRole('button').click();
      await host(id).locator('[part="table-format-fields"]').waitFor({ state: 'visible' });
      for (const [part, value] of [['table-vertical', 'center'], ['table-border-target', 'outside'], ['table-border-style', 'dashed']]) {
        const select = host(id).locator(`[part="${part}"]`);
        await select.getByRole('combobox').click(); await select.locator(`[part="option"][data-value="${value}"]`).click();
        assert.equal(await select.evaluate(element => element.value), value);
      }
      await host(id).locator('[part="table-border-color"]').getByRole('textbox').fill('#123456');
      await page.keyboard.press('Escape');
      await host(id).locator('[part="table-format-fields"]').waitFor({ state: 'hidden' });
      assert.deepEqual(await host(id).evaluate(element => element.snapshot().revision), before);
      await host(id).locator('[part="table-format-trigger"]').getByRole('button').click();
      await host(id).locator('[part="table-border-apply"]').getByRole('button').click();
      const xml = zipEntry(await saveEditor(page, id), 'word/document.xml');
      assert.match(xml, /<w:tcBorders>/);
      assert.match(xml, /w:val="dashed"[^>]*w:color="123456"|w:color="123456"[^>]*w:val="dashed"/);
      assert.equal(await host(id).evaluate(element => element.snapshot().revision.value), before.value + 1);
    } finally { await remove(id); }
  });
}
