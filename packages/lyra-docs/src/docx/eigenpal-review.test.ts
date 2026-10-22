import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync } from 'fflate';
const store = await import('@docx-editor.dev/core/store');
const { readOoxmlPart } = store;
import type { DocxEditorInstance, EditorCommand, ExecResult, ReviewModelInput } from '@docx-editor.dev/core';
import type { OoxmlNode, OoxmlElement } from '@docx-editor.dev/core/store';
const { openTreeSession } = await import('@docx-editor.dev/core/binding');
import { createEigenpalReview, createLyraReviewModule } from './eigenpal-review.js';
import { deriveLyraReview } from './eigenpal-review-model.js';
import { normalizeDocxReviewAction } from './review-types.js';
import type { DocxResult } from './types.js';
import { docxFixture } from '../../test/admission-fixtures.js';
import { reviewFixture } from '../../test/review-fixtures.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function part(body: string, name = '/word/document.xml') {
  const parsed = readOoxmlPart(`<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`, { name, contentType: 'application/xml' });
  assert(parsed.ok); return parsed.part;
}
function xmlPart(xml: string, name: string) {
  const parsed = readOoxmlPart(xml, { name, contentType: 'application/xml' }); assert(parsed.ok); return parsed.part;
}
const revision = (id = '1', author = 'Writer', text = 'added', kind = 'ins', date = '') => `<w:${kind} w:id="${id}" w:author="${author}"${date ? ` w:date="${date}"` : ''}><w:r><w:${kind === 'del' ? 'delText' : 't'}>${text}</w:${kind === 'del' ? 'delText' : 't'}></w:r></w:${kind}>`;
function reviewInput(body = '<w:p><w:r><w:t>Words</w:t></w:r></w:p>', comments = '', extended = ''): ReviewModelInput {
  return { storyPart: part(body),
    ...(comments ? { commentsPart: xmlPart(`<w:comments xmlns:w="${W}" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid">${comments}</w:comments>`, '/word/comments.xml') } : {}),
    ...(extended ? { commentsExtendedPart: xmlPart(`<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml">${extended}</w15:commentsEx>`, '/word/commentsExtended.xml') } : {}) };
}
const comment = (id: string, body = 'Comment', paraId = '', parent = '') => `<w:comment w:id="${id}" w:author="Reviewer"${parent ? ` w16cid:parentId="${parent}"` : ''}><w:p${paraId ? ` w14:paraId="${paraId}"` : ''}><w:r><w:t>${body}</w:t></w:r></w:p></w:comment>`;
const anchored = '<w:p><w:commentRangeStart w:id="0"/><w:r><w:t>Words</w:t></w:r><w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r></w:p>';

