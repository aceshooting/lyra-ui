import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeDocxAction, normalizeDocxReplacement, normalizeDocxSearch } from './commands.js';

const invalid = { ok: false, code: 'invalid-option' };
const limited = { ok: false, code: 'resource-limit' };

test('preserves original commands and copies parameterized actions without caller ownership', () => {
  for (const value of ['bold', 'italic', 'underline', 'undo', 'redo']) {
    assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  }
  const action = { type: 'alignment', value: 'justify' };
  const result = normalizeDocxAction(action);
  assert.deepEqual(result, { ok: true, value: action });
  if (!result.ok) return;
  assert.notEqual(result.value, action);
  assert.equal(Object.isFrozen(result.value), true);
  action.value = 'left';
  assert.deepEqual(result.value, { type: 'alignment', value: 'justify' });
});

test('validates object shapes and refuses unsupported actions without throwing', () => {
  for (const value of [null, [], 1, true, {}, { type: 'alignment' }, { type: 'alignment', value: 'both' },
    { type: 'toggle-list', kind: 'ordered' }, { type: 'remove-link', href: 'https://example.com' },
    { type: 'font-size', points: 12, extra: true }, { type: 'alignment', value: 'left', [Symbol()]: 1 },
    Object.create({ type: 'remove-link' }), { get type() { throw new Error('untrusted getter'); } }]) {
    assert.deepEqual(normalizeDocxAction(value), invalid);
  }
  for (const value of ['selectAll', { type: 'insertText', text: 'raw' }]) {
    assert.deepEqual(normalizeDocxAction(value), { ok: false, code: 'unsupported' });
  }
});

test('accepts both list kinds and detaches normalized list actions from caller mutation', () => {
  for (const kind of ['bullet', 'numbered']) {
    const action = { type: 'toggle-list', kind };
    const result = normalizeDocxAction(action);
    assert.deepEqual(result, { ok: true, value: action });
    if (!result.ok) continue;
    assert.notEqual(result.value, action);
    assert.equal(Object.isFrozen(result.value), true);
    action.kind = 'unsupported';
    assert.deepEqual(result.value, { type: 'toggle-list', kind });
  }
});

test('rejects hidden extra keys and never reads inherited or own accessors', () => {
  const extra = Object.defineProperty({ type: 'remove-link' }, 'secret', { value: true });
  assert.deepEqual(normalizeDocxAction(extra), invalid);
  assert.deepEqual(normalizeDocxSearch('a', Object.defineProperty({}, 'regex', { value: true })), invalid);
  let reads = 0;
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, 'points');
  try {
    Object.defineProperty(Object.prototype, 'points', { configurable: true, get() { reads++; return 12; } });
    assert.deepEqual(normalizeDocxAction({ type: 'font-size' }), invalid);
    assert.deepEqual(normalizeDocxAction({ type: 'font-size', get points() { reads++; return 12; } }), invalid);
    assert.equal(reads, 0);
  } finally {
    if (previous) Object.defineProperty(Object.prototype, 'points', previous);
    else Reflect.deleteProperty(Object.prototype, 'points');
  }
});

test('accepts exact size boundaries and refuses unsupported fractions and numeric coercion', () => {
  for (const points of [1, 1.5, 14, 1638]) {
    const value = { type: 'font-size', points };
    assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  }
  for (const points of [0.5, 1638.5, 1.25, NaN, Infinity, -Infinity, '12', null]) {
    assert.deepEqual(normalizeDocxAction({ type: 'font-size', points }), invalid);
  }
});

test('bounds font families by Unicode code points and preserves valid authored spelling', () => {
  for (const family of ['A\u0301字١', 'Font -. +_', 'A'.repeat(64), '\u{10400}'.repeat(64)]) {
    const value = { type: 'font-family', family };
    assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  }
  for (const family of ['A'.repeat(65), '\u{10400}'.repeat(65)]) {
    assert.deepEqual(normalizeDocxAction({ type: 'font-family', family }), limited);
  }
  for (const family of ['', 'Arial,sans-serif', 'Font\nName', 'Font;', '🙂', 12]) {
    assert.deepEqual(normalizeDocxAction({ type: 'font-family', family }), invalid);
  }
});

test('normalizes only valid color notation and bounds paragraph style identities', () => {
  assert.deepEqual(normalizeDocxAction({ type: 'text-color', color: '#aB01ef' }),
    { ok: true, value: { type: 'text-color', color: '#AB01EF' } });
  assert.deepEqual(normalizeDocxAction({ type: 'text-color', color: 'auto' }),
    { ok: true, value: { type: 'text-color', color: 'auto' } });
  for (const color of ['red', '#fff', 'ABCDEF', 'AUTO', 'var(--color)', null]) {
    assert.deepEqual(normalizeDocxAction({ type: 'text-color', color }), invalid);
  }
  const value = { type: 'paragraph-style', styleId: 's'.repeat(128) };
  assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  assert.deepEqual(normalizeDocxAction({ type: 'paragraph-style', styleId: 's'.repeat(129) }), limited);
  assert.deepEqual(normalizeDocxAction({ type: 'paragraph-style', styleId: '' }), invalid);
});

