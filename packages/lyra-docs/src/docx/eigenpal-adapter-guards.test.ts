import assert from 'node:assert/strict';
import test from 'node:test';
import type { EigenpalReviewReport } from './eigenpal-review.js';
import type { DocxEngineEvent, DocxEnginePort } from './engine-port.js';
import type { DocxReviewAction } from './review-types.js';
import {
  deferred, documentToolsHarness, failEngine, harness, holdNativeInput, imageHarness, openSubscribed, reached, sessionStates, settled,
  type SessionControl, type StateArrangement,
} from '../../test/eigenpal-adapter-harness.js';

type DocumentHarness = Awaited<ReturnType<typeof documentToolsHarness>>;

const addComment = { type: 'add-comment', text: 'Note', author: 'Editor' } as const;
const matchOptions = { matchCase: false, wholeWord: false, limit: 1 };
const control = (h: DocumentHarness): SessionControl => ({ ...h, loseOwnership: () => { h.state.owned = false; } });
// Every state in which the session cannot take a new request, with the refusal it must give.
const refusalStates = sessionStates('teardown', 'ownership loss', 'engine failure', 'composition', 'native input dispatching', 'save in flight', 'command in flight');

test('search navigation and replacement refuse while a native input event is still dispatching', async () => {
  const h = harness(), port = await openSubscribed(h);
  let selections = 0;
  const select = h.engine.selectMatch.bind(h.engine);
  h.engine.selectMatch = match => { selections++; return select(match); };
  const match = port.find('a', matchOptions).matches[0]!;
  const release = holdNativeInput(h.child);
  assert.deepEqual(port.selectMatch(match.token), { ok: false, code: 'busy' });
  assert.deepEqual(port.replaceMatch(match.token, 'replacement'), { ok: false, code: 'busy' });
  assert.equal(selections, 0); assert.equal(h.executions(), 0);
  release();
  assert.deepEqual(port.selectMatch(match.token), { ok: true, value: undefined });
  assert.equal(selections, 1);
  port.destroy();
});

test('replacement stops at the write gate when the session changes during its selection step', async () => {
  type Context = { h: ReturnType<typeof harness>; port: DocxEnginePort; loseOwnership(): void };
  const changes: [name: string, code: string, change: (context: Context) => void | (() => Promise<unknown>)][] = [
    ['teardown', 'destroyed', ({ port }) => port.destroy()],
    ['engine failure', 'engine-failed', ({ h }) => failEngine(h)],
    ['composition', 'composing', ({ h }) => { h.child.dispatchEvent(new Event('compositionstart')); }],
    ['ownership loss', 'destroyed', ({ loseOwnership }) => loseOwnership()],
    ['native input dispatching', 'busy', ({ h }) => { holdNativeInput(h.child); }],
    ['command in flight', 'busy', ({ h, port }) => {
      const gate = deferred<void>();
      h.prepareWith(() => gate.promise);
      const running = port.execute('bold', undefined, settled);
      return async () => { gate.resolve(); await running; };
    }],
  ];
  for (const [name, code, change] of changes) {
    const h = harness();
    let owned = true, changed = false, release: (() => Promise<unknown>) | undefined;
    const port = await openSubscribed(h, { owned: () => owned });
    const match = port.find('a', matchOptions).matches[0]!;
    port.subscribe(event => {
      if (event !== 'user-selection' || changed) return;
      changed = true;
      const leave = change({ h, port, loseOwnership: () => { owned = false; } });
      release = typeof leave === 'function' ? leave : undefined;
    });
    assert.deepEqual(port.replaceMatch(match.token, 'replacement'), { ok: false, code }, name);
    assert.equal(h.executions(), 0, name);
    await release?.();
    port.destroy();
  }
});

test('replacement in a read-only session never reaches the write step', async () => {
  const h = harness(), port = await openSubscribed(h, { readOnly: true });
  const match = port.find('a', matchOptions).matches[0]!;
  assert.deepEqual(port.replaceMatch(match.token, 'replacement'), { ok: false, code: 'read-only' });
  assert.equal(h.executions(), 0);
  port.destroy();
});

