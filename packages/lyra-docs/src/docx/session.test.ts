import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInternalDocxSession, refreshInternalDocxTableLabels } from './session.js';
import { imageFixture } from '../../test/corpus.js';
import { unzipSync } from 'fflate';
import type { DocxEngineImageInsertion } from './engine-port.js';
import type { DocxEngineEvent, DocxEnginePort, DocxSessionPort } from './engine-port.js';
import type {
  DocxAction, DocxCommandAvailability, DocxResult, DocxSelection, DocxSource, DocxFormatting
} from './types.js';
const formatting: DocxFormatting = Object.freeze({ paragraphStyleId: null, alignment: null,
  fontFamily: null, fontSizePoints: null, color: null, bulletList: false, numberedList: false });

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
    formatting,
    styleReads: 0,
    fontReads: 0,
    searches: 0,
    navigations: 0,
    replacements: [] as string[],
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
      return { selection: f.selection, composing: f.composing, formatting: f.formatting };
    },
    subscribe(next) {
      listener = next; f.subscriptions++;
      return () => { listener = undefined; f.subscriptions--; };
    },
    can(_command: DocxAction) { f.canCalls++; return f.availability; },
    paragraphStyles() { f.styleReads++; return Object.freeze({ items: Object.freeze([]), truncated: false }); },
    fontFamilies() { f.fontReads++; return Object.freeze({ items: Object.freeze([]), truncated: false }); },
    find() { f.searches++; return { matches: [{ token: {}, text: 'alpha', before: '', after: ' beta' }], truncated: false }; },
    selectMatch() { f.navigations++; f.emit('user-selection'); return { ok: true, value: undefined }; },
    replaceMatch(_token, text) { f.replacements.push(text); f.emit('user-selection'); f.emit('change'); return { ok: true, value: undefined }; },
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

async function insertionFixture() {
  const h = await opened(); h.f.selection = 'caret'; h.f.emit('user-selection');
  const state = { epoch: 0, captures: 0, releases: 0, calls: 0, capturedBytes: null as Uint8Array | null,
    gate: null as ReturnType<typeof deferred<void>> | null, commit: true, throwAfterCommit: false,
    onCapture() {}, beforeCommit() {}, afterCommit() {} };
  h.engine.beginImageInsertion = () => {
    const epoch = state.epoch; state.captures++; state.onCapture(); let released = false;
    const handle: DocxEngineImageInsertion = {
      validate: () => released || epoch !== state.epoch ? { ok: false, code: 'stale-selection' } : { ok: true, value: undefined },
      async execute(source, operation) {
        state.calls++; state.capturedBytes = source.bytes;
        if (state.gate) await state.gate.promise;
        const current = operation.validateOriginal(); if (!current.ok) return current;
        state.beforeCommit();
        const armed = operation.armCommit(); if (!armed.ok) return armed;
        if (state.commit) h.f.emit('change');
        state.afterCommit();
        if (state.throwAfterCommit) throw new Error('late failure');
        return { ok: true, value: undefined };
      },
      release() { if (!released) { released = true; state.releases++; } }
    };
    return { ok: true, value: handle };
  };
  const source = () => ({ bytes: Object.entries(unzipSync(imageFixture('image-simple'))).find(([name]) => name.endsWith('.png'))![1], widthPoints: 48, heightPoints: 24 });
  return { ...h, state, source };
}

test('insertion captures native intent before caller reflection and rejects same-kind hidden caret changes', async () => {
  const h = await insertionFixture(), before = h.session.snapshot();
  let traps = 0;
  const source = new Proxy(h.source(), { ownKeys(target) {
    traps++; assert.equal(h.state.captures, 1); h.state.epoch++; h.f.emit('focus-selection'); return Reflect.ownKeys(target);
  } });
  refusal(await h.session.insertImage(source), 'stale-selection');
  assert.equal(h.session.snapshot().selection.version, before.selection.version);
  assert.equal(h.state.calls, 0); assert.equal(h.state.releases, 1); assert.equal(traps, 1);
});

