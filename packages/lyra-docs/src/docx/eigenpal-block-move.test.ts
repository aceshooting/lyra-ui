import assert from 'node:assert/strict';
import test from 'node:test';
import type { OoxmlPackage } from '@docx-editor.dev/core/store';
import { docxFixture } from '../../test/admission-fixtures.js';
import type { DocxEditorInstance } from '@docx-editor.dev/core';
import { opened } from '../../test/session-fixture.js';
import { prepareBlockMove, runBlockMove, type DocxPackageEdit } from './eigenpal-block-move.js';
import { WORD_NS } from './ooxml.js';

const { readOoxmlPackage, TreePackageStore } = await import('@docx-editor.dev/core/store');

const paragraph = (value: string) => '<w:p><w:r><w:t>' + value + '</w:t></w:r></w:p>';
const move = (pkg: OoxmlPackage, start: number, end: number, before: number) =>
  prepareBlockMove(pkg, { type: 'move-blocks', start, end, before });
function documentPackage(blocks: string[]) {
  const loaded = readOoxmlPackage(docxFixture({ 'word/document.xml': '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + blocks.join('') + '</w:body></w:document>' }));
  assert(loaded.ok);
  return loaded.package;
}

test('append retains the final section and original blocks in one native package transaction', () => {
  const pkg = documentPackage([paragraph('Duplicate'), paragraph('Duplicate'), '<w:tbl/>', '<w:sectPr/>']);
  const part = pkg.parts.get(pkg.mainDocumentPart)!;
  const store = new TreePackageStore(pkg, part);
  const current = store.currentPackage();
  const body = part.root.children.find(node => node.kind === 'body');
  assert(body?.kind === 'body');
  // The canonical story includes a caret paragraph between the final table and section.
  assert.deepEqual(body.children.map(node => node.localName),
    ['p', 'p', 'tbl', 'p', 'sectPr']);
  assert.deepEqual(move(current, 0, 1, 0), { ok: true, value: null });
  assert.deepEqual(move(current, 1, 4, 5), { ok: true, value: null });
  const plan = move(current, 0, 1, 5);
  assert(plan.ok && plan.value);
  const transform = plan.value;
  const trial = store.transact({ kind: 'body' }, transaction => {
    transaction.applyPackage(transform);
    transaction.apply({ op: 'insertText', paragraphId: 'missing', offset: 0, text: 'refused' });
  });
  assert.equal(trial.ok, false);
  assert.equal(store.currentPackage().parts.get(pkg.mainDocumentPart), part, 'failed transaction leaves the previous tree intact');
  assert.equal(store.canUndo, false);
  const outcome = store.transact({ kind: 'body' }, transaction => { transaction.applyPackage(transform); });
  assert.equal(outcome.ok, true);
  const updated = store.currentPackage();
  const next = updated.parts.get(pkg.mainDocumentPart)!.root.children.find(node => node.kind === 'body');
  assert(next?.kind === 'body');
  const [a, b, table, caretParagraph, section] = body.children;
  assert.equal(next.children.length, 5);
  for (const [index, node] of [b, table, caretParagraph, a, section].entries()) assert.equal(next.children[index], node);
  assert.throws(() => transform(updated), 'a prepared move cannot be applied over changed main-part authority');
  assert(store.undo());
  assert.equal(store.currentPackage().parts.get(pkg.mainDocumentPart), part);
  assert(store.redo());
  assert.equal(store.currentPackage().parts.get(pkg.mainDocumentPart), updated.parts.get(pkg.mainDocumentPart));
});

test('moving left, whole bookmarks and surrounding fields preserve original boundaries', () => {
  const pkg = documentPackage(['<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r></w:p>', paragraph('B'),
    '<w:p><w:bookmarkStart w:id="1" w:name="Location"/></w:p>', '<w:p><w:bookmarkEnd w:id="1"/></w:p>',
    '<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>']);
  const original = pkg.parts.get(pkg.mainDocumentPart)!.root.children.find(node => node.kind === 'body');
  assert(original?.kind === 'body');
  const plan = move(pkg, 2, 4, 1);
  assert(plan.ok && plan.value);
  const applied = plan.value(pkg).parts.get(pkg.mainDocumentPart)!.root.children.find(node => node.kind === 'body');
  assert(applied?.kind === 'body');
  assert.deepEqual(applied.children, [0, 2, 3, 1, 4].map(index => original.children[index]));
  assert.deepEqual(move(pkg, 2, 3, 1), { ok: false, code: 'unsupported' }, 'split bookmark');
  assert.deepEqual(move(pkg, 1, 2, 5), { ok: false, code: 'unsupported' }, 'crossed field end');
});

test('moves refuse malformed final section placement, locked content, and invalid body bounds', () => {
  for (const blocks of [[paragraph('A'), '<w:sectPr/>', paragraph('B')], ['<w:sectPr/>', '<w:sectPr/>']]) {
    assert.deepEqual(move(documentPackage(blocks), 0, 1, 2), { ok: false, code: 'unsupported' });
  }
  const locked = '<w:sdt><w:sdtPr><w:lock w:val="sdtLocked"/></w:sdtPr><w:sdtContent>' + paragraph('Locked') + '</w:sdtContent></w:sdt>';
  assert.deepEqual(move(documentPackage([locked, paragraph('Next')]), 0, 1, 2), { ok: false, code: 'unsupported' });
  const pkg = documentPackage([paragraph('A'), paragraph('B'), '<w:sectPr/>']);
  for (const [start, end, before] of [[0, 3, 0], [0, 1, 4], [2, 3, 0]]) {
    assert.deepEqual(move(pkg, start!, end!, before!), { ok: false, code: 'invalid-option' });
  }
});

test('a late refusal retires the session before native redo can replay the move', async () => {
  const facade = await opened();
  const pkg = documentPackage([paragraph('A'), paragraph('B')]);
  const store = new TreePackageStore(pkg, pkg.parts.get(pkg.mainDocumentPart)!);
  const native = { part: () => store.partFor({ kind: 'body' })!, packageRevision: () => store.packageRevision };
  const plan = move(store.currentPackage(), 0, 1, 2);
  assert(plan.ok && plan.value);
  const write = plan.value;
  const commit = (edit: DocxPackageEdit) => store.transact({ kind: 'body' }, transaction => { transaction.applyPackage(edit); });
  assert(commit(write).ok && store.undo() && store.canRedo, 'the document already has a redo frame');
  const editor = { surface: { session: native, applyAutomationOps: (stage: () => unknown, _scope: unknown, writes: DocxPackageEdit[]) => {
    assert.deepEqual(stage(), []);
    assert(commit(writes[0]!).ok);
    assert.equal(store.canRedo, false, 'a real native write clears the pre-existing redo frame');
    facade.f.emit('change');
    return { committed: true, rejected: false };
  } }, exec(command: { type: string }) {
    assert.equal(command.type, 'undo');
    const undone = store.undo();
    if (undone) facade.f.emit('change');
    return { ok: undone !== null };
  } } as unknown as DocxEditorInstance;
  facade.engine.executeBatch = async (_steps, control) => {
    assert(control.arm().ok);
    return runBlockMove(editor, write, control.validate, () => ({ ok: false, code: 'composing' }));
  };
  const result = await facade.session.applyEdits([{ edit: { type: 'move-blocks', start: 0, end: 1, before: 2 } }],
    { expectedRevision: facade.revision });
  assert.deepEqual(result, { ok: false, code: 'engine-failed', step: 0 });
  assert.equal(facade.session.snapshot().status, 'error');
  assert.equal(facade.f.destroyed, 1);
  assert.equal((await facade.session.execute('redo')).ok, false);
  assert.equal(store.canRedo, false, 'the refused move was never made available through a compensating undo');
});
