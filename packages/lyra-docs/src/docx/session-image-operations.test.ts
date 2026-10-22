import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatting, insertionFixture, opened, refusal, value } from '../../test/session-fixture.js';
import type { DocxEngineImageInsertion } from './engine-port.js';
import type { DocxResult } from './types.js';

/** A caller payload that records every attempt to look at it. */
function untouchable() {
  const touches = { count: 0 };
  const trap = () => { touches.count++; throw new Error('payload inspected'); };
  const proxy = new Proxy({}, { get: trap, has: trap, ownKeys: trap, getPrototypeOf: trap, getOwnPropertyDescriptor: trap });
  return { proxy, touches };
}
/** An opened session whose engine reports one painted, ready image as the selection. */
async function imageSelected(readOnly = false) {
  const h = await opened(readOnly);
  h.engine.inspect = () => {
    if (h.f.inspectThrows) throw new Error('private document details');
    return { selection: 'other', composing: h.f.composing, formatting, image: { widthPoints: 120, heightPoints: 60 }, imageReady: true };
  };
  h.f.emit('user-selection');
  return h;
}

test('insertion is refused before any capture or payload inspection when the editor state does not allow it', async () => {
  for (const [state, reason] of [['read-only', 'read-only'], ['composing', 'composing'],
    ['range selection', 'unsupported'], ['no insertion support', 'unsupported']] as const) {
    const h = await insertionFixture(state === 'read-only');
    if (state === 'composing') { h.f.composing = true; h.f.emit('composition'); }
    if (state === 'range selection') { h.f.selection = 'text'; h.f.emit('user-selection'); }
    if (state === 'no insertion support') delete h.engine.beginImageInsertion;
    const { proxy, touches } = untouchable();
    assert.deepEqual(h.session.canInsertImage(), { enabled: false, reason }, state);
    refusal(await h.session.insertImage(proxy as never, proxy as never), reason);
    assert.equal(h.state.captures, 0, state); assert.equal(touches.count, 0, state);
    assert.equal(h.session.snapshot().activity, null, state);
    assert.equal(h.session.snapshot().revision?.value, 0, state);
  }
});

test('replacement is refused before any capture or payload inspection when no replaceable image is selected', async () => {
  const cases = [
    { name: 'no image selected', reason: 'no-selection', image: false, ready: true, support: true, readOnly: false, composing: false },
    { name: 'image not ready', reason: 'unsupported', image: true, ready: false, support: true, readOnly: false, composing: false },
    { name: 'no replacement support', reason: 'unsupported', image: true, ready: true, support: false, readOnly: false, composing: false },
    { name: 'read-only', reason: 'read-only', image: true, ready: true, support: true, readOnly: true, composing: false },
    { name: 'composing', reason: 'composing', image: true, ready: true, support: true, readOnly: false, composing: true }
  ] as const;
  for (const state of cases) {
    const h = await opened(state.readOnly);
    let captures = 0;
    if (state.support) h.engine.beginImageReplacement = () => { captures++; return { ok: false, code: 'unsupported' }; };
    if (state.image) {
      h.engine.inspect = () => ({ selection: 'other', composing: h.f.composing, formatting,
        image: { widthPoints: 40, heightPoints: 20 }, imageReady: state.ready });
    }
    h.f.emit('user-selection');
    if (state.composing) { h.f.composing = true; h.f.emit('composition'); }
    const { proxy, touches } = untouchable();
    assert.deepEqual(h.session.canReplaceImage(), { enabled: false, reason: state.reason }, state.name);
    refusal(await h.session.replaceImage(proxy as never, proxy as never), state.reason);
    assert.equal(captures, 0, state.name); assert.equal(touches.count, 0, state.name);
    assert.equal(h.session.snapshot().activity, null, state.name);
  }
});

test('a refused capture ends the operation, releases nothing and reports the engine refusal', async () => {
  const insertion = await insertionFixture();
  let captures = 0;
  insertion.engine.beginImageInsertion = () => { captures++; return { ok: false, code: 'resource-limit' }; };
  refusal(await insertion.session.insertImage(insertion.source()), 'resource-limit');
  assert.equal(captures, 1); assert.equal(insertion.session.snapshot().activity, null);
  assert.deepEqual(insertion.session.canInsertImage(), { enabled: true });
  assert.equal(insertion.session.snapshot().revision?.value, 0);

  const replacement = await imageSelected();
  let replacementCaptures = 0;
  replacement.engine.beginImageReplacement = () => { replacementCaptures++; return { ok: false, code: 'resource-limit' }; };
  refusal(await replacement.session.replaceImage(new Uint8Array([1])), 'resource-limit');
  assert.equal(replacementCaptures, 1); assert.equal(replacement.session.snapshot().activity, null);
  assert.deepEqual(replacement.session.canReplaceImage(), { enabled: true });
});

test('insertion reports the fault of an engine that fails while capturing and releases the handle once', async () => {
  const h = await insertionFixture();
  h.state.onCapture = () => { h.f.inspectThrows = true; h.f.emit('state'); };
  refusal(await h.session.insertImage(h.source()), 'engine-failed');
  assert.equal(h.state.releases, 1); assert.equal(h.state.calls, 0);
  assert.equal(h.session.snapshot().status, 'error'); assert.deepEqual(h.session.snapshot().error, { code: 'engine-failed' });
  assert.equal(h.f.destroyed, 1);
});