test('insertion owns synchronous bytes before activity and rejects every competing method without inspecting payload', async () => {
  const h = await insertionFixture(), source = h.source(), original = source.bytes.slice();
  h.state.gate = deferred<void>();
  let sawActivity = false;
  h.session.subscribe(() => { if (h.session.snapshot().activity === 'inserting-image') { sawActivity = true; source.bytes.fill(0); } });
  const pending = h.session.insertImage(source);
  assert.equal(h.session.snapshot().activity, 'inserting-image'); assert.equal(sawActivity, true);
  assert.deepEqual(h.state.capturedBytes, original);
  const hostile = new Proxy(source, { getPrototypeOf() { throw new Error('must not inspect'); } });
  refusal(await h.session.insertImage(hostile), 'busy');
  refusal(h.session.focus(), 'busy'); refusal(h.session.retainSelection(), 'busy'); refusal(h.session.execute('bold'), 'busy');
  refusal(await h.session.save(), 'busy'); refusal(h.session.imageDescription(), 'busy');
  const hostileOptions = new Proxy({}, { getPrototypeOf() { throw new Error('must not inspect busy options'); } });
  refusal(h.session.selectMatch('unused', hostileOptions), 'busy');
  refusal(h.session.replaceMatch('unused', 'text', hostileOptions), 'busy');
  refusal(h.session.selectImage('invalid' as never), 'busy');
  assert.deepEqual(h.session.canInsertImage(), { enabled: false, reason: 'busy' });
  h.state.gate.resolve(); assert.equal(value(await pending).value, 1); assert.equal(h.state.releases, 1);
  assert.equal(h.session.snapshot().activity, null);
});

test('insertion committed revision wins over subscriber destroy, late throw and ownership loss before inspection', async () => {
  for (const mode of ['subscriber', 'ownership', 'late-throw']) {
    const h = await insertionFixture();
    if (mode === 'subscriber') h.session.subscribe(() => { if (h.session.snapshot().revision?.value === 1) h.session.destroy(); });
    if (mode === 'ownership') h.state.beforeCommit = () => { h.f.valid = false; };
    if (mode === 'late-throw') h.state.throwAfterCommit = true;
    const result = await h.session.insertImage(h.source());
    assert.equal(value(result).value, 1, mode); assert(Object.isFrozen(value(result))); assert.equal(h.state.releases, 1);
  }
});

test('insertion abort cutoff and terminal cleanup cannot rewrite an already committed result', async () => {
  const pending = await insertionFixture(), abort = new AbortController(); pending.state.gate = deferred<void>();
  const operation = pending.session.insertImage(pending.source(), { signal: abort.signal });
  abort.abort(); assert.equal(pending.session.snapshot().activity, 'inserting-image'); assert.equal(pending.state.releases, 0);
  pending.state.gate.resolve(); refusal(await operation, 'aborted'); assert.equal(pending.state.releases, 1); assert.equal(pending.session.snapshot().revision?.value, 0);
  const committed = await insertionFixture(), lateAbort = new AbortController();
  committed.state.afterCommit = () => lateAbort.abort();
  assert.equal(value(await committed.session.insertImage(committed.source(), { signal: lateAbort.signal })).value, 1);
  const destroyed = await insertionFixture(); destroyed.state.gate = deferred<void>();
  const late = destroyed.session.insertImage(destroyed.source()); destroyed.session.destroy();
  refusal(await late, 'destroyed'); assert.equal(destroyed.state.releases, 1);
  destroyed.state.gate.resolve(); await Promise.resolve(); assert.equal(destroyed.session.snapshot().revision?.value, 0);
});

test('insertion original lease invalidation and unlatched success never manufacture a committed revision', async () => {
  const h = await insertionFixture(), lease = value(h.session.retainSelection()); h.state.gate = deferred<void>();
  const pending = h.session.insertImage(h.source(), { selection: lease }); lease.release(); h.state.gate.resolve();
  refusal(await pending, 'stale-selection'); assert.equal(h.f.released.length, 1); assert.equal(h.state.releases, 1);
  const noCommit = await insertionFixture(); noCommit.state.commit = false;
  refusal(await noCommit.session.insertImage(noCommit.source()), 'engine-failed'); assert.equal(noCommit.session.snapshot().revision?.value, 0);
});

test('insertion with a foreign lease preserves the genuine original retained selection', async () => {
  const h = await insertionFixture(), lease = value(h.session.retainSelection());
  refusal(await h.session.insertImage(h.source(), { selection: { release() {} } }), 'stale-selection');
  assert.equal(h.f.released.length, 0); assert.equal(h.state.calls, 0);
  assert.equal(value(h.session.execute('bold', { selection: lease })).value, 1);
  assert.equal(h.f.released.length, 1);
});

test('insertion releases a handle returned after reentrant destruction during capture', async () => {
  const h = await insertionFixture(); h.state.onCapture = () => h.session.destroy();
  refusal(await h.session.insertImage(h.source()), 'destroyed');
  assert.equal(h.state.releases, 1); assert.equal(h.state.calls, 0);
});

