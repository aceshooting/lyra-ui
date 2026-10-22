import assert from 'node:assert/strict';
import { test } from 'node:test';
import { opened, refusal, value } from '../../test/session-fixture.js';
import type { DocxResult } from './types.js';

test('capability checks report a busy or composing session that the engine query itself caused', async () => {
  const { session, engine, f } = await opened();
  let trigger: (() => void) | null = null;
  const can = engine.can.bind(engine);
  engine.can = command => { const run = trigger; trigger = null; run?.(); return can(command); };
  let saving: Promise<DocxResult<unknown>> | undefined;
  trigger = () => { saving = session.save(); };
  assert.deepEqual(session.can('bold'), { enabled: false, reason: 'busy' });
  value(await saving!);
  assert.deepEqual(session.can('bold'), { enabled: true, active: false });
  trigger = () => { f.composing = true; f.emit('composition'); };
  assert.deepEqual(session.can('bold'), { enabled: false, reason: 'composing' });
});

test('a capability check without a stated reason or with a throwing engine is reported as unsupported', async () => {
  const { session, engine } = await opened();
  engine.can = () => ({ enabled: false });
  assert.deepEqual(session.can('bold'), { enabled: false, reason: 'unsupported' });
  engine.can = () => { throw new Error('private document details'); };
  assert.deepEqual(session.can('bold'), { enabled: false, reason: 'unsupported' });
  assert.equal(session.snapshot().status, 'ready', 'a failing capability query is not an engine fault');
});

test('retaining a selection is refused without asking the engine while composing or when nothing is selected', async () => {
  const composing = await opened();
  composing.f.composing = true; composing.f.emit('composition');
  refusal(composing.session.retainSelection(), 'composing');
  const none = await opened();
  none.f.selection = 'none'; none.f.emit('focus-selection');
  refusal(none.session.retainSelection(), 'no-selection');
  assert.equal(composing.f.retained + none.f.retained, 0);
});

test('a token whose retention coincided with composition or a selection change is released and refused', async () => {
  for (const [effect, code] of [['composition', 'composing'], ['selection', 'stale-selection'], ['edit', 'stale-selection']] as const) {
    const { f, engine, session } = await opened();
    const token = {};
    engine.retainSelection = () => {
      if (effect === 'composition') { f.composing = true; f.emit('composition'); }
      if (effect === 'selection') f.emit('user-selection');
      if (effect === 'edit') f.emit('change');
      return token;
    };
    refusal(session.retainSelection(), code);
    assert.deepEqual(f.released, [token], effect);
    session.destroy();
    assert.deepEqual(f.released, [token], `${effect}: no lease was left to release again`);
  }
});

test('an engine that throws while retaining a selection leaves no lease behind', async () => {
  const { f, engine, session } = await opened();
  engine.retainSelection = () => { throw new Error('private document details'); };
  refusal(session.retainSelection(), 'no-selection');
  session.destroy();
  assert.deepEqual(f.released, []);
  const destroying = await opened();
  destroying.engine.retainSelection = () => { destroying.session.destroy(); throw new Error('private document details'); };
  refusal(destroying.session.retainSelection(), 'destroyed');
});

test('a plain command is refused when the capability query moved the revision or released the lease', async () => {
  for (const effect of ['edit', 'lease'] as const) {
    const { f, engine, session } = await opened();
    const lease = effect === 'lease' ? value(session.retainSelection()) : null;
    let armed = true;
    engine.can = () => {
      if (armed) { armed = false; if (lease) lease.release(); else f.emit('change'); }
      return { enabled: true };
    };
    refusal(await session.execute('bold', lease ? { selection: lease } : {}), lease ? 'stale-selection' : 'stale-revision');
    assert.equal(f.executes, 0, effect);
    assert.equal(armed, false, effect);
  }
});

test('review actions are refused while composing and when the engine cannot execute them', async () => {
  const unsupported = await opened();
  const polls = unsupported.f.canCalls;
  refusal(await unsupported.session.execute({ type: 'track-changes', enabled: true, author: 'Writer' }), 'unsupported');
  assert.equal(unsupported.f.canCalls, polls, 'an unsupported action takes no ownership and polls no capability');
  assert.equal(unsupported.session.can('bold').enabled, true);
  const composing = await opened();
  let calls = 0;
  composing.engine.executeReview = () => { calls++; return { ok: true, value: undefined }; };
  composing.f.composing = true; composing.f.emit('composition');
  refusal(await composing.session.execute({ type: 'add-comment', text: 'Note', author: 'Writer' }), 'composing');
  assert.equal(calls, 0);
});

test('review settlement refuses a lost, faulted or composing session and a guard kept after the command ended', async () => {
  for (const [effect, code] of [['ownership', 'destroyed'], ['fault', 'engine-failed'], ['composition', 'composing']] as const) {
    const { f, engine, session } = await opened();
    const guards: DocxResult<void>[] = [];
    let writes = 0;
    engine.executeReview = (_action, _token, _retained, validate) => {
      if (effect === 'ownership') f.valid = false;
      if (effect === 'fault') { f.inspectThrows = true; f.emit('state'); }
      if (effect === 'composition') { f.composing = true; f.emit('composition'); }
      const guarded = validate!(); guards.push(guarded);
      if (!guarded.ok) return guarded;
      writes++; return { ok: true, value: undefined };
    };
    refusal(await session.execute({ type: 'add-comment', text: 'Note', author: 'Writer' }), code);
    assert.deepEqual(guards, [{ ok: false, code }], effect);
    assert.equal(writes, 0, effect);
  }
  const { engine, session } = await opened();
  let kept: (() => DocxResult<void>) | undefined;
  engine.executeReview = (_action, _token, _retained, validate) => { kept = validate; return validate!(); };
  value(await session.execute({ type: 'track-changes', enabled: true, author: 'Writer' }));
  refusal(kept!(), 'busy');
});

test('table actions are refused while composing without asking the engine', async () => {
  const { f, session } = await opened();
  f.selection = 'caret'; f.emit('user-selection');
  f.composing = true; f.emit('composition');
  refusal(await session.execute({ type: 'delete-table' }), 'composing');
  assert.equal(f.executes, 0);
});

test('table settlement refuses a selection that is not a caret, whether it never was or stopped being one', async () => {
  const never = await opened();
  never.engine.execute = (_action, _token, validate) => validate!();
  refusal(await never.session.execute({ type: 'delete-table' }), 'unsupported');
  const moved = await opened();
  moved.f.selection = 'caret'; moved.f.emit('user-selection');
  const guards: DocxResult<void>[] = [];
  moved.engine.execute = (_action, _token, validate) => {
    guards.push(validate!());
    moved.f.selection = 'text'; moved.f.emit('user-selection');
    guards.push(validate!());
    return guards[1]!;
  };
  refusal(await moved.session.execute({ type: 'delete-table' }), 'stale-selection');
  assert.deepEqual(guards, [{ ok: true, value: undefined }, { ok: false, code: 'stale-selection' }]);
});

test('a table guard kept after the command ended is refused as busy', async () => {
  const { f, engine, session } = await opened();
  f.selection = 'caret'; f.emit('user-selection');
  let kept: (() => DocxResult<void>) | undefined;
  engine.execute = (_action, _token, validate) => { kept = validate; return validate!(); };
  value(await session.execute({ type: 'delete-table' }));
  refusal(kept!(), 'busy');
});
