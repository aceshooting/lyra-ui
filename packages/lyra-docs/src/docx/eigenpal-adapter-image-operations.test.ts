import assert from 'node:assert/strict';
import test from 'node:test';
import type { DocxEngineImageInsertion, DocxEnginePort } from './engine-port.js';
import type { DocxResult } from './types.js';
import {
  failEngine, harness, insertionHarness, replacementHarness, sessionStates,
  type MutableEngineModule, type SessionControl,
} from '../../test/eigenpal-adapter-harness.js';

type Request = Parameters<DocxEngineImageInsertion['execute']>[1];
type Base = ReturnType<typeof harness> & { port: DocxEnginePort; module: MutableEngineModule };
interface Handle {
  validate(retainedSelection?: object): DocxResult<void>;
  release(): void;
  run(request: Request): Promise<DocxResult<void>>;
}

/** One image operation (insertion or replacement) behind the same surface, so both run the same guard matrix. */
interface Subject {
  readonly label: string;
  readonly h: Base;
  /** The refusal for an engine that exposes no surface. */
  readonly noSurface: string;
  readonly counts: { flushes(): number; decodes(): number; dispatches(): number; armed(): number; reads(): number; acquisitions(): number };
  begin(): DocxResult<Handle>;
  /** Replaces the engine's answer to the committing call. */
  answer(result: (() => Promise<unknown>) | unknown): void;
  setOwned(owned: boolean): void;
  duringFlush(callback: () => void): void;
  request(overrides?: Partial<Request>): Request;
}

/** Counts selection reads and decoder acquisitions, the work an early refusal must not start. */
function countEngineWork(h: Base) {
  const surface = h.engine.surface!, readState = surface.state, acquire = surface.imageDecodePort;
  const work = { reads: 0, acquisitions: 0 };
  surface.state = () => { work.reads++; return readState(); };
  surface.imageDecodePort = () => { work.acquisitions++; return acquire(); };
  return { reads: () => work.reads, acquisitions: () => work.acquisitions };
}

async function insertionSubject(): Promise<Subject> {
  const h = await insertionHarness(), work = countEngineWork(h);
  return { label: 'insertion', h, noSurface: 'unsupported',
    counts: { flushes: () => h.f.flushes, decodes: () => h.f.decodes, dispatches: () => h.f.dispatches, armed: () => h.f.armed, ...work },
    begin: () => {
      const handle = h.port.beginImageInsertion!();
      return handle.ok ? { ok: true, value: { validate: retained => handle.value.validate(retained), release: () => handle.value.release(),
        run: request => handle.value.execute(h.source, request) } } : handle;
    },
    answer: result => { h.engine.surface!.insertImage = (typeof result === 'function' ? result : async () => result) as unknown as NonNullable<typeof h.engine.surface>['insertImage']; },
    setOwned: owned => { h.f.owned = owned; }, duringFlush: callback => { h.f.onFlush = callback; },
    request: (overrides = {}) => ({ ...h.operation(), ...overrides }) };
}

async function replacementSubject(): Promise<Subject> {
  const h = await replacementHarness(), work = countEngineWork(h);
  return { label: 'replacement', h, noSurface: 'stale-selection',
    counts: { flushes: () => h.f.flushes, decodes: () => h.counts.decodes, dispatches: () => h.counts.dispatches, armed: () => h.counts.armed, ...work },
    begin: () => {
      const handle = h.port.beginImageReplacement!();
      return handle.ok ? { ok: true, value: { validate: retained => handle.value.validate(retained), release: () => handle.value.release(),
        run: request => handle.value.execute(h.source, request) } } : handle;
    },
    answer: result => { h.engine.surface!.replaceImage = (typeof result === 'function' ? result : async () => result) as unknown as NonNullable<typeof h.engine.surface>['replaceImage']; },
    setOwned: owned => { h.f.owned = owned; }, duringFlush: callback => { h.f.onFlush = callback; },
    request: (overrides = {}) => ({ ...h.operation(), ...overrides }) };
}

const subjects: [string, () => Promise<Subject>][] = [['insertion', insertionSubject], ['replacement', replacementSubject]];
const control = (s: Subject): SessionControl => ({ ...s.h, loseOwnership: () => s.setOwned(false) });
const pointer = (h: Base) => {
  const input = new Event('pointerdown', { cancelable: true });
  h.child.dispatchEvent(input);
  return input.defaultPrevented;
};