test('insertion rejects activity-subscriber native ABA and prior-input change without arming a commit', async () => {
  const h = await insertionFixture(), before = h.session.snapshot();
  h.session.subscribe(() => { if (h.session.snapshot().activity === 'inserting-image') { h.state.epoch += 2; } });
  refusal(await h.session.insertImage(h.source()), 'stale-selection');
  assert.equal(h.session.snapshot().selection.version, before.selection.version); assert.equal(h.state.calls, 0); assert.equal(h.state.releases, 1);
  const flush = await insertionFixture();
  flush.engine.beginImageInsertion = () => ({ ok: true, value: {
    validate: () => ({ ok: true, value: undefined }),
    execute: async (_source, operation) => { flush.f.emit('change'); return operation.armCommit(); }, release() { flush.state.releases++; }
  } });
  refusal(await flush.session.insertImage(flush.source()), 'stale-revision');
  assert.equal(flush.session.snapshot().revision?.value, 1); assert.equal(flush.state.releases, 1);
});

test('insertion busy blocks dirty acknowledgement and cached availability performs no engine reads', async () => {
  const h = await insertionFixture(), receipt = value(await h.session.save()), canCalls = h.f.canCalls;
  for (let i = 0; i < 10; i++) assert.deepEqual(h.session.canInsertImage(), { enabled: true });
  assert.equal(h.f.canCalls, canCalls); assert.equal(h.state.captures, 0);
  h.state.gate = deferred<void>(); const pending = h.session.insertImage(h.source());
  refusal(h.session.acknowledgeSaved(receipt), 'busy');
  h.state.gate.resolve(); assert.equal(value(await pending).value, 1);
});

test('basic editing exposes formatting, catalogs and bounded search without engine polling', async () => {
  const { session, f } = await opened();
  assert.equal('formatting' in session.snapshot(), true);
  assert.equal('paragraphStyles' in session, true);
  assert.equal('fontFamilies' in session, true);
  assert.equal('find' in session, true);
  assert.equal('selectMatch' in session, true);
  assert.equal('replaceMatch' in session, true);
  const calls = f.canCalls;
  session.snapshot(); session.snapshot();
  assert.equal(f.canCalls, calls);
});

test('parameterized edits validate before engine calls and keep existing revision and lease gates', async () => {
  const { session, f } = await opened();
  const invalid = { type: 'font-size', points: Infinity } as const;
  const before = f.canCalls;
  assert.deepEqual(session.can(invalid), { enabled: false, reason: 'invalid-option' });
  refusal(session.execute(invalid), 'invalid-option');
  assert.equal(f.canCalls, before);
  assert.equal(f.executes, 0);
  const lease = value(session.retainSelection());
  const revision = session.snapshot().revision!;
  const edited = value(session.execute({ type: 'alignment', value: 'center' }, { expectedRevision: revision, selection: lease }));
  assert.equal(edited.value, revision.value + 1);
  assert.equal(f.released.length, 1);
  refusal(session.execute({ type: 'alignment', value: 'left' }, { expectedRevision: revision }), 'stale-revision');
});

test('formatting state is immutable and stable, with no catalog, search or save work on input', async () => {
  const { session, f, engine } = await opened();
  let saves = 0;
  engine.save = async () => { saves++; return new Uint8Array(); };
  const first = session.snapshot();
  f.formatting = { ...formatting };
  f.emit('state');
  assert.equal(session.snapshot(), first);
  f.formatting = { ...formatting, fontFamily: 'Arial', fontSizePoints: 14 };
  f.emit('state');
  const changed = session.snapshot();
  assert.notEqual(changed, first);
  assert.equal(changed.formatting.fontFamily, 'Arial');
  assert.ok(Object.isFrozen(changed.formatting));
  f.emit('change');
  assert.equal(session.snapshot().formatting, changed.formatting);
  assert.deepEqual([f.styleReads, f.fontReads, f.searches, saves], [0, 0, 0, 0]);
  value(session.paragraphStyles()); value(session.fontFamilies());
  assert.deepEqual([f.styleReads, f.fontReads], [1, 1]);
});

test('search ids are opaque, revision stamped and invalidated by new queries and committed edits', async () => {
  const { session, f } = await opened();
  const foreign = await opened();
  const first = value(session.find('alpha'));
  assert.equal(first.revision, session.snapshot().revision);
  assert.ok(Object.isFrozen(first)); assert.ok(Object.isFrozen(first.matches)); assert.ok(Object.isFrozen(first.matches[0]));
  assert.deepEqual(Object.keys(first.matches[0]!).sort(), ['after', 'before', 'id', 'text']);
  const id = first.matches[0]!.id;
  refusal(session.selectMatch('forged'), 'stale-search');
  refusal(foreign.session.selectMatch(id), 'stale-search');
  const before = session.snapshot();
  value(session.selectMatch(id));
  assert.equal(session.snapshot().selection.version, before.selection.version + 1);
  assert.equal(session.snapshot().revision, before.revision);
  assert.equal(session.snapshot().dirty, false);
  f.emit('focus-selection');
  value(session.selectMatch(id));
  const next = value(session.find('beta'));
  refusal(session.selectMatch(id), 'stale-search');
  f.emit('change');
  refusal(session.selectMatch(next.matches[0]!.id), 'stale-search');
  session.destroy();
  refusal(session.selectMatch(next.matches[0]!.id), 'destroyed');
});

