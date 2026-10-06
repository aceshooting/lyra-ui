import assert from 'node:assert/strict';
import { SaxesParser } from 'saxes';
import { zipEntry } from '../test/zip.mjs';
import { assertNoAxeViolations, paints, toolbarTo, zipParts as parts } from './lib/harness.mjs';

function shape(bytes) {
  const parser = new SaxesParser({ xmlns: true }), tables = [], stack = [];
  parser.on('opentag', node => {
    const word = node.uri === 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    stack.push(word ? node.local : '');
    if (word && node.local === 'tbl') tables.push({ rows: [], columns: 0 });
    if (word && node.local === 'gridCol') tables.at(-1).columns++;
    if (word && node.local === 'tr') tables.at(-1).rows.push([]);
    if (word && node.local === 'tc') tables.at(-1).rows.at(-1).push('');
  });
  parser.on('text', text => { if (stack.at(-1) === 't' && stack.includes('tc')) tables.at(-1).rows.at(-1)[tables.at(-1).rows.at(-1).length - 1] += text; });
  parser.on('closetag', () => stack.pop());
  parser.write(zipEntry(bytes, 'word/document.xml')).close();
  return tables;
}
async function caret(page, id, text) {
  await page.locator(`#${id} .docx-pages`).getByText(text, { exact: true }).click();
  await page.keyboard.press('ArrowLeft');
}
async function dispose(page, id) { await page.locator(`#${id}`).evaluate(element => element.remove()); }

