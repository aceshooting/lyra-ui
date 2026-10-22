import assert from 'node:assert/strict';
import test from 'node:test';
import { openEigenpalDocument } from './eigenpal-adapter.js';
import type { DocxEngineEvent } from './engine-port.js';
import type { DocxAction, DocxResult } from './types.js';
import {
  deferred, failEngine, harness, imageHarness, openSubscribed, reached, sessionStates, settled, tableHarness,
  type SessionControl, type StateArrangement,
} from '../../test/eigenpal-adapter-harness.js';

const insertTable = { type: 'insert-table', rows: 1, columns: 1 } as const;
const deleteImage = { type: 'delete-image' } as const;
const resizeImage = { type: 'resize-image', widthPoints: 144, heightPoints: 72 } as const;
const compose = (h: { child: EventTarget }) => { h.child.dispatchEvent(new Event('compositionstart')); };

async function commandHarness(options: { readOnly?: boolean } = {}) {
  const h = harness();
  let owned = true, flushes = 0;
  h.onFlush(() => { flushes++; });
  const port = await openSubscribed(h, { owned: () => owned, readOnly: options.readOnly });
  return { ...h, port, flushes: () => flushes, loseOwnership: () => { owned = false; } };
}
type CommandHarness = Awaited<ReturnType<typeof commandHarness>>;
const imageControl = (h: Awaited<ReturnType<typeof imageHarness>>): SessionControl => ({ ...h, loseOwnership: () => { h.f.owned = false; } });

test('image description withholds an answer while the session cannot give one', async () => {
  const none = await imageHarness();
  none.f.id = ''; none.port.inspect();
  assert.deepEqual(none.port.imageDescription!(), { ok: false, code: 'no-selection' });
  none.port.destroy();

  for (const [state, code, arrange] of sessionStates('teardown', 'composition', 'native input dispatching', 'save in flight', 'command in flight')) {
    const h = await imageHarness(), release = await arrange(imageControl(h)), reads = h.f.reads;
    assert.deepEqual(h.port.imageDescription!(), { ok: false, code }, state);
    assert.equal(h.f.reads, reads, `${state}: the layout was not read`);
    if (code === 'busy') assert.deepEqual(h.port.can(deleteImage), { enabled: false, reason: 'busy' }, `${state}: image commands are unavailable`);
    await release(); h.port.destroy();
  }
});

test('review actions are neither available nor executable as editing commands', async () => {
  const h = await commandHarness();
  const actions = [{ type: 'add-comment', text: 'Note', author: 'Editor' }, { type: 'reply-comment', id: 'c', text: 'Reply', author: 'Editor' },
    { type: 'review-decision', id: 'c', decision: 'resolve' }, { type: 'track-changes', enabled: true, author: 'Editor' }] as const;
  for (const action of actions) {
    assert.deepEqual(h.port.can(action), { enabled: false, reason: 'unsupported' }, action.type);
    assert.deepEqual(await h.port.execute(action, undefined, settled), { ok: false, code: 'unsupported' }, action.type);
  }
  assert.equal(h.executions(), 0); assert.equal(h.flushes(), 0);
  h.port.destroy();
});

test('every kind of command is refused by the session state before the engine is touched', async () => {
  const actions: DocxAction[] = ['bold', deleteImage, insertTable];
  const states = sessionStates('composition', 'ownership loss', 'teardown', 'native input dispatching', 'save in flight', 'command in flight');
  for (const [state, code, arrange] of states) for (const action of actions) {
    const h = await commandHarness(), release = await arrange(h), flushes = h.flushes();
    assert.deepEqual(await h.port.execute(action, undefined, settled), { ok: false, code }, `${typeof action === 'string' ? action : action.type} during ${state}`);
    assert.equal(h.flushes(), flushes, state); assert.equal(h.executions(), 0, state);
    await release(); h.port.destroy();
  }
  for (const action of actions) {
    const h = await commandHarness({ readOnly: true });
    assert.deepEqual(await h.port.execute(action, undefined, settled), { ok: false, code: 'read-only' }, `${typeof action === 'string' ? action : action.type} in a read-only session`);
    assert.equal(h.flushes(), 0); assert.equal(h.executions(), 0);
    h.port.destroy();
  }
});