test('read-only search navigation is allowed while replacement and composed search are refused', async () => {
  const { session, f } = await opened(true);
  const found = value(session.find('alpha'));
  const id = found.matches[0]!.id;
  value(session.selectMatch(id));
  refusal(session.replaceMatch(id, 'changed'), 'read-only');
  assert.deepEqual(f.replacements, []);
  f.composing = true; f.emit('composition');
  refusal(session.find('alpha'), 'composing');
  refusal(session.selectMatch(id), 'composing');
});

test('replace one validates before selection, preserves Unicode and accepts empty deletion', async () => {
  const { session, f } = await opened();
  let found = value(session.find('alpha'));
  const id = found.matches[0]!.id;
  refusal(session.replaceMatch(id, 'x'.repeat(4097)), 'resource-limit');
  assert.equal(f.navigations, 0); assert.deepEqual(f.replacements, []);
  const revision = value(session.replaceMatch(id, '🙂 e\u0301'));
  assert.deepEqual(f.replacements, ['🙂 e\u0301']);
  assert.equal(revision.value, found.revision.value + 1);
  refusal(session.replaceMatch(id, 'again'), 'stale-search');
  found = value(session.find('alpha'));
  value(session.replaceMatch(found.matches[0]!.id, ''));
  assert.deepEqual(f.replacements, ['🙂 e\u0301', '']);
});

test('invalid XML authoring leaves the selection, revision and search match usable', async () => {
  const { session, f } = await opened();
  const found = value(session.find('alpha'));
  const id = found.matches[0]!.id;
  const before = session.snapshot();
  for (const text of ['\u0000', '\u000b', '\ufffe', '\ud800', '\udfff']) {
    refusal(session.replaceMatch(id, text), 'invalid-option');
    refusal(session.execute({ type: 'link', href: '#bookmark', text }), 'invalid-option');
    assert.equal(session.can({ type: 'link', href: '#bookmark', text }).reason, 'invalid-option');
  }
  assert.equal(f.navigations, 0);
  assert.equal(f.executes, 0);
  assert.deepEqual(f.replacements, []);
  assert.equal(session.snapshot(), before);
  value(session.replaceMatch(id, '🙂 東京'));
  assert.deepEqual(f.replacements, ['🙂 東京']);
});

test('search and catalog callbacks cannot return successful data after terminal or revision changes', async () => {
  for (const action of ['find', 'paragraphStyles', 'fontFamilies'] as const) {
    const { session, engine } = await opened();
    const original = engine[action].bind(engine);
    if (action === 'find') engine.find = (...args) => { session.destroy(); return (original as typeof engine.find)(...args); };
    else if (action === 'paragraphStyles') engine.paragraphStyles = () => { session.destroy(); return { items: [], truncated: false }; };
    else engine.fontFamilies = () => { session.destroy(); return { items: [], truncated: false }; };
    refusal<unknown>(action === 'find' ? session.find('alpha') : session[action](), 'destroyed');
  }
  const { session, f, engine } = await opened();
  const original = engine.find;
  engine.find = (...args) => { f.emit('change'); return original(...args); };
  refusal(session.find('alpha'), 'stale-revision');
});

test('reentrant queries preserve the newest registry and invalidate older work', async () => {
  const { session, engine } = await opened();
  const original = engine.find;
  let latest = '';
  engine.find = (query, options) => {
    if (query === 'outer') latest = value(session.find('inner')).matches[0]!.id;
    return original(query, options);
  };
  refusal(session.find('outer'), 'stale-search');
  value(session.selectMatch(latest));
});

test('search navigation options reject malformed records and never invoke accessors', async () => {
  const { session, f } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  let getters = 0;
  for (const options of [null, [], { unexpected: true }, { expectedRevision: { documentId: 'x', value: Infinity } },
    { get expectedRevision() { getters++; return session.snapshot().revision; } }]) {
    refusal(session.selectMatch(id, options as never), 'invalid-option');
    refusal(session.replaceMatch(id, 'new', options as never), 'invalid-option');
  }
  assert.equal(getters, 0); assert.equal(f.navigations, 0); assert.deepEqual(f.replacements, []);
});