export async function runTableEditing(page, check, { createEditor, saveEditor, assertProtectedParts }) {
  await runTableToolbar(page, check, { createEditor, saveEditor, assertProtectedParts });
  for (const [type, where, target, expected] of [
    ['insert-table-row', 'above', 'A00', [4, 3]], ['insert-table-row', 'below', 'A22', [4, 3]],
    ['insert-table-column', 'left', 'A00', [3, 4]], ['insert-table-column', 'right', 'A22', [3, 4]],
    ['delete-table-row', null, 'A00', [2, 3]], ['delete-table-row', null, 'A22', [2, 3]],
    ['delete-table-column', null, 'A00', [3, 2]], ['delete-table-column', null, 'A22', [3, 2]],
    ['delete-table', null, 'A00', null],
  ]) {
    await check(`table ${type} ${where ?? target} commits once and round trips history/package`, async () => {
      const id = 'table-action', source = await createEditor(page, id, 'table-simple');
      await caret(page, id, target);
      const before = await saveEditor(page, id);
      const action = { type, ...(where ? { where } : {}) };
      const result = await page.locator(`#${id}`).evaluate((element, action) => {
        const revision = element.snapshot().revision;
        const result = element.execute(action, { expectedRevision: revision });
        return { result, revision, after: element.snapshot().revision, context: element.snapshot().table };
      }, action);
      assert.equal(result.result.ok, true, JSON.stringify(result));
      assert.equal(result.after.value, result.revision.value + 1);
      const saved = await saveEditor(page, id), tables = shape(saved);
      assertProtectedParts(saved, source);
      if (expected) {
        assert.deepEqual([tables[0].rows.length, tables[0].columns], expected);
        const labels = tables[0].rows.flat().filter(Boolean);
        const deleted = type === 'delete-table-row' ? (target === 'A00' ? /^A0/u : /^A2/u) : type === 'delete-table-column' ? (target === 'A00' ? /0$/u : /2$/u) : null;
        const originals = ['A00', 'A01', 'A02', 'A10', 'A11', 'A12', 'A20', 'A21', 'A22'];
        assert.deepEqual(labels, originals.filter(value => !deleted?.test(value)));
      } else assert.equal(tables.length, 0);
      assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('undo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('redo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(saved));
      await dispose(page, id);
      const reopened = await page.evaluate(async bytes => {
        const element = document.createElement('lr-docx-editor'); element.id = 'table-reopened'; document.querySelector('#fixture').append(element);
        return element.open(Uint8Array.from(bytes));
      }, saved);
      assert.equal(reopened.ok, true); assert.deepEqual(parts(await saveEditor(page, 'table-reopened')), parts(saved));
      await dispose(page, 'table-reopened');
    });
  }
  await check('insert-table uses an outside collapsed caret and validates before mutation', async () => {
    await createEditor(page, 'table-insert', 'table-simple'); await caret(page, 'table-insert', 'Before');
    const result = await page.locator('#table-insert').evaluate(element => {
      const before = element.snapshot().revision;
      const invalid = element.execute({ type: 'insert-table', rows: NaN, columns: 2 });
      const unchanged = element.snapshot().revision === before;
      const inserted = element.execute({ type: 'insert-table', rows: 2, columns: 2 });
      return { invalid, unchanged, inserted, revision: element.snapshot().revision.value };
    });
    assert.deepEqual(result.invalid, { ok: false, code: 'invalid-option' }); assert.equal(result.unchanged, true);
    assert.equal(result.inserted.ok, true, JSON.stringify(result)); assert.equal(result.revision, 1);
    assert.equal(shape(await saveEditor(page, 'table-insert')).length, 2); await dispose(page, 'table-insert');
  });
  for (const [fixture, target, action, reason] of [
    ['table-merged', 'A11', { type: 'delete-table-row' }, 'unsupported'],
    ['table-vmerge', 'A11', { type: 'delete-table' }, 'unsupported'],
    ['table-nested', 'N00', { type: 'delete-table-column' }, 'unsupported'],
    ['table-nested', 'Outer', { type: 'delete-table' }, 'unsupported'],
    ['table-simple', 'A00', { type: 'insert-table', rows: 2, columns: 2 }, 'unsupported'],
    ['table-limit', 'A00', { type: 'insert-table-row', where: 'above' }, 'resource-limit'],
  ]) {
    await check(`table refusal ${fixture} ${target} ${action.type} preserves package/revision/history`, async () => {
      await createEditor(page, 'table-refusal', fixture); await caret(page, 'table-refusal', target);
      const before = await saveEditor(page, 'table-refusal');
      const result = await page.locator('#table-refusal').evaluate((element, action) => {
        const before = element.snapshot(), available = element.can(action), result = element.execute(action);
        return { available, result, before: before.revision, after: element.snapshot().revision, undoBefore: before.commands.undo, undoAfter: element.snapshot().commands.undo };
      }, action);
      assert.deepEqual(result.result, { ok: false, code: reason }); assert.deepEqual(result.after, result.before); assert.deepEqual(result.undoBefore, result.undoAfter);
      assert.deepEqual(parts(await saveEditor(page, 'table-refusal')), parts(before)); await dispose(page, 'table-refusal');
    });
  }
  await check('alternate namespace prefix and imported over-limit simple table remain editable', async () => {
    for (const fixture of ['table-alt', 'table-overlimit']) {
      await createEditor(page, 'table-import', fixture); await caret(page, 'table-import', 'A00');
      assert.equal((await page.locator('#table-import').evaluate(element => element.execute({ type: 'delete-table-row' }))).ok, true);
      assert.equal(shape(await saveEditor(page, 'table-import'))[0].rows.length, fixture === 'table-alt' ? 2 : 20);
      await dispose(page, 'table-import');
    }
  });
  await check('queued native typing settles before stale table refusal; fresh command is one edit', async () => {
    await createEditor(page, 'table-queued', 'table-simple'); await caret(page, 'table-queued', 'A00');
    const result = await page.locator('#table-queued').evaluate(element => {
      const before = element.snapshot().revision, surface = element.querySelector('.docx-pages');
      surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'Queued', bubbles: true, cancelable: true, composed: true }));
      const afterInput = element.snapshot().revision;
      const available = element.can({ type: 'insert-table-row', where: 'below' });
      const pureRevision = element.snapshot().revision;
      const stale = element.execute({ type: 'insert-table-row', where: 'below' }, { expectedRevision: before });
      const settled = element.snapshot().revision;
      const fresh = element.execute({ type: 'insert-table-row', where: 'below' }, { expectedRevision: settled });
      return { before, afterInput, available, pureRevision, stale, settled, fresh, final: element.snapshot().revision };
    });
    assert.equal(result.available.enabled, true); assert.deepEqual(result.pureRevision, result.before, JSON.stringify(result));
    assert.deepEqual(result.stale, { ok: false, code: 'stale-revision' }); assert.equal(result.settled.value, result.before.value + 1);
    assert.equal(result.fresh.ok, true, JSON.stringify(result)); assert.equal(result.final.value, result.settled.value + 1);
    const saved = await saveEditor(page, 'table-queued'); assert.equal(shape(saved)[0].rows.length, 4);
    assert.ok(shape(saved)[0].rows.flat().some(text => text.includes('Queued'))); await dispose(page, 'table-queued');
  });
  await check('queued replacement of a text range settles to a caret before table qualification', async () => {
    await createEditor(page, 'table-replacement', 'table-simple');
    const result = await page.locator('#table-replacement').evaluate(element => {
      const found = element.find('A00'); if (!found.ok) return found;
      const selected = element.selectMatch(found.value.matches[0].id); if (!selected.ok) return selected;
      const before = element.snapshot().revision.value;
      element.querySelector('.docx-pages').dispatchEvent(new InputEvent('beforeinput', {
        inputType: 'insertText', data: 'Replacement', bubbles: true, cancelable: true, composed: true,
      }));
      const result = element.execute({ type: 'insert-table-row', where: 'below' });
      return { result, before, after: element.snapshot().revision.value };
    });
    assert.equal(result.result?.ok, true, JSON.stringify(result)); assert.equal(result.after, result.before + 2);
    const saved = await saveEditor(page, 'table-replacement'); assert.equal(shape(saved)[0].rows.length, 4);
    assert.equal(shape(saved)[0].rows[0][0], 'Replacement'); await dispose(page, 'table-replacement');
  });
  await check('table commands during input dispatch refuse and actual keyboard input settles naturally', async () => {
    await createEditor(page, 'table-native', 'table-simple'); await caret(page, 'table-native', 'A00');
    await page.locator('#table-native').evaluate(element => {
      element.__nativeEvidence = [];
      element.querySelector('.docx-pages').addEventListener('beforeinput', () => {
        const revision = element.snapshot().revision.value;
        const result = element.execute({ type: 'delete-table' });
        element.__nativeEvidence.push({ revision, result, after: element.snapshot().revision.value, available: element.can('bold') });
      });
    });
    await page.keyboard.type('Native');
    await page.waitForFunction(() => document.querySelector('#table-native').can('bold').enabled);
    const evidence = await page.locator('#table-native').evaluate(element => ({ events: element.__nativeEvidence, revision: element.snapshot().revision.value }));
    assert.equal(evidence.events.length, 6);
    for (const event of evidence.events) {
      assert.deepEqual(event.result, { ok: false, code: 'busy' }); assert.equal(event.after, event.revision);
      assert.deepEqual(event.available, { enabled: false, reason: 'busy' });
    }
    assert.ok(evidence.revision > 0); const saved = await saveEditor(page, 'table-native');
    assert.equal(shape(saved)[0].rows.length, 3); assert.ok(shape(saved)[0].rows.flat().some(text => text.includes('Native')));
    await dispose(page, 'table-native');
  });
  await check('nested beforeinput dispatch cannot evade command ownership', async () => {
    await createEditor(page, 'table-nested-input', 'table-simple'); await caret(page, 'table-nested-input', 'A00');
    const result = await page.locator('#table-nested-input').evaluate(element => {
      const surface = element.querySelector('.docx-pages'); let nested, inner = false;
      surface.addEventListener('beforeinput', () => {
        if (inner) return; inner = true;
        surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'Inner', bubbles: true, cancelable: true, composed: true }));
        nested = element.execute({ type: 'delete-table' });
      }, { once: true });
      surface.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'Outer', bubbles: true, cancelable: true, composed: true }));
      return { nested, revision: element.snapshot().revision.value };
    });
    assert.deepEqual(result.nested, { ok: false, code: 'busy' }); assert.equal(result.revision, 0);
    await page.waitForFunction(() => document.querySelector('#table-nested-input').snapshot().revision.value > 0);
    assert.equal(shape(await saveEditor(page, 'table-nested-input'))[0].rows.length, 3); await dispose(page, 'table-nested-input');
  });
  await check('pre-cancelled native input still keeps capability reads pure', async () => {
    await createEditor(page, 'table-cancelled-input', 'table-simple'); await caret(page, 'table-cancelled-input', 'A00');
    const result = await page.locator('#table-cancelled-input').evaluate(element => {
      const before = element.snapshot().revision;
      const event = new InputEvent('beforeinput', { inputType: 'insertText', data: 'Cancelled', bubbles: true, cancelable: true, composed: true });
      event.preventDefault(); element.querySelector('.docx-pages').dispatchEvent(event);
      const legacy = element.can('bold'), table = element.can({ type: 'delete-table' });
      return { before, after: element.snapshot().revision, legacy, table };
    });
    assert.deepEqual(result.before, result.after); assert.deepEqual(result.legacy, { enabled: false, reason: 'busy' }); assert.equal(result.table.enabled, true);
    await page.waitForFunction(() => document.querySelector('#table-cancelled-input').snapshot().revision.value > 0);
    assert.equal(shape(await saveEditor(page, 'table-cancelled-input'))[0].rows.length, 3); await dispose(page, 'table-cancelled-input');
  });
  await check('public change listeners cannot reenter a table commit', async () => {
    await createEditor(page, 'table-reentrant', 'table-simple'); await caret(page, 'table-reentrant', 'A00');
    const result = await page.locator('#table-reentrant').evaluate(element => {
      const before = element.snapshot().revision; let nested;
      const listener = () => { if (!nested && element.snapshot().revision.value > before.value) { nested = 'entered'; nested = element.execute({ type: 'delete-table' }); } };
      element.addEventListener('lr-change', listener);
      const result = element.execute({ type: 'insert-table-row', where: 'below' });
      element.removeEventListener('lr-change', listener);
      return { result, nested, before, after: element.snapshot().revision };
    });
    assert.equal(result.result.ok, true); assert.deepEqual(result.nested, { ok: false, code: 'busy' });
    assert.equal(result.after.value, result.before.value + 1); assert.equal(shape(await saveEditor(page, 'table-reentrant'))[0].rows.length, 4);
    await dispose(page, 'table-reentrant');
  });
  await check('single-cell deletion removes the table; read-only and text ranges refuse', async () => {
    for (const type of ['delete-table-row', 'delete-table-column', 'delete-table']) {
      await createEditor(page, 'table-single', 'table-single'); await caret(page, 'table-single', 'A00');
      const removed = await page.locator('#table-single').evaluate((element, type) => ({ result: element.execute({ type }), context: element.snapshot().table, selection: element.snapshot().selection, type }), type);
      assert.equal(removed.result.ok, true, JSON.stringify(removed)); assert.equal(shape(await saveEditor(page, 'table-single')).length, 0);
      await dispose(page, 'table-single');
    }
    await createEditor(page, 'table-range', 'table-simple'); await caret(page, 'table-range', 'A00');
    await page.keyboard.press('ControlOrMeta+A');
    assert.deepEqual(await page.locator('#table-range').evaluate(element => element.execute({ type: 'delete-table' })), { ok: false, code: 'unsupported' });
    await dispose(page, 'table-range');
    const result = await page.evaluate(async () => {
      const element = document.createElement('lr-docx-editor'); element.id = 'table-readonly'; element.readOnly = true;
      document.querySelector('#fixture').append(element); await element.open(await window.__docxTest.fixture('table-simple'));
      return element.execute({ type: 'delete-table' });
    });
    assert.deepEqual(result, { ok: false, code: 'read-only' }); await dispose(page, 'table-readonly');
  });
  await check('refused table insertion preserves a protected numeric draft, REF result and content control', async () => {
    await createEditor(page, 'table-form', 'table-protected-form');
    await page.locator('#table-form .docx-pages').getByText('123.00', { exact: true }).click();
    await page.locator('#table-form .docx-pages').evaluate(surface => surface.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'insertText', data: 'abc', bubbles: true, cancelable: true, composed: true,
    })));
    await page.waitForFunction(() => document.querySelector('#table-form').snapshot().revision.value === 1);
    const result = await page.locator('#table-form').evaluate(element => {
      const before = element.querySelector('.docx-pages').textContent, revision = element.snapshot().revision;
      const result = element.execute({ type: 'insert-table', rows: 1, columns: 1 });
      return { before, result, revision, after: element.querySelector('.docx-pages').textContent, afterRevision: element.snapshot().revision };
    });
    assert.ok(result.before.includes('abc')); assert.ok(result.before.includes('Stale value')); assert.ok(result.before.includes('Controlled text'));
    assert.deepEqual(result.result, { ok: false, code: 'unsupported' }); assert.deepEqual(result.afterRevision, result.revision); assert.equal(result.after, result.before);
    await dispose(page, 'table-form');
  });
  await check('public session table leases survive toolbar focus and reject native reselection', async () => {
    const opened = await page.evaluate(async () => {
      const mount = document.createElement('div'); mount.id = 'table-lease'; document.querySelector('#fixture').append(mount);
      const button = document.createElement('button'); button.id = 'table-lease-toolbar'; button.textContent = 'Table action'; document.querySelector('#fixture').append(button);
      const create = await window.__docxTest.sessionFactory(), created = create({ mount });
      if (!created.ok) return created; window.__tableLeaseSession = created.value;
      return created.value.open({ kind: 'docx', bytes: await window.__docxTest.fixture('table-simple') });
    });
    assert.equal(opened.ok, true); await page.locator('#table-lease .docx-pages').waitFor({ state: 'visible' });
    await caret(page, 'table-lease', 'A00');
    const retained = await page.evaluate(() => { const result = window.__tableLeaseSession.retainSelection(); if (result.ok) window.__tableLease = result.value; return result.ok; });
    assert.equal(retained, true); await page.locator('#table-lease-toolbar').click();
    const edited = await page.evaluate(() => window.__tableLeaseSession.execute({ type: 'insert-table-row', where: 'below' }, { selection: window.__tableLease }));
    assert.equal(edited.ok, true, JSON.stringify(edited));
    await caret(page, 'table-lease', 'A00');
    await page.evaluate(() => { const result = window.__tableLeaseSession.retainSelection(); if (!result.ok) throw Error(result.code); window.__tableLease = result.value; });
    await caret(page, 'table-lease', 'A22');
    const result = await page.evaluate(async () => {
      const session = window.__tableLeaseSession, before = session.snapshot().revision;
      const stale = session.execute({ type: 'delete-table-row' }, { selection: window.__tableLease });
      const saved = await session.save(); if (!saved.ok) throw Error(saved.code);
      const after = session.snapshot().revision; session.destroy();
      document.querySelector('#table-lease').remove(); document.querySelector('#table-lease-toolbar').remove();
      delete window.__tableLeaseSession; delete window.__tableLease;
      return { stale, before, after, bytes: [...saved.value.bytes] };
    });
    assert.deepEqual(result.stale, { ok: false, code: 'stale-selection' }); assert.deepEqual(result.after, result.before); assert.equal(shape(result.bytes)[0].rows.length, 4);
  });
  await check('native rectangular selection refuses single-row deletion unchanged', async () => {
    await createEditor(page, 'table-rectangle', 'table-simple');
    const first = await page.locator('#table-rectangle .docx-pages').getByText('A00', { exact: true }).boundingBox();
    const last = await page.locator('#table-rectangle .docx-pages').getByText('A22', { exact: true }).boundingBox();
    await page.mouse.move(first.x + 1, first.y + first.height / 2); await page.mouse.down();
    await page.mouse.move(last.x + last.width - 1, last.y + last.height / 2, { steps: 20 }); await page.mouse.up();
    const before = await saveEditor(page, 'table-rectangle');
    assert.deepEqual(await page.locator('#table-rectangle').evaluate(element => element.execute({ type: 'delete-table-row' })), { ok: false, code: 'unsupported' });
    assert.deepEqual(parts(await saveEditor(page, 'table-rectangle')), parts(before)); await dispose(page, 'table-rectangle');
  });
}

