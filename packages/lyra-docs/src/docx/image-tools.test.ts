import assert from 'node:assert/strict';
import test from 'node:test';
import {
  captureImageToolIntent, imageDescriptionDraft, imageResizeDraft, imageResizeUnchanged,
  imageDimensionDraft, imageRatioPartner,
} from './image-tools.js';
import type { DocxImageAction, DocxRefusalCode, DocxSession, DocxSnapshot } from './types.js';

function fixture() {
  let releases = 0, reads = 0, retain = true;
  let descriptionRefusal: DocxRefusalCode | null = null;
  const calls: { action: DocxImageAction; options: unknown }[] = [];
  let snapshot = { status: 'ready', activity: null, composing: false, readOnly: false,
    revision: { documentId: 'doc', value: 0 }, selection: { kind: 'other', version: 1 },
    image: { widthPoints: 12701 / 12700, heightPoints: 2 } } as unknown as DocxSnapshot;
  let onRead = () => {}, onRetain = () => {};
  const session = { snapshot: () => snapshot,
    retainSelection: () => { onRetain(); return retain ? { ok: true, value: { release() { releases++; } } } : { ok: false, code: 'busy' }; },
    imageDescription: () => { reads++; onRead(); return descriptionRefusal ? { ok: false, code: descriptionRefusal } :
      { ok: true, value: { title: 'Title', description: 'Text' } }; },
    execute: (action: DocxImageAction, options: unknown) => { calls.push({ action, options }); return { ok: true, value: snapshot.revision }; },
  } as unknown as DocxSession;
  return { session, calls, releases: () => releases, reads: () => reads,
    change(next: Partial<DocxSnapshot>) { snapshot = { ...snapshot, ...next }; },
    onRead(value: () => void) { onRead = value; },
    onRetain(value: () => void) { onRetain = value; },
    refuseRetain() { retain = false; }, refuseDescription(code: DocxRefusalCode) { descriptionRefusal = code; } };
}

test('image drafts preserve committed EMUs and accept only complete bounded decimals', () => {
  const image = { widthPoints: 12701 / 12700, heightPoints: 182881 / 12700 };
  const action = imageResizeDraft(imageDimensionDraft(image.widthPoints), imageDimensionDraft(image.heightPoints));
  assert.ok(action);
  assert.equal(imageResizeUnchanged(action, image), true);
  assert.equal(imageResizeUnchanged({ type: 'resize-image', widthPoints: 2, heightPoints: 3 }, image), false);
  assert.deepEqual(imageResizeDraft('1', '1440'), { type: 'resize-image', widthPoints: 1, heightPoints: 1440 });
  assert.deepEqual(imageResizeDraft('12.125', '2'), { type: 'resize-image', widthPoints: 12.125, heightPoints: 2 });
  for (const value of ['', ' ', '.', '-1', '0', '0.9', '1440.1', 'Infinity', 'NaN', '1e2', '1.', ' 2', '2 ', '1,5']) {
    assert.equal(imageResizeDraft(value, '2'), null, value);
    assert.equal(imageResizeDraft('2', value), null, value);
  }
});

test('aspect partners always use the captured original ratio, never rounded draft dimensions', () => {
  const original = { widthPoints: 7, heightPoints: 3 };
  assert.equal(Number(imageRatioPartner('14', 'width', original)), 6);
  assert.equal(Number(imageRatioPartner('6', 'height', original)), 14);
  assert.equal(Number(imageRatioPartner('8', 'width', original)), 8 * 3 / 7);
  assert.equal(imageRatioPartner('', 'width', original), null);
  assert.equal(imageRatioPartner('1440', 'height', original), null);
  assert.equal(imageRatioPartner('1', 'width', original), null);
});

test('image description drafts keep empty/Unicode metadata and reject limits or malformed XML', () => {
  assert.deepEqual(imageDescriptionDraft('', ''), { type: 'image-description', title: '', description: '' });
  assert.deepEqual(imageDescriptionDraft('A & B', 'Line\n😀'), { type: 'image-description', title: 'A & B', description: 'Line\n😀' });
  assert.ok(imageDescriptionDraft('x'.repeat(256), 'x'.repeat(2048)));
  assert.equal(imageDescriptionDraft('x'.repeat(257), ''), null);
  assert.equal(imageDescriptionDraft('', 'x'.repeat(2049)), null);
  assert.equal(imageDescriptionDraft('\u0000', ''), null);
  assert.equal(imageDescriptionDraft('', '\ud800'), null);
});

