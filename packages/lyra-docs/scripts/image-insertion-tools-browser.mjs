import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const host = (page, id) => page.locator(`#${id}`);
const part = (page, id, name) => page.locator(`#${id} [part="image-insert-${name}"]`);
const parts = bytes => Object.fromEntries(Object.entries(unzipSync(Uint8Array.from(bytes)))
  .sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, [...value]]));
const paints = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
const dispose = (page, id) => host(page, id).evaluate(element => element.remove());
async function snapshot(page, id) {
  return host(page, id).evaluate(element => element.snapshot());
}
async function source(page, kind = 'png') {
  return Buffer.from(await page.evaluate(async kind => [...await window.__docxTest.imageBytes(kind)], kind));
}
async function createPlain(page, id, createEditor) {
  await createEditor(page, id);
  await page.locator(`#${id} .docx-pages`).click();
  await page.keyboard.type('alpha'); await page.keyboard.press('Enter');
  await page.keyboard.type('beta'); await page.keyboard.press('Enter'); await page.keyboard.type('gamma');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await paints(page);
  await page.waitForFunction(id => document.getElementById(id).canInsertImage().enabled, id);
}
async function caret(page, id, text, uncovered = false) {
  const target = page.locator(`#${id} .docx-pages`).getByText(text, { exact: true });
  if (uncovered) {
    const pages = page.locator(`#${id} .docx-pages`), box = await target.boundingBox(), pageBox = await pages.boundingBox();
    assert.ok(box && pageBox);
    const point = { x: pageBox.x + pageBox.width - 16, y: box.y + box.height / 2 };
    assert.equal(await pages.evaluate((element, point) =>
      element.contains(element.ownerDocument.elementFromPoint(point.x, point.y)), point), true);
    await page.mouse.click(point.x, point.y);
  } else await target.click();
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await paints(page);
  assert.deepEqual(await page.evaluate(() => {
    const selection = document.getSelection();
    return { text: selection?.anchorNode?.textContent, offset: selection?.anchorOffset, collapsed: selection?.isCollapsed };
  }), { text, offset: 1, collapsed: true });
}