test('document tools refuse with the session state before reading the document', async () => {
  const operations: [string, (port: DocxEnginePort) => unknown][] = [
    ['outline', port => port.outline!()],
    ['document inspection', port => port.inspectDocument!()],
    ['review report', port => port.review!()],
    ['review navigation', port => port.selectReviewItem!({})],
    ['document navigation', port => port.selectDocumentTarget!({})],
  ];
  const settling: StateArrangement = async h => {
    h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
    return async () => {};
  };
  for (const [state, code, arrange] of [...refusalStates, ['native input settling', 'busy', settling] as const]) {
    const h = await documentToolsHarness(), release = await arrange(control(h)), flushes = h.state.flushes;
    for (const [operation, run] of operations) assert.deepEqual(run(h.port), { ok: false, code }, `${operation} during ${state}`);
    assert.deepEqual(h.port.canReview!({ type: 'track-changes', enabled: false, author: 'Editor' }),
      { enabled: false, reason: code }, `review capability during ${state}`);
    assert.equal(h.state.flushes, flushes, state); assert.equal(h.state.navigations, 0, state);
    await release(); h.port.destroy();
  }
});

test('document navigation refuses when the session changes while its guard is being captured', async () => {
  const changes: [name: string, code: string, change: (h: DocumentHarness) => void][] = [
    ['ownership loss', 'destroyed', h => { h.state.owned = false; }],
    ['engine failure', 'engine-failed', h => failEngine(h)],
    ['composition', 'composing', h => { h.child.dispatchEvent(new Event('compositionstart')); }],
    ['revision change', 'stale-revision', h => { h.state.revision++; }],
    ['mount replacement', 'stale-revision', h => { Object.assign(h.engine, { mountGeneration: 1 }); }],
  ];
  for (const [name, code, change] of changes) {
    const h = await documentToolsHarness(), events: DocxEngineEvent[] = [];
    h.port.subscribe(event => { events.push(event); });
    const session = h.engine.surface!.session, readRevision = session.packageRevision;
    let reads = 0;
    // The first read belongs to the capture; the change lands right after it.
    Object.assign(session, { packageRevision: () => { const revision = readRevision(); if (++reads === 1) change(h); return revision; } });
    assert.deepEqual(h.port.selectDocumentTarget!({}), { ok: false, code }, name);
    assert.equal(h.state.navigations, 0, name);
    // The guard was released: selection is published again and native input is not held back.
    events.length = 0;
    h.emit('selectionChange');
    assert.deepEqual(events, ['focus-selection'], name);
    const input = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(input);
    assert.equal(input.defaultPrevented, false, name);
    h.port.destroy();
  }
});

test('document navigation reports a teardown during the move as destroyed', async () => {
  const h = await documentToolsHarness(), report = h.port.review!();
  assert(report.ok);
  const target = report.value.items.find(item => item.navigable)!;
  h.engine.setActiveReviewItem = (() => { h.port.destroy(); return { ok: true, changed: false }; }) as unknown as typeof h.engine.setActiveReviewItem;
  assert.deepEqual(h.port.selectReviewItem!(target.token), { ok: false, code: 'destroyed' });
});

test('document navigation reports a session or selection that an observer changed after the move', async () => {
  const changes: [name: string, code: string, change: (h: DocumentHarness) => void][] = [
    ['teardown', 'destroyed', h => h.port.destroy()],
    ['ownership loss', 'destroyed', h => { h.state.owned = false; }],
    ['selection moved', 'stale-selection', h => h.emit('selectionChange')],
  ];
  for (const [name, code, change] of changes) {
    const h = await documentToolsHarness(), report = h.port.review!();
    assert(report.ok);
    const target = report.value.items.find(item => item.navigable)!;
    let changed = false;
    h.port.subscribe(event => {
      if (event !== 'user-selection' || changed) return;
      changed = true; change(h);
    });
    assert.deepEqual(h.port.selectReviewItem!(target.token), { ok: false, code }, name);
    assert.equal(h.state.navigations, 1, 'the engine moved before the observers ran');
    h.port.destroy();
  }
});

