import assert from 'node:assert/strict';
import { zipEntry } from '../test/zip.mjs';
import { zipParts as parts } from './lib/harness.mjs';

const host = (page, id) => page.locator(`#${id}`);
const remove = (page, id) => host(page, id).evaluate(element => element.remove());
async function insertionReady(page, id = null) {
  await page.waitForFunction(id => {
    const session = id ? document.getElementById(id) : window.__insertionSession;
    const state = session.snapshot();
    return state.status === 'ready' && state.activity === null && state.commands.undo.enabled &&
      state.commands.redo.reason !== 'busy' && session.canInsertImage().enabled;
  }, id);
}
async function plain(page, id, createEditor) {
  await createEditor(page, id);
  await page.locator(`#${id} .docx-pages`).click();
  await page.keyboard.type('alpha'); await page.keyboard.press('Enter');
  await page.keyboard.type('beta'); await page.keyboard.press('Enter'); await page.keyboard.type('gamma');
  await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
  await insertionReady(page, id);
}
export async function runImageInsertion(page, check, { createEditor, saveEditor }) {
  await page.evaluate(() => document.querySelector('#fixture').replaceChildren());
  for (const kind of ['png', 'jpeg', 'gif']) await check(`public ${kind} insertion copies bytes and commits exactly one history unit with metadata and reopen`, async () => {
    const id = `insert-api-${kind}`; await plain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await host(page, id).evaluate(element => element.snapshot());
    const observation = await host(page, id).evaluate(async (element, kind) => {
      const bytes = await window.__docxTest.imageBytes(kind), original = [...bytes];
      const source = { bytes, widthPoints: 48, heightPoints: 24, title: 'Picture & "quoted" 😀', description: 'First\nSecond\tCafé 東京' };
      const pending = element.insertImage(source), active = element.snapshot(); bytes.fill(0); source.widthPoints = 99;
      const busy = { save: await element.save(), execute: element.execute('bold'), navigation: element.selectImage('next'), can: element.canInsertImage() };
      const result = await pending; return { result, active, busy, original, after: element.snapshot() };
    }, kind);
    assert.equal(observation.active.activity, 'inserting-image'); assert.deepEqual(observation.active.revision, initial.revision);
    for (const key of ['save', 'execute', 'navigation']) assert.deepEqual(observation.busy[key], { ok: false, code: 'busy' }, key);
    assert.deepEqual(observation.busy.can, { enabled: false, reason: 'busy' });
    assert.equal(observation.result.ok, true, JSON.stringify(observation.result));
    assert.equal(observation.after.revision.value, initial.revision.value + 1); assert.equal(observation.after.activity, null);
    const saved = await saveEditor(page, id), savedParts = parts(saved), xml = zipEntry(saved, 'word/document.xml');
    assert.match(xml, /cx="609600"/u); assert.match(xml, /cy="304800"/u); assert.match(xml, /Picture &amp; &quot;quoted&quot; 😀/u);
    const media = Object.keys(savedParts).filter(name => name.startsWith('word/media/')); assert.equal(media.length, 1);
    assert.deepEqual(savedParts[media[0]], observation.original);
    for (const [name, value] of Object.entries(parts(before))) if (!['word/document.xml', 'word/_rels/document.xml.rels', '[Content_Types].xml'].includes(name)) assert.deepEqual(savedParts[name], value, name);
    assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    assert.equal((await host(page, id).evaluate(element => element.execute('redo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), savedParts);
    const reopened = await host(page, id).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved); assert.equal(reopened.ok, true);
    assert.equal((await host(page, id).evaluate(element => element.selectImage('next'))).ok, true);
    const description = await host(page, id).evaluate(element => element.imageDescription());
    assert.deepEqual(description, { ok: true, value: { title: 'Picture & "quoted" 😀', description: 'First\nSecond\tCafé 東京' } });
    await remove(page, id);
  });
  await check('public insertion refuses malformed input, aborted work and unsupported packages without history or ZIP changes', async () => {
    const id = 'insert-api-refusal'; await plain(page, id, createEditor);
    const before = await saveEditor(page, id), initial = await host(page, id).evaluate(element => element.snapshot());
    const refusals = await host(page, id).evaluate(async element => {
      const bytes = await window.__docxTest.imageBytes('png'), source = { bytes, widthPoints: 48, heightPoints: 24 };
      const invalid = await element.insertImage({ ...source, description: 'carriage\rreturn' });
      const controller = new AbortController(); const pending = element.insertImage(source, { signal: controller.signal }); controller.abort();
      return { invalid, aborted: await pending, snapshot: element.snapshot() };
    });
    assert.deepEqual(refusals.invalid, { ok: false, code: 'invalid-option' }); assert.deepEqual(refusals.aborted, { ok: false, code: 'aborted' });
    assert.deepEqual(refusals.snapshot.revision, initial.revision); assert.equal(refusals.snapshot.dirty, initial.dirty);
    assert.deepEqual(refusals.snapshot.commands.undo, initial.commands.undo); assert.deepEqual(refusals.snapshot.commands.redo, initial.commands.redo);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
    await createEditor(page, id, 'table-simple'); await page.locator(`#${id} .docx-pages`).getByText('Before', { exact: true }).click();
    const tableBefore = await saveEditor(page, id), tableInitial = await host(page, id).evaluate(element => element.snapshot());
    const result = await host(page, id).evaluate(async element => element.insertImage({ bytes: await window.__docxTest.imageBytes('png'), widthPoints: 48, heightPoints: 24 }));
    assert.deepEqual(result, { ok: false, code: 'unsupported' });
    const tableAfter = await host(page, id).evaluate(element => element.snapshot());
    assert.deepEqual(tableAfter.revision, tableInitial.revision); assert.equal(tableAfter.dirty, tableInitial.dirty);
    assert.deepEqual(tableAfter.commands.undo, tableInitial.commands.undo); assert.deepEqual(tableAfter.commands.redo, tableInitial.commands.redo);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(tableBefore)); await remove(page, id);
  });
  for (const terminal of ['destroy', 'replace', 'abort']) await check(`committed insertion survives synchronous ${terminal} from its change subscriber`, async () => {
    const id = `insert-commit-${terminal}`; await plain(page, id, createEditor); await saveEditor(page, id);
    const observed = await host(page, id).evaluate(async (element, terminal) => {
      const initial = element.snapshot(), controller = new AbortController(); let changes = 0, replacement;
      const listener = event => {
        if (event.target !== element || event.detail.snapshot?.revision.value !== initial.revision.value + 1) return;
        changes++; element.removeEventListener('lr-change', listener);
        if (terminal === 'abort') controller.abort();
        else {
          element.remove();
          if (terminal === 'replace') {
            const next = document.createElement('lr-docx-editor'); next.id = element.id; document.querySelector('#fixture').append(next);
            replacement = next.newDocument();
          }
        }
      };
      element.addEventListener('lr-change', listener);
      const result = await element.insertImage({ bytes: await window.__docxTest.imageBytes('png'), widthPoints: 48, heightPoints: 24 }, { signal: controller.signal });
      if (replacement) await replacement;
      return { result, initial, changes, current: document.getElementById(element.id)?.snapshot() ?? null };
    }, terminal);
    assert.equal(observed.result.ok, true, JSON.stringify(observed)); assert.equal(observed.changes, 1);
    assert.deepEqual(observed.result.value, { ...observed.initial.revision, value: observed.initial.revision.value + 1 });
    if (terminal === 'replace') { assert.notEqual(observed.current.revision.documentId, observed.initial.revision.documentId); assert.equal(observed.current.revision.value, 0); }
    if (terminal !== 'destroy') await remove(page, id);
  });
  await check('APP1 camera metadata is stripped on insertion and repeated insertion keeps original paragraph text and media', async () => {
    const id = 'insert-repeat'; await plain(page, id, createEditor); const before = await saveEditor(page, id);
    const inserted = await host(page, id).evaluate(async element => {
      const jpeg = await window.__docxTest.imageBytes('jpeg'), bytes = new Uint8Array(jpeg.length + 6);
      bytes.set(jpeg.subarray(0, 2)); bytes.set([255, 225, 0, 4, 1, 2], 2); bytes.set(jpeg.subarray(2), 8);
      return element.insertImage({ bytes, widthPoints: 48, heightPoints: 24 });
    });
    assert.equal(inserted.ok, true, JSON.stringify(inserted));
    const withPhoto = parts(await saveEditor(page, id));
    const media = Object.entries(withPhoto).filter(([name]) => name.startsWith('word/media/') && !(name in parts(before)));
    assert.equal(media.length, 1);
    assert.equal(Buffer.from(media[0][1]).includes(Buffer.from([255, 225])), false, 'EXIF/XMP segment removed');
    assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    for (const text of ['beta', 'alpha']) {
      await page.locator(`#${id} .docx-pages`).getByText(text, { exact: true }).click();
      await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
      const result = await host(page, id).evaluate(async element => element.insertImage({ bytes: await window.__docxTest.imageBytes('png'), widthPoints: 48, heightPoints: 24 }));
      assert.equal(result.ok, true, JSON.stringify(result));
    }
    const saved = await saveEditor(page, id); assert.equal((zipEntry(saved, 'word/document.xml').match(/<w:drawing[ >]/gu) ?? []).length, 2);
    assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.equal((await host(page, id).evaluate(element => element.execute('undo'))).ok, true);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before)); await remove(page, id);
  });
  await check('public insertion preserves maximum metadata and independent point boundaries through reopen', async () => {
    const id = 'insert-boundaries'; await plain(page, id, createEditor);
    const title = '&"<>'.repeat(64), description = 'x'.repeat(2040) + '\n\t&"<>😀';
    assert.equal(title.length, 256); assert.equal(description.length, 2048);
    const result = await host(page, id).evaluate(async (element, metadata) => element.insertImage({
      bytes: await window.__docxTest.imageBytes('png'), widthPoints: 1, heightPoints: 1440, ...metadata
    }), { title, description }); assert.equal(result.ok, true, JSON.stringify(result));
    const saved = await saveEditor(page, id), xml = zipEntry(saved, 'word/document.xml');
    assert.match(xml, /cx="12700"/u); assert.match(xml, /cy="18288000"/u);
    assert.equal((await host(page, id).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved)).ok, true);
    assert.equal((await host(page, id).evaluate(element => element.selectImage('next'))).ok, true);
    assert.deepEqual(await host(page, id).evaluate(element => element.imageDescription()), { ok: true, value: { title, description } });
    await remove(page, id);
  });
  await check('native caret A to B to A and released leases refuse insertion without retargeting', async () => {
    await page.evaluate(async () => {
      const mount = document.createElement('div'); mount.id = 'insert-lease'; document.querySelector('#fixture').append(mount);
      const made = (await window.__docxTest.sessionFactory())({ mount }); if (!made.ok) throw new Error(made.code);
      window.__insertionSession = made.value; const opened = await made.value.open({ kind: 'blank' }); if (!opened.ok) throw new Error(opened.code);
    });
    const pages = page.locator('#insert-lease .docx-pages'); await pages.click();
    await page.keyboard.type('alpha'); await page.keyboard.press('Enter'); await page.keyboard.type('beta');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    await insertionReady(page);
    const before = await page.evaluate(async () => {
      const session = window.__insertionSession, saved = await session.save(); if (!saved.ok) throw new Error(saved.code);
      const lease = session.retainSelection(); if (!lease.ok) throw new Error(lease.code); window.__insertionLease = lease.value;
      return { bytes: [...saved.value.bytes], snapshot: session.snapshot() };
    });
    for (const text of ['alpha', 'beta']) { await pages.getByText(text, { exact: true }).click(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); }
    const after = await page.evaluate(async () => {
      const session = window.__insertionSession, source = { bytes: await window.__docxTest.imageBytes('png'), widthPoints: 48, heightPoints: 24 };
      const aba = await session.insertImage(source, { selection: window.__insertionLease });
      const retained = session.retainSelection(); if (!retained.ok) throw new Error(retained.code); retained.value.release();
      const released = await session.insertImage(source, { selection: retained.value });
      const staleRevision = await session.insertImage(source, { expectedRevision: { ...session.snapshot().revision, value: session.snapshot().revision.value + 1 } });
      const saved = await session.save(); if (!saved.ok) throw new Error(saved.code);
      return { aba, released, staleRevision, bytes: [...saved.value.bytes] };
    });
    await insertionReady(page);
    after.snapshot = await page.evaluate(() => {
      const session = window.__insertionSession, snapshot = session.snapshot();
      session.destroy(); document.getElementById('insert-lease').remove();
      delete window.__insertionLease; delete window.__insertionSession; return snapshot;
    });
    assert.deepEqual(after.aba, { ok: false, code: 'stale-selection' }); assert.deepEqual(after.released, { ok: false, code: 'stale-selection' });
    assert.deepEqual(after.staleRevision, { ok: false, code: 'stale-revision' });
    assert.deepEqual(after.snapshot.revision, before.snapshot.revision); assert.equal(after.snapshot.dirty, before.snapshot.dirty);
    assert(after.snapshot.selection.version > before.snapshot.selection.version);
    assert.deepEqual(after.snapshot.commands.undo, before.snapshot.commands.undo); assert.deepEqual(after.snapshot.commands.redo, before.snapshot.commands.redo);
    assert.deepEqual(parts(after.bytes), parts(before.bytes));
  });
  for (const mutation of ['remove-reinsert', 'adopt', 'overridden-accessors']) await check(`direct insertion mount ownership handles ${mutation} through the async boundary`, async () => {
    await page.evaluate(async () => {
      document.querySelector('#fixture').replaceChildren();
      const mount = document.createElement('div'); mount.id = 'insert-direct'; document.querySelector('#fixture').append(mount);
      const created = (await window.__docxTest.sessionFactory())({ mount }); if (!created.ok) throw new Error(created.code);
      window.__insertionSession = created.value; const opened = await created.value.open({ kind: 'blank' }); if (!opened.ok) throw new Error(opened.code);
    });
    await page.locator('#insert-direct .docx-pages').click(); await page.keyboard.type('alpha'); await page.keyboard.press('ArrowLeft');
    const observed = await page.evaluate(async mutation => {
      const session = window.__insertionSession, mount = document.getElementById('insert-direct'), reads = []; let reflectionReads = -1;
      if (mutation === 'overridden-accessors') for (const key of ['isConnected', 'ownerDocument', 'parentNode']) Object.defineProperty(mount, key, { configurable: true, get() { reads.push({ key, stack: new Error().stack }); throw new Error('author accessor'); } });
      const initial = session.snapshot(), bytes = await window.__docxTest.imageBytes('png');
      const source = new Proxy({ bytes, widthPoints: 48, heightPoints: 24 }, { ownKeys(target) { reflectionReads = reads.length; return Reflect.ownKeys(target); } });
      const pending = session.insertImage(source);
      if (mutation === 'remove-reinsert') { mount.remove(); document.querySelector('#fixture').append(mount); }
      if (mutation === 'adopt') document.implementation.createHTMLDocument().body.append(mount);
      const result = await pending, after = session.snapshot();
      for (const key of ['isConnected', 'ownerDocument', 'parentNode']) if (Object.hasOwn(mount, key)) delete mount[key];
      session.destroy(); mount.remove(); delete window.__insertionSession; return { result, initial, after, reads, reflectionReads };
    }, mutation);
    if (mutation === 'overridden-accessors') {
      assert.deepEqual(observed.result, { ok: true, value: { ...observed.initial.revision, value: observed.initial.revision.value + 1 } });
      assert.equal(observed.reflectionReads, 0, 'capture and original ownership checks bypass author accessors');
      assert(observed.reads.length > 0);
      for (const read of observed.reads) assert.equal(read.key, 'parentNode', read.stack);
      assert.equal(observed.after.status, 'error'); assert.deepEqual(observed.after.error, { code: 'engine-failed' });
      assert.deepEqual(observed.after.revision, observed.result.value);
    }
    else { assert.equal(observed.result.ok, false); assert.equal(observed.after.revision.value, observed.initial.revision.value); assert.equal(observed.after.status, 'destroyed'); }
  });
}
