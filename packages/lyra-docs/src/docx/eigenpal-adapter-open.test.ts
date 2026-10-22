import assert from 'node:assert/strict';
import test from 'node:test';
import { openEigenpalDocument } from './eigenpal-adapter.js';
import type { DocxEngineEvent } from './engine-port.js';
import { deferred, harness, imageHarness, openSubscribed, reached } from '../../test/eigenpal-adapter-harness.js';

type Harness = ReturnType<typeof harness>;
type Snapshot = ReturnType<Harness['engine']['snapshot']>;

const loading = () => ({ isLoading: true, isOpening: false, parseError: null, page: { total: 0 },
  selection: null, selectionCollapsed: true, image: null }) as unknown as Snapshot;

function open(h: Harness, controller: AbortController, owned: () => boolean = () => true) {
  return openEigenpalDocument({ mount: h.mount }, { kind: 'blank' }, { readOnly: false, signal: controller.signal }, owned, h.loader);
}

function assertSurfaceReleased(h: Harness, label: string) {
  assert.equal(h.destroyCount(), 1, label); assert.equal(h.removed(), true, label);
  assert.equal(h.viewportRemoves(), 1, label); assert.equal(h.child.inert, true, label);
}

test('a lazy module that fails to load refuses without attaching a surface and reports a cancelled open as cancelled', async () => {
  for (const cancelled of [false, true]) {
    const h = harness(), controller = new AbortController();
    const opened = await openEigenpalDocument({ mount: h.mount }, { kind: 'blank' },
      { readOnly: false, signal: controller.signal }, () => true, async () => {
        if (cancelled) controller.abort();
        throw new Error('module unavailable');
      });
    assert.deepEqual(opened, { ok: false, code: cancelled ? 'aborted' : 'engine-unavailable' });
    assert.equal(h.creation(), undefined); assert.equal(h.loadCount(), 0);
    assert.equal(h.elementsCreated(), 0, 'no surface was created'); assert.equal(h.removed(), false);
  }
});

test('the engine loads the caller document bytes, or a blank document when none is given', async () => {
  const sources: unknown[] = [];
  for (const source of [{ kind: 'blank' }, { kind: 'docx', bytes: new Uint8Array([80, 75, 3, 4]) }] as const) {
    const h = harness(), load = h.engine.load.bind(h.engine);
    h.engine.load = (document => { sources.push(document); load(document); }) as typeof h.engine.load;
    const opened = await openEigenpalDocument({ mount: h.mount }, source, { readOnly: false, signal: new AbortController().signal }, () => true, h.loader);
    assert(opened.ok);
    opened.value.destroy();
  }
  assert.equal(sources[0], 'blank');
  assert(sources[1] instanceof Uint8Array); assert.deepEqual([...sources[1]], [80, 75, 3, 4]);
});

test('an engine whose readiness probe throws fails the open and releases the surface', async () => {
  const h = harness();
  h.engine.snapshot = () => { throw new Error('probe failed'); };
  assert.deepEqual(await open(h, new AbortController()), { ok: false, code: 'open-failed' });
  assertSurfaceReleased(h, 'probe failure');
});

test('a cancellation or ownership loss that lands as the document becomes ready tears the surface down', async () => {
  for (const [lost, expected] of [['signal', 'aborted'], ['mount', 'invalid-mount']] as const) {
    const h = harness(), controller = new AbortController();
    let owned = true;
    const load = h.engine.load.bind(h.engine);
    // Queued ahead of the open continuation: readiness has settled but nothing has resumed yet.
    h.engine.load = (...args) => {
      load(...args);
      queueMicrotask(() => { if (lost === 'signal') controller.abort(); else owned = false; });
    };
    assert.deepEqual(await open(h, controller, () => owned), { ok: false, code: expected }, lost);
    assertSurfaceReleased(h, lost);
  }
});

test('an open that is cancelled or orphaned while still waiting for the engine refuses and releases the surface', async () => {
  for (const [lost, expected] of [['signal', 'aborted'], ['mount', 'invalid-mount']] as const) {
    const h = harness(), controller = new AbortController(), polled = deferred<void>();
    let owned = true;
    h.engine.snapshot = () => { polled.resolve(); return loading(); };
    const opening = open(h, controller, () => owned);
    assert(await reached(polled.promise, opening), `${lost}: the open began waiting for the engine`);
    if (lost === 'signal') controller.abort();
    else { owned = false; h.emit('selectionChange'); }
    assert.deepEqual(await opening, { ok: false, code: expected }, lost);
    assertSurfaceReleased(h, lost);
  }
});

