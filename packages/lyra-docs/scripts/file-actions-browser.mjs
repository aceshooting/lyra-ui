import assert from 'node:assert/strict';
import { openFileChooser } from './lib/harness.mjs';

export async function runFileActions(page, check, { createEditor }) {
  const id = 'file-actions-editor';
  const editor = page.locator(`#${id}`);

  await check('file action lists select toolbar buttons and tooltips while preserving the native picker', async () => {
    await createEditor(page, id);
    try {
      const states = await editor.evaluate(async element => {
        const root = element.shadowRoot;
        const snapshot = () => ({
          buttons: [...root.querySelectorAll('[part="file-actions"] lr-button')].map(button => button.id),
          tips: [...root.querySelectorAll('lr-tooltip')].map(tip => tip.getAttribute('for'))
            .filter(name => ['tool-new', 'tool-open', 'tool-save'].includes(name)),
          group: Boolean(root.querySelector('[part="file-actions"]')),
          picker: root.querySelectorAll('input[part="file-input"][type="file"]').length,
        });
        const states = [snapshot()];
        element.setAttribute('file-actions', 'save\topen open\nunknown');
        await element.updateComplete;
        states.push(snapshot());
        element.fileActions = '';
        await element.updateComplete;
        states.push(snapshot());
        element.removeAttribute('file-actions');
        await element.updateComplete;
        return [...states, snapshot(), element.fileActions];
      });
      const all = ['tool-new', 'tool-open', 'tool-save'];
      const expected = buttons => ({ buttons, tips: buttons, group: buttons.length > 0, picker: 1 });
      assert.deepEqual(states, [expected(all), expected(['tool-open', 'tool-save']), expected([]), expected(all), 'new open save']);
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('canceled toolbar requests preserve clean and dirty documents and leave the picker closed', async () => {
    await createEditor(page, id);
    try {
      for (const dirty of [false, true]) {
        if (dirty) {
          await editor.locator('.docx-pages').click();
          await page.keyboard.insertText('Keep my draft');
          await page.waitForFunction(id => document.getElementById(id).snapshot()?.dirty, id);
        }
        const outcome = await editor.evaluate(async element => {
          const revision = element.snapshot().revision;
          const root = element.shadowRoot;
          const events = [];
          let picker = 0, beforeOpen = 0;
          const onPick = event => { event.preventDefault(); picker++; };
          const onBefore = () => beforeOpen++;
          const onRequest = event => {
            events.push([event.type, event.detail, event.bubbles, event.composed, event.cancelable]);
            event.preventDefault();
          };
          root.querySelector('[part="file-input"]').addEventListener('click', onPick);
          element.addEventListener('lr-before-open', onBefore);
          const parent = element.parentElement;
          for (const type of ['lr-new-request', 'lr-open-request']) parent.addEventListener(type, onRequest);
          try {
            for (const name of ['new', 'open']) root.querySelector(`#tool-${name}`).click();
            await element.updateComplete;
            return { revision, current: element.snapshot()?.revision, dirty: element.snapshot()?.dirty,
              events, picker, beforeOpen, confirm: Boolean(root.querySelector('[part="confirm"]')) };
          } finally {
            for (const type of ['lr-new-request', 'lr-open-request']) parent.removeEventListener(type, onRequest);
            element.removeEventListener('lr-before-open', onBefore);
            root.querySelector('[part="file-input"]').removeEventListener('click', onPick);
          }
        });
        assert.deepEqual(outcome.events, ['lr-new-request', 'lr-open-request'].map(type =>
          [type, { source: 'toolbar', currentRevision: outcome.revision }, true, true, true]));
        assert.deepEqual(outcome.current, outcome.revision);
        assert.deepEqual([outcome.dirty, outcome.picker, outcome.beforeOpen, outcome.confirm], [dirty, 0, 0, false]);
      }
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('an uncanceled request confirms once and preserves the independent dirty-document veto', async () => {
    await createEditor(page, id);
    try {
      await editor.locator('.docx-pages').click();
      await page.keyboard.insertText('Retain until approved');
      await page.waitForFunction(id => document.getElementById(id).snapshot()?.dirty, id);
      const result = await editor.evaluate(async element => {
        const root = element.shadowRoot;
        const events = [];
        const initial = element.snapshot().revision;
        element.addEventListener('lr-new-request', () => events.push('new'));
        element.addEventListener('lr-before-open', event => { events.push('before'); event.preventDefault(); });
        root.querySelector('#tool-new').click();
        await element.updateComplete;
        const prompt = root.querySelector('[part="discard-button"]');
        const promptedEvents = [...events];
        prompt?.click();
        await element.updateComplete;
        const programmatic = await element.newDocument();
        return { prompted: Boolean(prompt), promptedEvents, events, programmatic, initial,
          revision: element.snapshot()?.revision };
      });
      assert.equal(result.prompted, true);
      assert.deepEqual(result.promptedEvents, ['new']);
      assert.deepEqual(result.events, ['new', 'before', 'before']);
      assert.deepEqual(result.programmatic, { ok: false, code: 'aborted' });
      assert.deepEqual(result.revision, result.initial);
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('a host opening template bytes from a New request owns the resulting document', async () => {
    await createEditor(page, id);
    try {
      const result = await editor.evaluate(async element => {
        const root = element.shadowRoot;
        const bytes = Uint8Array.from(await window.__docxTest.fixture('basic-editing'));
        const requests = [];
        let opening;
        element.addEventListener('lr-open-request', event => { requests.push('open'); event.preventDefault(); });
        element.addEventListener('lr-new-request', () => {
          requests.push('new');
          root.querySelector('#tool-open').click();
          opening = element.open(bytes, { name: 'Template.docx' });
        });
        root.querySelector('#tool-new').click();
        const opened = await opening;
        await element.updateComplete;
        return { requests, opened: opened?.ok, filename: root.querySelector('[part="filename"]').textContent,
          containsText: element.querySelector('.docx-pages')?.textContent.includes('Café 東京') };
      });
      assert.deepEqual(result, { requests: ['new'], opened: true, filename: 'Template.docx', containsText: true });
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('a save started by a file-request listener keeps ownership of its document', async () => {
    await createEditor(page, id);
    try {
      const outcome = await editor.evaluate(async element => {
        const initial = element.snapshot().revision;
        let saving, activityAtRequest;
        element.addEventListener('lr-new-request', () => {
          saving = element.save();
          activityAtRequest = element.snapshot().activity;
        }, { once: true });
        element.shadowRoot.querySelector('#tool-new').click();
        const saved = await saving;
        return { initial, current: element.snapshot()?.revision, activityAtRequest,
          saved: saved?.ok, savedRevision: saved?.value?.revision };
      });
      assert.deepEqual(outcome, { initial: outcome.initial, current: outcome.initial,
        activityAtRequest: 'saving', saved: true, savedRevision: outcome.initial });
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('a host can intercept palette Open when the toolbar file group is empty', async () => {
    await createEditor(page, id);
    try {
      await editor.evaluate(async element => {
        element.fileActions = '';
        await element.updateComplete;
        element.addEventListener('lr-open-request', event => {
          event.preventDefault();
          element.dataset.requestSource = event.detail.source;
          element.dataset.paletteOpenAtRequest = String(element.shadowRoot.querySelector('[part="command-palette"]').open);
        }, { once: true });
      });
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+K');
      const palette = editor.locator('[part="command-palette"]');
      await palette.getByRole('dialog').waitFor({ state: 'visible' });
      await palette.getByRole('combobox', { name: 'Search commands', exact: true }).fill('Open');
      await page.keyboard.press('Enter');
      await page.waitForFunction(id => Boolean(document.getElementById(id).dataset.requestSource), id);
      assert.equal(await editor.getAttribute('data-request-source'), 'command-palette');
      assert.equal(await editor.getAttribute('data-palette-open-at-request'), 'true',
        'A host receives the request during command activation, before the palette starts closing');
      await palette.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(await editor.locator('[part="file-actions"]').count(), 0);
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('an accepted palette Open activates the real picker once with toolbar file actions hidden', async () => {
    await createEditor(page, id);
    try {
      await editor.evaluate(async element => {
        element.fileActions = '';
        await element.updateComplete;
        element.dataset.openRequests = '0';
        element.addEventListener('lr-open-request', () => {
          element.dataset.openRequests = String(Number(element.dataset.openRequests) + 1);
        });
      });
      const bytes = await page.evaluate(() => window.__docxTest.fixture('basic-editing'));
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+K');
      const palette = editor.locator('[part="command-palette"]');
      await palette.getByRole('dialog').waitFor({ state: 'visible' });
      await palette.getByRole('combobox').fill('Open');
      const chooser = await openFileChooser(page, editor.locator('[part="file-input"]'), () => page.keyboard.press('Enter'));
      await chooser.setFiles({ name: 'Palette.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
      await page.waitForFunction(id => document.getElementById(id).shadowRoot.querySelector('[part="filename"]').textContent === 'Palette.docx', id);
      assert.equal(await editor.getAttribute('data-open-requests'), '1');
      assert.equal(await editor.locator('[part="file-actions"]').count(), 0);
      assert.ok((await editor.locator('.docx-pages').textContent()).includes('Café 東京'));
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('palette Open stays available when the selection settles after the palette opens', async () => {
    await createEditor(page, id);
    try {
      await editor.evaluate(async element => { element.fileActions = ''; await element.updateComplete; });
      await editor.locator('.docx-pages').click();
      await page.keyboard.press('ControlOrMeta+K');
      const palette = editor.locator('[part="command-palette"]');
      await palette.getByRole('dialog').waitFor({ state: 'visible' });
      await palette.getByRole('combobox').fill('Open');
      // A caret that lands late from the preceding click bumps the selection version mid-palette.
      await editor.evaluate(async element => {
        element.session.selectionVersion++;
        element.session.publish();
        await element.updateComplete;
      });
      assert.equal(await editor.evaluate(element => element.shadowRoot.querySelector('[part="command-palette"]')
        .commands.find(command => command.commandId === 'open').disabled), false);
      const chooser = await openFileChooser(page, editor.locator('[part="file-input"]'), () => page.keyboard.press('Enter'));
      const bytes = await page.evaluate(() => window.__docxTest.fixture('basic-editing'));
      await chooser.setFiles({ name: 'Settled.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
      await page.waitForFunction(id => document.getElementById(id).shadowRoot.querySelector('[part="filename"]').textContent === 'Settled.docx', id);
    } finally { await editor.evaluate(element => element.remove()); }
  });

  await check('palette Open on a dirty document waits for confirmation before opening the native picker', async () => {
    await createEditor(page, id);
    try {
      await editor.locator('.docx-pages').click();
      await page.keyboard.insertText('Discard only after confirming');
      await page.waitForFunction(id => document.getElementById(id).snapshot()?.dirty, id);
      const revision = await editor.evaluate(element => {
        const root = element.shadowRoot;
        const events = [];
        const record = entry => {
          events.push(entry);
          element.dataset.fileActionTrace = JSON.stringify(events);
        };
        element.addEventListener('lr-open-request', event => record({
          event: 'request', detail: event.detail,
          paletteOpen: root.querySelector('[part="command-palette"]').open,
        }));
        root.querySelector('[part="file-input"]').addEventListener('click', () => record({ event: 'picker' }));
        element.addEventListener('lr-before-open', event => record({ event: 'before-open', detail: event.detail }));
        return element.snapshot().revision;
      });
      const request = { event: 'request', detail: { source: 'command-palette', currentRevision: revision }, paletteOpen: true };
      const trace = () => editor.evaluate(element => JSON.parse(element.dataset.fileActionTrace));
      const palette = editor.locator('[part="command-palette"]');
      const confirm = editor.locator('[part="discard-button"]');
      await page.keyboard.press('ControlOrMeta+K');
      await palette.getByRole('dialog').waitFor({ state: 'visible' });
      await palette.getByRole('combobox').fill('Open');
      let prematurePicker = false;
      const onPicker = () => { prematurePicker = true; };
      page.on('filechooser', onPicker);
      try {
        await page.keyboard.press('Enter');
        await palette.getByRole('dialog').waitFor({ state: 'hidden' });
        await confirm.waitFor({ state: 'visible' });
        assert.equal(prematurePicker, false);
        assert.deepEqual(await trace(), [request]);
        assert.deepEqual(await editor.evaluate(element => element.snapshot().revision), revision);
        assert.match(await editor.locator('.docx-pages').textContent(), /Discard only after confirming/u);
      } finally { page.off('filechooser', onPicker); }

      const bytes = await page.evaluate(() => window.__docxTest.fixture('basic-editing'));
      const chooser = await openFileChooser(page, editor.locator('[part="file-input"]'), () => confirm.click());
      await chooser.setFiles({ name: 'Confirmed palette.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
      await page.waitForFunction(id => document.getElementById(id).shadowRoot.querySelector('[part="filename"]').textContent === 'Confirmed palette.docx', id);
      assert.deepEqual(await trace(), [request, { event: 'picker' },
        { event: 'before-open', detail: { kind: 'docx', currentRevision: revision } }]);
      assert.notEqual(await editor.evaluate(element => element.snapshot().revision.documentId), revision.documentId);
      const content = await editor.locator('.docx-pages').textContent();
      assert.match(content, /Café 東京/u);
      assert.doesNotMatch(content, /Discard only after confirming/u);
    } finally { await editor.evaluate(element => element.remove()); }
  });
}