test('only direct body text revisions qualify; structural, formatting, nested and table decisions stay visible', () => {
  for (const body of [
    `<w:p><w:ins w:id="1" w:author="A">${revision('2')}</w:ins></w:p>`,
    `<w:tbl><w:tr><w:tc><w:p>${revision()}</w:p></w:tc></w:tr></w:tbl>`,
    '<w:p><w:pPr><w:rPr><w:ins w:id="1" w:author="A"/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>',
    '<w:p><w:r><w:rPr><w:b/><w:rPrChange w:id="1" w:author="A"><w:rPr/></w:rPrChange></w:rPr><w:t>x</w:t></w:r></w:p>',
  ]) {
    const result = deriveLyraReview({ storyPart: part(body) }, store);
    assert(result.items.length > 0); assert.equal(result.trackingSupported, false);
    assert(result.items.every(item => item.kind !== 'revision' || item.readOnly));
  }
});
test('repeated revision identity is conservative while distinct authors and dates remain independent', () => {
  const same = deriveLyraReview({ storyPart: part(`<w:p>${revision()}<w:r><w:t>gap</w:t></w:r>${revision()}</w:p>`) }, store);
  assert(same.items.length > 0); assert(same.items.every(item => item.kind === 'revision' && item.readOnly));
  for (const other of [revision('1', 'Other'), revision('1', 'Writer', 'date', 'ins', '2026-10-12T00:00:00Z')]) {
    const distinct = deriveLyraReview({ storyPart: part(`<w:p>${revision()}<w:r><w:t>gap</w:t></w:r>${other}</w:p>`) }, store);
    assert.equal(distinct.items.length, 2); assert(distinct.items.every(item => item.kind === 'revision' && !item.readOnly));
  }
});
test('header revisions cannot resolve as body decisions', () => {
  const input = { storyPart: part(`<w:p>${revision()}</w:p>`), furnitureParts: [part(`<w:p>${revision()}</w:p>`, '/word/header1.xml')] };
  const result = deriveLyraReview(input, store);
  assert.equal(result.items.length, 2); assert.equal(result.trackingSupported, false);
  assert.equal(result.items.filter(item => item.kind === 'revision' && item.readOnly).length, 1);
});
test('explicit comment threads retain malicious text literally and do not infer replies from overlapping ranges', () => {
  const input = reviewInput(anchored, comment('0', '&lt;img onerror=alert(1)&gt;', '00000001') + comment('1', 'Reply', '00000002'),
    '<w15:commentEx w15:paraId="00000001" w15:done="1"/><w15:commentEx w15:paraId="00000002" w15:paraIdParent="00000001" w15:done="1"/>');
  const result = deriveLyraReview(input, store); assert.equal(result.items.length, 2);
  const first = result.items[0]!, reply = result.items[1]!;
  assert(first.kind === 'comment' && reply.kind === 'comment');
  assert.equal(store.commentBodyText(first.comment), '<img onerror=alert(1)>'); assert.equal(first.resolved, true);
  assert.deepEqual(first.replyIds, ['1']); assert.equal(reply.parentId, '0'); assert.equal(reply.orphaned, false);
  assert.equal(reply.range?.start.paragraphId, first.range?.start.paragraphId);
});
test('orphaned, duplicated, conflicting and cyclic comment metadata cannot become mutation targets', () => {
  for (const input of [
    reviewInput(undefined, comment('0')),
    reviewInput(anchored, comment('0') + comment('0')),
    reviewInput(anchored, comment('0', 'A', '00000001', '1') + comment('1', 'B', '00000002', '0')),
    reviewInput(anchored, comment('0', 'A', '00000001', '1'), '<w15:commentEx w15:paraId="00000001" w15:paraIdParent="00000009"/>'),
  ]) {
    const result = deriveLyraReview(input, store);
    assert(result.items.length > 0); assert.equal(result.hasUnsupported, true);
    assert(result.items.every(item => item.kind === 'comment' && item.orphaned && item.range === null));
    assert.equal(new Set(result.items.map(item => store.reviewItemKey(item))).size, result.items.length);
  }
});
test('resource budgets reject before invoking any store derivation and never alter the source', () => {
  const input = reviewInput(`<w:p>${revision()}</w:p>`), before = structuredClone(input);
  let reads = 0;
  const dependencies = { ...store, collectReviewItems: (...args: Parameters<typeof store.collectReviewItems>) => { reads++; return store.collectReviewItems(...args); } };
  for (const limits of [{ nodes: 0 }, { characters: 0 }, { depth: 0 }, { parts: 0 }]) {
    const result = deriveLyraReview(input, dependencies, limits); assert.equal(result.truncated, true); assert.equal(result.trackingSupported, false);
  }
  assert.equal(reads, 0); assert.deepEqual(input, before);
  const cyclic = structuredClone(input), root = cyclic.storyPart.root;
  (root.children as OoxmlNode[]).push(root);
  assert.equal(deriveLyraReview(cyclic, dependencies).truncated, true); assert.equal(reads, 0);
});
test('item truncation is explicit and disables tracked authoring', () => {
  const result = deriveLyraReview(reviewInput(`<w:p>${revision('1')}</w:p><w:p>${revision('2')}</w:p>`), store, { items: 1 });
  assert.equal(result.items.length, 1); assert.equal(result.truncated, true); assert.equal(result.trackingSupported, false);
});
test('nested explicit replies inherit a root anchor without following cycles', () => {
  const result = deriveLyraReview(reviewInput(anchored,
    comment('0', 'Root', '00000001') + comment('1', 'Reply', '00000002', '0') + comment('2', 'Nested', '00000003', '1')), store);
  assert.equal(result.items.length, 3);
  assert(result.items.every(item => item.kind === 'comment' && !item.orphaned));
});
test('revisions inside comment bodies remain visible as unsupported decisions', () => {
  const input = reviewInput(anchored, `<w:comment w:id="0" w:author="A"><w:p>${revision()}</w:p></w:comment>`);
  const result = deriveLyraReview(input, store);
  assert(result.items.some(item => item.kind === 'revision' && item.readOnly));
  assert.equal(result.trackingSupported, false);
});
test('bounded comment count refuses before thread derivation', () => {
  const result = deriveLyraReview(reviewInput(anchored, comment('0') + comment('1')), store, { items: 1 });
  assert.equal(result.truncated, true); assert.equal(result.trackingSupported, false);
});
test('browser fixture exposes two independent review decisions and a comment through the registered module', () => {
  const opened = openTreeSession(reviewFixture(), { reviewModel: createLyraReviewModule(store).review }); assert(opened.ok);
  assert.equal(opened.session.reviewItems().length, 3);
  assert.equal(opened.session.reviewItems().filter(item => item.kind === 'revision' && !item.readOnly).length, 2);
});
test('paragraph refresh agrees with the complete queue for isolated simple decisions', () => {
  const input = reviewInput(`<w:p>${revision('1')}</w:p><w:p>${revision('2', 'Writer', 'gone', 'del')}</w:p>`);
  const module = createLyraReviewModule(store).review!;
  const all = module.collectReviewItems(input);
  for (const item of all) {
    assert(item.kind === 'revision');
    const paragraphId = item.ranges[0]!.start.paragraphId;
    assert.deepEqual(module.revisionItemsOfParagraph(input.storyPart, paragraphId), [item]);
  }
});
test('supported module revisions retain the public store object used by core review dispatch', () => {
  const input = reviewInput(`<w:p>${revision()}</w:p>`);
  const original = store.collectReviewItems(input);
  const derived = deriveLyraReview(input, { ...store, collectReviewItems: () => original });
  assert.equal(derived.items.length, 1);
  // Core owns revision dispatch identity; copying belongs at the public Lyra report boundary.
  assert.equal(derived.items[0], original[0]);
});
test('module callbacks derive each immutable part once across repeated paragraph layout queries', () => {
  const input = reviewInput(Array.from({ length: 80 }, (_, index) => `<w:p>${revision(String(index))}</w:p>`).join(''));
  let derivations = 0;
  const module = createLyraReviewModule({ ...store, collectReviewItems: input => { derivations++; return store.collectReviewItems(input); } }).review!;
  const all = module.collectReviewItems(input);
  for (let pass = 0; pass < 3; pass++) for (const item of all) {
    assert(item.kind === 'revision');
    const id = item.ranges[0]!.start.paragraphId;
    const local = module.revisionItemsOfParagraph(input.storyPart, id);
    assert.equal(local.length, 1); assert.equal(local[0], item);
    assert.equal(module.revisionItemsOfParagraph(input.storyPart, id), local);
  }
  assert.equal(module.collectReviewItems({ ...input, furnitureParts: [] }), all);
  assert.equal(module.revisionItemsOfParagraph(input.storyPart, 'missing').length, 0);
  assert.equal(derivations, 1);
});
test('combined module query cache observes each relevant part identity, including replaced furniture arrays', () => {
  const input = reviewInput(anchored, comment('0'));
  let derivations = 0;
  const module = createLyraReviewModule({ ...store, collectReviewItems: input => { derivations++; return store.collectReviewItems(input); } }).review!;
  const header = part('<w:p><w:r><w:t>Header</w:t></w:r></w:p>', '/word/header1.xml');
  let combined: ReviewModelInput = { ...input, furnitureParts: [header] };
  const all = module.collectReviewItems(combined), firstCount = derivations;
  assert.equal(module.collectReviewItems({ ...combined, furnitureParts: [header] }), all);
  assert.equal(derivations, firstCount);
  for (const change of [
    { stylesPart: xmlPart(`<w:styles xmlns:w="${W}"/>`, '/word/styles.xml') },
    { commentsPart: xmlPart(`<w:comments xmlns:w="${W}">${comment('0', 'Edited comment')}</w:comments>`, '/word/comments.xml') },
    { commentsExtendedPart: xmlPart('<w15:commentsEx xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"/>', '/word/commentsExtended.xml') },
    { furnitureParts: [part('<w:p><w:r><w:t>Changed header</w:t></w:r></w:p>', '/word/header1.xml')] },
  ]) {
    combined = { ...combined, ...change }; const before = derivations;
    const fresh = module.collectReviewItems(combined); assert(derivations > before);
    assert.equal(module.collectReviewItems({ ...combined }), fresh); assert.equal(derivations, before + 2);
  }
});
test('public core edits and history replace part identities so module caches never serve old ranges', () => {
  const session = headless(), module = createLyraReviewModule(store).review!;
  const originalPart = session.part(), original = module.collectReviewItems({ storyPart: originalPart })[0]!;
  assert(original.kind === 'revision'); const offset = original.ranges[0]!.start.offset;
  assert.equal(session.applyTreeOps([{ op: 'insertText', paragraphId: session.paragraphIds()[0]!, offset: 0, text: 'X' }]).committed, true);
  const changedPart = session.part(); assert.notEqual(changedPart, originalPart);
  const changed = module.collectReviewItems({ storyPart: changedPart })[0]!; assert(changed.kind === 'revision');
  assert.equal(changed.ranges[0]!.start.offset, offset + 1);
  session.undo(); assert.notEqual(session.part(), changedPart);
  const undone = module.collectReviewItems({ storyPart: session.part() })[0]!; assert(undone.kind === 'revision');
  assert.equal(undone.ranges[0]!.start.offset, offset);
  session.redo(); assert.notEqual(session.part(), originalPart);
  const redone = module.collectReviewItems({ storyPart: session.part() })[0]!; assert(redone.kind === 'revision');
  assert.equal(redone.ranges[0]!.start.offset, offset + 1);
});
test('comment-only core edits invalidate combined queries while retaining the unchanged body part', () => {
  const session = headless('<w:p><w:r><w:t>Words</w:t></w:r></w:p>'), module = createLyraReviewModule(store).review!;
  const id = session.replyToComment(null, { paragraphId: session.paragraphIds()[0]!, start: 0, end: 5 }, 'Note', 'Writer'); assert(id !== null);
  const input = (): ReviewModelInput => {
    const pkg = session.currentPackage(), storyPart = session.part();
    return { storyPart, commentsPart: pkg.parts.get(store.commentPartNameOf(pkg, storyPart.name)),
      commentsExtendedPart: pkg.parts.get(store.commentsExtendedPartNameOf(pkg, storyPart.name)) };
  };
  const before = input(), pending = module.collectReviewItems(before)[0]!; assert(pending.kind === 'comment');
  assert.equal(pending.resolved, false); assert.equal(session.setCommentResolved(id, true), true);
  const after = input(); assert.equal(after.storyPart, before.storyPart);
  assert(after.commentsPart !== before.commentsPart || after.commentsExtendedPart !== before.commentsExtendedPart);
  const resolved = module.collectReviewItems(after)[0]!; assert(resolved.kind === 'comment'); assert.equal(resolved.resolved, true);
  session.undo(); const undone = module.collectReviewItems(input())[0]!; assert(undone.kind === 'comment'); assert.equal(undone.resolved, false);
  session.redo(); const redone = module.collectReviewItems(input())[0]!; assert(redone.kind === 'comment'); assert.equal(redone.resolved, true);
});

