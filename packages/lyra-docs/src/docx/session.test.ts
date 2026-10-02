import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInternalDocxSession } from './session.js';
import type { DocxEngineEvent, DocxEnginePort, DocxSessionPort } from './engine-port.js';
import type {
  DocxCommand, DocxCommandAvailability, DocxResult, DocxSelection, DocxSource
} from './types.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function value<T>(result: DocxResult<T>): T {
  if (!result.ok) throw new Error(result.code);
  assert.equal(result.ok, true);
  return result.value;
}
function refusal<T>(result: DocxResult<T>, code: string) {
  assert.deepEqual(result, { ok: false, code });
}
function fixture(readOnly = false) {
  let listener: ((event: DocxEngineEvent) => void) | undefined;
  let lost: (() => void) | undefined;
  const f = {
    mount: {} as HTMLElement,
    valid: true,
    claimed: false,
    claimsReleased: 0,
    subscriptions: 0,
    destroyed: 0,
    retained: 0,
    released: [] as object[],
    selection: 'text' as DocxSelection['kind'],
    composing: false,
    canCalls: 0,
    executes: 0,
    focuses: 0,
    opens: 0,
    diagnostics: 0,
    output: new Uint8Array([9, 8, 7]),
    source: null as DocxSource | null,
    signal: null as AbortSignal | null,
    changed: true,
    executeThrows: false,
    inspectThrows: false,
    openGate: null as ReturnType<typeof deferred<DocxResult<DocxEnginePort>>> | null,
    saveGate: null as ReturnType<typeof deferred<Uint8Array>> | null,
    availability: { enabled: true, active: false } as DocxCommandAvailability,
    emit(event: DocxEngineEvent) { listener?.(event); },
    detach() { f.valid = false; lost?.(); }
  };
  const engine: DocxEnginePort = {
    inspect() {
      if (f.inspectThrows) throw new Error('private document details');
      return { selection: f.selection, composing: f.composing };
    },
    subscribe(next) {
      listener = next; f.subscriptions++;
      return () => { listener = undefined; f.subscriptions--; };
    },
    can(_command: DocxCommand) { f.canCalls++; return f.availability; },
    execute() {
      f.executes++;
      if (f.executeThrows) throw new Error('private document details');
      if (f.changed) f.emit('change');
      return { ok: true, value: undefined };
    },
    focus() { f.focuses++; },
    retainSelection() { f.retained++; return {}; },
    releaseSelection(token) { f.released.push(token); },
    save(signal) { f.signal = signal; return f.saveGate?.promise ?? Promise.resolve(f.output); },
    destroy() { f.destroyed++; }
  };
  const port: DocxSessionPort = {
    claimMount(_mount, onLost) {
      if (f.claimed || !f.valid) return { ok: false, code: 'invalid-mount' };
      f.claimed = true; lost = onLost;
      return { ok: true, value: {
        valid: () => f.valid,
        release() { f.claimed = false; lost = undefined; f.claimsReleased++; }
      } };
    },
    open(source, options) {
      f.opens++; f.source = source; f.signal = options.signal;
      assert.equal(options.readOnly, readOnly);
      return f.openGate?.promise ?? Promise.resolve({ ok: true, value: engine });
    },
    subscriberFailed() { f.diagnostics++; }
  };
  const create = () => createInternalDocxSession({ mount: f.mount, readOnly }, port);
  return { f, engine, port, create };
}
async function opened(readOnly = false, source: DocxSource = { kind: 'docx', bytes: new Uint8Array([1, 2]) }) {
  const context = fixture(readOnly);
  const session = value(context.create());
  const revision = value(await session.open(source));
  return { ...context, session, revision };
}

test('construction owns one mount without opening an engine and caches frozen state', () => {
  const { f, create } = fixture();
  const session = value(create());
  assert.equal(f.opens, 0);
  assert.equal(session.snapshot().status, 'idle');
  assert.equal(session.snapshot(), session.snapshot());
  assert.ok(Object.isFrozen(session.snapshot()));
  assert.ok(Object.isFrozen(session.snapshot().commands.bold));
  refusal(create(), 'invalid-mount');
  session.destroy(); session.destroy();
  assert.equal(f.claimsReleased, 1);
  assert.equal(session.snapshot().status, 'destroyed');
  assert.equal(value(create()).snapshot().status, 'idle');
});