test('a document the engine cannot parse, or an engine that reports a failure while opening, is an invalid document', async () => {
  for (const failure of ['parse error', 'engine error']) {
    const h = harness();
    if (failure === 'parse error') h.engine.snapshot = () => ({ ...loading(), isLoading: false, parseError: { message: 'Unsupported' } }) as unknown as Snapshot;
    else h.engine.load = () => { h.emit('error'); };
    assert.deepEqual(await open(h, new AbortController()), { ok: false, code: 'invalid-document' }, failure);
    assertSurfaceReleased(h, failure);
  }
});

test('an open that never becomes ready within its deadline fails and releases the surface', async context => {
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const h = harness(), polled = deferred<void>();
  let outcome: unknown = 'pending';
  h.engine.snapshot = () => { polled.resolve(); return loading(); };
  const opening = open(h, new AbortController()).then(value => { outcome = value; });
  assert(await reached(polled.promise, opening), 'the open began waiting for the engine');
  const settle = () => new Promise(resolve => setImmediate(resolve));
  context.mock.timers.tick(29_000);
  await settle();
  assert.equal(outcome, 'pending', 'still waiting before the deadline');
  assert.equal(h.destroyCount(), 0);
  context.mock.timers.tick(1_000);
  await settle();
  assert.deepEqual(outcome, { ok: false, code: 'open-failed' });
  assertSurfaceReleased(h, 'deadline');
});

test('teardown releases every engine subscription and the surface even when each release throws', async () => {
  const h = harness(), subscribe = h.engine.on.bind(h.engine), released: string[] = [];
  let failing = false;
  h.engine.on = ((event, listener) => {
    const off = subscribe(event, listener);
    return () => {
      off();
      if (!failing) return;
      released.push(event);
      throw new Error('unsubscribe failed');
    };
  }) as typeof h.engine.on;
  const port = await openSubscribed(h);
  failing = true;
  assert.doesNotThrow(() => port.destroy());
  assert.deepEqual([...released].sort(), ['change', 'error', 'selectionChange']);
  assertSurfaceReleased(h, 'failing releases');
});

test('native input that arrives while teardown is releasing listeners arms no settlement', async context => {
  const h = harness(), port = await openSubscribed(h), events: DocxEngineEvent[] = [];
  port.subscribe(event => { events.push(event); });
  const timers = context.mock.method(globalThis, 'setTimeout');
  const remove = h.child.removeEventListener.bind(h.child);
  let injected = false;
  h.child.removeEventListener = ((...args: Parameters<typeof remove>) => {
    if (!injected) {
      injected = true;
      h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
    }
    return remove(...args);
  }) as typeof h.child.removeEventListener;
  const scheduled = timers.mock.callCount();
  port.destroy();
  assert.equal(injected, true);
  assert.equal(timers.mock.callCount(), scheduled, 'no settlement timer was started');
  assert.throws(() => port.can('bold'), /Engine unavailable/, 'a destroyed adapter is not left reporting busy');
  assert.deepEqual(events, []);
});

test('the raster decode port reports pixel size, refuses bitmaps outside its limits and always releases the bitmap', async () => {
  const h = harness(), bitmaps: { width: number; height: number; closed: boolean; close(): void }[] = [], requests: unknown[] = [];
  let next = { width: 8, height: 4 };
  Object.assign(h.document, { defaultView: { createImageBitmap: async (blob: Blob, options: unknown) => {
    requests.push([blob.type, blob.size, options]);
    const bitmap = { ...next, closed: false, close() { this.closed = true; } };
    bitmaps.push(bitmap);
    return bitmap;
  } } });
  const port = await openSubscribed(h), decoder = h.creation()!.imageDecodePort!;
  const limits = { maxEncodedBytes: 1024, maxDecodedBytes: 1024, maxPixels: 32, maxDimension: 64, maxPolygonPoints: 8, maxExternalRedirects: 0 };
  const decoded = await decoder.decode(new Uint8Array([1, 2, 3]), 'image/png', limits);
  assert.deepEqual(decoded, { pixelWidth: 8, pixelHeight: 4, dpiX: 96, dpiY: 96 });
  assert(Object.isFrozen(decoded));
  assert.deepEqual(requests, [['image/png', 3, { imageOrientation: 'from-image' }]]);
  assert.equal(bitmaps[0]!.closed, true);
  for (const [name, size] of [['over the pixel limit', { width: 9, height: 4 }], ['no width', { width: 0, height: 4 }], ['no height', { width: 8, height: 0 }]] as const) {
    next = size;
    await assert.rejects(decoder.decode(new Uint8Array([1]), 'image/png', limits), /Image limits/, name);
    assert.equal(bitmaps.at(-1)!.closed, true, `${name}: the bitmap is released`);
  }
  port.destroy();
});