async function choose(page, id, bytes, keyboard = false, name = 'local-image.bin', mimeType = 'application/octet-stream') {
  const chooser = page.waitForEvent('filechooser'); void chooser.catch(() => {});
  if (keyboard) {
    await page.keyboard.press('Alt+F10'); await page.keyboard.press('Home');
    const forward = await host(page, id).evaluate(element => element.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight');
    for (let count = 0; count < 80; count++) {
      if (await host(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')) === 'image-insert-trigger') break;
      await page.keyboard.press(forward);
    }
    assert.equal(await host(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-insert-trigger');
    await page.keyboard.press('Enter');
  } else await part(page, id, 'trigger').click();
  await (await chooser).setFiles({ name, mimeType, buffer: bytes });
}
async function draft(page, id, bytes, keyboard = false) {
  const shown = part(page, id, 'dialog').evaluate(element => new Promise(resolve => {
    element.addEventListener('lr-after-show', () => resolve(true), { once: true });
  }));
  void shown.catch(() => {});
  await choose(page, id, bytes, keyboard);
  await part(page, id, 'width').waitFor({ state: 'visible' }); await shown;
  await page.waitForFunction(id => document.getElementById(id).shadowRoot.activeElement?.getAttribute('part') === 'image-insert-width', id);
}
async function cancel(page, id) {
  await part(page, id, 'cancel').click(); await part(page, id, 'fields').waitFor({ state: 'hidden' });
}
async function screenshot(page, name) {
  const directory = process.env.DOCX_IMAGE_INSERTION_UI_SCREENSHOTS;
  if (!directory) return;
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: join(directory, `${page.context().browser().browserType().name()}-${name}.png`) });
}
async function unchanged(page, id, before, initial, saveEditor) {
  const after = await snapshot(page, id);
  assert.deepEqual(after.revision, initial.revision); assert.equal(after.dirty, initial.dirty);
  assert.deepEqual(after.commands.undo, initial.commands.undo); assert.deepEqual(after.commands.redo, initial.commands.redo);
  assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
}

export async function runImageInsertionTools(page, check, { createEditor, saveEditor }) {
  // Isolate completed fixtures so genuine toolbar and Tab traversal target this editor.
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  for (const kind of ['png', 'jpeg', 'gif']) {
    await check(`local ${kind} picker inserts at the original typed caret as one undo unit and reopens`, async () => {
      const id = `insert-ui-${kind}`; await createPlain(page, id, createEditor);
      const before = await saveEditor(page, id), initial = await snapshot(page, id);
      const bytes = await source(page, kind); await draft(page, id, bytes, true);
      assert.equal(await part(page, id, 'ratio').evaluate(element => element.checked), true);
      assert.equal(await part(page, id, 'title').locator('input').inputValue(), '');
      assert.equal(await part(page, id, 'description').locator('textarea').inputValue(), '');
      await part(page, id, 'title').locator('input').fill('Local diagram');
      await part(page, id, 'description').locator('textarea').fill('First line\nSecond line');
      const dimensions = [Number(await part(page, id, 'width').locator('input').inputValue()), Number(await part(page, id, 'height').locator('input').inputValue())];
      await part(page, id, 'apply').click(); await part(page, id, 'fields').waitFor({ state: 'hidden' });
      await page.waitForFunction(({ id, revision }) => document.getElementById(id).snapshot().revision.value === revision + 1 &&
        document.getElementById(id).snapshot().activity === null, { id, revision: initial.revision.value });
      await page.locator(`#${id} .docx-pages img`).waitFor({ state: 'visible' });
      assert.equal(await page.locator(`#${id} .docx-pages img`).count(), 1);
      const saved = await saveEditor(page, id), xml = new TextDecoder().decode(Uint8Array.from(parts(saved)['word/document.xml']));
      const position = await page.evaluate(({ before, after }) => {
        const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const read = xml => {
          const document = new DOMParser().parseFromString(xml, 'application/xml');
          return [...document.getElementsByTagNameNS(namespace, 'p')].map(paragraph => {
            const tokens = [...paragraph.getElementsByTagName('*')].filter(node => node.namespaceURI === namespace &&
              (node.localName === 't' || node.localName === 'drawing')).map(node => ({ type: node.localName, text: node.localName === 't' ? node.textContent : '' }));
            return { text: tokens.map(token => token.text).join(''), tokens };
          });
        };
        return { before: read(before), after: read(after) };
      }, { before: new TextDecoder().decode(Uint8Array.from(parts(before)['word/document.xml'])), after: xml });
      assert.deepEqual(position.after.map(paragraph => paragraph.text), position.before.map(paragraph => paragraph.text));
      const gammaIndex = position.before.findIndex(paragraph => paragraph.text === 'gamma');
      assert.ok(gammaIndex >= 0, JSON.stringify(position));
      const drawings = position.after.flatMap((paragraph, index) => paragraph.tokens.flatMap((token, tokenIndex) =>
        token.type === 'drawing' ? [{ paragraph: index, before: paragraph.tokens.slice(0, tokenIndex).map(token => token.text).join(''),
          after: paragraph.tokens.slice(tokenIndex + 1).map(token => token.text).join('') }] : []));
      assert.deepEqual(drawings, [{ paragraph: gammaIndex, before: 'g', after: 'amma' }]);
      assert.match(xml, /Local diagram/u); assert.match(xml, /First line/u); assert.match(xml, /Second line/u);
      assert.match(xml, new RegExp(`cx="${Math.round(dimensions[0] * 12700)}"`, 'u'));
      assert.match(xml, new RegExp(`cy="${Math.round(dimensions[1] * 12700)}"`, 'u'));
      for (const [name, value] of Object.entries(parts(before))) {
        if (name !== 'word/document.xml' && name !== 'word/_rels/document.xml.rels' && name !== '[Content_Types].xml')
          assert.deepEqual(parts(saved)[name], value, name);
      }
      assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      assert.equal((await host(page, id).evaluate(element => element.execute('redo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
      await dispose(page, id);
      assert.equal((await page.evaluate(async ({ id, bytes }) => {
        const element = document.createElement('lr-docx-editor'); element.id = id; document.querySelector('#fixture').append(element);
        return element.open(Uint8Array.from(bytes));
      }, { id, bytes: saved })).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(saved)); await dispose(page, id);
    });
  }
  await check('real UI insertion drops superseded frame notifications and old committed completion', async () => {
    for (const { replace, early } of [{ replace: false, early: false }, { replace: true, early: false }, { replace: true, early: true }]) {
      const id = `insert-ui-owner-${replace}-${early}`; await createPlain(page, id, createEditor);
      const initial = await snapshot(page, id); await draft(page, id, await source(page));
      await host(page, id).evaluate((element, { replace, early, revision }) => {
        const outside = document.createElement('input'); outside.id = 'insert-ui-owner-outside';
        outside.setAttribute('aria-label', 'Outside focus'); document.querySelector('#fixture').append(outside);
        const state = window.__insertionOwner = { committed: null, focusCalls: 0, ready: null, announcements: [], lateSelections: [], busyRefusal: null, element };
        const original = element.focusEditor;
        element.focusEditor = function (...args) { state.focusCalls++; return Reflect.apply(original, this, args); };
        element.strings = { ...element.strings, docxEditorImageInserted: 'Old insertion owner completed', docxEditorInsertingImage: 'Old insertion frame active' };
        state.observer = new MutationObserver(records => {
          for (const record of records) if (record.target instanceof Element && record.target.closest('[data-lr-live-region]'))
            state.announcements.push(record.target.textContent);
        });
        state.observer.observe(document.body, { childList: true, subtree: true });
        element.addEventListener('lr-selection-change', event => {
          if (state.committed && event.detail.selection !== element.snapshot()?.selection)
            state.lateSelections.push(event.detail.selection);
        });
        element.addEventListener('lr-change', event => {
          const next = event.detail.snapshot?.revision;
          if (!early && !state.busyRefusal && next?.documentId === revision.documentId && event.detail.snapshot.activity === 'inserting-image')
            state.busyRefusal = element.execute('undo');
          if (state.committed || next?.documentId !== revision.documentId ||
              (early ? event.detail.snapshot.activity !== 'inserting-image' : next.value !== revision.value + 1)) return;
          state.committed = next;
          if (replace) state.ready = element.newDocument();
          else element.remove();
        });
      }, { replace, early, revision: initial.revision });
      try {
        await part(page, id, 'apply').click(); await page.locator('#insert-ui-owner-outside').click();
        await page.waitForFunction(() => Boolean(window.__insertionOwner.committed));
        if (replace) {
          assert.equal((await page.evaluate(() => window.__insertionOwner.ready)).ok, true);
          const next = await snapshot(page, id);
          assert.notEqual(next.revision.documentId, initial.revision.documentId); assert.equal(next.revision.value, 0); assert.equal(next.dirty, true);
          assert.equal(await page.locator(`#${id} .docx-pages img`).count(), 0);
        }
        await paints(page);
        const completion = await page.evaluate(() => ({ revision: window.__insertionOwner.committed, focusCalls: window.__insertionOwner.focusCalls,
          announcements: window.__insertionOwner.announcements, lateSelections: window.__insertionOwner.lateSelections, busyRefusal: window.__insertionOwner.busyRefusal, active: document.activeElement.id }));
        assert.deepEqual(completion.revision, { documentId: initial.revision.documentId, value: initial.revision.value + (early ? 0 : 1) });
        assert.equal(completion.focusCalls, 0); assert.equal(completion.active, 'insert-ui-owner-outside');
        assert.equal(completion.announcements.some(text => text.includes('Old insertion owner completed')), false);
        if (early) assert.equal(completion.announcements.some(text => text.includes('Old insertion frame active')), false);
        else {
          assert.deepEqual(completion.busyRefusal, { ok: false, code: 'busy' });
          assert.equal(completion.announcements.some(text => text.includes('Old insertion frame active')), true);
        }
        assert.deepEqual(completion.lateSelections, []);
      } finally {
        await page.evaluate(() => { window.__insertionOwner.observer.disconnect(); window.__insertionOwner.element.remove();
          document.getElementById('insert-ui-owner-outside').remove(); delete window.__insertionOwner; });
      }
    }
  });
  await check('local picker cancellation resets the same file, while draft cancellation leaves exact bytes untouched', async () => {
    const id = 'insert-ui-cancel'; await createPlain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await snapshot(page, id), bytes = await source(page);
    for (let attempt = 0; attempt < 2; attempt++) {
      await draft(page, id, bytes);
      await part(page, id, 'title').locator('input').fill('Discarded');
      await cancel(page, id); await unchanged(page, id, before, initial, saveEditor);
      assert.equal(await part(page, id, 'file').inputValue(), '');
    }
    // Native input cancel dispatch is explicitly synthetic: browser chooser dismissal is not automated.
    const chooser = page.waitForEvent('filechooser'); void chooser.catch(() => {}); await part(page, id, 'trigger').click(); await chooser;
    await part(page, id, 'file').evaluate(element => element.dispatchEvent(new Event('cancel')));
    assert.equal(await part(page, id, 'file').inputValue(), '');
    await page.waitForFunction(id => document.getElementById(id).shadowRoot.activeElement?.getAttribute('part') === 'image-insert-trigger', id);
    await draft(page, id, bytes, true); await page.keyboard.press('Escape');
    await part(page, id, 'fields').waitFor({ state: 'hidden' }); await unchanged(page, id, before, initial, saveEditor);
    await dispose(page, id);
  });
  await check('outside light dismissal preserves native focus and a toolbar peer opens on its first activation', async () => {
    const id = 'insert-ui-dismiss'; await createPlain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await snapshot(page, id), bytes = await source(page);
    await page.evaluate(() => { const outside = document.createElement('input'); outside.id = 'insert-ui-dismiss-outside';
      outside.setAttribute('aria-label', 'Outside control'); outside.style.marginInlineStart = '50%';
      document.querySelector('#fixture').append(outside); });
    try {
      await draft(page, id, bytes);
      const hidden = part(page, id, 'dialog').evaluate(element => new Promise(resolve => element.addEventListener('lr-after-hide', resolve, { once: true })));
      assert.equal(await page.locator('#insert-ui-dismiss-outside').evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.ownerDocument.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
      }), true);
      await page.locator('#insert-ui-dismiss-outside').click(); await hidden;
      assert.equal(await page.evaluate(() => document.activeElement.id), 'insert-ui-dismiss-outside');
      assert.equal(await part(page, id, 'width').count(), 0); await unchanged(page, id, before, initial, saveEditor);
      await caret(page, id, 'gamma'); await draft(page, id, bytes);
      assert.equal(await page.locator(`#${id} [part="link-trigger"]`).evaluate(element => {
        const box = element.getBoundingClientRect();
        return element.getRootNode().elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === element;
      }), true);
      await page.locator(`#${id} [part="link-trigger"]`).click();
      await page.locator(`#${id} [part="link-fields"]`).waitFor({ state: 'visible' });
      assert.equal(await part(page, id, 'dialog').evaluate(element => element.open), false);
      assert.equal(await part(page, id, 'width').count(), 0);
      await page.locator(`#${id} [part="link-cancel"]`).click();
      await unchanged(page, id, before, initial, saveEditor);
    } finally { await page.locator('#insert-ui-dismiss-outside').evaluate(element => element.remove()); await dispose(page, id); }
  });
  await check('insertion ratio toggles retain the encoded ratio and incomplete drafts never dispatch', async () => {
    const id = 'insert-ui-ratio'; await createPlain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await snapshot(page, id); await draft(page, id, await source(page));
    const ratio = Number(await part(page, id, 'width').locator('input').inputValue()) / Number(await part(page, id, 'height').locator('input').inputValue());
    await part(page, id, 'width').locator('input').fill('101.125');
    assert.equal(Number(await part(page, id, 'height').locator('input').inputValue()), 101.125 / ratio);
    await part(page, id, 'ratio').click(); await part(page, id, 'height').locator('input').fill('37.75');
    assert.equal(await part(page, id, 'width').locator('input').inputValue(), '101.125');
    await part(page, id, 'ratio').click();
    assert.equal(Number(await part(page, id, 'height').locator('input').inputValue()), 101.125 / ratio);
    // Explicit composition-key stress: Escape must preserve the owned draft, not dismiss an IME.
    await part(page, id, 'description').locator('textarea').evaluate(element => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, composed: true }));
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229, bubbles: true, composed: true }));
    });
    assert.equal(await part(page, id, 'dialog').evaluate(element => element.open), true);
    assert.equal(await part(page, id, 'apply').evaluate(element => element.disabled), false);
    await part(page, id, 'width').locator('input').fill('');
    assert.equal(await part(page, id, 'apply').evaluate(element => element.disabled), true);
    await page.keyboard.press('Enter'); assert.equal(await part(page, id, 'dialog').evaluate(element => element.open), true);
    await cancel(page, id); await unchanged(page, id, before, initial, saveEditor); await dispose(page, id);
  });
  await check('extreme encoded ratios leave empty dimensions and require explicit independent sizes', async () => {
    for (const vertical of [false, true]) {
      const id = `insert-ui-extreme-${vertical}`; await createPlain(page, id, createEditor);
      const before = await saveEditor(page, id), initial = await snapshot(page, id);
      const bytes = Buffer.from(await page.evaluate(async vertical => {
        const canvas = document.createElement('canvas'); canvas.width = vertical ? 1 : 8192; canvas.height = vertical ? 8192 : 1;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        return [...new Uint8Array(await blob.arrayBuffer())];
      }, vertical));
      await draft(page, id, bytes);
      assert.equal(await part(page, id, 'width').locator('input').inputValue(), '');
      assert.equal(await part(page, id, 'height').locator('input').inputValue(), '');
      assert.equal(await part(page, id, 'ratio').evaluate(element => element.checked), false);
      assert.equal(await part(page, id, 'ratio').evaluate(element => element.disabled), true);
      assert.equal(await part(page, id, 'apply').evaluate(element => element.disabled), true);
      await part(page, id, 'width').locator('input').fill('10.125'); await part(page, id, 'height').locator('input').fill('5.5');
      assert.equal(await part(page, id, 'apply').evaluate(element => element.disabled), false);
      await cancel(page, id); await unchanged(page, id, before, initial, saveEditor); await dispose(page, id);
    }
  });
  await check('real caret A to B to A cannot revive the original local image draft', async () => {
    const id = 'insert-ui-aba'; await createPlain(page, id, createEditor); await caret(page, id, 'alpha');
    const before = await saveEditor(page, id), initial = await snapshot(page, id); await draft(page, id, await source(page));
    const abandoned = await part(page, id, 'apply').elementHandle();
    await caret(page, id, 'beta', true); const b = await snapshot(page, id);
    await caret(page, id, 'alpha'); const a = await snapshot(page, id);
    assert.equal(b.selection.kind, 'caret'); assert.equal(a.selection.kind, 'caret');
    assert.ok(b.selection.version > initial.selection.version); assert.ok(a.selection.version > b.selection.version);
    await page.waitForFunction(id => !document.getElementById(id).shadowRoot.querySelector('[part="image-insert-dialog"]').open, id);
    await abandoned.evaluate(element => element.click()); await abandoned.dispose();
    await unchanged(page, id, before, initial, saveEditor);
    await draft(page, id, await source(page)); await cancel(page, id); await dispose(page, id);
  });
  await check('synthetic delayed file read drops canceled and replaced generations without seeding a draft', async () => {
    const id = 'insert-ui-read'; await createPlain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await snapshot(page, id), bytes = await source(page);
    await page.evaluate(() => {
      window.__insertionArrayBuffer = File.prototype.arrayBuffer; window.__insertionArrayBufferDescriptor = Object.getOwnPropertyDescriptor(File.prototype, 'arrayBuffer');
      File.prototype.arrayBuffer = function () { const file = this; return new Promise((resolve, reject) => {
        window.__releaseInsertionRead = () => window.__insertionArrayBuffer.call(file).then(resolve, reject);
      }); };
    });
    try {
      await choose(page, id, bytes); await part(page, id, 'cancel').waitFor({ state: 'visible' });
      await page.waitForFunction(() => typeof window.__releaseInsertionRead === 'function'); await cancel(page, id);
      await page.evaluate(() => window.__releaseInsertionRead()); await paints(page);
      assert.equal(await part(page, id, 'width').count(), 0); await unchanged(page, id, before, initial, saveEditor);
      await page.evaluate(() => { delete window.__releaseInsertionRead; });
      await choose(page, id, bytes); await part(page, id, 'cancel').waitFor({ state: 'visible' });
      await page.waitForFunction(() => typeof window.__releaseInsertionRead === 'function');
      await caret(page, id, 'alpha');
      await page.evaluate(() => window.__releaseInsertionRead()); await paints(page);
      assert.equal(await part(page, id, 'width').count(), 0); await unchanged(page, id, before, initial, saveEditor);
      await page.evaluate(() => { delete window.__releaseInsertionRead; });
      await choose(page, id, bytes); await part(page, id, 'cancel').waitFor({ state: 'visible' });
      await page.waitForFunction(() => typeof window.__releaseInsertionRead === 'function');
      assert.equal((await host(page, id).evaluate(element => element.newDocument())).ok, true);
      await page.evaluate(() => window.__releaseInsertionRead()); await paints(page);
      assert.equal(await part(page, id, 'width').count(), 0); assert.equal(await page.locator(`#${id} .docx-pages img`).count(), 0);
    } finally {
      await page.evaluate(() => { if (window.__insertionArrayBufferDescriptor) Object.defineProperty(File.prototype, 'arrayBuffer', window.__insertionArrayBufferDescriptor); else delete File.prototype.arrayBuffer; delete window.__insertionArrayBufferDescriptor; delete window.__insertionArrayBuffer; delete window.__releaseInsertionRead; });
      await dispose(page, id);
    }
  });
  await check('oversized local files refuse before reading and malformed bytes show normalized feedback', async () => {
    const id = 'insert-ui-invalid'; await createPlain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await snapshot(page, id);
    await page.evaluate(() => { window.__insertionArrayBuffer = File.prototype.arrayBuffer; window.__insertionArrayBufferDescriptor = Object.getOwnPropertyDescriptor(File.prototype, 'arrayBuffer'); window.__insertionReads = 0;
      File.prototype.arrayBuffer = function () { window.__insertionReads++; return window.__insertionArrayBuffer.call(this); }; });
    try {
      await choose(page, id, Buffer.alloc(4 * 1024 * 1024 + 1));
      await part(page, id, 'status').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => window.__insertionReads), 0);
      await choose(page, id, Buffer.from('invalid image'));
      await part(page, id, 'status').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => window.__insertionReads), 1);
      assert.equal(await part(page, id, 'width').count(), 0); await unchanged(page, id, before, initial, saveEditor);
      const jpeg = await source(page, 'jpeg');
      await choose(page, id, Buffer.concat([jpeg.subarray(0, 2), Buffer.from([255, 225, 0, 4, 0, 0]), jpeg.subarray(2)]));
      await page.waitForFunction(() => window.__insertionReads === 2);
      await page.waitForFunction(id => document.getElementById(id).shadowRoot.querySelector('[part="image-insert-status"]')?.textContent.includes('EXIF') &&
        !document.getElementById(id).shadowRoot.querySelector('[part="image-insert-trigger"]').disabled, id);
      await unchanged(page, id, before, initial, saveEditor);
    } finally {
      await page.evaluate(() => { if (window.__insertionArrayBufferDescriptor) Object.defineProperty(File.prototype, 'arrayBuffer', window.__insertionArrayBufferDescriptor); else delete File.prototype.arrayBuffer; delete window.__insertionArrayBufferDescriptor; delete window.__insertionArrayBuffer; delete window.__insertionReads; });
      await dispose(page, id);
    }
  });
  await check('read-only and active composition disable the local image trigger', async () => {
    const id = 'insert-ui-readonly';
    assert.equal((await page.evaluate(async id => { const element = document.createElement('lr-docx-editor'); element.id = id;
      element.readOnly = true; document.querySelector('#fixture').append(element); return element.newDocument(); }, id)).ok, true);
    assert.equal(await part(page, id, 'trigger').evaluate(element => element.disabled), true); await dispose(page, id);
    await createPlain(page, id, createEditor);
    // Explicit synthetic composition lifecycle stress, not native IME qualification.
    await page.locator(`#${id} .docx-pages`).evaluate(element => element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await page.waitForFunction(id => document.getElementById(id).snapshot().composing, id);
    assert.equal(await part(page, id, 'trigger').evaluate(element => element.disabled), true);
    await page.locator(`#${id} .docx-pages`).evaluate(element => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await dispose(page, id);
  });
  await check('insertion dialog inherits themes, motion preferences and translated labels', async () => {
    const id = 'insert-ui-themed'; await createPlain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await snapshot(page, id);
    const theme = await page.evaluate(() => document.documentElement.getAttribute('data-lr-theme'));
    try {
      for (const preference of ['reduce', 'no-preference']) {
        await page.emulateMedia({ reducedMotion: preference });
        await page.evaluate(() => document.documentElement.setAttribute('data-lr-theme', 'dark'));
        await host(page, id).evaluate(element => { element.strings = { docxEditorInsertImage: 'Insérer une image locale',
          docxEditorImageTitle: 'Titre de cette image', docxEditorImageDescription: 'Description de cette image' }; });
        await draft(page, id, await source(page));
        assert.equal(await part(page, id, 'title').getAttribute('label'), 'Titre de cette image');
        assert.equal(await part(page, id, 'description').getAttribute('label'), 'Description de cette image');
        const axe = await page.evaluate(id => window.axe.run(document.getElementById(id),
          { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }), id);
        assert.deepEqual(axe.violations.map(entry => entry.id), []);
        await page.emulateMedia({ forcedColors: 'active' });
        assert.equal(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), true);
        assert.equal(await part(page, id, 'width').locator('input').isVisible(), true);
        assert.equal(await part(page, id, 'apply').evaluate(element => element.disabled), false);
        await cancel(page, id); await page.emulateMedia({ forcedColors: 'none' });
      }
      await unchanged(page, id, before, initial, saveEditor);
    } finally {
      await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'none' });
      await page.evaluate(theme => { if (theme === null) document.documentElement.removeAttribute('data-lr-theme'); else document.documentElement.setAttribute('data-lr-theme', theme); }, theme);
      await dispose(page, id);
    }
  });
  await check('insertion fields confine scrolling in nested hosts and preserve oversized native caret behavior', async () => {
    const id = 'insert-ui-confined', viewport = page.viewportSize(), fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
    await page.evaluate(() => { const fixture = document.querySelector('#fixture'), consumer = document.createElement('div');
      consumer.id = 'insert-ui-consumer'; consumer.style.cssText = 'height:700px;overflow:auto;max-width:100%;';
      fixture.before(consumer); consumer.append(fixture); const outside = document.createElement('input');
      outside.id = 'insert-ui-outside'; outside.setAttribute('aria-label', 'Outside control'); document.body.append(outside);
    });
    try {
      await createPlain(page, id, createEditor); const before = await saveEditor(page, id), initial = await snapshot(page, id);
      await page.setViewportSize({ width: 320, height: 900 });
      await host(page, id).evaluate(element => { document.documentElement.style.fontSize = '200%'; element.setAttribute('dir', 'rtl');
        element.style.inlineSize = '100%'; element.strings = { docxEditorImageDescription: 'A long description label for the local image '.repeat(12) };
      });
      await host(page, id).evaluate(element => element.updateComplete); await paints(page); await caret(page, id, 'gamma');
      await draft(page, id, await source(page), true);
      for (const name of ['height', 'ratio', 'title']) {
        await page.keyboard.press('Tab'); assert.equal(await host(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), `image-insert-${name}`);
      }
      const outer = () => host(page, id).evaluate(element => { const consumer = document.getElementById('insert-ui-consumer'), viewport = element.querySelector('[data-lr-docx-viewport]');
        return [scrollX, scrollY, consumer.scrollLeft, consumer.scrollTop, viewport.scrollLeft, viewport.scrollTop]; });
      const baseline = await outer(), original = await snapshot(page, id);
      await page.keyboard.press('Tab'); await paints(page);
      const measured = await part(page, id, 'description').evaluate(element => {
        const native = element.shadowRoot.activeElement, content = element.closest('[part="image-insert-dialog"]').shadowRoot.querySelector('[part~="content"]');
        const box = native.getBoundingClientRect(), clip = content.getBoundingClientRect();
        return { hostHeight: element.getBoundingClientRect().height, nativeHeight: box.height, clipHeight: clip.height,
          top: box.top, bottom: box.bottom, clipTop: clip.top, clipBottom: clip.bottom, focused: native.matches(':focus-visible') };
      });
      assert.ok(measured.hostHeight > measured.clipHeight && measured.nativeHeight < measured.clipHeight, JSON.stringify(measured));
      assert.equal(measured.focused, true); assert.ok(measured.top >= measured.clipTop - 2 && measured.bottom <= measured.clipBottom + 2, JSON.stringify(measured));
      assert.deepEqual(await outer(), baseline); assert.deepEqual(await snapshot(page, id), original);
      await page.keyboard.press('Shift+Tab');
      await host(page, id).evaluate(element => { const style = document.createElement('style');
        style.textContent = '[part="image-insert-description"]::part(textarea) {block-size:calc(100vh + 20rem);}'; element.shadowRoot.append(style);
      });
      await paints(page);
      await part(page, id, 'dialog').evaluate(popover => {
        const content = popover.shadowRoot.querySelector('[part~="content"]'), descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
        popover.__focusScrollWrites = 0; Object.defineProperty(content, 'scrollTop', { configurable: true,
          get() { return descriptor.get.call(this); }, set(value) { popover.__focusScrollWrites++; descriptor.set.call(this, value); } });
      });
      await page.keyboard.press('Tab'); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Caret survives');
      const oversized = await part(page, id, 'dialog').evaluate(popover => {
        const content = popover.shadowRoot.querySelector('[part~="content"]'), control = popover.querySelector('[part="image-insert-description"]'), native = control.shadowRoot.activeElement;
        const result = { writes: popover.__focusScrollWrites, oversized: native.getBoundingClientRect().height > content.getBoundingClientRect().height,
          value: native.value, caret: native.selectionStart, focused: control.getRootNode().activeElement === control && native.matches(':focus-visible') };
        delete content.scrollTop; return result;
      });
      assert.equal(oversized.oversized, true); assert.equal(oversized.writes, 0); assert.equal(oversized.focused, true);
      assert.equal(oversized.value, 'Caret survives'); assert.equal(oversized.caret, 'Caret survives'.length);
      assert.deepEqual(await snapshot(page, id), original);
      const hidden = part(page, id, 'dialog').evaluate(element => new Promise(resolve => element.addEventListener('lr-after-hide', resolve, { once: true })));
      await part(page, id, 'cancel').click(); await page.locator('#insert-ui-outside').click(); await hidden;
      assert.equal(await page.evaluate(() => document.activeElement.id), 'insert-ui-outside');
      await unchanged(page, id, before, initial, saveEditor);
    } finally {
      await dispose(page, id);
      await page.evaluate(value => { document.documentElement.style.fontSize = value;
        document.getElementById('insert-ui-consumer').replaceWith(document.querySelector('#fixture')); document.getElementById('insert-ui-outside').remove(); }, fontSize);
      if (viewport) await page.setViewportSize(viewport);
    }
  });
  await check('local image dialog keyboard fields fit 320px RTL and 200% zoom with confined focus scrolling', async () => {
    const viewport = page.viewportSize(), fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
    try {
      for (const zoom of [false, true]) {
        const id = `insert-ui-accessible-${zoom}`; await createPlain(page, id, createEditor);
        const before = await saveEditor(page, id), initial = await snapshot(page, id);
        await page.setViewportSize({ width: 320, height: 900 });
        await host(page, id).evaluate((element, zoom) => { element.setAttribute('dir', 'rtl'); element.style.inlineSize = '100%';
          document.documentElement.style.fontSize = zoom ? '200%' : '';
          element.strings = { docxEditorInsertImage: 'Insert a local image into this document',
            docxEditorImageWidth: 'The local image width measured in points', docxEditorImageHeight: 'The local image height measured in points',
            docxEditorImageTitle: 'A longer title label for this local image', docxEditorImageDescription: 'A longer description label for this local image' };
        }, zoom);
        await host(page, id).evaluate(element => element.updateComplete); await paints(page);
        await caret(page, id, 'gamma'); await draft(page, id, await source(page), true);
        for (const name of ['width', 'height']) {
          const readable = await part(page, id, name).evaluate(control => {
            const input = control.shadowRoot.querySelector('input'), style = getComputedStyle(input);
            const context = document.createElement('canvas').getContext('2d'); context.font = style.font;
            return { value: input.value, available: input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
              text: context.measureText(input.value).width, maximum: context.measureText('1440').width };
          });
          assert.equal(readable.value, name === 'width' ? '48' : '24');
          assert.ok(readable.available >= readable.text && readable.available >= readable.maximum, JSON.stringify(readable));
        }
        await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('1440');
        assert.equal(await part(page, id, 'width').locator('input').inputValue(), '1440');
        await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('12.345678901234567');
        assert.equal(await part(page, id, 'width').locator('input').inputValue(), '12.345678901234567');
        await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('48'); await paints(page);
        assert.equal(await part(page, id, 'height').locator('input').inputValue(), '24');
        await screenshot(page, zoom ? 'insert-image-320-rtl-zoom' : 'insert-image-320-rtl');
        const axe = await page.evaluate(id => window.axe.run(document.getElementById(id),
          { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }), id);
        assert.deepEqual(axe.violations.map(entry => entry.id), []);
        const targets = ['width', 'height', 'ratio', 'title', 'description', 'apply', 'cancel'];
        const baseline = await host(page, id).evaluate(element => ({ window: [scrollX, scrollY], viewport: element.querySelector('[data-lr-docx-viewport]').scrollTop }));
        for (const name of targets) {
          if (name !== 'width') await page.keyboard.press('Tab'); await paints(page);
          const measured = await host(page, id).evaluate((element, name) => {
            let native = element.shadowRoot.activeElement; const actual = native?.getAttribute('part');
            while (native?.shadowRoot?.activeElement) native = native.shadowRoot.activeElement;
            const content = element.shadowRoot.querySelector('[part="image-insert-dialog"]').shadowRoot.querySelector('[part~="content"]');
            const rect = native.getBoundingClientRect(), clip = content.getBoundingClientRect();
            return { actual, expected: `image-insert-${name}`, visible: native.matches(':focus-visible'),
              top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, clipTop: clip.top, clipBottom: clip.bottom,
              window: [scrollX, scrollY], viewport: element.querySelector('[data-lr-docx-viewport]').scrollTop };
          }, name);
          assert.equal(measured.actual, measured.expected, JSON.stringify(measured)); assert.equal(measured.visible, true, JSON.stringify(measured));
          assert.ok(measured.top >= Math.max(0, measured.clipTop) - 2 && measured.bottom <= Math.min(900, measured.clipBottom) + 2, JSON.stringify(measured));
          assert.ok(measured.left >= 0 && measured.right <= 320, JSON.stringify(measured));
          assert.deepEqual(measured.window, baseline.window); assert.equal(measured.viewport, baseline.viewport);
          if (name === 'apply') {
            const readable = await part(page, id, 'apply').evaluate(button => {
              const label = button.shadowRoot.querySelector('[part~="label"]');
              return { text: button.textContent.trim(), whiteSpace: getComputedStyle(label).whiteSpace,
                width: label.clientWidth, scroll: label.scrollWidth };
            });
            assert.equal(readable.text, 'Insert a local image into this document'); assert.equal(readable.whiteSpace, 'normal');
            assert.ok(readable.scroll <= readable.width, JSON.stringify(readable));
            await screenshot(page, zoom ? 'insert-image-320-rtl-zoom-actions' : 'insert-image-320-rtl-actions');
          }
        }
        await page.keyboard.press('Enter'); await part(page, id, 'fields').waitFor({ state: 'hidden' });
        await unchanged(page, id, before, initial, saveEditor); await dispose(page, id);
      }
    } finally { await page.evaluate(value => { document.documentElement.style.fontSize = value; }, fontSize); if (viewport) await page.setViewportSize(viewport); }
  });
}
