import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOCX_LIMITS } from './commands.js';
import { deferred, fixture, opened, refusal, value } from '../../test/session-fixture.js';
import type { DocxEnginePort } from './engine-port.js';
import type { DocxResult } from './types.js';

type Query = 'outline' | 'inspectDocument' | 'review';
const queries: readonly Query[] = ['outline', 'inspectDocument', 'review'];

/** Installs an empty, successful report for one document query; `effect` runs inside the engine call. */
function report(engine: DocxEnginePort, query: Query, effect: () => void = () => {}) {
  if (query === 'outline') engine.outline = () => { effect(); return { ok: true, value: { items: [], truncated: false } }; };
  else if (query === 'inspectDocument') {
    engine.inspectDocument = () => { effect(); return { ok: true, value: { scope: 'body', diagnostics: [], capabilities: [], truncated: false } }; };
  } else {
    engine.review = () => { effect(); return { ok: true, value: { items: [], truncated: false, hasUnsupported: false,
      trackingSupported: false, enabled: false, author: null } }; };
  }
}
/** An opened session whose engine reports one heading, and records the targets it is asked to select. */
async function outlined() {
  const h = await opened();
  const heading = {}, selected: object[] = [];
  h.engine.outline = () => ({ ok: true, value: { items: [{ token: heading, level: 1, text: 'Introduction', textTruncated: false }], truncated: false } });
  const id = value(h.session.outline()).items[0]!.id;
  const select = (effect: () => void = () => {}) => {
    h.engine.selectDocumentTarget = token => { selected.push(token); effect(); return { ok: true, value: undefined }; };
  };
  return { ...h, heading, selected, id, select };
}
async function pendingSave(h: { f: { saveGate: ReturnType<typeof deferred<Uint8Array>> | null; output: Uint8Array }; session: { save(): Promise<DocxResult<unknown>> } }) {
  h.f.saveGate = deferred();
  const gate = h.f.saveGate, saving = h.session.save();
  return async () => { gate.resolve(h.f.output); value(await saving); };
}

test('style and font catalogs are refused before the engine is asked unless the session is ready and idle', async () => {
  const unopened = fixture(), idle = value(unopened.create());
  refusal(idle.paragraphStyles(), 'not-ready'); refusal(idle.fontFamilies(), 'not-ready');
  const h = await opened();
  const finish = await pendingSave(h);
  refusal(h.session.paragraphStyles(), 'busy'); refusal(h.session.fontFamilies(), 'busy');
  await finish();
  h.session.destroy();
  refusal(h.session.paragraphStyles(), 'destroyed'); refusal(h.session.fontFamilies(), 'destroyed');
  assert.equal(h.f.styleReads + h.f.fontReads + unopened.f.styleReads + unopened.f.fontReads, 0);
});

test('a catalog read that throws is unsupported, or destroyed when the read destroyed the session', async () => {
  for (const read of ['paragraphStyles', 'fontFamilies'] as const) {
    const { session, engine } = await opened();
    engine[read] = () => { throw new Error('private document details'); };
    refusal<unknown>(session[read](), 'unsupported');
    assert.equal(session.snapshot().status, 'ready', `${read}: a failing read is not an engine fault`);
    engine[read] = () => { session.destroy(); throw new Error('private document details'); };
    refusal<unknown>(session[read](), 'destroyed');
  }
});

test('search is refused before the engine is asked unless the session is ready and idle', async () => {
  const idle = value(fixture().create());
  refusal(idle.find('alpha'), 'not-ready');
  const h = await opened();
  const finish = await pendingSave(h);
  refusal(h.session.find('alpha'), 'busy');
  await finish();
  h.session.destroy();
  refusal(h.session.find('alpha'), 'destroyed');
  assert.equal(h.f.searches, 0);
});