test('search navigation refuses symbolic or proxy options without invalidating the current match', async () => {
  const { session, f } = await opened();
  const id = value(session.find('alpha')).matches[0]!.id;
  for (const options of [{ [Symbol('untrusted')]: true },
    { expectedRevision: { documentId: 'foreign', value: -1 } },
    new Proxy({}, { getPrototypeOf() { throw new Error('untrusted prototype'); } }),
    new Proxy({}, { ownKeys() { throw new Error('untrusted keys'); } }),
    new Proxy({ expectedRevision: {} }, { getOwnPropertyDescriptor() { return undefined; } })]) {
    refusal(session.selectMatch(id, options as never), 'invalid-option');
    refusal(session.replaceMatch(id, 'replacement', options as never), 'invalid-option');
  }
  assert.equal(f.navigations, 0);
  assert.deepEqual(f.replacements, []);
  value(session.selectMatch(id));
  assert.equal(f.navigations, 1);
});

test('search navigation and replacement accept the current expected revision and refuse foreign revisions before engine work', async () => {
  const { session, f } = await opened();
  const found = value(session.find('alpha'));
  const id = found.matches[0]!.id;
  const foreign = { documentId: 'foreign-document', value: found.revision.value };
  refusal(session.selectMatch(id, { expectedRevision: foreign }), 'stale-revision');
  refusal(session.replaceMatch(id, 'replacement', { expectedRevision: foreign }), 'stale-revision');
  assert.equal(f.navigations, 0);
  assert.deepEqual(f.replacements, []);
  value(session.selectMatch(id, { expectedRevision: found.revision }));
  assert.equal(f.navigations, 1);
  const replaced = value(session.replaceMatch(id, 'replacement', { expectedRevision: found.revision }));
  assert.deepEqual(f.replacements, ['replacement']);
  assert.equal(replaced.documentId, found.revision.documentId);
  assert.equal(replaced.value, found.revision.value + 1);
});

test('lease release rechecks composition and search generation before navigation or replacement', async () => {
  for (const action of ['select', 'replace'] as const) {
    for (const change of ['composition', 'query'] as const) {
      const { session, f, engine } = await opened();
      const id = value(session.find('alpha')).matches[0]!.id;
      value(session.retainSelection());
      engine.releaseSelection = () => {
        if (change === 'composition') { f.composing = true; f.emit('composition'); }
        else value(session.find('new'));
      };
      const result = action === 'select' ? session.selectMatch(id) : session.replaceMatch(id, 'new');
      refusal<unknown>(result, change === 'composition' ? 'composing' : 'stale-search');
      assert.equal(f.navigations, 0); assert.deepEqual(f.replacements, []);
    }
  }
});

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