test('insertion that learns of composition while capturing is refused and releases the handle', async () => {
  const h = await insertionFixture();
  h.state.onCapture = () => { h.f.composing = true; h.f.emit('composition'); };
  refusal(await h.session.insertImage(h.source()), 'composing');
  assert.equal(h.state.releases, 1); assert.equal(h.state.calls, 0);
  assert.equal(h.session.snapshot().activity, null); assert.equal(h.session.snapshot().revision?.value, 0);
});

test('a capture that throws after the session was invalidated reports the invalidation, not an engine fault', async () => {
  for (const [effect, code] of [['destroy', 'destroyed'], ['composition', 'composing'], ['change', 'stale-revision']] as const) {
    const h = await insertionFixture();
    h.engine.beginImageInsertion = () => {
      if (effect === 'destroy') h.session.destroy();
      if (effect === 'composition') { h.f.composing = true; h.f.emit('composition'); }
      if (effect === 'change') h.f.emit('change');
      throw new Error('capture unavailable');
    };
    refusal(await h.session.insertImage(h.source()), code);
    assert.equal(h.session.snapshot().activity, null, effect);
    assert.equal(h.state.calls, 0, effect);
  }
});

test('insertion with an already aborted signal is refused without dispatching to the engine', async () => {
  const h = await insertionFixture();
  refusal(await h.session.insertImage(h.source(), { signal: AbortSignal.abort() }), 'aborted');
  assert.equal(h.state.calls, 0); assert.equal(h.state.releases, 1);
  assert.equal(h.session.snapshot().activity, null); assert.equal(h.session.snapshot().revision?.value, 0);
});

test('settlement guards kept by the engine after the operation ended are refused as busy', async () => {
  const h = await insertionFixture();
  let kept: Parameters<DocxEngineImageInsertion['execute']>[1] | undefined;
  h.engine.beginImageInsertion = () => ({ ok: true, value: {
    validate: () => ({ ok: true, value: undefined }),
    execute: async (_source, operation) => { kept = operation; return { ok: false, code: 'unsupported' }; },
    release() { h.state.releases++; }
  } });
  refusal(await h.session.insertImage(h.source()), 'unsupported');
  assert.equal(h.state.releases, 1);
  refusal(kept!.validateOriginal(), 'busy');
  refusal(kept!.armCommit(), 'busy');
  assert.equal(h.session.snapshot().activity, null); assert.equal(h.session.snapshot().revision?.value, 0);
});

test('the engine cannot arm the same commit twice', async () => {
  const h = await insertionFixture();
  const arms: DocxResult<void>[] = [];
  h.engine.beginImageInsertion = () => ({ ok: true, value: {
    validate: () => ({ ok: true, value: undefined }),
    execute: async (_source, operation) => {
      arms.push(operation.armCommit(), operation.armCommit());
      h.f.emit('change');
      return { ok: true, value: undefined };
    },
    release() { h.state.releases++; }
  } });
  assert.equal(value(await h.session.insertImage(h.source())).value, 1);
  assert.deepEqual(arms, [{ ok: true, value: undefined }, { ok: false, code: 'busy' }]);
  assert.equal(h.state.releases, 1);
});

test('image actions are refused before the engine is asked while composing or without a selected image', async () => {
  const composing = await imageSelected();
  composing.f.composing = true; composing.f.emit('composition');
  refusal(await composing.session.execute({ type: 'delete-image' }), 'composing');
  const none = await opened();
  refusal(await none.session.execute({ type: 'delete-image' }), 'no-selection');
  assert.equal(composing.f.executes + none.f.executes, 0);
  assert.equal(none.session.snapshot().revision?.value, 0);
});

test('image settlement refuses a lost or faulted session and a guard kept after the command ended', async () => {
  for (const [effect, code] of [['ownership', 'destroyed'], ['fault', 'engine-failed']] as const) {
    const h = await imageSelected();
    const guards: DocxResult<void>[] = [];
    let writes = 0;
    h.engine.execute = (_command, _token, validate) => {
      if (effect === 'ownership') h.f.valid = false;
      else { h.f.inspectThrows = true; h.f.emit('state'); }
      const guarded = validate!(); guards.push(guarded);
      if (!guarded.ok) return guarded;
      writes++; return { ok: true, value: undefined };
    };
    refusal(await h.session.execute({ type: 'delete-image' }), code);
    assert.deepEqual(guards, [{ ok: false, code }], effect);
    assert.equal(writes, 0, effect);
  }
  const h = await imageSelected();
  let kept: (() => DocxResult<void>) | undefined;
  h.engine.execute = (_command, _token, validate) => { kept = validate; return validate!(); };
  value(await h.session.execute({ type: 'delete-image' }));
  refusal(kept!(), 'busy');
});

test('image description is unsupported without engine support and refuses a result the engine invalidated', async () => {
  const h = await imageSelected();
  refusal(h.session.imageDescription(), 'unsupported');
  for (const event of ['user-selection', 'change'] as const) {
    h.engine.imageDescription = () => { h.f.emit(event); return { ok: true, value: { title: 'Title', description: 'Description' } }; };
    refusal(h.session.imageDescription(), 'stale-selection');
  }
  h.engine.imageDescription = () => { throw new Error('private document details'); };
  refusal(h.session.imageDescription(), 'unsupported');
  h.engine.imageDescription = () => { h.session.destroy(); throw new Error('private document details'); };
  refusal(h.session.imageDescription(), 'destroyed');
});
