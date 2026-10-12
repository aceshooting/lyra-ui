import assert from 'node:assert/strict';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { zipParts } from './lib/harness.mjs';
import { wordText } from '../test/xml.mjs';
import { zipEntry } from '../test/zip.mjs';

async function report(page, id) {
  const result = await page.locator(`#${id}`).evaluate(element => element.review());
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.value;
}
async function act(page, id, action, expectedRevision) {
  return page.locator(`#${id}`).evaluate((element, { action, expectedRevision }) => {
    const before = element.snapshot().revision, can = element.can(action);
    const result = element.execute(action, expectedRevision ? { expectedRevision } : {});
    return { before, after: element.snapshot().revision, can, result };
  }, { action, expectedRevision });
}
const remove = (page, id) => page.locator(`#${id}`).evaluate(element => element.remove());

/** Browser integration through public editor/session APIs and saved OOXML. */
export async function runReview(page, check, { createEditor, saveEditor }) {
  await check('review accepts and rejects plain body revisions, invalidates identifiers and round trips undo', async () => {
    const id = 'review-decisions'; await createEditor(page, id, 'review');
    try {
      const initial = await report(page, id), before = await saveEditor(page, id);
      assert.equal(initial.truncated, false); assert.equal(initial.trackingSupported, true);
      assert.deepEqual(initial.items.map(item => item.kind).sort(), ['comment', 'delete', 'insert']);
      const insertion = initial.items.find(item => item.kind === 'insert');
      const accepted = await act(page, id, { type: 'review-decision', id: insertion.id, decision: 'accept' }, initial.revision);
      assert.equal(accepted.can.enabled, true); assert.equal(accepted.result.ok, true, JSON.stringify(accepted));
      assert.equal(accepted.after.value, accepted.before.value + 1);
      const stale = await act(page, id, { type: 'review-decision', id: insertion.id, decision: 'reject' }, initial.revision);
      assert.deepEqual(stale.result, { ok: false, code: 'stale-revision' });
      const next = await report(page, id), deletion = next.items.find(item => item.kind === 'delete');
      assert.equal(next.items.filter(item => item.kind === 'insert').length, 0);
      const rejected = await act(page, id, { type: 'review-decision', id: deletion.id, decision: 'reject' }, next.revision);
      assert.equal(rejected.result.ok, true, JSON.stringify(rejected));
      assert.equal(rejected.after.value, rejected.before.value + 1);
      const saved = await saveEditor(page, id);
      assert.ok(wordText(zipEntry(saved, 'word/document.xml')).includes('Opening suggestion and deletion'));
      assert.equal((await report(page, id)).items.filter(item => item.kind !== 'comment').length, 0);
      for (let index = 0; index < 2; index++) assert.equal((await act(page, id, 'undo')).result.ok, true);
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before));
      for (let index = 0; index < 2; index++) assert.equal((await act(page, id, 'redo')).result.ok, true);
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(saved));
      assert.equal((await page.locator(`#${id}`).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved)).ok, true);
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(saved));
      assert.equal((await report(page, id)).items.length, 1);
    } finally { await remove(page, id); }
  });

  await check('comments add, reply, resolve and reopen using explicit authors and literal text', async () => {
    const id = 'review-comments'; await createEditor(page, id);
    try {
      await page.locator(`#${id} .docx-pages`).click(); await page.keyboard.insertText('Discuss these words.');
      await page.locator(`#${id} .docx-pages`).getByText('Discuss these words.', { exact: true }).click();
      await page.keyboard.press('Home'); await page.keyboard.press('Shift+End');
      const added = await act(page, id, { type: 'add-comment', author: 'Writer', text: '<img src=x onerror=alert(1)> & discuss' });
      assert.equal(added.can.enabled, true); assert.equal(added.result.ok, true, JSON.stringify(added));
      assert.equal(added.after.value, added.before.value + 1);
      let current = await report(page, id), root = current.items.find(item => item.kind === 'comment' && !item.parentId);
      assert.equal(root.text, '<img src=x onerror=alert(1)> & discuss'); assert.equal(root.author, 'Writer');
      assert.equal((await act(page, id, { type: 'reply-comment', id: root.id, author: 'Responder', text: 'A reply.' }, current.revision)).result.ok, true);
      current = await report(page, id); root = current.items.find(item => item.kind === 'comment' && !item.parentId);
      const reply = current.items.find(item => item.parentId === root.id);
      assert.equal(reply.text, 'A reply.'); assert.equal(reply.author, 'Responder'); assert.equal(reply.orphaned, false);
      assert.equal((await act(page, id, { type: 'review-decision', id: root.id, decision: 'resolve' }, current.revision)).result.ok, true);
      current = await report(page, id); root = current.items.find(item => !item.parentId);
      assert.equal(root.resolved, true);
      assert.equal((await act(page, id, { type: 'review-decision', id: root.id, decision: 'reopen' }, current.revision)).result.ok, true);
      const saved = await saveEditor(page, id);
      assert.equal((await page.locator(`#${id}`).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved)).ok, true);
      current = await report(page, id); root = current.items.find(item => !item.parentId);
      assert.equal(root.resolved, false); assert.equal(current.items.filter(item => item.parentId === root.id).length, 1);
      assert.equal(wordText(zipEntry(saved, 'word/document.xml')), 'Discuss these words.');
      assert.equal(await page.locator(`#${id} img[src="x"]`).count(), 0);
    } finally { await remove(page, id); }
  });

  await check('tracking state is truthful, requires an author and records ordinary inserted text', async () => {
    const id = 'review-tracking'; await createEditor(page, id);
    try {
      await page.locator(`#${id} .docx-pages`).click(); await page.keyboard.insertText('Start');
      // Native text input settles asynchronously before document queries become available.
      await page.waitForFunction(id => document.getElementById(id).can({ type: 'track-changes', enabled: true, author: 'Named writer' }).enabled, id);
      const initial = await report(page, id); assert.equal(initial.enabled, false); assert.equal(initial.trackingSupported, true);
      assert.deepEqual((await act(page, id, { type: 'track-changes', enabled: true, author: '' })).result, { ok: false, code: 'invalid-option' });
      const enabled = await act(page, id, { type: 'track-changes', enabled: true, author: 'Named writer' });
      assert.equal(enabled.result.ok, true, JSON.stringify(enabled)); assert.deepEqual(enabled.after, enabled.before);
      const tracking = await report(page, id); assert.equal(tracking.enabled, true); assert.equal(tracking.author, 'Named writer');
      await page.locator(`#${id} .docx-pages`).click(); await page.keyboard.press('ControlOrMeta+End');
      await page.keyboard.insertText(' suggested');
      await page.waitForFunction(id => document.getElementById(id).can({ type: 'track-changes', enabled: true, author: 'Named writer' }).enabled, id);
      const changed = await report(page, id), insertion = changed.items.find(item => item.kind === 'insert');
      assert.ok(insertion); assert.equal(insertion.author, 'Named writer'); assert.ok(insertion.text.includes('suggested'));
      const disabled = await act(page, id, { type: 'track-changes', enabled: false, author: 'Named writer' });
      assert.equal(disabled.result.ok, true); assert.deepEqual(disabled.after, disabled.before);
      assert.equal((await report(page, id)).enabled, false);
      const saved = await saveEditor(page, id);
      assert.equal((await page.locator(`#${id}`).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved)).ok, true);
      assert.ok((await report(page, id)).items.some(item => item.kind === 'insert' && item.author === 'Named writer'));
    } finally { await remove(page, id); }
  });

  await check('unsupported revision structures and readonly documents refuse decisions without changing bytes', async () => {
    const source = [...await page.evaluate(() => window.__docxTest.fixture('review'))];
    const entries = unzipSync(Uint8Array.from(source));
    entries['word/document.xml'] = strToU8(strFromU8(entries['word/document.xml']).replace('<w:ins w:id="1"', '<w:hyperlink><w:ins w:id="1"').replace('</w:ins>', '</w:ins></w:hyperlink>'));
    for (const readOnly of [false, true]) {
      const id = 'review-refusals', bytes = readOnly ? source : [...zipSync(entries)];
      assert.equal(await page.evaluate(async ({ id, bytes, readOnly }) => {
        const element = document.createElement('lr-docx-editor'); element.id = id; element.readOnly = readOnly;
        document.querySelector('#fixture').append(element); return (await element.open(Uint8Array.from(bytes))).ok;
      }, { id, bytes, readOnly }), true);
      try {
        const before = await saveEditor(page, id), current = await report(page, id);
        const item = current.items.find(item => item.kind === (readOnly ? 'insert' : 'unsupported'));
        assert.ok(item);
        if (!readOnly) { assert.equal(item.readOnly, true); assert.equal(current.hasUnsupported, true); assert.equal(current.trackingSupported, false); }
        for (const action of [{ type: 'review-decision', id: item.id, decision: 'accept' }, { type: 'track-changes', enabled: true, author: 'Writer' }]) {
          const refused = await act(page, id, action, current.revision);
          assert.equal(refused.can.enabled, false); assert.deepEqual(refused.result, { ok: false, code: readOnly ? 'read-only' : 'unsupported' });
          assert.deepEqual(refused.after, refused.before);
        }
        assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before));
      } finally { await remove(page, id); }
    }
  });

  await check('public session navigates comments without edits and protects retained comment selection', async () => {
    const id = 'review-session';
    const opened = await page.evaluate(async id => {
      const mount = document.createElement('div'); mount.id = id; document.querySelector('#fixture').append(mount);
      const button = document.createElement('button'); button.id = `${id}-toolbar`; button.textContent = 'Comment'; document.querySelector('#fixture').append(button);
      const create = await window.__docxTest.sessionFactory(), created = create({ mount });
      if (!created.ok) return created; window.__reviewSession = created.value;
      return created.value.open({ kind: 'docx', bytes: await window.__docxTest.fixture('review') });
    }, id);
    assert.equal(opened.ok, true);
    try {
      const navigation = await page.evaluate(() => {
        const session = window.__reviewSession, report = session.review(); if (!report.ok) return { report };
        const before = session.snapshot().revision;
        const selected = session.selectReviewItem(report.value.items.find(item => item.kind === 'comment').id, { expectedRevision: report.value.revision });
        return { selected, before, after: session.snapshot().revision };
      });
      assert.equal(navigation.selected.ok, true); assert.deepEqual(navigation.after, navigation.before);
      await page.locator(`#${id} .docx-pages`).getByText('Discuss this paragraph.', { exact: true }).click();
      await page.keyboard.press('Home'); await page.keyboard.press('Shift+End');
      assert.equal(await page.evaluate(() => {
        const retained = window.__reviewSession.retainSelection(); if (retained.ok) window.__reviewLease = retained.value;
        return retained.ok;
      }), true);
      await page.locator(`#${id}-toolbar`).click();
      const added = await page.evaluate(() => window.__reviewSession.execute({ type: 'add-comment', author: 'Session writer', text: 'Anchored through toolbar.' }, { selection: window.__reviewLease }));
      assert.equal(added.ok, true, JSON.stringify(added));
      const stale = await page.evaluate(() => window.__reviewSession.execute({ type: 'add-comment', author: 'Session writer', text: 'Must not be added.' }, { selection: window.__reviewLease }));
      assert.equal(stale.ok, false); assert.equal(stale.code, 'stale-selection');
      const text = await page.evaluate(() => window.__reviewSession.review().value.items.map(item => item.text));
      assert.ok(text.includes('Anchored through toolbar.')); assert.equal(text.includes('Must not be added.'), false);
    } finally {
      await page.evaluate(id => { window.__reviewLease?.release(); window.__reviewSession?.destroy(); delete window.__reviewLease; delete window.__reviewSession;
        document.getElementById(id)?.remove(); document.getElementById(`${id}-toolbar`)?.remove(); }, id);
    }
  });
}