function headless(body = `<w:p><w:r><w:t>Base </w:t></w:r>${revision()}</w:p>`) {
  const bytes = docxFixture({ 'word/document.xml': `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`, 'customXml/opaque.xml': '<unrelated><value>keep</value></unrelated>' });
  const opened = openTreeSession(bytes, { reviewModel: createLyraReviewModule(store).review }); assert(opened.ok);
  return opened.session;
}
test('registered review module participates in core comment transactions, undo and save/reopen', () => {
  const session = headless('<w:p><w:r><w:t>Words</w:t></w:r></w:p>');
  const paragraphId = session.paragraphIds()[0]!;
  let changes = 0; session.subscribe(() => changes++);
  const id = session.replyToComment(null, { paragraphId, start: 0, end: 5 }, 'A note', 'Reviewer'); assert(id !== null);
  assert.equal(changes, 1); assert.equal(session.reviewItems().length, 1);
  const reply = session.replyToComment(id, { paragraphId, start: 0, end: 5 }, 'An answer', 'Other'); assert(reply !== null);
  assert.equal(session.reviewItems().length, 2);
  assert.equal(session.setCommentResolved(id, true), true);
  assert(session.reviewItems().every(item => item.kind === 'comment' && item.resolved));
  session.undo(); assert(session.reviewItems().every(item => item.kind === 'comment' && !item.resolved));
  session.redo(); assert(session.reviewItems().every(item => item.kind === 'comment' && item.resolved));
  const saved = session.save(), reopened = openTreeSession(saved, { reviewModel: createLyraReviewModule(store).review }); assert(reopened.ok);
  assert.equal(reopened.session.reviewItems().length, 2);
  const beforeDelete = session.packageRevision(); assert.equal(session.deleteComment(id), true);
  assert.equal(session.packageRevision(), beforeDelete + 1); assert.equal(session.reviewItems().length, 0);
  session.undo(); assert.equal(session.reviewItems().length, 2);
  assert.equal(new TextDecoder().decode(unzipSync(saved)['customXml/opaque.xml']), '<unrelated><value>keep</value></unrelated>');
});
test('simple core revision decisions preserve the opposite outcome through undo and save/reopen', () => {
  for (const op of ['acceptRevision', 'rejectRevision'] as const) {
    const session = headless(), item = session.reviewItems()[0]!; assert(item.kind === 'revision');
    const result = session.applyTreeOps([{ op, revision: item.address }]); assert.equal(result.rejected, false); assert.equal(result.committed, true);
    assert.equal(session.reviewItems().length, 0); assert.equal(session.bodyText(), op === 'acceptRevision' ? 'Base added' : 'Base ');
    const reopened = openTreeSession(session.save(), { reviewModel: createLyraReviewModule(store).review }); assert(reopened.ok);
    assert.equal(reopened.session.bodyText(), session.bodyText());
    session.undo(); assert.equal(session.reviewItems().length, 1); session.redo(); assert.equal(session.reviewItems().length, 0);
  }
});