test('an invalid query is refused before the engine and keeps the previous matches usable', async () => {
  const { f, session } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  refusal(session.find(''), 'invalid-option');
  refusal(session.find('x'.repeat(DOCX_LIMITS.query + 1)), 'resource-limit');
  refusal(session.find('alpha', { limit: 0 }), 'invalid-option');
  assert.equal(f.searches, 1);
  value(session.selectMatch(id));
  assert.equal(f.navigations, 1);
});

test('an engine search that throws is unsupported and retires the earlier matches', async () => {
  const { session, engine } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  engine.find = () => { throw new Error('private document details'); };
  refusal(session.find('beta'), 'unsupported');
  refusal(session.selectMatch(id), 'stale-search');
  engine.find = () => { session.destroy(); throw new Error('private document details'); };
  refusal(session.find('beta'), 'destroyed');
});

test('document queries are unsupported for an engine without them and pass an engine refusal through', async () => {
  const { session, engine } = await opened();
  for (const query of queries) refusal<unknown>(session[query](), 'unsupported');
  assert.equal(session.can('bold').enabled, true);
  engine.outline = () => ({ ok: false, code: 'resource-limit' });
  engine.inspectDocument = () => ({ ok: false, code: 'resource-limit' });
  engine.review = () => ({ ok: false, code: 'resource-limit' });
  for (const query of queries) refusal<unknown>(session[query](), 'resource-limit');
});

test('a query the engine refuses retires the identifiers of the previous report', async () => {
  const h = await outlined();
  h.engine.outline = () => ({ ok: false, code: 'resource-limit' });
  refusal(h.session.outline(), 'resource-limit');
  h.select();
  refusal(h.session.selectOutlineItem(h.id), 'stale-selection');
  assert.deepEqual(h.selected, []);
});

test('a document query whose engine read throws is unsupported and leaves the session free', async () => {
  for (const query of queries) {
    const { f, session, engine } = await opened();
    report(engine, query, () => { throw new Error('private document details'); });
    refusal<unknown>(session[query](), 'unsupported');
    assert.equal(session.snapshot().status, 'ready', query);
    assert.equal(session.can('bold').enabled, true, query); value(session.focus());
    report(engine, query, () => { session.destroy(); throw new Error('private document details'); });
    refusal<unknown>(session[query](), 'destroyed');
    assert.equal(f.executes, 0, query);
  }
});

test('a document query during which composition began is refused instead of reporting', async () => {
  for (const query of queries) {
    const { f, session, engine } = await opened();
    report(engine, query, () => { f.composing = true; f.emit('composition'); });
    refusal<unknown>(session[query](), 'composing');
    assert.equal(session.snapshot().composing, true, query);
  }
});

test('navigation to a document target refuses malformed ids and options before the engine and keeps the target usable', async () => {
  const h = await outlined();
  h.select();
  refusal(h.session.selectOutlineItem(7 as never), 'invalid-option');
  for (const options of [{ unexpected: true }, { selection: { release() {} } }, null, [], { expectedRevision: { documentId: '', value: 0 } }]) {
    refusal(h.session.selectOutlineItem(h.id, options as never), 'invalid-option');
  }
  assert.deepEqual(h.selected, []);
  value(h.session.selectOutlineItem(h.id));
  assert.deepEqual(h.selected, [h.heading]);
});

test('navigation to a document target is refused while composing and works again afterwards', async () => {
  const h = await outlined();
  h.select();
  h.f.composing = true; h.f.emit('composition');
  refusal(h.session.selectOutlineItem(h.id), 'composing');
  refusal(h.session.selectOutlineItem('forged'), 'composing');
  assert.deepEqual(h.selected, []);
  h.f.composing = false; h.f.emit('composition');
  value(h.session.selectOutlineItem(h.id));
  assert.deepEqual(h.selected, [h.heading]);
});

