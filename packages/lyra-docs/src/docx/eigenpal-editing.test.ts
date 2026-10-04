import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import { createEigenpalEditing, eigenpalCommand } from './eigenpal-editing.js';

function fixture() {
  const f = {
    styles: Array.from({ length: 260 }, (_, i) => ({ styleId: `Custom${i}`, name: `Style ${i}`, type: 'paragraph' })),
    fonts: ['Arial'], styleReads: 0, fontReads: 0, searches: 0, selections: 0, canCalls: 0,
    formatting: { fontFamily: 'Arial', fontSizeHalfPoints: 27, alignment: 'both', styleId: 'Custom0' } as ReturnType<DocxEditorInstance['getSelectionFormatting']>,
    commands: [] as EditorCommand[], allowed: true, changedAfterSelection: false,
    before: 'before', after: 'after', count: 2,
  };
  const editor = {
    getDocumentStyles() { f.styleReads++; return f.styles; },
    getAvailableFonts() { f.fontReads++; return f.fonts; },
    getSelectionFormatting() { return f.formatting; },
    isActive(command: EditorCommand) { return command.type === 'toggleList' && command.kind === 'ordered'; },
    can() { f.canCalls++; return { ok: f.allowed }; },
    exec(command: EditorCommand) { f.commands.push(command); return { ok: true, changed: true }; },
    findMatches() {
      f.searches++;
      return Array.from({ length: f.count }, () => ({ text: '🙂', contextBefore: f.before, contextAfter: f.after,
        blockId: 'private-block', start: 0, length: 2, paragraphIndex: 0, runIndex: 0, runOffset: 0 }));
    },
    selectMatch() { f.selections++; return { ok: true, changed: false }; },
  } as unknown as DocxEditorInstance;
  const access = createEigenpalEditing(() => editor, action => {
    const result = action();
    if (f.changedAfterSelection) access.invalidateSearch();
    return result;
  }, () => ({ ok: true, value: undefined }));
  return { f, access };
}

test('paragraph style membership uses the actual document, caches ids beyond the display limit and refuses before core can', () => {
  const { f, access } = fixture();
  const styles = access.paragraphStyles();
  assert.equal(styles.items.length, 256); assert.equal(styles.truncated, true);
  assert.ok(Object.isFrozen(styles)); assert.ok(Object.isFrozen(styles.items)); assert.ok(Object.isFrozen(styles.items[0]));
  assert.equal(access.can({ type: 'paragraph-style', styleId: 'Custom259' }).enabled, true);
  assert.deepEqual(access.can({ type: 'paragraph-style', styleId: 'Heading1' }), { enabled: false, reason: 'invalid-option' });
  assert.equal(f.canCalls, 1); assert.equal(f.styleReads, 1);
  access.paragraphStyles(); access.can({ type: 'paragraph-style', styleId: 'Custom0' });
  assert.equal(f.styleReads, 1);
});

test('formatting preserves identity, exposes half-points correctly and refuses invented color or malformed values', () => {
  const { f, access } = fixture();
  const first = access.formatting();
  assert.deepEqual(first, { paragraphStyleId: 'Custom0', alignment: 'justify', fontFamily: 'Arial', fontSizePoints: 13.5,
    color: null, bulletList: false, numberedList: true });
  assert.ok(Object.isFrozen(first)); assert.equal(access.formatting(), first);
  assert.deepEqual([f.styleReads, f.fontReads, f.searches], [0, 0, 0]);
  for (const size of [NaN, Infinity, 0, 3277, 2.5]) {
    f.formatting = { fontSizeHalfPoints: size, fontFamily: 'x'.repeat(65), styleId: 'x'.repeat(129), alignment: 'invalid' };
    const value = access.formatting();
    assert.equal(value.fontSizePoints, null); assert.equal(value.fontFamily, null);
    assert.equal(value.paragraphStyleId, null); assert.equal(value.alignment, null);
    assert.equal(access.formatting(), value);
  }
});

test('font catalog is copied, bounded and never advertises invalid family identities', () => {
  const { f, access } = fixture();
  f.fonts = Array.from({ length: 130 }, (_, i) => `Font ${i}`);
  f.fonts.unshift('x'.repeat(65), '<bad>');
  const catalog = access.fontFamilies();
  assert.equal(catalog.items.length, 128); assert.equal(catalog.truncated, true);
  assert.equal(catalog.items[0], 'Font 0'); assert.ok(Object.isFrozen(catalog.items));
  f.fonts[2] = 'Changed'; assert.equal(catalog.items[0], 'Font 0');
});