function begun(subject: Subject): Handle {
  const handle = subject.begin();
  assert(handle.ok, `${subject.label} handle`);
  return handle.value;
}

test('an image operation is refused by the session state before it takes the input barrier', async () => {
  type Arrange = (s: Subject) => Promise<() => Promise<unknown>>;
  const idle = async () => {};
  // `checksBarrier` is false where the arranged state itself legitimately holds or detaches native input.
  const states: [name: string, code: (s: Subject) => string, checksBarrier: boolean, arrange: Arrange][] = [
    ...sessionStates('teardown', 'ownership loss', 'engine failure', 'composition', 'native input dispatching', 'save in flight', 'command in flight')
      .map(([name, code, arrange]): [string, (s: Subject) => string, boolean, Arrange] =>
        [name, () => code, !['teardown', 'save in flight', 'command in flight'].includes(name), s => arrange(control(s))]),
    ['another operation holds the barrier', () => 'busy', false, async s => {
      const first = begun(s);
      return async () => first.release();
    }],
    ['capability withdrawn', () => 'unsupported', true, async s => { delete s.h.module.imageInsertion; return idle; }],
    ['missing surface', s => s.noSurface, true, async s => { Object.assign(s.h.engine, { surface: null }); return idle; }],
  ];
  for (const [label, open] of subjects) for (const [state, code, checksBarrier, arrange] of states) {
    const s = await open(), release = await arrange(s), flushes = s.counts.flushes(), reads = s.counts.reads();
    assert.deepEqual(s.begin(), { ok: false, code: code(s) }, `${label} during ${state}`);
    assert.equal(s.counts.flushes(), flushes, `${label} during ${state}`);
    assert.equal(s.counts.reads(), reads, `${label} during ${state}: the selection was not read`);
    assert.equal(s.counts.decodes(), 0, `${label} during ${state}`);
    if (checksBarrier) assert.equal(pointer(s.h), false, `${label} during ${state}: the refusal left native input unblocked`);
    await release(); s.h.port.destroy();
  }
});

test('an insertion in a read-only session is refused without taking the input barrier', async () => {
  const h = await insertionHarness(true);
  assert.deepEqual(h.port.beginImageInsertion!(), { ok: false, code: 'read-only' });
  assert.equal(pointer(h), false); assert.equal(h.f.flushes, 0);
  h.port.destroy();
});

test('an insertion capture that throws names the lost owner over a generic engine failure', async () => {
  const losses: [string, (h: Awaited<ReturnType<typeof insertionHarness>>) => void][] = [
    ['ownership loss', h => { h.f.owned = false; }],
    ['teardown', h => h.port.destroy()],
  ];
  for (const [name, lose] of losses) {
    const h = await insertionHarness();
    h.f.onState = () => { lose(h); throw new Error('state unavailable'); };
    assert.deepEqual(h.port.beginImageInsertion!(), { ok: false, code: 'destroyed' }, name);
    h.f.onState = () => {};
    if (name === 'ownership loss') assert.equal(pointer(h), false, `${name}: the barrier was released`);
    h.port.destroy();
  }
});

test('a replacement capture refuses an image it cannot describe, edit or still hold', async () => {
  const cases: [name: string, code: string, arrange: (h: Awaited<ReturnType<typeof replacementHarness>>) => void][] = [
    ['metadata over its limit', 'resource-limit', h => { h.image.title = 'T'.repeat(300); h.port.inspect(); }],
    ['hidden image', 'unsupported', h => { h.image.hidden = true; h.port.inspect(); }],
    ['image still loading', 'unsupported', h => { h.image.resourceStatus = 'pending'; h.port.inspect(); }],
    ['capability withdrawn', 'unsupported', h => { delete h.module.imageInsertion; }],
    ['selection on another image since the last inspection', 'stale-selection', h => { h.f.id = 'another-drawing'; }],
    ['surface lost', 'stale-selection', h => { Object.assign(h.engine, { surface: null }); }],
  ];
  for (const [name, code, arrange] of cases) {
    const h = await replacementHarness();
    arrange(h);
    assert.deepEqual(h.port.beginImageReplacement!(), { ok: false, code }, name);
    assert.equal(pointer(h), false, `${name}: no barrier was taken`);
    h.port.destroy();
  }
});