test('options reflection that destroys or occupies the session is refused before the target is resolved', async () => {
  for (const effect of ['destroy', 'occupy'] as const) {
    const h = await outlined();
    h.select();
    let saving: Promise<DocxResult<unknown>> | undefined;
    const options = new Proxy({}, { ownKeys(target) {
      if (effect === 'destroy') h.session.destroy(); else saving = h.session.save();
      return Reflect.ownKeys(target);
    } });
    refusal(h.session.selectOutlineItem(h.id, options), effect === 'destroy' ? 'destroyed' : 'busy');
    assert.deepEqual(h.selected, [], effect);
    if (saving) value(await saving);
  }
});

test('navigation to a document target stops when releasing the old selection lease invalidated the session', async () => {
  for (const [effect, code] of [['destroy', 'destroyed'], ['mount-taken', 'destroyed'], ['fault', 'engine-failed'],
    ['edit', 'stale-revision'], ['composition', 'composing']] as const) {
    const h = await outlined();
    h.select();
    value(h.session.retainSelection());
    h.engine.releaseSelection = token => {
      h.f.released.push(token);
      if (effect === 'destroy') h.session.destroy();
      if (effect === 'mount-taken') h.f.valid = false;
      if (effect === 'fault') { h.f.inspectThrows = true; h.f.emit('state'); }
      if (effect === 'edit') h.f.emit('change');
      if (effect === 'composition') { h.f.composing = true; h.f.emit('composition'); }
    };
    refusal(h.session.selectOutlineItem(h.id), code);
    assert.deepEqual(h.selected, [], effect); assert.equal(h.f.released.length, 1, effect);
  }
});

test('navigation is unsupported when the engine cannot select the target and leaves the session free', async () => {
  const h = await outlined();
  refusal(h.session.selectOutlineItem(h.id), 'unsupported');
  h.engine.inspectDocument = () => ({ ok: true, value: { scope: 'body', capabilities: [], truncated: false,
    diagnostics: [{ rule: 'image-description-missing', data: {}, token: {} }] } });
  refusal(h.session.selectDiagnostic(value(h.session.inspectDocument()).diagnostics[0]!.locationId!), 'unsupported');
  h.engine.review = () => ({ ok: true, value: { items: [{ token: {}, kind: 'comment', text: 'First', author: 'A',
    readOnly: false, orphaned: false, navigable: true }], truncated: false, hasUnsupported: false, trackingSupported: true,
    enabled: false, author: null } });
  refusal(h.session.selectReviewItem(value(h.session.review()).items[0]!.id), 'unsupported');
  assert.equal(h.session.can('bold').enabled, true);
});

test('navigation reports what the engine call did to the session instead of its own success', async () => {
  for (const [effect, code] of [['destroy', 'destroyed'], ['mount-taken', 'destroyed'], ['fault', 'engine-failed'],
    ['edit', 'stale-revision'], ['composition', 'composing']] as const) {
    const h = await outlined();
    h.select(() => {
      if (effect === 'destroy') h.session.destroy();
      if (effect === 'mount-taken') h.f.valid = false;
      if (effect === 'fault') { h.f.inspectThrows = true; h.f.emit('state'); }
      if (effect === 'edit') h.f.emit('change');
      if (effect === 'composition') { h.f.composing = true; h.f.emit('composition'); }
    });
    const polls = h.f.canCalls;
    refusal(h.session.selectOutlineItem(h.id), code);
    assert.deepEqual(h.selected, [h.heading], effect);
    if (effect === 'mount-taken') assert.equal(h.f.canCalls, polls, 'a lost mount is not polled for capabilities');
  }
});

test('navigation whose engine call throws is unsupported, or destroyed when the call destroyed the session', async () => {
  const h = await outlined();
  h.select(() => { throw new Error('private document details'); });
  refusal(h.session.selectOutlineItem(h.id), 'unsupported');
  assert.equal(h.session.can('bold').enabled, true);
  h.select(() => { h.session.destroy(); throw new Error('private document details'); });
  refusal(h.session.selectOutlineItem(h.id), 'destroyed');
});