test('ownership lost during synchronous mount claiming releases the claim without creating or opening a session', () => {
  for (const kind of ['callback', 'invalid', 'throws']) {
    const { f, create, port } = fixture();
    let releases = 0;
    port.claimMount = (_mount, onLost) => {
      if (kind === 'callback') onLost();
      return { ok: true, value: {
        valid() {
          if (kind === 'throws') throw new Error('mount inspection unavailable');
          return kind !== 'invalid';
        },
        release() { releases++; }
      } };
    };
    refusal(create(), 'invalid-mount');
    assert.equal(releases, 1);
    assert.equal(f.opens, 0);
  }
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
  assert.equal(session.snapshot().dirty, false, 'An untouched blank document has nothing to discard');
  f.emit('change');
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
  f.emit('change');
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
  f.emit('change');
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
      return { selection: 'text', composing: false, formatting };
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
    return { selection: 'text', composing: true, formatting };
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
  acknowledgement.f.emit('change');
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

test('table settlement checks expected revision and leases after prior typing commits', async () => {
  for (const stale of ['revision', 'lease', 'none']) {
    const { session, engine, f, revision } = await opened();
    f.selection = 'caret'; f.emit('user-selection');
    f.selection = 'caret'; f.emit('user-selection');
    const lease = value(session.retainSelection());
    let tableWrites = 0;
    engine.execute = (_action, _token, validate) => {
      assert.equal(typeof validate, 'function');
      f.emit('change');
      const checked = validate!();
      if (!checked.ok) return checked;
      tableWrites++; f.emit('change'); return { ok: true, value: undefined };
    };
    const result = session.execute({ type: 'insert-table', rows: 2, columns: 2 },
      stale === 'revision' ? { expectedRevision: revision } : stale === 'lease' ? { selection: lease } : {});
    if (stale === 'revision') refusal(result, 'stale-revision');
    else if (stale === 'lease') refusal(result, 'stale-selection');
    else assert.equal(result.ok, true);
    assert.equal(tableWrites, stale === 'none' ? 1 : 0);
    assert.equal(session.snapshot().revision?.value, stale === 'none' ? 2 : 1);
  }
});

test('synchronous table ownership blocks reentrant commands, navigation, focus and save', async () => {
  const { session, engine, f } = await opened();
  f.selection = 'caret'; f.emit('user-selection');
  const match = value(session.find('alpha')).matches[0]!;
  const nested: unknown[] = [];
  engine.execute = (_action, _token, validate) => {
    assert.equal(validate!().ok, true);
    nested.push(session.execute('bold'), session.execute({ type: 'delete-table' }), session.focus(),
      session.retainSelection(), session.selectMatch(match.id), session.replaceMatch(match.id, 'x'), session.can({ type: 'delete-table' }));
    f.emit('change');
    return { ok: true, value: undefined };
  };
  const result = session.execute({ type: 'delete-table' });
  assert.equal(result.ok, true);
  for (const value of nested.slice(0, 6)) assert.deepEqual(value, { ok: false, code: 'busy' });
  assert.deepEqual(nested[6], { enabled: false, reason: 'busy' });
  assert.equal(session.snapshot().revision?.value, 1);
  assert.equal(session.can('bold').enabled, true);
});

test('table guard detects changed selection generation, released leases and terminal ownership', async () => {
  for (const effect of ['selection', 'lease', 'revision', 'destroy', 'detach', 'composition', 'fault']) {
    const { session, engine, f } = await opened();
  f.selection = 'caret'; f.emit('user-selection');
    const lease = value(session.retainSelection());
    let writes = 0;
    engine.execute = (_action, _token, validate) => {
      assert.equal(validate!().ok, true);
      if (effect === 'selection') { f.emit('user-selection'); f.emit('user-selection'); }
      if (effect === 'lease') lease.release();
      if (effect === 'revision') f.emit('change');
      if (effect === 'destroy') session.destroy();
      if (effect === 'detach') f.detach();
      if (effect === 'composition') { f.composing = true; f.emit('composition'); }
      if (effect === 'fault') { f.inspectThrows = true; f.emit('state'); }
      const valid = validate!();
      if (!valid.ok) return valid;
      writes++; return { ok: true, value: undefined };
    };
    const result = session.execute({ type: 'delete-table' }, effect === 'lease' ? { selection: lease } : {});
    assert.equal(result.ok, false, effect);
    assert.equal(writes, 0, effect);
  }
});

test('table refusals and thrown preflight release synchronous ownership without document changes', async () => {
  for (const throwing of [false, true]) {
    const { session, engine, f, revision } = await opened();
    f.selection = 'caret'; f.emit('user-selection');
    const receipt = value(await session.save());
    engine.execute = () => { if (throwing) throw Error('private'); return { ok: false, code: 'unsupported' }; };
    refusal(session.execute({ type: 'delete-table' }), 'unsupported');
    assert.deepEqual(session.snapshot().revision, revision);
    assert.equal(session.can('bold').enabled, true);
    assert.equal(session.acknowledgeSaved(receipt).ok, true);
    assert.equal(f.executes, 0);
  }
});

test('execute option accessors and invalid table actions never touch engine capabilities or mutation', async () => {
  const { session, f } = await opened(); const lease = value(session.retainSelection()); const before = f.canCalls;
  for (const options of [null, [], { extra: true }, { expectedRevision: { documentId: 'x', value: NaN } },
    { get selection() { throw Error('getter'); } }, { get expectedRevision() { throw Error('getter'); } }, { selection: 'forged' }]) {
    refusal(session.execute({ type: 'delete-table' }, options as never), 'invalid-option');
  }
  refusal(session.execute({ type: 'insert-table', rows: 0, columns: 2 }), 'invalid-option');
  refusal(session.execute({ type: 'insert-table', rows: 0, columns: 2 }, { selection: lease }), 'invalid-option');
  assert.equal(f.released.length, 0);
  assert.equal(f.canCalls, before); assert.equal(f.executes, 0);
});

test('table context is copied, immutable and identity-stable across unchanged engine state', async () => {
  const { session, engine, f } = await opened();
  f.selection = 'caret'; f.emit('user-selection');
  const inspect = engine.inspect, table = { rows: 2, columns: 3, rowIndex: 0, columnIndex: 1 };
  engine.inspect = () => ({ ...inspect(), table });
  f.emit('state'); const first = session.snapshot();
  assert.deepEqual(first.table, table); assert.notEqual(first.table, table); assert.equal(Object.isFrozen(first.table), true);
  f.emit('state'); assert.equal(session.snapshot(), first);
  table.rowIndex = 1; f.emit('state'); assert.equal(session.snapshot().table?.rowIndex, 1);
  engine.inspect = inspect; f.emit('state'); assert.equal(session.snapshot().table, null);
});


test('internal table label refresh is copied presentation state and stops at busy or terminal ownership', async () => {
  const { session, engine, f } = await opened();
  const labels = { insertRowBelow: 'Below', insertColumnRight: 'Right' };
  const before = session.snapshot();
  assert.equal(refreshInternalDocxTableLabels(session, labels), false);
  let calls = 0;
  engine.refreshTableLabels = copy => {
    calls++;
    assert.notEqual(copy, labels);
    assert.equal(Object.isFrozen(copy), true);
    return true;
  };
  assert.equal(refreshInternalDocxTableLabels(session, labels), true);
  assert.equal(session.snapshot(), before);
  assert.equal(f.executes, 0);
  f.saveGate = deferred<Uint8Array>();
  const saving = session.save();
  assert.equal(refreshInternalDocxTableLabels(session, labels), false);
  f.saveGate.resolve(f.output); await saving;
  engine.refreshTableLabels = () => { throw Error('label fault'); };
  assert.equal(refreshInternalDocxTableLabels(session, labels), false);
  session.destroy();
  assert.equal(refreshInternalDocxTableLabels(session, labels), false);
  assert.equal(refreshInternalDocxTableLabels({} as never, labels), false);
  assert.equal(calls, 1);
});

test('image snapshots contain frozen dimensions only and description reads preserve revision and leases', async () => {
  const { session, engine, f } = await opened();
  const image = { widthPoints: 120, heightPoints: 60 };
  engine.inspect = () => ({ selection: 'other', composing: f.composing, formatting, image });
  engine.imageDescription = () => ({ ok: true, value: { title: 'Title', description: 'Description' } });
  f.emit('user-selection');
  const before = session.snapshot(), lease = value(session.retainSelection());
  assert.deepEqual(before.image, image); assert(Object.isFrozen(before.image));
  f.emit('state'); assert.equal(session.snapshot(), before);
  const copied = value(session.imageDescription()); assert(Object.isFrozen(copied));
  assert.equal(session.snapshot(), before); assert.equal(f.released.length, 0);
  engine.execute = (_command, _token, validate) => validate!();
  assert.deepEqual(session.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 }, { selection: lease }), { ok: true, value: before.revision });
  assert.equal(session.snapshot().dirty, false); assert.equal(session.snapshot().revision, before.revision);
  assert.equal(f.released.length, 1);
  assert.deepEqual(session.execute({ type: 'delete-image' }, { selection: lease }), { ok: false, code: 'stale-selection' });
  session.destroy(); assert.equal(session.snapshot().image, null);
});

