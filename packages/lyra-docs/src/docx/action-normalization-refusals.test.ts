import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDocxImageAction, isDocxTableAction, normalizeDocxAction, normalizeDocxSearch } from './commands.js';
import { isDocxReviewAction, normalizeDocxReviewAction } from './review-types.js';
import type { DocxAction } from './types.js';

const invalid = { ok: false, code: 'invalid-option' };
const limited = { ok: false, code: 'resource-limit' };
const unsupported = { ok: false, code: 'unsupported' };

/** Objects whose reflection throws, which a caller can hand to any public entry point. */
function hostileObjects(): [string, object][] {
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  return [
    ['a proxy whose key listing throws', new Proxy({}, { ownKeys() { throw new Error('keys'); } })],
    ['a proxy whose descriptor lookup throws', new Proxy({ type: 'bold' }, { getOwnPropertyDescriptor() { throw new Error('descriptor'); } })],
    ['a proxy whose prototype lookup throws', new Proxy({}, { getPrototypeOf() { throw new Error('prototype'); } })],
    ['a revoked proxy', revoked.proxy],
  ];
}

test('refuses an action that carries a field its kind does not define', () => {
  const kinds: Record<string, object> = {
    link: { type: 'link', href: '#bookmark', text: 'label' },
    'resize-image': { type: 'resize-image', widthPoints: 10, heightPoints: 20 },
    'image-description': { type: 'image-description', title: 'Title', description: 'Description' },
    'paragraph-style': { type: 'paragraph-style', styleId: 'Heading1' },
  };
  for (const [kind, action] of Object.entries(kinds)) {
    assert.deepEqual(normalizeDocxAction(action), { ok: true, value: action }, kind);
    assert.deepEqual(normalizeDocxAction({ ...action, extra: true }), invalid, kind);
  }
});

test('contains hostile objects instead of throwing from every normalizer', () => {
  for (const [label, hostile] of hostileObjects()) {
    assert.deepEqual(normalizeDocxAction(hostile), invalid, label);
    assert.deepEqual(normalizeDocxSearch('needle', hostile), invalid, label);
    assert.deepEqual(normalizeDocxReviewAction(hostile), invalid, label);
  }
});

test('refuses review actions of another kind, with extra fields, past their text ceilings or with invalid values', () => {
  const kinds: Record<string, object> = {
    'add-comment': { type: 'add-comment', text: 'Note', author: 'Writer' },
    'reply-comment': { type: 'reply-comment', id: 'opaque', text: 'Answer', author: 'Writer' },
    'review-decision': { type: 'review-decision', id: 'opaque', decision: 'accept' },
    'track-changes': { type: 'track-changes', enabled: true, author: 'Writer' },
  };
  for (const [kind, action] of Object.entries(kinds)) {
    const result = normalizeDocxReviewAction(action);
    assert.ok(result.ok, kind);
    assert.deepEqual({ ...result.value }, action, kind);
    assert.equal(Object.isFrozen(result.value), true, kind);
    assert.deepEqual(normalizeDocxReviewAction({ ...action, extra: true }), invalid, kind);
    assert.deepEqual(normalizeDocxAction({ ...action, extra: true }), invalid, kind);
  }
  for (const value of [{ type: 'delete-comment' }, { type: 'insert-text', text: 'raw' }, { type: 7 }, {}]) {
    assert.deepEqual(normalizeDocxReviewAction(value), unsupported, JSON.stringify(value));
  }
  const ceilings = [
    { type: 'add-comment', text: 'x'.repeat(4097), author: 'Writer' },
    { type: 'add-comment', text: 'Note', author: 'x'.repeat(129) },
    { type: 'reply-comment', id: 'x'.repeat(257), text: 'Answer', author: 'Writer' },
    { type: 'review-decision', id: 'x'.repeat(257), decision: 'accept' },
    { type: 'track-changes', enabled: false, author: 'x'.repeat(129) },
  ];
  for (const value of ceilings) {
    assert.deepEqual(normalizeDocxReviewAction(value), limited, JSON.stringify(value).slice(0, 60));
    assert.deepEqual(normalizeDocxAction(value), limited, JSON.stringify(value).slice(0, 60));
  }
  for (const value of [
    { type: 'add-comment', text: '   ', author: 'Writer' }, { type: 'add-comment', text: 'Note', author: '\ud800' },
    { type: 'track-changes', enabled: 'yes', author: 'Writer' }, { type: 'review-decision', id: 'opaque', decision: 'archive' },
    { type: 'review-decision', id: 'opaque', decision: 7 },
  ]) assert.deepEqual(normalizeDocxReviewAction(value), invalid, JSON.stringify(value));
});

test('classifies every normalized action into at most one of the table, image and review families', () => {
  const normalized = (value: unknown): DocxAction => {
    const result = normalizeDocxAction(value);
    assert.ok(result.ok, JSON.stringify(value));
    return result.value;
  };
  const table = [
    { type: 'insert-table', rows: 2, columns: 2 }, { type: 'insert-table-row', where: 'above' }, { type: 'insert-table-column', where: 'left' },
    { type: 'delete-table-row' }, { type: 'delete-table-column' }, { type: 'delete-table' }, { type: 'table-header-row', enabled: true },
    { type: 'table-cell-alignment', value: 'top' }, { type: 'table-cell-shading', color: null },
    { type: 'table-cell-borders', target: 'all', style: 'none' }, { type: 'table-width', widthPoints: 100 },
  ];
  const image = [{ type: 'resize-image', widthPoints: 10, heightPoints: 10 }, { type: 'image-description', title: '', description: '' }, { type: 'delete-image' }];
  const review = [
    { type: 'add-comment', text: 'Note', author: 'Writer' }, { type: 'reply-comment', id: 'opaque', text: 'Answer', author: 'Writer' },
    { type: 'review-decision', id: 'opaque', decision: 'reject' }, { type: 'track-changes', enabled: false, author: 'Writer' },
  ];
  const other = ['bold', 'undo', { type: 'alignment', value: 'left' }, { type: 'link', href: '#bookmark' }, { type: 'page-break' }];
  const families = [['table', isDocxTableAction, table], ['image', isDocxImageAction, image], ['review', isDocxReviewAction, review]] as const;
  const classify = (action: DocxAction) => families.filter(([, belongs]) => belongs(action)).map(([family]) => family);
  for (const [family, , members] of families) {
    for (const value of members) assert.deepEqual(classify(normalized(value)), [family], JSON.stringify(value));
  }
  for (const value of other) assert.deepEqual(classify(normalized(value)), [], JSON.stringify(value));
});