test('navigation is refused when a subscriber of its final notification starts composition', async () => {
  const h = await outlined();
  h.select(() => h.f.emit('user-selection'));
  h.session.subscribe(() => {
    const snapshot = h.session.snapshot();
    if (snapshot.selection.version > 0 && snapshot.commands.bold.enabled && !h.f.composing) { h.f.composing = true; h.f.emit('composition'); }
  });
  refusal(h.session.selectOutlineItem(h.id), 'composing');
  assert.deepEqual(h.selected, [h.heading]);
  assert.equal(h.session.snapshot().composing, true);
});

test('image navigation is busy during a save, unsupported without engine support and refused after composition began', async () => {
  const h = await opened();
  let selections = 0;
  const polls = h.f.canCalls;
  refusal(h.session.selectImage('next'), 'unsupported');
  assert.equal(h.f.canCalls, polls, 'an unsupported navigation takes no ownership and polls no capability');
  assert.equal(h.session.can('bold').enabled, true);
  h.engine.selectImage = () => { selections++; return { ok: true, value: undefined }; };
  const finish = await pendingSave(h);
  refusal(h.session.selectImage('next'), 'busy');
  refusal(h.session.selectImage('forged' as never), 'invalid-option');
  await finish();
  assert.equal(selections, 0);
  value(h.session.selectImage('next'));
  assert.equal(selections, 1);
  h.engine.selectImage = () => { h.f.composing = true; h.f.emit('composition'); return { ok: true, value: undefined }; };
  refusal(h.session.selectImage('previous'), 'composing');
});

test('match navigation and replacement refuse a non-string id before the engine', async () => {
  const { f, session } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  refusal(session.selectMatch(7 as never), 'invalid-option');
  refusal(session.replaceMatch(7 as never, 'x'), 'invalid-option');
  assert.equal(f.navigations, 0); assert.deepEqual(f.replacements, []);
  value(session.selectMatch(id));
  assert.equal(f.navigations, 1);
});

test('match navigation and replacement are busy while a save runs and leave the match usable', async () => {
  const h = await opened();
  const id = value(h.session.find('alpha')).matches[0]!.id;
  const finish = await pendingSave(h);
  refusal(h.session.selectMatch(id), 'busy'); refusal(h.session.replaceMatch(id, 'x'), 'busy');
  refusal(h.session.selectMatch(id, { unexpected: true } as never), 'invalid-option');
  refusal(h.session.replaceMatch(id, 'x', { unexpected: true } as never), 'invalid-option');
  assert.equal(h.f.navigations, 0); assert.deepEqual(h.f.replacements, []);
  await finish();
  value(h.session.selectMatch(id));
  assert.equal(h.f.navigations, 1);
});

test('match navigation and replacement stop when releasing the old lease invalidated the session', async () => {
  for (const action of ['select', 'replace'] as const) {
    for (const [effect, code] of [['destroy', 'destroyed'], ['fault', 'engine-failed'], ['edit', 'stale-revision']] as const) {
      const { f, engine, session } = await opened();
      const id = value(session.find('alpha')).matches[0]!.id;
      value(session.retainSelection());
      engine.releaseSelection = token => {
        f.released.push(token);
        if (effect === 'destroy') session.destroy();
        if (effect === 'fault') { f.inspectThrows = true; f.emit('state'); }
        if (effect === 'edit') f.emit('change');
      };
      refusal<unknown>(action === 'select' ? session.selectMatch(id) : session.replaceMatch(id, 'new'), code);
      assert.equal(f.navigations, 0, `${action} ${effect}`); assert.deepEqual(f.replacements, [], `${action} ${effect}`);
    }
  }
});