test('a replacement capture that fails its own validation releases the barrier and names the failure', async () => {
  // A capture reads the package once to snapshot it and last to validate that snapshot; count them on an untouched twin.
  const twin = await replacementHarness(), twinSession = twin.engine.surface!.session, twinRead = twinSession.currentPackage;
  let captureReads = 0;
  Object.assign(twinSession, { currentPackage: () => { captureReads++; return twinRead(); } });
  const probe = twin.port.beginImageReplacement!(); assert(probe.ok);
  probe.value.release(); twin.port.destroy();
  assert(captureReads >= 2, 'the capture validates against a later package read');

  const h = await replacementHarness(), session = h.engine.surface!.session, readPackage = session.currentPackage;
  let reads = 0;
  // The document is replaced right under the validation read.
  Object.assign(session, { currentPackage: () => ++reads === captureReads ? { ...readPackage() } : readPackage() });
  assert.deepEqual(h.port.beginImageReplacement!(), { ok: false, code: 'stale-revision' });
  assert.equal(pointer(h), false);
  assert(h.port.beginImageReplacement!().ok, 'the editor is not left busy');
  h.port.destroy();
});

test('an insertion capture refuses an owner or selection that changes while the caret is being verified', async () => {
  const changes: [name: string, code: string, change: (h: Awaited<ReturnType<typeof insertionHarness>>) => void][] = [
    ['ownership loss', 'destroyed', h => { h.f.owned = false; }],
    ['selection moved', 'stale-selection', h => h.emit('selectionChange')],
  ];
  for (const [name, code, change] of changes) {
    const h = await insertionHarness();
    let reads = 0;
    // The capture reads the caret once to remember it and once more to verify it; the change lands in between.
    h.f.onState = () => { if (++reads === 2) change(h); };
    assert.deepEqual(h.port.beginImageInsertion!(), { ok: false, code }, name);
    h.f.onState = () => {};
    assert.equal(pointer(h), false, `${name}: the barrier was released`);
    h.port.destroy();
  }
});

test('an image operation maps the engine outcome to the public refusal code', async () => {
  const outcomes: [name: string, result: unknown, code: string][] = [
    ['resource limit', { ok: false, reason: 'resource-limit' }, 'resource-limit'],
    ['rejected image', { ok: false, reason: 'invalidArgs', detail: 'invalid-image' }, 'invalid-document'],
    ['other invalid argument', { ok: false, reason: 'invalidArgs', detail: 'invalid-position' }, 'engine-failed'],
    ['unsupported', { ok: false, reason: 'unsupported' }, 'engine-failed'],
    ['accepted without a change', { ok: true }, 'engine-failed'],
  ];
  for (const [label, open] of subjects) {
    for (const [name, result, code] of outcomes) {
      const s = await open(), handle = begun(s);
      s.answer(result);
      assert.deepEqual(await handle.run(s.request()), { ok: false, code }, `${label}: ${name}`);
      assert.equal(s.counts.armed(), 1, `${label}: ${name}: the commit was armed before the engine answered`);
      handle.release(); s.h.port.destroy();
    }
    const raced = await open(), running = begun(raced);
    raced.answer(async () => { raced.h.emit('selectionChange'); return { ok: false, reason: 'resource-limit' }; });
    assert.deepEqual(await running.run(raced.request()), { ok: false, code: 'stale-selection' }, `${label}: the owner changed while the engine answered`);
    running.release(); raced.h.port.destroy();
  }
});

test('a captured image operation reports the first thing that stopped matching its capture', async () => {
  type Change = (s: Subject) => void;
  const changes: [name: string, code: string, change: Change][] = [
    ['teardown', 'destroyed', s => s.h.port.destroy()],
    ['ownership loss', 'destroyed', s => s.setOwned(false)],
    ['engine failure', 'engine-failed', s => failEngine(s.h)],
    ['selection moved', 'stale-selection', s => s.h.emit('selectionChange')],
    ['revision change', 'stale-revision', s => { Object.assign(s.h.engine.surface!.session, { packageRevision: () => 99 }); }],
    ['package replacement', 'stale-revision', s => {
      const read = s.h.engine.surface!.session.currentPackage;
      Object.assign(s.h.engine.surface!.session, { currentPackage: () => ({ ...read() }) });
    }],
  ];
  for (const [label, open] of subjects) for (const [name, code, change] of changes) {
    const s = await open(), handle = begun(s);
    assert.deepEqual(handle.validate(), { ok: true, value: undefined }, `${label} before ${name}`);
    change(s);
    assert.deepEqual(handle.validate(), { ok: false, code }, `${label} after ${name}`);
    handle.release(); s.h.port.destroy();
  }
});