test('invalid options and preflight calls do not spend the idle session', async () => {
  const { create, port, f } = fixture();
  refusal(createInternalDocxSession({ mount: null as unknown as HTMLElement }, port), 'invalid-option');
  const session = value(create());
  const signal = AbortSignal.abort();
  refusal(await session.open({ kind: 'blank' }, { signal }), 'aborted');
  refusal(await session.open({ kind: 'bad' } as unknown as DocxSource), 'invalid-option');
  refusal(await session.open({ kind: 'docx', bytes: new Uint8Array(4 * 1024 * 1024 + 1) }), 'resource-limit');
  assert.equal(session.snapshot().status, 'idle');
  assert.equal(f.opens, 0);
  value(await session.open({ kind: 'blank' }));
  assert.equal(session.snapshot().dirty, true);
});

test('one open establishes clean document identity and rejects concurrent/repeated opening', async () => {
  const { f, engine, create } = fixture();
  f.openGate = deferred();
  const session = value(create());
  const input = new Uint8Array([1, 2, 3]);
  const pending = session.open({ kind: 'docx', bytes: input });
  assert.equal(session.snapshot().status, 'opening');
  input[0] = 99;
  refusal(await session.open({ kind: 'blank' }), 'busy');
  f.openGate.resolve({ ok: true, value: engine });
  const revision = value(await pending);
  assert.equal(revision.value, 0);
  assert.ok(revision.documentId);
  assert.equal(session.snapshot().dirty, false);
  assert.deepEqual(f.source, { kind: 'docx', bytes: new Uint8Array([1, 2, 3]) });
  refusal(await session.open({ kind: 'blank' }), 'already-open');
});

test('destroy settles delayed opening and disposes its eventual handle exactly once', async () => {
  const { f, engine, create } = fixture();
  f.openGate = deferred();
  const session = value(create());
  const pending = session.open({ kind: 'blank' });
  session.destroy();
  refusal(await pending, 'destroyed');
  const terminal = session.snapshot();
  f.openGate.resolve({ ok: true, value: engine });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.destroyed, 1);
  assert.equal(f.subscriptions, 0);
  assert.equal(session.snapshot(), terminal);
});

test('abort during opening ends in error and cleans late resources without publishing readiness', async () => {
  const { f, engine, create } = fixture();
  f.openGate = deferred();
  const session = value(create());
  const controller = new AbortController();
  const pending = session.open({ kind: 'blank' }, { signal: controller.signal });
  controller.abort();
  refusal(await pending, 'aborted');
  assert.equal(session.snapshot().status, 'error');
  assert.deepEqual(session.snapshot().error, { code: 'aborted' });
  refusal(await session.open({ kind: 'blank' }), 'already-open');
  f.openGate.resolve({ ok: true, value: engine });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.destroyed, 1);
});

test('failed readiness normalizes errors and releases engine subscription and mount ownership', async () => {
  const { f, create } = fixture();
  f.inspectThrows = true;
  const session = value(create());
  refusal(await session.open({ kind: 'blank' }), 'open-failed');
  assert.equal(f.destroyed, 1);
  assert.equal(f.subscriptions, 0);
  assert.equal(f.claimsReleased, 1);
  assert.deepEqual(session.snapshot().error, { code: 'open-failed' });
});

test('committed changes alone advance revision; no-op/refusal/selection/focus remain separate', async () => {
  const { f, session, revision } = await opened();
  f.changed = false;
  assert.deepEqual(value(session.execute('bold')), revision);
  f.emit('user-selection'); value(session.focus());
  assert.equal(session.snapshot().revision?.value, 0);
  f.availability = { enabled: false, reason: 'unsupported' };
  refusal(session.execute('bold'), 'unsupported');
  assert.equal(f.executes, 1);
  f.availability = { enabled: true, active: 'mixed' }; f.changed = true;
  assert.equal(value(session.execute('undo')).value, 1);
  assert.equal(session.snapshot().dirty, true);
  assert.equal(session.snapshot().commands.bold.active, 'mixed');
  assert.equal(session.snapshot().commands.undo.active, undefined);
  refusal(session.execute('bold', { expectedRevision: revision }), 'stale-revision');
});

