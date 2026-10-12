import assert from 'node:assert/strict';
import { SaxesParser } from 'saxes';
import { zipEntry } from '../test/zip.mjs';
import { zipParts } from './lib/harness.mjs';

const WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function tableXml(bytes) {
  const stack = [], roots = [], parser = new SaxesParser({ xmlns: true });
  parser.on('opentag', tag => {
    const node = { name: tag.uri === WORD ? tag.local : '', attrs: Object.fromEntries(Object.values(tag.attributes)
      .filter(value => value.uri === WORD).map(value => [value.local, value.value])), children: [], text: '' };
    (stack.at(-1)?.children ?? roots).push(node); stack.push(node);
  });
  parser.on('text', text => { if (stack.length) stack.at(-1).text += text; });
  parser.on('closetag', () => stack.pop());
  parser.write(zipEntry(bytes, 'word/document.xml')).close();
  const find = nodes => { for (const node of nodes) { if (node.name === 'tbl') return node; const result = find(node.children); if (result) return result; } };
  return find(roots);
}
const child = (node, name) => node?.children.find(value => value.name === name);
const rows = table => table.children.filter(value => value.name === 'tr');
const cells = table => rows(table).flatMap(row => row.children.filter(value => value.name === 'tc'));
const property = (cell, name) => child(child(cell, 'tcPr'), name)?.attrs;
async function caret(page, id, text = 'A11') {
  await page.locator(`#${id} .docx-pages`).getByText(text, { exact: true }).click();
  await page.keyboard.press('ArrowLeft');
}
async function execute(page, id, action) {
  return page.locator(`#${id}`).evaluate((element, action) => {
    const before = element.snapshot(), result = element.execute(action, { expectedRevision: before.revision }), after = element.snapshot();
    return { result, before: { revision: before.revision, selection: before.selection }, after: { revision: after.revision, selection: after.selection } };
  }, action);
}