function harness(options: { body?: string; dependencies?: typeof store } = {}) {
  const session = headless(options.body);
  const state = { generation: 0, calls: [] as string[], mode: 'editing' as 'editing' | 'suggesting', author: '', mutation: () => {}, guard: (): DocxResult<void> => ({ ok: true, value: undefined }),
    result: { ok: true, changed: true } as ExecResult, detached: false };
  const surface = { session };
  const editor = {
    get surface() { return state.detached ? null : surface; }, get mountGeneration() { return state.generation; }, getEditingMode: () => state.mode,
    setAuthor(author: string) { state.author = author; },
    exec(command: EditorCommand) { state.calls.push(command.type); if (state.result.ok && command.type === 'setEditingMode' && command.mode !== 'viewing') state.mode = command.mode; return state.result; },
    setActiveReviewItem() { state.calls.push('navigate'); return state.result; },
    acceptReviewItem() { state.calls.push('accept'); return state.result; }, rejectReviewItem() { state.calls.push('reject'); return state.result; },
    addComment() { state.calls.push('add'); return state.result; }, replyToReviewItem() { state.calls.push('reply'); return state.result; },
    setCommentResolved() { state.calls.push('resolve'); return state.result; }, deleteReviewItem() { state.calls.push('delete'); return state.result; },
  } as unknown as DocxEditorInstance;
  const helper = createEigenpalReview(() => editor, { navigate: run => run(), mutate: run => { state.mutation(); return run(); }, guard: () => state.guard() }, options.dependencies ?? store);
  return { helper, state, session, editor };
}
test('private review targets are copied and invalidate after commits, generation changes and disposal', () => {
  for (const invalidate of ['commit', 'generation', 'explicit', 'dispose']) {
    const h = harness(), report = h.helper.query(), item = report.items[0]!;
    assert(Object.isFrozen(report) && Object.isFrozen(report.items) && Object.isFrozen(item));
    assert.equal(Object.keys(item).includes('id'), false); assert.equal(Object.keys(item).includes('key'), false);
    if (invalidate === 'commit') h.session.applyTreeOps([{ op: 'insertText', paragraphId: h.session.paragraphIds()[0]!, offset: 0, text: 'new' }]);
    else if (invalidate === 'generation') h.state.generation++;
    else if (invalidate === 'explicit') h.helper.invalidate(); else h.helper.dispose();
    assert.equal(h.helper.decide(item.token, 'accept').ok, false); assert.equal(h.state.calls.length, 0);
  }
});
test('mutation settlement and ownership gates cannot retarget a revision', () => {
  const h = harness(), token = h.helper.query().items[0]!.token;
  h.state.mutation = () => h.helper.invalidate();
  assert.deepEqual(h.helper.decide(token, 'accept'), { ok: false, code: 'stale-revision' });
  h.state.mutation = () => {}; const fresh = h.helper.query().items[0]!.token;
  h.state.guard = () => ({ ok: false, code: 'composing' });
  assert.deepEqual(h.helper.decide(fresh, 'accept'), { ok: false, code: 'composing' }); assert.equal(h.state.calls.length, 0);
});
test('resolved comments do not advertise or dispatch replies until reopened', () => {
  const h = harness(), paragraphId = h.session.paragraphIds()[0]!;
  const id = h.session.replyToComment(null, { paragraphId, start: 0, end: 4 }, 'A comment', 'Writer'); assert(id !== null);
  assert.equal(h.session.setCommentResolved(id, true), true);
  const item = h.helper.query().items.find(item => item.kind === 'comment')!;
  assert.deepEqual(h.helper.can({ type: 'reply-comment', id: 'opaque', author: 'Writer', text: 'Reply' }, item.token), { enabled: false, reason: 'unsupported' });
  assert.equal(h.helper.reply(item.token, 'Reply', 'Writer').ok, false); assert.equal(h.state.calls.length, 0);
  assert.equal(h.session.setCommentResolved(id, false), true);
  const reopened = h.helper.query().items.find(item => item.kind === 'comment')!;
  assert.equal(h.helper.can({ type: 'reply-comment', id: 'opaque', author: 'Writer', text: 'Reply' }, reopened.token).enabled, true);
});
test('helper decisions dispatch only the matching verb and successful tracking changes no document revision', () => {
  const h = harness(), token = h.helper.query().items[0]!.token, before = h.session.packageRevision();
  assert.equal(h.helper.decide(token, 'resolve').ok, false); assert.equal(h.helper.decide(token, 'accept').ok, true);
  assert.equal(h.helper.navigate(token).ok, true); assert.equal(h.helper.setTracking(true, '').ok, false);
  assert.equal(h.helper.setTracking(true, 'Writer').ok, true);
  assert.equal(h.session.packageRevision(), before); assert.equal(h.helper.query().enabled, true); assert.equal(h.helper.query().author, 'Writer');
  assert.equal(h.helper.setTracking(false, 'Writer').ok, true); assert.equal(h.helper.query().enabled, false);
  assert.deepEqual(h.state.calls, ['accept', 'navigate', 'setEditingMode', 'setEditingMode']);
});
test('tracking eligibility refuses complex body structures and untouched default stays editing', () => {
  const h = harness(); assert.equal(h.helper.query().enabled, false);
  const node = h.session.part().root as OoxmlElement;
  // A fresh immutable package is supplied by core when a table is inserted.
  const result = h.session.applyTreeOps([{ op: 'insertTable', beforeParagraphId: h.session.paragraphIds()[0]!, rows: 1, cols: 1, columnWidthTwips: 1440 }]);
  assert.equal(result.rejected, false); assert.notEqual(h.session.part().root, node);
  assert.equal(h.helper.setTracking(true, 'Writer').ok, false); assert.equal(h.state.calls.length, 0);
});
test('simple text revisions retain exact engine offsets and can be reviewed', () => {
  const result = deriveLyraReview({ storyPart: part('<w:p><w:r><w:t>😀 </w:t></w:r><w:ins w:id="1" w:author="Writer"><w:r><w:t>added</w:t></w:r></w:ins></w:p>') }, store);
  assert.equal(result.items.length, 1);
  const item = result.items[0]!; assert.equal(item.kind, 'revision');
  if (item.kind !== 'revision') return;
  assert.equal(item.ranges[0]?.start.offset, 3); assert.equal(item.ranges[0]?.end.offset, 8);
  assert.equal(item.readOnly, false); assert.equal(result.trackingSupported, true);
});
test('review normalization rejects accessors and XML-invalid author text', () => {
  let reads = 0;
  assert.equal(normalizeDocxReviewAction({ type: 'add-comment', get text() { reads++; return 'Text'; }, author: 'A' }).ok, false);
  assert.equal(reads, 0);
  assert.equal(normalizeDocxReviewAction({ type: 'add-comment', text: 'Text', author: '\u0000' }).ok, false);
  assert.equal(normalizeDocxReviewAction({ type: 'review-decision', id: 'target', decision: { toString() { reads++; return 'accept'; } } }).ok, false);
  assert.equal(reads, 0);
});