test('readonly permits focus/selection/export while composition refuses mutation and export', async () => {
  const { f, session } = await opened(true);
  refusal(session.execute('bold'), 'read-only');
  value(session.focus()); value(session.retainSelection()).release();
  value(await session.save());
  f.composing = true; f.emit('composition');
  refusal(await session.save(), 'composing');
  value(session.focus());
  assert.equal(f.executes, 0);
});

test('leases are single-owner, preserve toolbar focus loss and invalidate deliberate selection', async () => {
  const { f, session } = await opened();
  const first = value(session.retainSelection());
  const second = value(session.retainSelection());
  assert.equal(f.released.length, 1);
  f.selection = 'none'; f.emit('focus-selection');
  value(session.execute('bold', { selection: second }));
  assert.equal(f.released.length, 2);
  first.release(); second.release();
  assert.equal(f.released.length, 2);
  f.selection = 'text'; f.emit('user-selection');
  const third = value(session.retainSelection());
  f.selection = 'text'; f.emit('user-selection');
  refusal(session.execute('bold', { selection: third }), 'stale-selection');
  assert.equal(f.released.length, 3);
});

test('lease release covers failed execution, composition, content changes and foreign identity', async () => {
  const { f, session } = await opened();
  const other = await opened();
  const foreign = value(other.session.retainSelection());
  refusal(session.execute('bold', { selection: foreign }), 'stale-selection');
  const held = value(session.retainSelection());
  f.executeThrows = true;
  refusal(session.execute('bold', { selection: held }), 'unsupported');
  assert.equal(f.released.length, 1);
  value(session.retainSelection());
  f.emit('change');
  assert.equal(f.released.length, 2);
  value(session.retainSelection());
  f.composing = true; f.emit('composition');
  assert.equal(f.released.length, 3);
  foreign.release(); other.session.destroy();
});

test('saving returns copied bytes, stays dirty until acknowledgement and rejects forged/foreign receipts', async () => {
  const { f, session } = await opened(false, { kind: 'blank' });
  const receipt = value(await session.save());
  assert.equal(session.snapshot().dirty, true);
  assert.notEqual(receipt.bytes, f.output);
  receipt.bytes[0] = 42;
  assert.equal(f.output[0], 9);
  refusal(session.acknowledgeSaved({ ...receipt }), 'stale-save');
  const other = await opened();
  refusal(other.session.acknowledgeSaved(receipt), 'stale-save');
  value(session.acknowledgeSaved(receipt));
  assert.equal(session.snapshot().dirty, false);
  f.emit('change');
  refusal(session.acknowledgeSaved(receipt), 'stale-save');
  assert.equal(session.snapshot().dirty, true);
});

test('starting another save invalidates previous token even if the new save fails', async () => {
  const { f, session } = await opened(false, { kind: 'blank' });
  const old = value(await session.save());
  f.saveGate = deferred();
  const pending = session.save();
  refusal(session.acknowledgeSaved(old), 'stale-save');
  f.saveGate.reject(new Error('private contents'));
  refusal(await pending, 'save-failed');
  assert.equal(session.snapshot().status, 'ready');
  assert.equal(session.snapshot().dirty, true);
});

test('save coherence backstop rejects changed revision and expected revisions before work', async () => {
  const { f, session, revision } = await opened();
  f.emit('change');
  refusal(await session.save({ expectedRevision: revision }), 'stale-revision');
  f.saveGate = deferred();
  const pending = session.save();
  f.emit('change');
  f.saveGate.resolve(f.output);
  refusal(await pending, 'stale-revision');
  assert.equal(session.snapshot().dirty, true);
});

test('aborted save stays busy until underlying barrier settles and preserves edits', async () => {
  const { f, session } = await opened();
  f.saveGate = deferred();
  const controller = new AbortController();
  const pending = session.save({ signal: controller.signal });
  controller.abort();
  assert.equal(f.signal?.aborted, true);
  refusal(await session.save(), 'busy');
  refusal(session.execute('bold'), 'busy');
  refusal(session.focus(), 'busy');
  refusal(session.retainSelection(), 'busy');
  f.saveGate.resolve(f.output);
  refusal(await pending, 'aborted');
  assert.equal(session.snapshot().activity, null);
  value(session.execute('bold'));
  assert.equal(session.snapshot().dirty, true);
});

