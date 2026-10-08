import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { assertNoAxeViolations, screenshot, toolbarTo, zipParts as parts } from './lib/harness.mjs';

const editor = (page, id) => page.locator(`#${id}`);
const part = (page, id, name) => page.locator(`#${id} [part="${name}"]`);
const remove = (page, id) => editor(page, id).evaluate(element => element.remove());

async function selectImage(page, id, index = 0) {
  await page.locator(`#${id} .docx-pages img`).nth(index).click();
  await page.waitForFunction(id => Boolean(document.getElementById(id).snapshot().image), id);
}
async function openDialog(page, id, kind) {
  await part(page, id, `image-${kind}-trigger`).click();
  await part(page, id, `image-${kind}-fields`).waitFor({ state: 'visible' });
}
async function keyboardTool(page, id, name, activate = true) {
  await toolbarTo(page, id, name);
  if (activate) await page.keyboard.press('Enter');
}
async function state(page, id) {
  return editor(page, id).evaluate(element => {
    const snapshot = element.snapshot();
    return { revision: snapshot.revision, dirty: snapshot.dirty, image: snapshot.image,
      undo: snapshot.commands.undo, redo: snapshot.commands.redo };
  });
}
async function roundTripHistory(page, id, before, saved, saveEditor) {
  assert.equal((await editor(page, id).evaluate(element => element.execute('undo'))).ok, true);
  assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
  assert.equal((await editor(page, id).evaluate(element => element.execute('redo'))).ok, true);
  assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
  await remove(page, id);
  const reopened = await page.evaluate(async ({ id, bytes }) => {
    const element = document.createElement('lr-docx-editor'); element.id = id;
    document.querySelector('#fixture').append(element);
    return element.open(Uint8Array.from(bytes));
  }, { id, bytes: saved });
  assert.equal(reopened.ok, true, JSON.stringify(reopened));
  assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
  await remove(page, id);
}