test('a command the engine rejects is reported as unsupported for navigation, decisions, comments and tracking', () => {
  const h = harness(), token = h.helper.query().items[0]!.token;
  h.state.result = { ok: false, code: 'unsupported', reason: 'refused by the engine' };
  for (const [label, run] of [
    ['navigate', () => h.helper.navigate(token)], ['accept', () => h.helper.decide(token, 'accept')],
    ['comment', () => h.helper.addComment('Note', 'Writer')], ['tracking', () => h.helper.setTracking(true, 'Writer')],
  ] as const) assert.deepEqual(run(), { ok: false, code: 'unsupported' }, label);
  assert.deepEqual(h.state.calls, ['navigate', 'accept', 'add', 'setEditingMode']);
  assert.equal(h.helper.query().enabled, false);
  h.state.result = { ok: true, changed: true };
  assert.deepEqual(h.helper.addComment('Note', 'Writer'), { ok: true, value: undefined });
  assert.deepEqual(h.state.calls.slice(-1), ['add']);
});

test('review text is clipped to its ceilings without dividing a surrogate pair', () => {
  const pair = '\u{1F600}';
  // The pair straddles each ceiling, so a cut that keeps its first unit would leave a lone surrogate.
  const straddling = (limit: number) => `${'a'.repeat(limit - 1)}${pair}tail`;
  const body = `<w:p><w:r><w:t>Base </w:t></w:r>${revision('1', straddling(128), straddling(4096), 'ins', straddling(64))}<w:r><w:t> gap </w:t></w:r>${revision('2', 'b'.repeat(128), 'c'.repeat(4097))}</w:p>`;
  const h = harness({ body }), items = h.helper.query().items;
  assert.deepEqual(items.map(item => [item.author.length, item.text.length, item.date?.length]), [[127, 4095, 63], [128, 4096, undefined]]);
  assert.deepEqual(items.map(item => [item.author.at(-1), item.text.at(-1), item.date?.at(-1)]), [['a', 'a', 'a'], ['b', 'c', undefined]]);
  const paragraphId = h.session.paragraphIds()[0]!;
  assert(h.session.replyToComment(null, { paragraphId, start: 0, end: 4 }, straddling(4096), straddling(128)) !== null);
  const note = h.helper.query().items.find(item => item.kind === 'comment')!;
  assert.deepEqual([note.author.length, note.text.length, note.author.at(-1), note.text.at(-1)], [127, 4095, 'a', 'a']);
});