test('destroy promptly invalidates pending save and retains only a terminal snapshot', async () => {
  const { f, session } = await opened();
  f.saveGate = deferred();
  const pending = session.save();
  session.destroy();
  refusal(await pending, 'destroyed');
  const terminal = session.snapshot();
  f.saveGate.resolve(f.output);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(session.snapshot(), terminal);
  assert.equal(f.destroyed, 1);
  assert.equal(f.subscriptions, 0);
  refusal(session.execute('bold'), 'destroyed');
  refusal(session.focus(), 'destroyed');
});

test('ownership loss invalidates idle/open/ready sessions and releases every handle', async () => {
  const { f, session } = await opened();
  value(session.retainSelection());
  f.detach();
  assert.equal(session.snapshot().status, 'destroyed');
  assert.equal(f.released.length, 1);
  assert.equal(f.subscriptions, 0);
  assert.equal(f.claimsReleased, 1);
  assert.equal(f.destroyed, 1);
});

test('subscriber faults are isolated; unsubscribe and redundant state updates are silent', async () => {
  const { f, session } = await opened();
  let calls = 0;
  const off = session.subscribe(() => { calls++; });
  session.subscribe(() => { throw new Error('private document details'); });
  session.subscribe(() => { assert.equal(session.snapshot().dirty, true); });
  assert.equal(calls, 0);
  const before = session.snapshot();
  f.emit('state');
  assert.equal(session.snapshot(), before);
  assert.equal(calls, 0);
  f.emit('change');
  assert.equal(calls, 1);
  assert.equal(f.diagnostics, 1);
  off(); off(); f.emit('change');
  assert.equal(calls, 1);
});

test('reentrant destruction during readiness never resolves open successfully', async () => {
  const { f, create } = fixture();
  const session = value(create());
  session.subscribe(() => { if (session.snapshot().status === 'ready') session.destroy(); });
  refusal(await session.open({ kind: 'blank' }), 'destroyed');
  assert.equal(f.destroyed, 1);
  assert.equal(session.snapshot().status, 'destroyed');
});

test('committed change inspection faults preserve the revision and fail closed without raw details', async () => {
  const { f, session } = await opened();
  value(session.retainSelection());
  f.inspectThrows = true;
  assert.doesNotThrow(() => f.emit('change'));
  assert.equal(session.snapshot().revision?.value, 1);
  assert.equal(session.snapshot().dirty, true);
  assert.equal(session.snapshot().status, 'error');
  assert.deepEqual(session.snapshot().error, { code: 'engine-failed' });
  assert.equal(f.destroyed, 1);
  assert.equal(f.subscriptions, 0);
  assert.equal(f.claimsReleased, 1);
  assert.equal(f.released.length, 1);
  refusal(session.execute('bold'), 'not-ready');
  assert.ok(!JSON.stringify(session.snapshot()).includes('private document details'));
});

test('port open destroying then throwing cannot resurrect a destroyed session', async () => {
  const { f, port, create } = fixture();
  const session = value(create());
  port.open = () => { session.destroy(); throw new Error('private document details'); };
  refusal(await session.open({ kind: 'blank' }), 'destroyed');
  assert.equal(session.snapshot().status, 'destroyed');
  assert.equal(f.claimsReleased, 1);
  assert.equal(session.snapshot().error, null);
});

test('subscribe destroying then returning its disposer releases that late handle exactly once', async () => {
  const { f, engine, create } = fixture();
  const session = value(create());
  const subscribe = engine.subscribe.bind(engine);
  engine.subscribe = listener => {
    const off = subscribe(listener);
    session.destroy();
    return off;
  };
  refusal(await session.open({ kind: 'blank' }), 'destroyed');
  assert.equal(session.snapshot().status, 'destroyed');
  assert.equal(f.subscriptions, 0);
  assert.equal(f.destroyed, 1);
  assert.equal(f.claimsReleased, 1);
});

test('initial inspection destroying then returning or throwing never establishes readiness', async () => {
  for (const throws of [false, true]) {
    const { f, engine, create } = fixture();
    const session = value(create());
    engine.inspect = () => {
      session.destroy();
      if (throws) throw new Error('private document details');
      return { selection: 'text', composing: false };
    };
    refusal(await session.open({ kind: 'blank' }), 'destroyed');
    assert.equal(session.snapshot().status, 'destroyed');
    assert.equal(session.snapshot().revision, null);
    assert.equal(f.subscriptions, 0);
    assert.equal(f.destroyed, 1);
  }
});

