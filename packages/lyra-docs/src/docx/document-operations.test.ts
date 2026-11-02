import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCX_BATCH_LIMITS, DOCX_FRAGMENT_LIMITS, normalizeDocxBatch, normalizeFragmentRequest } from './document-operations.js';

const revision = { documentId: 'doc', value: 3 };

test('fragment requests default, bound and copy their fields', () => {
  assert.deepEqual(normalizeFragmentRequest(undefined), { ok: true, value: { start: 0, maxBlocks: 16, maxText: 8192 } });
  assert.deepEqual(normalizeFragmentRequest({ start: 4, maxBlocks: 64, maxText: 32_768, expectedRevision: revision }),
    { ok: true, value: { start: 4, maxBlocks: 64, maxText: 32_768, expectedRevision: revision } });
  assert.deepEqual(normalizeFragmentRequest({ outlineItemId: 'abc', maxBlocks: 1, maxText: 1 }),
    { ok: true, value: { start: 0, outlineItemId: 'abc', maxBlocks: 1, maxText: 1 } });
  const invalid = [
    { start: -1 }, { start: 1.5 }, { start: DOCX_FRAGMENT_LIMITS.bodyBlocks + 1 }, { start: '1' }, { start: 0, outlineItemId: 'a' },
    { outlineItemId: '' }, { outlineItemId: 'x'.repeat(129) }, { maxBlocks: 0 }, { maxBlocks: 65 }, { maxText: 0 }, { maxText: 32_769 },
    { maxText: Number.NaN }, { expectedRevision: { documentId: 'doc' } }, { expectedRevision: null }, { extra: true }, [], 'request',
    Object.defineProperty({}, 'start', { get: () => 0, enumerable: true }),
  ];
  for (const request of invalid) assert.deepEqual(normalizeFragmentRequest(request), { ok: false, code: 'invalid-option' }, JSON.stringify(request));
});

test('a batch is validated and copied as a whole before anything runs', () => {
  const steps = [{ edit: 'bold' }, { edit: { type: 'paragraph-style', styleId: 'Heading1' }, target: 'block' },
    { edit: { type: 'font-size', points: 12 } }, { edit: { type: 'highlight', color: 'none' } }];
  const result = normalizeDocxBatch(steps, { expectedRevision: revision });
  assert(result.ok);
  assert.deepEqual(result.value, { steps, expectedRevision: revision });
  assert(Object.isFrozen(result.value.steps) && Object.isFrozen(result.value.steps[1]));
  assert.notEqual(result.value.steps[1]!.edit, steps[1]!.edit, 'edits are copied');
});

test('batch refusals name the failing step, or none for the batch as a whole', () => {
  const ok = { expectedRevision: revision };
  const cases: [unknown, unknown, string, number | null][] = [
    [[{ edit: 'bold' }], {}, 'invalid-option', null],
    [[{ edit: 'bold' }], { expectedRevision: { documentId: '', value: 0 } }, 'invalid-option', null],
    [[{ edit: 'bold' }], { expectedRevision: revision, extra: 1 }, 'invalid-option', null],
    [[{ edit: 'bold' }], null, 'invalid-option', null],
    [[], ok, 'invalid-option', null],
    ['bold', ok, 'invalid-option', null],
    [Object.assign(Object.create({ length: 1 }), { 0: { edit: 'bold' } }), ok, 'invalid-option', null],
    [Array.from({ length: DOCX_BATCH_LIMITS.steps + 1 }, () => ({ edit: 'bold' })), ok, 'resource-limit', null],
    [[{ edit: 'bold' }, { edit: 'undo' }], ok, 'unsupported', 1],
    [[{ edit: 'bold' }, { edit: { type: 'page-break' } }], ok, 'unsupported', 1],
    [[{ edit: { type: 'toggle-list', kind: 'bullet' } }], ok, 'unsupported', 0],
    [[{ edit: { type: 'indent', direction: 'increase' } }], ok, 'unsupported', 0],
    [[{ edit: { type: 'link', href: 'https://example.test' } }], ok, 'unsupported', 0],
    [[{ edit: { type: 'insert-table', rows: 1, columns: 1 } }], ok, 'unsupported', 0],
    [[{ edit: { type: 'add-comment', text: 'x', author: 'y' } }], ok, 'unsupported', 0],
    [[{ edit: 'shout' }], ok, 'invalid-option', 0],
    [[{ edit: { type: 'font-size', points: 0 } }], ok, 'invalid-option', 0],
    [[{ edit: { type: 'paragraph-style', styleId: 'x'.repeat(129) } }], ok, 'resource-limit', 0],
    [[{ edit: 'bold', target: 'block' }], ok, 'invalid-option', 0],
    [[{ edit: { type: 'font-family', family: 'Arial' }, target: 'block' }], ok, 'invalid-option', 0],
    [[{ edit: { type: 'alignment', value: 'center' }, target: '' }], ok, 'invalid-option', 0],
    [[{ edit: { type: 'alignment', value: 'center' }, target: 7 }], ok, 'invalid-option', 0],
    [[{ edit: 'bold' }, { edit: 'bold', extra: 1 }], ok, 'invalid-option', 1],
    [[{ edit: 'bold' }, null], ok, 'invalid-option', 1],
    [[{ edit: 'bold' }, , { edit: 'bold' }], ok, 'invalid-option', 1],
    [[Object.defineProperty({}, 'edit', { get: () => 'bold', enumerable: true })], ok, 'invalid-option', 0],
  ];
  for (const [steps, options, code, step] of cases) {
    assert.deepEqual(normalizeDocxBatch(steps, options), { ok: false, code, step }, JSON.stringify([steps, options]));
  }
  const hostile = new Proxy([{ edit: 'bold' }], { getOwnPropertyDescriptor() { throw new Error('trap'); } });
  assert.deepEqual(normalizeDocxBatch(hostile, ok), { ok: false, code: 'invalid-option', step: null });
});