test('a composition attempt while an image operation holds the input barrier is blocked and does not interrupt it', async () => {
  for (const [label, open] of subjects) {
    const s = await open(), handle = begun(s);
    const start = new Event('compositionstart', { cancelable: true });
    s.h.child.dispatchEvent(start);
    assert.equal(start.defaultPrevented, true, `${label}: the engine never sees the composition`);
    assert.equal(s.h.port.inspect().composing, false, label);
    assert.deepEqual(handle.validate(), { ok: true, value: undefined }, label);
    assert.deepEqual(await handle.run(s.request()), { ok: true, value: undefined }, label);
    assert.equal(s.counts.dispatches(), 1, label);
    handle.release();
    // Once the barrier is released, a composition is an ordinary editing session again.
    s.h.child.dispatchEvent(new Event('compositionstart'));
    assert.equal(s.h.port.inspect().composing, true, label);
    s.h.port.destroy();
  }
});

test('a replacement refuses retained selections that do not belong to the captured image', async () => {
  type Retain = (h: Awaited<ReturnType<typeof replacementHarness>>) => object;
  const retentions: [name: string, retain: Retain][] = [
    ['a token the adapter never issued', () => ({})],
    ['a released selection', h => { const pin = h.port.retainSelection(); h.port.releaseSelection(pin); return pin; }],
    ['a selection from before the last selection change', h => { const pin = h.port.retainSelection(); h.emit('selectionChange'); return pin; }],
    ['a selection of another image', h => {
      const original = h.image.id;
      h.f.id = 'another-drawing'; h.image.id = 'another-drawing'; h.port.inspect();
      const pin = h.port.retainSelection();
      h.f.id = original; h.image.id = original; h.port.inspect();
      return pin;
    }],
    ['a selection whose caret has since moved', h => { const pin = h.port.retainSelection(); h.f.offset++; return pin; }],
  ];
  for (const [name, retain] of retentions) {
    const h = await replacementHarness(), pin = retain(h), handle = h.port.beginImageReplacement!();
    assert(handle.ok, name);
    assert.deepEqual(handle.value.validate(pin), { ok: false, code: 'stale-selection' }, name);
    handle.value.release(); h.port.destroy();
  }
});

test('an image operation runs once', async () => {
  for (const [label, open] of subjects) {
    const s = await open(), handle = begun(s);
    assert.deepEqual(await handle.run(s.request()), { ok: true, value: undefined }, label);
    const decodes = s.counts.decodes(), flushes = s.counts.flushes();
    assert.deepEqual(await handle.run(s.request()), { ok: false, code: 'stale-selection' }, label);
    assert.equal(s.counts.decodes(), decodes, label); assert.equal(s.counts.flushes(), flushes, label);
    assert.equal(s.counts.dispatches(), 1, label);
    handle.release(); s.h.port.destroy();
  }
});

test('an image operation returns a refusal from the caller original-state check or commit arming unchanged', async () => {
  for (const [label, open] of subjects) {
    const original = await open(), first = begun(original);
    assert.deepEqual(await first.run(original.request({ validateOriginal: () => ({ ok: false, code: 'stale-revision' }) })), { ok: false, code: 'stale-revision' }, label);
    assert.equal(original.counts.flushes(), 0, label); assert.equal(original.counts.dispatches(), 0, label);
    first.release(); original.h.port.destroy();

    const arming = await open(), second = begun(arming);
    assert.deepEqual(await second.run(arming.request({ armCommit: () => ({ ok: false, code: 'invalid-mount' }) })), { ok: false, code: 'invalid-mount' }, label);
    assert.equal(arming.counts.decodes(), 1, `${label}: only the isolated candidate was decoded`); assert.equal(arming.counts.dispatches(), 0, label);
    second.release(); arming.h.port.destroy();
  }
});