test('authoring hyperlink policy matches admission and never fetches destinations', () => {
  const credentialed = new URL('https://example.com');
  credentialed.username = 'user';
  credentialed.password = 'pass';
  for (const href of ['https://example.com/a?x=1#bookmark', 'http://example.com', 'mailto:person@example.com', '#bookmark']) {
    const value = { type: 'link', href };
    assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  }
  for (const href of [Object.assign(new URL('http://example.com'), { username: 'user', password: 'pw' }).href, 'javascript:alert(1)', 'data:text/html,test', '//example.com',
    'file:///secret', credentialed.href, 'https://example.com/a b', 'https://example.com\\evil',
    'https://example.com/\u007f', '', null]) {
    assert.deepEqual(normalizeDocxAction({ type: 'link', href }), invalid);
  }
  assert.deepEqual(normalizeDocxAction({ type: 'link', href: '#' + 'a'.repeat(2048) }), limited);
  assert.deepEqual(normalizeDocxAction({ type: 'link', href: '#a', text: 'a'.repeat(4097) }), limited);
  assert.deepEqual(normalizeDocxAction({ type: 'link', href: '#a', text: 1 }), invalid);
});

test('search normalizes bounded literal queries and explicit boolean options', () => {
  assert.deepEqual(normalizeDocxSearch('a.*'), { ok: true, value: { query: 'a.*', matchCase: false, wholeWord: false, limit: 100 } });
  assert.deepEqual(normalizeDocxSearch('a'.repeat(256), { matchCase: true, wholeWord: true, limit: 1 }),
    { ok: true, value: { query: 'a'.repeat(256), matchCase: true, wholeWord: true, limit: 1 } });
  assert.deepEqual(normalizeDocxSearch('a'.repeat(257)), limited);
  for (const query of ['', null, 4]) assert.deepEqual(normalizeDocxSearch(query), invalid);
  for (const options of [null, [], { limit: 0 }, { limit: 1.5 }, { limit: Infinity }, { matchCase: 'true' },
    { wholeWord: 1 }, { regex: true }]) assert.deepEqual(normalizeDocxSearch('a', options), invalid);
  assert.deepEqual(normalizeDocxSearch('a', { limit: 101 }), limited);
});

test('replacement accepts empty deletion and bounded Unicode text without trimming', () => {
  for (const value of ['', ' leading\ntrailing ', '\t🙂東京\r\n', '\u{10ffff}', 'a'.repeat(4096)]) {
    assert.deepEqual(normalizeDocxReplacement(value), { ok: true, value });
  }
  assert.deepEqual(normalizeDocxReplacement('a'.repeat(4097)), limited);
  for (const value of [null, [], 12]) assert.deepEqual(normalizeDocxReplacement(value), invalid);
});

test('authored text refuses characters XML cannot preserve before document mutation', () => {
  for (const value of ['\u0000', '\u0008', '\u000b', '\u000c', '\u001f', '\ufffe', '\uffff', '\ud800', '\udfff', 'a\ud800b']) {
    assert.deepEqual(normalizeDocxReplacement(value), invalid);
    assert.deepEqual(normalizeDocxAction({ type: 'link', href: '#bookmark', text: value }), invalid);
    assert.deepEqual(normalizeDocxAction({ type: 'link', href: `#${value}` }), invalid);
    assert.deepEqual(normalizeDocxAction({ type: 'link', href: `https://example.test/${value}` }), invalid);
  }
  for (const text of ['\t🙂東京\r\n', '\u{10000}\u{10ffff}', '\u007f\u0085']) {
    const value = { type: 'link', href: '#bookmark', text };
    assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  }
});

