import assert from 'node:assert/strict';
import test from 'node:test';
import { DOCX_COMMAND_CATALOG, buildDocxCommandAction } from './command-catalog.js';
import { normalizeDocxAction } from './commands.js';
import { DOCX_EDITOR_STRINGS } from './strings.js';

test('catalog has bounded unique identities and deeply immutable action metadata', () => {
  assert.ok(DOCX_COMMAND_CATALOG.length > 15 && DOCX_COMMAND_CATALOG.length <= 64);
  assert.equal(new Set(DOCX_COMMAND_CATALOG.map(item => item.id)).size, DOCX_COMMAND_CATALOG.length);
  assert.ok(Object.isFrozen(DOCX_COMMAND_CATALOG));
  for (const item of DOCX_COMMAND_CATALOG) {
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.hasOwn(DOCX_EDITOR_STRINGS, item.labelKey));
    assert.ok(Object.hasOwn(DOCX_EDITOR_STRINGS, item.descriptionKey));
    const action = buildDocxCommandAction(item.id);
    if (item.action) {
      assert.ok(action && normalizeDocxAction(action).ok);
      if (typeof action === 'object') assert.ok(Object.isFrozen(action));
    } else assert.equal(action, null);
  }
});

test('action builders only accept catalog identities and never invoke unknown objects', () => {
  assert.equal(buildDocxCommandAction('bold'), 'bold');
  assert.deepEqual(buildDocxCommandAction('align-center'), { type: 'alignment', value: 'center' });
  assert.equal(buildDocxCommandAction('unknown'), null);
  assert.equal(buildDocxCommandAction('save'), null);
  let reads = 0;
  assert.equal(buildDocxCommandAction({ toString() { reads++; return 'bold'; } } as unknown as string), null);
  assert.equal(reads, 0);
});