test('document tools and review actions are unsupported when the engine exposes no surface', async () => {
  const h = await documentToolsHarness();
  Object.assign(h.engine, { surface: null });
  assert.deepEqual(h.port.selectDocumentTarget!({}), { ok: false, code: 'unsupported' });
  assert.deepEqual(await h.port.executeReview!({ type: 'track-changes', enabled: true, author: 'Editor' }, undefined, undefined, settled),
    { ok: false, code: 'unsupported' });
  const input = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(input);
  assert.equal(input.defaultPrevented, false, 'no guard was left holding native input');
  h.port.destroy();
});

test('review operations are unsupported when the engine offers no review capability', async () => {
  const h = harness(), port = await openSubscribed(h);
  assert.deepEqual(port.review!(), { ok: false, code: 'unsupported' });
  assert.deepEqual(port.selectReviewItem!({}), { ok: false, code: 'unsupported' });
  assert.deepEqual(port.canReview!({ type: 'track-changes', enabled: false, author: 'Editor' }), { enabled: false, reason: 'unsupported' });
  assert.deepEqual(await port.executeReview!(addComment, undefined, undefined, settled), { ok: false, code: 'unsupported' });
  port.destroy();
});

test('a review action without the facade settlement check is unsupported and never settles the document', async () => {
  const h = await documentToolsHarness();
  assert.deepEqual(await h.port.executeReview!(addComment, undefined, undefined), { ok: false, code: 'unsupported' });
  assert.equal(h.state.flushes, 0); assert.equal(h.state.comments, 0);
  h.port.destroy();
});