test('runtime inspection destroying the session cannot mutate its terminal snapshot afterward', async () => {
  const { f, engine, session } = await opened();
  let terminal = session.snapshot();
  engine.inspect = () => {
    session.destroy(); terminal = session.snapshot();
    return { selection: 'text', composing: true };
  };
  f.emit('change');
  assert.equal(session.snapshot(), terminal);
  assert.equal(session.snapshot().status, 'destroyed');
});

test('opening and saving notifications recheck caller abort before invoking port work', async () => {
  const { f, create } = fixture();
  const session = value(create());
  const controller = new AbortController();
  session.subscribe(() => { if (session.snapshot().status === 'opening') controller.abort(); });
  refusal(await session.open({ kind: 'blank' }, { signal: controller.signal }), 'aborted');
  assert.equal(f.opens, 0);
  const ready = await opened();
  let saves = 0;
  ready.engine.save = async () => { saves++; return ready.f.output; };
  const saveController = new AbortController();
  ready.session.subscribe(() => { if (ready.session.snapshot().activity === 'saving') saveController.abort(); });
  refusal(await ready.session.save({ signal: saveController.signal }), 'aborted');
  assert.equal(saves, 0);
  assert.equal(ready.session.snapshot().activity, null);
});

test('opening notification destruction avoids port work; save completion destruction denies success', async () => {
  const { f, create } = fixture();
  const session = value(create());
  session.subscribe(() => { if (session.snapshot().status === 'opening') session.destroy(); });
  refusal(await session.open({ kind: 'blank' }), 'destroyed');
  assert.equal(f.opens, 0);
  const ready = await opened();
  let saving = false;
  ready.session.subscribe(() => {
    if (ready.session.snapshot().activity === 'saving') saving = true;
    else if (saving) ready.session.destroy();
  });
  refusal(await ready.session.save(), 'destroyed');
  assert.equal(ready.f.destroyed, 1);
});

test('idle and delayed-open ownership loss releases claims and disposes eventual handles', async () => {
  const idle = fixture();
  const idleSession = value(idle.create());
  idle.f.detach();
  assert.equal(idleSession.snapshot().status, 'destroyed');
  assert.equal(idle.f.claimsReleased, 1);
  const opening = fixture();
  opening.f.openGate = deferred();
  const session = value(opening.create());
  const pending = session.open({ kind: 'blank' });
  opening.f.detach();
  refusal(await pending, 'destroyed');
  opening.f.openGate.resolve({ ok: true, value: opening.engine });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(opening.f.destroyed, 1);
  assert.equal(opening.f.subscriptions, 0);
  assert.equal(opening.f.claimsReleased, 1);
});

test('ordinary opening refusal/rejection and subscription throws release all acquired ownership', async () => {
  for (const failure of ['refusal', 'reject', 'subscribe'] as const) {
    const { f, engine, port, create } = fixture();
    if (failure === 'refusal') port.open = async () => ({ ok: false, code: 'engine-unavailable' });
    if (failure === 'reject') port.open = async () => { throw new Error('private document details'); };
    if (failure === 'subscribe') engine.subscribe = () => { throw new Error('private document details'); };
    const session = value(create());
    refusal(await session.open({ kind: 'blank' }), failure === 'refusal' ? 'engine-unavailable' : 'open-failed');
    assert.equal(session.snapshot().status, 'error');
    assert.equal(f.claimsReleased, 1);
    assert.equal(f.destroyed, failure === 'subscribe' ? 1 : 0);
  }
});