test('image intent reads only on demand and uses exactly one original lease', () => {
  const f = fixture(), intent = captureImageToolIntent(f.session)!;
  assert.equal(f.reads(), 0);
  assert.equal(intent.valid(f.session), true);
  const description = intent.description(f.session);
  assert.deepEqual(description, { ok: true, value: { title: 'Title', description: 'Text' } });
  assert.equal(Object.isFrozen(intent.image), true);
  assert.equal(Object.isFrozen(description.ok && description.value), true);
  assert.equal(intent.execute(f.session, { type: 'delete-image' }).ok, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.releases(), 1);
  assert.deepEqual(intent.execute(f.session, { type: 'delete-image' }), { ok: false, code: 'stale-selection' });
  intent.release();
  assert.equal(f.releases(), 1);
});

test('image intent rejects reselection, revision, replacement and released state without live fallback', () => {
  for (const kind of ['selection', 'revision', 'document', 'session', 'release', 'image', 'status']) {
    const f = fixture(), intent = captureImageToolIntent(f.session)!;
    let target = f.session;
    if (kind === 'selection') f.change({ selection: { kind: 'other', version: 3 } });
    if (kind === 'revision') f.change({ revision: { documentId: 'doc', value: 1 } });
    if (kind === 'document') f.change({ revision: { documentId: 'other', value: 0 } });
    if (kind === 'session') target = fixture().session;
    if (kind === 'release') intent.release();
    if (kind === 'image') f.change({ image: null });
    if (kind === 'status') f.change({ status: 'destroyed' });
    assert.equal(intent.valid(target), false, kind);
    assert.deepEqual(intent.description(target), { ok: false, code: 'stale-selection' });
    assert.deepEqual(intent.execute(target, { type: 'delete-image' }), { ok: false, code: 'stale-selection' });
    assert.equal(f.calls.length, 0); assert.equal(f.reads(), 0); assert.equal(f.releases(), 1);
  }
  const f = fixture(); f.change({ image: null });
  assert.equal(captureImageToolIntent(f.session), null);
  assert.equal(captureImageToolIntent(null), null);
});

test('image draft read revalidates original selection after synchronous observer changes', () => {
  const f = fixture(), intent = captureImageToolIntent(f.session)!;
  f.onRead(() => f.change({ selection: { kind: 'other', version: 2 } }));
  assert.deepEqual(intent.description(f.session), { ok: false, code: 'stale-selection' });
  assert.deepEqual(intent.execute(f.session, { type: 'delete-image' }), { ok: false, code: 'stale-selection' });
  assert.equal(f.calls.length, 0); assert.equal(f.releases(), 1);
});

test('intent capture refuses unavailable or reentrantly changed retention and clears its lease', () => {
  const unavailable = fixture(); unavailable.refuseRetain();
  assert.equal(captureImageToolIntent(unavailable.session), null);
  assert.equal(unavailable.releases(), 0);
  const changed = fixture(); changed.onRetain(() => changed.change({ selection: { kind: 'other', version: 2 } }));
  assert.equal(captureImageToolIntent(changed.session), null);
  assert.equal(changed.releases(), 1);
  const revision = fixture(); revision.change({ revision: null });
  assert.equal(captureImageToolIntent(revision.session), null);
  const status = fixture(); status.change({ status: 'opening' });
  assert.equal(captureImageToolIntent(status.session), null);
});

test('image capture binds dimensions and lease to one snapshot', () => {
  const f = fixture(); let reads = 0;
  const session = { ...f.session, snapshot: () => {
    if (++reads === 2) f.change({ revision: { documentId: 'doc', value: 1 }, image: { widthPoints: 12, heightPoints: 7 } });
    return f.session.snapshot();
  } } as DocxSession;
  assert.equal(captureImageToolIntent(session), null);
  assert.equal(f.releases(), 1);
});

test('cached metadata refusal is preserved and read-only sessions may read complete metadata', () => {
  const f = fixture(), intent = captureImageToolIntent(f.session)!;
  f.refuseDescription('resource-limit');
  assert.deepEqual(intent.description(f.session), { ok: false, code: 'resource-limit' });
  intent.release();
  const readOnly = fixture(); readOnly.change({ readOnly: true });
  const readonlyIntent = captureImageToolIntent(readOnly.session)!;
  assert.equal(readonlyIntent.description(readOnly.session).ok, true);
  readonlyIntent.release();
});