export async function runTableFormatting(page, check, { createEditor, saveEditor, assertProtectedParts }) {
  for (const action of [
    { type: 'table-header-row', enabled: true }, { type: 'table-cell-alignment', value: 'bottom' },
    { type: 'table-cell-shading', color: '#ABCDEF' },
    { type: 'table-cell-borders', target: 'all', style: 'double', widthPoints: 1.5, color: '#123456' },
    { type: 'table-width', widthPoints: 300 },
  ]) {
    await check(`${action.type} preserves caret, commits once, round trips and leaves repeats unchanged`, async () => {
      const id = 'table-formatting', source = await createEditor(page, id, 'table-simple');
      try {
        await caret(page, id);
        const before = await saveEditor(page, id), result = await execute(page, id, action);
        assert.equal(result.result.ok, true, JSON.stringify(result));
        assert.equal(result.after.revision.value, result.before.revision.value + 1);
        assert.deepEqual(result.after.selection, result.before.selection);
        const saved = await saveEditor(page, id), table = tableXml(saved), allCells = cells(table), selected = allCells[4];
        assertProtectedParts(saved, source);
        assert.equal(allCells.length, 9);
        if (action.type === 'table-header-row') assert.deepEqual(rows(table).map(row => !!child(child(row, 'trPr'), 'tblHeader')), [true, false, false]);
        if (action.type === 'table-cell-alignment') {
          assert.equal(property(selected, 'vAlign').val, 'bottom');
          assert.equal(allCells.filter(cell => property(cell, 'vAlign')).length, 1);
        }
        if (action.type === 'table-cell-shading') {
          assert.equal(property(selected, 'shd').fill, 'ABCDEF');
          assert.equal(allCells.filter(cell => property(cell, 'shd')?.fill === 'ABCDEF').length, 1);
        }
        if (action.type === 'table-cell-borders') {
          const borders = child(child(selected, 'tcPr'), 'tcBorders');
          for (const edge of ['top', 'left', 'bottom', 'right']) assert.deepEqual(child(borders, edge).attrs, { val: 'double', sz: '12', color: '123456' });
          assert.equal(allCells.filter(cell => child(child(cell, 'tcPr'), 'tcBorders')).length, 1);
        }
        if (action.type === 'table-width') {
          assert.deepEqual(child(table, 'tblGrid').children.map(column => column.attrs.w), ['2000', '2000', '2000']);
          assert.deepEqual(child(child(table, 'tblPr'), 'tblW').attrs, { w: '6000', type: 'dxa' });
          assert.equal(child(child(table, 'tblPr'), 'tblLayout').attrs.type, 'fixed');
          assert.ok(allCells.every(cell => property(cell, 'tcW').w === '2000' && property(cell, 'tcW').type === 'dxa'));
        }
        const repeated = await page.locator(`#${id}`).evaluate(async (element, action) => {
          const saved = await element.save(); if (!saved.ok) return { saved };
          const ack = element.acknowledgeSaved(saved.value), before = element.snapshot(), result = element.execute(action), after = element.snapshot();
          return { ack, result, before: before.revision, after: after.revision, dirty: after.dirty };
        }, action);
        assert.equal(repeated.ack.ok, true); assert.equal(repeated.result.ok, true);
        assert.deepEqual(repeated.after, repeated.before); assert.equal(repeated.dirty, false);
        assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('undo'))).ok, true);
        assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before));
        assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('redo'))).ok, true);
        assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(saved));
        const reopened = await page.locator(`#${id}`).evaluate((element, bytes) => element.open(Uint8Array.from(bytes)), saved);
        assert.equal(reopened.ok, true); assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(saved));
      } finally { await page.locator(`#${id}`).evaluate(element => element.remove()); }
    });
  }
  await check('clearing cell fill and a border edge preserves the other edges; disabling headers clears repeats', async () => {
    const id = 'table-format-clear'; await createEditor(page, id, 'table-simple');
    try {
      await caret(page, id);
      for (const action of [{ type: 'table-cell-shading', color: '#ABCDEF' },
        { type: 'table-cell-borders', target: 'all', style: 'single', widthPoints: 1, color: 'auto' }, { type: 'table-header-row', enabled: true }]) {
        assert.equal((await execute(page, id, action)).result.ok, true);
      }
      const before = await saveEditor(page, id);
      for (const action of [{ type: 'table-cell-shading', color: null }, { type: 'table-cell-borders', target: 'top', style: 'none' }, { type: 'table-header-row', enabled: false }]) {
        assert.equal((await execute(page, id, action)).result.ok, true);
      }
      const table = tableXml(await saveEditor(page, id)), selected = cells(table)[4], borders = child(child(selected, 'tcPr'), 'tcBorders');
      assert.equal(property(selected, 'shd')?.fill, undefined);
      assert.equal(child(borders, 'top').attrs.val, 'none');
      for (const edge of ['left', 'bottom', 'right']) assert.equal(child(borders, edge).attrs.val, 'single');
      assert.ok(rows(table).every(row => !child(child(row, 'trPr'), 'tblHeader')));
      for (let index = 0; index < 3; index++) assert.equal((await page.locator(`#${id}`).evaluate(element => element.execute('undo'))).ok, true);
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before));
    } finally { await page.locator(`#${id}`).evaluate(element => element.remove()); }
  });
  await check('table formatting refuses unsupported topology, too-narrow width, invalid values and stale revisions unchanged', async () => {
    const actions = [{ type: 'table-header-row', enabled: true }, { type: 'table-width', widthPoints: 300 },
      { type: 'table-cell-alignment', value: 'center' }, { type: 'table-cell-shading', color: null },
      { type: 'table-cell-borders', target: 'all', style: 'none' }];
    for (const fixture of ['table-merged', 'table-nested']) {
      const id = 'table-format-refusal'; await createEditor(page, id, fixture);
      try {
        await caret(page, id, fixture === 'table-nested' ? 'Outer' : 'A11');
        const before = await saveEditor(page, id);
        for (const action of actions) assert.deepEqual((await execute(page, id, action)).result, { ok: false, code: 'unsupported' });
        assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before));
      } finally { await page.locator(`#${id}`).evaluate(element => element.remove()); }
    }
    const id = 'table-format-invalid'; await createEditor(page, id, 'table-simple');
    try {
      await caret(page, id); const before = await saveEditor(page, id);
      assert.deepEqual((await execute(page, id, { type: 'table-width', widthPoints: 44.95 })).result, { ok: false, code: 'unsupported' });
      assert.deepEqual((await execute(page, id, { type: 'table-cell-shading', color: 'red' })).result, { ok: false, code: 'invalid-option' });
      assert.deepEqual(zipParts(await saveEditor(page, id)), zipParts(before));
      const stale = await page.locator(`#${id}`).evaluate(element => {
        const revision = element.snapshot().revision;
        const changed = element.execute({ type: 'table-cell-alignment', value: 'bottom' });
        return { changed, refused: element.execute({ type: 'table-header-row', enabled: true }, { expectedRevision: revision }) };
      });
      assert.equal(stale.changed.ok, true); assert.deepEqual(stale.refused, { ok: false, code: 'stale-revision' });
      assert.ok(rows(tableXml(await saveEditor(page, id))).every(row => !child(child(row, 'trPr'), 'tblHeader')));
    } finally { await page.locator(`#${id}`).evaluate(element => element.remove()); }
  });
  await check('public session table formatting retains toolbar intent and rejects a reselected lease', async () => {
    const id = 'table-format-session';
    const opened = await page.evaluate(async id => {
      const mount = document.createElement('div'); mount.id = id; document.querySelector('#fixture').append(mount);
      const button = document.createElement('button'); button.id = `${id}-toolbar`; button.textContent = 'Format table'; document.querySelector('#fixture').append(button);
      const create = await window.__docxTest.sessionFactory(), created = create({ mount });
      if (!created.ok) return created; window.__tableFormattingSession = created.value;
      return created.value.open({ kind: 'docx', bytes: await window.__docxTest.fixture('table-simple') });
    }, id);
    assert.equal(opened.ok, true);
    try {
      await page.locator(`#${id} .docx-pages`).waitFor({ state: 'visible' }); await caret(page, id);
      await page.evaluate(() => { const result = window.__tableFormattingSession.retainSelection(); if (!result.ok) throw Error(result.code); window.__tableFormattingLease = result.value; });
      await page.locator(`#${id}-toolbar`).click();
      const formatted = await page.evaluate(() => {
        const session = window.__tableFormattingSession, before = session.snapshot();
        const result = session.execute({ type: 'table-width', widthPoints: 300 }, { selection: window.__tableFormattingLease });
        return { result, before: before.selection, after: session.snapshot().selection, revision: session.snapshot().revision.value };
      });
      assert.equal(formatted.result.ok, true, JSON.stringify(formatted)); assert.equal(formatted.revision, 1);
      assert.deepEqual(formatted.after, formatted.before);
      await caret(page, id);
      await page.evaluate(() => { const result = window.__tableFormattingSession.retainSelection(); if (!result.ok) throw Error(result.code); window.__tableFormattingLease = result.value; });
      await caret(page, id, 'A22');
      const refused = await page.evaluate(async () => {
        const session = window.__tableFormattingSession, before = session.snapshot().revision;
        const result = session.execute({ type: 'table-header-row', enabled: true }, { selection: window.__tableFormattingLease });
        const saved = await session.save(); if (!saved.ok) throw Error(saved.code);
        return { result, before, after: session.snapshot().revision, bytes: [...saved.value.bytes] };
      });
      assert.deepEqual(refused.result, { ok: false, code: 'stale-selection' }); assert.deepEqual(refused.after, refused.before);
      const table = tableXml(refused.bytes);
      assert.equal(child(child(table, 'tblPr'), 'tblW').attrs.w, '6000');
      assert.ok(rows(table).every(row => !child(child(row, 'trPr'), 'tblHeader')));
    } finally {
      await page.evaluate(id => { window.__tableFormattingSession?.destroy(); delete window.__tableFormattingSession; delete window.__tableFormattingLease;
        document.getElementById(id)?.remove(); document.getElementById(`${id}-toolbar`)?.remove(); }, id);
    }
  });
}