test('table actions validate dimensions, directions and own fields before engine activity', () => {
  for (const value of [
    { type: 'insert-table', rows: 1, columns: 1 }, { type: 'insert-table', rows: 20, columns: 20 },
    { type: 'insert-table-row', where: 'above' }, { type: 'insert-table-row', where: 'below' },
    { type: 'insert-table-column', where: 'left' }, { type: 'insert-table-column', where: 'right' },
    { type: 'delete-table-row' }, { type: 'delete-table-column' }, { type: 'delete-table' },
  ]) {
    const result = normalizeDocxAction(value);
    assert.deepEqual(result, { ok: true, value });
    if (result.ok) { assert.notEqual(result.value, value); assert.equal(Object.isFrozen(result.value), true); }
  }
  for (const rows of [0, -1, 1.5, NaN, Infinity, '2', null, undefined]) {
    assert.deepEqual(normalizeDocxAction({ type: 'insert-table', rows, columns: 2 }), invalid);
    assert.deepEqual(normalizeDocxAction({ type: 'insert-table', rows: 2, columns: rows }), invalid);
  }
  for (const [rows, columns] of [[21, 1], [1, 21], [Number.MAX_SAFE_INTEGER, 2]]) {
    assert.deepEqual(normalizeDocxAction({ type: 'insert-table', rows, columns }), limited);
  }
  for (const value of [{ type: 'insert-table-row', where: 'left' }, { type: 'insert-table-column', where: 'above' },
    { type: 'delete-table', rows: 1 }, { type: 'insert-table', rows: 2, columns: 2, extra: true },
    { type: 'insert-table', get rows() { throw new Error('getter'); }, columns: 2 }]) {
    assert.deepEqual(normalizeDocxAction(value), invalid);
  }
});

test('image actions require complete exact bounded values without coercion or accessors', () => {
  for (const points of [1, 120.123456, 1440]) {
    const action = { type: 'resize-image', widthPoints: points, heightPoints: points };
    const result = normalizeDocxAction(action);
    assert.deepEqual(result, { ok: true, value: action });
    if (result.ok) { assert.notEqual(result.value, action); assert(Object.isFrozen(result.value)); }
  }
  for (const widthPoints of [0, 0.99, -1, NaN, Infinity, '120', undefined]) {
    assert.deepEqual(normalizeDocxAction({ type: 'resize-image', widthPoints, heightPoints: 120 }), invalid);
  }
  assert.deepEqual(normalizeDocxAction({ type: 'resize-image', widthPoints: 1440.01, heightPoints: 1 }), limited);
  for (const heightPoints of [0, 0.99, -1, NaN, Infinity, '60', undefined]) {
    assert.deepEqual(normalizeDocxAction({ type: 'resize-image', widthPoints: 120, heightPoints }), invalid);
  }
  assert.deepEqual(normalizeDocxAction({ type: 'resize-image', widthPoints: 1, heightPoints: 1440.01 }), limited);
  for (const title of ['', '🙂'.repeat(128)]) {
    const value = { type: 'image-description', title, description: '🙂'.repeat(1024) };
    assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  }
  for (const value of [{ type: 'image-description', title: 'x'.repeat(257), description: '' },
    { type: 'image-description', title: '', description: 'x'.repeat(2049) }]) {
    assert.deepEqual(normalizeDocxAction(value), limited);
  }
  let reads = 0;
  for (const value of [{ type: 'delete-image', extra: 1 }, { type: 'image-description', title: '' },
    { type: 'image-description', title: '\ud800', description: '' },
    { type: 'image-description', title: '', description: '\u0000' },
    { type: 'resize-image', get widthPoints() { reads++; return 120; }, heightPoints: 1 }]) {
    assert.deepEqual(normalizeDocxAction(value), invalid);
  }
  assert.equal(reads, 0);
  assert.deepEqual(normalizeDocxAction({ type: 'delete-image' }), { ok: true, value: { type: 'delete-image' } });
});

test('formatting toggles and paragraph edits normalize to frozen copies with exact vocabularies', () => {
  for (const value of ['strikethrough', 'superscript', 'subscript']) assert.deepEqual(normalizeDocxAction(value), { ok: true, value });
  for (const action of [{ type: 'highlight', color: 'yellow' }, { type: 'highlight', color: 'darkMagenta' }, { type: 'highlight', color: 'none' },
    { type: 'indent', direction: 'increase' }, { type: 'indent', direction: 'decrease' }, { type: 'line-spacing', multiple: 1 },
    { type: 'line-spacing', multiple: 1.15 }, { type: 'line-spacing', multiple: 5 }, { type: 'clear-formatting' }, { type: 'page-break' }]) {
    const result = normalizeDocxAction(action);
    assert.deepEqual(result, { ok: true, value: action }, JSON.stringify(action));
    assert.equal(result.ok && Object.isFrozen(result.value), true);
  }
  for (const action of [{ type: 'highlight', color: '#FFFF00' }, { type: 'highlight', color: 'Yellow' }, { type: 'highlight' },
    { type: 'indent', direction: 'left' }, { type: 'line-spacing', multiple: 0.5 }, { type: 'line-spacing', multiple: 1.13 },
    { type: 'line-spacing', multiple: 5.05 }, { type: 'line-spacing', multiple: Number.NaN }, { type: 'line-spacing', multiple: '1.5' },
    { type: 'clear-formatting', all: true }, { type: 'page-break', kind: 'column' }]) {
    assert.deepEqual(normalizeDocxAction(action), invalid, JSON.stringify(action));
  }
});
