import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync } from 'fflate';
import { SaxesParser } from 'saxes';
import { zipEntry } from '../test/zip.mjs';

const parts = bytes => Object.fromEntries(Object.entries(unzipSync(Uint8Array.from(bytes))).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => [name, [...value]]));
const remove = (page, id) => page.locator(`#${id}`).evaluate(element => element.remove());
const select = async (page, id, index = 0) => {
  await page.locator(`#${id} .docx-pages img`).nth(index).click();
  await page.waitForFunction(id => !!document.getElementById(id).snapshot().image, id);
};
function images(bytes) {
  const result = [], parser = new SaxesParser({ xmlns: true });
  parser.on('opentag', node => {
    if (node.uri === 'http://schemas.openxmlformats.org/drawingml/2006/main' && node.local === 'ext' && node.attributes.cx) {
      Object.assign(result.at(-1), { innerWidth: Number(node.attributes.cx.value), innerHeight: Number(node.attributes.cy.value) });
    }
    if (node.uri !== 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing') return;
    if (node.local === 'inline') result.push({});
    if (node.local === 'extent') Object.assign(result.at(-1), { width: Number(node.attributes.cx.value), height: Number(node.attributes.cy.value) });
    if (node.local === 'docPr') Object.assign(result.at(-1), { title: node.attributes.title?.value ?? '', description: node.attributes.descr?.value ?? '' });
  });
  parser.write(zipEntry(bytes, 'word/document.xml')).close(); return result;
}
// Compare every canonical node outside the edited picture, including its sibling picture.
function unrelatedDocument(bytes) {
  const parser = new SaxesParser({ xmlns: true }), stack = [], roots = [];
  parser.on('opentag', tag => {
    const node = { name: `{${tag.uri}}${tag.local}`, attributes: Object.values(tag.attributes)
      .filter(a => a.uri !== 'http://www.w3.org/2000/xmlns/')
      .map(a => [`{${a.uri}}${a.local}`, a.value]).sort(([a], [b]) => a.localeCompare(b)), children: [] };
    (stack.at(-1)?.children ?? roots).push(node); stack.push(node);
  });
  parser.on('text', text => {
    const parent = stack.at(-1);
    if (text.trim() || /\}(?:t|instrText)$/.test(parent?.name ?? '')) parent.children.push(text);
  });
  parser.on('closetag', () => stack.pop()); parser.write(zipEntry(bytes, 'word/document.xml')).close();
  const word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const drawing = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  const selected = node => typeof node !== 'string' && (node.name === `{${drawing}}docPr` && node.attributes.some(([name, value]) => name === '{}id' && value === '1') || node.children.some(selected));
  const clean = node => {
    if (typeof node === 'string') return node;
    if (node.name === `{${word}}drawing` && selected(node)) return null;
    const children = node.children.map(clean).filter(value => value !== null);
    if ([`{${word}}r`, `{${word}}p`].includes(node.name) && !children.length && !node.attributes.length) return null;
    return { ...node, children };
  };
  return roots.map(clean);
}
async function state(page, id) {
  return page.locator(`#${id}`).evaluate(element => {
    const snapshot = element.snapshot();
    return { revision: snapshot.revision, dirty: snapshot.dirty, image: snapshot.image, undo: snapshot.commands.undo.enabled, redo: snapshot.commands.redo.enabled };
  });
}
export async function runImageEditing(page, check, { createEditor, saveEditor }) {
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  for (const [kind, action] of [
    ['image-simple', { type: 'resize-image', widthPoints: 144, heightPoints: 72 }],
    ['image-jpeg', { type: 'resize-image', widthPoints: 100, heightPoints: 50 }],
    ['image-gif', { type: 'resize-image', widthPoints: 100, heightPoints: 50 }],
    ['image-simple', { type: 'image-description', title: 'Picture & \"quoted\" 😀', description: 'First line\nSecond line: Café 東京' }],
    ['image-simple', { type: 'image-description', title: 'Title\rwith\r\nlines', description: 'First\rMiddle\r\nLast' }],
    ['image-simple', { type: 'image-description', title: '', description: '' }],
    ['image-simple', { type: 'delete-image' }],
    ['image-empty-source', { type: 'resize-image', widthPoints: 180, heightPoints: 90 }],
    ['image-word', { type: 'resize-image', widthPoints: 160, heightPoints: 80 }],
    ['image-word', { type: 'image-description', title: 'Word picture', description: 'Authored by Word' }],
    ['image-table', { type: 'resize-image', widthPoints: 90, heightPoints: 45 }],
    ['image-table', { type: 'delete-image' }],
  ]) await check(`selected image ${kind} ${action.type}${action.description?.includes('\r') ? ' CR/CRLF' : ''} commits once and preserves history/media/reopen`, async () => {
    const id = 'image-api'; await createEditor(page, id, kind); await select(page, id);
    const before = await saveEditor(page, id), initial = await state(page, id);
    const result = await page.locator(`#${id}`).evaluate((element, action) => element.execute(action), action);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal((await state(page, id)).revision.value, initial.revision.value + 1);
    if (action.type !== 'delete-image') {
      const version = await page.locator(`#${id}`).evaluate(element => element.snapshot().selection.version);
      await page.waitForFunction(id => document.getElementById(id).can({ type: 'delete-image' }).enabled, id);
      assert.equal(await page.locator(`#${id}`).evaluate(element => element.snapshot().selection.version), version, 'resource completion does not change selection intent');
    }
    const saved = await saveEditor(page, id), oldParts = parts(before), newParts = parts(saved);
    for (const [name, value] of Object.entries(oldParts)) if (name !== 'word/document.xml') assert.deepEqual(newParts[name], value, name);
    assert.deepEqual(unrelatedDocument(saved), unrelatedDocument(before));
    const actual = images(saved);
    if (action.type === 'resize-image') assert.deepEqual([actual[0].width, actual[0].height], [action.widthPoints * 12700, action.heightPoints * 12700]);
    if (action.type === 'image-description') {
      assert.deepEqual([actual[0].title, actual[0].description], [action.title, action.description]);
      assert.deepEqual(await page.locator(`#${id}`).evaluate(element => element.imageDescription()), { ok: true, value: { title: action.title, description: action.description } });
    }
    if (action.type === 'delete-image') { assert.equal(actual.length, 1); assert.equal(actual[0].title, 'Title 2'); }
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('undo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), oldParts);
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('redo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), newParts);
    await remove(page, id);
    assert.equal((await page.evaluate(async ({ id, saved }) => {
      const element = document.createElement('lr-docx-editor'); element.id = id; document.querySelector('#fixture').append(element);
      return element.open(Uint8Array.from(saved));
    }, { id, saved })).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), newParts);
    await remove(page, id);
  });
  await check('selected image identical and invalid commands preserve revision dirty history and package', async () => {
    const id = 'image-noop'; await createEditor(page, id, 'image-simple'); await select(page, id);
    const before = await saveEditor(page, id), initial = await state(page, id);
    const results = await page.locator(`#${id}`).evaluate(element => [
      element.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }),
      element.execute({ type: 'image-description', title: 'Title 1', description: 'Description 1' }),
      element.execute({ type: 'resize-image', widthPoints: NaN, heightPoints: 60 }),
      element.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 1441 }),
      element.execute({ type: 'image-description', title: 'x'.repeat(257), description: '' }),
    ]);
    assert.equal(results[0].ok, true); assert.equal(results[1].ok, true);
    assert.deepEqual(results.slice(2).map(r => r.code), ['invalid-option', 'resource-limit', 'resource-limit']);
    assert.deepEqual(await state(page, id), initial); assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
  });
  await check('selected image exact authoring bounds serialize actual committed dimensions', async () => {
    const id = 'image-bounds'; await createEditor(page, id, 'image-simple'); await select(page, id);
    for (const points of [1, 1440]) {
      await page.waitForFunction(id => document.getElementById(id).can({ type: 'delete-image' }).enabled, id);
      const result = await page.locator(`#${id}`).evaluate((element, points) => element.execute({ type: 'resize-image', widthPoints: points, heightPoints: points }), points);
      assert.equal(result.ok, true, `${points} points: ${JSON.stringify(result)}`);
      assert.deepEqual((await state(page, id)).image, { widthPoints: points, heightPoints: points });
      const saved = await saveEditor(page, id); assert.deepEqual([images(saved)[0].width, images(saved)[0].height], [points * 12700, points * 12700]);
    }
    await remove(page, id);
  });
  await check('repeated resize then metadata and delete remain eligible with independent inner extents', async () => {
    const id = 'image-sequence'; await createEditor(page, id, 'image-simple'); await select(page, id);
    const initial = await saveEditor(page, id), originalInner = [images(initial)[0].innerWidth, images(initial)[0].innerHeight];
    for (const action of [
      { type: 'resize-image', widthPoints: 144, heightPoints: 72 },
      { type: 'resize-image', widthPoints: 90, heightPoints: 30 },
      { type: 'image-description', title: 'Resized picture', description: 'Still editable after repeated resize' },
      { type: 'delete-image' },
    ]) {
      if (!(await state(page, id)).image) assert.equal((await page.locator(`#${id}`).evaluate(element => element.selectImage('next'))).ok, true);
      await page.waitForFunction(id => document.getElementById(id).can({ type: 'delete-image' }).enabled, id);
      const before = await saveEditor(page, id), revision = (await state(page, id)).revision.value;
      const result = await page.locator(`#${id}`).evaluate((element, action) => element.execute(action), action);
      assert.equal(result.ok, true, JSON.stringify({ action, result }));
      assert.equal((await state(page, id)).revision.value, revision + 1);
      const saved = await saveEditor(page, id);
      assert.deepEqual(unrelatedDocument(saved), unrelatedDocument(initial));
      for (const [name, value] of Object.entries(parts(initial))) if (name !== 'word/document.xml') assert.deepEqual(parts(saved)[name], value, name);
      if (action.type !== 'delete-image') assert.deepEqual([images(saved)[0].innerWidth, images(saved)[0].innerHeight], originalInner);
      assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('undo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('redo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
      if (action.type !== 'delete-image') {
        const reopened = 'image-sequence-reopen';
        assert.equal((await page.evaluate(async ({ reopened, saved }) => {
          const element = document.createElement('lr-docx-editor'); element.id = reopened; document.querySelector('#fixture').append(element);
          return element.open(Uint8Array.from(saved));
        }, { reopened, saved })).ok, true);
        assert.equal((await page.locator(`#${reopened}`).evaluate(element => element.selectImage('next'))).ok, true);
        await page.waitForFunction(id => document.getElementById(id).can({ type: 'delete-image' }).enabled, reopened);
        const unchanged = await page.locator(`#${reopened}`).evaluate(element => {
          const before = element.snapshot(), dimensions = before.image;
          const result = element.execute({ type: 'resize-image', ...dimensions });
          return { result, before, after: element.snapshot() };
        });
        assert.equal(unchanged.result.ok, true, JSON.stringify(unchanged.result));
        assert.deepEqual(unchanged.after, unchanged.before);
        assert.deepEqual(parts(await saveEditor(page, reopened)), parts(saved)); await remove(page, reopened);
      }
    }
    await remove(page, id);
  });
  await check('near-admission-limit package preserves opaque bytes at escaped metadata limits and reopens', async () => {
    const id = 'image-near-limit', source = await createEditor(page, id, 'image-near-limit');
    assert.ok(source.length > 3.9 * 1024 * 1024 && source.length < 4 * 1024 * 1024);
    await select(page, id);
    const action = { type: 'image-description', title: '🙂'.repeat(128), description: '&'.repeat(2048) };
    const result = await page.locator(`#${id}`).evaluate((element, action) => element.execute(action), action);
    assert.equal(result.ok, true, JSON.stringify(result));
    const saved = await saveEditor(page, id);
    assert.deepEqual([images(saved)[0].title, images(saved)[0].description], [action.title, action.description]);
    const digest = bytes => createHash('sha256').update(unzipSync(Uint8Array.from(bytes))['custom/payload.bin']).digest('hex');
    assert.equal(digest(saved), digest(source));
    await remove(page, id);
    const reopened = await page.evaluate(async ({ id, saved }) => {
      const element = document.createElement('lr-docx-editor'); element.id = id; document.querySelector('#fixture').append(element);
      return element.open(Uint8Array.from(saved));
    }, { id, saved });
    assert.equal(reopened.ok, true, JSON.stringify(reopened)); await select(page, id);
    assert.deepEqual(await page.locator(`#${id}`).evaluate(element => element.imageDescription()), { ok: true, value: { title: action.title, description: action.description } });
    await remove(page, id);
  });
  for (const kind of ['image-picture-lock', 'image-frame-lock', 'image-crop', 'image-rotation', 'image-long-metadata']) {
    await check(`selected image ${kind} refusal preserves bytes/revision/history`, async () => {
      const id = 'image-refusal'; await createEditor(page, id, kind); await select(page, id);
      const before = await saveEditor(page, id), initial = await state(page, id);
      const result = await page.locator(`#${id}`).evaluate(element => element.execute({ type: 'delete-image' }));
      assert.deepEqual(result, { ok: false, code: kind === 'image-long-metadata' ? 'resource-limit' : 'unsupported' });
      assert.deepEqual(await state(page, id), initial); assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
    });
  }
  for (const kind of ['image-offscreen', 'image-offscreen-inline']) {
    await check(`explicit image navigation reveals ${kind} without editing or DOM targeting`, async () => {
      const id = 'image-offscreen'; await createEditor(page, id, kind);
      if (kind === 'image-offscreen-inline') await page.locator(`#${id}`).evaluate(element => element.style.setProperty('--lr-docx-editor-document-max-block-size', '12rem'));
      const pictures = page.locator(`#${id} .docx-pages img`);
      const initialRect = await pictures.count() ? await pictures.first().boundingBox() : null;
      const viewport = await page.locator(`#${id} [data-lr-docx-viewport]`).boundingBox();
      assert.ok(!initialRect || initialRect.y >= Math.min(page.viewportSize().height, viewport.y + viewport.height) || initialRect.y + initialRect.height <= viewport.y, 'target starts outside the document viewport');
      const before = await saveEditor(page, id), initial = await state(page, id);
      const result = await page.locator(`#${id}`).evaluate(element => element.selectImage('next'));
      assert.equal(result.ok, true, JSON.stringify(result));
      const after = await state(page, id);
      assert.deepEqual(after.image, { widthPoints: 120, heightPoints: 60 });
      assert.deepEqual(after.revision, initial.revision); assert.equal(after.dirty, initial.dirty);
      assert.equal(after.undo, initial.undo); assert.equal(after.redo, initial.redo);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      const rect = await page.locator(`#${id} .docx-pages img`).first().boundingBox();
      const revealedViewport = await page.locator(`#${id} [data-lr-docx-viewport]`).boundingBox();
      assert.ok(rect && rect.y < Math.min(page.viewportSize().height, revealedViewport.y + revealedViewport.height) && rect.y + rect.height > Math.max(0, revealedViewport.y), 'selected offscreen picture is revealed to the keyboard user');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await saveEditor(page, id);
      const stable = await page.locator(`#${id} .docx-pages img`).first().boundingBox();
      const stableViewport = await page.locator(`#${id} [data-lr-docx-viewport]`).boundingBox();
      assert.ok(stable && Math.abs(stable.width - rect.width) < 0.01 && Math.abs(stable.height - rect.height) < 0.01, 'native paint and save preserve the rendered image scale');
      assert.ok(stable.y < Math.min(page.viewportSize().height, stableViewport.y + stableViewport.height) && stable.y + stable.height > Math.max(0, stableViewport.y), 'native paint and save preserve the revealed position');
      await remove(page, id);
    });
  }
  await check('direct sessions inherit document scroll allocation and reveal the exact image without changing their host', async () => {
    await page.evaluate(async () => {
      const mount = document.createElement('div'); mount.id = 'image-navigation-session';
      mount.style.cssText = '--lr-docx-editor-document-max-block-size:360px;inline-size:640px;max-inline-size:100%';
      mount.className = 'document-host';
      document.querySelector('#fixture').append(mount);
      const factory = await window.__docxTest.sessionFactory(), created = factory({ mount });
      if (!created.ok) throw Error(created.code);
      window.__imageNavigationSession = created.value;
      const opened = await created.value.open({ kind: 'docx', bytes: await window.__docxTest.fixture('image-offscreen') });
      if (!opened.ok) throw Error(opened.code);
    });
    const before = await page.evaluate(async () => {
      const session = window.__imageNavigationSession, saved = await session.save();
      if (!saved.ok) throw Error(saved.code);
      const mount = document.getElementById('image-navigation-session'), viewport = mount.querySelector('[data-lr-docx-viewport]');
      const image = viewport.querySelector('img')?.getBoundingClientRect(), box = viewport.getBoundingClientRect();
      return { snapshot: session.snapshot(), bytes: [...saved.value.bytes], host: mount.getAttribute('style'),
        offscreen: !image || image.top >= box.bottom || image.bottom <= box.top };
    });
    assert.equal(before.offscreen, true, 'the direct-session target starts outside its custom viewport');
    const result = await page.evaluate(() => window.__imageNavigationSession.selectImage('next'));
    assert.equal(result.ok, true, JSON.stringify(result));
    const after = await page.evaluate(async () => {
      const session = window.__imageNavigationSession, saved = await session.save();
      if (!saved.ok) throw Error(saved.code);
      const mount = document.getElementById('image-navigation-session'), surface = mount.querySelector('[data-lr-docx-viewport]');
      const image = surface.querySelector('img').getBoundingClientRect(), viewport = surface.getBoundingClientRect();
      return { snapshot: session.snapshot(), bytes: [...saved.value.bytes], host: mount.getAttribute('style'),
        hostClass: mount.className, maxBlockSize: getComputedStyle(surface).maxBlockSize, height: surface.clientHeight, scrollTop: surface.scrollTop,
        visible: image.top < viewport.bottom && image.bottom > viewport.top && image.top < innerHeight && image.bottom > 0 };
    });
    assert.equal(after.maxBlockSize, '360px'); assert.ok(after.height <= 360 && after.height > 0);
    assert.ok(after.scrollTop > 0); assert.equal(after.visible, true);
    assert.equal(after.host, before.host); assert.equal(after.hostClass, 'document-host');
    assert.deepEqual(after.snapshot.image, { widthPoints: 120, heightPoints: 60 });
    assert.deepEqual(after.snapshot.revision, before.snapshot.revision); assert.equal(after.snapshot.dirty, before.snapshot.dirty);
    assert.deepEqual(after.snapshot.commands.undo, before.snapshot.commands.undo); assert.deepEqual(after.snapshot.commands.redo, before.snapshot.commands.redo);
    assert.deepEqual(parts(after.bytes), parts(before.bytes));
    const remaining = await page.evaluate(() => {
      window.__imageNavigationSession.destroy(); delete window.__imageNavigationSession;
      const mount = document.getElementById('image-navigation-session'), contents = mount.textContent; mount.remove(); return contents;
    });
    assert.equal(remaining, '');
  });
  await check('ambiguous image line boundary refuses navigation before changing the original selected picture', async () => {
    const id = 'image-boundary'; await createEditor(page, id, 'image-line-boundary');
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.selectImage('previous'))).ok, true);
    await page.waitForFunction(id => document.getElementById(id).can({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }).enabled, id);
    const before = await state(page, id), bytes = await saveEditor(page, id);
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    assert.deepEqual(await page.locator(`#${id}`).evaluate(element => element.selectImage('next')), { ok: false, code: 'unsupported' });
    assert.deepEqual(await state(page, id), before);
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.imageDescription())).value.title, 'Title 2');
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }))).ok, true, 'original actual image intent still supports an unchanged operation');
    assert.deepEqual(await state(page, id), before); assert.deepEqual(parts(await saveEditor(page, id)), parts(bytes));
    await remove(page, id);
  });
  await check('native A to B to A invalidates an authentic facade selection lease without retargeting', async () => {
    await page.evaluate(async () => {
      const mount = document.createElement('div'); mount.id = 'image-lease'; mount.style.cssText = 'height:700px;overflow:auto'; document.querySelector('#fixture').append(mount);
      const factory = await window.__docxTest.sessionFactory(), created = factory({ mount });
      if (!created.ok) throw Error(created.code);
      window.__imageLeaseSession = created.value;
      const opened = await created.value.open({ kind: 'docx', bytes: await window.__docxTest.fixture('image-simple') });
      if (!opened.ok) throw Error(opened.code);
    });
    const nativeImages = page.locator('#image-lease img'); await nativeImages.first().click();
    const original = await page.evaluate(() => {
      const session = window.__imageLeaseSession, retained = session.retainSelection();
      if (!retained.ok) throw Error(retained.code);
      window.__imageLease = retained.value; return session.snapshot();
    });
    await nativeImages.nth(1).click(); await nativeImages.first().click();
    const result = await page.evaluate(() => {
      const session = window.__imageLeaseSession, before = session.snapshot();
      const refused = session.execute({ type: 'delete-image' }, { selection: window.__imageLease });
      return { refused, before, after: session.snapshot() };
    });
    assert.deepEqual(result.refused, { ok: false, code: 'stale-selection' });
    assert.deepEqual(result.after, result.before); assert.deepEqual(result.after.revision, original.revision);
    assert.ok(result.after.selection.version > original.selection.version);
    await page.evaluate(() => { window.__imageLease.release(); window.__imageLeaseSession.destroy(); delete window.__imageLease; delete window.__imageLeaseSession; document.getElementById('image-lease').remove(); });
  });
  await check('cached image reads during synthetic queued native input do not settle or mutate the drawing', async () => {
    const id = 'image-queued'; await createEditor(page, id, 'image-simple'); await select(page, id);
    const observation = await page.locator(`#${id}`).evaluate(element => {
      const before = element.snapshot(), target = element.ownerDocument.activeElement;
      target.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'Queued image test', bubbles: true, cancelable: true, composed: true }));
      const queued = element.snapshot();
      const description = element.imageDescription(), can = element.can({ type: 'delete-image' });
      const afterReads = element.snapshot();
      const result = element.execute({ type: 'image-description', title: 'must not change', description: '' });
      return { before, queued, afterReads, description, can, result, after: element.snapshot() };
    });
    assert.deepEqual(observation.queued.revision, observation.before.revision); assert.deepEqual(observation.afterReads, observation.queued);
    assert.deepEqual(observation.description, { ok: false, code: 'busy' }); assert.deepEqual(observation.can, { enabled: false, reason: 'busy' });
    assert.equal(observation.result.ok, false); assert.equal(observation.after.revision.value, observation.before.revision.value + 1);
    const saved = await saveEditor(page, id); assert.equal(images(saved)[0].title, 'Title 1'); assert.match(zipEntry(saved, 'word/document.xml'), /Queued image test/);
    await remove(page, id);
  });
}