type Moment = (s: Subject, disturb: () => void) => void;
// Each moment of a running operation that can be disturbed from outside, in order, with the decoders acquired by then.
const moments: [name: string, acquired: number, arrange: Moment][] = [
  ['while pending input settles', 0, (s, disturb) => s.duringFlush(disturb)],
  ['while the drawing feature loads', 0, (s, disturb) => s.h.prepareWith(async features => { assert.deepEqual([...features], ['drawings']); disturb(); })],
  ['while the decoder is acquired', 1, (s, disturb) => {
    const surface = s.h.engine.surface!, acquire = surface.imageDecodePort;
    surface.imageDecodePort = () => { disturb(); return acquire(); };
  }],
  ['just after the isolated candidate qualified', 1, (s, disturb) => {
    const real = s.h.module.imageInsertion!;
    s.h.module.imageInsertion = { ...real, readZip: (...args) => { const zip = real.readZip(...args); queueMicrotask(disturb); return zip; } };
  }],
];

test('an image operation stops at the moment its owner or selection stops matching', async () => {
  const disturbances: [name: string, code: string, disturb: (s: Subject) => void][] = [
    ['ownership loss', 'destroyed', s => s.setOwned(false)],
    ['selection moved', 'stale-selection', s => s.h.emit('selectionChange')],
  ];
  for (const [label, open] of subjects) for (const [moment, acquired, arrange] of moments) for (const [name, code, disturb] of disturbances) {
    const s = await open();
    arrange(s, () => disturb(s));
    const handle = begun(s);
    assert.deepEqual(await handle.run(s.request()), { ok: false, code }, `${label} ${name} ${moment}`);
    assert.equal(s.counts.acquisitions(), acquired, `${label} ${name} ${moment}: no further decoder work after the mismatch`);
    assert.equal(s.counts.dispatches(), 0, `${label} ${name} ${moment}`); assert.equal(s.counts.armed(), 0, `${label} ${name} ${moment}`);
    handle.release(); s.h.port.destroy();
  }
});

test('an image operation does not consult the caller again once its original-state check has refused', async () => {
  for (const [label, open] of subjects) {
    const s = await open(), surface = s.h.engine.surface!, acquire = surface.imageDecodePort;
    let refusing = false, consulted = 0;
    surface.imageDecodePort = () => { refusing = true; return acquire(); };
    const handle = begun(s);
    const request = s.request({ validateOriginal: () => {
      if (!refusing) return { ok: true, value: undefined };
      consulted++;
      return { ok: false, code: 'stale-revision' };
    } });
    assert.deepEqual(await handle.run(request), { ok: false, code: 'stale-revision' }, label);
    assert.equal(consulted, 1, `${label}: the first refusal ended the operation`);
    assert.equal(s.counts.decodes(), 0, label); assert.equal(s.counts.dispatches(), 0, label);
    handle.release(); s.h.port.destroy();
  }
});

test('an image operation honours cancellation until its commit is armed', async () => {
  for (const [label, open] of subjects) {
    const early = await open(), cancelled = new AbortController(), handle = begun(early);
    cancelled.abort();
    assert.deepEqual(await handle.run(early.request({ signal: cancelled.signal })), { ok: false, code: 'aborted' }, `${label} before it started`);
    assert.equal(early.counts.flushes(), 0, label); assert.equal(early.counts.acquisitions(), 0, label); assert.equal(early.counts.decodes(), 0, label);
    handle.release(); early.h.port.destroy();

    for (const [moment, acquired, arrange] of moments) {
      const s = await open(), controller = new AbortController();
      arrange(s, () => controller.abort());
      const running = begun(s);
      assert.deepEqual(await running.run(s.request({ signal: controller.signal })), { ok: false, code: 'aborted' }, `${label} ${moment}`);
      assert.equal(s.counts.acquisitions(), acquired, `${label} ${moment}: no further decoder work after the cancellation`);
      assert.equal(s.counts.dispatches(), 0, `${label} ${moment}`); assert.equal(s.counts.armed(), 0, `${label} ${moment}`);
      running.release(); s.h.port.destroy();
    }
  }
});