test('owned leases release on early revision/readonly/busy refusals; foreign leases remain foreign', async () => {
  const ready = await opened();
  ready.f.emit('change');
  const lease = value(ready.session.retainSelection());
  refusal(ready.session.execute('bold', { selection: lease, expectedRevision: ready.revision }), 'stale-revision');
  assert.equal(ready.f.released.length, 1);
  const readonly = await opened(true);
  const readLease = value(readonly.session.retainSelection());
  refusal(readonly.session.execute('bold', { selection: readLease }), 'read-only');
  assert.equal(readonly.f.released.length, 1);
  const held = value(ready.session.retainSelection());
  ready.f.saveGate = deferred();
  const save = ready.session.save();
  refusal(ready.session.execute('bold', { selection: held }), 'busy');
  assert.equal(ready.f.released.length, 2);
  ready.f.saveGate.resolve(ready.f.output); value(await save);
  const other = await opened();
  const foreign = value(other.session.retainSelection());
  refusal(ready.session.execute('bold', { selection: foreign }), 'stale-selection');
  assert.equal(other.f.released.length, 0);
  foreign.release();
  assert.equal(other.f.released.length, 1);
});

test('snapshots freeze nested values and reflect real capability changes without inventing commits', async () => {
  const { f, session } = await opened();
  const first = session.snapshot();
  assert.ok(Object.isFrozen(first.selection));
  assert.ok(Object.isFrozen(first.revision));
  assert.ok(Object.isFrozen(first.commands));
  assert.throws(() => { Object.defineProperty(first.selection, 'kind', { value: 'other' }); }, TypeError);
  f.availability = { enabled: false, reason: 'unsupported' }; f.emit('state');
  assert.equal(session.snapshot().commands.bold.reason, 'unsupported');
  assert.equal(session.snapshot().revision?.value, 0);
  assert.notEqual(session.snapshot(), first);
  const disabled = session.snapshot();
  f.emit('state');
  assert.equal(session.snapshot(), disabled);
  f.availability = { enabled: true, active: 'mixed' }; f.emit('state');
  assert.deepEqual(session.can('bold'), { enabled: true, active: 'mixed' });
  assert.equal(session.snapshot().commands.undo.active, undefined);
});

test('destroy after abort promptly settles a still-suspended save', async () => {
  const { f, session } = await opened();
  f.saveGate = deferred();
  const controller = new AbortController();
  const pending = session.save({ signal: controller.signal });
  controller.abort(); session.destroy();
  refusal(await pending, 'destroyed');
  f.saveGate.resolve(f.output);
  await Promise.resolve();
  assert.equal(session.snapshot().status, 'destroyed');
});

test('ready and save-completion observers that cause an engine fault cannot receive success', async () => {
  const initial = fixture();
  const session = value(initial.create());
  session.subscribe(() => {
    if (session.snapshot().status === 'ready') {
      initial.f.inspectThrows = true; initial.f.emit('change');
    }
  });
  refusal(await session.open({ kind: 'blank' }), 'engine-failed');
  assert.equal(session.snapshot().status, 'error');
  const ready = await opened();
  let saving = false;
  ready.session.subscribe(() => {
    if (ready.session.snapshot().activity === 'saving') saving = true;
    else if (saving && ready.session.snapshot().status === 'ready') {
      ready.f.inspectThrows = true; ready.f.emit('change');
    }
  });
  refusal(await ready.session.save(), 'engine-failed');
  assert.equal(ready.session.snapshot().status, 'error');
  assert.equal(ready.session.snapshot().dirty, true);
});

test('execute and focus report the engine fault caused by their synchronous event', async () => {
  const execution = await opened();
  execution.f.inspectThrows = true;
  refusal(execution.session.execute('bold'), 'engine-failed');
  assert.equal(execution.session.snapshot().revision?.value, 1);
  assert.equal(execution.session.snapshot().dirty, true);
  const focusing = await opened();
  focusing.f.inspectThrows = true;
  focusing.engine.focus = () => { focusing.f.emit('user-selection'); };
  refusal(focusing.session.focus(), 'engine-failed');
  assert.equal(focusing.session.snapshot().status, 'error');
});

test('acknowledgement and saving observers report an induced fault rather than success or destruction', async () => {
  const acknowledgement = await opened(false, { kind: 'blank' });
  const receipt = value(await acknowledgement.session.save());
  acknowledgement.session.subscribe(() => {
    if (!acknowledgement.session.snapshot().dirty) {
      acknowledgement.f.inspectThrows = true; acknowledgement.f.emit('change');
    }
  });
  refusal(acknowledgement.session.acknowledgeSaved(receipt), 'engine-failed');
  assert.equal(acknowledgement.session.snapshot().dirty, true);
  const saving = await opened();
  saving.session.subscribe(() => {
    if (saving.session.snapshot().activity === 'saving') {
      saving.f.inspectThrows = true; saving.f.emit('change');
    }
  });
  refusal(await saving.session.save(), 'engine-failed');
  assert.equal(saving.session.snapshot().status, 'error');
});