test('inspection derives the selection kind from the engine snapshot', async () => {
  const h = harness(), port = await openSubscribed(h), snapshot = h.engine.snapshot;
  const withSelection = (selection: object | null, selectionCollapsed: boolean) => {
    h.engine.snapshot = () => ({ ...snapshot(), selection, selectionCollapsed }) as unknown as Snapshot;
    return port.inspect().selection;
  };
  assert.equal(withSelection(null, true), 'none');
  assert.equal(withSelection({}, true), 'caret');
  assert.equal(withSelection({}, false), 'text');
  port.destroy();
});

test('while native input settles, inspection keeps the last context and re-derives only the selection kind and composition', async () => {
  const h = await imageHarness();
  h.f.id = ''; h.port.inspect();
  const before = h.port.inspect(), reads = h.f.reads;
  assert.equal(before.selection, 'caret');
  h.child.dispatchEvent(new Event('beforeinput', { cancelable: true }));
  const surface = h.engine.surface!, state = surface.state;
  const during = () => h.port.inspect();
  assert.equal(during().selection, 'caret', 'a collapsed caret');
  assert.equal(during().formatting, before.formatting, 'the formatting copy is reused'); assert.equal(h.f.reads, reads, 'no layout read');
  surface.state = () => { const value = state(); return { ...value, selection: { ...value.selection, head: { ...value.selection.head, offset: value.selection.head.offset + 3 } } }; };
  assert.equal(during().selection, 'text', 'a range');
  surface.state = () => ({ ...state(), cellSelection: {} as NonNullable<ReturnType<typeof state>['cellSelection']> });
  assert.equal(during().selection, 'other', 'a cell selection');
  surface.state = state;
  assert.equal(during().composing, false);
  h.child.dispatchEvent(new Event('compositionstart'));
  assert.equal(during().composing, true, 'composition is reported live, not from the cached context');
  Object.assign(h.engine, { surface: null });
  assert.equal(during().selection, 'none', 'no surface, no selection');
  h.port.destroy();
});

test('inspection fails closed once the engine reports its document as unparsable', async () => {
  const h = harness(), port = await openSubscribed(h), snapshot = h.engine.snapshot;
  assert.equal(port.inspect().selection, 'caret');
  h.engine.snapshot = () => ({ ...snapshot(), parseError: { message: 'Unsupported' } }) as unknown as Snapshot;
  assert.throws(() => port.inspect(), /Engine failed/);
  port.destroy();
});

test('a resource refresh abandons its publication when the document changes while the version is read', async context => {
  const h = await imageHarness(), events: DocxEngineEvent[] = [];
  context.mock.timers.enable({ apis: ['setTimeout'] });
  h.image.resourceStatus = 'pending'; h.port.inspect();
  h.port.subscribe(event => { events.push(event); });
  const stateVersion = h.engine.stateVersion;
  // The owner changes while the engine is being asked for its version.
  h.engine.stateVersion = () => { h.f.revision++; return stateVersion(); };
  h.image.resourceStatus = 'ready'; h.f.version++;
  const reads = h.f.versionReads;
  context.mock.timers.tick(20);
  assert.equal(h.f.versionReads, reads + 1, 'the version was read once');
  assert.deepEqual(events, [], 'a version read under a changed owner is not published');
  for (let attempt = 0; attempt < 15; attempt++) context.mock.timers.tick(1000);
  assert.equal(h.f.versionReads, reads + 1, 'the abandoned refresh does not retry');
  h.port.destroy();
});