test('image execution binds revision and selection before settlement even without caller guards', async () => {
  for (const event of ['change', 'user-selection', 'composition'] as const) {
    const { session, engine, f } = await opened();
    engine.inspect = () => ({ selection: 'other', composing: f.composing, formatting, image: { widthPoints: 120, heightPoints: 60 } });
    f.emit('user-selection'); const revision = session.snapshot().revision;
    let actualDispatch = 0;
    engine.execute = (_command, _token, validate) => {
      if (event === 'composition') f.composing = true;
      f.emit(event);
      const allowed = validate!();
      if (allowed.ok) actualDispatch++;
      return allowed;
    };
    refusal(session.execute({ type: 'delete-image' }), event === 'change' ? 'stale-revision' : event === 'composition' ? 'composing' : 'stale-selection');
    assert.equal(actualDispatch, 0);
    assert.equal(session.snapshot().revision!.value, revision!.value + (event === 'change' ? 1 : 0));
  }
});

test('image ownership refuses reentrant work and stale ABA, released or foreign leases', async () => {
  const { session, engine, f } = await opened();
  engine.inspect = () => ({ selection: 'other', composing: false, formatting, image: { widthPoints: 120, heightPoints: 60 } });
  f.emit('user-selection'); const lease = value(session.retainSelection());
  f.emit('user-selection'); f.emit('user-selection');
  refusal(session.execute({ type: 'delete-image' }, { selection: lease }), 'stale-selection');
  refusal(session.execute({ type: 'delete-image' }, { selection: { release() {} } }), 'stale-selection');
  const released = value(session.retainSelection()); released.release();
  refusal(session.execute({ type: 'delete-image' }, { selection: released }), 'stale-selection');
  engine.execute = (_command, _token, validate) => {
    refusal(session.execute('bold'), 'busy');
    refusal(session.imageDescription(), 'busy');
    return validate!();
  };
  assert(session.execute({ type: 'delete-image' }).ok);
  assert.equal(session.snapshot().revision!.value, 0);
});