test('review actions that are not valid are refused before the document is settled', async () => {
  const h = await documentToolsHarness();
  const invalid = [{ type: 'add-comment', text: '   ', author: 'Editor' }, { type: 'add-comment', text: 'Note' },
    { type: 'track-changes', enabled: 'yes', author: 'Editor' }, { type: 'review-decision', id: 'c', decision: 'archive' }];
  for (const action of invalid) {
    assert.deepEqual(await h.port.executeReview!(action as unknown as DocxReviewAction, undefined, undefined, settled), { ok: false, code: 'invalid-option' });
  }
  assert.deepEqual(await h.port.executeReview!({ type: 'merge-comments' } as unknown as DocxReviewAction, undefined, undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(h.state.flushes, 0); assert.equal(h.state.comments, 0);
  h.port.destroy();
});

test('review actions are refused by the session state before the document is touched', async () => {
  for (const [state, code, arrange] of refusalStates) {
    const h = await documentToolsHarness(), release = await arrange(control(h)), flushes = h.state.flushes;
    assert.deepEqual(await h.port.executeReview!(addComment, undefined, undefined, settled), { ok: false, code }, state);
    assert.equal(h.state.flushes, flushes, state); assert.equal(h.state.comments, 0, state);
    await release(); h.port.destroy();
  }
  const readOnly = await documentToolsHarness(true);
  assert.deepEqual(await readOnly.port.executeReview!(addComment, undefined, undefined, settled), { ok: false, code: 'read-only' });
  assert.equal(readOnly.state.flushes, 0); assert.equal(readOnly.state.comments, 0);
  readOnly.port.destroy();
});

test('a review action stops at the first moment its owner, engine or selection stops matching', async () => {
  type Disturb = (h: DocumentHarness, pin: object) => void;
  const disturbances: [name: string, code: string, disturb: Disturb][] = [
    ['teardown', 'destroyed', h => h.port.destroy()],
    ['ownership loss', 'destroyed', h => { h.state.owned = false; }],
    ['engine failure', 'engine-failed', h => failEngine(h)],
    ['selection moved', 'stale-selection', h => h.emit('selectionChange')],
    ['retained selection released', 'stale-selection', (h, pin) => h.port.releaseSelection(pin)],
  ];
  type Phase = (h: DocumentHarness, pin: object, disturb: Disturb) => Promise<(running: unknown) => Promise<void>>;
  const phases: [name: string, arrange: Phase][] = [
    ['while pending input settles', async (h, pin, disturb) => { h.state.onFlush = () => disturb(h, pin); return async () => {}; }],
    ['while the comment feature loads', async (h, pin, disturb) => {
      const gate = deferred<void>(), entered = deferred<void>();
      h.prepareWith(async features => { assert.deepEqual([...features], ['comments']); entered.resolve(); await gate.promise; });
      return async running => {
        assert(await reached(entered.promise, running), 'the action reached its feature preparation');
        disturb(h, pin); gate.resolve();
      };
    }],
    ['while the capability is read', async (h, pin, disturb) => {
      const session = h.engine.surface!.session, parts = session.storyParts();
      let armed = true;
      Object.assign(session, { storyParts: () => { if (armed) { armed = false; disturb(h, pin); } return parts; } });
      return async () => {};
    }],
  ];
  for (const [phase, arrange] of phases) for (const [name, code, disturb] of disturbances) {
    const h = await documentToolsHarness(), pin = h.port.retainSelection();
    const proceed = await arrange(h, pin, disturb);
    const pending = h.port.executeReview!(addComment, undefined, pin, settled);
    await proceed(pending);
    assert.deepEqual(await pending, { ok: false, code }, `${name} ${phase}`);
    assert.equal(h.state.comments, 0, `${name} ${phase}`);
    h.port.destroy();
  }
});

test('a review action refuses a composition that begins while it is being captured', async () => {
  const h = await documentToolsHarness(), session = h.engine.surface!.session, readPackage = session.currentPackage;
  let armed = true;
  Object.assign(session, { currentPackage: () => {
    const pkg = readPackage();
    if (armed) { armed = false; h.child.dispatchEvent(new Event('compositionstart')); }
    return pkg;
  } });
  assert.deepEqual(await h.port.executeReview!(addComment, undefined, undefined, settled), { ok: false, code: 'composing' });
  assert.equal(h.state.comments, 0);
  h.port.destroy();
});

test('a navigation attempted from inside a running review action is refused and does not disturb it', async () => {
  const h = await documentToolsHarness(), attempts: unknown[] = [];
  const validateSettled = () => {
    attempts.push(h.port.selectDocumentTarget!({}), h.port.selectReviewItem!({}));
    return settled();
  };
  assert.deepEqual(await h.port.executeReview!(addComment, undefined, undefined, validateSettled), { ok: true, value: undefined });
  assert(attempts.length > 0, 'the settlement check ran');
  assert.deepEqual(attempts, attempts.map(() => ({ ok: false, code: 'busy' })));
  assert.equal(h.state.comments, 1, 'the action still wrote its comment');
  h.port.destroy();
});

test('review replies and decisions without a live target are refused as stale before any write', async () => {
  const h = await documentToolsHarness();
  const actions = [{ type: 'reply-comment', id: 'c', text: 'Reply', author: 'Editor' }, { type: 'review-decision', id: 'c', decision: 'resolve' }] as const;
  for (const action of actions) for (const target of [undefined, {}]) {
    assert.deepEqual(await h.port.executeReview!(action, target, undefined, settled), { ok: false, code: 'stale-revision' }, `${action.type} ${target ? 'with a forged target' : 'without a target'}`);
  }
  assert.equal(h.state.comments, 0);
  h.port.destroy();
});

test('a composition that restarts before the previous one has finished ending stays composing', async () => {
  const h = harness(), port = await openSubscribed(h), events: DocxEngineEvent[] = [];
  port.subscribe(event => { events.push(event); });
  h.child.dispatchEvent(new Event('compositionstart'));
  h.child.dispatchEvent(new Event('compositionend'));
  h.child.dispatchEvent(new Event('compositionstart'));
  await Promise.resolve();
  assert.equal(port.inspect().composing, true, 'the first ending cannot end the second composition');
  assert.deepEqual(events, ['composition', 'composition']);
  h.child.dispatchEvent(new Event('compositionend'));
  await Promise.resolve();
  assert.equal(port.inspect().composing, false);
  assert.deepEqual(events, ['composition', 'composition', 'composition']);
  port.destroy();
});

test('a composition end without a composition publishes nothing', async () => {
  const h = harness(), port = await openSubscribed(h), events: DocxEngineEvent[] = [];
  port.subscribe(event => { events.push(event); });
  h.child.dispatchEvent(new Event('compositionend'));
  await Promise.resolve();
  assert.equal(port.inspect().composing, false);
  assert.deepEqual(events, []);
  port.destroy();
});

test('review replies and decisions on a live item reach the engine with that item and report its outcome', async () => {
  type Item = EigenpalReviewReport['items'][number];
  const cases: [name: string, action: DocxReviewAction, pick: (item: Item) => boolean, method: string, extra: unknown[]][] = [
    ['reply', { type: 'reply-comment', id: 'c', text: 'Reply', author: 'Editor' }, item => item.kind === 'comment', 'replyToReviewItem', ['Reply', 'Editor']],
    ['resolve', { type: 'review-decision', id: 'c', decision: 'resolve' }, item => item.kind === 'comment', 'setCommentResolved', [true]],
    ['reopen', { type: 'review-decision', id: 'c', decision: 'reopen' }, item => item.kind === 'comment', 'setCommentResolved', [false]],
    ['delete', { type: 'review-decision', id: 'c', decision: 'delete' }, item => item.kind === 'comment', 'deleteReviewItem', []],
    ['accept', { type: 'review-decision', id: 'c', decision: 'accept' }, item => item.kind === 'insert', 'acceptReviewItem', []],
    ['reject', { type: 'review-decision', id: 'c', decision: 'reject' }, item => item.kind === 'delete', 'rejectReviewItem', []],
  ];
  for (const [name, action, pick, method, extra] of cases) for (const outcome of [true, false]) {
    const h = await documentToolsHarness(), calls: unknown[][] = [];
    Object.assign(h.engine, { [method]: (...args: unknown[]) => { calls.push(args); return { ok: outcome, changed: outcome }; } });
    const report = h.port.review!(); assert(report.ok);
    const item = report.value.items.find(pick)!;
    const result = await h.port.executeReview!(action, item.token, undefined, settled);
    assert.deepEqual(result, outcome ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' }, `${name} ${outcome ? 'accepted' : 'refused'} by the engine`);
    assert.equal(calls.length, 1, name);
    assert.equal(typeof calls[0]![0], 'string', `${name}: addressed by the item key`); assert(String(calls[0]![0]).length > 0, name);
    assert.deepEqual(calls[0]!.slice(1), extra, name);
    h.port.destroy();
  }
});

test('a review decision the item does not allow is refused before the engine is asked', async () => {
  const h = await documentToolsHarness(), calls: string[] = [];
  for (const method of ['setCommentResolved', 'deleteReviewItem', 'acceptReviewItem', 'rejectReviewItem']) {
    Object.assign(h.engine, { [method]: () => { calls.push(method); return { ok: true, changed: true }; } });
  }
  const report = h.port.review!(); assert(report.ok);
  const comment = report.value.items.find(item => item.kind === 'comment')!, insertion = report.value.items.find(item => item.kind === 'insert')!;
  assert.deepEqual(await h.port.executeReview!({ type: 'review-decision', id: 'c', decision: 'accept' }, comment.token, undefined, settled), { ok: false, code: 'unsupported' });
  assert.deepEqual(await h.port.executeReview!({ type: 'review-decision', id: 'c', decision: 'resolve' }, insertion.token, undefined, settled), { ok: false, code: 'unsupported' });
  assert.deepEqual(calls, []);
  h.port.destroy();
});

test('outline, document inspection and target selection are served once the session is ready', async () => {
  const h = await documentToolsHarness();
  assert.deepEqual(h.port.outline!(), { ok: true, value: { items: [], truncated: false } });
  const inspected = h.port.inspectDocument!(); assert(inspected.ok);
  assert.equal(inspected.value.scope, 'body'); assert.equal(inspected.value.truncated, false);
  assert.deepEqual(h.port.selectDocumentTarget!({}), { ok: false, code: 'stale-selection' }, 'a target the adapter never issued');
  assert.equal(h.state.navigations, 0);
  h.port.destroy();
});

test('focus reports an engine refusal and keeps selection notifications flowing', async () => {
  const h = harness(), port = await openSubscribed(h), events: DocxEngineEvent[] = [];
  port.subscribe(event => { events.push(event); });
  h.engine.focus = () => ({ ok: false }) as ReturnType<typeof h.engine.focus>;
  assert.throws(() => port.focus(), /Focus refused/);
  h.document.activeElement = h.child;
  h.emit('selectionChange');
  assert.equal(events.at(-1), 'user-selection', 'selection is no longer suppressed');
  port.destroy();
});

test('retaining a selection is refused and releases the pin when the session changes while the engine acquires it', async () => {
  const pin = Symbol('pin') as unknown as ReturnType<ReturnType<typeof harness>['engine']['retainSelection']>;
  type Change = (context: { h: ReturnType<typeof harness>; port: DocxEnginePort }) => void;
  const changes: [name: string, released: boolean, change: Change][] = [
    ['selection moved', true, ({ h }) => h.emit('selectionChange')],
    ['teardown', false, ({ port }) => port.destroy()],
  ];
  for (const [name, released, change] of changes) {
    const h = harness(), port = await openSubscribed(h), releases: unknown[] = [];
    h.engine.retainSelection = () => { change({ h, port }); return pin; };
    h.engine.releaseSelection = given => { releases.push(given); };
    assert.throws(() => port.retainSelection(), /Selection changed/, name);
    assert.deepEqual(releases, released ? [pin] : [], name);
    port.destroy();
  }
  const image = await imageHarness(), releases: unknown[] = [];
  image.engine.retainSelection = () => { image.f.offset++; return pin; };
  image.engine.releaseSelection = given => { releases.push(given); };
  assert.throws(() => image.port.retainSelection(), /Selection changed/, 'the selected image moved without a notification');
  assert.deepEqual(releases, [pin]);
  image.port.destroy();
});

test('retaining a selection fails when the engine holds none and works again once it does', async () => {
  const h = harness(), port = await openSubscribed(h), retain = h.engine.retainSelection;
  h.engine.retainSelection = () => null;
  assert.throws(() => port.retainSelection(), /No selection/);
  h.engine.retainSelection = retain;
  const token = port.retainSelection();
  assert.deepEqual(await port.execute('bold', token, settled), { ok: true, value: undefined });
  port.releaseSelection(token);
  port.destroy();
});

test('save is refused before touching the engine when cancelled, composing, already saving or mid-command', async () => {
  const h = harness();
  let saves = 0;
  h.saveWith(() => { saves++; return Promise.resolve(new ArrayBuffer(0)); });
  const port = await openSubscribed(h), signal = new AbortController().signal;
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(port.save(cancelled.signal), /Save unavailable/);

  h.child.dispatchEvent(new Event('compositionstart'));
  await assert.rejects(port.save(signal), /Save unavailable/);
  h.child.dispatchEvent(new Event('compositionend'));
  await Promise.resolve();

  const pending = deferred<ArrayBuffer>();
  h.saveWith(() => { saves++; return pending.promise; });
  const first = port.save(signal);
  await assert.rejects(port.save(signal), /Save unavailable/);
  assert.equal(saves, 1, 'only the first save reached the engine');
  pending.resolve(new ArrayBuffer(0)); await first;

  const gate = deferred<void>(), entered = deferred<void>();
  h.prepareWith(async () => { entered.resolve(); await gate.promise; });
  const running = port.execute('bold', undefined, settled);
  assert(await reached(entered.promise, running), 'the command reached its feature preparation');
  await assert.rejects(port.save(signal), /Save unavailable/);
  assert.equal(saves, 1);
  gate.resolve(); await running;
  assert.equal(h.child.inert, false, 'refused saves left native input as they found it');
  port.destroy();
});