test('a helper without a document surface reports nothing and refuses every operation', () => {
  const h = harness(), token = h.helper.query().items[0]!.token;
  assert.deepEqual(h.helper.setTracking(true, 'Writer'), { ok: true, value: undefined });
  h.state.detached = true;
  const report = h.helper.query();
  assert.deepEqual(report, { items: [], truncated: false, hasUnsupported: false, trackingSupported: false, enabled: false, author: 'Writer' });
  assert(Object.isFrozen(report) && Object.isFrozen(report.items));
  assert.deepEqual(h.helper.can({ type: 'add-comment', text: 'Note', author: 'Writer' }), { enabled: false, reason: 'unsupported' });
  assert.deepEqual(h.helper.addComment('Note', 'Writer'), { ok: false, code: 'unsupported' });
  assert.deepEqual(h.helper.setTracking(false, 'Writer'), { ok: false, code: 'unsupported' });
  assert.deepEqual(h.helper.decide(token, 'accept'), { ok: false, code: 'stale-revision' });
  assert.deepEqual(h.state.calls, ['setEditingMode']);
});

test('a disposed helper reports an empty queue and destroyed results, but still validates arguments first', () => {
  const h = harness(), token = h.helper.query().items[0]!.token;
  assert.deepEqual(h.helper.setTracking(true, 'Writer'), { ok: true, value: undefined });
  h.helper.dispose();
  assert.deepEqual(h.helper.query(), { items: [], truncated: false, hasUnsupported: false, trackingSupported: false, enabled: false, author: null });
  assert.deepEqual(h.helper.can({ type: 'add-comment', text: 'Note', author: 'Writer' }), { enabled: false, reason: 'destroyed' });
  assert.deepEqual(h.helper.can({ type: 'add-comment', text: ' ', author: 'Writer' }), { enabled: false, reason: 'invalid-option' });
  assert.deepEqual(h.helper.addComment('Note', 'Writer'), { ok: false, code: 'destroyed' });
  assert.deepEqual(h.helper.addComment('', 'Writer'), { ok: false, code: 'invalid-option' });
  assert.deepEqual(h.helper.setTracking(false, 'Writer'), { ok: false, code: 'destroyed' });
  assert.deepEqual(h.helper.reply(token, 'Answer', 'Writer'), { ok: false, code: 'destroyed' });
  assert.deepEqual(h.state.calls, ['setEditingMode']);
});

