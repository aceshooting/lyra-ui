import assert from 'node:assert/strict';
import { test } from 'node:test';
import { internalDocxCharts, internalDocxSelectedImageElement, setInternalDocxZoom } from './session.js';
import { deferred, fixture, formatting, opened, refusal, value } from '../../test/session-fixture.js';
import type { DocxEnginePort } from './engine-port.js';
import type { DocxSession } from './types.js';

test('destruction releases every independently owned handle even when one release throws', async () => {
  for (const faulty of ['unsubscribe', 'engine', 'lease', 'mount'] as const) {
    const { f, engine, port, create } = fixture();
    if (faulty === 'unsubscribe') {
      const subscribe = engine.subscribe.bind(engine);
      engine.subscribe = next => { const off = subscribe(next); return () => { off(); throw new Error('unsubscribe fault'); }; };
    }
    if (faulty === 'engine') engine.destroy = () => { f.destroyed++; throw new Error('engine fault'); };
    if (faulty === 'lease') engine.releaseSelection = token => { f.released.push(token); throw new Error('lease fault'); };
    if (faulty === 'mount') {
      const claim = port.claimMount.bind(port);
      port.claimMount = (mount, onLost) => {
        const claimed = claim(mount, onLost);
        return claimed.ok ? { ok: true, value: { valid: claimed.value.valid,
          release() { claimed.value.release(); throw new Error('mount fault'); } } } : claimed;
      };
    }
    const session = value(create());
    value(await session.open({ kind: 'blank' }));
    value(session.retainSelection());
    assert.doesNotThrow(() => session.destroy(), faulty);
    assert.equal(session.snapshot().status, 'destroyed', faulty);
    assert.equal(f.subscriptions, 0, faulty); assert.equal(f.destroyed, 1, faulty);
    assert.equal(f.claimsReleased, 1, faulty); assert.equal(f.released.length, 1, faulty);
  }
});

test('a claim that cannot be released does not turn a refused construction into an exception', () => {
  const { f, port, create } = fixture();
  let releases = 0;
  port.claimMount = () => ({ ok: true, value: { valid: () => false, release() { releases++; throw new Error('mount fault'); } } });
  refusal(create(), 'invalid-mount');
  assert.equal(releases, 1); assert.equal(f.opens, 0);
});

test('presentation bridges answer inertly for a missing session or one that was never opened', () => {
  assert.deepEqual(internalDocxCharts(null), []);
  assert.deepEqual(internalDocxCharts({} as never), []);
  assert.equal(setInternalDocxZoom(null, 'fit'), false);
  assert.equal(setInternalDocxZoom({} as never, 1), false);
  assert.equal(internalDocxSelectedImageElement(null), null);
  assert.equal(internalDocxSelectedImageElement({} as never), null);
  const unopened = value(fixture().create());
  assert.deepEqual(internalDocxCharts(unopened), []);
  assert.equal(setInternalDocxZoom(unopened, 1), false);
  assert.equal(internalDocxSelectedImageElement(unopened), null);
});

test('presentation bridges never reach an engine that is still opening, destroyed or whose mount was taken', async () => {
  const bridges = {
    charts: (session: DocxSession) => internalDocxCharts(session),
    zoom: (session: DocxSession) => setInternalDocxZoom(session, 1),
    element: (session: DocxSession) => internalDocxSelectedImageElement(session)
  } as const;
  const inert = { charts: [], zoom: false, element: null } as const;
  for (const bridge of ['charts', 'zoom', 'element'] as const) {
    for (const state of ['opening', 'destroyed', 'mount taken'] as const) {
      const { f, engine, create } = fixture();
      const session = value(create());
      let calls = 0, answer: unknown = 'unasked';
      engine.charts = () => { calls++; return []; };
      engine.setZoom = () => { calls++; return true; };
      engine.selectedImageElement = () => { calls++; return {} as HTMLElement; };
      const inspect = engine.inspect.bind(engine);
      engine.inspect = () => {
        if (state === 'opening') answer = bridges[bridge](session);
        return { ...inspect(), image: { widthPoints: 40, heightPoints: 20 }, imageReady: true };
      };
      value(await session.open({ kind: 'blank' }));
      if (state === 'destroyed') session.destroy();
      if (state === 'mount taken') f.valid = false;
      if (state !== 'opening') answer = bridges[bridge](session);
      const label = `${bridge} while ${state}`;
      assert.deepEqual(answer, inert[bridge], label);
      assert.equal(calls, 0, label);
      assert.equal(session.snapshot().status, state === 'opening' ? 'ready' : 'destroyed', label);
    }
  }
});