test('a command needs the facade settlement check, a live retained selection and an engine surface', async () => {
  const h = await commandHarness();
  assert.deepEqual(await h.port.execute('bold'), { ok: false, code: 'unsupported' });
  assert.deepEqual(await h.port.execute(deleteImage), { ok: false, code: 'unsupported' });
  assert.deepEqual(await h.port.execute('bold', {}, settled), { ok: false, code: 'stale-selection' }, 'a token the adapter never issued');
  const released = h.port.retainSelection();
  h.port.releaseSelection(released);
  assert.deepEqual(await h.port.execute('bold', released, settled), { ok: false, code: 'stale-selection' }, 'a released token');
  Object.assign(h.engine, { surface: null });
  assert.deepEqual(await h.port.execute('bold', undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(h.flushes(), 0); assert.equal(h.executions(), 0);
  h.port.destroy();
});

test('a command is refused when the facade settlement check gives no verdict', async () => {
  const h = await commandHarness();
  const silent = (() => undefined) as unknown as () => DocxResult<void>;
  assert.deepEqual(await h.port.execute('bold', undefined, silent), { ok: false, code: 'unsupported' });
  assert.equal(h.executions(), 0);
  h.port.destroy();
});

test('a command is refused when the document or selection changes while pending input settles', async () => {
  type Change = (h: CommandHarness, pin: object) => void;
  const changes: [name: string, code: string, change: Change][] = [
    ['teardown', 'destroyed', h => h.port.destroy()],
    ['revision change', 'stale-revision', h => h.revise()],
    ['session replacement', 'stale-revision', h => { Object.assign(h.engine.surface!, { session: { ...h.engine.surface!.session } }); }],
    ['surface replacement', 'stale-revision', h => { Object.assign(h.engine, { surface: { ...h.engine.surface! } }); }],
    ['mount replacement', 'stale-revision', h => { Object.assign(h.engine, { mountGeneration: 1 }); }],
    ['package replacement', 'stale-revision', h => { Object.assign(h.engine.surface!.session, { currentPackage: () => ({}) }); }],
    ['selection moved', 'stale-selection', h => h.emit('selectionChange')],
    ['retained selection released', 'stale-selection', (h, pin) => h.port.releaseSelection(pin)],
  ];
  for (const [name, code, change] of changes) {
    const h = await commandHarness(), pin = h.port.retainSelection();
    let loads = 0;
    Object.assign(h.engine, { mountGeneration: 0 });
    h.prepareWith(async () => { loads++; });
    h.onFlush(() => change(h, pin));
    assert.deepEqual(await h.port.execute('bold', pin, settled), { ok: false, code }, name);
    assert.equal(loads, 0, `${name}: no engine feature was loaded for a stale command`);
    assert.equal(h.executions(), 0, name);
    h.port.destroy();
  }
});

test('a command is refused when the session changes while its engine features load', async () => {
  type Change = (h: CommandHarness, pin: object) => void;
  const changes: [name: string, code: string, change: Change][] = [
    ['teardown', 'destroyed', h => h.port.destroy()],
    ['engine failure', 'engine-failed', h => failEngine(h)],
    ['ownership loss', 'destroyed', h => h.loseOwnership()],
    ['revision change', 'stale-revision', h => h.revise()],
    ['selection moved', 'stale-selection', h => h.emit('selectionChange')],
    ['retained selection released', 'stale-selection', (h, pin) => h.port.releaseSelection(pin)],
  ];
  for (const [name, code, change] of changes) {
    const h = await commandHarness(), pin = h.port.retainSelection(), gate = deferred<void>(), entered = deferred<void>();
    h.prepareWith(async () => { entered.resolve(); await gate.promise; });
    const running = h.port.execute('bold', pin, settled);
    assert(await reached(entered.promise, running), `${name}: the command reached its feature preparation`);
    change(h, pin);
    gate.resolve();
    assert.deepEqual(await running, { ok: false, code }, name);
    assert.equal(h.executions(), 0, name);
    h.port.destroy();
  }
});

test('a command refuses a composition that begins while it is being captured', async () => {
  const h = await commandHarness(), session = h.engine.surface!.session, readRevision = session.packageRevision;
  let armed = true;
  Object.assign(session, { packageRevision: () => {
    const revision = readRevision();
    if (armed) { armed = false; compose(h); }
    return revision;
  } });
  assert.deepEqual(await h.port.execute('bold', undefined, settled), { ok: false, code: 'composing' });
  assert.equal(h.executions(), 0);
  h.port.destroy();
});

test('an image command needs a selected image that the adapter still holds', async () => {
  const none = await imageHarness();
  none.f.id = ''; none.port.inspect();
  assert.deepEqual(await none.port.execute(deleteImage, undefined, settled), { ok: false, code: 'no-selection' });
  none.port.destroy();

  const lostSurface = await imageHarness();
  Object.assign(lostSurface.engine, { surface: null });
  assert.deepEqual(await lostSurface.port.execute(deleteImage, undefined, settled), { ok: false, code: 'stale-selection' });
  assert.equal(lostSurface.f.flushes, 0);
  lostSurface.port.destroy();

  const forgotten = await imageHarness(), pin = forgotten.port.retainSelection(), snapshot = forgotten.engine.snapshot;
  forgotten.engine.snapshot = () => ({ ...snapshot(), image: null }) as ReturnType<typeof snapshot>;
  forgotten.port.inspect();
  assert.deepEqual(await forgotten.port.execute(deleteImage, pin, settled), { ok: false, code: 'no-selection' });
  assert.equal(forgotten.f.dispatches, 0); assert.equal(forgotten.f.flushes, 0);
  forgotten.port.destroy();
});

test('a loading image that cannot be identified, held or owned never starts a resource refresh', async context => {
  const cases: [name: string, arrange: (h: Awaited<ReturnType<typeof imageHarness>>) => void][] = [
    ['an image the adapter cannot identify', h => { h.image.widthEmu = 0; }],
    ['an engine without a document surface', h => { Object.assign(h.engine, { surface: null }); }],
    ['a session that lost its mount', h => { h.f.owned = false; }],
    ['a loading image owned by the session', () => {}],
  ];
  for (const [name, arrange] of cases) {
    const h = await imageHarness(), timers = context.mock.method(globalThis, 'setTimeout');
    h.image.resourceStatus = 'pending'; arrange(h);
    assert.doesNotThrow(() => h.port.inspect(), name);
    const scheduled = timers.mock.calls.filter(call => call.arguments[1] === 16).length;
    assert.equal(scheduled, name === 'a loading image owned by the session' ? 1 : 0, name);
    h.port.destroy(); timers.mock.restore();
  }
});

test('image commands report why the selected image cannot be edited', async () => {
  const none = await imageHarness();
  none.f.id = ''; none.port.inspect();
  assert.deepEqual(none.port.can(deleteImage), { enabled: false, reason: 'no-selection' });
  none.port.destroy();
  for (const [name, code, arrange] of [
    ['metadata over its limit', 'resource-limit', (h: Awaited<ReturnType<typeof imageHarness>>) => { h.image.title = 'T'.repeat(300); }],
    ['hidden image', 'unsupported', (h: Awaited<ReturnType<typeof imageHarness>>) => { h.image.hidden = true; }],
  ] as const) {
    const h = await imageHarness();
    arrange(h); h.port.inspect();
    assert.deepEqual(h.port.can(deleteImage), { enabled: false, reason: code }, name);
    assert.deepEqual(await h.port.execute(resizeImage, undefined, settled), { ok: false, code }, name);
    assert.equal(h.f.flushes, 0, `${name}: nothing was settled for a refused command`); assert.equal(h.f.dispatches, 0, name);
    h.port.destroy();
  }
});

test('an image whose description stops being readable while input settles is refused with that reason', async () => {
  const h = await imageHarness();
  h.f.onFlush = () => { h.image.title = 'T'.repeat(300); };
  assert.deepEqual(await h.port.execute(resizeImage, undefined, settled), { ok: false, code: 'resource-limit' });
  assert.equal(h.f.flushes, 1); assert.equal(h.f.calls, 0, 'the engine was never asked about the command'); assert.equal(h.f.dispatches, 0);
  h.port.destroy();
});

test('table availability is derived from the last inspected context', async () => {
  const h = await tableHarness();
  assert.deepEqual(h.port.can(insertTable), { enabled: true }, 'before any inspection nothing says the caret is in a table');
  h.port.inspect();
  assert.deepEqual(h.port.can(insertTable), { enabled: true });
  assert.deepEqual(h.port.can({ type: 'delete-table' }), { enabled: false, reason: 'unsupported' });
  h.port.destroy();
});

test('table commands stop at an unqualified table, an engine that cannot take them and a released selection', async () => {
  const outside = await tableHarness();
  assert.deepEqual(await outside.port.execute({ type: 'delete-table' }, undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(outside.executions(), 0);
  outside.port.destroy();

  const incapable = await tableHarness(), asked: string[] = [];
  incapable.engine.can = ((command: { type: string }) => { asked.push(command.type); return { ok: false }; }) as unknown as typeof incapable.engine.can;
  assert.deepEqual(await incapable.port.execute(insertTable, undefined, settled), { ok: false, code: 'unsupported' });
  assert.deepEqual(asked, ['insertTable']); assert.equal(incapable.executions(), 0);
  incapable.port.destroy();

  const released = await tableHarness(), pin = released.port.retainSelection();
  released.prepareWith(async () => { released.port.releaseSelection(pin); });
  assert.deepEqual(await released.port.execute(insertTable, pin, settled), { ok: false, code: 'stale-selection' });
  assert.equal(released.executions(), 0);
  released.port.destroy();
});

test('an image command is refused when the session changes while its engine features load', async () => {
  type Change = (h: Awaited<ReturnType<typeof imageHarness>>) => void;
  const changes: [name: string, code: string, change: Change][] = [
    ['ownership loss', 'destroyed', h => { h.f.owned = false; }],
    ['engine failure', 'engine-failed', h => failEngine(h)],
    ['selection moved', 'stale-selection', h => h.emit('selectionChange')],
  ];
  for (const [name, code, change] of changes) {
    const h = await imageHarness(), gate = deferred<void>(), entered = deferred<void>();
    h.prepareWith(async features => { assert.deepEqual([...features], ['drawings']); entered.resolve(); await gate.promise; });
    const running = h.port.execute(resizeImage, undefined, settled);
    assert(await reached(entered.promise, running), `${name}: the command reached its feature preparation`);
    const packages = h.f.packages;
    change(h);
    gate.resolve();
    assert.deepEqual(await running, { ok: false, code }, name);
    assert.equal(h.f.packages, packages, `${name}: the document was not read for a stale command`);
    assert.equal(h.f.dispatches, 0, name); assert.equal(h.f.calls, 0, name);
    h.port.destroy();
  }
});

test('an image command is refused when the selection changes while the command is being qualified', async () => {
  const h = await imageHarness();
  let armed = true;
  h.f.onPackage = () => { if (armed) { armed = false; h.emit('selectionChange'); } };
  assert.deepEqual(await h.port.execute(resizeImage, undefined, settled), { ok: false, code: 'stale-selection' });
  assert.equal(h.f.calls, 0, 'the engine was never asked about the command'); assert.equal(h.f.dispatches, 0);
  h.port.destroy();
});

test('an image command the engine will not take is reported as unsupported', async () => {
  const incapable = await imageHarness();
  incapable.engine.can = (() => ({ ok: false })) as unknown as typeof incapable.engine.can;
  assert.deepEqual(await incapable.port.execute(resizeImage, undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(incapable.f.dispatches, 0);
  incapable.port.destroy();

  const refusing = await imageHarness(), events: DocxEngineEvent[] = [];
  let attempts = 0;
  refusing.engine.exec = (() => { attempts++; return { ok: false }; }) as unknown as typeof refusing.engine.exec;
  refusing.port.subscribe(event => { events.push(event); });
  assert.deepEqual(await refusing.port.execute(resizeImage, undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(attempts, 1); assert.equal(events.at(-1), 'state', 'the refused attempt is followed by a state refresh');
  refusing.port.destroy();
});

test('a table command stops when the engine exposes no surface or refuses the command', async () => {
  const lostSurface = await tableHarness();
  Object.assign(lostSurface.engine, { surface: null });
  assert.deepEqual(await lostSurface.port.execute(insertTable, undefined, settled), { ok: false, code: 'unsupported' });
  const input = new Event('beforeinput', { cancelable: true }); lostSurface.child.dispatchEvent(input);
  assert.equal(input.defaultPrevented, false, 'the refused command left native input unblocked');
  lostSurface.port.destroy();

  const refusing = await tableHarness();
  let attempts = 0;
  refusing.engine.exec = (() => { attempts++; return { ok: false }; }) as unknown as typeof refusing.engine.exec;
  assert.deepEqual(await refusing.port.execute(insertTable, undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(attempts, 1);
  refusing.port.destroy();
});

test('table labels are not pushed to the engine while the session is busy, orphaned or torn down', async () => {
  const states = sessionStates('teardown', 'ownership loss', 'native input dispatching', 'save in flight', 'command in flight');
  const labels = { insertRowBelow: 'Below', insertColumnRight: 'Right' };
  for (const [state, , arrange] of states) {
    const h = await commandHarness(), pushed: unknown[] = [];
    h.engine.setTableInteractionLabel = resolver => { pushed.push(resolver); };
    const release = await arrange(h);
    assert.equal(h.port.refreshTableLabels!(labels), false, state);
    assert.deepEqual(pushed, [], `${state}: the engine was not touched`);
    await release(); h.port.destroy();
  }
  const idle = await commandHarness(), pushed: unknown[] = [];
  idle.engine.setTableInteractionLabel = resolver => { pushed.push(resolver); };
  assert.equal(idle.port.refreshTableLabels!(labels), true);
  assert.equal(pushed.length, 1);
  idle.port.destroy();
});

test('page zoom is forwarded to the engine for a live session and refused otherwise', async () => {
  const h = await commandHarness(), calls: unknown[] = [];
  h.engine.setZoom = ((zoom: number) => { calls.push(['zoom', zoom]); return { ok: zoom !== 3 }; }) as unknown as typeof h.engine.setZoom;
  h.engine.setZoomMode = ((mode: unknown) => { calls.push(['mode', mode]); return { ok: true }; }) as unknown as typeof h.engine.setZoomMode;
  assert.equal(h.port.setZoom!(1.5), true);
  assert.equal(h.port.setZoom!(3), false, 'the engine refused this zoom');
  assert.equal(h.port.setZoom!('fit'), true);
  assert.deepEqual(calls, [['zoom', 1.5], ['zoom', 3], ['mode', { type: 'fit', fit: 'pageWidth', minZoom: 0.25, maxZoom: 1 }]]);
  h.loseOwnership();
  assert.equal(h.port.setZoom!(1), false); assert.equal(h.port.setZoom!('fit'), false);
  assert.equal(calls.length, 3, 'an orphaned session does not touch the engine');
  const torn = await commandHarness();
  torn.engine.setZoom = (() => { throw new Error('torn down sessions never reach the engine'); }) as unknown as typeof torn.engine.setZoom;
  torn.port.destroy();
  assert.equal(torn.port.setZoom!(1), false);
  h.port.destroy();
});

test('charts are read once per package revision and withheld from an orphaned or torn down session', async () => {
  const store = await import('@docx-editor.dev/core/store'), { chartFixture } = await import('../../test/corpus.js');
  const parsed = store.readOoxmlPackage(chartFixture()); assert(parsed.ok);
  const open = async () => {
    const h = await commandHarness(), counts = { reads: 0 };
    Object.assign(h.engine.surface!.session, { currentPackage: () => { counts.reads++; return parsed.package; } });
    return { h, counts };
  };
  const { h, counts } = await open();
  const first = h.port.charts!();
  assert.deepEqual(first.map(placement => placement.model.title), ['Quarterly column']);
  assert.equal(h.port.charts!(), first, 'the same revision answers from the cache'); assert.equal(counts.reads, 1);
  h.revise();
  const second = h.port.charts!();
  assert.notEqual(second, first, 'a new revision is read again'); assert.equal(counts.reads, 2);
  assert.deepEqual(second.map(placement => placement.model.title), ['Quarterly column']);
  h.port.destroy();
  assert.deepEqual(h.port.charts!(), [], 'a torn down session offers none');

  const orphaned = await open();
  orphaned.h.loseOwnership();
  assert.deepEqual(orphaned.h.port.charts!(), [], 'an orphaned session offers none'); assert.equal(orphaned.counts.reads, 0);
  orphaned.h.port.destroy();

  const detached = await open();
  Object.assign(detached.h.engine, { surface: null });
  assert.deepEqual(detached.h.port.charts!(), [], 'no surface, no charts'); assert.equal(detached.counts.reads, 0);
  detached.h.port.destroy();
});

test('the painted node of the selected image is offered only while the session can honour it', async () => {
  class PaintedNode {
    constructor(readonly drawing: string | null) {}
    getAttribute(name: string) { return name === 'data-drawing-node-id' ? this.drawing : null; }
  }
  const declared = Object.getOwnPropertyDescriptor(globalThis, 'HTMLElement');
  Object.defineProperty(globalThis, 'HTMLElement', { value: PaintedNode, configurable: true, writable: true });
  try {
    const open = async () => {
      const h = await imageHarness();
      const wanted = new PaintedNode(h.image.id), nodes = [new PaintedNode('another'), wanted, new PaintedNode(h.image.id)];
      Object.assign(h.child, { querySelectorAll: () => nodes });
      return { h, wanted, nodes, control: imageControl(h) };
    };
    const live = await open();
    assert.equal(live.h.port.selectedImageElement!(), live.wanted, 'the first painted node of the selected drawing');
    live.nodes.splice(1, 2);
    assert.equal(live.h.port.selectedImageElement!(), null, 'no painted node for this drawing');
    live.nodes.push({ getAttribute: () => live.h.image.id } as unknown as PaintedNode);
    assert.equal(live.h.port.selectedImageElement!(), null, 'a node that is not an HTML element is never handed out');
    live.h.port.destroy();

    const pending = await open();
    pending.h.image.resourceStatus = 'pending'; pending.h.port.inspect();
    assert.equal(pending.h.port.selectedImageElement!(), null, 'an image that is still loading has no chrome');
    pending.h.port.destroy();

    for (const [state, , arrange] of sessionStates('teardown', 'ownership loss', 'save in flight', 'command in flight')) {
      const s = await open(), release = await arrange(s.control);
      assert.equal(s.h.port.selectedImageElement!(), null, state);
      await release(); s.h.port.destroy();
    }
  } finally {
    if (declared) Object.defineProperty(globalThis, 'HTMLElement', declared); else Reflect.deleteProperty(globalThis, 'HTMLElement');
  }
});

/** A one-cell table, so actions on an existing table can be qualified against its real topology. */
async function gridHarness() {
  const h = harness(), word = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const make = (id: string, localName: string, children: unknown[] = []) => ({ id, kind: 'generic', localName,
    namespaceUri: word, attributes: [], namespaceBindings: [], children });
  const paragraph = make('p', 'p'), cell = make('c', 'tc', [make('cp', 'tcPr'), paragraph]), row = make('r', 'tr', [cell]);
  const table = make('t', 'tbl', [make('tp', 'tblPr'), make('g', 'tblGrid', [make('gc', 'gridCol')]), row]);
  const body = make('b', 'body', [table]), root = make('d', 'document', [body]);
  const parents = new Map<string, unknown>([['p', cell], ['c', row], ['r', table], ['t', body], ['b', root]]);
  const part = { root }, pkg = { mainDocumentPart: 'body', parts: new Map([['body', part]]) };
  const plans: unknown[] = [];
  let planOutcome = true;
  Object.assign(h.engine, { mountGeneration: 0, surface: { session: { packageRevision: () => 0, part: () => part, currentPackage: () => pkg },
    storyScope: () => ({ kind: 'body' }), flushPendingInput() {},
    state: () => ({ selection: { anchor: { paragraphId: 'p', offset: 0 }, head: { paragraphId: 'p', offset: 0 } }, cellSelection: null }),
    applyTableCommandPlan: (plan: unknown) => { plans.push(plan); return { ok: planOutcome }; } } });
  const module = { ...await h.loader(), tableReaders: { findNode: () => paragraph, parentNodeOf: (_part: unknown, id: string) => parents.get(id) ?? null } };
  const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
    { readOnly: false, signal: new AbortController().signal }, () => true, async () => module as never);
  assert(opened.ok);
  opened.value.subscribe(() => {});
  return { ...h, port: opened.value, plans, refusePlans: () => { planOutcome = false; } };
}

test('a table formatting action that changes nothing succeeds without loading features or touching the document', async () => {
  const h = await gridHarness();
  let loads = 0;
  h.prepareWith(async () => { loads++; });
  assert.deepEqual(await h.port.execute({ type: 'table-header-row', enabled: false }, undefined, settled), { ok: true, value: undefined });
  assert.equal(loads, 0); assert.deepEqual(h.plans, []); assert.equal(h.executions(), 0);
  h.port.destroy();
});

test('a table formatting action that needs a document-level plan applies that plan once and nothing else', async () => {
  const h = await gridHarness(), events: DocxEngineEvent[] = [];
  h.port.subscribe(event => { events.push(event); });
  let capabilityChecks = 0;
  h.engine.can = (() => { capabilityChecks++; return { ok: true }; }) as unknown as typeof h.engine.can;
  assert.deepEqual(await h.port.execute({ type: 'table-header-row', enabled: true }, undefined, settled), { ok: true, value: undefined });
  assert.deepEqual(h.plans, [{ ok: true, ops: [{ op: 'setTableProperties', tableId: 't', headerRowCount: 1 }], selection: { kind: 'preserveSelection' } }]);
  assert.equal(capabilityChecks, 0, 'a plan is applied by the document surface, not by an engine command'); assert.equal(h.executions(), 0);
  assert.equal(events.at(-1), 'state', 'the applied plan is followed by a state refresh');
  h.refusePlans();
  assert.deepEqual(await h.port.execute({ type: 'table-header-row', enabled: true }, undefined, settled), { ok: false, code: 'unsupported' });
  assert.equal(h.plans.length, 2);
  h.port.destroy();
});

test('image navigation is refused by the session state before the document is discovered', async () => {
  const settling: StateArrangement = async h => {
    h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
    return async () => {};
  };
  const states = [...sessionStates('teardown', 'ownership loss', 'engine failure', 'composition', 'native input dispatching', 'save in flight', 'command in flight'),
    ['native input settling', 'busy', settling] as const];
  for (const [state, code, arrange] of states) {
    const h = await imageHarness(), release = await arrange(imageControl(h)), packages = h.f.packages, flushes = h.f.flushes;
    assert.deepEqual(h.port.selectImage!('next'), { ok: false, code }, state);
    assert.equal(h.f.packages, packages, `${state}: the document was not read`); assert.equal(h.f.flushes, flushes, state);
    assert.equal(h.focusCalls(), 0, state);
    await release(); h.port.destroy();
  }
  const lostSurface = await imageHarness();
  Object.assign(lostSurface.engine, { surface: null });
  assert.deepEqual(lostSurface.port.selectImage!('next'), { ok: false, code: 'unsupported' });
  assert.equal(lostSurface.f.flushes, 0);
  lostSurface.port.destroy();
});

test('image navigation refuses an engine failure or composition that appears while it captures the selection', async () => {
  const changes: [name: string, code: string, change: (h: Awaited<ReturnType<typeof imageHarness>>) => void][] = [
    ['engine failure', 'engine-failed', h => failEngine(h)],
    ['composition', 'composing', h => compose(h)],
  ];
  for (const [name, code, change] of changes) {
    const h = await imageHarness();
    let selections = 0, armed = true;
    const readScope = h.engine.surface!.storyScope;
    h.engine.surface!.selectDrawing = () => { selections++; return true; };
    h.engine.surface!.storyScope = () => {
      if (armed) { armed = false; change(h); }
      return readScope();
    };
    assert.deepEqual(h.port.selectImage!('next'), { ok: false, code }, name);
    assert.equal(selections, 0, name); assert.equal(h.focusCalls(), 0, name);
    const input = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(input);
    assert.equal(input.defaultPrevented, false, `${name}: native input is not held back`);
    h.port.destroy();
  }
});

test('image navigation names a teardown or ownership loss that happens during discovery', async () => {
  const losses: [name: string, lose: (h: Awaited<ReturnType<typeof imageHarness>>) => void][] = [
    ['teardown', h => h.port.destroy()],
    ['ownership loss', h => { h.f.owned = false; }],
  ];
  for (const [name, lose] of losses) {
    const h = await imageHarness();
    let selections = 0, armed = true;
    h.engine.surface!.selectDrawing = () => { selections++; return true; };
    h.f.onPackage = () => { if (armed) { armed = false; lose(h); } };
    assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'destroyed' }, name);
    assert.equal(selections, 0, name); assert.equal(h.focusCalls(), 0, name);
    h.port.destroy();
  }
});

test('image navigation from no selection picks the first image going forward and the last going back', async () => {
  for (const [direction, pick] of [['next', 0], ['previous', -1]] as const) {
    const h = await imageHarness(), chosen: string[] = [];
    h.f.id = ''; h.port.inspect();
    h.engine.surface!.selectDrawing = id => { chosen.push(id); return false; };
    assert.deepEqual(h.port.selectImage!(direction), { ok: false, code: 'unsupported' }, direction);
    const drawings = h.nodes.filter(node => node.localName === 'drawing');
    assert.deepEqual(chosen, [drawings.at(pick)!.id], direction);
    h.port.destroy();
  }
});

test('image navigation reports a document it cannot discover images in without selecting anything', async () => {
  const h = await imageHarness();
  let selections = 0;
  h.engine.surface!.selectDrawing = () => { selections++; return true; };
  const part = h.engine.surface!.session.part();
  Object.assign(h.engine.surface!.session, { part: () => ({ ...part }) });
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'unsupported' });
  assert.equal(selections, 0); assert.equal(h.focusCalls(), 0);
  const input = new Event('beforeinput', { cancelable: true }); h.child.dispatchEvent(input);
  assert.equal(input.defaultPrevented, false, 'the refused navigation left native input unblocked');
  h.port.destroy();
});

test('image navigation refuses a caret that moved silently while the layout was read', async () => {
  const h = await imageHarness(), events: DocxEngineEvent[] = [];
  let selections = 0;
  h.engine.surface!.selectDrawing = () => { selections++; return true; };
  h.f.onLayout = () => { h.f.offset++; };
  h.port.subscribe(event => { events.push(event); });
  assert.deepEqual(h.port.selectImage!('next'), { ok: false, code: 'stale-selection' });
  assert.equal(selections, 0); assert.equal(h.focusCalls(), 0); assert.deepEqual(events, []);
  h.port.destroy();
});

test('a failed native image selection reports ownership loss or engine failure ahead of a plain refusal', async () => {
  type Arrange = (h: Awaited<ReturnType<typeof imageHarness>>) => void;
  const cases: [name: string, code: string, arrange: Arrange][] = [
    ['ownership lost during the attempt', 'destroyed', h => {
      h.engine.surface!.selectDrawing = () => { h.f.owned = false; return false; };
    }],
    ['ownership lost while the selection is read back', 'destroyed', h => {
      const readState = h.engine.surface!.state;
      let attempted = false;
      h.engine.surface!.selectDrawing = () => { attempted = true; return false; };
      h.engine.surface!.state = () => {
        const value = readState();
        if (attempted) h.f.owned = false;
        return value;
      };
    }],
    ['engine failure during the attempt', 'engine-failed', h => {
      h.engine.surface!.selectDrawing = () => { failEngine(h); return false; };
    }],
    ['teardown during the attempt', 'destroyed', h => {
      h.engine.surface!.selectDrawing = () => { h.port.destroy(); return false; };
    }],
    ['teardown while the selection is read back', 'destroyed', h => {
      const readState = h.engine.surface!.state;
      let attempted = false;
      h.engine.surface!.selectDrawing = () => { attempted = true; return false; };
      h.engine.surface!.state = () => {
        const value = readState();
        if (attempted) h.port.destroy();
        return value;
      };
    }],
  ];
  for (const [name, code, arrange] of cases) {
    const h = await imageHarness(), events: DocxEngineEvent[] = [];
    arrange(h);
    h.port.subscribe(event => { events.push(event); });
    assert.deepEqual(h.port.selectImage!('next'), { ok: false, code }, name);
    assert.equal(h.focusCalls(), 0, name);
    assert.equal(events.includes('user-selection'), false, `${name}: no selection was published`);
    h.port.destroy();
  }
  const orphaned = await imageHarness(), readState = orphaned.engine.surface!.state;
  let reads = 0, readsAtAttempt = -1;
  orphaned.engine.surface!.state = () => { reads++; return readState(); };
  orphaned.engine.surface!.selectDrawing = () => { readsAtAttempt = reads; orphaned.f.owned = false; return false; };
  assert.deepEqual(orphaned.port.selectImage!('next'), { ok: false, code: 'destroyed' });
  assert(readsAtAttempt >= 0, 'the native selection was attempted');
  assert.equal(reads, readsAtAttempt, 'an orphaned session does not read the selection back');
  orphaned.port.destroy();
});