test('image metadata read gates and reentrant terminal changes never disclose stale data', async () => {
  const { session, engine, f } = await opened(true);
  engine.imageDescription = () => ({ ok: true, value: { title: '', description: '' } });
  assert(session.imageDescription().ok, 'read-only allows metadata read');
  f.composing = true; f.emit('composition'); refusal(session.imageDescription(), 'composing');
  f.composing = false; f.emit('composition');
  engine.imageDescription = () => { session.destroy(); return { ok: true, value: { title: 'stale', description: 'stale' } }; };
  refusal(session.imageDescription(), 'destroyed');
});


test('image navigation permits read-only selection, preserves singleton leases, and invalidates only actual moves', async () => {
  const { session, engine, f } = await opened(true);
  let move = false;
  engine.selectImage = () => { if (move) f.emit('user-selection'); return { ok: true, value: undefined }; };
  const initial = session.snapshot(), lease = value(session.retainSelection());
  assert(session.selectImage('next').ok); assert.equal(f.released.length, 0);
  assert.equal(session.snapshot(), initial);
  move = true; assert(session.selectImage('previous').ok); assert.equal(f.released.length, 1);
  assert.equal(session.snapshot().revision, initial.revision); assert.equal(session.snapshot().dirty, initial.dirty);
  assert.equal(session.snapshot().selection.version, initial.selection.version + 1);
  lease.release(); session.destroy(); refusal(session.selectImage('next'), 'destroyed');
});

test('image navigation owns reentrant work and refuses invalid options, composition and replacement', async () => {
  const { session, engine, f } = await opened();
  refusal(session.selectImage('forged' as never), 'invalid-option');
  f.composing = true; f.emit('composition'); refusal(session.selectImage('next'), 'composing');
  f.composing = false; f.emit('composition');
  engine.selectImage = () => {
    refusal(session.selectImage('next'), 'busy'); refusal(session.execute('bold'), 'busy');
    return { ok: true, value: undefined };
  };
  assert(session.selectImage('next').ok);
  engine.selectImage = () => { f.emit('change'); return { ok: true, value: undefined }; };
  refusal(session.selectImage('next'), 'stale-revision');
  engine.selectImage = () => { session.destroy(); return { ok: true, value: undefined }; };
  refusal(session.selectImage('next'), 'destroyed');
});


test('resource readiness publishes a new image snapshot without changing selection intent or leases', async () => {
  const { session, engine, f } = await opened(); let ready = false;
  engine.inspect = () => ({ selection: 'other', composing: false, formatting, image: { widthPoints: 120, heightPoints: 60 }, imageReady: ready });
  f.emit('user-selection'); const before = session.snapshot(), lease = value(session.retainSelection());
  let published = 0; session.subscribe(() => { published++; });
  ready = true; f.emit('state');
  assert.equal(published, 1); assert.notEqual(session.snapshot(), before); assert.deepEqual(session.snapshot(), before);
  assert.equal(session.snapshot().image, before.image);
  assert.equal(f.released.length, 0); assert.equal(session.snapshot().selection.version, before.selection.version);
  const after = session.snapshot(); f.emit('state'); assert.equal(session.snapshot(), after); assert.equal(published, 1);
  lease.release(); session.destroy();
});

test('insertion ordinary refusal and synchronous port exceptions clear busy without losing committed outcomes', async () => {
  for (const mode of ['refuse', 'capture-throw', 'dispatch-throw', 'commit-throw']) {
    const h = await insertionFixture(); let releases = 0;
    h.engine.beginImageInsertion = () => {
      if (mode === 'capture-throw') throw new Error('capture unavailable');
      return { ok: true, value: { validate: () => ({ ok: true, value: undefined }), release() { releases++; },
        execute(_source, operation) {
          if (mode === 'refuse') return Promise.resolve({ ok: false, code: 'unsupported' });
          if (mode === 'commit-throw') { assert(operation.armCommit().ok); h.f.emit('change'); }
          throw new Error('dispatch unavailable');
        }
      } };
    };
    const result = await h.session.insertImage(h.source());
    if (mode === 'commit-throw') assert.equal(value(result).value, 1);
    else refusal(result, mode === 'refuse' ? 'unsupported' : 'engine-failed');
    assert.equal(h.session.snapshot().activity, null); assert.equal(releases, mode === 'capture-throw' ? 0 : 1);
    assert.equal(h.session.snapshot().revision?.value, mode === 'commit-throw' ? 1 : 0);
    h.session.destroy();
  }
});