test('late retained-selection tokens are released after destroy or fail-closed errors', async () => {
  for (const failure of ['destroy', 'engine'] as const) {
    const { f, engine, session } = await opened();
    const token = {};
    engine.retainSelection = () => {
      if (failure === 'destroy') session.destroy();
      else { f.inspectThrows = true; f.emit('state'); }
      return token;
    };
    refusal(session.retainSelection(), failure === 'destroy' ? 'destroyed' : 'engine-failed');
    assert.deepEqual(f.released, [token]);
    assert.equal(f.destroyed, 1);
    session.destroy();
    assert.deepEqual(f.released, [token]);
  }
});

test('releasing an old lease can invalidate the session before a replacement token is requested', async () => {
  const { f, engine, session } = await opened();
  value(session.retainSelection());
  engine.releaseSelection = token => { f.released.push(token); session.destroy(); };
  refusal(session.retainSelection(), 'destroyed');
  assert.equal(f.retained, 1);
  assert.equal(f.released.length, 1);
});

test('capability checks cannot return enabled after reentrant destruction', async () => {
  const { engine, session } = await opened();
  engine.can = () => { session.destroy(); return { enabled: true }; };
  assert.deepEqual(session.can('bold'), { enabled: false, reason: 'destroyed' });
  assert.equal(session.snapshot().status, 'destroyed');
});

test('lease release during no-op execution cannot leave an already-computed successful result', async () => {
  const { f, engine, session } = await opened();
  f.changed = false;
  const lease = value(session.retainSelection());
  engine.releaseSelection = token => { f.released.push(token); session.destroy(); };
  refusal(session.execute('bold', { selection: lease }), 'destroyed');
  assert.equal(f.released.length, 1);
});

test('reentrant capability destruction cannot overwrite its terminal snapshot with partial enabled commands', async () => {
  const { f, engine, session } = await opened();
  let terminal = session.snapshot();
  engine.can = command => {
    if (command === 'italic') { session.destroy(); terminal = session.snapshot(); }
    return { enabled: true };
  };
  f.emit('state');
  assert.equal(session.snapshot(), terminal);
  assert.ok(Object.values(session.snapshot().commands).every(command => !command.enabled && command.reason === 'destroyed'));
  const throwing = await opened();
  throwing.engine.can = () => { throwing.session.destroy(); throw new Error('private document details'); };
  assert.deepEqual(throwing.session.can('bold'), { enabled: false, reason: 'destroyed' });
});

test('independently evaluated modules mint distinct document identities and reject foreign expected revisions', async () => {
  const url = new URL('./session.js', import.meta.url);
  const firstModule = await import(`${url.href}?identity=first`) as typeof import('./session.js');
  const secondModule = await import(`${url.href}?identity=second`) as typeof import('./session.js');
  const first = fixture(), second = fixture();
  const firstSession = value(firstModule.createInternalDocxSession({ mount: first.f.mount }, first.port));
  const secondSession = value(secondModule.createInternalDocxSession({ mount: second.f.mount }, second.port));
  const revision = value(await firstSession.open({ kind: 'blank' }));
  const other = value(await secondSession.open({ kind: 'blank' }));
  assert.notEqual(other.documentId, revision.documentId);
  refusal(secondSession.execute('bold', { expectedRevision: revision }), 'stale-revision');
  refusal(await secondSession.save({ expectedRevision: revision }), 'stale-revision');
  firstSession.destroy(); secondSession.destroy();
});

test('document identity generation failure cleans readiness resources without publishing a ready document', async () => {
  const original = globalThis.crypto.randomUUID;
  try {
    globalThis.crypto.randomUUID = () => { throw new Error('unavailable randomness'); };
    const { f, create } = fixture();
    const session = value(create());
    refusal(await session.open({ kind: 'blank' }), 'open-failed');
    assert.equal(session.snapshot().status, 'error');
    assert.equal(f.destroyed, 1);
    assert.equal(f.subscriptions, 0);
    assert.equal(f.claimsReleased, 1);
  } finally { globalThis.crypto.randomUUID = original; }
});