test('comment and tracking arguments are validated before the engine is touched', () => {
  const h = harness(), token = h.helper.query().items[0]!.token;
  for (const [text, writer, code] of [['', 'Writer', 'invalid-option'], ['Note', '  ', 'invalid-option'], ['\ud800', 'Writer', 'invalid-option'],
    ['x'.repeat(4097), 'Writer', 'resource-limit'], ['Note', 'x'.repeat(129), 'resource-limit']] as const) {
    assert.deepEqual(h.helper.addComment(text, writer), { ok: false, code }, `${text.length}/${writer.length}`);
    assert.deepEqual(h.helper.reply(token, text, writer), { ok: false, code }, `${text.length}/${writer.length}`);
    assert.deepEqual(h.helper.can({ type: 'add-comment', text, author: writer }), { enabled: false, reason: code }, `${text.length}/${writer.length}`);
  }
  assert.deepEqual(h.helper.setTracking(true, 'x'.repeat(129)), { ok: false, code: 'resource-limit' });
  assert.deepEqual(h.state.calls, []);
});

test('a review queue past the item ceiling is shown in part but allows neither decisions nor new authoring', () => {
  const body = Array.from({ length: 1001 }, (_, index) => `<w:p>${revision(String(index + 1))}</w:p>`).join('');
  const h = harness({ body }), report = h.helper.query();
  assert.equal(report.items.length, 100); assert.equal(report.truncated, true); assert.equal(report.trackingSupported, false);
  for (const action of [{ type: 'add-comment', text: 'Note', author: 'Writer' }, { type: 'track-changes', enabled: true, author: 'Writer' },
    { type: 'review-decision', id: 'opaque', decision: 'accept' }] as const) {
    assert.deepEqual(h.helper.can(action, report.items[0]!.token), { enabled: false, reason: 'resource-limit' }, action.type);
  }
  // Switching tracking off stays possible: it removes authoring, it never adds any.
  assert.deepEqual(h.helper.can({ type: 'track-changes', enabled: false, author: 'Writer' }), { enabled: true, active: false });
  assert.deepEqual(h.helper.decide(report.items[0]!.token, 'accept'), { ok: false, code: 'unsupported' });
  assert.deepEqual(h.helper.addComment('Note', 'Writer'), { ok: false, code: 'unsupported' });
  assert.deepEqual(h.helper.setTracking(true, 'Writer'), { ok: false, code: 'unsupported' });
  assert.deepEqual(h.state.calls, []);
});

test('decision availability needs a live private target', () => {
  const h = harness(), decision = { type: 'review-decision', id: 'opaque', decision: 'accept' } as const;
  const token = h.helper.query().items[0]!.token;
  assert.deepEqual(h.helper.can(decision, token), { enabled: true });
  assert.deepEqual(h.helper.can(decision), { enabled: false, reason: 'stale-revision' });
  assert.deepEqual(h.helper.can(decision, {}), { enabled: false, reason: 'stale-revision' });
  assert.deepEqual(h.helper.can({ ...decision, decision: 'resolve' }, token), { enabled: false, reason: 'unsupported' });
  h.helper.invalidate();
  assert.deepEqual(h.helper.can(decision, token), { enabled: false, reason: 'stale-revision' });
});

