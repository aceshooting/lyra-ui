import assert from 'node:assert/strict';
import test from 'node:test';
import { LyraDocxEditor } from '../dist/docx/docx-editor.class.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function editor(owner) {
  const element = Object.create(LyraDocxEditor.prototype);
  Object.defineProperty(element, 'isConnected', { value: true, configurable: true });
  element.requestUpdate = () => {};
  Object.assign(element, { session: owner, sourceReadSequence: 0, documentPanel: null });
  const calls = { sync: 0, focus: 0, errors: [] };
  element.syncSession = () => { calls.sync++; };
  element.focusEditor = () => { calls.focus++; };
  element.reportEditRefusal = code => { calls.errors.push(code); };
  element.reportError = code => { calls.errors.push(code); };
  return { element, calls };
}

test('public execution waits for preparation before synchronizing the editor', async () => {
  const pending = deferred();
  const { element, calls } = editor({ execute: () => pending.promise });
  const execution = element.execute('bold');
  assert.equal(calls.sync, 0);
  const result = { ok: true, value: { documentId: 'document', value: 1 } };
  pending.resolve(result);
  assert.deepEqual(await execution, result);
  assert.equal(calls.sync, 1);
});

for (const method of ['runEdit', 'runToolbarCommand']) {
  test(`${method} retains its selection lease until asynchronous execution settles`, async () => {
    const pending = deferred();
    const { element, calls } = editor({ execute: () => pending.promise });
    let released = 0;
    element.toolbarSelection = { release() { released++; } };
    const execution = element[method]('bold');
    assert.equal(released, 0);
    assert.equal(calls.focus, 0);
    pending.resolve({ ok: true, value: { documentId: 'document', value: 1 } });
    await execution;
    assert.equal(released, 1);
    assert.equal(calls.focus, 1);
    assert.deepEqual(calls.errors, []);
  });

  test(`${method} leaves a replacement document's state and focus alone`, async () => {
    const pending = deferred();
    const { element, calls } = editor({ execute: () => pending.promise });
    let released = 0;
    element.toolbarSelection = { release() { released++; } };
    const execution = element[method]('bold');
    element.session = { execute: async () => ({ ok: false, code: 'not-ready' }) };
    element.sourceReadSequence++;
    pending.resolve({ ok: false, code: 'engine-failed' });
    await execution;
    assert.equal(released, 1);
    assert.equal(calls.sync, 0);
    assert.equal(calls.focus, 0);
    assert.deepEqual(calls.errors, []);
  });
}