test('chart placements and zoom reach a ready engine, and an invalid zoom never does', async () => {
  const { session, engine } = await opened();
  const placements = Object.freeze([{ drawingId: 'drawing-1' }]) as unknown as ReturnType<NonNullable<DocxEnginePort['charts']>>;
  const zooms: (number | 'fit')[] = [];
  engine.charts = () => placements;
  engine.setZoom = zoom => { zooms.push(zoom); return true; };
  assert.equal(internalDocxCharts(session), placements);
  for (const zoom of [0.25, 1, 4, 'fit'] as const) assert.equal(setInternalDocxZoom(session, zoom), true, String(zoom));
  for (const zoom of [0.24, 4.01, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(setInternalDocxZoom(session, zoom), false, String(zoom));
  }
  assert.deepEqual(zooms, [0.25, 1, 4, 'fit']);
});

test('a ready engine without the optional presentation hooks yields inert answers', async () => {
  const { session, engine, f } = await opened();
  engine.inspect = () => ({ selection: 'other', composing: false, formatting,
    image: { widthPoints: 40, heightPoints: 20 }, imageReady: true });
  f.emit('user-selection');
  assert.deepEqual(session.snapshot().image, { widthPoints: 40, heightPoints: 20 });
  assert.deepEqual(internalDocxCharts(session), []);
  assert.equal(setInternalDocxZoom(session, 1), false);
  assert.equal(internalDocxSelectedImageElement(session), null);
});

test('the painted image element is requested only while a ready image is selected and the session is not busy', async () => {
  const { session, engine, f } = await opened();
  const element = {} as HTMLElement;
  let reads = 0, image: { widthPoints: number; heightPoints: number } | null = null, ready = false;
  engine.selectedImageElement = () => { reads++; return element; };
  engine.inspect = () => ({ selection: 'other', composing: false, formatting, image, imageReady: ready });
  f.emit('state');
  assert.equal(internalDocxSelectedImageElement(session), null, 'no image is selected');
  image = { widthPoints: 40, heightPoints: 20 }; f.emit('state');
  assert.equal(internalDocxSelectedImageElement(session), null, 'the image is not ready');
  ready = true; f.emit('state');
  assert.equal(internalDocxSelectedImageElement(session), element);
  assert.equal(reads, 1);
  f.saveGate = deferred();
  const saving = session.save();
  assert.equal(internalDocxSelectedImageElement(session), null, 'a save is running');
  f.saveGate.resolve(f.output); value(await saving);
  assert.equal(reads, 1);
});

test('a destroyed session hands out an inert disposer and retains no listener', async () => {
  const { session } = await opened();
  session.destroy();
  let calls = 0;
  const off = session.subscribe(() => { calls++; });
  assert.equal((session as unknown as { listeners: Set<unknown> }).listeners.size, 0);
  assert.doesNotThrow(off);
  assert.equal(calls, 0);
});

test('opening is refused without port work once the session is destroyed or its mount was taken', async () => {
  for (const loss of ['destroyed', 'mount-taken'] as const) {
    const { f, create } = fixture();
    const session = value(create());
    if (loss === 'destroyed') session.destroy(); else f.valid = false;
    refusal(await session.open({ kind: 'blank' }), 'destroyed');
    assert.equal(f.opens, 0, loss); assert.equal(f.claimsReleased, 1, loss);
    assert.equal(session.snapshot().status, 'destroyed', loss);
  }
});

test('a failed opening whose error notification destroys the session reports the destruction', async () => {
  const { f, port, create } = fixture();
  port.open = async () => ({ ok: false, code: 'engine-unavailable' });
  const session = value(create());
  session.subscribe(() => { if (session.snapshot().status === 'error') session.destroy(); });
  refusal(await session.open({ kind: 'blank' }), 'destroyed');
  assert.equal(session.snapshot().status, 'destroyed'); assert.equal(session.snapshot().error, null);
  assert.equal(f.claimsReleased, 1);
});

test('an engine that arrives after the caller aborted is destroyed without ever being subscribed', async () => {
  const { f, engine, create } = fixture();
  f.openGate = deferred();
  const session = value(create());
  const controller = new AbortController();
  const pending = session.open({ kind: 'blank' }, { signal: controller.signal });
  f.openGate.resolve({ ok: true, value: engine });
  queueMicrotask(() => controller.abort());
  refusal(await pending, 'aborted');
  assert.equal(session.snapshot().status, 'error');
  assert.deepEqual(session.snapshot().error, { code: 'aborted' });
  assert.equal(f.destroyed, 1); assert.equal(f.subscriptions, 0); assert.equal(f.claimsReleased, 1);
});

test('aborting while the engine is being attached ends in error and releases what was acquired', async () => {
  for (const phase of ['subscribe', 'inspect'] as const) {
    const { f, engine, create } = fixture();
    const session = value(create());
    const controller = new AbortController();
    let inspections = 0;
    const inspect = engine.inspect.bind(engine);
    engine.inspect = () => { inspections++; if (phase === 'inspect') controller.abort(); return inspect(); };
    if (phase === 'subscribe') {
      const subscribe = engine.subscribe.bind(engine);
      engine.subscribe = next => { const off = subscribe(next); controller.abort(); return off; };
    }
    refusal(await session.open({ kind: 'blank' }, { signal: controller.signal }), 'aborted');
    assert.equal(session.snapshot().status, 'error', phase);
    assert.deepEqual(session.snapshot().error, { code: 'aborted' }, phase);
    assert.equal(session.snapshot().revision, null, phase);
    assert.equal(inspections, phase === 'subscribe' ? 0 : 1, phase);
    assert.equal(f.destroyed, 1, phase); assert.equal(f.subscriptions, 0, phase); assert.equal(f.claimsReleased, 1, phase);
  }
});

test('engine events delivered before the document is ready are ignored', async () => {
  const { f, engine, create } = fixture();
  const session = value(create());
  const inspect = engine.inspect.bind(engine);
  engine.inspect = () => { f.emit('change'); f.emit('user-selection'); f.emit('composition'); return inspect(); };
  const revision = value(await session.open({ kind: 'blank' }));
  assert.equal(revision.value, 0);
  assert.equal(session.snapshot().status, 'ready'); assert.equal(session.snapshot().dirty, false);
  assert.equal(session.snapshot().selection.version, 0);
});

test('an event whose lease release destroys the session or takes its mount never reaches engine inspection', async () => {
  for (const event of ['change', 'user-selection', 'composition'] as const) {
    for (const effect of ['destroy', 'mount-taken'] as const) {
      const { f, engine, session } = await opened();
      value(session.retainSelection());
      let inspections = 0;
      const inspect = engine.inspect.bind(engine);
      engine.inspect = () => { inspections++; return inspect(); };
      engine.releaseSelection = token => {
        f.released.push(token);
        if (effect === 'destroy') session.destroy(); else f.valid = false;
      };
      const label = `${event} ${effect}`;
      assert.doesNotThrow(() => f.emit(event), label);
      assert.equal(inspections, 0, label); assert.equal(f.released.length, 1, label);
      assert.equal(session.snapshot().status, 'destroyed', label); assert.equal(f.destroyed, 1, label);
    }
  }
});

test('an engine fault that follows the engine destroying its session leaves the session destroyed', async () => {
  const { f, engine, session } = await opened();
  engine.inspect = () => { session.destroy(); throw new Error('private document details'); };
  assert.doesNotThrow(() => f.emit('change'));
  assert.equal(session.snapshot().status, 'destroyed'); assert.equal(session.snapshot().error, null);
  assert.equal(f.destroyed, 1); assert.equal(f.claimsReleased, 1);
});

test('a save receipt cannot be acknowledged on a destroyed session', async () => {
  const { f, session } = await opened(false, { kind: 'blank' });
  f.emit('change');
  const receipt = value(await session.save());
  session.destroy();
  refusal(session.acknowledgeSaved(receipt), 'destroyed');
  assert.equal(session.snapshot().dirty, true);
});