test('match navigation reports what the engine call did to the session instead of its own success', async () => {
  for (const [effect, code] of [['destroy', 'destroyed'], ['fault', 'engine-failed'], ['edit', 'stale-revision']] as const) {
    const { f, engine, session } = await opened();
    const id = value(session.find('alpha')).matches[0]!.id;
    engine.selectMatch = () => {
      if (effect === 'destroy') session.destroy();
      if (effect === 'fault') { f.inspectThrows = true; f.emit('state'); }
      if (effect === 'edit') f.emit('change');
      return { ok: true, value: undefined };
    };
    refusal(session.selectMatch(id), code);
  }
});

test('match navigation whose engine call throws is unsupported, or destroyed when the call destroyed the session', async () => {
  const { engine, session } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  engine.selectMatch = () => { throw new Error('private document details'); };
  refusal(session.selectMatch(id), 'unsupported');
  assert.equal(session.snapshot().status, 'ready');
  engine.selectMatch = () => { session.destroy(); throw new Error('private document details'); };
  refusal(session.selectMatch(id), 'destroyed');
});

test('match replacement reports what the engine call did to the session instead of its own success', async () => {
  for (const [effect, code] of [['destroy', 'destroyed'], ['fault', 'engine-failed'], ['ownership', 'destroyed']] as const) {
    const { f, engine, session } = await opened();
    const id = value(session.find('alpha')).matches[0]!.id;
    engine.replaceMatch = () => {
      if (effect === 'destroy') session.destroy();
      if (effect === 'fault') { f.inspectThrows = true; f.emit('state'); }
      if (effect === 'ownership') f.valid = false;
      return { ok: true, value: undefined };
    };
    refusal(session.replaceMatch(id, 'new'), code);
  }
});

test('match replacement passes an engine refusal through unchanged and leaves the document alone', async () => {
  const { engine, session } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  const before = session.snapshot();
  engine.replaceMatch = () => ({ ok: false, code: 'resource-limit' });
  refusal(session.replaceMatch(id, 'new'), 'resource-limit');
  assert.equal(session.snapshot(), before); assert.equal(session.snapshot().dirty, false);
});

test('match replacement whose engine call throws is unsupported, or destroyed when the call destroyed the session', async () => {
  const { engine, session } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  engine.replaceMatch = () => { throw new Error('private document details'); };
  refusal(session.replaceMatch(id, 'new'), 'unsupported');
  assert.equal(session.snapshot().status, 'ready'); assert.equal(session.snapshot().dirty, false);
  engine.replaceMatch = () => { session.destroy(); throw new Error('private document details'); };
  refusal(session.replaceMatch(id, 'new'), 'destroyed');
});

test('focus reports an engine that throws as unsupported, or destroyed when it destroyed the session', async () => {
  const { engine, session } = await opened();
  engine.focus = () => { throw new Error('private document details'); };
  refusal(session.focus(), 'unsupported');
  assert.equal(session.snapshot().status, 'ready');
  engine.focus = () => { session.destroy(); throw new Error('private document details'); };
  refusal(session.focus(), 'destroyed');
});

test('a save whose signal is already aborted does no work and leaves the session free', async () => {
  const { f, engine, session } = await opened();
  let saves = 0;
  engine.save = async () => { saves++; return f.output; };
  refusal(await session.save({ signal: AbortSignal.abort() }), 'aborted');
  assert.equal(saves, 0); assert.equal(session.snapshot().activity, null);
  value(await session.save());
  assert.equal(saves, 1);
});

test('a failed save whose completion notification destroys or faults the session reports that instead', async () => {
  for (const [effect, code] of [['destroy', 'destroyed'], ['fault', 'engine-failed']] as const) {
    const { f, session } = await opened();
    f.saveGate = deferred();
    let saving = false;
    session.subscribe(() => {
      const snapshot = session.snapshot();
      if (snapshot.activity === 'saving') saving = true;
      else if (saving && snapshot.status === 'ready') {
        saving = false;
        if (effect === 'destroy') session.destroy(); else { f.inspectThrows = true; f.emit('state'); }
      }
    });
    const pending = session.save();
    f.saveGate.reject(new Error('private contents'));
    refusal(await pending, code);
  }
});