test('tracking changes and new comments yield to the ownership gate and to any change that lands while they are prepared', () => {
  let onDerive = () => {}, derivations = 0;
  const dependencies = { ...store, collectReviewItems: (...args: Parameters<typeof store.collectReviewItems>) => { derivations++; onDerive(); return store.collectReviewItems(...args); } };
  const h = harness({ dependencies });
  const operations = [['tracking', () => h.helper.setTracking(true, 'Writer')], ['comment', () => h.helper.addComment('Note', 'Writer')]] as const;
  h.state.guard = () => ({ ok: false, code: 'composing' });
  for (const [label, run] of operations) assert.deepEqual(run(), { ok: false, code: 'composing' }, label);
  h.state.guard = () => ({ ok: true, value: undefined });
  h.state.mutation = () => h.helper.invalidate();
  for (const [label, run] of operations) assert.deepEqual(run(), { ok: false, code: 'stale-revision' }, label);
  // A preparation that is already stale does no derivation work.
  assert.equal(derivations, 0);
  h.state.mutation = () => {};
  // A change that lands while the review is derived retires the preparation just as an earlier one does.
  for (const [label, run] of operations) {
    h.helper.invalidate();
    onDerive = () => { h.state.generation++; };
    assert.deepEqual(run(), { ok: false, code: 'stale-revision' }, label);
    onDerive = () => {}; h.state.generation = 0;
  }
  assert.deepEqual(h.state.calls, []); assert.equal(h.state.author, ''); assert.equal(h.helper.query().author, null);
  assert.deepEqual(h.helper.setTracking(true, 'Writer'), { ok: true, value: undefined });
});

test('derivation refuses an element that carries more attributes than the node budget allows', () => {
  const crowded = reviewInput('<w:p w:a="1" w:b="2" w:c="3" w:d="4" w:e="5"/>');
  assert.deepEqual(deriveLyraReview(crowded, store, { nodes: 4 }), { items: [], truncated: true, trackingSupported: false, hasUnsupported: true });
  const fits = deriveLyraReview(crowded, store, { nodes: 5 });
  assert.equal(fits.truncated, false); assert.equal(fits.trackingSupported, true);
});

test('tracked authoring is offered only for a document with one plain body', () => {
  const simple = '<w:p><w:r><w:t>Words</w:t></w:r></w:p>';
  const document = (inner: string) => `<w:document xmlns:w="${W}">${inner}</w:document>`;
  const supported = (xml: string) => deriveLyraReview({ storyPart: xmlPart(xml, '/word/document.xml') }, store).trackingSupported;
  assert.equal(supported(document(`<w:body>${simple}</w:body>`)), true);
  for (const [label, xml] of [
    ['a part that is not a document, even when it wraps a body', `<w:hdr xmlns:w="${W}"><w:body>${simple}</w:body></w:hdr>`],
    ['a document without a body', document('')],
    ['a document with two bodies', document(`<w:body>${simple}</w:body><w:body>${simple}</w:body>`)],
    ['a document with content beside its body', document(`<w:body>${simple}</w:body><w:background/>`)],
    ['a document whose only child is not a body', document('<w:background/>')],
  ] as const) assert.equal(supported(xml), false, label);
});

test('a revision that wraps a whole part is listed but never offered as a decision', () => {
  const wrapped = xmlPart(`<w:ins xmlns:w="${W}" w:id="1" w:author="Writer"><w:r><w:t>wrapped</w:t></w:r></w:ins>`, '/word/document.xml');
  const result = deriveLyraReview({ storyPart: wrapped }, store), item = result.items[0]!;
  assert.equal(result.items.length, 1); assert.equal(item.kind, 'revision');
  assert.equal(item.kind === 'revision' && item.readOnly, true);
  assert.equal(result.hasUnsupported, true); assert.equal(result.trackingSupported, false);
});

test('ambiguous comment identifiers receive synthetic identities that never collide with authored ones', () => {
  const input = reviewInput(anchored, comment('dup', 'First') + comment('dup', 'Second') + comment('lyra-ambiguous-0', 'Third'));
  const result = deriveLyraReview(input, store);
  assert.deepEqual(result.items.map(item => item.kind === 'comment' ? item.id : null), ['_lyra-ambiguous-0', 'lyra-ambiguous-1', 'lyra-ambiguous-0']);
  assert.equal(new Set(result.items.map(item => store.reviewItemKey(item))).size, 3);
  assert(result.items.every(item => item.kind === 'comment' && item.orphaned));
});