export async function runImageTools(page, check, { createEditor, saveEditor, assertProtectedParts }) {
  // Completed suites leave independent editors mounted; isolate real keyboard traversal.
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  await check('native toolbar preserves caret and copied text ranges across a narrow RTL allocation', async () => {
    for (const range of [false, true]) {
      const id = `image-ui-viewport-focus-${range}`; await createEditor(page, id, 'table-simple');
      const before = await saveEditor(page, id);
      if (range) {
        await page.evaluate(() => { const input = document.createElement('textarea'); input.id = 'image-ui-clipboard-seed'; input.value = 'Viewport clipboard sentinel'; document.body.append(input); });
        try {
          await page.locator('#image-ui-clipboard-seed').click();
          await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+C');
          await page.keyboard.press('Backspace'); await page.keyboard.press('ControlOrMeta+V');
          assert.equal(await page.locator('#image-ui-clipboard-seed').inputValue(), 'Viewport clipboard sentinel');
        } finally { await page.locator('#image-ui-clipboard-seed').evaluate(element => element.remove()); }
      }
      await page.locator(`#${id} .docx-pages`).getByText('Before', { exact: true }).click();
      await page.keyboard.press('Home');
      if (range) await page.keyboard.press('Shift+End');
      else { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); }
      const paints = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
      await paints();
      const original = await editor(page, id).evaluate(element => element.snapshot());
      const selection = await page.evaluate(() => ({ text: getSelection().toString(), anchor: getSelection().anchorOffset, focus: getSelection().focusOffset }));
      assert.equal(selection.text, range ? 'Before' : '');
      await page.keyboard.press('Alt+F10'); await paints();
      assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'format-button');
      await editor(page, id).evaluate(element => { element.setAttribute('dir', 'rtl'); element.style.inlineSize = '320px'; });
      await editor(page, id).evaluate(element => element.updateComplete); await paints();
      assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'format-button');
      assert.deepEqual(await editor(page, id).evaluate(element => element.snapshot()), original);
      assert.deepEqual(await page.evaluate(() => ({ text: getSelection().toString(), anchor: getSelection().anchorOffset, focus: getSelection().focusOffset })), selection);
      if (range) {
        await page.keyboard.press('ControlOrMeta+C');
        await page.evaluate(() => { const input = document.createElement('textarea'); input.id = 'image-ui-copy'; document.body.append(input); });
        try {
          await page.locator('#image-ui-copy').click(); await page.keyboard.press('ControlOrMeta+V');
          assert.equal(await page.locator('#image-ui-copy').inputValue(), 'Before');
        } finally { await page.locator('#image-ui-copy').evaluate(element => element.remove()); }
        assert.equal((await editor(page, id).evaluate(element => element.focusEditor())).ok, true);
        assert.deepEqual(await page.evaluate(() => ({ text: getSelection().toString(), anchor: getSelection().anchorOffset, focus: getSelection().focusOffset })), selection);
        await page.keyboard.press('Alt+F10');
      }
      await page.locator(`#${id} [data-command="bold"]`).click();
      if (!range) {
        assert.equal((await editor(page, id).evaluate(element => element.focusEditor())).ok, true);
        await page.keyboard.type('K');
      }
      await page.waitForFunction(id => document.getElementById(id).snapshot().revision.value > 0, id);
      const saved = await saveEditor(page, id);
      const paragraphs = await page.evaluate(xml => {
        const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
        const document = new DOMParser().parseFromString(xml, 'application/xml');
        return [...document.getElementsByTagNameNS(namespace, 'p')].map(paragraph => ({
          text: [...paragraph.getElementsByTagNameNS(namespace, 't')].map(text => text.textContent).join(''),
          bold: paragraph.getElementsByTagNameNS(namespace, 'b').length > 0
        }));
      }, new TextDecoder().decode(unzipSync(Uint8Array.from(saved))['word/document.xml']));
      assert.equal(paragraphs.find(paragraph => paragraph.text === (range ? 'Before' : 'BeKfore'))?.bold, true);
      assert.equal(paragraphs.find(paragraph => paragraph.text === 'A00')?.bold, false);
      if (range) {
        assert.equal((await editor(page, id).evaluate(element => element.execute('undo'))).ok, true);
        assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      }
      await remove(page, id);
    }
  });
  await check('keyboard-only image targeting reaches Resize, Description and Delete without pointer input', async () => {
    const id = 'image-ui-keyboard', source = await createEditor(page, id, 'image-simple');
    const before = await saveEditor(page, id);
    assert.equal(await editor(page, id).evaluate(element => element.querySelector('[data-lr-docx-viewport]').tabIndex), 0);
    await page.keyboard.press('Alt+F10'); await page.keyboard.press('Home');
    for (let attempt = 0; attempt < 80; attempt++) {
      if (await editor(page, id).evaluate(element => document.activeElement === element.querySelector('[data-lr-docx-viewport]'))) break;
      await page.keyboard.press('Tab');
    }
    assert.equal(await editor(page, id).evaluate(element => document.activeElement === element.querySelector('[data-lr-docx-viewport]')), true);
    const focusRing = await editor(page, id).evaluate(element => {
      const viewport = element.querySelector('[data-lr-docx-viewport]'), style = getComputedStyle(viewport);
      return { visible: viewport.matches(':focus-visible'), style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
    });
    assert.equal(focusRing.visible, true); assert.notEqual(focusRing.style, 'none'); assert.ok(focusRing.width > 0);
    const scrollSnapshot = await editor(page, id).evaluate(element => element.snapshot());
    const scrollTop = await editor(page, id).evaluate(element => element.querySelector('[data-lr-docx-viewport]').scrollTop);
    await page.keyboard.press('PageDown');
    await page.waitForFunction(({ id, scrollTop }) => document.getElementById(id).querySelector('[data-lr-docx-viewport]').scrollTop > scrollTop,
      { id, scrollTop });
    assert.deepEqual(await editor(page, id).evaluate(element => element.snapshot()), scrollSnapshot);
    assert.equal((await state(page, id)).revision.value, 0);
    assert.equal((await state(page, id)).dirty, false);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await keyboardTool(page, id, 'image-next', false);
    assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-next');
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => Boolean(document.getElementById(id).snapshot().image), id);
    assert.equal(await editor(page, id).evaluate(element => element.contains(document.activeElement) && document.activeElement.matches('.docx-pages')), true);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 1');
    const selected = await editor(page, id).evaluate(element => ({ image: element.snapshot().image, selection: element.snapshot().selection }));
    await page.waitForFunction(id => document.getElementById(id).can({ type: 'resize-image', widthPoints: 150, heightPoints: 75 }).enabled &&
      !document.getElementById(id).shadowRoot.querySelector('[part="image-resize-trigger"]').disabled, id);
    await keyboardTool(page, id, 'image-delete', false);
    assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-delete');
    assert.deepEqual(await editor(page, id).evaluate(element => ({ image: element.snapshot().image, selection: element.snapshot().selection })), selected);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-description-trigger');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-resize-trigger');
    await page.keyboard.press('Enter');
    await part(page, id, 'image-width').locator('input').waitFor({ state: 'visible' });
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('150');
    await page.keyboard.press('Enter');
    await page.waitForFunction(id => document.getElementById(id).snapshot().revision.value === 1, id);
    await page.waitForFunction(id => document.getElementById(id).can({ type: 'image-description', title: 'Keyboard title', description: '' }).enabled, id);
    await keyboardTool(page, id, 'image-description-trigger');
    await part(page, id, 'image-title').locator('input').waitFor({ state: 'visible' });
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Keyboard title'); await page.keyboard.press('Enter');
    await page.waitForFunction(id => document.getElementById(id).snapshot().revision.value === 2, id);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Keyboard title');
    await page.waitForFunction(id => document.getElementById(id).can({ type: 'delete-image' }).enabled, id);
    await keyboardTool(page, id, 'image-delete');
    await page.waitForFunction(id => document.getElementById(id).snapshot().revision.value === 3, id);
    assert.equal(await page.locator(`#${id} .docx-pages img`).count(), 1);
    const saved = await saveEditor(page, id); assertProtectedParts(saved, source);
    assert.equal((await editor(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.equal((await editor(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.equal((await editor(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
  });

  await check('image controls are contextual and untouched Resize/Description Apply create no history', async () => {
    const id = 'image-ui-unchanged'; await createEditor(page, id, 'image-simple');
    assert.equal(await part(page, id, 'image-tools').count(), 1);
    assert.equal(await part(page, id, 'image-resize-trigger').count(), 0);
    assert.equal(await part(page, id, 'image-description-trigger').count(), 0);
    assert.equal(await part(page, id, 'image-delete').count(), 0);
    await selectImage(page, id);
    const before = await saveEditor(page, id), original = await state(page, id);
    assert.equal(original.dirty, false); assert.equal(original.undo.enabled, false);
    for (const kind of ['resize', 'description']) {
      await openDialog(page, id, kind);
      await screenshot(page, `image-${kind}-desktop`);
      if (kind === 'resize') {
        const dimensions = await editor(page, id).evaluate(element => {
          const root = element.shadowRoot;
          return [root.querySelector('[part="image-width"]').value, root.querySelector('[part="image-height"]').value];
        });
        assert.equal(Math.round(Number(dimensions[0]) * 12700), Math.round(original.image.widthPoints * 12700));
        assert.equal(Math.round(Number(dimensions[1]) * 12700), Math.round(original.image.heightPoints * 12700));
        assert.equal(await part(page, id, 'image-ratio').evaluate(element => element.checked), true);
      }
      await part(page, id, `image-${kind}-apply`).click();
      await page.waitForFunction(({ id, kind }) => !document.getElementById(id).shadowRoot.querySelector(`[part="image-${kind}-popover"]`).open, { id, kind });
      const after = await state(page, id);
      assert.deepEqual(after.revision, original.revision); assert.equal(after.dirty, false);
      assert.deepEqual(after.undo, original.undo); assert.deepEqual(after.redo, original.redo);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      assert.deepEqual((await state(page, id)).image, original.image);
    }
    await selectImage(page, id, 1);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    await selectImage(page, id);
    await openDialog(page, id, 'description');
    assert.equal(await part(page, id, 'image-title').locator('input').inputValue(), 'Title 1');
    await part(page, id, 'image-description-cancel').click();
    assert.deepEqual((await state(page, id)).revision, original.revision);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await remove(page, id);
  });

  await check('keyboard image A to B to A navigation cannot revive the original description draft', async () => {
    const id = 'image-ui-keyboard-aba'; await createEditor(page, id, 'image-simple');
    const before = await saveEditor(page, id);
    // Start at the toolbar's tab stop: Firefox does not wrap Tab past the page's last control.
    await editor(page, id).evaluate(element => element.shadowRoot.querySelector('[data-tool-key][tabindex="0"]').focus());
    for (let attempt = 0; attempt < 80; attempt++) {
      await page.keyboard.press('Tab');
      if (await editor(page, id).evaluate(element => element.contains(document.activeElement) && document.activeElement.matches('.docx-pages'))) break;
    }
    assert.equal(await editor(page, id).evaluate(element => element.contains(document.activeElement) && document.activeElement.matches('.docx-pages')), true);
    await keyboardTool(page, id, 'image-next');
    await page.waitForFunction(id => document.getElementById(id).can({ type: 'image-description', title: '', description: '' }).enabled &&
      !document.getElementById(id).shadowRoot.querySelector('[part="image-description-trigger"]').disabled, id);
    await keyboardTool(page, id, 'image-description-trigger');
    await part(page, id, 'image-title').locator('input').waitFor({ state: 'visible' });
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Abandoned keyboard draft');
    const original = await editor(page, id).evaluate(element => element.snapshot().selection.version);
    await keyboardTool(page, id, 'image-next');
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    await keyboardTool(page, id, 'image-next');
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 1');
    assert.ok(await editor(page, id).evaluate(element => element.snapshot().selection.version) > original);
    assert.equal(await part(page, id, 'image-description-apply').evaluate(element => element.disabled), true);
    await part(page, id, 'image-description-apply').evaluate(element => element.click());
    assert.equal((await state(page, id)).revision.value, 0);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
  });

  await check('image navigation wraps without edits and provides localized no-image feedback', async () => {
    const id = 'image-ui-navigation'; await createEditor(page, id, 'image-simple');
    const before = await saveEditor(page, id), original = await state(page, id);
    assert.equal(await part(page, id, 'image-previous').getAttribute('aria-label'), 'Previous image');
    assert.equal(await part(page, id, 'image-next').getAttribute('aria-label'), 'Next image');
    await part(page, id, 'image-previous').click();
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    await part(page, id, 'image-next').click();
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 1');
    await part(page, id, 'image-previous').click();
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    assert.deepEqual((await state(page, id)).revision, original.revision);
    assert.equal((await state(page, id)).dirty, false);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
    const empty = 'image-ui-no-target'; await createEditor(page, empty);
    await editor(page, empty).evaluate(element => { element.strings = { docxEditorNoImage: 'Aucune image disponible.', docxEditorNextImage: 'Image suivante' }; });
    assert.equal(await part(page, empty, 'image-next').getAttribute('aria-label'), 'Image suivante');
    await part(page, empty, 'image-next').click();
    assert.equal(await part(page, empty, 'image-navigation-status').textContent(), 'Aucune image disponible.');
    assert.equal((await state(page, empty)).revision.value, 0); await remove(page, empty);
  });

  await check('image resize keeps the original ratio, permits independent axes, and commits one history unit', async () => {
    const id = 'image-ui-resize', source = await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    const before = await saveEditor(page, id), original = await state(page, id);
    await openDialog(page, id, 'resize');
    const width = part(page, id, 'image-width').locator('input'), height = part(page, id, 'image-height').locator('input');
    await width.fill(String(original.image.widthPoints * 2));
    assert.equal(Number(await height.inputValue()), original.image.heightPoints * 2);
    await height.fill(String(original.image.heightPoints * 1.5));
    assert.equal(Number(await width.inputValue()), original.image.widthPoints * 1.5);
    await part(page, id, 'image-ratio').click();
    await width.fill('101.125'); await height.fill('53.375');
    await part(page, id, 'image-resize-apply').click();
    await page.waitForFunction(id => document.getElementById(id).snapshot().revision.value === 1, id);
    const after = await state(page, id);
    assert.equal(after.revision.value, original.revision.value + 1);
    assert.equal(after.image.widthPoints, Math.round(101.125 * 12700) / 12700);
    assert.equal(after.image.heightPoints, Math.round(53.375 * 12700) / 12700);
    const saved = await saveEditor(page, id); assertProtectedParts(saved, source);
    await roundTripHistory(page, id, before, saved, saveEditor);
  });

  await check('image resize drafts refuse empty/out-of-range input and Cancel leaves document unchanged', async () => {
    const id = 'image-ui-drafts'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    const before = await saveEditor(page, id), original = await state(page, id);
    await openDialog(page, id, 'resize'); await part(page, id, 'image-ratio').click();
    for (const value of ['', '0.5', '1440.1']) {
      await part(page, id, 'image-width').locator('input').fill(value);
      assert.equal(await part(page, id, 'image-resize-apply').evaluate(element => element.disabled), true);
    }
    await part(page, id, 'image-width').locator('input').fill('12.5');
    assert.equal(await part(page, id, 'image-resize-apply').evaluate(element => element.disabled), false);
    await part(page, id, 'image-resize-cancel').click();
    assert.deepEqual((await state(page, id)).revision, original.revision);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
  });

  await check('image title and multiline description commit together and preserve unrelated parts/history/reopen', async () => {
    const id = 'image-ui-description', source = await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    const before = await saveEditor(page, id), original = await state(page, id);
    const title = 'Picture & "quoted" 😀', description = 'First line\nSecond line: Café 東京';
    await openDialog(page, id, 'description');
    await part(page, id, 'image-title').locator('input').fill(title);
    await part(page, id, 'image-description').locator('textarea').fill(description);
    await part(page, id, 'image-description-apply').click();
    const after = await state(page, id); assert.equal(after.revision.value, original.revision.value + 1);
    const metadata = await editor(page, id).evaluate(element => element.imageDescription());
    assert.deepEqual(metadata, { ok: true, value: { title, description } });
    const saved = await saveEditor(page, id); assertProtectedParts(saved, source);
    await roundTripHistory(page, id, before, saved, saveEditor);
  });

  await check('image description empty fields explicitly clear metadata and invalid drafts cannot Apply', async () => {
    const id = 'image-ui-clear'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    const selected = await editor(page, id).evaluate(element => ({ image: element.snapshot().image, selection: element.snapshot().selection }));
    const seeded = await editor(page, id).evaluate(element => element.execute({ type: 'image-description', title: 'Title', description: 'Description' }));
    assert.equal(seeded.ok, true);
    assert.deepEqual(await editor(page, id).evaluate(element => ({ image: element.snapshot().image, selection: element.snapshot().selection })), selected);
    await page.waitForFunction(id => document.getElementById(id).can({ type: 'image-description', title: '', description: '' }).enabled &&
      !document.getElementById(id).shadowRoot.querySelector('[part="image-description-trigger"]').disabled, id);
    await openDialog(page, id, 'description');
    assert.equal(await part(page, id, 'image-title').locator('input').inputValue(), 'Title');
    await part(page, id, 'image-title').evaluate(element => {
      element.value = 'x'.repeat(257); element.dispatchEvent(new CustomEvent('lr-input', { bubbles: true, composed: true, detail: { value: element.value } }));
    });
    assert.equal(await part(page, id, 'image-description-apply').evaluate(element => element.disabled), true);
    await part(page, id, 'image-title').locator('input').fill('');
    await part(page, id, 'image-description').locator('textarea').fill('');
    await part(page, id, 'image-description-apply').click();
    assert.deepEqual(await editor(page, id).evaluate(element => element.imageDescription()), { ok: true, value: { title: '', description: '' } });
    assert.equal((await state(page, id)).revision.value, 2); await remove(page, id);
  });

  for (const kind of ['resize', 'description']) {
    await check(`open image ${kind} draft becomes stale on document changes without retargeting`, async () => {
      const id = `image-ui-stale-${kind}`; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
      await openDialog(page, id, kind);
      const changed = await editor(page, id).evaluate(element => {
        const image = element.snapshot().image;
        return element.execute({ type: 'resize-image', widthPoints: image.widthPoints + 1, heightPoints: image.heightPoints });
      });
      assert.equal(changed.ok, true, JSON.stringify(changed));
      assert.equal(await part(page, id, `image-${kind}-apply`).evaluate(element => element.disabled), true);
      assert.match(await part(page, id, `image-${kind}-hint`).textContent(), /selection changed/u);
      const before = await saveEditor(page, id);
      await part(page, id, `image-${kind}-apply`).evaluate(element => element.click());
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      await part(page, id, `image-${kind}-cancel`).click(); await remove(page, id);
    });
  }

  await check('native image A to B to A selection cannot revive an abandoned original description draft', async () => {
    const id = 'image-ui-aba'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    const before = await saveEditor(page, id), original = await state(page, id);
    await openDialog(page, id, 'description');
    await part(page, id, 'image-title').locator('input').fill('Abandoned title for image A');
    await selectImage(page, id, 1);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    await selectImage(page, id);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 1');
    await page.waitForFunction(id => !document.getElementById(id).shadowRoot.querySelector('[part="image-description-popover"]').open, id);
    await part(page, id, 'image-description-apply').evaluate(element => element.click());
    assert.deepEqual((await state(page, id)).revision, original.revision);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await openDialog(page, id, 'description');
    assert.equal(await part(page, id, 'image-title').locator('input').inputValue(), 'Title 1');
    await part(page, id, 'image-description-cancel').click(); await remove(page, id);
  });

  await check('image Delete removes only the selected shared-media picture as one undo unit', async () => {
    const id = 'image-ui-delete', source = await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    const before = await saveEditor(page, id);
    assert.equal(await page.locator(`#${id} .docx-pages img`).count(), 2);
    await part(page, id, 'image-delete').click();
    assert.equal(await page.locator(`#${id} .docx-pages img`).count(), 1);
    assert.equal((await state(page, id)).revision.value, 1);
    const saved = await saveEditor(page, id); assertProtectedParts(saved, source);
    await roundTripHistory(page, id, before, saved, saveEditor);
  });

  await check('read-only image controls disable every action while cached description remains readable', async () => {
    const id = 'image-ui-readonly';
    const opened = await page.evaluate(async id => {
      const element = document.createElement('lr-docx-editor'); element.id = id; element.readOnly = true;
      document.querySelector('#fixture').append(element); return element.open(await window.__docxTest.fixture('image-simple'));
    }, id);
    assert.equal(opened.ok, true);
    const before = await saveEditor(page, id), original = await state(page, id);
    assert.equal(await part(page, id, 'image-next').evaluate(element => element.disabled), false);
    for (let attempt = 0; attempt < 80; attempt++) {
      await page.keyboard.press('Tab');
      if (await editor(page, id).evaluate(element => element === document.activeElement || element.contains(document.activeElement))) break;
    }
    assert.equal(await editor(page, id).evaluate(element => element === document.activeElement || element.contains(document.activeElement)), true);
    await keyboardTool(page, id, 'image-next');
    await page.waitForFunction(id => Boolean(document.getElementById(id).snapshot().image), id);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 1');
    await keyboardTool(page, id, 'image-next');
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    await keyboardTool(page, id, 'image-previous');
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).value.title, 'Title 1');
    for (const name of ['image-resize-trigger', 'image-description-trigger', 'image-delete'])
      assert.equal(await part(page, id, name).evaluate(element => element.disabled), true);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).ok, true);
    for (const action of [{ type: 'resize-image', widthPoints: 150, heightPoints: 75 },
      { type: 'image-description', title: 'Blocked', description: 'Blocked' }, { type: 'delete-image' }]) {
      assert.deepEqual(await editor(page, id).evaluate((element, action) => element.can(action), action), { enabled: false, reason: 'read-only' });
      assert.deepEqual(await editor(page, id).evaluate((element, action) => element.execute(action), action), { ok: false, code: 'read-only' });
    }
    const current = await state(page, id);
    for (const key of ['revision', 'dirty', 'undo', 'redo']) assert.deepEqual(current[key], original[key]);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await remove(page, id);
  });

  await check('document viewport honors a small inherited allocation in a 320px RTL editor', async () => {
    const id = 'image-ui-allocation'; await createEditor(page, id, 'image-offscreen');
    const before = await saveEditor(page, id), original = await state(page, id);
    await editor(page, id).evaluate(element => {
      element.setAttribute('dir', 'rtl'); element.style.inlineSize = '320px';
      element.style.setProperty('--lr-docx-editor-document-max-block-size', '12rem');
    });
    const allocation = () => editor(page, id).evaluate(element => {
      const viewport = element.querySelector('[data-lr-docx-viewport]');
      const surface = element.querySelector('[data-lr-docx-surface]');
      const box = viewport.getBoundingClientRect(), host = element.getBoundingClientRect();
      return { height: viewport.clientHeight, scrollHeight: viewport.scrollHeight, width: box.width,
        hostWidth: host.width, rootFontSize: parseFloat(getComputedStyle(document.documentElement).fontSize),
        tabIndex: viewport.tabIndex, distinctSurface: viewport !== surface && viewport.contains(surface) };
    });
    const bounded = await allocation();
    assert.ok(bounded.height <= bounded.rootFontSize * 12 + 1, JSON.stringify(bounded));
    assert.ok(bounded.scrollHeight > bounded.height, JSON.stringify(bounded));
    assert.ok(bounded.width <= bounded.hostWidth && bounded.hostWidth <= 320, JSON.stringify(bounded));
    assert.equal(bounded.tabIndex, 0); assert.equal(bounded.distinctSurface, true);
    assert.equal((await editor(page, id).evaluate(element => element.selectImage('next'))).ok, true);
    const visible = await editor(page, id).evaluate(element => {
      const viewport = element.querySelector('[data-lr-docx-viewport]').getBoundingClientRect();
      const image = element.querySelector('.docx-pages img').getBoundingClientRect();
      return image.top < viewport.bottom && image.bottom > viewport.top;
    });
    assert.equal(visible, true);
    await editor(page, id).evaluate(element => element.style.setProperty('--lr-docx-editor-document-max-block-size', 'none'));
    const growing = await allocation(); assert.ok(growing.height > bounded.height, JSON.stringify(growing));
    assert.equal((await editor(page, id).evaluate(element => element.selectImage('next'))).ok, true);
    const current = await state(page, id);
    for (const key of ['revision', 'dirty', 'undo', 'redo']) assert.deepEqual(current[key], original[key]);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await remove(page, id);
  });

  await check('image dialogs disable fields during a real save and synthetic composition remains guarded', async () => {
    const id = 'image-ui-busy'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    await openDialog(page, id, 'resize');
    const saving = await editor(page, id).evaluate(async element => {
      let disabled = null;
      const listener = () => {
        if (element.snapshot().activity !== 'saving') return;
        element.performUpdate();
        disabled = ['image-width', 'image-height', 'image-ratio', 'image-resize-apply'].map(name =>
          element.shadowRoot.querySelector(`[part="${name}"]`).hasAttribute('disabled'));
      };
      element.addEventListener('lr-change', listener);
      const saved = await element.save(); element.removeEventListener('lr-change', listener);
      return { saved: saved.ok, disabled };
    });
    assert.equal(saving.saved, true); assert.deepEqual(saving.disabled, [true, true, true, true]);
    await part(page, id, 'image-resize-cancel').click();
    assert.ok((await state(page, id)).image);
    const composing = await editor(page, id).evaluate(element => {
      const surface = element.querySelector('.docx-pages');
      surface.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, composed: true }));
      element.performUpdate();
      const disabled = ['image-previous', 'image-next', 'image-resize-trigger', 'image-description-trigger', 'image-delete'].map(name =>
        element.shadowRoot.querySelector(`[part="${name}"]`).hasAttribute('disabled'));
      const composing = element.snapshot().composing;
      surface.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, composed: true }));
      return { composing, disabled };
    });
    assert.equal(composing.composing, true); assert.deepEqual(composing.disabled, [true, true, true, true, true]);
    await remove(page, id);
  });

  await check('image dialog keyboard, translations, RTL/LTR 320px and populated accessibility', async () => {
    const id = 'image-ui-accessible'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    assert.match(await part(page, id, 'image-resize-trigger').getAttribute('aria-label'), /^Resize image, [\d.,]+ × [\d.,]+ points\.$/u);
    for (const direction of ['ltr', 'rtl']) {
      await editor(page, id).evaluate((element, direction) => {
        element.setAttribute('dir', direction); element.style.inlineSize = '320px';
        element.strings = { docxEditorResizeImage: 'Modifier les dimensions de cette image',
          docxEditorDescribeImage: 'Décrire cette image sélectionnée', docxEditorDeleteImage: 'Supprimer cette image',
          docxEditorImageWidth: 'Largeur de cette image en points', docxEditorImageHeight: 'Hauteur de cette image en points',
          docxEditorImageRatio: 'Conserver les proportions de cette image', docxEditorImageTitle: 'Titre de l’image',
          docxEditorImageDescription: 'Description de l’image', docxEditorImageApply: 'Appliquer' };
      }, direction);
      await keyboardTool(page, id, 'image-delete', false);
      assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-delete');
      await page.keyboard.press(direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft');
      assert.equal(await editor(page, id).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-description-trigger');
      await page.keyboard.press('Enter');
      await part(page, id, 'image-title').locator('input').waitFor({ state: 'visible' });
      assert.equal(await part(page, id, 'image-title').getAttribute('label'), 'Titre de l’image');
      assert.equal(await part(page, id, 'image-description').getAttribute('label'), 'Description de l’image');
      await assertNoAxeViolations(page, id);
      const bounds = await part(page, id, 'image-description-fields').boundingBox();
      assert.ok(bounds.width <= 320, JSON.stringify(bounds));
      if (direction === 'rtl') await screenshot(page, 'image-description-320-rtl');
      const nativeKeys = await part(page, id, 'image-title').locator('input').evaluate(input => {
        return [new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true, cancelable: true }),
          new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229, bubbles: true, composed: true, cancelable: true })]
          .map(event => { input.dispatchEvent(event); return event.defaultPrevented; });
      });
      assert.deepEqual(nativeKeys, [false, false]);
      await part(page, id, 'image-title').locator('input').press('Escape');
      await page.waitForFunction(id => document.getElementById(id).shadowRoot.activeElement?.getAttribute('part') === 'image-description-trigger', id);
      assert.equal((await state(page, id)).revision.value, 0);
      await openDialog(page, id, 'resize');
      const resizeBounds = await part(page, id, 'image-resize-fields').boundingBox();
      assert.ok(resizeBounds.width <= 320, JSON.stringify(resizeBounds));
      if (direction === 'rtl') await screenshot(page, 'image-resize-320-rtl');
      assert.equal(await part(page, id, 'image-width').getAttribute('label'), 'Largeur de cette image en points');
      await assertNoAxeViolations(page, id);
      await part(page, id, 'image-resize-cancel').click();
      assert.ok((await state(page, id)).image);
    }
    await remove(page, id);
  });

  await check('image dialogs preserve long labels and controls at 200% text zoom in a 320px RTL viewport', async () => {
    const id = 'image-ui-zoom'; await createEditor(page, id, 'image-simple');
    const before = await saveEditor(page, id); await selectImage(page, id);
    const viewport = page.viewportSize();
    const fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
    try {
      await page.setViewportSize({ width: 320, height: 900 });
      await editor(page, id).evaluate(element => {
        document.documentElement.style.fontSize = '200%'; element.setAttribute('dir', 'rtl'); element.style.inlineSize = '100%';
        element.strings = { docxEditorImageTitle: 'A long title label for the selected image',
          docxEditorImageDescription: 'A long description label for the selected image',
          docxEditorImageWidth: 'The selected image width measured in points',
          docxEditorImageHeight: 'The selected image height measured in points' };
      });
      for (const kind of ['resize', 'description']) {
        const shown = part(page, id, `image-${kind}-popover`).evaluate(element => new Promise(resolve => {
          element.addEventListener('lr-after-show', () => resolve(true), { once: true });
        }));
        await openDialog(page, id, kind);
        await shown;
        const allocation = await part(page, id, `image-${kind}-fields`).evaluate(element => {
          const box = element.getBoundingClientRect();
          const fields = [...element.querySelectorAll('[part]')].map(field => {
            const child = field.getBoundingClientRect();
            return { left: child.left, right: child.right };
          });
          return { width: box.width, left: box.left, right: box.right, viewport: window.innerWidth, fields };
        });
        assert.ok(allocation.width <= 320 && allocation.left >= 0 && allocation.right <= allocation.viewport, JSON.stringify(allocation));
        assert.ok(allocation.fields.every(field => field.left >= allocation.left - 1 && field.right <= allocation.right + 1), JSON.stringify(allocation));
        await screenshot(page, `image-${kind}-320-rtl-text-zoom`);
        await assertNoAxeViolations(page, id);
        const first = kind === 'resize' ? 'image-width' : 'image-title';
        await page.waitForFunction(({ id, first }) => document.getElementById(id).shadowRoot.activeElement?.getAttribute('part') === first, { id, first });
        await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type(kind === 'resize' ? '150' : 'Zoom draft');
        await page.waitForFunction(({ id, kind }) => !document.getElementById(id).shadowRoot.querySelector(`[part="image-${kind}-apply"]`).disabled, { id, kind });
        const targets = kind === 'resize'
          ? ['image-width', 'image-height', 'image-ratio', 'image-resize-apply', 'image-resize-cancel']
          : ['image-title', 'image-description', 'image-description-apply', 'image-description-cancel'];
        const focused = [];
        for (const target of targets) {
          if (target !== first) await page.keyboard.press('Tab');
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))));
          const result = await editor(page, id).evaluate((element, { kind, target }) => {
            const host = element.shadowRoot.activeElement;
            let native = host;
            while (native?.shadowRoot?.activeElement) native = native.shadowRoot.activeElement;
            const popup = element.shadowRoot.querySelector(`[part="image-${kind}-popover"]`).shadowRoot.querySelector('[part~="popup"]');
            const content = popup.querySelector('[part~="content"]');
            const scroller = content && ['auto', 'scroll'].includes(getComputedStyle(content).overflowY) ? content : popup;
            const box = native.getBoundingClientRect(), clip = scroller.getBoundingClientRect();
            return { actual: host?.getAttribute('part'), target, focusVisible: native.matches(':focus-visible'),
              box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
              clip: { top: clip.top, bottom: clip.bottom }, scrollTop: scroller.scrollTop,
              viewport: { width: innerWidth, height: innerHeight } };
          }, { kind, target });
          assert.equal(result.actual, target, JSON.stringify(result));
          assert.equal(result.focusVisible, true, JSON.stringify(result));
          assert.ok(result.box.top >= Math.max(0, result.clip.top) - 2 && result.box.bottom <= Math.min(result.viewport.height, result.clip.bottom) + 2,
            JSON.stringify(result));
          assert.ok(result.box.left >= 0 && result.box.right <= result.viewport.width, JSON.stringify(result));
          focused.push(result);
          if (target.endsWith('-apply')) await screenshot(page, `image-${kind}-320-rtl-text-zoom-actions`);
        }
        assert.ok(focused.at(-1).scrollTop > 0, JSON.stringify(focused));
        await page.keyboard.press('Enter');
        await part(page, id, `image-${kind}-fields`).waitFor({ state: 'hidden' });
        assert.ok((await state(page, id)).image);
        assert.equal((await state(page, id)).revision.value, 0);
        assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      }
      assert.equal((await state(page, id)).revision.value, 0);
    } finally {
      await page.evaluate(value => { document.documentElement.style.fontSize = value; }, fontSize);
      if (viewport) await page.setViewportSize(viewport);
      await remove(page, id);
    }
  });

  await check('image dialog focus confines scrolling and preserves oversized control caret behavior', async () => {
    const id = 'image-ui-contained-focus';
    const viewport = page.viewportSize(), fontSize = await page.evaluate(() => document.documentElement.style.fontSize);
    await page.evaluate(() => {
      const fixture = document.querySelector('#fixture'), consumer = document.createElement('div');
      consumer.id = 'image-ui-consumer'; consumer.style.cssText = 'height:700px;overflow:auto;max-width:100%;';
      fixture.before(consumer); consumer.append(fixture);
    });
    try {
      await createEditor(page, id, 'image-simple'); const before = await saveEditor(page, id); await selectImage(page, id);
      await page.setViewportSize({ width: 320, height: 900 });
      await editor(page, id).evaluate(element => {
        document.documentElement.style.fontSize = '200%'; element.setAttribute('dir', 'rtl'); element.style.inlineSize = '100%';
        element.strings = { docxEditorImageDescription: 'A very long description label for the selected image '.repeat(12) };
      });
      const shown = part(page, id, 'image-description-popover').evaluate(element => new Promise(resolve =>
        element.addEventListener('lr-after-show', resolve, { once: true })));
      await openDialog(page, id, 'description'); await shown;
      await part(page, id, 'image-title').locator('input').fill('Uncommitted title');
      const snapshot = await editor(page, id).evaluate(element => element.snapshot());
      const outer = () => editor(page, id).evaluate(element => {
        const consumer = document.getElementById('image-ui-consumer'), viewport = element.querySelector('[data-lr-docx-viewport]');
        return [scrollX, scrollY, consumer.scrollLeft, consumer.scrollTop, viewport.scrollLeft, viewport.scrollTop];
      });
      const previous = await outer(); await page.keyboard.press('Tab');
      // Firefox scrolls the focused field into the popover's clip a frame or more after Tab; poll for
      // the settled geometry instead of assuming a fixed number of frames, then assert it strictly.
      const measure = () => part(page, id, 'image-description').evaluate(host => {
        const native = host.shadowRoot.activeElement;
        const popover = host.closest('[part="image-description-popover"]');
        const content = popover.shadowRoot.querySelector('[part~="content"]');
        const box = native.getBoundingClientRect(), clip = content.getBoundingClientRect();
        return { hostHeight: host.getBoundingClientRect().height, nativeHeight: box.height, clipHeight: clip.height,
          top: box.top, bottom: box.bottom, clipTop: clip.top, clipBottom: clip.bottom, focused: native.matches(':focus-visible') };
      });
      let bounds = await measure();
      for (let frame = 0; frame < 120 && !(bounds.top >= bounds.clipTop - 2 && bounds.bottom <= bounds.clipBottom + 2); frame++) {
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        bounds = await measure();
      }
      assert.ok(bounds.hostHeight > bounds.clipHeight && bounds.nativeHeight < bounds.clipHeight, JSON.stringify(bounds));
      assert.equal(bounds.focused, true); assert.ok(bounds.top >= bounds.clipTop - 2 && bounds.bottom <= bounds.clipBottom + 2, JSON.stringify(bounds));
      assert.deepEqual(await outer(), previous); assert.deepEqual(await editor(page, id).evaluate(element => element.snapshot()), snapshot);
      await page.keyboard.press('Shift+Tab');
      await editor(page, id).evaluate(element => {
        const style = document.createElement('style'); style.textContent = '[part="image-description"]::part(textarea) {block-size:calc(100vh + 20rem);}';
        element.shadowRoot.append(style);
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await part(page, id, 'image-description-popover').evaluate(popover => {
        const content = popover.shadowRoot.querySelector('[part~="content"]');
        const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
        popover.__focusScrollWrites = 0;
        Object.defineProperty(content, 'scrollTop', { configurable: true,
          get() { return descriptor.get.call(this); }, set(value) { popover.__focusScrollWrites++; descriptor.set.call(this, value); } });
      });
      await page.keyboard.press('Tab'); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Caret survives');
      const oversized = await part(page, id, 'image-description-popover').evaluate(popover => {
        const content = popover.shadowRoot.querySelector('[part~="content"]'), host = popover.querySelector('[part="image-description"]');
        const native = host.shadowRoot.activeElement;
        const result = { writes: popover.__focusScrollWrites, oversized: native.getBoundingClientRect().height > content.getBoundingClientRect().height,
          value: native.value, caret: native.selectionStart, active: host.getRootNode().activeElement === host && native.matches(':focus-visible') };
        delete content.scrollTop; return result;
      });
      assert.equal(oversized.oversized, true); assert.equal(oversized.writes, 0);
      assert.equal(oversized.active, true); assert.equal(oversized.value, 'Caret survives'); assert.equal(oversized.caret, 'Caret survives'.length);
      assert.deepEqual(await editor(page, id).evaluate(element => element.snapshot()), snapshot);
      await part(page, id, 'image-description-cancel').click();
      await part(page, id, 'image-description-fields').waitFor({ state: 'hidden' });
      assert.equal((await state(page, id)).revision.value, 0); assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    } finally {
      await remove(page, id);
      await page.evaluate(value => { document.documentElement.style.fontSize = value; const consumer = document.getElementById('image-ui-consumer'); consumer.replaceWith(document.querySelector('#fixture')); }, fontSize);
      if (viewport) await page.setViewportSize(viewport);
    }
  });

  await check('image description newline remains native and closing never steals later outside focus', async () => {
    const id = 'image-ui-focus'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    await openDialog(page, id, 'description');
    const description = part(page, id, 'image-description').locator('textarea');
    await description.fill('First'); await description.press('Enter'); await description.type('Second');
    assert.equal(await description.inputValue(), 'First\nSecond');
    assert.equal((await state(page, id)).revision.value, 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    try {
      await editor(page, id).evaluate(element => {
        const outside = document.createElement('input'); outside.id = 'image-ui-outside'; outside.setAttribute('aria-label', 'Outside focus');
        document.querySelector('#fixture').append(outside);
        const popover = element.shadowRoot.querySelector('[part="image-description-popover"]');
        element.__imageClosed = new Promise(resolve => popover.addEventListener('lr-after-hide', resolve, { once: true }));
        popover.addEventListener('lr-hide', () => queueMicrotask(() => outside.focus()), { once: true });
      });
      await part(page, id, 'image-description-cancel').click();
      await editor(page, id).evaluate(element => element.__imageClosed.then(() => undefined));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'image-ui-outside');
      await page.locator('#image-ui-outside').evaluate(element => element.remove());
    } finally { await page.emulateMedia({ reducedMotion: 'reduce' }); await remove(page, id); }
  });

  await check('image dialog replacement and reconnect clear drafts and original leases', async () => {
    const id = 'image-ui-reconnect'; await createEditor(page, id, 'image-simple'); await selectImage(page, id);
    await openDialog(page, id, 'description'); await part(page, id, 'image-title').locator('input').fill('Discard this draft');
    assert.equal((await editor(page, id).evaluate(element => element.newDocument())).ok, true);
    assert.equal(await part(page, id, 'image-context').count(), 0);
    await editor(page, id).evaluate(element => { const parent = element.parentNode; element.remove(); parent.append(element); });
    assert.equal(await part(page, id, 'image-tools').count(), 0);
    assert.equal((await editor(page, id).evaluate(element => element.imageDescription())).code, 'not-ready');
    assert.equal((await editor(page, id).evaluate(async element => element.open(await window.__docxTest.fixture('image-simple')))).ok, true);
    await selectImage(page, id); await openDialog(page, id, 'resize');
    assert.equal(await part(page, id, 'image-ratio').evaluate(element => element.checked), true);
    await part(page, id, 'image-resize-cancel').click(); await remove(page, id);
  });
}