test('maps paragraph, list, font and link actions into the public command vocabulary', () => {
  assert.deepEqual(eigenpalCommand({ type: 'font-size', points: 13.5 }), { type: 'setMarkAttr', mark: 'fontSize', attr: 'val', value: 27 });
  assert.deepEqual(eigenpalCommand({ type: 'text-color', color: '#FF0011' }), { type: 'setMarkAttr', mark: 'color', attr: 'val', value: 'FF0011' });
  assert.deepEqual(eigenpalCommand({ type: 'text-color', color: 'auto' }), { type: 'setMarkAttr', mark: 'color', attr: 'val', value: 'auto' });
  assert.deepEqual(eigenpalCommand({ type: 'toggle-list', kind: 'numbered' }), { type: 'toggleList', kind: 'ordered' });
  assert.deepEqual(eigenpalCommand('strikethrough'), { type: 'toggleMark', mark: 'strike' });
  assert.deepEqual(eigenpalCommand('superscript'), { type: 'toggleMark', mark: 'superscript' });
  assert.deepEqual(eigenpalCommand('subscript'), { type: 'toggleMark', mark: 'subscript' });
  assert.deepEqual(eigenpalCommand({ type: 'highlight', color: 'darkCyan' }), { type: 'setMarkAttr', mark: 'highlight', attr: 'val', value: 'darkCyan' });
  assert.deepEqual(eigenpalCommand({ type: 'indent', direction: 'decrease' }), { type: 'adjustIndent', direction: 'decrease' });
  assert.deepEqual(eigenpalCommand({ type: 'line-spacing', multiple: 1.5 }), { type: 'setLineSpacing', rule: 'multiple', value: 1.5 });
  assert.deepEqual(eigenpalCommand({ type: 'clear-formatting' }), { type: 'clearFormatting' });
  assert.deepEqual(eigenpalCommand({ type: 'page-break' }), { type: 'insertBreak', kind: 'page' });
  assert.deepEqual(eigenpalCommand({ type: 'link', href: '#bookmark', text: 'Exact 🙂' }), { type: 'insertHyperlink', href: '#bookmark', text: 'Exact 🙂' });
});

test('search bounds retained records and context without dividing surrogate pairs', () => {
  const { f, access } = fixture();
  f.count = 110;
  f.before = '🙂' + 'b'.repeat(47);
  f.after = 'a'.repeat(47) + '🙂';
  const results = access.find('🙂', { matchCase: true, wholeWord: false, limit: 2 });
  assert.equal(results.matches.length, 2); assert.equal(results.truncated, true);
  assert.equal(results.matches[0]!.text, '🙂');
  assert.equal(results.matches[0]!.before, 'b'.repeat(47));
  assert.equal(results.matches[0]!.after, 'a'.repeat(47));
  assert.equal('blockId' in results.matches[0]!, false);
  assert.deepEqual(access.selectMatch({}), { ok: false, code: 'stale-search' });
  assert.equal(access.selectMatch(results.matches[0]!.token).ok, true);
  access.find('new', { matchCase: false, wholeWord: false, limit: 2 });
  assert.deepEqual(access.selectMatch(results.matches[0]!.token), { ok: false, code: 'stale-search' });
});

test('replacement selects then applies exactly one insertText, including empty deletion', () => {
  const { f, access } = fixture();
  const match = access.find('alpha', { matchCase: false, wholeWord: false, limit: 2 }).matches[0]!;
  assert.equal(access.replaceMatch(match.token, '').ok, true);
  assert.equal(f.selections, 1);
  assert.deepEqual(f.commands, [{ type: 'insertText', text: '' }]);
  f.allowed = false;
  assert.deepEqual(access.replaceMatch(match.token, 'replacement'), { ok: false, code: 'unsupported' });
  assert.equal(f.commands.length, 1);
  f.allowed = true; f.changedAfterSelection = true;
  assert.deepEqual(access.replaceMatch(match.token, 'stale'), { ok: false, code: 'stale-search' });
  assert.equal(f.commands.length, 1);
});

test('disposing private match state invalidates retained handles', () => {
  const { access } = fixture();
  const match = access.find('alpha', { matchCase: false, wholeWord: false, limit: 2 }).matches[0]!;
  access.dispose();
  assert.deepEqual(access.selectMatch(match.token), { ok: false, code: 'stale-search' });
});