async function runTableToolbar(page, check, { createEditor, saveEditor, assertProtectedParts }) {
  for (const [key, expected] of [
    ['row-above', [4, 3]], ['row-below', [4, 3]], ['column-left', [3, 4]], ['column-right', [3, 4]],
    ['delete-row', [2, 3]], ['delete-column', [3, 2]], ['delete-table', null],
  ]) {
    await check(`native table toolbar ${key} targets the selected cell and keeps one history unit`, async () => {
      const id = 'table-toolbar', source = await createEditor(page, id, 'table-simple');
      await caret(page, id, 'A11');
      if (key === 'row-above') {
        await page.locator(`#${id}`).evaluate(element => element.setAttribute('dir', 'rtl'));
        const context = await page.locator(`#${id} [part="table-context"] bdi`).evaluateAll(elements =>
          elements.map(element => ({ text: element.textContent, bidi: getComputedStyle(element).unicodeBidi })));
        assert.deepEqual(context, [
          { text: '3 rows, 3 columns.', bidi: 'isolate' }, { text: 'Row 2, column 2.', bidi: 'isolate' },
        ]);
      }
      const before = await saveEditor(page, id);
      await page.locator(`#${id} [data-table-action="${key}"]`).click();
      assert.equal(await page.locator(`#${id}`).evaluate(element => element.snapshot().revision.value), 1);
      const saved = await saveEditor(page, id), tables = shape(saved);
      if (expected) assert.deepEqual([tables[0].rows.length, tables[0].columns], expected);
      else assert.equal(tables.length, 0);
      assertProtectedParts(saved, source);
      assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('undo'))).ok, true);
      assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
      await dispose(page, id);
    });
  }
  await check('table dialog validates drafts, inserts unchanged defaults and cancels without mutation', async () => {
    const id = 'table-dialog'; await createEditor(page, id, 'table-simple'); await caret(page, id, 'Before');
    await page.locator(`#${id} [part="table-insert-trigger"]`).click();
    assert.equal(await page.locator(`#${id} [part="table-rows"]`).evaluate(element => element.value), '2');
    const rows = page.locator(`#${id} [part="table-rows"] input`);
    await rows.fill('21');
    assert.equal(await page.locator(`#${id} [part="table-insert-apply"]`).evaluate(element => element.disabled), true);
    await rows.fill('1.5');
    assert.equal(await page.locator(`#${id} [part="table-insert-apply"]`).evaluate(element => element.disabled), true);
    await rows.fill('');
    assert.equal(await page.locator(`#${id} [part="table-insert-apply"]`).evaluate(element => element.disabled), true);
    await page.locator(`#${id} [part="table-insert-cancel"]`).click();
    assert.equal(await page.locator(`#${id}`).evaluate(element => element.snapshot().revision.value), 0);
    await page.locator(`#${id} [part="table-insert-trigger"]`).click();
    await page.locator(`#${id} [part="table-insert-apply"]`).click();
    assert.equal(await page.locator(`#${id}`).evaluate(element => element.snapshot().revision.value), 1);
    const tables = shape(await saveEditor(page, id));
    assert.deepEqual(tables.map(table => [table.rows.length, table.columns]), [[2, 2], [3, 3]]);
    await dispose(page, id);
  });
  await check('open table dialog invalidates on document edits and never falls back to a new selection', async () => {
    const id = 'table-dialog-stale'; await createEditor(page, id, 'table-simple'); await caret(page, id, 'Before');
    await page.locator(`#${id} [part="table-insert-trigger"]`).click();
    assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute({ type: 'alignment', value: 'center' }))).ok, true);
    assert.equal(await page.locator(`#${id} [part="table-insert-apply"]`).evaluate(element => element.disabled), true);
    assert.match(await page.locator(`#${id} [part="table-hint"]`).textContent(), /selection changed/u);
    const before = await saveEditor(page, id);
    await page.locator(`#${id} [part="table-rows"] input`).press('Enter');
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await page.locator(`#${id} [part="table-insert-cancel"]`).click();
    await caret(page, id, 'Before');
    await page.locator(`#${id} [part="table-insert-trigger"]`).click();
    await caret(page, id, 'A11');
    assert.equal(await page.locator(`#${id} [part="table-insert-popover"]`).evaluate(element => element.open), false);
    assert.equal(shape(await saveEditor(page, id)).length, 1);
    await dispose(page, id);
  });
  await check('table dialog keyboard, localization, RTL, narrow allocation and populated accessibility', async () => {
    const id = 'table-dialog-accessible'; await createEditor(page, id, 'table-simple');
    await page.locator(`#${id}`).evaluate(element => {
      element.setAttribute('dir', 'rtl'); element.style.inlineSize = '320px';
      element.strings = { docxEditorInsertTable: 'Ajouter un tableau', docxEditorTableRows: 'Lignes',
          docxEditorTableColumns: 'Colonnes', docxEditorTableRowBelow: 'Ligne dessous', docxEditorTableColumnRight: 'Colonne à droite' };
    });
    await page.locator(`#${id}`).evaluate(element => element.updateComplete);
    await paints(page);
    await caret(page, id, 'Before');
    await toolbarTo(page, id, 'image-next');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(`#${id}`).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'image-previous');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(`#${id}`).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'table-insert-trigger');
    await page.keyboard.press('Enter');
    await page.locator(`#${id} [part="table-rows"] input`).waitFor({ state: 'visible' });
    assert.equal(await page.locator(`#${id} [part="table-rows"]`).getAttribute('label'), 'Lignes');
    assert.equal(await page.locator(`#${id} [part="table-columns"]`).getAttribute('label'), 'Colonnes');
    await assertNoAxeViolations(page, id);
    const bounds = await page.locator(`#${id} [part="table-fields"]`).boundingBox();
    assert.ok(bounds.width <= 320, JSON.stringify(bounds));
    await page.locator(`#${id} [part="table-rows"] input`).press('Escape');
    assert.equal(await page.locator(`#${id} [part="table-insert-popover"]`).evaluate(element => element.open), false);
    await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.locator(`#${id}`).evaluate(element => element.shadowRoot.activeElement?.getAttribute('part')), 'table-insert-trigger');
    await dispose(page, id);
  });
  await check('table dialog leaves composing keys native and delayed close never steals outside focus', async () => {
    const id = 'table-dialog-focus'; await createEditor(page, id, 'table-simple'); await caret(page, id, 'Before');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    try {
      await page.locator(`#${id} [part="table-insert-trigger"]`).click();
      const native = await page.locator(`#${id} [part="table-rows"] input`).evaluate(input => {
        const events = [
          new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, composed: true, cancelable: true }),
          new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, composed: true, cancelable: true }),
        ];
        return events.map(event => { input.dispatchEvent(event); return event.defaultPrevented; });
      });
      assert.deepEqual(native, [false, false]);
      assert.equal(await page.locator(`#${id} [part="table-insert-popover"]`).evaluate(element => element.open), true);
      assert.equal(await page.locator(`#${id}`).evaluate(element => element.snapshot().revision.value), 0);
      await page.locator(`#${id}`).evaluate(element => {
        const outside = document.createElement('input'); outside.id = 'table-outside-focus'; outside.setAttribute('aria-label', 'Outside focus');
        document.querySelector('#fixture').append(outside);
        const popover = element.shadowRoot.querySelector('[part="table-insert-popover"]');
        element.__tableClosed = new Promise(resolve => popover.addEventListener('lr-after-hide', resolve, { once: true }));
        popover.addEventListener('lr-hide', () => queueMicrotask(() => outside.focus()), { once: true });
      });
      await page.locator(`#${id} [part="table-insert-cancel"]`).click();
      await page.locator(`#${id}`).evaluate(element => element.__tableClosed.then(() => undefined));
      assert.equal(await page.evaluate(() => document.activeElement.id), 'table-outside-focus');
      await page.keyboard.type('x');
      assert.equal(await page.locator('#table-outside-focus').inputValue(), 'x');
      await page.locator('#table-outside-focus').evaluate(element => element.remove());
    } finally { await page.emulateMedia({ reducedMotion: 'reduce' }); await dispose(page, id); }
  });
  await check('table controls preserve unsupported content and live labels update without remount', async () => {
    const id = 'table-toolbar-labels'; await createEditor(page, id, 'table-merged'); await caret(page, id, 'A11');
    const before = await saveEditor(page, id);
    await page.locator(`#${id} [data-table-action="delete-table"]`).click();
    assert.equal(await page.locator(`#${id} [part="edit-error"]`).count(), 1);
    assert.deepEqual(parts(await saveEditor(page, id)), parts(before));
    await dispose(page, id); await createEditor(page, id, 'table-simple'); await caret(page, id, 'A11');
    await page.locator(`#${id}`).evaluate(element => {
      element.__tableMount = element.querySelector('[slot="document"]').firstElementChild;
      element.strings = { docxEditorTableRowBelow: 'Ligne dessous', docxEditorTableColumnRight: 'Colonne à droite' };
    });
    assert.equal(await page.locator(`#${id} [data-table-action="row-below"]`).getAttribute('aria-label'), 'Ligne dessous');
    assert.equal(await page.locator(`#${id}`).evaluate(element => element.__tableMount === element.querySelector('[slot="document"]').firstElementChild), true);
    // Row hover exposes core-owned insertion furniture; changing strings refreshes its current label.
    const cell = page.locator(`#${id} .docx-pages`).getByText('A11', { exact: true });
    await cell.scrollIntoViewIfNeeded();
    const rowBox = await cell.evaluate(element => {
      const box = element.closest('.docx-table-row').getBoundingClientRect();
      return { x: box.x, y: box.y, height: box.height };
    });
    await page.mouse.move(rowBox.x + 1, rowBox.y + rowBox.height / 2);
    const furniture = page.locator(`#${id} .docx-table-insert-row`);
    await furniture.waitFor({ state: 'attached' });
    assert.equal(await furniture.getAttribute('aria-label'), 'Ligne dessous');
    await page.locator(`#${id}`).evaluate(element => { element.strings = { docxEditorTableRowBelow: 'Neue Zeile' }; });
    await page.waitForFunction(id => document.getElementById(id).querySelector('.docx-table-insert-row')?.getAttribute('aria-label') === 'Neue Zeile', id);
    assert.equal(await page.locator(`#${id}`).evaluate(element => element.snapshot().revision.value), 0);
    await dispose(page, id);
  });
  await check('table dialog replacement and reconnect discard drafts without a stale focus return', async () => {
    const id = 'table-dialog-replace'; await createEditor(page, id, 'table-simple'); await caret(page, id, 'Before');
    await page.locator(`#${id} [part="table-insert-trigger"]`).click();
    await page.locator(`#${id} [part="table-rows"] input`).fill('9');
    const replaced = await page.locator(`#${id}`).evaluate(element => element.newDocument());
    assert.equal(replaced.ok, true);
    assert.equal(await page.locator(`#${id} [part="table-insert-popover"]`).evaluate(element => element.open), false);
    await page.locator(`#${id}`).evaluate(element => { const parent = element.parentNode; element.remove(); parent.append(element); });
    assert.equal(await page.locator(`#${id} [part="table-insert-trigger"]`).evaluate(element => element.disabled), true);
    assert.equal(await page.locator(`#${id} [part="table-rows"]`).evaluate(element => element.value), '2');
    await dispose(page, id);
  });
}
